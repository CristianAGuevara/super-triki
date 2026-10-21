import type { Directive } from 'vue'
import type { DragPayload } from '@/types/game'
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'

const DRAG_THRESHOLD_PX = 8

function isDragAllowed(payload: DragPayload): boolean {
  const store     = useGameStore()
  const roomStore = useRoomStore()
  if (payload.source !== 'inventory') return false
  if (store.isGameOver) return false
  // In multiplayer: piece must be mine AND it must be my turn
  if (roomStore.roomId) {
    if (!roomStore.connected) return false
    return roomStore.mySlot === payload.player && store.currentPlayer === payload.player
  }
  // Solo: only current player can drag their own pieces
  return store.currentPlayer === payload.player
}

interface DragState {
  payload: DragPayload
  onDragStart: (event: Event) => void
  onDragEnd: () => void
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
  onPointerCancel: (event: PointerEvent) => void
  pointerId: number | null
  startX: number
  startY: number
  dragging: boolean
  preview: HTMLElement | null
}

const states = new WeakMap<HTMLElement, DragState>()

function syncDraggable(el: HTMLElement, payload: DragPayload): void {
  const allowed = isDragAllowed(payload)
  el.draggable = allowed
  el.style.touchAction = allowed ? 'none' : 'auto'
}

function createPreview(el: HTMLElement, event: PointerEvent): HTMLElement {
  const bounds = el.getBoundingClientRect()
  const preview = el.cloneNode(true) as HTMLElement
  preview.removeAttribute('draggable')
  preview.classList.add('drag-preview')
  preview.style.position = 'fixed'
  preview.style.left = `${event.clientX}px`
  preview.style.top = `${event.clientY}px`
  preview.style.width = `${bounds.width}px`
  preview.style.height = `${bounds.height}px`
  preview.style.margin = '0'
  preview.style.pointerEvents = 'none'
  preview.style.zIndex = '9999'
  preview.style.transform = 'translate(-50%, -50%) scale(1.08)'
  document.body.appendChild(preview)
  return preview
}

function resolveTapPayload(
  el: HTMLElement,
  payload: DragPayload,
  clientX: number,
  clientY: number,
): DragPayload {
  if (payload.setIndex === undefined) return payload

  const stack = el.closest<HTMLElement>('.player-panel__stack')
  if (!stack) return payload

  const store = useGameStore()
  const inventory = store.inventories[payload.player] ?? []
  const stackBounds = stack.getBoundingClientRect()
  const centerX = stackBounds.left + stackBounds.width / 2
  const centerY = stackBounds.top + stackBounds.height / 2
  const distance = Math.hypot(clientX - centerX, clientY - centerY)

  const candidates = (['large', 'medium', 'small'] as const).flatMap(size => {
    const piece = inventory.filter(item => item.size === size)[payload.setIndex!]
    const ring = stack.querySelector<HTMLElement>(`.stack-ring--${size}`)
    if (!piece || !ring) return []

    const radius = ring.getBoundingClientRect().width / 2
    return [{ payload: { ...payload, pieceId: piece.id, size }, radius }]
  })

  return candidates.sort((a, b) =>
    Math.abs(distance - a.radius) - Math.abs(distance - b.radius)
  )[0]?.payload ?? payload
}

function cleanupPointerDrag(el: HTMLElement, state: DragState): void {
  document.removeEventListener('pointermove', state.onPointerMove)
  document.removeEventListener('pointerup', state.onPointerUp)
  document.removeEventListener('pointercancel', state.onPointerCancel)
  state.preview?.remove()
  state.preview = null
  state.pointerId = null
  state.dragging = false
  el.classList.remove('dragging')
  useGameStore().setDragState(null)
}

export const vDraggable: Directive<HTMLElement, DragPayload> = {
  mounted(el, binding) {
    syncDraggable(el, binding.value)

    const state: DragState = {
      payload: binding.value,
      pointerId: null,
      startX: 0,
      startY: 0,
      dragging: false,
      preview: null,
      onDragStart: event => {
        const e = event as DragEvent
        if (!isDragAllowed(state.payload)) {
          e.preventDefault()
          return
        }
        e.dataTransfer?.setData('application/json', JSON.stringify(state.payload))
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
        requestAnimationFrame(() => el.classList.add('dragging'))
        useGameStore().setDragState(state.payload)
      },
      onDragEnd: () => {
        el.classList.remove('dragging')
        useGameStore().setDragState(null)
      },
      onPointerDown: event => {
        if (event.pointerType === 'mouse' || !isDragAllowed(state.payload)) return

        event.preventDefault()
        state.pointerId = event.pointerId
        state.startX = event.clientX
        state.startY = event.clientY
        state.dragging = false

        document.addEventListener('pointermove', state.onPointerMove, { passive: false })
        document.addEventListener('pointerup', state.onPointerUp)
        document.addEventListener('pointercancel', state.onPointerCancel)
      },
      onPointerMove: event => {
        if (state.pointerId !== event.pointerId) return

        if (!state.dragging) {
          const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY)
          if (distance < DRAG_THRESHOLD_PX) return

          state.dragging = true
          el.classList.add('dragging')
          useGameStore().setDragState(state.payload)
          state.preview = createPreview(el, event)
        }

        event.preventDefault()
        if (state.preview) {
          state.preview.style.left = `${event.clientX}px`
          state.preview.style.top = `${event.clientY}px`
        }
      },
      onPointerUp: event => {
        if (state.pointerId !== event.pointerId) return

        if (state.dragging) {
          const target = document.elementFromPoint(event.clientX, event.clientY)
            ?.closest<HTMLElement>('[data-board-cell]')
          const store = useGameStore()
          if (target) {
            const row = Number(target.dataset.row)
            const col = Number(target.dataset.col)
            if (Number.isInteger(row) && Number.isInteger(col) &&
                store.canDrop(row, col, state.payload.size)) {
              store.placePiece({
                pieceId: state.payload.pieceId,
                targetRow: row,
                targetCol: col,
                targetSize: state.payload.size,
              })
              if (typeof navigator !== 'undefined') navigator.vibrate?.(10)
            }
          }
        } else {
          const store = useGameStore()
          const payload = resolveTapPayload(el, state.payload, event.clientX, event.clientY)
          if (store.selectedPiece?.pieceId === payload.pieceId) {
            store.clearSelection()
          } else {
            store.selectPiece(payload)
          }
        }

        cleanupPointerDrag(el, state)
      },
      onPointerCancel: event => {
        if (state.pointerId !== event.pointerId) return
        cleanupPointerDrag(el, state)
      },
    }

    states.set(el, state)
    el.addEventListener('dragstart', state.onDragStart)
    el.addEventListener('dragend', state.onDragEnd)
    el.addEventListener('pointerdown', state.onPointerDown)
  },

  updated(el, binding) {
    syncDraggable(el, binding.value)
    const state = states.get(el)
    if (state) state.payload = binding.value
  },

  beforeUnmount(el) {
    const state = states.get(el)
    if (!state) return
    el.removeEventListener('dragstart', state.onDragStart)
    el.removeEventListener('dragend', state.onDragEnd)
    el.removeEventListener('pointerdown', state.onPointerDown)
    cleanupPointerDrag(el, state)
    states.delete(el)
  },
}
