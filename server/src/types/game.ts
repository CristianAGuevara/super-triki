export type Size = 'large' | 'medium' | 'small'

export const SIZE_ORDER: Size[] = ['large', 'medium', 'small']

export type Player = number

export type PlayerSlot = 1 | 2 | 3 | 4

// Keep these ids in sync with client/src/types/game.ts.
export const PLAYER_COLOR_IDS = [
  'coral',
  'cyan',
  'magenta',
  'amber',
  'emerald',
  'violet',
  'orange',
  'blue',
] as const

export type PlayerColorId = typeof PLAYER_COLOR_IDS[number]

export const DEFAULT_PLAYER_COLOR_IDS: Record<PlayerSlot, PlayerColorId> = {
  1: 'coral',
  2: 'cyan',
  3: 'magenta',
  4: 'amber',
}

export function isPlayerColorId(value: unknown): value is PlayerColorId {
  return typeof value === 'string' && (PLAYER_COLOR_IDS as readonly string[]).includes(value)
}

export interface GameSettings {
  turnTimerEnabled: boolean
  turnDurationSeconds: number
  removePieceOnTimeout: boolean
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  turnTimerEnabled: false,
  turnDurationSeconds: 90,
  removePieceOnTimeout: false,
}

export interface Piece {
  id: string
  player: Player
  size: Size
}

export interface LastMove {
  pieceId: string
  player: Player
  row: number
  col: number
  size: Size
}

export interface Cell {
  large: Piece | null
  medium: Piece | null
  small: Piece | null
}

export type Board = Cell[][]

export type CellCoord = [number, number]

export type Line = CellCoord[]

export interface WinResult {
  winner: Player
  condition: 'same-size' | 'ordered-sequence' | 'complete-cell'
  highlights: Array<{ coord: CellCoord; size: Size }>
}
