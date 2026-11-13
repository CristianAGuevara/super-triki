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
      class="board__win-line"
      viewBox="0 0 318 318"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line :x1="winLine.x1" :y1="winLine.y1" :x2="winLine.x2" :y2="winLine.y2" pathLength="1" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import Cell from './Cell.vue'

const store = useGameStore()
const shaking = ref(false)

const activePiece = computed(() => store.dragState ?? store.selectedPiece)
const armed = computed(() => Boolean(activePiece.value) && !store.isGameOver)
const armedColor = computed(() =>
  activePiece.value ? store.playerMeta[activePiece.value.player]?.color : null
)

// Cell centres in a 318-unit box: cell = 100, gap = 9 (matches the CSS ratio).
const CENTER = [50, 159, 268]

const winLine = computed(() => {
  const result = store.winResult
  if (!result || result.condition === 'complete-cell' || result.condition === 'timeout') return null
  const coords = Array.from(
    new Map(result.highlights.map(({ coord }) => [`${coord[0]},${coord[1]}`, coord])).values(),
  ).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (coords.length < 2) return null
  const [r1, c1] = coords[0]
  const [r2, c2] = coords[coords.length - 1]
  const x1 = CENTER[c1], y1 = CENTER[r1], x2 = CENTER[c2], y2 = CENTER[r2]
  const length = Math.hypot(x2 - x1, y2 - y1)
  const ux = (x2 - x1) / length, uy = (y2 - y1) / length
  const overshoot = 34
  return {
    x1: x1 - ux * overshoot,
    y1: y1 - uy * overshoot,
    x2: x2 + ux * overshoot,
    y2: y2 + uy * overshoot,
  }
})

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

.board__win-line {
  position: absolute;
  inset: calc(var(--cell) * 0.13);
  width: calc(100% - var(--cell) * 0.26);
  height: calc(100% - var(--cell) * 0.26);
  overflow: visible;
  pointer-events: none;
  z-index: 5;
}

.board__win-line line {
  stroke: var(--win-gold);
  stroke-width: 7;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  filter: drop-shadow(0 0 6px var(--win-gold));
  opacity: 0.9;
  vector-effect: non-scaling-stroke;
  animation: win-line-draw 0.7s 0.25s var(--ease-out) forwards;
}

@keyframes win-line-draw {
  to { stroke-dashoffset: 0; }
}

@keyframes board-slam {
  0% { transform: scale(1); }
  35% { transform: scale(1.025); }
  100% { transform: scale(1); }
}

@media (max-width: 520px) {
  .board { --cell: min(112px, calc((100vw - 32px) / 3.45)); }
}

@media (min-width: 1280px) and (min-height: 860px) {
  .board { --cell: 124px; }
}
</style>
