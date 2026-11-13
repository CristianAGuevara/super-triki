import { onMounted, onUnmounted } from 'vue'
import type { Size } from '@/types/game'
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'

const KEY_SIZES: Record<string, Size> = {
  '1': 'large',
  '2': 'medium',
  '3': 'small',
  g: 'large',
  m: 'medium',
  p: 'small',
}

/**
 * Desktop shortcuts during a match:
 * 1 / G = grande, 2 / M = mediana, 3 / P = pequeña, Esc = cancelar.
 */
export function useGameShortcuts(enabled: () => boolean = () => true) {
  const store = useGameStore()
  const roomStore = useRoomStore()

  function onKeyDown(event: KeyboardEvent) {
    if (!enabled() || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return

    if (event.key === 'Escape' && store.selectedPiece) {
      store.clearSelection()
      return
    }

    const size = KEY_SIZES[event.key.toLowerCase()]
    if (!size) return
    const slot = roomStore.roomId ? roomStore.mySlot : store.currentPlayer
    if (!slot || store.isGameOver || store.currentPlayer !== slot) return
    if (roomStore.roomId && (!roomStore.connected || roomStore.isSpectator)) return

    event.preventDefault()
    store.selectSize(slot, size)
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
}
