<template>
  <div
    class="board"
    :class="{
      'board--armed': armed,
      'board--won': Boolean(store.winResult),
      'board--shake': shaking,
    }"
    :style="armedColor ? { '--armed-color': armedColor } : undefined"
  >
    <div class="board__grid">
      <template v-for="(row, r) in store.board" :key="r">
        <Cell v-for="(_, c) in row" :key="c" :row="r" :col="c" />
      </template>
    </div>

    <svg
      v-if="winLine"
      class="board__win-line st-winline"
      viewBox="0 0 318 318"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line class="st-winline__base" :x1="winLine.x1" :y1="winLine.y1" :x2="winLine.x2" :y2="winLine.y2" pathLength="1" />
      <line class="st-winline__core" :x1="winLine.x1" :y1="winLine.y1" :x2="winLine.x2" :y2="winLine.y2" pathLength="1" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { winLineEndpoints } from '@/utils/boardUtils'
import Cell from './Cell.vue'

const store = useGameStore()
const shaking = ref(false)

const activePiece = computed(() => store.dragState ?? store.selectedPiece)
const armed = computed(() => Boolean(activePiece.value) && !store.isGameOver)
const armedColor = computed(() =>
  activePiece.value ? store.playerMeta[activePiece.value.player]?.color : null
)

const winLine = computed(() => winLineEndpoints(store.winResult))

watch(() => store.selectionHint, hint => {
  if (!hint) return
  shaking.value = false
  requestAnimationFrame(() => { shaking.value = true })
  window.setTimeout(() => { shaking.value = false }, 450)
})
</script>

<style scoped>
.board {
  --cell: 112px;
  --gap: calc(var(--cell) * 0.09);
  --armed-color: var(--accent-primary);
  position: relative;
  padding: calc(var(--cell) * 0.13);
  border-radius: calc(var(--cell) * 0.3);
  background:
    radial-gradient(120% 90% at 30% 0%, color-mix(in srgb, var(--text-primary) 6%, transparent), transparent 55%),
    linear-gradient(160deg, var(--board-rim), var(--board-bg) 40%);
  box-shadow: var(--shadow-tray);
  transition: box-shadow 0.35s ease;
}

.board::before {
  /* Etched outline of the play field, like a routed groove in the tray. */
  content: '';
  position: absolute;
  inset: calc(var(--cell) * 0.065);
  border-radius: calc(var(--cell) * 0.24);
  border: 1px solid var(--groove-light);
  box-shadow: inset 0 1px 2px var(--groove);
  pointer-events: none;
}

.board--armed {
  box-shadow:
    var(--shadow-tray),
    0 0 0 2px color-mix(in srgb, var(--armed-color) 45%, transparent),
    0 0 44px -6px color-mix(in srgb, var(--armed-color) 45%, transparent);
}

.board--won {
  animation: board-slam 0.6s var(--ease-snap);
}

.board--shake {
  animation: st-shake 0.42s ease;
}

.board__grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, var(--cell));
  gap: var(--gap);
}

/* Stroke styling lives in base.css / themes.css (.st-winline). */
.board__win-line {
  --winline-w: 6.5px;
  --winline-draw: 0.7s;
  --winline-delay: 0.25s;
  position: absolute;
  inset: calc(var(--cell) * 0.13);
  width: calc(100% - var(--cell) * 0.26);
  height: calc(100% - var(--cell) * 0.26);
  z-index: 5;
}

@keyframes board-slam {
  0% { transform: scale(1); }
  35% { transform: scale(1.025); }
  100% { transform: scale(1); }
}

@media (max-width: 520px) {
  .board { --cell: min(112px, calc((100vw - 32px) / 3.45)); }
}

@media (min-width: 701px) {
  .board { --cell: clamp(96px, min(14.5vh, 10.5vw), 150px); }
}
</style>
