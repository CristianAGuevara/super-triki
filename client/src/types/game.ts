export type Size = 'large' | 'medium' | 'small'

export const SIZE_ORDER: Size[] = ['large', 'medium', 'small']

// Numeric so expanding to 3 or 4 players requires zero type changes
export type Player = number

export interface Piece {
  id: string
  player: Player
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

export interface DragPayload {
  pieceId: string
  player: Player
  size: Size
  source: 'inventory' | 'board'
}
