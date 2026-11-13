<template>
  <div class="hero-board" role="img" aria-label="Demostración: tres anillos de tamaño grande, mediano y pequeño en diagonal ganan la partida">
    <div class="hero-board__grid">
      <div v-for="index in 9" :key="index" class="hero-board__cell">
        <span
          v-for="move in movesAt(index - 1)"
          :key="move.size"
          class="hero-board__ring st-ring"
          :class="[`st-ring--${move.size}`, `hero-board__ring--${move.size}`, { 'is-win': won && move.player === 1 && isWinCell(index - 1) }]"
          :style="{ '--piece-color': move.player === 1 ? 'var(--player-1-color)' : 'var(--player-2-color)' }"
        />
      </div>
    </div>
    <svg v-if="won" class="hero-board__line" viewBox="0 0 100 100" aria-hidden="true">
      <line x1="8" y1="8" x2="92" y2="92" pathLength="1" />
    </svg>
    <span class="hero-board__caption">{{ caption }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Size } from '@/types/game'

interface DemoMove { cell: number; size: Size; player: 1 | 2 }

const SCRIPT: DemoMove[] = [
  { cell: 0, size: 'large', player: 1 },
  { cell: 4, size: 'large', player: 2 },
  { cell: 4, size: 'medium', player: 1 },
  { cell: 2, size: 'small', player: 2 },
  { cell: 8, size: 'small', player: 1 },
]
const WIN_CELLS = new Set([0, 4, 8])

const step = ref(0)
let timer: number | undefined

const played = computed(() => SCRIPT.slice(0, step.value))
const won = computed(() => step.value >= SCRIPT.length)
const caption = computed(() => {
  if (won.value) return 'Grande → mediano → pequeño: ¡línea!'
  if (step.value === 0) return 'Cada casilla guarda tres anillos'
  return `Turno ${step.value + 1}`
})

function movesAt(cell: number) {
  return played.value.filter(move => move.cell === cell)
}

function isWinCell(cell: number) {
  return WIN_CELLS.has(cell)
}

function tick() {
  step.value = step.value >= SCRIPT.length ? 0 : step.value + 1
  timer = window.setTimeout(tick, step.value >= SCRIPT.length ? 2600 : step.value === 0 ? 900 : 850)
}

onMounted(() => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    step.value = SCRIPT.length
    return
  }
  timer = window.setTimeout(tick, 700)
})

onUnmounted(() => window.clearTimeout(timer))
</script>

<style scoped>
.hero-board {
  --cell: clamp(64px, 9vw, 92px);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  transform: rotate(-4deg);
}

.hero-board__grid {
  display: grid;
  grid-template-columns: repeat(3, var(--cell));
  gap: calc(var(--cell) * 0.09);
  padding: calc(var(--cell) * 0.14);
  border-radius: calc(var(--cell) * 0.3);
  background: linear-gradient(160deg, var(--board-rim), var(--board-bg) 40%);
  box-shadow: var(--shadow-tray);
}

.hero-board__cell {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--cell);
  height: var(--cell);
  border-radius: calc(var(--cell) * 0.22);
  background: var(--cell-bg);
  box-shadow: inset 0 2px 5px var(--groove), 0 1px 0 var(--groove-light);
}

.hero-board__ring {
  position: absolute;
  animation: hero-drop 0.5s var(--ease-snap) both;
}

.hero-board__ring--large { width: 69%; height: 69%; }
.hero-board__ring--medium { width: 44%; height: 44%; }
.hero-board__ring--small { width: 20%; height: 20%; }

.hero-board__ring.is-win { animation: hero-drop 0.5s var(--ease-snap) both, hero-glow 0.9s 0.3s ease-in-out infinite alternate; }

@keyframes hero-drop {
  0% { opacity: 0; transform: translateY(-30%) scale(1.4); }
  60% { opacity: 1; transform: scale(0.93); }
  100% { opacity: 1; transform: none; }
}

@keyframes hero-glow {
  to { filter: drop-shadow(0 0 10px var(--win-gold)) brightness(1.2); }
}

.hero-board__line {
  position: absolute;
  z-index: 2;
  top: calc(var(--cell) * 0.14);
  left: 50%;
  width: calc(var(--cell) * 3.18);
  height: calc(var(--cell) * 3.18);
  overflow: visible;
  transform: translateX(-50%);
  pointer-events: none;
}

.hero-board__line line {
  stroke: var(--win-gold);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  filter: drop-shadow(0 0 3px var(--win-gold));
  animation: hero-line 0.6s 0.25s var(--ease-out) forwards;
}

@keyframes hero-line { to { stroke-dashoffset: 0; } }

.hero-board__caption {
  min-height: 20px;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
  transform: rotate(4deg);
}
</style>
