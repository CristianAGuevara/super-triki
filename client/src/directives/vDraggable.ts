import type { Directive } from 'vue'
import type { DragPayload } from '@/types/game'
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'

function isDragAllowed(payload: DragPayload): boolean {
  const store     = useGameStore()
  const roomStore = useRoomStore()
  if (payload.source !== 'inventory') return false
  if (store.isGameOver) return false
  // In multiplayer: piece must be mine AND it must be my turn
  if (roomStore.roomId) {
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
  pointerId: number | null
  preview: HTMLElement | null
}

const states = new WeakMap<HTMLElement, DragState>()

export const vDraggable: Directive<HTMLElement, DragPayload> = {
  mounted(el, binding) {
    el.draggable = true
    el.style.touchAction = 'none'

    const state: DragState = {
      payload: binding.value,
      pointerId: null,
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
        el.classList.add('dragging')
        useGameStore().setDragState(state.payload)

        const preview = el.cloneNode(true) as HTMLElement
        preview.removeAttribute('draggable')
        preview.classList.add('drag-preview')
        preview.style.position = 'fixed'
        preview.style.left = `${event.clientX}px`
        preview.style.top = `${event.clientY}px`
        preview.style.width = `${el.getBoundingClientRect().width}px`
        preview.style.height = `${el.getBoundingClientRect().height}px`
        preview.style.margin = '0'
        preview.style.pointerEvents = 'none'
        preview.style.zIndex = '9999'
        preview.style.transform = 'translate(-50%, -50%) scale(1.08)'
        document.body.appendChild(preview)
        state.preview = preview

        document.addEventListener('pointermove', state.onPointerMove, { passive: false })
        document.addEventListener('pointerup', state.onPointerUp)
        document.addEventListener('pointercancel', state.onPointerUp)
      },
      onPointerMove: event => {
        if (state.pointerId !== event.pointerId) return
        event.preventDefault()
        if (state.preview) {
          state.preview.style.left = `${event.clientX}px`
          state.preview.style.top = `${event.clientY}px`
        }
      },
      onPointerUp: event => {
        if (state.pointerId !== event.pointerId) return

        const target = document.elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>('[data-board-cell]')
        if (target) {
          const row = Number(target.dataset.row)
          const col = Number(target.dataset.col)
          if (Number.isInteger(row) && Number.isInteger(col)) {
            useGameStore().placePiece({
              pieceId: state.payload.pieceId,
              targetRow: row,
              targetCol: col,
              targetSize: state.payload.size,
            })
          }
        }

        document.removeEventListener('pointermove', state.onPointerMove)
        document.removeEventListener('pointerup', state.onPointerUp)
        document.removeEventListener('pointercancel', state.onPointerUp)
        state.preview?.remove()
        state.preview = null
        state.pointerId = null
        el.classList.remove('dragging')
        useGameStore().setDragState(null)
      },
    }

    states.set(el, state)
    el.addEventListener('dragstart', state.onDragStart)
    el.addEventListener('dragend', state.onDragEnd)
    el.addEventListener('pointerdown', state.onPointerDown)
  },

  updated(el, binding) {
    const state = states.get(el)
    if (state) state.payload = binding.value
  },

  beforeUnmount(el) {
    const state = states.get(el)
    if (!state) return
    el.removeEventListener('dragstart', state.onDragStart)
    el.removeEventListener('dragend', state.onDragEnd)
    el.removeEventListener('pointerdown', state.onPointerDown)
    document.removeEventListener('pointermove', state.onPointerMove)
    document.removeEventListener('pointerup', state.onPointerUp)
    document.removeEventListener('pointercancel', state.onPointerUp)
    state.preview?.remove()
    states.delete(el)
  },
}
