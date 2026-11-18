import type { Board, BotDifficulty, PlayerSlot, Size } from '../types/game.js'
import { SIZE_ORDER } from '../types/game.js'
import type { EmoteId, GameMovePayload } from '../types/socket.js'
import { getAllLines } from '../engine/boardUtils.js'
import { activePlayers, applyMove, type RoomGameState } from '../engine/GameEngine.js'

export interface BotMove {
  pieceId: string
  targetRow: number
  targetCol: number
  targetSize: Size
}

interface RankedMove {
  move: BotMove
  next: RoomGameState
  score: number
}

const LINES = getAllLines(3)
const ORDERED_SEQUENCES: Size[][] = [
  ['large', 'medium', 'small'],
  ['small', 'medium', 'large'],
]
const SAME_SIZE_WEIGHTS = [0, 7, 42]
const ORDERED_WEIGHTS = [0, 5, 30]
const CELL_WEIGHTS = [0, 9, 52]
const WIN_SCORE = 1_000_000
const SEARCH_DEPTH = 2
const SEARCH_DEADLINE_MS = 160
const SEARCH_NODE_LIMIT = 12_000

export const BOT_MAX_THINK_DELAY_MS = 10_000
const BOT_DELAY_RANGES: Record<BotDifficulty, [number, number]> = {
  easy: [800, 1_600],
  normal: [1_400, 2_800],
  hard: [2_200, 4_200],
  expert: [3_200, 6_000],
}
const BOT_BOARD_BONUS: Record<BotDifficulty, number> = {
  easy: 800,
  normal: 1_200,
  hard: 1_800,
  expert: 2_400,
}
const BOT_DEEP_THINK_CHANCE = 0.12
const BOT_DEEP_THINK_BONUS: [number, number] = [800, 2_000]
const BOT_BOARD_PIECES_MAX = 27

export const BOT_EMOTE_BASE_CHANCE = 0.3
export const BOT_EMOTE_CONFIDENT_CHANCE = 0.6
export const BOT_EMOTE_STRUGGLING_CHANCE = 0.45
const BOT_EMOTE_CONFIDENCE_THRESHOLD = 65
const CONFIDENT_EMOTES: EmoteId[] = ['happy', 'cool', 'love']
const STRUGGLING_EMOTES: EmoteId[] = ['sleepy', 'crying', 'angry']
const NEUTRAL_EMOTES: EmoteId[] = ['cool', 'happy', 'sleepy']

type Random = () => number

function randomItem<T>(items: T[], random: Random): T {
  return items[Math.floor(random() * items.length)] ?? items[0]
}

function moveKey(move: BotMove): string {
  return `${move.targetRow},${move.targetCol},${move.targetSize}`
}

/** One representative per available size is enough: copies behave identically. */
export function legalBotMoves(state: RoomGameState, player = state.currentPlayer): BotMove[] {
  const inventory = state.inventories[player] ?? []
  const piecesBySize = new Map<Size, string>()
  for (const piece of inventory) {
    if (!piecesBySize.has(piece.size)) piecesBySize.set(piece.size, piece.id)
  }

  const moves: BotMove[] = []
  for (let row = 0; row < state.board.length; row++) {
    for (let col = 0; col < state.board[row].length; col++) {
      for (const size of SIZE_ORDER) {
        const pieceId = piecesBySize.get(size)
        if (!pieceId) continue
        if (state.board[row][col][size] !== null) continue
        moves.push({ pieceId, targetRow: row, targetCol: col, targetSize: size })
      }
    }
  }
  return moves
}

function payload(move: BotMove): GameMovePayload {
  return {
    roomId: '',
    pieceId: move.pieceId,
    targetRow: move.targetRow,
    targetCol: move.targetCol,
    targetSize: move.targetSize,
  }
}

function simulate(state: RoomGameState, player: PlayerSlot, move: BotMove): RoomGameState {
  const base = state.currentPlayer === player ? state : { ...state, currentPlayer: player }
  return applyMove(base, payload(move))
}

function immediateWinningMoves(state: RoomGameState, player: PlayerSlot): BotMove[] {
  return legalBotMoves(state, player).filter(move =>
    simulate(state, player, move).winResult?.winner === player
  )
}

function addPotential(
  scores: Record<number, number>,
  owners: Array<number | null>,
  weights: number[],
): void {
  let owner: number | null = null
  let count = 0
  let blocked = false

  for (const pieceOwner of owners) {
    if (!pieceOwner) continue
    if (owner !== null && pieceOwner !== owner) {
      blocked = true
      break
    }
    owner = pieceOwner
    count++
  }
  if (!blocked && owner !== null && count > 0) {
    scores[owner] = (scores[owner] ?? 0) + (weights[count] ?? 0)
  }
}

