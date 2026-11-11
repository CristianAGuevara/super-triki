<template>
  <section v-if="roomStore.mySlot" class="tv-controls" aria-label="Control de fichas para TV">
    <div class="tv-controls__status">
      <span class="tv-controls__eyebrow">Control TV</span>
      <strong>{{ isMyTurn ? 'Tu turno' : waitingLabel }}</strong>
    </div>

    <div v-if="isMyTurn" class="tv-controls__pieces">
      <button
        v-for="option in availableSizes"
        :key="option.size"
        type="button"
        class="tv-controls__piece"
        :class="{
          'tv-controls__piece--selected': selectedSize === option.size,
          'tv-controls__piece--large': option.size === 'large',
          'tv-controls__piece--medium': option.size === 'medium',
          'tv-controls__piece--small': option.size === 'small',
        }"
        :aria-pressed="selectedSize === option.size"
        @click="selectPiece(option.size)"
      >
        <span class="tv-controls__piece-dot" />
        <span>{{ option.label }}</span>
        <small>×{{ option.count }}</small>
      </button>

      <button
        v-if="selectedSize"
        type="button"
        class="tv-controls__cancel"
        @click="store.clearSelection()"
      >
        Cancelar
      </button>
    </div>

    <p v-else class="tv-controls__note">
      Espera tu turno para elegir una ficha.
    </p>

    <p class="tv-controls__hint">
      {{ !isMyTurn
        ? 'Podrás elegir una ficha cuando llegue tu turno.'
        : selectedSize
          ? 'Mueve el foco al tablero y pulsa OK en la casilla.'
          : 'Elige una ficha y después una casilla del tablero.' }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Size } from '@/types/game'
import { SIZE_ORDER } from '@/types/game'
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'

const store = useGameStore()
const roomStore = useRoomStore()

const SIZE_LABELS: Record<Size, string> = {
  large: 'Grande',
  medium: 'Mediana',
  small: 'Pequeña',
}

const isMyTurn = computed(() =>
  !store.isGameOver &&
  roomStore.mySlot !== null &&
  store.currentPlayer === roomStore.mySlot
)

const currentPlayerName = computed(() =>
  roomStore.players.find(player => player.slot === store.currentPlayer)?.username
    ?? `Jugador ${store.currentPlayer}`
)
const waitingLabel = computed(() => `Turno de ${currentPlayerName.value}`)
const selectedSize = computed(() => store.selectedPiece?.size ?? null)

const availableSizes = computed(() => {
  const slot = roomStore.mySlot
  if (!slot) return []
  const inventory = store.inventories[slot] ?? []
  return SIZE_ORDER.flatMap(size => {
    const pieces = inventory.filter(piece => piece.size === size)
    if (pieces.length === 0) return []
    return [{
      size,
      label: SIZE_LABELS[size],
      count: pieces.length,
      pieceId: pieces[0].id,
    }]
  })
})

function selectPiece(size: Size) {
  const slot = roomStore.mySlot
  const piece = availableSizes.value.find(option => option.size === size)
  if (!slot || !piece) return
  store.selectPiece({
    pieceId: piece.pieceId,
    player: slot,
    size,
    source: 'inventory',
  })
}
</script>

<style scoped>
.tv-controls {
  display: flex;
  width: min(100%, 700px);
  align-items: center;
  justify-content: space-between;
  gap: 12px 18px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border: 1px solid var(--line-soft);
  border-radius: 14px;
  background: var(--surface-muted);
}

.tv-controls__status {
  display: flex;
  min-width: 120px;
  flex-direction: column;
  gap: 2px;
}

.tv-controls__eyebrow {
  color: var(--accent-primary);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.tv-controls__status strong {
  color: var(--text-primary);
  font-size: 14px;
}

.tv-controls__pieces {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.tv-controls__piece,
.tv-controls__cancel {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  gap: 7px;
  padding: 7px 11px;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  background: var(--cell-bg);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.tv-controls__piece small {
  color: var(--text-muted);
  font-size: 10px;
}

.tv-controls__piece-dot {
  width: 14px;
  height: 14px;
  border: 3px solid var(--accent-primary);
  border-radius: 50%;
  box-shadow: 0 0 7px var(--accent-primary);
}

.tv-controls__piece--large .tv-controls__piece-dot { width: 18px; height: 18px; border-width: 4px; }
.tv-controls__piece--medium .tv-controls__piece-dot { width: 14px; height: 14px; border-width: 3px; }
.tv-controls__piece--small .tv-controls__piece-dot { width: 9px; height: 9px; border-width: 0; background: var(--accent-primary); }

.tv-controls__piece--selected,
.tv-controls__piece:hover,
.tv-controls__cancel:hover {
  border-color: var(--accent-primary);
  background: var(--control-hover);
  color: var(--text-primary);
}

.tv-controls__cancel {
  border-color: var(--accent-secondary);
  color: var(--accent-secondary);
}

.tv-controls__note,
.tv-controls__hint {
  color: var(--text-muted);
  font-size: 10px;
}

.tv-controls__hint {
  flex: 1 1 100%;
  padding-top: 2px;
  border-top: 1px solid var(--line-soft);
}

@media (max-width: 700px) {
  .tv-controls {
    align-items: flex-start;
    padding: 10px 12px;
  }

  .tv-controls__pieces {
    width: 100%;
  }
}
</style>
