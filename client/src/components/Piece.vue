<template>
  <div
    v-draggable="dragPayload"
    class="piece"
    :class="[`piece--${piece.size}`, `piece--player${piece.player}`, { 'piece--inventory': inInventory }]"
    :title="`${sizeName} (J${piece.player})`"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Piece, DragPayload } from '@/types/game'
import { vDraggable } from '@/directives/vDraggable'

const props = defineProps<{
  piece: Piece
  inInventory?: boolean
}>()

const dragPayload = computed<DragPayload>(() => ({
  pieceId: props.piece.id,
  player: props.piece.player,
  size: props.piece.size,
  source: props.inInventory === false ? 'board' : 'inventory',
}))

const sizeName = computed(() => {
  const names = { large: 'Grande', medium: 'Mediana', small: 'Pequeña' }
  return names[props.piece.size]
})
</script>

<style scoped>
.piece {
  border-radius: 50%;
  border-style: solid;
  cursor: grab;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  flex-shrink: 0;
  box-sizing: border-box;
}

.piece:hover {
  transform: scale(1.1);
}

.piece.dragging {
  opacity: 0.4;
  cursor: grabbing;
}

.piece--last-move {
  animation: piece-arrive 0.55s cubic-bezier(0.2, 0.85, 0.3, 1.2) both;
}

@keyframes piece-arrive {
  from {
    opacity: 0.1;
    transform: translateY(-34px) scale(0.35) rotate(-18deg);
  }
  70% { transform: translateY(3px) scale(1.08) rotate(3deg); }
  to {
    opacity: 1;
    transform: translateY(0) scale(1) rotate(0);
  }
}

/* Sizes — hollow ring style. Border widths scale with size */
.piece--large  { width: var(--size-large);  height: var(--size-large);  border-width: 7px; }
.piece--medium { width: var(--size-medium); height: var(--size-medium); border-width: 5px; }
.piece--small  { width: var(--size-small);  height: var(--size-small);  border-width: 4px; }

/* Player colors */
.piece--player1 { border-color: var(--player-1-color); box-shadow: 0 0 6px var(--player-1-color); }
.piece--player2 { border-color: var(--player-2-color); box-shadow: 0 0 6px var(--player-2-color); }
.piece--player3 { border-color: var(--player-3-color); box-shadow: 0 0 6px var(--player-3-color); }
.piece--player4 { border-color: var(--player-4-color); box-shadow: 0 0 6px var(--player-4-color); }
</style>
