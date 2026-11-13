<template>
  <div
    class="cine"
    :class="`cine--${phase}`"
    :style="{ '--wc': winnerColor }"
    role="status"
    aria-live="assertive"
    :aria-label="`${winnerName} gana la ronda`"
    @click="skip"
  >
    <div class="cine__bars" aria-hidden="true"><i /><i /></div>

    <div class="cine__stage" aria-hidden="true">
      <div class="cine__camera" :style="cameraStyle">
        <div class="cine__board">
          <template v-for="r in 3" :key="r">
            <div
              v-for="c in 3"
              :key="c"
              class="cine__cell"
              :class="{ 'is-focus': isFocus(r - 1, c - 1), 'has-lit': cellHasLit(r - 1, c - 1) }"
            >
              <span
                v-for="size in SIZE_ORDER"
                :key="size"
                class="cine__slot"
                :class="`cine__slot--${size}`"
              >
                <span
                  v-if="pieceAt(r - 1, c - 1, size)"
                  class="cine__piece st-ring"
                  :class="[
                    `st-ring--${size}`,
                    {
                      'is-last': isLast(r - 1, c - 1, size),
                      'is-lit': isLit(r - 1, c - 1, size),
                    },
                  ]"
                  :style="{ '--piece-color': colorOf(pieceAt(r - 1, c - 1, size)!.player) }"
                />
              </span>
              <span v-if="phase === 'impact' && isFocus(r - 1, c - 1)" class="cine__shock" />
              <span v-if="phase === 'impact' && isFocus(r - 1, c - 1)" class="cine__shock cine__shock--late" />
            </div>
          </template>
        </div>

        <svg v-if="line && lineOn" class="cine__line" viewBox="0 0 318 318" preserveAspectRatio="none">
          <line :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2" pathLength="1" />
        </svg>
      </div>
    </div>

    <div class="cine__flash" aria-hidden="true" />

    <div v-if="phase === 'title'" class="cine__title">
      <span class="cine__condition">{{ conditionLabel }}</span>
      <h2>
        <span
          v-for="(char, index) in winnerChars"
          :key="index"
          :style="{ animationDelay: `${index * 45}ms` }"
        >{{ char }}</span>
      </h2>
      <p>{{ lost ? 'gana la ronda' : '¡gana la ronda!' }}</p>
    </div>

    <RingBurst v-if="phase === 'title'" :colors="burstColors" :count="160" />

    <span class="cine__skip">Toca para continuar</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Player, Size } from '@/types/game'
import { SIZE_ORDER } from '@/types/game'
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'
import { useAudioStore } from '@/stores/audioStore'
import { winLineEndpoints } from '@/utils/boardUtils'
import RingBurst from './RingBurst.vue'

/**
 * Win cinematic: zoom on the last move, hold the piece in the air while the
 * drum roll builds, slam it down, then light the winning pieces one by one in
 * time with rising chimes and close on the winner's name.
 */
const emit = defineEmits<{ done: [] }>()

type Phase = 'enter' | 'hover' | 'impact' | 'reveal' | 'title'

const store = useGameStore()
const roomStore = useRoomStore()
const audio = useAudioStore()

const phase = ref<Phase>('enter')
const litCount = ref(0)
const lineOn = ref(false)
const timers: number[] = []
let finished = false

const result = computed(() => store.winResult)
const lastMove = computed(() => store.lastMove)
const line = computed(() => winLineEndpoints(result.value))

const winnerSlot = computed(() => result.value?.winner ?? 1)
const winnerColor = computed(() => store.playerMeta[winnerSlot.value]?.color ?? 'var(--accent-primary)')
const winnerName = computed(() =>
  roomStore.players.find(player => player.slot === winnerSlot.value)?.username
    ?? store.playerMeta[winnerSlot.value]?.label
    ?? `Jugador ${winnerSlot.value}`
)
const winnerChars = computed(() => Array.from(winnerName.value).map(char => (char === ' ' ? ' ' : char)))
const lost = computed(() =>
  Boolean(roomStore.roomId && roomStore.mySlot && !roomStore.isSpectator && roomStore.mySlot !== winnerSlot.value)
)

