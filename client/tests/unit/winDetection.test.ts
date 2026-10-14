import { describe, it, expect } from 'vitest'
import { detectWin, detectDraw } from '@/composables/useWinDetection'
import { getAllLines, emptyBoard } from '@/utils/boardUtils'
import type { Board, Piece } from '@/types/game'

const lines = getAllLines(3)
const players = [1, 2]

function mkPiece(player: number, size: 'large' | 'medium' | 'small', idx = 0): Piece {
  return { id: `p${player}-${size}-${idx}`, player, size }
}

function freshBoard(): Board {
  return emptyBoard()
}

describe('detectWin — no winner', () => {
  it('returns null on empty board', () => {
    expect(detectWin(freshBoard(), lines, players)).toBeNull()
  })

  it('returns null when same size but different players', () => {
    const board = freshBoard()
    board[0][0].large = mkPiece(1, 'large')
    board[0][1].large = mkPiece(2, 'large')
    board[0][2].large = mkPiece(1, 'large')
    expect(detectWin(board, lines, players)).toBeNull()
  })
})

describe('detectWin — condition 1: same-size in line', () => {
  it('detects top row win with large pieces', () => {
    const board = freshBoard()
    board[0][0].large = mkPiece(1, 'large', 0)
    board[0][1].large = mkPiece(1, 'large', 1)
    board[0][2].large = mkPiece(1, 'large', 2)
    const result = detectWin(board, lines, players)
    expect(result).not.toBeNull()
    expect(result!.winner).toBe(1)
    expect(result!.condition).toBe('same-size')
  })

  it('detects column win with small pieces', () => {
    const board = freshBoard()
    board[0][2].small = mkPiece(2, 'small', 0)
    board[1][2].small = mkPiece(2, 'small', 1)
    board[2][2].small = mkPiece(2, 'small', 2)
    const result = detectWin(board, lines, players)
    expect(result!.winner).toBe(2)
    expect(result!.condition).toBe('same-size')
  })

  it('detects diagonal win with medium pieces', () => {
    const board = freshBoard()
    board[0][0].medium = mkPiece(1, 'medium', 0)
    board[1][1].medium = mkPiece(1, 'medium', 1)
    board[2][2].medium = mkPiece(1, 'medium', 2)
    const result = detectWin(board, lines, players)
    expect(result!.winner).toBe(1)
    expect(result!.condition).toBe('same-size')
    expect(result!.highlights).toHaveLength(3)
  })
})

describe('detectWin — condition 2: ordered-sequence', () => {
  it('detects ascending sequence in a row (large→medium→small)', () => {
    const board = freshBoard()
    board[1][0].large  = mkPiece(1, 'large', 0)
    board[1][1].medium = mkPiece(1, 'medium', 0)
    board[1][2].small  = mkPiece(1, 'small', 0)
    const result = detectWin(board, lines, players)
    expect(result!.winner).toBe(1)
    expect(result!.condition).toBe('ordered-sequence')
  })

  it('detects descending sequence in a row (small→medium→large)', () => {
    const board = freshBoard()
    board[2][0].small  = mkPiece(2, 'small', 0)
    board[2][1].medium = mkPiece(2, 'medium', 0)
    board[2][2].large  = mkPiece(2, 'large', 0)
    const result = detectWin(board, lines, players)
    expect(result!.winner).toBe(2)
    expect(result!.condition).toBe('ordered-sequence')
  })

  it('does not fire if sequence belongs to different players', () => {
    const board = freshBoard()
    board[0][0].large  = mkPiece(1, 'large', 0)
    board[0][1].medium = mkPiece(2, 'medium', 0)
    board[0][2].small  = mkPiece(1, 'small', 0)
    expect(detectWin(board, lines, players)).toBeNull()
  })

  it('detects ascending sequence along diagonal', () => {
    const board = freshBoard()
    board[0][0].large  = mkPiece(1, 'large', 0)
    board[1][1].medium = mkPiece(1, 'medium', 0)
    board[2][2].small  = mkPiece(1, 'small', 0)
    const result = detectWin(board, lines, players)
    expect(result!.condition).toBe('ordered-sequence')
  })
})

describe('detectWin — condition 3: complete-cell', () => {
  it('detects complete cell for same player', () => {
    const board = freshBoard()
    board[1][1].large  = mkPiece(2, 'large', 0)
    board[1][1].medium = mkPiece(2, 'medium', 0)
    board[1][1].small  = mkPiece(2, 'small', 0)
    const result = detectWin(board, lines, players)
    expect(result!.winner).toBe(2)
    expect(result!.condition).toBe('complete-cell')
    expect(result!.highlights).toHaveLength(3)
  })

  it('does not fire for mixed-player complete cell', () => {
    const board = freshBoard()
    board[0][0].large  = mkPiece(1, 'large', 0)
    board[0][0].medium = mkPiece(2, 'medium', 0)
    board[0][0].small  = mkPiece(1, 'small', 0)
    expect(detectWin(board, lines, players)).toBeNull()
  })

  it('takes priority over same-size wins', () => {
    // complete-cell check runs first
    const board = freshBoard()
    // Row win
    board[0][0].large = mkPiece(1, 'large', 0)
    board[0][1].large = mkPiece(1, 'large', 1)
    board[0][2].large = mkPiece(1, 'large', 2)
    // Also complete cell at [0][0]
    board[0][0].medium = mkPiece(1, 'medium', 0)
    board[0][0].small  = mkPiece(1, 'small', 0)
    const result = detectWin(board, lines, players)
    expect(result!.condition).toBe('complete-cell')
  })
})

describe('detectDraw', () => {
  it('returns false on empty board', () => {
    expect(detectDraw(freshBoard())).toBe(false)
  })

  it('returns true when all 27 slots are filled', () => {
    const board = freshBoard()
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        board[r][c].large  = mkPiece(1, 'large', 0)
        board[r][c].medium = mkPiece(2, 'medium', 0)
        board[r][c].small  = mkPiece(1, 'small', 0)
      }
    }
    expect(detectDraw(board)).toBe(true)
  })

  it('returns false when at least one slot is empty', () => {
    const board = freshBoard()
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        board[r][c].large  = mkPiece(1, 'large', 0)
        board[r][c].medium = mkPiece(2, 'medium', 0)
        board[r][c].small  = mkPiece(1, 'small', 0)
      }
    }
    board[2][2].small = null
    expect(detectDraw(board)).toBe(false)
  })

  it('returns true when all players have used all their pieces', () => {
    const inventories = { 1: [], 2: [] }
    expect(detectDraw(freshBoard(), inventories, players)).toBe(true)
  })

  it('does not draw while any player still has pieces', () => {
    const inventories = { 1: [], 2: [mkPiece(2, 'small')] }
    expect(detectDraw(freshBoard(), inventories, players)).toBe(false)
  })
})
