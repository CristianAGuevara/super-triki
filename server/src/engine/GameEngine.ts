import type { Board, LastMove, Piece, PlayerSlot } from '../types/game.js'
import type { GameMovePayload } from '../types/socket.js'
import { SIZE_ORDER } from '../types/game.js'
import { emptyBoard, getAllLines } from './boardUtils.js'
import { detectWin, detectDraw } from './winDetection.js'

const PIECES_PER_SIZE = 3
const LINES = getAllLines(3)

export interface RoomGameState {
  board:         Board
  inventories:   Record<PlayerSlot, Piece[]>
  currentPlayer: PlayerSlot
  moveNumber:    number
  winResult:     ReturnType<typeof detectWin>
  isDraw:        boolean
  players:       PlayerSlot[]
  lastMove:      LastMove | null
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

export function buildInitialGameState(playerCount: number | PlayerSlot[], startingPlayer: PlayerSlot = 1): RoomGameState {
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
    winResult:     null,
    isDraw:        false,
    players,
    lastMove:      null,
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
  const isDraw = !winResult && detectDraw(newBoard)

  const currentIdx = state.players.indexOf(actingSlot)
  const nextPlayer = state.players[(currentIdx + 1) % state.players.length]

  return {
    board:         newBoard,
    inventories:   newInventories,
    currentPlayer: winResult || isDraw ? actingSlot : nextPlayer,
    moveNumber:    state.moveNumber + 1,
    winResult,
    isDraw,
    players:       state.players,
    lastMove: {
      pieceId,
      player: piece.player,
      row: targetRow,
      col: targetCol,
      size: targetSize,
    },
  }
}

export function toSnapshot(state: RoomGameState) {
  return {
    board:         state.board,
    inventories:   state.inventories,
    currentPlayer: state.currentPlayer,
    moveNumber:    state.moveNumber,
    players:       state.players,
    lastMove:      state.lastMove,
  }
}
