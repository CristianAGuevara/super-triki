import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGameStore } from '@/stores/gameStore'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('initGame', () => {
  it('creates 9 pieces per player (3L+3M+3S)', () => {
    const store = useGameStore()
    store.initGame(2)
    expect(store.inventories[1]).toHaveLength(9)
    expect(store.inventories[2]).toHaveLength(9)
  })

  it('starts with player 1', () => {
    const store = useGameStore()
    store.initGame(2)
    expect(store.currentPlayer).toBe(1)
  })

  it('board is empty after init', () => {
    const store = useGameStore()
    store.initGame(2)
    store.board.forEach(row => row.forEach(cell => {
      expect(cell.large).toBeNull()
      expect(cell.medium).toBeNull()
      expect(cell.small).toBeNull()
    }))
  })
})

describe('placePiece', () => {
  it('places a piece on the board and removes from inventory', () => {
    const store = useGameStore()
    store.initGame(2)
    const piece = store.inventories[1][0]
    const before = store.inventories[1].length

    // Set drag state so canDrop works correctly
    store.setDragState({ pieceId: piece.id, player: 1, size: piece.size, source: 'inventory' })

    const ok = store.placePiece({
      pieceId: piece.id,
      targetRow: 0,
      targetCol: 0,
      targetSize: piece.size,
    })

    expect(ok).toBe(true)
    expect(store.inventories[1]).toHaveLength(before - 1)
    expect(store.board[0][0][piece.size]).not.toBeNull()
  })

  it('rejects placing on an occupied slot', () => {
    const store = useGameStore()
    store.initGame(2)
    const [p1] = [store.inventories[1][0]]

    store.setDragState({ pieceId: p1.id, player: 1, size: p1.size, source: 'inventory' })
    store.placePiece({ pieceId: p1.id, targetRow: 0, targetCol: 0, targetSize: p1.size })

    // advance to player 1 again (since p2 goes, then p1 again)
    // Actually player 2 now - but let's just try to place same slot again
    // We need to skip to player 1's turn by doing player 2 first
    const p2piece = store.inventories[2].find(p => p.size === p1.size)!
    store.setDragState({ pieceId: p2piece.id, player: 2, size: p2piece.size, source: 'inventory' })
    const rejected = store.placePiece({
      pieceId: p2piece.id,
      targetRow: 0,
      targetCol: 0,
      targetSize: p2piece.size,
    })
    expect(rejected).toBe(false)
  })

  it('advances turn after valid move', () => {
    const store = useGameStore()
    store.initGame(2)
    const piece = store.inventories[1][0]
    store.setDragState({ pieceId: piece.id, player: 1, size: piece.size, source: 'inventory' })
    store.placePiece({ pieceId: piece.id, targetRow: 0, targetCol: 0, targetSize: piece.size })
    expect(store.currentPlayer).toBe(2)
  })

  it('detects win and stops the game', () => {
    const store = useGameStore()
    store.initGame(2)

    // Place 3 large pieces for player 1 in top row, interleaved with player 2 moves
    const p1larges = store.inventories[1].filter(p => p.size === 'large')
    const p2smalls = store.inventories[2].filter(p => p.size === 'small')

    // P1: [0,0] large
    store.setDragState({ pieceId: p1larges[0].id, player: 1, size: 'large', source: 'inventory' })
    store.placePiece({ pieceId: p1larges[0].id, targetRow: 0, targetCol: 0, targetSize: 'large' })
    // P2: [1,0] small
    store.setDragState({ pieceId: p2smalls[0].id, player: 2, size: 'small', source: 'inventory' })
    store.placePiece({ pieceId: p2smalls[0].id, targetRow: 1, targetCol: 0, targetSize: 'small' })
    // P1: [0,1] large
    store.setDragState({ pieceId: p1larges[1].id, player: 1, size: 'large', source: 'inventory' })
    store.placePiece({ pieceId: p1larges[1].id, targetRow: 0, targetCol: 1, targetSize: 'large' })
    // P2: [1,1] small
    store.setDragState({ pieceId: p2smalls[1].id, player: 2, size: 'small', source: 'inventory' })
    store.placePiece({ pieceId: p2smalls[1].id, targetRow: 1, targetCol: 1, targetSize: 'small' })
    // P1: [0,2] large — win!
    store.setDragState({ pieceId: p1larges[2].id, player: 1, size: 'large', source: 'inventory' })
    store.placePiece({ pieceId: p1larges[2].id, targetRow: 0, targetCol: 2, targetSize: 'large' })

    expect(store.winResult).not.toBeNull()
    expect(store.winResult!.winner).toBe(1)
    expect(store.isGameOver).toBe(true)
  })
})

describe('tap selection', () => {
  it('selects an available piece and only allows compatible empty slots', () => {
    const store = useGameStore()
    store.initGame(2)
    const piece = store.inventories[1].find(item => item.size === 'medium')!

    store.selectPiece({ pieceId: piece.id, player: 1, size: piece.size, source: 'inventory' })

    expect(store.selectedPiece?.pieceId).toBe(piece.id)
    expect(store.canDrop(1, 1, 'medium')).toBe(true)
    expect(store.canDrop(1, 1, 'small')).toBe(false)

    store.clearSelection()
    expect(store.selectedPiece).toBeNull()
  })
})

describe('resetGame', () => {
  it('resets board and inventories', () => {
    const store = useGameStore()
    store.initGame(2)
    const piece = store.inventories[1][0]
    store.setDragState({ pieceId: piece.id, player: 1, size: piece.size, source: 'inventory' })
    store.placePiece({ pieceId: piece.id, targetRow: 0, targetCol: 0, targetSize: piece.size })

    store.resetGame()

    expect(store.inventories[1]).toHaveLength(9)
    expect(store.board[0][0][piece.size]).toBeNull()
    expect(store.winResult).toBeNull()
    expect(store.currentPlayer).toBe(1)
  })
})
