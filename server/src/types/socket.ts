import type {
  Board,
  GameSettings,
  LastMove,
  Piece,
  PlayerColorId,
  Size,
  WinResult,
  PlayerSlot,
} from './game.js'

// ── Client → Server ──────────────────────────────────────────────

export interface RoomCreatePayload {
  username:  string
  name:      string
  isPrivate: boolean
  password?: string
}
export interface RoomCreateAck {
  ok: boolean
  roomId?: string
  playerSlot?: PlayerSlot
  reconnectToken?: string
  error?: string
}

export interface RoomJoinPayload {
  roomId:    string
  username:  string
  password?: string
}
export interface RoomJoinAck {
  ok: boolean
  roomId?: string
  playerSlot?: PlayerSlot
  reconnectToken?: string
  roomState?: RoomStateSnapshot
  error?: string
}

export interface RoomReconnectAck {
  ok: boolean
  roomId?: string
  playerSlot?: PlayerSlot
  reconnectToken?: string
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
export interface GameControlAck { ok: boolean; error?: string }

export interface RoomSetColorPayload {
  roomId: string
  color: PlayerColorId
}

export interface RematchPayload  { roomId: string }
export interface GameStartPayload { roomId: string; settings?: GameSettings }

export interface ClientToServerEvents {
  'room:create': (payload: RoomCreatePayload, ack: (res: RoomCreateAck) => void) => void
  'room:join':   (payload: RoomJoinPayload,   ack: (res: RoomJoinAck)   => void) => void
  'room:reconnect': (payload: { roomId: string; reconnectToken: string }, ack: (res: RoomReconnectAck) => void) => void
  'room:set-color': (payload: RoomSetColorPayload, ack: (res: GameControlAck) => void) => void
  'spectate:join': (payload: { roomId: string }, ack: (res: SpectateJoinAck) => void) => void
  'game:move':   (payload: GameMovePayload,   ack: (res: GameMoveAck)   => void) => void
  'game:rematch':(payload: RematchPayload, ack: (res: GameControlAck) => void) => void
  'game:start':  (payload: GameStartPayload, ack: (res: GameControlAck) => void) => void
  'game:finish': (payload: GameStartPayload, ack: (res: GameControlAck) => void) => void
  'rooms:get':   (ack: (rooms: PublicRoomInfo[]) => void) => void
}

// ── Server → Client ──────────────────────────────────────────────

export interface PlayerInfo {
  slot:     PlayerSlot
  username: string
  socketId: string
  color?:   PlayerColorId
}

export interface PublicPlayerInfo {
  slot:      PlayerSlot
  username:  string
  connected: boolean
  color:     PlayerColorId
}

export interface RoomStateSnapshot {
  roomId:      string
  name:        string
  isPrivate:   boolean
  players:     PublicPlayerInfo[]
  phase:       'waiting' | 'playing' | 'finished'
  playerCount: number
  scores:      Record<number, number>
  roundNumber: number
  hostSlot: PlayerSlot
  gameSettings: GameSettings
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
  turnNumber:    number
  turnStartedAt: number
  players:       PlayerSlot[]
  lastMove:      LastMove | null
}

export interface GameOverPayload {
  winResult:  WinResult | null
  finalState: GameStateSnapshot
}

export interface ServerToClientEvents {
  'room:state':    (state: RoomStateSnapshot)       => void
  'game:state':    (state: GameStateSnapshot)       => void
  'game:over':     (result: GameOverPayload)        => void
  'game:turn-timeout': (payload: { player: PlayerSlot }) => void
  'game:clock': (payload: { turnStartedAt: number }) => void
  'game:aborted': (payload: { reason: string }) => void
  'rooms:list':    (rooms: PublicRoomInfo[])        => void
  'player:joined': (payload: { username: string; slot: PlayerSlot }) => void
  'player:left':   (payload: { username: string; slot: PlayerSlot; permanent: boolean }) => void
  'error':         (payload: { code: string; message: string }) => void
}
