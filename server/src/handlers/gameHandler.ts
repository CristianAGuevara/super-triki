import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, GameMovePayload, ServerToClientEvents } from '../types/socket.js'
import type { GameSettings, Size } from '../types/game.js'
import { DEFAULT_GAME_SETTINGS, isPlayerColorId } from '../types/game.js'
import { RoomManager } from '../rooms/RoomManager.js'
import type { RoomState } from '../rooms/RoomManager.js'
import {
  TournamentManager,
  tournamentChannel,
} from '../tournaments/TournamentManager.js'
import type { TournamentRoomAssignment } from '../types/socket.js'
import { emitRoomEvent } from '../redis.js'
import {
  buildInitialGameState,
  validateMove,
  applyMove,
  skipTurn,
  toSnapshot,
} from '../engine/GameEngine.js'

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>
const turnTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearTurnTimer(roomId: string) {
  const timer = turnTimers.get(roomId)
  if (timer) clearTimeout(timer)
  turnTimers.delete(roomId)
}

function scheduleTurnTimer(io: TypedServer, roomId: string) {
  clearTurnTimer(roomId)
  void RoomManager.getRoom(roomId).then(room => {
    const game = room?.game
    if (!room || room.phase !== 'playing' || !game || game.winResult || game.isDraw ||
        !game.settings.turnTimerEnabled) return
    if (!room.players.some(player => player.socketId)) return
    const expectedTurnNumber = game.turnNumber
    const expectedPlayer = game.currentPlayer
    const durationMs = game.settings.turnDurationSeconds * 1_000
    const remaining = Math.max(0, game.turnStartedAt + durationMs - Date.now())
    const timer = setTimeout(() => {
      void RoomManager.withRoomLock(roomId, async () => {
        const currentRoom = await RoomManager.getRoom(roomId)
        const currentGame = currentRoom?.game
        if (!currentRoom || currentRoom.phase !== 'playing' || !currentGame ||
            currentGame.turnNumber !== expectedTurnNumber || currentGame.currentPlayer !== expectedPlayer ||
            !currentRoom.players.some(player => player.socketId)) return false

        const skippedGame = skipTurn(currentGame)
        const finished = skippedGame.isDraw
        if (finished) {
          currentRoom.lastGame = skippedGame
          currentRoom.game = null
          currentRoom.phase = 'waiting'
        } else {
          currentRoom.game = skippedGame
        }
        await RoomManager.persistRoom(currentRoom)
        return { room: currentRoom, game: skippedGame, finished }
      }).then(async result => {
        if (!result) return
        await emitRoomEvent(io, roomId, 'game:turn-timeout', { player: expectedPlayer })
        await emitRoomEvent(io, roomId, 'game:state', toSnapshot(result.game))
        if (result.finished) {
          await emitRoomEvent(io, roomId, 'room:state', RoomManager.toSnapshot(result.room))
          await emitRoomEvent(io, roomId, 'game:over', { winResult: null, finalState: toSnapshot(result.game) })
          await broadcastRoomList(io)
        } else {
          scheduleTurnTimer(io, roomId)
        }
      }).catch(error => console.error('[game:turn-timeout]', error))
    }, remaining)
    turnTimers.set(roomId, timer)
  }).catch(error => console.error('[game:timer-load]', error))
}

async function broadcastRoomList(io: TypedServer) {
  await emitRoomEvent(io, 'lobby', 'rooms:list', await RoomManager.getPublicRooms())
}

async function emitTournamentState(io: TypedServer, tournamentId: string) {
  const state = await TournamentManager.getSnapshot(tournamentId)
  if (state) {
    await emitRoomEvent(io, tournamentChannel(tournamentId), 'tournament:state', state)
  }
}

async function emitTournamentAssignments(
  io: TypedServer,
  assignments: TournamentRoomAssignment[],
) {
  const roomIds = new Set<string>()
  for (const assignment of assignments) {
    roomIds.add(assignment.roomId)
    const room = await RoomManager.getRoom(assignment.roomId)
    const socketId = room?.players.find(player => player.slot === assignment.playerSlot)?.socketId
    if (socketId) {
      await emitRoomEvent(io, socketId, 'tournament:assigned', assignment)
    }
  }
  for (const roomId of roomIds) {
    scheduleTurnTimer(io, roomId)
  }
}

