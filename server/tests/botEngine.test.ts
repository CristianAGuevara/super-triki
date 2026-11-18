import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BOT_MAX_THINK_DELAY_MS,
  botThinkDelay,
  chooseBotEmote,
  chooseBotMove,
} from '../src/bots/BotEngine.js'
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

test('thinking pauses grow with difficulty and board occupation', () => {
  const emptyDelays = BOT_DIFFICULTIES.map(difficulty => botThinkDelay(difficulty, 0, () => 1))
  const fullDelays = BOT_DIFFICULTIES.map(difficulty => botThinkDelay(difficulty, 27, () => 1))
  assert.deepEqual(fullDelays, [2_400, 4_000, 6_000, 8_400])
  assert.ok(fullDelays.every((delay, index) => delay > emptyDelays[index]))
  assert.ok(fullDelays.every(delay => delay <= BOT_MAX_THINK_DELAY_MS))

  let call = 0
  const deepThink = [0, 1, 1]
  const capped = botThinkDelay('expert', 27, () => deepThink[call++] ?? 1)
  assert.equal(capped, BOT_MAX_THINK_DELAY_MS)
})

test('bot emotes are sparse and confidence-aware', () => {
  const game = buildInitialGameState(2)
  assert.equal(chooseBotEmote(game, 1, () => 1), null)

  place(game, 1, 'large', 0, 0)
  place(game, 1, 'large', 0, 1)
  const emote = chooseBotEmote(game, 1, () => 0)
  assert.ok(emote && ['happy', 'cool', 'love'].includes(emote))
})

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
