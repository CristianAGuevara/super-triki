export type Size = 'large' | 'medium' | 'small'

export const SIZE_ORDER: Size[] = ['large', 'medium', 'small']

export type Player = number

export type PlayerSlot = 1 | 2 | 3 | 4

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
