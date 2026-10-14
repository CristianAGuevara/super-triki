import type { Board, GameSettings, LastMove, Piece, PlayerSlot } from '../types/game.js'
import type { GameMovePayload } from '../types/socket.js'
import { DEFAULT_GAME_SETTINGS, SIZE_ORDER } from '../types/game.js'
import { emptyBoard, getAllLines } from './boardUtils.js'
import { detectWin, detectDraw } from './winDetection.js'

const PIECES_PER_SIZE = 3
const LINES = getAllLines(3)
export const TURN_DURATION_MS = 90_000

export interface RoomGameState {
  board:         Board
  inventories:   Record<PlayerSlot, Piece[]>
  currentPlayer: PlayerSlot
  moveNumber:    number
  turnNumber:    number
  turnStartedAt: number
  winResult:     ReturnType<typeof detectWin>
  isDraw:        boolean
  players:       PlayerSlot[]
  lastMove:      LastMove | null
  settings:      GameSettings
}

function buildInventory(slot: PlayerSlot): Piece[] {
  const pieces: Piece[] = []
  SIZE_ORDER.forEach(size => {
    for (let i = 0; i < PIECES_PER_SIZE; i++) {
      pieces.push({ id: `p${slot}-${size}-${i}`, player: slot, size })
    }
  })
  return pieces
}

export function buildInitialGameState(
  playerCount: number | PlayerSlot[],
  startingPlayer: PlayerSlot = 1,
  settings: GameSettings = DEFAULT_GAME_SETTINGS,
): RoomGameState {
  const players = Array.isArray(playerCount)
    ? [...playerCount]
    : Array.from({ length: playerCount }, (_, i) => (i + 1) as PlayerSlot)
  const inventories = Object.fromEntries(
    players.map(slot => [slot, buildInventory(slot)])
  ) as Record<PlayerSlot, Piece[]>

  return {
    board:         emptyBoard() as Board,
    inventories,
    currentPlayer: players.includes(startingPlayer) ? startingPlayer : (players[0] ?? 1),
    moveNumber:    0,
    turnNumber:    0,
    turnStartedAt: Date.now(),
    winResult:     null,
    isDraw:        false,
    players,
    lastMove:      null,
    settings:      { ...settings },
  }
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

export function validateMove(
  state: RoomGameState,
  move: GameMovePayload,
  actingSlot: PlayerSlot,
): ValidationResult {
  if (state.winResult || state.isDraw)
    return { valid: false, reason: 'Game is already over' }

  if (actingSlot !== state.currentPlayer)
    return { valid: false, reason: 'Not your turn' }

  const { targetRow, targetCol, targetSize, pieceId } = move

  if (!Number.isInteger(targetRow) || !Number.isInteger(targetCol) ||
      targetRow < 0 || targetRow > 2 || targetCol < 0 || targetCol > 2)
    return { valid: false, reason: 'Out of bounds' }

  if (!SIZE_ORDER.includes(targetSize) || typeof pieceId !== 'string' || !pieceId)
    return { valid: false, reason: 'Invalid move' }

  const inv = state.inventories[actingSlot]
  if (!inv)
    return { valid: false, reason: 'Player is not in this game' }

  const piece = inv.find(p => p.id === pieceId)
  if (!piece)
    return { valid: false, reason: 'Piece not in inventory' }

  if (piece.size !== targetSize)
    return { valid: false, reason: 'Piece size mismatch' }

  if (state.board[targetRow][targetCol][targetSize] !== null)
    return { valid: false, reason: 'Slot already occupied' }

  return { valid: true }
}

export function applyMove(
  state: RoomGameState,
  move: GameMovePayload,
): RoomGameState {
  const { pieceId, targetRow, targetCol, targetSize } = move
  const actingSlot = state.currentPlayer

  // Deep-copy inventories
  const newInventories = Object.fromEntries(
    state.players.map(slot => [slot, [...state.inventories[slot]]])
  ) as Record<PlayerSlot, Piece[]>
  const pieceIdx = newInventories[actingSlot].findIndex(p => p.id === pieceId)
  const [piece] = newInventories[actingSlot].splice(pieceIdx, 1)

  // Deep-copy board
  const newBoard: Board = state.board.map(row =>
    row.map(cell => ({ ...cell }))
  )
  newBoard[targetRow][targetCol] = {
    ...newBoard[targetRow][targetCol],
    [targetSize]: piece,
  }

  const winResult = detectWin(newBoard, LINES, state.players)
  const isDraw = !winResult && detectDraw(newBoard, newInventories, state.players)

  let nextPlayer = actingSlot
  let turnSteps = 1
  if (!winResult && !isDraw) {
    const currentIdx = state.players.indexOf(actingSlot)
    for (let step = 1; step <= state.players.length; step++) {
      const candidate = state.players[(currentIdx + step) % state.players.length]
      if ((newInventories[candidate]?.length ?? 0) > 0) {
        nextPlayer = candidate
        turnSteps = step
        break
      }
    }
  }

  return {
    board:         newBoard,
    inventories:   newInventories,
    currentPlayer: winResult || isDraw ? actingSlot : nextPlayer,
    moveNumber:    state.moveNumber + 1,
    turnNumber:    state.turnNumber + turnSteps,
    turnStartedAt: Date.now(),
    winResult,
    isDraw,
    players:       state.players,
    settings:      state.settings,
    lastMove: {
      pieceId,
      player: piece.player,
      row: targetRow,
      col: targetCol,
      size: targetSize,
    },
  }
}

export function skipTurn(state: RoomGameState, now = Date.now()): RoomGameState {
  if (state.winResult || state.isDraw || state.players.length < 2) return state
  const inventories = Object.fromEntries(
    state.players.map(slot => [slot, [...(state.inventories[slot] ?? [])]])
  ) as Record<PlayerSlot, Piece[]>

  if (state.settings.turnTimerEnabled && state.settings.removePieceOnTimeout) {
    const pieces = inventories[state.currentPlayer]
    const penaltyIndex = pieces.findIndex(piece => piece.size === 'small')
    if (penaltyIndex >= 0) pieces.splice(penaltyIndex, 1)
    else if (pieces.length > 0) pieces.pop()
  }

  const isDraw = detectDraw(state.board, inventories, state.players)
  const currentIdx = state.players.indexOf(state.currentPlayer)
  let nextPlayer = state.currentPlayer
  let turnSteps = 1
  if (!isDraw) {
    for (let step = 1; step <= state.players.length; step++) {
      const candidate = state.players[(currentIdx + step) % state.players.length]
      if ((inventories[candidate]?.length ?? 0) > 0) {
        nextPlayer = candidate
        turnSteps = step
        break
      }
    }
  }

  return {
    ...state,
    inventories,
    currentPlayer: nextPlayer,
    turnNumber: state.turnNumber + turnSteps,
    turnStartedAt: now,
    isDraw,
  }
}

export function toSnapshot(state: RoomGameState) {
  return {
    board:         state.board,
    inventories:   state.inventories,
    currentPlayer: state.currentPlayer,
    moveNumber:    state.moveNumber,
    turnNumber:    state.turnNumber,
    turnStartedAt: state.turnStartedAt,
    players:       state.players,
    lastMove:      state.lastMove,
  }
}