const conditionLabel = computed(() => {
  const labels = {
    'same-size': 'Tres del mismo tamaño',
    'ordered-sequence': 'Grande · mediano · pequeño',
    'complete-cell': 'Casilla completa',
    timeout: 'Tiempo agotado',
  }
  return result.value ? labels[result.value.condition] : ''
})

const burstColors = computed(() => [winnerColor.value, winnerColor.value, 'var(--win-gold)', 'var(--win-gold)', 'var(--accent-secondary)'])

// Winning pieces in the order they light up: along the line, or big → small.
const litOrder = computed(() => {
  const win = result.value
  if (!win) return [] as string[]
  const sizeIndex = (size: Size) => SIZE_ORDER.indexOf(size)
  return [...win.highlights]
    .sort((a, b) => a.coord[0] - b.coord[0] || a.coord[1] - b.coord[1] || sizeIndex(a.size) - sizeIndex(b.size))
    .map(({ coord, size }) => `${coord[0]},${coord[1]},${size}`)
})

function pieceAt(row: number, col: number, size: Size) {
  return store.board[row]?.[col]?.[size] ?? null
}

function colorOf(player: Player) {
  return store.playerMeta[player]?.color ?? 'var(--accent-primary)'
}

function isFocus(row: number, col: number) {
  return lastMove.value?.row === row && lastMove.value.col === col
}

function isLast(row: number, col: number, size: Size) {
  return isFocus(row, col) && lastMove.value?.size === size
}

function isLit(row: number, col: number, size: Size) {
  const index = litOrder.value.indexOf(`${row},${col},${size}`)
  return index >= 0 && index < litCount.value
}

function cellHasLit(row: number, col: number) {
  return SIZE_ORDER.some(size => isLit(row, col, size))
}

const cameraStyle = computed(() => {
  const move = lastMove.value
  if ((phase.value === 'enter') || !move) return { transform: 'scale(1)' }
  if (phase.value === 'hover' || phase.value === 'impact') {
    const fx = 1 - move.col
    const fy = 1 - move.row
    return {
      transform: `scale(2.1) translate(calc(${fx} * var(--step)), calc(${fy} * var(--step)))`,
    }
  }
  if (phase.value === 'title') return { transform: 'translateY(-24%) scale(0.62)' }
  return { transform: 'scale(1)' }
})

function at(ms: number, fn: () => void) {
  timers.push(window.setTimeout(fn, ms))
}

function finish() {
  if (finished) return
  finished = true
  timers.forEach(timer => window.clearTimeout(timer))
  emit('done')
}

function skip() {
  finish()
}

function onKey(event: KeyboardEvent) {
  if (['Enter', ' ', 'Escape'].includes(event.key)) {
    event.preventDefault()
    finish()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  audio.duckMusic(true)

  const steps = litOrder.value.length
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    phase.value = 'reveal'
    litCount.value = steps
    lineOn.value = true
    audio.playSfx(lost.value ? 'lose' : 'fanfare')
    at(300, () => { phase.value = 'title' })
    at(2600, finish)
    return
  }

  audio.playSfx('riser')
  at(40, () => { phase.value = 'hover' })
  at(1500, () => {
    phase.value = 'impact'
    audio.playSfx('impact')
    navigator.vibrate?.([40, 30, 80])
  })
  at(2150, () => { phase.value = 'reveal' })

  const stepGap = steps > 4 ? 200 : 300
  for (let index = 0; index < steps; index++) {
    at(2600 + index * stepGap, () => {
      litCount.value = index + 1
      audio.playSfx('chime', { step: index })
    })
  }
  const afterLit = 2600 + steps * stepGap
  if (line.value) {
    at(afterLit, () => {
      lineOn.value = true
      audio.playSfx('whoosh')
    })
  }
  at(afterLit + 300, () => {
    phase.value = 'title'
    audio.playSfx(lost.value ? 'lose' : 'fanfare')
  })
  at(afterLit + 3000, finish)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  timers.forEach(timer => window.clearTimeout(timer))
  audio.duckMusic(false)
})
</script>

