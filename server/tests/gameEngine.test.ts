import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyMove,
  buildInitialGameState,
  skipTurn,
  validateMove,
} from '../src/engine/GameEngine.js'
import { detectDraw } from '../src/engine/winDetection.js'

test('buildInitialGameState creates nine pieces per player', () => {
  const game = buildInitialGameState(2)
  assert.equal(game.inventories[1].length, 9)
  assert.equal(game.inventories[2].length, 9)
  assert.equal(game.currentPlayer, 1)
  assert.equal(game.settings.turnTimerEnabled, false)
})

test('applyMove places a piece and advances the turn', () => {
  const game = buildInitialGameState(2)
  const next = applyMove(game, {
    roomId: 'ABC123',
    pieceId: 'p1-large-0',
    targetRow: 0,
    targetCol: 0,
    targetSize: 'large',
  })

  assert.equal(next.inventories[1].length, 8)
  assert.equal(next.board[0][0].large?.id, 'p1-large-0')
  assert.equal(next.currentPlayer, 2)
  assert.equal(next.moveNumber, 1)
})

test('validateMove rejects occupied slots and out-of-bounds coordinates', () => {
  const game = buildInitialGameState(2)
  const moved = applyMove(game, {
    roomId: 'ABC123',
    pieceId: 'p1-small-0',
    targetRow: 0,
    targetCol: 0,
    targetSize: 'small',
  })

  assert.equal(validateMove(moved, {
    roomId: 'ABC123',
    pieceId: 'p2-small-0',
    targetRow: 0,
    targetCol: 0,
    targetSize: 'small',
  }, 2).valid, false)

  assert.equal(validateMove(game, {
    roomId: 'ABC123',
    pieceId: 'p1-small-0',
    targetRow: 9,
    targetCol: 0,
    targetSize: 'small',
  }, 1).valid, false)
})

test('detectDraw is true when every player has exhausted their pieces', () => {
  const game = buildInitialGameState(2)
  assert.equal(detectDraw(game.board, { 1: [], 2: [] }, [1, 2]), true)
  assert.equal(detectDraw(game.board, { 1: [], 2: game.inventories[2] }, [1, 2]), false)
})

test('skipTurn advances without penalty when the option is disabled', () => {
  const game = buildInitialGameState(2)
  const next = skipTurn(game)

  assert.equal(next.currentPlayer, 2)
  assert.equal(next.inventories[1].length, 9)
})

test('skipTurn removes a small piece when the penalty is enabled', () => {
  const game = buildInitialGameState(2, 1, {
    turnTimerEnabled: true,
    turnDurationSeconds: 90,
    removePieceOnTimeout: true,
  })
  const next = skipTurn(game, 1_000)

  assert.equal(next.currentPlayer, 2)
  assert.equal(next.inventories[1].filter(piece => piece.size === 'small').length, 2)
  assert.equal(next.turnStartedAt, 1_000)
})
