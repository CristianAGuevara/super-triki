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
  createdAt:   number
  scores:      Record<number, number>
  roundNumber: number
}

const rooms = new Map<string, RoomState>()
const socketToRoom = new Map<string, string>()
const socketToSpectatorRoom = new Map<string, string>()
const RECONNECT_GRACE_MS = 60_000

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
      createdAt:   Date.now(),
      scores:      {},
      roundNumber: 0,
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

    const slot = (room.players.length + 1) as PlayerSlot
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

  removePlayer(socketId: string): { room: RoomState; slot: PlayerSlot; player: PlayerInfo } | null {
    const room = this.getRoomBySocket(socketId)
    if (!room) return null

    const player = room.players.find(p => p.socketId === socketId)
    if (!player) return null

    const disconnectedPlayer = { ...player }
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
    }, RECONNECT_GRACE_MS)

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
    room.roundNumber++
    return room.players[room.roundNumber % room.players.length].slot
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
    }
  },
}