function fullCellBlocked(cell: Board[number][number], player: PlayerSlot): boolean {
  return SIZE_ORDER.some(size => {
    const piece = cell[size]
    return piece !== null && piece.player !== player
  })
}

export function evaluateBotState(state: RoomGameState, bot: PlayerSlot): number {
  if (state.winResult) return state.winResult.winner === bot ? WIN_SCORE : -WIN_SCORE
  if (state.isDraw) return 0

  const active = activePlayers(state)
  const scores: Record<number, number> = Object.fromEntries(active.map(slot => [slot, 0]))

  for (const line of LINES) {
    for (const size of SIZE_ORDER) {
      addPotential(
        scores,
        line.map(([row, col]) => state.board[row][col][size]?.player ?? null),
        SAME_SIZE_WEIGHTS,
      )
    }

    for (const sequence of ORDERED_SEQUENCES) {
      for (const player of active) {
        let matches = 0
        let blocked = false
        for (let index = 0; index < line.length; index++) {
          const [row, col] = line[index]
          const piece = state.board[row][col][sequence[index]]
          if (!piece) continue
          if (piece.player !== player) {
            blocked = true
            break
          }
          matches++
        }
        if (!blocked && matches > 0) {
          scores[player] = (scores[player] ?? 0) + (ORDERED_WEIGHTS[matches] ?? 0)
        }
      }
    }
  }

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cell = state.board[row][col]
      for (const player of active) {
        if (fullCellBlocked(cell, player)) continue
        const matches = SIZE_ORDER.filter(size => cell[size]?.player === player).length
        if (matches > 0) {
          scores[player] = (scores[player] ?? 0) + (CELL_WEIGHTS[matches] ?? 0)
        }
      }
    }
  }

  for (const size of SIZE_ORDER) {
    const center = state.board[1]?.[1]?.[size]
    if (center) scores[center.player] = (scores[center.player] ?? 0) + 2
  }

  const own = scores[bot] ?? 0
  let strongestOpponent = 0
  for (const player of active) {
    if (player === bot) continue
    strongestOpponent = Math.max(strongestOpponent, scores[player] ?? 0)
  }
  return own - strongestOpponent * 1.12
}

export function countBoardPieces(board: Board): number {
  let count = 0
  for (const row of board) {
    for (const cell of row) {
      for (const size of SIZE_ORDER) {
        if (cell[size]) count++
      }
    }
  }
  return count
}

/** Purely cosmetic timing: it does not influence move selection. */
export function botThinkDelay(
  difficulty: BotDifficulty,
  piecesOnBoard: number,
  random: Random = Math.random,
): number {
  const [min, max] = BOT_DELAY_RANGES[difficulty]
  const progress = Math.max(0, Math.min(1, piecesOnBoard / BOT_BOARD_PIECES_MAX))
  const deepThink = random() < BOT_DEEP_THINK_CHANCE
  const base = min + random() * (max - min)
  const boardBonus = BOT_BOARD_BONUS[difficulty] * progress
  const extraThink = deepThink
    ? BOT_DEEP_THINK_BONUS[0] + random() * (BOT_DEEP_THINK_BONUS[1] - BOT_DEEP_THINK_BONUS[0])
    : 0
  return Math.min(
    BOT_MAX_THINK_DELAY_MS,
    Math.round(base + boardBonus + extraThink),
  )
}

/**
 * Purely cosmetic and read-only: confidence never feeds back into move
 * selection. A clear immediate win counts as "confident" even if the line
 * evaluator has not fully priced the threat yet.
 */
export function chooseBotEmote(
  state: RoomGameState,
  bot: PlayerSlot,
  random: Random = Math.random,
): EmoteId | null {
  const score = evaluateBotState(state, bot)
  const hasImmediateWin = state.currentPlayer === bot && immediateWinningMoves(state, bot).length > 0
  const confident = hasImmediateWin || score >= BOT_EMOTE_CONFIDENCE_THRESHOLD
  const struggling = score <= -BOT_EMOTE_CONFIDENCE_THRESHOLD
  const chance = confident
    ? BOT_EMOTE_CONFIDENT_CHANCE
    : struggling ? BOT_EMOTE_STRUGGLING_CHANCE : BOT_EMOTE_BASE_CHANCE

  if (random() >= chance) return null
  const pool = confident
    ? CONFIDENT_EMOTES
    : struggling ? STRUGGLING_EMOTES : NEUTRAL_EMOTES
  return randomItem(pool, random)
}

