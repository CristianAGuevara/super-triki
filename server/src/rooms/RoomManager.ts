import type { GameSettings, PlayerColorId, PlayerSlot } from '../types/game.js'
import type { PlayerInfo, PublicRoomInfo, RoomStateSnapshot } from '../types/socket.js'
import type { RoomGameState } from '../engine/GameEngine.js'
import {
  DEFAULT_GAME_SETTINGS,
  DEFAULT_PLAYER_COLOR_IDS,
  PLAYER_COLOR_IDS,
  isPlayerColorId,
} from '../types/game.js'
import { generateRoomCode } from './roomUtils.js'
import { randomUUID } from 'node:crypto'
import { redisPrefix, roomIndexKey, roomRedis as redis } from '../redis.js'

const ROOM_TTL_SECONDS = 20 * 60
const ROOM_INDEX_KEY = roomIndexKey
const ROOM_LOCK_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`

export interface TournamentRoomMeta {
  id: string
  name: string
  stage: number
  groupId: string
  groupLabel: string
  participantIds: Partial<Record<PlayerSlot, string>>
}

export interface RoomState {
  roomId:      string
  name:        string
  isPrivate:   boolean
  password?:   string
  players:     PlayerInfo[]
  reconnectTokens: Partial<Record<PlayerSlot, string>>
  phase:       'waiting' | 'playing' | 'finished'
  gameSettings: GameSettings
  game:        RoomGameState | null
  lastGame:    RoomGameState | null
  createdAt:   number
  scores:      Record<number, number>
  roundNumber: number
  hostSlot:    PlayerSlot
  lastRoundPlayers: PlayerSlot[] | null
  lastStartingPlayer: PlayerSlot | null
  disconnectEpoch: Partial<Record<PlayerSlot, number>>
  disconnectUntil: Partial<Record<PlayerSlot, number>>
  tournament?: TournamentRoomMeta
}

const rooms = new Map<string, RoomState>()
const socketToRoom = new Map<string, string>()
const socketToSpectatorRoom = new Map<string, string>()
const PLAYER_RECONNECT_GRACE_MS = 90_000
const HOST_RECONNECT_GRACE_MS = 900_000

function resolvePlayerColor(player: PlayerInfo): PlayerColorId {
  return isPlayerColorId(player.color)
    ? player.color
    : DEFAULT_PLAYER_COLOR_IDS[player.slot]
}

function pickAvailablePlayerColor(room: RoomState, slot: PlayerSlot): PlayerColorId {
  const used = new Set(
    room.players
      .filter(player => player.slot !== slot)
      .map(resolvePlayerColor),
  )
  const preferred = DEFAULT_PLAYER_COLOR_IDS[slot]
  if (!used.has(preferred)) return preferred
  return PLAYER_COLOR_IDS.find(color => !used.has(color)) ?? preferred
}

function roomKey(roomId: string) {
  return `${redisPrefix}:room:${roomId}`
}

async function loadRoom(roomId: string): Promise<RoomState | undefined> {
  if (!redis) return rooms.get(roomId)

  try {
    const room = await redis.get<RoomState>(roomKey(roomId))
    if (room) {
      if (pruneExpiredDisconnects(room)) await saveRoom(room)
      else rooms.set(roomId, room)
    } else {
      rooms.delete(roomId)
    }
    return room ?? undefined
  } catch (error) {
    // Keep the service usable if Upstash is temporarily unreachable. The local
    // cache still serves rooms attached to this instance.
    console.error('[redis:load-room]', error)
    return rooms.get(roomId)
  }
}

function pruneExpiredDisconnects(room: RoomState, now = Date.now()): boolean {
  let changed = false
  for (const player of [...room.players]) {
    if (player.socketId) continue
    const deadline = room.disconnectUntil[player.slot]
    if (!deadline || deadline > now) continue

    delete room.reconnectTokens[player.slot]
    delete room.disconnectUntil[player.slot]
    room.disconnectEpoch[player.slot] = (room.disconnectEpoch[player.slot] ?? 0) + 1
    changed = true

    if (room.game) {
      if (room.hostSlot === player.slot) {
        room.hostSlot = room.players.find(candidate => candidate.socketId)?.slot ?? room.hostSlot
      }
      continue
    }

    room.players = room.players.filter(candidate => candidate.slot !== player.slot)
    if (room.hostSlot === player.slot) {
      room.hostSlot = room.players.find(candidate => candidate.socketId)?.slot ?? room.players[0]?.slot ?? 1
    }
  }
  return changed
}

async function saveRoom(room: RoomState): Promise<void> {
  rooms.set(room.roomId, room)
  if (!redis) return

  try {
    await redis.set(roomKey(room.roomId), room, { ex: ROOM_TTL_SECONDS })
    await redis.sadd(ROOM_INDEX_KEY, room.roomId)
    await redis.expire(ROOM_INDEX_KEY, ROOM_TTL_SECONDS * 2)
  } catch (error) {
    console.error('[redis:save-room]', error)
  }
}

async function deleteRoom(roomId: string): Promise<void> {
  rooms.delete(roomId)
  if (!redis) return

  try {
    await redis.del(roomKey(roomId))
    await redis.srem(ROOM_INDEX_KEY, roomId)
  } catch (error) {
    console.error('[redis:delete-room]', error)
  }
}

export const RoomManager = {
  async persistRoom(room: RoomState): Promise<void> {
    await saveRoom(room)
  },

  async withRoomLock<T>(roomId: string, callback: () => Promise<T> | T): Promise<T> {
    if (!redis) return callback()

    const lockKey = `${redisPrefix}:lock:${roomId}`
    const owner = randomUUID()
    const deadline = Date.now() + 8_000
    let acquired = false

    try {
      while (!acquired && Date.now() < deadline) {
        acquired = (await redis.set(lockKey, owner, { nx: true, ex: 15 })) === 'OK'
        if (!acquired) await new Promise(resolve => setTimeout(resolve, 40))
      }
    } catch (error) {
      console.error('[redis:lock]', error)
      return callback()
    }

    if (!acquired) {
      console.error(`[redis:lock] Could not acquire lock for ${roomId}; continuing without it`)
      return callback()
    }

    try {
      return await callback()
    } finally {
      try {
        await redis.eval(ROOM_LOCK_SCRIPT, [lockKey], [owner])
      } catch (error) {
        console.error('[redis:unlock]', error)
      }
    }
  },

  async createRoom(
    username: string,
    socketId: string,
    name: string,
    isPrivate: boolean,
    password?: string,
  ): Promise<RoomState> {
    let roomId: string
    do { roomId = generateRoomCode() } while (await loadRoom(roomId))

    const room: RoomState = {
      roomId,
      name:        name.trim() || `Sala de ${username}`,
      isPrivate,
      password:    isPrivate ? password : undefined,
      players:     [{
        slot: 1,
        username,
        socketId,
        color: DEFAULT_PLAYER_COLOR_IDS[1],
      }],
      reconnectTokens: { 1: randomUUID() },
      phase:       'waiting',
      gameSettings: { ...DEFAULT_GAME_SETTINGS },
      game:        null,
      lastGame:    null,
      createdAt:   Date.now(),
      scores:      {},
      roundNumber: 0,
      hostSlot:    1,
      lastRoundPlayers: null,
      lastStartingPlayer: null,
      disconnectEpoch: {},
      disconnectUntil: {},
    }
    await saveRoom(room)
    socketToRoom.set(socketId, roomId)
    return room
  },

  async createTournamentRoom(params: {
    name: string
    tournament: {
      id: string
      name: string
      stage: number
      groupId: string
      groupLabel: string
    }
    players: Array<{
      participantId: string
      username: string
      socketId: string
    }>
  }): Promise<RoomState> {
    let roomId: string
    do { roomId = generateRoomCode() } while (await loadRoom(roomId))

    const reconnectTokens: Partial<Record<PlayerSlot, string>> = {}
    const participantIds: Partial<Record<PlayerSlot, string>> = {}
    const players: PlayerInfo[] = params.players.slice(0, 4).map((player, index) => {
      const slot = (index + 1) as PlayerSlot
      reconnectTokens[slot] = randomUUID()
      participantIds[slot] = player.participantId
      return {
        slot,
        username: player.username,
        socketId: player.socketId,
        color: DEFAULT_PLAYER_COLOR_IDS[slot],
      }
    })

    const room: RoomState = {
      roomId,
      name: params.name,
      isPrivate: true,
      players,
      reconnectTokens,
      phase: 'waiting',
      gameSettings: { ...DEFAULT_GAME_SETTINGS },
      game: null,
      lastGame: null,
      createdAt: Date.now(),
      scores: {},
      roundNumber: 0,
      hostSlot: 1,
      lastRoundPlayers: null,
      lastStartingPlayer: null,
      disconnectEpoch: {},
      disconnectUntil: {},
      tournament: {
        ...params.tournament,
        participantIds,
      },
    }

    for (const player of players) {
      if (player.socketId) socketToRoom.set(player.socketId, roomId)
    }
    await saveRoom(room)
    return room
  },

  async joinRoom(
    roomId: string,
    username: string,
    socketId: string,
    password?: string,
  ): Promise<{ ok: true; room: RoomState } | { ok: false; error: string }> {
    const room = await loadRoom(roomId)
    if (!room)                         return { ok: false, error: 'Sala no encontrada' }
    if (room.isPrivate && room.password && room.password !== password)
                                        return { ok: false, error: 'Contraseña incorrecta' }

    // A refresh creates a new socket id. Keep a disconnected player briefly so
    // they can reclaim their slot instead of permanently ending the room.
    const disconnectedPlayer = room.players.find(p =>
      !p.socketId && (room.disconnectUntil[p.slot] ?? 0) > Date.now() &&
      p.username.toLowerCase() === username.toLowerCase()
    )
    if (disconnectedPlayer) {
      if ((room.disconnectUntil[disconnectedPlayer.slot] ?? 0) <= Date.now()) {
        return { ok: false, error: 'El tiempo para recuperar esta plaza terminó' }
      }
      room.disconnectEpoch[disconnectedPlayer.slot] = (room.disconnectEpoch[disconnectedPlayer.slot] ?? 0) + 1
      delete room.disconnectUntil[disconnectedPlayer.slot]
      if (!isPlayerColorId(disconnectedPlayer.color)) {
        disconnectedPlayer.color = pickAvailablePlayerColor(room, disconnectedPlayer.slot)
      }
      disconnectedPlayer.socketId = socketId
      socketToRoom.set(socketId, roomId)
      if (room.game && !room.game.winResult && !room.game.isDraw) {
        room.phase = 'playing'
      }
      await saveRoom(room)
      return { ok: true, room }
    }

    if (room.phase !== 'waiting')
      return { ok: false, error: room.phase === 'finished' ? 'La sala ha terminado' : 'La partida ya comenzó' }
    if (room.players.length >= 4)      return { ok: false, error: 'Sala llena' }

    const usedSlots = new Set(room.players.map(player => player.slot))
    const slot = ([1, 2, 3, 4] as PlayerSlot[]).find(candidate => !usedSlots.has(candidate))
    if (!slot) return { ok: false, error: 'Sala llena' }
    room.players.push({
      slot,
      username,
      socketId,
      color: pickAvailablePlayerColor(room, slot),
    })
    room.reconnectTokens[slot] = randomUUID()
    room.disconnectEpoch[slot] = (room.disconnectEpoch[slot] ?? 0) + 1
    if (room.players.length === 1) room.hostSlot = slot
    socketToRoom.set(socketId, roomId)
    await saveRoom(room)
    return { ok: true, room }
  },

  async reconnectRoom(
    roomId: string,
    reconnectToken: string,
    socketId: string,
  ): Promise<{ ok: true; room: RoomState; slot: PlayerSlot; previousSocketId?: string } | { ok: false; error: string }> {
    const room = await loadRoom(roomId)
    if (!room) return { ok: false, error: 'Sala no encontrada' }

    const entry = Object.entries(room.reconnectTokens).find(([, token]) => token === reconnectToken)
    if (!entry) return { ok: false, error: 'La sesión ya no es válida; vuelve a unirte a la sala' }

    const slot = Number(entry[0]) as PlayerSlot
    const player = room.players.find(candidate => candidate.slot === slot)
    if (!player) return { ok: false, error: 'El jugador ya no pertenece a esta sala' }
    if (player.socketId === '' && (room.disconnectUntil[slot] ?? 0) <= Date.now()) {
      delete room.reconnectTokens[slot]
      await saveRoom(room)
      return { ok: false, error: 'El tiempo para recuperar esta plaza terminó' }
    }

    const previousSocketId = player.socketId && player.socketId !== socketId
      ? player.socketId
      : undefined
    if (previousSocketId) socketToRoom.delete(previousSocketId)

    room.disconnectEpoch[slot] = (room.disconnectEpoch[slot] ?? 0) + 1
    delete room.disconnectUntil[slot]
    if (!isPlayerColorId(player.color)) {
      player.color = pickAvailablePlayerColor(room, slot)
    }
    player.socketId = socketId
    socketToRoom.set(socketId, roomId)
    if (room.game && !room.game.winResult && !room.game.isDraw) room.phase = 'playing'

    await saveRoom(room)

    return { ok: true, room, slot, previousSocketId }
  },

  getRoom(roomId: string): Promise<RoomState | undefined> {
    return loadRoom(roomId)
  },

  async getRoomBySocket(socketId: string): Promise<RoomState | undefined> {
    const roomId = socketToRoom.get(socketId)
    return roomId ? loadRoom(roomId) : undefined
  },

  async getSlotBySocket(socketId: string, roomId?: string): Promise<PlayerSlot | null> {
    const room = await this.getRoomBySocket(socketId)
    if (!room) return null
    if (roomId && room.roomId !== roomId) return null
    return room.players.find(p => p.socketId === socketId)?.slot ?? null
  },

  async getHostSlot(roomId: string): Promise<PlayerSlot | null> {
    return (await loadRoom(roomId))?.hostSlot ?? null
  },

  async detachSocket(socketId: string): Promise<RoomState | null> {
    const roomId = socketToRoom.get(socketId)
    if (!roomId) return null
    socketToRoom.delete(socketId)

    const room = await loadRoom(roomId)
    if (!room) return null
    const player = room.players.find(candidate => candidate.socketId === socketId)
    if (!player) return room

    player.socketId = ''
    await saveRoom(room)
    return room
  },

  async removePlayer(socketId: string): Promise<{ room: RoomState; slot: PlayerSlot; player: PlayerInfo; graceMs: number; disconnectEpoch: number } | null> {
    const room = await this.getRoomBySocket(socketId)
    if (!room) return null

    const player = room.players.find(p => p.socketId === socketId)
    if (!player) return null

    const disconnectedPlayer = { ...player }
    const graceMs = this.getReconnectGraceMs(room, player.slot)
    const disconnectEpoch = (room.disconnectEpoch[player.slot] ?? 0) + 1
    room.disconnectEpoch[player.slot] = disconnectEpoch
    room.disconnectUntil[player.slot] = Date.now() + graceMs

    player.socketId = ''
    socketToRoom.delete(socketId)

    await saveRoom(room)
    return { room, slot: player.slot, player: disconnectedPlayer, graceMs, disconnectEpoch }
  },

  getReconnectGraceMs(room: RoomState, slot: PlayerSlot): number {
    if (room.hostSlot === slot) return HOST_RECONNECT_GRACE_MS
    if (!room.game || !room.game.settings.turnTimerEnabled) return PLAYER_RECONNECT_GRACE_MS

    const playerCount = room.game.players.length
    const targetIndex = room.game.players.indexOf(slot)
    const currentIndex = room.game.players.indexOf(room.game.currentPlayer)
    if (targetIndex < 0 || currentIndex < 0 || playerCount < 2) return PLAYER_RECONNECT_GRACE_MS

    const turnsUntilPlayerIsUp = (targetIndex - currentIndex + playerCount) % playerCount
    const turnDuration = room.game.settings.turnDurationSeconds * 1_000
    const timeUntilTheirTurn = turnsUntilPlayerIsUp * turnDuration
    return Math.max(PLAYER_RECONNECT_GRACE_MS, timeUntilTheirTurn + 30_000)
  },

  async expireDisconnectedPlayer(roomId: string, slot: PlayerSlot, disconnectEpoch: number): Promise<RoomState | null> {
    const room = await loadRoom(roomId)
    if (!room) return null
    const player = room.players.find(p => p.slot === slot)
    if (!player || player.socketId !== '' || room.disconnectEpoch[slot] !== disconnectEpoch) return null

    if (room.game) {
      delete room.reconnectTokens[slot]
      delete room.disconnectUntil[slot]
      room.disconnectEpoch[slot] = disconnectEpoch + 1
      if (room.hostSlot === slot) {
        room.hostSlot = room.players.find(candidate => candidate.socketId)?.slot ?? room.hostSlot
      }
      await saveRoom(room)
      return room
    }

    room.players = room.players.filter(p => p.slot !== slot)
    delete room.reconnectTokens[slot]
    delete room.disconnectEpoch[slot]
    delete room.disconnectUntil[slot]
    if (room.hostSlot === slot) {
      room.hostSlot = room.players.find(p => p.socketId)?.slot ?? room.players[0]?.slot ?? 1
    }
    if (room.players.length === 0 && !this.hasSpectators(roomId) && !redis) {
      await deleteRoom(roomId)
      return null
    }
    await saveRoom(room)
    return room
  },

  async removeDisconnectedPlayers(roomId: string): Promise<void> {
    const room = await loadRoom(roomId)
    if (!room) return
    for (const player of room.players) {
      if (!player.socketId) {
        room.disconnectEpoch[player.slot] = (room.disconnectEpoch[player.slot] ?? 0) + 1
        delete room.reconnectTokens[player.slot]
        delete room.disconnectUntil[player.slot]
      }
    }
    room.players = room.players.filter(player => player.socketId !== '')
    await saveRoom(room)
  },

  async finishGameForHost(roomId: string): Promise<RoomState | null> {
    await this.removeDisconnectedPlayers(roomId)
    const room = await loadRoom(roomId)
    if (!room) return null
    room.game = null
    room.lastGame = null
    room.phase = 'waiting'
    await saveRoom(room)
    return room
  },

  async setGameSettings(roomId: string, settings: GameSettings): Promise<void> {
    const room = await loadRoom(roomId)
    if (!room) return
    room.gameSettings = { ...settings }
    await saveRoom(room)
  },

  async setPlayerColor(
    roomId: string,
    slot: PlayerSlot,
    color: PlayerColorId,
  ): Promise<{ ok: true; room: RoomState } | { ok: false; error: string }> {
    const room = await loadRoom(roomId)
    if (!room) return { ok: false, error: 'Sala no encontrada' }
    if (room.phase !== 'waiting') {
      return { ok: false, error: 'Solo puedes cambiar tu color en la sala de espera' }
    }

    const player = room.players.find(candidate => candidate.slot === slot)
    if (!player) return { ok: false, error: 'No perteneces a esta sala' }

    const taken = room.players.some(candidate =>
      candidate.slot !== slot && resolvePlayerColor(candidate) === color
    )
    if (taken) return { ok: false, error: 'Ese color ya está ocupado' }

    player.color = color
    await saveRoom(room)
    return { ok: true, room }
  },

  async joinSpectator(roomId: string, socketId: string): Promise<RoomState | undefined> {
    const room = await loadRoom(roomId)
    if (!room) return undefined
    socketToSpectatorRoom.set(socketId, roomId)
    await saveRoom(room)
    return room
  },

  getSpectatorRoom(socketId: string): RoomState | undefined {
    const roomId = socketToSpectatorRoom.get(socketId)
    return roomId ? rooms.get(roomId) : undefined
  },

  removeSpectator(socketId: string): void {
    const roomId = socketToSpectatorRoom.get(socketId)
    socketToSpectatorRoom.delete(socketId)
    if (roomId && rooms.get(roomId)?.players.length === 0 && !this.hasSpectators(roomId)) {
      rooms.delete(roomId)
    }
  },

  hasSpectators(roomId: string): boolean {
    for (const spectatorRoomId of socketToSpectatorRoom.values()) {
      if (spectatorRoomId === roomId) return true
    }
    return false
  },

  async setGame(roomId: string, game: RoomGameState): Promise<void> {
    const room = await loadRoom(roomId)
    if (room) {
      room.game  = game
      room.gameSettings = { ...game.settings }
      room.phase = 'playing'
      await saveRoom(room)
    }
  },

  async initScores(roomId: string, slots: PlayerSlot[]): Promise<void> {
    const room = await loadRoom(roomId)
    if (!room) return
    slots.forEach(s => { if (room.scores[s] === undefined) room.scores[s] = 0 })
    await saveRoom(room)
  },

  async addScore(roomId: string, slot: PlayerSlot): Promise<void> {
    const room = await loadRoom(roomId)
    if (!room) return
    room.scores[slot] = (room.scores[slot] ?? 0) + 1
    await saveRoom(room)
  },

  async nextRound(roomId: string): Promise<PlayerSlot | null> {
    const room = await loadRoom(roomId)
    if (!room || room.players.length === 0) return null

    const slots = room.players.map(player => player.slot)
    const samePlayers = room.lastRoundPlayers !== null &&
      room.lastRoundPlayers.length === slots.length &&
      room.lastRoundPlayers.every(slot => slots.includes(slot))

    if (room.lastStartingPlayer !== null) room.roundNumber++

    const startingPlayer = samePlayers && room.lastStartingPlayer !== null
      ? slots[(slots.indexOf(room.lastStartingPlayer) + 1) % slots.length]
      : slots[Math.floor(Math.random() * slots.length)]

    room.lastRoundPlayers = slots
    room.lastStartingPlayer = startingPlayer
    await saveRoom(room)
    return startingPlayer
  },

  async getPublicRooms(): Promise<PublicRoomInfo[]> {
    if (redis) {
      try {
        const roomIds = await redis.smembers<string[]>(ROOM_INDEX_KEY)
        const loadedRooms = await Promise.all(roomIds.map(roomId => loadRoom(roomId)))
        const expired = roomIds.filter((_, index) => !loadedRooms[index])
        if (expired.length) await redis.srem(ROOM_INDEX_KEY, ...expired)

        return loadedRooms.flatMap(room =>
          room && room.players.some(player => player.socketId) &&
          !room.isPrivate && room.phase !== 'finished'
            ? [{
                roomId: room.roomId,
                name: room.name,
                playerCount: room.players.filter(player => player.socketId !== '').length,
                phase: room.phase as 'waiting' | 'playing',
              }]
            : [],
        )
      } catch (error) {
        console.error('[redis:public-rooms]', error)
      }
    }

    return Array.from(rooms.values())
      .filter(room =>
        room.players.some(player => player.socketId) &&
        !room.isPrivate && room.phase !== 'finished'
      )
      .map(room => ({
        roomId:      room.roomId,
        name:        room.name,
        playerCount: room.players.filter(player => player.socketId !== '').length,
        phase:       room.phase as 'waiting' | 'playing',
      }))
  },

  toSnapshot(room: RoomState): RoomStateSnapshot {
    return {
      roomId:      room.roomId,
      name:        room.name,
      isPrivate:   room.isPrivate,
      players:     room.players.map(player => ({
        slot: player.slot,
        username: player.username,
        connected: Boolean(player.socketId),
        color: resolvePlayerColor(player),
      })),
      phase:       room.phase,
      playerCount: room.players.length,
      scores:      room.scores,
      roundNumber: room.roundNumber,
      hostSlot:    room.hostSlot,
      gameSettings: room.gameSettings,
      tournament: room.tournament
        ? {
            id: room.tournament.id,
            name: room.tournament.name,
            stage: room.tournament.stage,
            groupId: room.tournament.groupId,
            groupLabel: room.tournament.groupLabel,
          }
        : undefined,
    }
  },
}