<style scoped>
.cine {
  --cell: min(118px, calc((min(100vw, 100vh) - 64px) / 3.6));
  --step: calc(var(--cell) * 1.09);
  --wc: var(--accent-primary);
  position: fixed;
  inset: 0;
  z-index: 450;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--wc) 16%, transparent), transparent 55%),
    radial-gradient(circle at 50% 50%, rgba(6, 4, 16, 0.55), rgba(6, 4, 16, 0.94) 75%);
  backdrop-filter: blur(6px);
  cursor: pointer;
  animation: cine-in 0.35s ease both;
}

@keyframes cine-in { from { opacity: 0; } }

/* Letterbox bars: in for the suspense, out for the reveal. */
.cine__bars i {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 3;
  height: 11vh;
  background: #000;
  transition: transform 0.6s var(--ease-out);
}

.cine__bars i:first-child { top: 0; transform: translateY(-100%); }
.cine__bars i:last-child { bottom: 0; transform: translateY(100%); }

.cine--hover .cine__bars i,
.cine--impact .cine__bars i { transform: none; }

.cine__stage {
  position: relative;
  z-index: 1;
}

.cine--impact .cine__stage { animation: cine-shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97); }

@keyframes cine-shake {
  10%, 90% { transform: translate(-2px, 1px); }
  20%, 80% { transform: translate(5px, -3px); }
  30%, 50%, 70% { transform: translate(-9px, 4px); }
  40%, 60% { transform: translate(9px, -4px); }
}

.cine__camera {
  position: relative;
  transition: transform 0.95s cubic-bezier(0.45, 0, 0.15, 1);
  will-change: transform;
}

.cine--reveal .cine__camera { transition-duration: 0.75s; transition-timing-function: var(--ease-out); }
.cine--title .cine__camera { transition-duration: 0.6s; }

.cine__board {
  display: grid;
  grid-template-columns: repeat(3, var(--cell));
  gap: calc(var(--cell) * 0.09);
  padding: calc(var(--cell) * 0.13);
  border-radius: calc(var(--cell) * 0.3);
  background: linear-gradient(160deg, var(--board-rim), var(--board-bg) 40%);
  box-shadow: var(--shadow-tray), 0 0 80px -20px var(--wc);
}

.cine__cell {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--cell);
  height: var(--cell);
  border-radius: calc(var(--cell) * 0.22);
  background: var(--cell-bg);
  box-shadow: inset 0 2px 5px var(--groove), 0 1px 0 var(--groove-light);
  transition: box-shadow 0.3s ease;
}

.cine__cell.is-focus { z-index: 2; }

.cine__cell.has-lit {
  box-shadow:
    inset 0 2px 5px var(--groove),
    inset 0 0 0 2px color-mix(in srgb, var(--win-gold) 75%, transparent),
    0 0 34px -4px var(--win-gold);
}

.cine__slot {
  position: absolute;
  display: grid;
  place-items: center;
}

.cine__slot--large { width: 69%; height: 69%; }
.cine__slot--medium { width: 44%; height: 44%; }
.cine__slot--small { width: 20%; height: 20%; }

.cine__piece {
  width: 100%;
  height: 100%;
  transition: filter 0.5s ease;
}

/* Everything except the falling piece goes dim during the suspense. */
.cine--enter .cine__piece:not(.is-last),
.cine--hover .cine__piece:not(.is-last),
.cine--impact .cine__piece:not(.is-last) {
  filter: grayscale(0.7) brightness(0.45);
}

.cine--enter .cine__piece.is-last { opacity: 0; }

.cine--hover .cine__piece.is-last {
  animation: cine-hover 1.45s cubic-bezier(0.1, 0.7, 0.3, 1) both;
}

@keyframes cine-hover {
  0% { opacity: 0; transform: translateY(calc(var(--cell) * -1.2)) scale(2.6) rotate(-80deg); }
  25% { opacity: 1; }
  100% { opacity: 1; transform: translateY(calc(var(--cell) * -0.32)) scale(1.3) rotate(-10deg); }
}