function rankedMoves(
  state: RoomGameState,
  bot: PlayerSlot,
  random: Random,
  includeDanger = false,
): RankedMove[] {
  return legalBotMoves(state).map(move => {
    const next = simulate(state, bot, move)
    let score = next.winResult?.winner === bot ? WIN_SCORE : evaluateBotState(next, bot)
    if (includeDanger && !next.winResult && !next.isDraw) {
      const danger = immediateWinningMoves(next, next.currentPlayer).length
      score -= danger * 18_000
    }
    return { move, next, score: score + random() * 0.01 }
  }).sort((a, b) => b.score - a.score)
}

function chooseNormal(
  state: RoomGameState,
  bot: PlayerSlot,
  random: Random,
): BotMove {
  const wins = immediateWinningMoves(state, bot)
  if (wins.length > 0) return randomItem(wins, random)

  const opponents = activePlayers(state).filter(player => player !== bot)
  const threats = opponents.flatMap(player => immediateWinningMoves(state, player))
  if (threats.length > 0) {
    const blockKeys = new Set(threats.map(moveKey))
    const blocks = legalBotMoves(state).filter(move => blockKeys.has(moveKey(move)))
    if (blocks.length > 0) {
      const ranked = rankedMoves(state, bot, random)
        .filter(candidate => blocks.some(move => moveKey(move) === moveKey(candidate.move)))
      if (ranked.length > 0) return ranked[0].move
    }
  }

  const ranked = rankedMoves(state, bot, random)
  return randomItem(ranked.slice(0, Math.min(3, ranked.length)), random).move
}

function chooseHard(state: RoomGameState, bot: PlayerSlot, random: Random): BotMove {
  const wins = immediateWinningMoves(state, bot)
  if (wins.length > 0) return randomItem(wins, random)
  return rankedMoves(state, bot, random, true)[0].move
}

function searchValue(
  state: RoomGameState,
  depth: number,
  bot: PlayerSlot,
  alpha: number,
  beta: number,
  deadline: number,
  nodes: { count: number },
): number {
  nodes.count++
  if (state.winResult || state.isDraw || depth <= 0 ||
      Date.now() > deadline || nodes.count > SEARCH_NODE_LIMIT) {
    return evaluateBotState(state, bot)
  }

  const moves = legalBotMoves(state)
  if (moves.length === 0) return evaluateBotState(state, bot)
  const maximizing = state.currentPlayer === bot
  const children = moves.map(move => {
    const next = simulate(state, state.currentPlayer, move)
    return {
      next,
      immediate: next.winResult?.winner === state.currentPlayer,
      score: evaluateBotState(next, bot),
    }
  }).sort((a, b) =>
    Number(b.immediate) - Number(a.immediate) || b.score - a.score
  )

  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
  for (const child of children) {
    const value = searchValue(child.next, depth - 1, bot, alpha, beta, deadline, nodes)
    if (maximizing) {
      best = Math.max(best, value)
      alpha = Math.max(alpha, best)
    } else {
      best = Math.min(best, value)
      beta = Math.min(beta, best)
    }
    if (beta <= alpha || Date.now() > deadline || nodes.count > SEARCH_NODE_LIMIT) break
  }
  return best
}

function chooseExpert(state: RoomGameState, bot: PlayerSlot, random: Random): BotMove {
  const wins = immediateWinningMoves(state, bot)
  if (wins.length > 0) return randomItem(wins, random)

  const ranked = rankedMoves(state, bot, random, true)
  if (ranked.length === 0) return legalBotMoves(state)[0]
  const fallback = ranked[0].move
  const deadline = Date.now() + SEARCH_DEADLINE_MS
  const nodes = { count: 0 }
  let bestMove = fallback
  let bestScore = Number.NEGATIVE_INFINITY
  let alpha = Number.NEGATIVE_INFINITY

  for (const candidate of ranked) {
    if (Date.now() > deadline || nodes.count > SEARCH_NODE_LIMIT) break
    const value = candidate.next.winResult?.winner === bot
      ? WIN_SCORE
      : searchValue(candidate.next, SEARCH_DEPTH - 1, bot, alpha, Number.POSITIVE_INFINITY, deadline, nodes)
    if (value > bestScore) {
      bestScore = value
      bestMove = candidate.move
    }
    alpha = Math.max(alpha, bestScore)
  }
  return bestMove
}

export function chooseBotMove(
  state: RoomGameState,
  difficulty: BotDifficulty,
  random: Random = Math.random,
): BotMove | null {
  const moves = legalBotMoves(state)
  if (moves.length === 0) return null
  const bot = state.currentPlayer
  if (difficulty === 'easy') {
    const wins = immediateWinningMoves(state, bot)
    if (wins.length > 0 && random() < 0.3) return randomItem(wins, random)
    return randomItem(moves, random)
  }
  if (difficulty === 'normal') return chooseNormal(state, bot, random)
  if (difficulty === 'hard') return chooseHard(state, bot, random)
  return chooseExpert(state, bot, random)
}
