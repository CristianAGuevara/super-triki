import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Board, LastMove, Piece, PieceEntrySource, Player, Size, WinResult, DragPayload } from '@/types/game'
import type { GameStateSnapshot, GameOverPayload } from '@/types/socket'
import { SIZE_ORDER } from '@/types/game'
import { getAllLines, emptyBoard } from '@/utils/boardUtils'
import { detectWin, detectDraw } from '@/composables/useWinDetection'
import { getSocket } from '@/services/socket'
import { useRoomStore } from '@/stores/roomStore'
import { useAudioStore } from '@/stores/audioStore'

const PIECES_PER_SIZE = 3

const DEFAULT_META: Record<number, { color: string; label: string; cssVar: string }> = {
  1: { color: '#ff2d55', label: 'Jugador 1', cssVar: '--player-1-color' },
  2: { color: '#00d9ff', label: 'Jugador 2', cssVar: '--player-2-color' },
  3: { color: '#ff2fb3', label: 'Jugador 3', cssVar: '--player-3-color' },
  4: { color: '#ffd21f', label: 'Jugador 4', cssVar: '--player-4-color' },
}

export const useGameStore = defineStore('game', () => {
  const board = ref<Board>(emptyBoard())
  const inventories = ref<Record<Player, Piece[]>>({})
  const currentPlayer = ref<Player>(1)
  const players = ref<Player[]>([1, 2])
  const playerMeta = ref(DEFAULT_META)
  const winResult = ref<WinResult | null>(null)
  const isDraw = ref(false)
  const dragState = ref<DragPayload | null>(null)
  const selectedPiece = ref<DragPayload | null>(null)
  const selectionHint = ref<string | null>(null)
  let selectionHintTimer: ReturnType<typeof setTimeout> | null = null
  const moveNumber = ref(0)
  const turnStartedAt = ref(Date.now())
  const hasServerState = ref(false)
  const lastMove = ref<LastMove | null>(null)
  const lastMoveSource = ref<PieceEntrySource | null>(null)
  const audioStore = useAudioStore()

  const lines = computed(() => getAllLines(3))

  const isGameOver = computed(() => winResult.value !== null || isDraw.value)

  const highlightedSlots = computed<Set<string>>(() => {
    if (!winResult.value) return new Set()
    return new Set(
      winResult.value.highlights.map(({ coord, size }) => `${coord[0]},${coord[1]},${size}`)
    )
  })

  function canDrop(row: number, col: number, size: Size): boolean {
    if (isGameOver.value) return false
    const activePiece = dragState.value ?? selectedPiece.value
    if (!activePiece) return false
    if (activePiece.player !== currentPlayer.value) return false
    if (activePiece.size !== size) return false
    const roomStore = useRoomStore()
    // In multiplayer: only accept drops from my own pieces.
    if (roomStore.roomId && (!roomStore.connected || roomStore.mySlot !== activePiece.player)) return false
    if (!inventories.value[activePiece.player]?.some(piece => piece.id === activePiece.pieceId)) return false
    return board.value[row]?.[col]?.[size] === null
  }

  function pieceAt(row: number, col: number, size: Size): Piece | null {
    return board.value[row][col][size]
  }

  function _buildInventory(player: Player): Piece[] {
    const pieces: Piece[] = []
    SIZE_ORDER.forEach(size => {
      for (let i = 0; i < PIECES_PER_SIZE; i++) {
        pieces.push({ id: `p${player}-${size}-${i}`, player, size })
      }
    })
    return pieces
  }

  function initGame(playerCount: number | Player[] = 2) {
    board.value = emptyBoard()
    const ps: Player[] = Array.isArray(playerCount)
      ? [...playerCount]
      : Array.from({ length: playerCount }, (_, i) => i + 1)
    players.value = ps
    const invs: Record<Player, Piece[]> = {}
    ps.forEach(p => { invs[p] = _buildInventory(p) })
    inventories.value = invs
    currentPlayer.value = ps[0] ?? 1
    winResult.value = null
    isDraw.value = false
    dragState.value = null
    selectedPiece.value = null
    clearSelectionHint()
    moveNumber.value = 0
    turnStartedAt.value = Date.now()
    hasServerState.value = false
    lastMove.value = null
    lastMoveSource.value = null
  }

  function resetGame() {
    initGame(players.value.length)
  }

  function placePiece(payload: {
    pieceId: string
    targetRow: number
    targetCol: number
    targetSize: Size
  }): boolean {
    const roomStore = useRoomStore()
    const { pieceId, targetRow, targetCol, targetSize } = payload

    if (isGameOver.value) return false
    if (!Number.isInteger(targetRow) || !Number.isInteger(targetCol) ||
        targetRow < 0 || targetRow >= board.value.length ||
        targetCol < 0 || targetCol >= board.value[targetRow].length ||
        !SIZE_ORDER.includes(targetSize)) return false
    if (board.value[targetRow][targetCol][targetSize] !== null) return false

    // ── Multiplayer path: emit to server, server broadcasts back ──
    if (roomStore.roomId) {
      if (!roomStore.connected) {
        roomStore.setError('Reconectando con la sala…')
        return false
      }
      getSocket().emit('game:move', {
        roomId:     roomStore.roomId,
        pieceId,
        targetRow,
        targetCol,
        targetSize,
      }, res => {
        if (!res.ok) roomStore.setError(res.error ?? 'Move rejected')
      })
      return true
    }

    // ── Solo path: original local logic ──────────────────────────
    const inv = inventories.value[currentPlayer.value]
    const idx = inv.findIndex(p => p.id === pieceId)
    if (idx === -1) return false

    const piece = inv[idx]
    if (piece.size !== targetSize) return false

    inv.splice(idx, 1)
    board.value[targetRow][targetCol][targetSize] = piece
    lastMove.value = {
      pieceId,
      player: piece.player,
      row: targetRow,
      col: targetCol,
      size: targetSize,
    }
    moveNumber.value++
    turnStartedAt.value = Date.now()
    audioStore.playSfx('move')

    const win = detectWin(board.value, lines.value, players.value)
    if (win) {
      winResult.value = win
      audioStore.playSfx('win')
      return true
    }

    if (detectDraw(board.value, inventories.value, players.value)) {
      isDraw.value = true
      audioStore.playSfx('draw')
      return true
    }

    _advanceTurn()
    return true
  }

  // ── Server state application ─────────────────────────────────

  function applyServerState(state: GameStateSnapshot): void {
    if (hasServerState.value && state.moveNumber > moveNumber.value) {
      audioStore.playSfx('move')
    }
    dragState.value     = null
    selectedPiece.value = null
    clearSelectionHint()
    board.value         = state.board
    inventories.value   = state.inventories as Record<Player, Piece[]>
    currentPlayer.value = state.currentPlayer
    moveNumber.value    = state.moveNumber
    turnStartedAt.value = state.turnStartedAt ?? Date.now()
    lastMove.value      = state.lastMove ?? null
    lastMoveSource.value = null
    const roomStore = useRoomStore()
    const observedMove = state.lastMove
    if (observedMove && roomStore.roomId && roomStore.mySlot !== observedMove.player) {
      const sourceElement = Array.from(document.querySelectorAll<HTMLElement>('[data-piece-id]'))
        .find(element => element.dataset.pieceId === observedMove.pieceId)
      if (sourceElement) {
        const rect = sourceElement.getBoundingClientRect()
        lastMoveSource.value = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }
      }
    }
    hasServerState.value = true
    if (state.players) players.value = state.players as Player[]
    winResult.value     = null
    isDraw.value        = false
  }

  function applyGameOver(result: GameOverPayload): void {
    applyServerState(result.finalState)
    if (result.winResult) {
      winResult.value = result.winResult
      audioStore.playSfx('win')
    } else {
      isDraw.value = true
      audioStore.playSfx('draw')
    }
  }

  function _advanceTurn() {
    const idx = players.value.indexOf(currentPlayer.value)
    for (let step = 1; step <= players.value.length; step++) {
      const candidate = players.value[(idx + step) % players.value.length]
      if ((inventories.value[candidate]?.length ?? 0) > 0) {
        currentPlayer.value = candidate
        return
      }
    }
    isDraw.value = true
  }

  function setDragState(payload: DragPayload | null) {
    dragState.value = payload
    if (payload) selectedPiece.value = null
  }

  function clearSelectionHint(): void {
    if (selectionHintTimer) {
      clearTimeout(selectionHintTimer)
      selectionHintTimer = null
    }
    selectionHint.value = null
  }

  function selectPiece(payload: DragPayload): void {
    const roomStore = useRoomStore()
    if (isGameOver.value) return
    if (payload.source !== 'inventory') return
    if (payload.player !== currentPlayer.value) return
    if (roomStore.roomId && (!roomStore.connected || roomStore.mySlot !== payload.player)) return
    if (!inventories.value[payload.player]?.some(piece => piece.id === payload.pieceId)) return

    clearSelectionHint()
    dragState.value = null
    selectedPiece.value = payload
    audioStore.playSfx('click')
    if (typeof navigator !== 'undefined') navigator.vibrate?.(12)
  }

  function rejectSelection(): void {
    clearSelectionHint()
    selectionHint.value = 'Esa casilla no está disponible.'
    selectionHintTimer = setTimeout(() => {
      selectionHint.value = null
      selectionHintTimer = null
    }, 1800)
  }

  function clearSelection(): void {
    selectedPiece.value = null
    clearSelectionHint()
  }

  // Initialize on store creation
  initGame(2)

  return {
    board,
    inventories,
    currentPlayer,
    players,
    playerMeta,
    winResult,
    isDraw,
    dragState,
    selectedPiece,
    selectionHint,
    lastMove,
    turnStartedAt,
    lastMoveSource,
    isGameOver,
    highlightedSlots,
    canDrop,
    pieceAt,
    initGame,
    resetGame,
    placePiece,
    setDragState,
    selectPiece,
    rejectSelection,
    clearSelection,
    applyServerState,
    applyGameOver,
  }
})
