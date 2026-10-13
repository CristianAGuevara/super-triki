import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, GameMovePayload, ServerToClientEvents } from '../types/socket.js'
import type { PlayerSlot, Size } from '../types/game.js'
import { RoomManager } from '../rooms/RoomManager.js'
import {
  buildInitialGameState,
  validateMove,
  applyMove,
  toSnapshot,
} from '../engine/GameEngine.js'

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>

function broadcastRoomList(io: TypedServer) {
  io.to('lobby').emit('rooms:list', RoomManager.getPublicRooms())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSize(value: unknown): value is Size {
  return value === 'large' || value === 'medium' || value === 'small'
}

function isValidMovePayload(value: unknown): value is GameMovePayload {
  if (!isRecord(value)) return false
  return typeof value.roomId === 'string' && value.roomId.trim().length > 0 &&
    typeof value.pieceId === 'string' && value.pieceId.length > 0 &&
    Number.isInteger(value.targetRow) && Number.isInteger(value.targetCol) &&
    isSize(value.targetSize)
}

function emitCurrentGame(socket: TypedSocket, room: ReturnType<typeof RoomManager.getRoom>): void {
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
  socket.emit('rooms:list', RoomManager.getPublicRooms())

  // ── rooms:get ────────────────────────────────────────────────
  socket.on('rooms:get', ack => {
    ack(RoomManager.getPublicRooms())
  })

  // ── spectate:join ────────────────────────────────────────────
  socket.on('spectate:join', (payload, ack) => {
    if (!isRecord(payload) || typeof payload.roomId !== 'string') {
      ack({ ok: false, error: 'Datos inválidos' })
      return
    }

    const roomId = payload.roomId.trim().toUpperCase()
    const room = RoomManager.getRoom(roomId)
    if (!room) {
      ack({ ok: false, error: 'Sala no encontrada' })
      return
    }
    if (RoomManager.getRoomBySocket(socket.id)) {
      ack({ ok: false, error: 'Ya estás jugando en una sala' })
      return
    }

    const currentSpectatorRoom = RoomManager.getSpectatorRoom(socket.id)
    if (currentSpectatorRoom && currentSpectatorRoom.roomId !== roomId) {
      ack({ ok: false, error: 'Ya estás viendo otra sala' })
      return
    }

    RoomManager.joinSpectator(roomId, socket.id)
    socket.leave('lobby')
    socket.join(roomId)
    ack({ ok: true, roomId, roomState: RoomManager.toSnapshot(room) })
    emitCurrentGame(socket, room)
  })

  // ── room:create ──────────────────────────────────────────────
  socket.on('room:create', (payload, ack) => {
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
    if (RoomManager.getRoomBySocket(socket.id) || RoomManager.getSpectatorRoom(socket.id)) {
      ack({ ok: false, error: 'Ya estás en una sala' })
      return
    }
    const room = RoomManager.createRoom(username.trim(), socket.id, name, isPrivate, password)
    socket.leave('lobby')
    socket.join(room.roomId)
    ack({ ok: true, roomId: room.roomId, playerSlot: 1, reconnectToken: room.reconnectTokens[1] })
    socket.emit('room:state', RoomManager.toSnapshot(room))
    broadcastRoomList(io)
  })

  // ── room:reconnect ───────────────────────────────────────────
  socket.on('room:reconnect', (payload, ack) => {
    if (!isRecord(payload) || typeof payload.roomId !== 'string' ||
        typeof payload.reconnectToken !== 'string' || !payload.reconnectToken) {
      ack({ ok: false, error: 'Datos de reconexión inválidos' })
      return
    }

    const roomId = payload.roomId.trim().toUpperCase()
    const result = RoomManager.reconnectRoom(roomId, payload.reconnectToken, socket.id)
    if (!result.ok) {
      ack({ ok: false, error: result.error })
      return
    }

    if (result.previousSocketId) {
      io.sockets.sockets.get(result.previousSocketId)?.disconnect(true)
    }
    socket.leave('lobby')
    socket.join(roomId)
    ack({
      ok: true,
      roomId,
      playerSlot: result.slot,
      reconnectToken: result.room.reconnectTokens[result.slot],
      roomState: RoomManager.toSnapshot(result.room),
    })
    io.to(roomId).emit('room:state', RoomManager.toSnapshot(result.room))
    emitCurrentGame(socket, result.room)
    broadcastRoomList(io)
  })

  // ── room:join ────────────────────────────────────────────────
  socket.on('room:join', (payload, ack) => {
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

    const existing = RoomManager.getRoom(roomId)
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
      return
    }

    const currentRoom = RoomManager.getRoomBySocket(socket.id)
    if (RoomManager.getSpectatorRoom(socket.id)) {
      ack({ ok: false, error: 'Ya estás viendo una sala' })
      return
    }
    if (currentRoom && currentRoom.roomId !== roomId) {
      ack({ ok: false, error: 'Ya estás en otra sala' })
      return
    }

    const result = RoomManager.joinRoom(roomId, username.trim(), socket.id, password)
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

    socket.to(roomId).emit('player:joined', { username: username.trim(), slot: newSlot })
    io.to(roomId).emit('room:state', RoomManager.toSnapshot(room))
    emitCurrentGame(socket, room)
    broadcastRoomList(io)
  })

  // ── game:start ───────────────────────────────────────────────
  socket.on('game:start', (payload, ack) => {
    if (!isRecord(payload) || typeof payload.roomId !== 'string') {
      ack({ ok: false, error: 'Datos de inicio inválidos' })
      return
    }
    const roomId = payload.roomId.trim().toUpperCase()
    const room = RoomManager.getRoom(roomId)
    if (!room) {
      ack({ ok: false, error: 'Sala no encontrada' })
      return
    }
    if (room.phase !== 'waiting') {
      ack({ ok: false, error: 'La sala no está esperando para iniciar' })
      return
    }

    const actingSlot = RoomManager.getSlotBySocket(socket.id, roomId)
    if (actingSlot !== RoomManager.getHostSlot(roomId)) {
      ack({ ok: false, error: 'Solo el host puede iniciar la partida' })
      return
    }
    if (room.players.filter(player => player.socketId).length < 2) {
      ack({ ok: false, error: 'Se necesitan al menos dos jugadores conectados' })
      return
    }

    RoomManager.removeDisconnectedPlayers(roomId)

    const slots = room.players.map(p => p.slot)
    RoomManager.initScores(roomId, slots)
    const startingPlayer = RoomManager.nextRound(roomId)
    if (!startingPlayer) {
      ack({ ok: false, error: 'No se pudo elegir quién comienza' })
      return
    }
    const game = buildInitialGameState(slots, startingPlayer)
    RoomManager.setGame(roomId, game)
    ack({ ok: true })
    io.to(roomId).emit('room:state', RoomManager.toSnapshot(room))
    io.to(roomId).emit('game:state', toSnapshot(game))
    broadcastRoomList(io)
  })

  // ── game:move ────────────────────────────────────────────────
  socket.on('game:move', (payload, ack) => {
    if (!isValidMovePayload(payload)) {
      ack({ ok: false, error: 'Movimiento inválido' })
      return
    }
    const normalizedPayload = { ...payload, roomId: payload.roomId.trim().toUpperCase() }
    const room = RoomManager.getRoom(normalizedPayload.roomId)
    if (!room || !room.game) {
      ack({ ok: false, error: 'Sala o partida no encontrada' })
      return
    }

    const actingSlot = RoomManager.getSlotBySocket(socket.id, normalizedPayload.roomId)
    if (!actingSlot) {
      ack({ ok: false, error: 'No eres un jugador de esta sala' })
      return
    }

    const validation = validateMove(room.game, normalizedPayload, actingSlot)
    if (!validation.valid) {
      ack({ ok: false, error: validation.reason })
      return
    }

    const newState = applyMove(room.game, normalizedPayload)
    room.game = newState

    ack({ ok: true })
    io.to(normalizedPayload.roomId).emit('game:state', toSnapshot(newState))

    if (newState.winResult || newState.isDraw) {
      if (newState.winResult) {
        RoomManager.addScore(normalizedPayload.roomId, newState.winResult.winner as PlayerSlot)
      }
      room.lastGame = newState
      room.game = null
      room.phase = 'waiting'
      io.to(normalizedPayload.roomId).emit('room:state', RoomManager.toSnapshot(room))
      io.to(normalizedPayload.roomId).emit('game:over', {
        winResult:  newState.winResult,
        finalState: toSnapshot(newState),
      })
      broadcastRoomList(io)
    }
  })

  // ── game:rematch ─────────────────────────────────────────────
  socket.on('game:rematch', (payload, ack) => {
    if (!isRecord(payload) || typeof payload.roomId !== 'string') {
      ack({ ok: false, error: 'Datos de reinicio inválidos' })
      return
    }
    const roomId = payload.roomId.trim().toUpperCase()
    const room = RoomManager.getRoom(roomId)
    if (!room || room.phase !== 'finished' || room.players.length < 2) {
      ack({ ok: false, error: 'La partida no está pausada o no hay jugadores suficientes' })
      return
    }
    const actingSlot = RoomManager.getSlotBySocket(socket.id, roomId)
    if (actingSlot !== RoomManager.getHostSlot(roomId)) {
      ack({ ok: false, error: 'Solo el host puede reiniciar la partida' })
      return
    }
    const connectedPlayers = room.players.filter(player => player.socketId)
    if (connectedPlayers.length < 2) {
      ack({ ok: false, error: 'Se necesitan al menos dos jugadores conectados' })
      return
    }
    RoomManager.removeDisconnectedPlayers(roomId)

    const startingPlayer = RoomManager.nextRound(roomId)
    if (!startingPlayer) {
      ack({ ok: false, error: 'No se pudo elegir quién comienza' })
      return
    }
    const game = buildInitialGameState(room.players.map(player => player.slot), startingPlayer)
    RoomManager.setGame(roomId, game)
    ack({ ok: true })
    io.to(roomId).emit('room:state', RoomManager.toSnapshot(room))
    io.to(roomId).emit('game:state', toSnapshot(game))
    broadcastRoomList(io)
  })

  // ── disconnect ───────────────────────────────────────────────
  socket.on('disconnect', () => {
    RoomManager.removeSpectator(socket.id)
    const result = RoomManager.removePlayer(socket.id)
    if (!result) return

    const { room, slot, player, graceMs, disconnectEpoch } = result

    if (room.game) {
      socket.to(room.roomId).emit('player:left', {
        username: player.username,
        slot,
        permanent: false,
      })
    }

    io.to(room.roomId).emit('room:state', RoomManager.toSnapshot(room))
    broadcastRoomList(io)

    setTimeout(() => {
      const updatedRoom = RoomManager.expireDisconnectedPlayer(room.roomId, slot, disconnectEpoch)
      if (updatedRoom) io.to(updatedRoom.roomId).emit('room:state', RoomManager.toSnapshot(updatedRoom))
      broadcastRoomList(io)
    }, graceMs)
  })
}
