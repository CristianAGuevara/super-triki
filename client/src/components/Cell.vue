<template>
  <div
    class="cell"
    data-board-cell
    :data-row="row"
    :data-col="col"
    :tabindex="tvStore.enabled && !store.isGameOver ? 0 : undefined"
    :role="tvStore.enabled ? 'button' : undefined"
    :aria-label="cellLabel"
    :class="{
      'cell--can-drop': canDropAny,
      'cell--blocked': armedSize !== null && !canDropAny && !store.isGameOver,
      'cell--hover': isHovered,
      'cell--win': hasWin,
    }"
    :style="armedColor ? { '--armed-color': armedColor } : undefined"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @dragenter="handleDragEnter"
    @drop="handleDrop"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @click="handleCellClick"
    @keydown.enter.prevent="handleCellClick"
    @keydown.space.prevent="handleCellClick"
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
            'cell__ring--win': isHighlighted(size),
            'cell__ring--target': canDropAny && armedSize === size,
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
        <template v-else>
          <span class="cell__groove" :class="`cell__groove--${size}`" />
          <span
            v-if="canDropAny && armedSize === size"
            class="cell__ghost st-ring"
            :class="[`st-ring--${size}`, `cell__ghost--${size}`]"
          />
        </template>
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
import { useTvModeStore } from '@/stores/tvStore'
import { useDragDrop } from '@/composables/useDragDrop'
import Piece from './Piece.vue'

const props = defineProps<{
  row: number
  col: number
}>()

const store = useGameStore()
const roomStore = useRoomStore()
const tvStore = useTvModeStore()
const { onDragOver, onDrop } = useDragDrop(props.row, props.col)

const SIZE_NAMES: Record<Size, string> = { large: 'grande', medium: 'mediana', small: 'pequeña' }

const cellLabel = computed(() => {
  const base = `Fila ${props.row + 1}, columna ${props.col + 1}`
  if (!store.selectedPiece) return base
  return `${base}. Pulsa OK para colocar la ficha ${SIZE_NAMES[store.selectedPiece.size]}`
})

const isHovered = ref(false)

const activePiece = computed(() => store.dragState ?? store.selectedPiece)
const armedSize = computed<Size | null>(() => activePiece.value?.size ?? null)
const armedColor = computed(() =>
  activePiece.value ? store.playerMeta[activePiece.value.player]?.color : null
)

const canDropAny = computed(() => {
  const size = armedSize.value
  return !!size && store.canDrop(props.row, props.col, size)
})

const hasWin = computed(() => SIZE_ORDER.some(size => isHighlighted(size)))

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

function handleMouseEnter() {
  if (store.selectedPiece && canDropAny.value) isHovered.value = true
}

function handleMouseLeave() {
  if (!store.dragState) isHovered.value = false
}

function handleCellClick() {
  const selected = store.selectedPiece
  if (!selected) return
  if (!store.canDrop(props.row, props.col, selected.size)) {
    store.rejectSelection()
    if (typeof navigator !== 'undefined') navigator.vibrate?.([20, 35, 20])
    return
  }

  isHovered.value = false
  const placed = store.placePiece({
    pieceId: selected.pieceId,
    targetRow: props.row,
    targetCol: props.col,
    targetSize: selected.size,
  })
  if (placed) store.clearSelection()
}
</script>

<style scoped>
.cell {
  --cell-size: var(--cell, 112px);
  --armed-color: var(--accent-primary);
  position: relative;
  width: var(--cell-size);
  height: var(--cell-size);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: calc(var(--cell-size) * 0.22);
  background:
    radial-gradient(circle at 50% 45%, transparent 55%, color-mix(in srgb, var(--groove) 40%, transparent) 100%),
    var(--cell-bg);
  box-shadow:
    inset 0 2px 5px var(--groove),
    0 1px 0 var(--groove-light);
  cursor: default;
  transition: box-shadow 0.2s ease, transform 0.25s var(--ease-spring), opacity 0.2s ease, background-color 0.2s;
}

.cell--can-drop {
  cursor: pointer;
  box-shadow:
    inset 0 2px 5px var(--groove),
    inset 0 0 0 1.5px color-mix(in srgb, var(--armed-color) 45%, transparent),
    0 1px 0 var(--groove-light);
}

.cell--blocked {
  opacity: 0.55;
}

.cell--hover {
  transform: translateY(-2px);
  background-color: color-mix(in srgb, var(--armed-color) 8%, var(--cell-bg));
  box-shadow:
    inset 0 2px 5px var(--groove),
    inset 0 0 0 2px var(--armed-color),
    0 0 26px -4px color-mix(in srgb, var(--armed-color) 60%, transparent);
}

.cell--win {
  box-shadow:
    inset 0 2px 5px var(--groove),
    inset 0 0 0 2px color-mix(in srgb, var(--win-gold) 70%, transparent),
    0 0 30px -6px var(--win-gold);
}

.cell:focus {
  z-index: 2;
  outline: 4px solid var(--accent-primary);
  outline-offset: 4px;
}

/* Stack: all rings share the same center */
.cell__stack {
  position: relative;
  width: 76%;
  height: 76%;
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
}

/* Z-index: large at back, small at front */
.cell__ring--large  { width: 100%;  height: 100%;  z-index: 1; }
.cell__ring--medium { width: 66.7%; height: 66.7%; z-index: 2; }
.cell__ring--small  { width: 33.3%; height: 33.3%; z-index: 3; }

/* Empty slot: an engraved groove in the tray. */
.cell__groove {
  position: absolute;
  border-radius: 50%;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.cell__groove--large,
.cell__groove--medium {
  inset: 6%;
  border: 1px solid var(--placeholder-border);
  box-shadow: inset 0 1px 2px var(--groove), 0 1px 0 var(--groove-light);
}

.cell__groove--small {
  inset: 14%;
  background: color-mix(in srgb, var(--groove) 35%, transparent);
  box-shadow: inset 0 1px 3px var(--groove), 0 1px 0 var(--groove-light);
}

.cell__ring--target .cell__groove {
  border-color: color-mix(in srgb, var(--armed-color) 70%, transparent);
  box-shadow:
    inset 0 1px 2px var(--groove),
    0 0 10px color-mix(in srgb, var(--armed-color) 55%, transparent);
  animation: groove-breathe 1.4s ease-in-out infinite;
}

@keyframes groove-breathe {
  50% { box-shadow: inset 0 1px 2px var(--groove), 0 0 16px color-mix(in srgb, var(--armed-color) 80%, transparent); }
}

/* Translucent preview of the piece about to land. */
.cell__ghost {
  --piece-color: var(--armed-color);
  opacity: 0;
  transform: scale(0.85);
  transition: opacity 0.18s ease, transform 0.25s var(--ease-spring);
}

.cell__ghost--large  { width: 90%; height: 90%; }
.cell__ghost--medium { width: 86%; height: 86%; }
.cell__ghost--small  { width: 78%; height: 78%; }

.cell--hover .cell__ghost {
  opacity: 0.55;
  transform: scale(1);
}

@media (hover: none) {
  .cell__ghost { opacity: 0.22; transform: scale(1); }
}

/* Win highlight */
.cell__ring--win :deep(.piece) {
  animation: pulse-win 0.9s ease-in-out infinite alternate;
}

@keyframes pulse-win {
  from { filter: drop-shadow(0 0 3px var(--win-gold)); }
  to   { filter: drop-shadow(0 0 12px var(--win-gold)) brightness(1.25); }
}
</style>
