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
}

const states = new WeakMap<HTMLElement, DragState>()

export const vDraggable: Directive<HTMLElement, DragPayload> = {
  mounted(el, binding) {
    el.draggable = true

    const state: DragState = {
      payload: binding.value,
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
    }

    states.set(el, state)
    el.addEventListener('dragstart', state.onDragStart)
    el.addEventListener('dragend', state.onDragEnd)
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
    states.delete(el)
  },
}
