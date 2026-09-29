import type { Board, Piece, Size, WinResult } from '@/types/game'

export type PlayerSlot = 1 | 2 | 3 | 4

// ── Client → Server ──────────────────────────────────────────────

export interface RoomCreateAck {
  ok: boolean
  roomId?: string
  playerSlot?: PlayerSlot
  error?: string
}

export interface RoomJoinAck {
  ok: boolean
  roomId?: string
  playerSlot?: PlayerSlot
  roomState?: RoomStateSnapshot
  error?: string
}

export interface SpectateJoinAck {
  ok: boolean
  roomId?: string
  roomState?: RoomStateSnapshot
  error?: string
}

export interface GameMovePayload {
  roomId:     string
  pieceId:    string
  targetRow:  number
  targetCol:  number
  targetSize: Size
}

export interface GameMoveAck { ok: boolean; error?: string }

export interface ClientToServerEvents {
  'room:create': (payload: { username: string; name: string; isPrivate: boolean; password?: string }, ack: (res: RoomCreateAck) => void) => void
  'room:join':   (payload: { roomId: string; username: string; password?: string }, ack: (res: RoomJoinAck) => void) => void
  'spectate:join': (payload: { roomId: string }, ack: (res: SpectateJoinAck) => void) => void
  'game:move':   (payload: GameMovePayload, ack: (res: GameMoveAck) => void) => void
  'game:rematch':(payload: { roomId: string }) => void
  'game:start':  (payload: { roomId: string }) => void
  'rooms:get':   (ack: (rooms: PublicRoomInfo[]) => void) => void
}

// ── Server → Client ──────────────────────────────────────────────

export interface PlayerInfo {
  slot:     PlayerSlot
  username: string
  socketId: string
}

export interface RoomStateSnapshot {
  roomId:      string
  name:        string
  isPrivate:   boolean
  players:     PlayerInfo[]
  phase:       'waiting' | 'playing' | 'finished'
  playerCount: number
  scores:      Record<number, number>
  roundNumber: number
}

export interface PublicRoomInfo {
  roomId:      string
  name:        string
  playerCount: number
  phase:       'waiting' | 'playing'
}

export interface GameStateSnapshot {
  board:         Board
  inventories:   Record<PlayerSlot, Piece[]>
  currentPlayer: PlayerSlot
  moveNumber:    number
  players:       PlayerSlot[]
}

export interface GameOverPayload {
  winResult:  WinResult | null
  finalState: GameStateSnapshot
}

export interface ServerToClientEvents {
  'room:state':    (state: RoomStateSnapshot)       => void
  'game:state':    (state: GameStateSnapshot)       => void
  'game:over':     (result: GameOverPayload)        => void
  'rooms:list':    (rooms: PublicRoomInfo[])        => void
  'player:joined': (payload: { username: string; slot: PlayerSlot }) => void
  'player:left':   (payload: { username: string; slot: PlayerSlot; permanent: boolean }) => void
  'error':         (payload: { code: string; message: string }) => void
}
