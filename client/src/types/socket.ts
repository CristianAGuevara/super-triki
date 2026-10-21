import type {
  Board,
  GameSettings,
  LastMove,
  Piece,
  PlayerColorId,
  Size,
  WinResult,
} from '@/types/game'
import type { TournamentSnapshot } from '@/types/tournament'

export type PlayerSlot = 1 | 2 | 3 | 4

// ── Client → Server ──────────────────────────────────────────────

export interface RoomCreateAck {
  ok: boolean
  roomId?: string
  playerSlot?: PlayerSlot
  reconnectToken?: string
  roomState?: RoomStateSnapshot
  error?: string
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

export interface TournamentCreateAck {
  ok: boolean
  tournamentId?: string
  participantId?: string
  reconnectToken?: string
  state?: TournamentSnapshot
  error?: string
}
export type TournamentJoinAck = TournamentCreateAck
export interface TournamentReconnectAck extends TournamentCreateAck {
  assignment?: TournamentRoomAssignment
}
export interface TournamentControlAck { ok: boolean; error?: string }

export interface TournamentRoomAssignment {
  tournamentId: string
  roomId: string
  playerSlot: PlayerSlot
  reconnectToken: string
  groupLabel: string
  roomState: RoomStateSnapshot
  gameState: GameStateSnapshot
}

export interface ClientToServerEvents {
  'room:create': (payload: { username: string; name: string; isPrivate: boolean; password?: string }, ack: (res: RoomCreateAck) => void) => void
  'room:join':   (payload: { roomId: string; username: string; password?: string }, ack: (res: RoomJoinAck) => void) => void
  'room:reconnect': (payload: { roomId: string; reconnectToken: string }, ack: (res: RoomReconnectAck) => void) => void
  'room:set-color': (payload: RoomSetColorPayload, ack: (res: GameControlAck) => void) => void
  'tournament:create': (payload: { username: string; name: string }, ack: (res: TournamentCreateAck) => void) => void
  'tournament:join': (payload: { tournamentId: string; username: string }, ack: (res: TournamentJoinAck) => void) => void
  'tournament:reconnect': (payload: { tournamentId: string; reconnectToken: string }, ack: (res: TournamentReconnectAck) => void) => void
  'tournament:start': (payload: { tournamentId: string }, ack: (res: TournamentControlAck) => void) => void
  'tournament:next-stage': (payload: { tournamentId: string }, ack: (res: TournamentControlAck) => void) => void
  'tournament:retry-group': (payload: { tournamentId: string; groupId: string }, ack: (res: TournamentControlAck) => void) => void
  'tournament:leave': (payload: { tournamentId: string }, ack: (res: TournamentControlAck) => void) => void
  'spectate:join': (payload: { roomId: string }, ack: (res: SpectateJoinAck) => void) => void
  'game:move':   (payload: GameMovePayload, ack: (res: GameMoveAck) => void) => void
  'game:rematch':(payload: { roomId: string }, ack: (res: GameControlAck) => void) => void
  'game:start':  (payload: { roomId: string; settings?: GameSettings }, ack: (res: GameControlAck) => void) => void
  'game:finish': (payload: { roomId: string }, ack: (res: GameControlAck) => void) => void
  'rooms:get':   (ack: (rooms: PublicRoomInfo[]) => void) => void
}

// ── Server → Client ──────────────────────────────────────────────

export interface PlayerInfo {
  slot:      PlayerSlot
  username:  string
  connected: boolean
  color?:    PlayerColorId
}

export interface RoomTournamentInfo {
  id: string
  name: string
  stage: number
  groupId: string
  groupLabel: string
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
  hostSlot: PlayerSlot
  gameSettings: GameSettings
  tournament?: RoomTournamentInfo
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
  turnNumber?:   number
  turnStartedAt?: number
  players:       PlayerSlot[]
  lastMove?: LastMove | null
  gameSettings?: GameSettings
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
  'tournament:state': (state: TournamentSnapshot) => void
  'tournament:assigned': (assignment: TournamentRoomAssignment) => void
  'error':         (payload: { code: string; message: string }) => void
}
