<template>
  <div
    class="cell"
    data-board-cell
    :data-row="row"
    :data-col="col"
    :class="{
      'cell--can-drop': canDropAny,
      'cell--hover': isHovered,
    }"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @dragenter="handleDragEnter"
    @drop="handleDrop"
  >
    <div class="cell__stack">
      <!-- Rendered large→medium→small so large is painted first (back), small on top -->
      <div
        v-for="size in SIZE_ORDER"
        :key="size"
        class="cell__ring"
        :class="[
          `cell__ring--${size}`,
          {
            'cell__ring--win':   isHighlighted(size),
            'cell__ring--hover': isHovered && hoveredSize === size && !store.pieceAt(row, col, size),
          }
        ]"
      >
        <Piece
          v-if="store.pieceAt(row, col, size)"
          :piece="store.pieceAt(row, col, size)!"
          :in-inventory="false"
          :highlight-last-move="isLastMove(size)"
          :animate-entry="shouldAnimateLastMove(size)"
          :entry-from="store.lastMoveSource"
        />
        <!-- Empty placeholder circle -->
        <div v-else class="cell__ring-empty" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Size } from '@/types/game'
import { SIZE_ORDER } from '@/types/game'
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'
import { useDragDrop } from '@/composables/useDragDrop'
import Piece from './Piece.vue'

const props = defineProps<{
  row: number
  col: number
}>()

const store = useGameStore()
const roomStore = useRoomStore()
const { onDragOver, onDrop } = useDragDrop(props.row, props.col)

const isHovered = ref(false)

const hoveredSize = computed<Size | null>(() => store.dragState?.size ?? null)

const canDropAny = computed(() => {
  const size = store.dragState?.size
  return !!size && store.canDrop(props.row, props.col, size)
})

function isHighlighted(size: Size) {
  return store.highlightedSlots.has(`${props.row},${props.col},${size}`)
}

function isLastMove(size: Size) {
  const move = store.lastMove
  return move?.row === props.row && move.col === props.col && move.size === size
}

function shouldAnimateLastMove(size: Size) {
  const move = store.lastMove
  if (!move || move.row !== props.row || move.col !== props.col || move.size !== size) return false
  // The player who placed it already saw their gesture. Opponents and
  // spectators get the arrival animation.
  return roomStore.roomId !== null && roomStore.mySlot !== move.player
}

function handleDragEnter(e: DragEvent) {
  if (canDropAny.value) {
    e.preventDefault()
    isHovered.value = true
  }
}

function handleDragOver(e: DragEvent) {
  onDragOver(e)
  isHovered.value = canDropAny.value
}

function handleDragLeave(e: DragEvent) {
  // Only clear hover when truly leaving the cell (not entering a child element)
  if (!e.currentTarget || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
    isHovered.value = false
  }
}

function handleDrop(e: DragEvent) {
  isHovered.value = false
  onDrop(e)
}
</script>

<style scoped>
.cell {
  width: 110px;
  height: 110px;
  background: var(--cell-bg);
  border: 2px solid var(--cell-border);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, box-shadow 0.15s;
  cursor: default;
}

.cell--can-drop {
  border-color: var(--drop-border);
}

.cell--hover {
  border-color: var(--drop-border-strong);
  box-shadow: var(--shadow-glow);
}

/* Stack: all rings share the same center */
.cell__stack {
  position: relative;
  width: 84px;
  height: 84px;
}

.cell__ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  /* pointer-events off so drag events reach the .cell parent */
  pointer-events: none;
  transition: filter 0.15s;
}

/* Z-index: large at back, small at front */
.cell__ring--large  { width: 84px; height: 84px; z-index: 1; }
.cell__ring--medium { width: 56px; height: 56px; z-index: 2; }
.cell__ring--small  { width: 28px; height: 28px; z-index: 3; }

/* Empty placeholder — subtle dashed circle */
.cell__ring-empty {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px dashed var(--placeholder-border);
  box-sizing: border-box;
}

/* Hover: highlight the ring matching the dragged size */
.cell__ring--hover .cell__ring-empty {
  border: 2px dashed var(--drop-border-strong);
  background: var(--placeholder-hover);
}

/* Win highlight */
.cell__ring--win .piece--large,
.cell__ring--win .piece--medium,
.cell__ring--win .piece--small {
  filter: drop-shadow(0 0 6px gold);
  animation: pulse-win 0.8s ease-in-out infinite alternate;
}

@keyframes pulse-win {
  from { filter: drop-shadow(0 0 4px gold); }
  to   { filter: drop-shadow(0 0 14px gold) brightness(1.3); }
}

</style>
