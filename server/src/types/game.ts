export type Size = 'large' | 'medium' | 'small'

export const SIZE_ORDER: Size[] = ['large', 'medium', 'small']

export type Player = number

export type PlayerSlot = 1 | 2 | 3 | 4

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