.cine--impact .cine__piece.is-last {
  animation: cine-slam 0.16s cubic-bezier(0.7, 0, 1, 1) both;
}

@keyframes cine-slam {
  0% { transform: translateY(calc(var(--cell) * -0.32)) scale(1.3) rotate(-10deg); }
  100% { transform: none; }
}

.cine__piece.is-lit {
  animation: cine-lit 0.55s var(--ease-snap) both, cine-glow 0.8s 0.55s ease-in-out infinite alternate;
}

@keyframes cine-lit {
  0% { transform: scale(1.6); filter: brightness(2.4) drop-shadow(0 0 18px var(--win-gold)); }
  100% { transform: none; filter: brightness(1.15) drop-shadow(0 0 10px var(--win-gold)); }
}

@keyframes cine-glow {
  from { filter: brightness(1.1) drop-shadow(0 0 6px var(--win-gold)); }
  to { filter: brightness(1.35) drop-shadow(0 0 16px var(--win-gold)); }
}

.cine__shock {
  position: absolute;
  inset: 8%;
  border: 3px solid var(--wc);
  border-radius: 50%;
  pointer-events: none;
  animation: cine-shock 0.7s var(--ease-out) both;
}

.cine__shock--late {
  border-color: var(--win-gold);
  animation-delay: 0.1s;
}

@keyframes cine-shock {
  0% { opacity: 1; transform: scale(0.4); }
  100% { opacity: 0; transform: scale(2.8); border-width: 1px; }
}

.cine__flash {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: radial-gradient(circle at 50% 50%, #fff, color-mix(in srgb, var(--wc) 60%, transparent) 40%, transparent 70%);
  opacity: 0;
  pointer-events: none;
}

.cine--impact .cine__flash { animation: cine-flash 0.55s ease-out; }

@keyframes cine-flash {
  0% { opacity: 0.9; }
  100% { opacity: 0; }
}

.cine__line {
  position: absolute;
  inset: calc(var(--cell) * 0.13);
  width: calc(100% - var(--cell) * 0.26);
  height: calc(100% - var(--cell) * 0.26);
  overflow: visible;
  pointer-events: none;
}

.cine__line line {
  stroke: var(--win-gold);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  filter: drop-shadow(0 0 8px var(--win-gold));
  vector-effect: non-scaling-stroke;
  animation: cine-line 0.45s var(--ease-out) forwards;
}

@keyframes cine-line { to { stroke-dashoffset: 0; } }

.cine__title {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: max(9vh, 40px);
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  pointer-events: none;
}

.cine__condition {
  padding: 5px 14px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--win-gold) 20%, transparent);
  color: var(--win-gold);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  animation: st-pop-in 0.4s var(--ease-spring) both;
}

.cine__title h2 {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 100%;
  color: #fff;
  font-size: clamp(44px, min(10vw, 13vh), 112px);
  letter-spacing: -0.04em;
  line-height: 1;
  text-shadow: 0 0 30px var(--wc), 0 6px 0 color-mix(in srgb, var(--wc) 55%, #000);
}

.cine__title h2 span {
  display: inline-block;
  animation: cine-letter 0.55s var(--ease-snap) both;
}

@keyframes cine-letter {
  0% { opacity: 0; transform: translateY(-70%) scale(1.8) rotate(-12deg); }
  100% { opacity: 1; transform: none; }
}

.cine__title p {
  color: rgba(255, 255, 255, 0.85);
  font-family: var(--font-display);
  font-size: clamp(18px, 3vw, 26px);
  font-weight: 700;
  animation: st-pop-in 0.5s 0.4s var(--ease-out) both;
}

.cine__skip {
  position: absolute;
  right: 16px;
  bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  z-index: 4;
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  font-weight: 600;
}

.cine--hover .cine__skip,
.cine--impact .cine__skip { bottom: calc(11vh + 12px); }
</style>
