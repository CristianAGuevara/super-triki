import type { Board, Line, Piece, WinResult, Size, CellCoord } from '@/types/game'
import { SIZE_ORDER } from '@/types/game'

function checkSameSize(board: Board, lines: Line[]): WinResult | null {
  for (const line of lines) {
    for (const size of SIZE_ORDER) {
      const pieces = line.map(([r, c]) => board[r][c][size])
      if (pieces.every((p): p is NonNullable<typeof p> => p !== null && p.player === pieces[0]!.player)) {
        return {
          winner: pieces[0]!.player,
          condition: 'same-size',
          highlights: line.map((coord): { coord: CellCoord; size: Size } => ({ coord: coord as CellCoord, size })),
        }
      }
    }
  }
  return null
}

function checkOrderedSequence(board: Board, lines: Line[], players: number[]): WinResult | null {
  // Ascending: cell[0]=large, cell[1]=medium, cell[2]=small
  // Descending: cell[0]=small, cell[1]=medium, cell[2]=large
  const sequences: { sizes: Size[]; label: 'ordered-sequence' }[] = [
    { sizes: ['large', 'medium', 'small'], label: 'ordered-sequence' },
    { sizes: ['small', 'medium', 'large'], label: 'ordered-sequence' },
  ]

  for (const line of lines) {
    for (const player of players) {
      for (const seq of sequences) {
        const matches = line.every(([r, c], i) => {
          const piece = board[r][c][seq.sizes[i]]
          return piece !== null && piece.player === player
        })
        if (matches) {
          return {
            winner: player,
            condition: 'ordered-sequence',
            highlights: line.map((coord, i) => ({
              coord: coord as CellCoord,
              size: seq.sizes[i],
            })),
          }
        }
      }
    }
  }
  return null
}

function checkCompleteCell(board: Board, players: number[]): WinResult | null {
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const cell = board[r][c]
      if (cell.large && cell.medium && cell.small) {
        const p = cell.large.player
        if (cell.medium.player === p && cell.small.player === p) {
          // Only trigger if ALL pieces belong to the same player
          if (players.includes(p)) {
            return {
              winner: p,
              condition: 'complete-cell',
              highlights: SIZE_ORDER.map(size => ({ coord: [r, c] as CellCoord, size })),
            }
          }
        }
      }
    }
  }
  return null
}

export function detectWin(board: Board, lines: Line[], players: number[]): WinResult | null {
  return (
    checkCompleteCell(board, players) ??
    checkSameSize(board, lines) ??
    checkOrderedSequence(board, lines, players) ??
    null
  )
}

export function detectDraw<T extends number = number>(
  board: Board,
  inventories?: Partial<Record<T, Piece[]>>,
  players?: T[],
): boolean {
  const fullBoard = board.every(row =>
    row.every(cell => cell.large !== null && cell.medium !== null && cell.small !== null)
  )
  const noPiecesLeft = !!inventories && !!players && players.length > 0 &&
    players.every(player => (inventories[player]?.length ?? 0) === 0)
  return fullBoard || noPiecesLeft
}
