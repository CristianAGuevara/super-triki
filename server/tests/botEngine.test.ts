import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseBotMove } from '../src/bots/BotEngine.js'
import {
  buildInitialGameState,
  validateMove,
  type RoomGameState,
} from '../src/engine/GameEngine.js'
import type { PlayerSlot, Size } from '../src/types/game.js'
import { BOT_DIFFICULTIES } from '../src/types/game.js'

function place(
  game: RoomGameState,
  player: PlayerSlot,
  size: Size,
  row: number,
  col: number,
): void {
  const index = game.inventories[player].findIndex(piece => piece.size === size)
  assert.notEqual(index, -1)
  const [piece] = game.inventories[player].splice(index, 1)
  game.board[row][col][size] = piece
}

test('every difficulty returns a legal opening move', () => {
  for (const difficulty of BOT_DIFFICULTIES) {
    const game = buildInitialGameState(2)
    const startedAt = Date.now()
    const move = chooseBotMove(game, difficulty, () => 0.5)
    assert.ok(move, `${difficulty} should return a move`)
    assert.equal(
      validateMove(game, { roomId: 'TEST', ...move }, 1).valid,
      true,
      `${difficulty} should return a legal move`,
    )
    assert.ok(Date.now() - startedAt < 2_000, `${difficulty} should answer quickly`)
  }
})

test('Normal takes an immediate winning move', () => {
  const game = buildInitialGameState(2)
  place(game, 1, 'large', 0, 0)
  place(game, 1, 'large', 0, 1)

  const move = chooseBotMove(game, 'normal', () => 0.9)
  assert.ok(move)
  assert.deepEqual(
    { row: move.targetRow, col: move.targetCol, size: move.targetSize },
    { row: 0, col: 2, size: 'large' },
  )
})

test('Normal blocks an immediate opponent win', () => {
  const game = buildInitialGameState(2)
  place(game, 2, 'medium', 0, 0)
  place(game, 2, 'medium', 0, 1)

  const move = chooseBotMove(game, 'normal', () => 0)
  assert.ok(move)
  assert.deepEqual(
    { row: move.targetRow, col: move.targetCol, size: move.targetSize },
    { row: 0, col: 2, size: 'medium' },
  )
})

test('Hard refuses to leave a one-move victory for the opponent', () => {
  const game = buildInitialGameState(2)
  place(game, 2, 'medium', 0, 0)
  place(game, 2, 'medium', 0, 1)

  const move = chooseBotMove(game, 'hard', () => 0)
  assert.ok(move)
  assert.deepEqual(
    { row: move.targetRow, col: move.targetCol, size: move.targetSize },
    { row: 0, col: 2, size: 'medium' },
  )
})

test('Expert prefers winning immediately instead of searching', () => {
  const game = buildInitialGameState(2)
  place(game, 1, 'small', 2, 0)
  place(game, 1, 'small', 2, 1)

  const move = chooseBotMove(game, 'expert', () => 0)
  assert.ok(move)
  assert.deepEqual(
    { row: move.targetRow, col: move.targetCol, size: move.targetSize },
    { row: 2, col: 2, size: 'small' },
  )
})
