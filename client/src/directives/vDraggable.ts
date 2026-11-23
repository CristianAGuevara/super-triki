import type { Directive } from 'vue'
import type { DragPayload } from '@/types/game'
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'

const DRAG_THRESHOLD_PX = 16

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
  onClick: (event: MouseEvent) => void
  lastPointerType: string | null
  pointerId: number | null
  startX: number
  startY: number
  previewX: number
  previewY: number
  previewWidth: number
  previewHeight: number
  previewFrame: number | null
  dragging: boolean
  preview: HTMLElement | null
}

const states = new WeakMap<HTMLElement, DragState>()

function syncDraggable(el: HTMLElement, payload: DragPayload): void {
  const allowed = isDragAllowed(payload)
  el.draggable = allowed
  el.style.touchAction = allowed ? 'none' : 'auto'
}

function previewTransform(x: number, y: number): string {
  return `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(1.08)`
}

function createPreview(
  el: HTMLElement,
  event: PointerEvent,
  width: number,
  height: number,
): HTMLElement {
  const previewSource = el.querySelector<HTMLElement>('[data-drag-preview]') ?? el
  const preview = previewSource.cloneNode(true) as HTMLElement
  preview.removeAttribute('draggable')
  preview.classList.add('drag-preview')
  preview.style.position = 'fixed'
  preview.style.left = '0'
  preview.style.top = '0'
  preview.style.width = `${width}px`
  preview.style.height = `${height}px`
  preview.style.margin = '0'
  preview.style.pointerEvents = 'none'
  preview.style.zIndex = '9999'
  preview.style.boxSizing = 'border-box'
  preview.style.border = `${Math.max(3, Math.round(Math.min(width, height) * 0.13))}px solid var(--ring-color)`
  preview.style.boxShadow = '0 0 16px -2px var(--ring-color), 0 8px 18px rgba(0, 0, 0, 0.4)'
  preview.style.transform = previewTransform(event.clientX, event.clientY)
  document.body.appendChild(preview)
  return preview
}

/** Coalesce pointer events into one compositor-friendly transform per frame. */
function schedulePreviewPosition(state: DragState): void {
  if (state.previewFrame !== null) return
  state.previewFrame = requestAnimationFrame(() => {
    state.previewFrame = null
    if (!state.preview) return
    state.preview.style.transform = previewTransform(state.previewX, state.previewY)
  })
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
  if (state.previewFrame !== null) cancelAnimationFrame(state.previewFrame)
  state.previewFrame = null
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
      lastPointerType: null,
      pointerId: null,
      startX: 0,
      startY: 0,
      previewX: 0,
      previewY: 0,
      previewWidth: 0,
      previewHeight: 0,
      previewFrame: null,
      dragging: false,
      preview: null,
      onDragStart: event => {
        const e = event as DragEvent
        if (!isDragAllowed(state.payload)) {
          e.preventDefault()
          return
        }
        e.dataTransfer?.setData('application/json', JSON.stringify(state.payload))
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move'
          const dragImage = el.querySelector<HTMLElement>('[data-drag-preview]')
          if (dragImage) {
            const rect = dragImage.getBoundingClientRect()
            e.dataTransfer.setDragImage(dragImage, rect.width / 2, rect.height / 2)
          }
        }
        requestAnimationFrame(() => el.classList.add('dragging'))
        useGameStore().setDragState(state.payload)
      },
      onDragEnd: () => {
        el.classList.remove('dragging')
        useGameStore().setDragState(null)
      },
      onPointerDown: event => {
        state.lastPointerType = event.pointerType
        if (event.pointerType === 'mouse' || !isDragAllowed(state.payload)) return

        event.preventDefault()
        state.pointerId = event.pointerId
        state.startX = event.clientX
        state.startY = event.clientY
        state.dragging = false
        const previewSource = el.querySelector<HTMLElement>('[data-drag-preview]') ?? el
        const bounds = previewSource.getBoundingClientRect()
        state.previewWidth = bounds.width
        state.previewHeight = bounds.height
        // Build the ghost while the finger is still stationary. It stays
        // invisible until the drag threshold is crossed, so the first frame
        // of the gesture does not pay for cloning and layer creation.
        state.preview = createPreview(el, event, state.previewWidth, state.previewHeight)
        state.preview.style.opacity = '0'

        document.addEventListener('pointermove', state.onPointerMove, { passive: false })
        document.addEventListener('pointerup', state.onPointerUp)
        document.addEventListener('pointercancel', state.onPointerCancel)
      },
      onPointerMove: event => {
        if (state.pointerId !== event.pointerId) return

        state.previewX = event.clientX
        state.previewY = event.clientY
        if (!state.dragging) {
          const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY)
          if (distance < DRAG_THRESHOLD_PX) return

          state.dragging = true
          el.classList.add('dragging')
          useGameStore().setDragState(state.payload)
          if (!state.preview) {
            state.preview = createPreview(el, event, state.previewWidth, state.previewHeight)
          }
          state.preview.style.opacity = '1'
        }

        event.preventDefault()
        schedulePreviewPosition(state)
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
        } else if (!binding.modifiers.dragOnly) {
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
      // Mouse: a plain click (no drag) selects the piece, like a tap.
      // dragOnly targets own their tap/click handling to avoid double toggles.
      onClick: event => {
        if (binding.modifiers.dragOnly) return
        if (state.lastPointerType !== 'mouse' || !isDragAllowed(state.payload)) return
        const store = useGameStore()
        const payload = resolveTapPayload(el, state.payload, event.clientX, event.clientY)
        if (store.selectedPiece?.pieceId === payload.pieceId) store.clearSelection()
        else store.selectPiece(payload)
      },
    }

    states.set(el, state)
    el.addEventListener('dragstart', state.onDragStart)
    el.addEventListener('dragend', state.onDragEnd)
    el.addEventListener('pointerdown', state.onPointerDown)
    el.addEventListener('click', state.onClick)
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
    el.removeEventListener('click', state.onClick)
    cleanupPointerDrag(el, state)
    states.delete(el)
  },
}
