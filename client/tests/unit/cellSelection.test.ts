import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import Cell from '@/components/Cell.vue'
import { useGameStore } from '@/stores/gameStore'

describe('tapping a selected piece onto a cell', () => {
  it('places the selected piece when the target slot is valid', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useGameStore()
    store.initGame(2)

    const piece = store.inventories[1].find(item => item.size === 'medium')!
    store.selectPiece({ pieceId: piece.id, player: 1, size: 'medium', source: 'inventory' })

    const wrapper = mount(Cell, {
      props: { row: 0, col: 0 },
      global: { plugins: [pinia] },
    })

    await wrapper.trigger('click')

    expect(store.board[0][0].medium?.id).toBe(piece.id)
    expect(store.selectedPiece).toBeNull()
  })
})
