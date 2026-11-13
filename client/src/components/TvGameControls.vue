<template>
  <section
    v-if="roomStore.mySlot"
    class="tv-controls"
    aria-label="Control de fichas para TV"
    :style="{ '--piece-color': store.playerMeta[roomStore.mySlot]?.color }"
  >
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
        <span class="tv-controls__piece-dot st-ring" :class="`st-ring--${option.size}`" />
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
  padding: 14px 16px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-m);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.tv-controls__status {
  display: flex;
  min-width: 120px;
  flex-direction: column;
  gap: 2px;
}

.tv-controls__eyebrow {
  color: var(--accent-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.tv-controls__status strong {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 18px;
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
  min-height: 48px;
  align-items: center;
  gap: 9px;
  padding: 8px 14px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--cell-bg);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 15px;
  font-weight: 700;
}

.tv-controls__piece small {
  color: var(--text-muted);
  font-size: 10px;
}

.tv-controls__piece-dot { flex-shrink: 0; }
.tv-controls__piece--large .tv-controls__piece-dot { width: 26px; height: 26px; }
.tv-controls__piece--medium .tv-controls__piece-dot { width: 18px; height: 18px; }
.tv-controls__piece--small .tv-controls__piece-dot { width: 10px; height: 10px; }

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
  font-size: 13px;
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