function leaveOtherRoomChannels(socket: TypedSocket, roomId: string): void {
  for (const joined of socket.rooms) {
    if (joined === socket.id || joined === roomId || joined === 'lobby' ||
        joined.startsWith('tournament:')) continue
    socket.leave(joined)
  }
}

async function completeTournamentGroup(
  io: TypedServer,
  room: RoomState,
  game: { winResult: { winner: number } | null },
) {
  const meta = room.tournament
  if (!meta) return
  const winnerSlot = game.winResult?.winner ?? null
  const result = await TournamentManager.recordGroupResult(
    meta.id,
    meta.groupId,
    room.roomId,
    winnerSlot === null ? null : winnerSlot as 1 | 2 | 3 | 4,
  )
  if (!result) return
  await emitRoomEvent(io, tournamentChannel(meta.id), 'tournament:state', result.state)
  await emitTournamentAssignments(io, result.assignments)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSize(value: unknown): value is Size {
  return value === 'large' || value === 'medium' || value === 'small'
}

function normalizeGameSettings(value: unknown, fallback: GameSettings): GameSettings {
  const settings = isRecord(value) ? value : fallback
  const durations = [30, 45, 60, 90, 120, 180]
  const duration = Number(settings.turnDurationSeconds)
  const turnTimerEnabled = settings.turnTimerEnabled === true
  return {
    turnTimerEnabled,
    turnDurationSeconds: durations.includes(duration) ? duration : fallback.turnDurationSeconds,
    removePieceOnTimeout: turnTimerEnabled && settings.removePieceOnTimeout === true,
  }
}

function isValidMovePayload(value: unknown): value is GameMovePayload {
  if (!isRecord(value)) return false
  return typeof value.roomId === 'string' && value.roomId.trim().length > 0 &&
    typeof value.pieceId === 'string' && value.pieceId.length > 0 &&
    Number.isInteger(value.targetRow) && Number.isInteger(value.targetCol) &&
    isSize(value.targetSize)
}

function emitCurrentGame(socket: TypedSocket, room: RoomState | undefined): void {
  const game = room?.game ?? room?.lastGame
  if (!game) return

  if (room?.game) socket.emit('game:state', toSnapshot(game))
  if (game.winResult || game.isDraw) {
    socket.emit('game:over', {
      winResult: game.winResult,
      finalState: toSnapshot(game),
    })
  }
}

export function registerGameHandler(io: TypedServer, socket: TypedSocket): void {

  // All new connections join the lobby channel to receive room list updates
  socket.join('lobby')
  void RoomManager.getPublicRooms().then(rooms => socket.emit('rooms:list', rooms))

  // ── rooms:get ────────────────────────────────────────────────
  socket.on('rooms:get', async ack => {
    ack(await RoomManager.getPublicRooms())
  })

  // ── spectate:join ────────────────────────────────────────────
  socket.on('spectate:join', async (payload, ack) => {
    if (!isRecord(payload) || typeof payload.roomId !== 'string') {
      ack({ ok: false, error: 'Datos inválidos' })
      return
    }

    const roomId = payload.roomId.trim().toUpperCase()
    const room = await RoomManager.getRoom(roomId)
    if (!room) {
      ack({ ok: false, error: 'Sala no encontrada' })
      return
    }
    if (await RoomManager.getRoomBySocket(socket.id)) {
      ack({ ok: false, error: 'Ya estás jugando en una sala' })
      return
    }
    if (TournamentManager.getTournamentIdBySocket(socket.id)) {
      ack({ ok: false, error: 'Ya estás en un torneo' })
      return
    }

    const currentSpectatorRoom = RoomManager.getSpectatorRoom(socket.id)
    if (currentSpectatorRoom && currentSpectatorRoom.roomId !== roomId) {
      ack({ ok: false, error: 'Ya estás viendo otra sala' })
      return
    }

    const joinedRoom = await RoomManager.withRoomLock(roomId, () => RoomManager.joinSpectator(roomId, socket.id))
    if (!joinedRoom) {
      ack({ ok: false, error: 'Sala no encontrada' })
      return
    }
    socket.leave('lobby')
    socket.join(roomId)
    ack({ ok: true, roomId, roomState: RoomManager.toSnapshot(joinedRoom) })
    emitCurrentGame(socket, joinedRoom)
    scheduleTurnTimer(io, roomId)
  })

  // ── room:create ──────────────────────────────────────────────
  socket.on('room:create', async (payload, ack) => {
    if (!isRecord(payload)) {
      ack({ ok: false, error: 'Datos inválidos' })
      return
    }
    const username = typeof payload.username === 'string' ? payload.username.trim() : ''
    const name = typeof payload.name === 'string' ? payload.name : ''
    const isPrivate = payload.isPrivate === true
    const password = typeof payload.password === 'string' ? payload.password : undefined

    if (!username) {
      ack({ ok: false, error: 'Nombre requerido' })
      return
    }
    if (await RoomManager.getRoomBySocket(socket.id) ||
        RoomManager.getSpectatorRoom(socket.id) ||
        TournamentManager.getTournamentIdBySocket(socket.id)) {
      ack({ ok: false, error: 'Ya estás en una sala o torneo' })
      return
    }
    const room = await RoomManager.createRoom(username.trim(), socket.id, name, isPrivate, password)
    socket.leave('lobby')
    socket.join(room.roomId)
    ack({
      ok: true,
      roomId: room.roomId,
      playerSlot: 1,
      reconnectToken: room.reconnectTokens[1],
      roomState: RoomManager.toSnapshot(room),
    })
    socket.emit('room:state', RoomManager.toSnapshot(room))
    await broadcastRoomList(io)
  })

  // ── room:reconnect ───────────────────────────────────────────
  socket.on('room:reconnect', async (payload, ack) => {
    if (!isRecord(payload) || typeof payload.roomId !== 'string' ||
        typeof payload.reconnectToken !== 'string' || !payload.reconnectToken) {
      ack({ ok: false, error: 'Datos de reconexión inválidos' })
      return
    }

    const roomId = payload.roomId.trim().toUpperCase()
    const result = await RoomManager.withRoomLock(roomId, () =>
      RoomManager.reconnectRoom(roomId, payload.reconnectToken as string, socket.id)
    )
    if (!result.ok) {
      ack({ ok: false, error: result.error })
      return
    }

    if (result.previousSocketId) {
      io.in(result.previousSocketId).disconnectSockets(true)
    }
    socket.leave('lobby')
    leaveOtherRoomChannels(socket, roomId)
    socket.join(roomId)
    if (result.room.game?.currentPlayer === result.slot) {
      await emitRoomEvent(io, roomId, 'game:clock', { turnStartedAt: result.room.game.turnStartedAt })
    }
    ack({
      ok: true,
      roomId,
      playerSlot: result.slot,
      reconnectToken: result.room.reconnectTokens[result.slot],
      roomState: RoomManager.toSnapshot(result.room),
    })
    await emitRoomEvent(io, roomId, 'room:state', RoomManager.toSnapshot(result.room))
    emitCurrentGame(socket, result.room)
    scheduleTurnTimer(io, roomId)
    await broadcastRoomList(io)
  })

  // ── room:join ────────────────────────────────────────────────
  socket.on('room:join', async (payload, ack) => {
    if (!isRecord(payload)) {
      ack({ ok: false, error: 'Datos inválidos' })
      return
    }
    const roomId = typeof payload.roomId === 'string' ? payload.roomId.trim().toUpperCase() : ''
    const username = typeof payload.username === 'string' ? payload.username.trim() : ''
    const password = typeof payload.password === 'string' ? payload.password : undefined

    if (!username) {
      ack({ ok: false, error: 'Nombre requerido' })
      return
    }

    const existing = await RoomManager.getRoom(roomId)
    if (!existing) {
      ack({ ok: false, error: 'Sala no encontrada' })
      return
    }

    // Allow re-joining own room (e.g. page refresh)
    const alreadyIn = existing.players.find(p => p.socketId === socket.id)
    if (alreadyIn) {
      socket.join(roomId)
      ack({
        ok: true,
        roomId,
        playerSlot: alreadyIn.slot,
        reconnectToken: existing.reconnectTokens[alreadyIn.slot],
        roomState: RoomManager.toSnapshot(existing),
      })
      emitCurrentGame(socket, existing)
      scheduleTurnTimer(io, roomId)
      return
    }

    const currentRoom = await RoomManager.getRoomBySocket(socket.id)
    if (RoomManager.getSpectatorRoom(socket.id)) {
      ack({ ok: false, error: 'Ya estás viendo una sala' })
      return
    }
    if (TournamentManager.getTournamentIdBySocket(socket.id)) {
      ack({ ok: false, error: 'Ya estás en un torneo' })
      return
    }
    if (currentRoom && currentRoom.roomId !== roomId) {
      ack({ ok: false, error: 'Ya estás en otra sala' })
      return
    }

    const result = await RoomManager.withRoomLock(roomId, () =>
      RoomManager.joinRoom(roomId, username.trim(), socket.id, password)
    )
    if (!result.ok) {
      ack({ ok: false, error: result.error })
      return
    }

    const room = result.room
    socket.leave('lobby')
    socket.join(roomId)
    const newSlot = room.players.find(p => p.socketId === socket.id)?.slot ?? 1
    ack({
      ok: true,
      roomId,
      playerSlot: newSlot,
      reconnectToken: room.reconnectTokens[newSlot],
      roomState: RoomManager.toSnapshot(room),
    })

    await emitRoomEvent(io, roomId, 'player:joined', { username: username.trim(), slot: newSlot }, socket.id)
    await emitRoomEvent(io, roomId, 'room:state', RoomManager.toSnapshot(room))
    if (room.game?.currentPlayer === newSlot) {
      await emitRoomEvent(io, roomId, 'game:clock', { turnStartedAt: room.game.turnStartedAt })
    }
    emitCurrentGame(socket, room)
    scheduleTurnTimer(io, roomId)
    await broadcastRoomList(io)
  })

  // ── room:set-color ───────────────────────────────────────────
  socket.on('room:set-color', async (payload, ack) => {
    if (!isRecord(payload) || typeof payload.roomId !== 'string' ||
        !isPlayerColorId(payload.color)) {
      ack({ ok: false, error: 'Color inválido' })
      return
    }

    const roomId = payload.roomId.trim().toUpperCase()
    const outcome = await RoomManager.withRoomLock(roomId, async () => {
      const slot = await RoomManager.getSlotBySocket(socket.id, roomId)
      if (!slot) return { ok: false as const, error: 'No perteneces a esta sala' }
      return RoomManager.setPlayerColor(roomId, slot, payload.color)
    })

    if (!outcome.ok) {
      ack({ ok: false, error: outcome.error })
      return
    }

    ack({ ok: true })
    await emitRoomEvent(io, roomId, 'room:state', RoomManager.toSnapshot(outcome.room))
  })

  // ── tournament:create ────────────────────────────────────────
  socket.on('tournament:create', async (payload, ack) => {
    if (!isRecord(payload)) {
      ack({ ok: false, error: 'Datos inválidos' })
      return
    }
    const username = typeof payload.username === 'string' ? payload.username.trim() : ''
    const name = typeof payload.name === 'string' ? payload.name.trim() : ''
    if (!username) {
      ack({ ok: false, error: 'Nombre requerido' })
      return
    }
    if (await RoomManager.getRoomBySocket(socket.id) ||
        TournamentManager.getTournamentIdBySocket(socket.id) ||
        RoomManager.getSpectatorRoom(socket.id)) {
      ack({ ok: false, error: 'Ya estás en una sala o torneo' })
      return
    }

    const { tournament, participant } = await TournamentManager.createTournament(
      username,
      socket.id,
      name,
    )
    socket.leave('lobby')
    socket.join(tournamentChannel(tournament.tournamentId))
    ack({
      ok: true,
      tournamentId: tournament.tournamentId,
      participantId: participant.id,
      reconnectToken: participant.reconnectToken,
      state: TournamentManager.snapshot(tournament),
    })
  })

  // ── tournament:join ──────────────────────────────────────────
  socket.on('tournament:join', async (payload, ack) => {
    if (!isRecord(payload) || typeof payload.tournamentId !== 'string') {
      ack({ ok: false, error: 'Datos inválidos' })
      return
    }
    const tournamentId = payload.tournamentId.trim().toUpperCase()
    const username = typeof payload.username === 'string' ? payload.username.trim() : ''
    if (!tournamentId || !username) {
      ack({ ok: false, error: 'Código y nombre requeridos' })
      return
    }
    if (RoomManager.getSpectatorRoom(socket.id) ||
        await RoomManager.getRoomBySocket(socket.id) ||
        TournamentManager.getTournamentIdBySocket(socket.id)) {
      ack({ ok: false, error: 'Ya estás en una sala o torneo' })
      return
    }

    const result = await TournamentManager.joinTournament(tournamentId, username, socket.id)
    if (!result.ok) {
      ack({ ok: false, error: result.error })
      return
    }
    TournamentManager.bindSocket(socket.id, tournamentId)
    socket.leave('lobby')
    socket.join(tournamentChannel(tournamentId))
    ack({
      ok: true,
      tournamentId,
      participantId: result.participant.id,
      reconnectToken: result.participant.reconnectToken,
      state: TournamentManager.snapshot(result.tournament),
    })
    await emitTournamentState(io, tournamentId)
  })

  // ── tournament:reconnect ─────────────────────────────────────
  socket.on('tournament:reconnect', async (payload, ack) => {
    if (!isRecord(payload) || typeof payload.tournamentId !== 'string' ||
        typeof payload.reconnectToken !== 'string') {
      ack({ ok: false, error: 'Datos de reconexión inválidos' })
      return
    }
    const tournamentId = payload.tournamentId.trim().toUpperCase()
    const result = await TournamentManager.reconnectTournament(
      tournamentId,
      payload.reconnectToken,
      socket.id,
    )
    if (!result.ok) {
      ack({ ok: false, error: result.error })
      return
    }
    if (result.previousSocketId) {
      io.in(result.previousSocketId).disconnectSockets(true)
    }
    socket.leave('lobby')
    socket.join(tournamentChannel(tournamentId))
    ack({
      ok: true,
      tournamentId,
      participantId: result.participant.id,
      reconnectToken: result.participant.reconnectToken,
      state: TournamentManager.snapshot(result.tournament),
      assignment: result.assignment,
    })
    await emitTournamentState(io, tournamentId)
  })

  // ── tournament:start ─────────────────────────────────────────
  socket.on('tournament:start', async (payload, ack) => {
    if (!isRecord(payload) || typeof payload.tournamentId !== 'string') {
      ack({ ok: false, error: 'Datos inválidos' })
      return
    }
    const tournamentId = payload.tournamentId.trim().toUpperCase()
    const result = await TournamentManager.startTournament(tournamentId, socket.id)
    if (!result.ok) {
      ack({ ok: false, error: result.error })
      return
    }
    ack({ ok: true })
    await emitTournamentState(io, tournamentId)
    await emitTournamentAssignments(io, result.assignments)
  })

  // ── tournament:next-stage ────────────────────────────────────
  socket.on('tournament:next-stage', async (payload, ack) => {
    if (!isRecord(payload) || typeof payload.tournamentId !== 'string') {
      ack({ ok: false, error: 'Datos inválidos' })
      return
    }
    const tournamentId = payload.tournamentId.trim().toUpperCase()
    const result = await TournamentManager.advanceTournament(tournamentId, socket.id)
    if (!result.ok) {
      ack({ ok: false, error: result.error })
      return
    }
    ack({ ok: true })
    await emitTournamentState(io, tournamentId)
    await emitTournamentAssignments(io, result.assignments)
  })

  // ── tournament:retry-group ───────────────────────────────────
  socket.on('tournament:retry-group', async (payload, ack) => {
    if (!isRecord(payload) || typeof payload.tournamentId !== 'string' ||
        typeof payload.groupId !== 'string') {
      ack({ ok: false, error: 'Datos inválidos' })
      return
    }
    const tournamentId = payload.tournamentId.trim().toUpperCase()
    const result = await TournamentManager.retryGroup(tournamentId, payload.groupId, socket.id)
    if (!result.ok) {
      ack({ ok: false, error: result.error })
      return
    }
    ack({ ok: true })
    await emitTournamentState(io, tournamentId)
    await emitTournamentAssignments(io, result.assignments)
  })

  // ── tournament:leave ─────────────────────────────────────────
  socket.on('tournament:leave', async (payload, ack) => {
    if (!isRecord(payload) || typeof payload.tournamentId !== 'string') {
      ack({ ok: false, error: 'Datos inválidos' })
      return
    }
    const tournamentId = payload.tournamentId.trim().toUpperCase()
    const state = await TournamentManager.leaveTournament(tournamentId, socket.id)
    socket.leave(tournamentChannel(tournamentId))
    ack({ ok: true })
    if (state) {
      await emitRoomEvent(io, tournamentChannel(tournamentId), 'tournament:state', state)
    }
  })

  // ── game:start ───────────────────────────────────────────────
  socket.on('game:start', async (payload, ack) => {
    if (!isRecord(payload) || typeof payload.roomId !== 'string') {
      ack({ ok: false, error: 'Datos de inicio inválidos' })
      return
    }
    const roomId = payload.roomId.trim().toUpperCase()
    const outcome = await RoomManager.withRoomLock(roomId, async () => {
      let room = await RoomManager.getRoom(roomId)
      if (!room) return { ok: false as const, error: 'Sala no encontrada' }
      if (room.phase !== 'waiting') return { ok: false as const, error: 'La sala no está esperando para iniciar' }

      const actingSlot = await RoomManager.getSlotBySocket(socket.id, roomId)
      const hostSlot = await RoomManager.getHostSlot(roomId)
      if (actingSlot !== hostSlot) return { ok: false as const, error: 'Solo el host puede iniciar la partida' }
      if (room.players.filter(player => player.socketId).length < 2) {
        return { ok: false as const, error: 'Se necesitan al menos dos jugadores conectados' }
      }

      await RoomManager.removeDisconnectedPlayers(roomId)
      room = await RoomManager.getRoom(roomId)
      if (!room) return { ok: false as const, error: 'Sala no encontrada' }
      const slots = room.players.map(player => player.slot)
      const settings = normalizeGameSettings(payload.settings, room.gameSettings ?? DEFAULT_GAME_SETTINGS)
      await RoomManager.setGameSettings(roomId, settings)
      await RoomManager.initScores(roomId, slots)
      const startingPlayer = await RoomManager.nextRound(roomId)
      if (!startingPlayer) return { ok: false as const, error: 'No se pudo elegir quién comienza' }
      const game = buildInitialGameState(slots, startingPlayer, settings)
      await RoomManager.setGame(roomId, game)
      const updatedRoom = await RoomManager.getRoom(roomId)
      return updatedRoom
        ? { ok: true as const, room: updatedRoom, game }
        : { ok: false as const, error: 'Sala no encontrada' }
    })

    if (!outcome.ok) {
      ack({ ok: false, error: outcome.error })
      return
    }
    const { room, game } = outcome
    ack({ ok: true })
    await emitRoomEvent(io, roomId, 'room:state', RoomManager.toSnapshot(room))
    await emitRoomEvent(io, roomId, 'game:state', toSnapshot(game))
    scheduleTurnTimer(io, roomId)
    await broadcastRoomList(io)
  })

  // ── game:move ────────────────────────────────────────────────
  socket.on('game:move', async (payload, ack) => {
    if (!isValidMovePayload(payload)) {
      ack({ ok: false, error: 'Movimiento inválido' })
      return
    }
    const normalizedPayload = { ...payload, roomId: payload.roomId.trim().toUpperCase() }
    const outcome = await RoomManager.withRoomLock(normalizedPayload.roomId, async () => {
      const room = await RoomManager.getRoom(normalizedPayload.roomId)
      if (!room?.game) return { ok: false as const, error: 'Sala o partida no encontrada' }

      const actingSlot = await RoomManager.getSlotBySocket(socket.id, normalizedPayload.roomId)
      if (!actingSlot) return { ok: false as const, error: 'No eres un jugador de esta sala' }

      if (room.game.settings.turnTimerEnabled &&
          Date.now() >= room.game.turnStartedAt + room.game.settings.turnDurationSeconds * 1_000) {
        const timedOutPlayer = room.game.currentPlayer
        const skippedGame = skipTurn(room.game)
        const finished = skippedGame.isDraw
        if (finished) {
          room.lastGame = skippedGame
          room.game = null
          room.phase = 'waiting'
        } else {
          room.game = skippedGame
        }
        await RoomManager.persistRoom(room)
        return {
          ok: false as const,
          kind: 'timeout' as const,
          error: 'Se agotó el tiempo; el turno pasó al siguiente jugador',
          timedOutPlayer,
          game: skippedGame,
          room,
          finished,
        }
      }

      const validation = validateMove(room.game, normalizedPayload, actingSlot)
      if (!validation.valid) return { ok: false as const, error: validation.reason }

      const game = applyMove(room.game, normalizedPayload)
      if (game.winResult) room.scores[game.winResult.winner] = (room.scores[game.winResult.winner] ?? 0) + 1
      room.game = game.winResult || game.isDraw ? null : game
      if (game.winResult || game.isDraw) {
        room.lastGame = game
        room.phase = 'waiting'
      }
      await RoomManager.persistRoom(room)
      return { ok: true as const, game, room, finished: Boolean(game.winResult || game.isDraw) }
    })

    if (!outcome.ok) {
      ack({ ok: false, error: outcome.error })
      if ('kind' in outcome && outcome.kind === 'timeout') {
        await emitRoomEvent(io, normalizedPayload.roomId, 'game:turn-timeout', { player: outcome.timedOutPlayer })
        await emitRoomEvent(io, normalizedPayload.roomId, 'game:state', toSnapshot(outcome.game))
        if (outcome.finished) {
          clearTurnTimer(normalizedPayload.roomId)
          await emitRoomEvent(io, normalizedPayload.roomId, 'room:state', RoomManager.toSnapshot(outcome.room))
          await emitRoomEvent(io, normalizedPayload.roomId, 'game:over', { winResult: null, finalState: toSnapshot(outcome.game) })
          await completeTournamentGroup(io, outcome.room, outcome.game)
          await broadcastRoomList(io)
        } else {
          scheduleTurnTimer(io, normalizedPayload.roomId)
        }
      }
      return
    }

    ack({ ok: true })
    await emitRoomEvent(io, normalizedPayload.roomId, 'game:state', toSnapshot(outcome.game))
    if (outcome.finished) {
      clearTurnTimer(normalizedPayload.roomId)
      await emitRoomEvent(io, normalizedPayload.roomId, 'room:state', RoomManager.toSnapshot(outcome.room))
      await emitRoomEvent(io, normalizedPayload.roomId, 'game:over', {
        winResult: outcome.game.winResult,
        finalState: toSnapshot(outcome.game),
      })
      await completeTournamentGroup(io, outcome.room, outcome.game)
      await broadcastRoomList(io)
    } else {
      scheduleTurnTimer(io, normalizedPayload.roomId)
    }
  })

  // ── game:rematch ─────────────────────────────────────────────
  socket.on('game:rematch', async (payload, ack) => {
    if (!isRecord(payload) || typeof payload.roomId !== 'string') {
      ack({ ok: false, error: 'Datos de reinicio inválidos' })
      return
    }
    const roomId = payload.roomId.trim().toUpperCase()
    const outcome = await RoomManager.withRoomLock(roomId, async () => {
      let room = await RoomManager.getRoom(roomId)
      if (room?.tournament) {
        return { ok: false as const, error: 'Las partidas de torneo se gestionan desde el torneo' }
      }
      if (!room || room.phase !== 'finished' || room.players.length < 2) {
        return { ok: false as const, error: 'La partida no está pausada o no hay jugadores suficientes' }
      }
      const actingSlot = await RoomManager.getSlotBySocket(socket.id, roomId)
      const hostSlot = await RoomManager.getHostSlot(roomId)
      if (actingSlot !== hostSlot) return { ok: false as const, error: 'Solo el host puede reiniciar la partida' }
      if (room.players.filter(player => player.socketId).length < 2) {
        return { ok: false as const, error: 'Se necesitan al menos dos jugadores conectados' }
      }
      await RoomManager.removeDisconnectedPlayers(roomId)
      room = await RoomManager.getRoom(roomId)
      if (!room) return { ok: false as const, error: 'Sala no encontrada' }

      const startingPlayer = await RoomManager.nextRound(roomId)
      if (!startingPlayer) return { ok: false as const, error: 'No se pudo elegir quién comienza' }
      const game = buildInitialGameState(room.players.map(player => player.slot), startingPlayer, room.gameSettings)
      await RoomManager.setGame(roomId, game)
      const updatedRoom = await RoomManager.getRoom(roomId)
      return updatedRoom
        ? { ok: true as const, room: updatedRoom, game }
        : { ok: false as const, error: 'Sala no encontrada' }
    })
    if (!outcome.ok) {
      ack({ ok: false, error: outcome.error })
      return
    }
    const { room, game } = outcome
    ack({ ok: true })
    await emitRoomEvent(io, roomId, 'room:state', RoomManager.toSnapshot(room))
    await emitRoomEvent(io, roomId, 'game:state', toSnapshot(game))
    scheduleTurnTimer(io, roomId)
    await broadcastRoomList(io)
  })

  // Host may end a paused multiplayer game and return everyone to the lobby.
  socket.on('game:finish', async (payload, ack) => {
    if (!isRecord(payload) || typeof payload.roomId !== 'string') {
      ack({ ok: false, error: 'Datos inválidos' })
      return
    }
    const roomId = payload.roomId.trim().toUpperCase()
    const waitingRoom = await RoomManager.withRoomLock(roomId, async () => {
      const room = await RoomManager.getRoom(roomId)
      if (room?.tournament) return { error: 'Las partidas de torneo se gestionan desde el torneo' }
      if (!room?.game || room.phase !== 'playing') return { error: 'No hay una partida activa para finalizar' }
      const actingSlot = await RoomManager.getSlotBySocket(socket.id, roomId)
      const hostSlot = await RoomManager.getHostSlot(roomId)
      if (actingSlot !== hostSlot) return { error: 'Solo el host puede finalizar la partida' }
      if (!room.players.some(player => !player.socketId)) return { error: 'No hay jugadores desconectados' }
      return { room: await RoomManager.finishGameForHost(roomId) }
    })
    if ('error' in waitingRoom) {
      ack({ ok: false, error: waitingRoom.error })
      return
    }
    clearTurnTimer(roomId)
    if (!waitingRoom.room) {
      ack({ ok: false, error: 'No se pudo recuperar la sala' })
      return
    }
    ack({ ok: true })
    await emitRoomEvent(io, roomId, 'room:state', RoomManager.toSnapshot(waitingRoom.room))
    await emitRoomEvent(io, roomId, 'game:aborted', { reason: 'host-ended-game' })
    await broadcastRoomList(io)
  })

  // ── disconnect ───────────────────────────────────────────────
  socket.on('disconnect', async () => {
    RoomManager.removeSpectator(socket.id)
    const tournamentState = await TournamentManager.disconnectSocket(socket.id)
    if (tournamentState) {
      await emitRoomEvent(
        io,
        tournamentChannel(tournamentState.tournamentId),
        'tournament:state',
        tournamentState,
      )
    }

    const socketRoom = await RoomManager.getRoomBySocket(socket.id)
    if (!socketRoom) return

    const result = await RoomManager.withRoomLock(socketRoom.roomId, async () => {
      const disconnected = await RoomManager.removePlayer(socket.id)
      if (!disconnected?.room.game) return disconnected
      return disconnected
    })
    if (!result) return

    const { room, slot, player, graceMs, disconnectEpoch } = result

    if (room.game) {
      await emitRoomEvent(io, room.roomId, 'player:left', {
        username: player.username,
        slot,
        permanent: false,
      }, socket.id)
    }

    await emitRoomEvent(io, room.roomId, 'room:state', RoomManager.toSnapshot(room))
    await broadcastRoomList(io)

    setTimeout(() => {
      void RoomManager.withRoomLock(room.roomId, () =>
        RoomManager.expireDisconnectedPlayer(room.roomId, slot, disconnectEpoch)
      ).then(async updatedRoom => {
        if (!updatedRoom) clearTurnTimer(room.roomId)
        const currentRoom = await RoomManager.getRoom(room.roomId)
        if (currentRoom) await emitRoomEvent(io, currentRoom.roomId, 'room:state', RoomManager.toSnapshot(currentRoom))
        return broadcastRoomList(io)
      }).catch(error => console.error('[room:disconnect-expiry]', error))
    }, graceMs)
  })
}
