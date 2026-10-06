import type { PlayerSlot } from '../types/game.js'
import type { PlayerInfo, PublicRoomInfo, RoomStateSnapshot } from '../types/socket.js'
import type { RoomGameState } from '../engine/GameEngine.js'
import { generateRoomCode } from './roomUtils.js'

export interface RoomState {
  roomId:      string
  name:        string
  isPrivate:   boolean
  password?:   string
  players:     PlayerInfo[]
  phase:       'waiting' | 'playing' | 'finished'
  game:        RoomGameState | null
  lastGame:    RoomGameState | null
  createdAt:   number
  scores:      Record<number, number>
  roundNumber: number
  hostSlot:    PlayerSlot
  lastRoundPlayers: PlayerSlot[] | null
  lastStartingPlayer: PlayerSlot | null
}

const rooms = new Map<string, RoomState>()
const socketToRoom = new Map<string, string>()
const socketToSpectatorRoom = new Map<string, string>()
const PLAYER_RECONNECT_GRACE_MS = 90_000
const HOST_RECONNECT_GRACE_MS = 180_000

export const RoomManager = {
  createRoom(
    username: string,
    socketId: string,
    name: string,
    isPrivate: boolean,
    password?: string,
  ): RoomState {
    let roomId: string
    do { roomId = generateRoomCode() } while (rooms.has(roomId))

    const room: RoomState = {
      roomId,
      name:        name.trim() || `Sala de ${username}`,
      isPrivate,
      password:    isPrivate ? password : undefined,
      players:     [{ slot: 1, username, socketId }],
      phase:       'waiting',
      game:        null,
      lastGame:    null,
      createdAt:   Date.now(),
      scores:      {},
      roundNumber: 0,
      hostSlot:    1,
      lastRoundPlayers: null,
      lastStartingPlayer: null,
    }
    rooms.set(roomId, room)
    socketToRoom.set(socketId, roomId)
    return room
  },

  joinRoom(
    roomId: string,
    username: string,
    socketId: string,
    password?: string,
  ): { ok: true; room: RoomState } | { ok: false; error: string } {
    const room = rooms.get(roomId)
    if (!room)                         return { ok: false, error: 'Sala no encontrada' }
    if (room.isPrivate && room.password && room.password !== password)
                                        return { ok: false, error: 'Contraseña incorrecta' }

    // A refresh creates a new socket id. Keep a disconnected player briefly so
    // they can reclaim their slot instead of permanently ending the room.
    const disconnectedPlayer = room.players.find(p =>
      !p.socketId && p.username.toLowerCase() === username.toLowerCase()
    )
    if (disconnectedPlayer) {
      disconnectedPlayer.socketId = socketId
      socketToRoom.set(socketId, roomId)
      if (room.game && !room.game.winResult && !room.game.isDraw) {
        room.phase = 'playing'
      }
      return { ok: true, room }
    }

    if (room.phase !== 'waiting')
      return { ok: false, error: room.phase === 'finished' ? 'La sala ha terminado' : 'La partida ya comenzó' }
    if (room.players.length >= 4)      return { ok: false, error: 'Sala llena' }

    const usedSlots = new Set(room.players.map(player => player.slot))
    const slot = ([1, 2, 3, 4] as PlayerSlot[]).find(candidate => !usedSlots.has(candidate))
    if (!slot) return { ok: false, error: 'Sala llena' }
    room.players.push({ slot, username, socketId })
    socketToRoom.set(socketId, roomId)
    return { ok: true, room }
  },

  getRoom(roomId: string): RoomState | undefined {
    return rooms.get(roomId)
  },

  getRoomBySocket(socketId: string): RoomState | undefined {
    const roomId = socketToRoom.get(socketId)
    return roomId ? rooms.get(roomId) : undefined
  },

  getSlotBySocket(socketId: string, roomId?: string): PlayerSlot | null {
    const room = this.getRoomBySocket(socketId)
    if (!room) return null
    if (roomId && room.roomId !== roomId) return null
    return room.players.find(p => p.socketId === socketId)?.slot ?? null
  },

  getHostSlot(roomId: string): PlayerSlot | null {
    return rooms.get(roomId)?.hostSlot ?? null
  },

  removePlayer(socketId: string): { room: RoomState; slot: PlayerSlot; player: PlayerInfo } | null {
    const room = this.getRoomBySocket(socketId)
    if (!room) return null

    const player = room.players.find(p => p.socketId === socketId)
    if (!player) return null

    const disconnectedPlayer = { ...player }

    if (!room.game && room.phase === 'waiting') {
      player.socketId = ''
      socketToRoom.delete(socketId)
      setTimeout(() => {
        const currentRoom = rooms.get(room.roomId)
        const currentPlayer = currentRoom?.players.find(p => p.slot === player.slot)
        if (!currentRoom || currentPlayer?.socketId !== '') return
        currentRoom.players = currentRoom.players.filter(p => p.slot !== player.slot)
        if (currentRoom.hostSlot === player.slot) {
          currentRoom.hostSlot = currentRoom.players[0]?.slot ?? 1
        }
        if (currentRoom.players.length === 0 && !this.hasSpectators(room.roomId)) {
          rooms.delete(room.roomId)
        }
      }, room.hostSlot === player.slot ? HOST_RECONNECT_GRACE_MS : PLAYER_RECONNECT_GRACE_MS)
      return { room, slot: player.slot, player: disconnectedPlayer }
    }

    player.socketId = ''
    socketToRoom.delete(socketId)

    room.phase = 'finished'
    setTimeout(() => {
      const currentRoom = rooms.get(room.roomId)
      const currentPlayer = currentRoom?.players.find(p => p.slot === player.slot)
      if (currentRoom && currentPlayer?.socketId === '') {
        currentRoom.players = currentRoom.players.filter(p => p.slot !== player.slot)
      }
      if (currentRoom?.players.length === 0 && !this.hasSpectators(room.roomId)) {
        rooms.delete(room.roomId)
      }
    }, room.hostSlot === player.slot ? HOST_RECONNECT_GRACE_MS : PLAYER_RECONNECT_GRACE_MS)

    return { room, slot: player.slot, player: disconnectedPlayer }
  },

  removeDisconnectedPlayers(roomId: string): void {
    const room = rooms.get(roomId)
    if (!room) return
    room.players = room.players.filter(player => player.socketId !== '')
  },

  joinSpectator(roomId: string, socketId: string): RoomState | undefined {
    const room = rooms.get(roomId)
    if (!room) return undefined
    socketToSpectatorRoom.set(socketId, roomId)
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

  setGame(roomId: string, game: RoomGameState): void {
    const room = rooms.get(roomId)
    if (room) {
      room.game  = game
      room.phase = 'playing'
    }
  },

  initScores(roomId: string, slots: PlayerSlot[]): void {
    const room = rooms.get(roomId)
    if (!room) return
    slots.forEach(s => { if (room.scores[s] === undefined) room.scores[s] = 0 })
  },

  addScore(roomId: string, slot: PlayerSlot): void {
    const room = rooms.get(roomId)
    if (!room) return
    room.scores[slot] = (room.scores[slot] ?? 0) + 1
  },

  nextRound(roomId: string): PlayerSlot | null {
    const room = rooms.get(roomId)
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
    return startingPlayer
  },

  getPublicRooms(): PublicRoomInfo[] {
    return Array.from(rooms.values())
      .filter(r => !r.isPrivate && r.phase !== 'finished')
      .map(r => ({
        roomId:      r.roomId,
        name:        r.name,
        playerCount: r.players.length,
        phase:       r.phase as 'waiting' | 'playing',
      }))
  },

  toSnapshot(room: RoomState): RoomStateSnapshot {
    return {
      roomId:      room.roomId,
      name:        room.name,
      isPrivate:   room.isPrivate,
      players:     room.players,
      phase:       room.phase,
      playerCount: room.players.length,
      scores:      room.scores,
      roundNumber: room.roundNumber,
      hostSlot:    room.hostSlot,
    }
  },
}
