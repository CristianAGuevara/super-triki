<template>
  <div
    class="cine"
    :class="`cine--${phase}`"
    :style="{ '--wc': winnerColor, '--suspense': `${SUSPENSE_MS}ms` }"
    role="status"
    aria-live="assertive"
    :aria-label="`${winnerName} gana la ronda`"
    @click="finish"
  >
    <div class="cine__rays" aria-hidden="true" />
    <div :key="pulseKey" class="cine__pulse" aria-hidden="true" />

    <div class="cine__bars" aria-hidden="true">
      <i />
      <i><span>{{ suspenseCaption }}</span></i>
    </div>

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
                      'is-dim': isDim(r - 1, c - 1, size),
                      'is-faded': isFaded(r - 1, c - 1, size),
                    },
                  ]"
                  :style="{ '--piece-color': colorOf(pieceAt(r - 1, c - 1, size)!.player) }"
                />
                <span
                  v-if="isLast(r - 1, c - 1, size) && (phase === 'freeze' || phase === 'suspense')"
                  class="cine__reticle"
                />
                <span
                  v-if="phase === 'trace' && isTraceTarget(r - 1, c - 1, size)"
                  :key="`trace-${traceIndex}`"
                  class="cine__shock cine__shock--gold"
                />
              </span>
              <template v-if="phase === 'impact' && isFocus(r - 1, c - 1)">
                <span class="cine__shock" />
                <span class="cine__shock cine__shock--late" />
                <span class="cine__shock cine__shock--later" />
              </template>
            </div>
          </template>
        </div>

        <svg v-if="line && lineOn" class="cine__line" viewBox="0 0 318 318" preserveAspectRatio="none">
          <line :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2" pathLength="1" />
        </svg>
      </div>
    </div>

    <div class="cine__flash" aria-hidden="true" />
    <RingBurst v-if="impactBurst" class="cine__burst" mode="radial" :colors="burstColors" :count="90" />

    <div v-if="phase === 'title'" class="cine__title">
      <span class="cine__condition">{{ conditionLabel }}</span>
      <h2>
        <span
          v-for="(char, index) in winnerChars"
          :key="index"
          :style="{ animationDelay: `${index * 55}ms` }"
        >{{ char }}</span>
      </h2>
      <p>{{ lost ? 'gana la ronda' : '¡gana la ronda!' }}</p>
    </div>

    <RingBurst v-if="phase === 'title'" :colors="burstColors" :count="180" />

    <span class="cine__skip">Toca para saltar</span>
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
 * Win cinematic, in the spirit of a slow-motion "final shot":
 *   freeze   – time stops, pitch drops, the board dims
 *   suspense – slow push-in on the last cell while the piece hangs in the
 *              air; heartbeats speed up over a rising drum roll, then silence
 *   impact   – the piece slams down: flash, shockwaves, shake, crash
 *   trace    – the camera visits each winning piece on the beat of a chime
 *   reveal   – pull back, the gold line draws, the line rings as a chord
 *   title    – the winner's name lands with the fanfare
 */
const emit = defineEmits<{ done: [] }>()

type Phase = 'freeze' | 'suspense' | 'impact' | 'trace' | 'reveal' | 'title'

const FREEZE_MS = 750
const SUSPENSE_MS = 3600
const SILENCE_MS = 380
const IMPACT_HOLD_MS = 1050
const TRACE_STEP_MS = 580
const REVEAL_MS = 950
const TITLE_HOLD_MS = 3600

const store = useGameStore()
const roomStore = useRoomStore()
const audio = useAudioStore()

const phase = ref<Phase>('freeze')
const traceIndex = ref(-1)
const lineOn = ref(false)
const impactBurst = ref(false)
const pulseKey = ref(0)
const timers: number[] = []
let finished = false

const result = computed(() => store.winResult ?? store.cinematicResult)
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

const suspenseCaption = computed(() => {
  const cell = result.value?.condition === 'complete-cell'
  if (phase.value === 'impact') return cell ? '¡Casilla completa!' : '¡Línea!'
  return cell ? '¿Se completa la casilla?' : '¿Se cierra la línea?'
})

const burstColors = computed(() => [winnerColor.value, winnerColor.value, 'var(--win-gold)', 'var(--win-gold)', 'var(--accent-secondary)'])

// Winning pieces in the order the camera visits them: along the line, or big → small.
const winOrder = computed(() => {
  const win = result.value
  if (!win) return [] as Array<{ row: number; col: number; size: Size; key: string }>
  const sizeIndex = (size: Size) => SIZE_ORDER.indexOf(size)
  return [...win.highlights]
    .sort((a, b) => a.coord[0] - b.coord[0] || a.coord[1] - b.coord[1] || sizeIndex(a.size) - sizeIndex(b.size))
    .map(({ coord, size }) => ({ row: coord[0], col: coord[1], size, key: `${coord[0]},${coord[1]},${size}` }))
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

function winIndex(row: number, col: number, size: Size) {
  return winOrder.value.findIndex(item => item.key === `${row},${col},${size}`)
}

function isLit(row: number, col: number, size: Size) {
  const index = winIndex(row, col, size)
  return index >= 0 && index <= traceIndex.value
}

function isTraceTarget(row: number, col: number, size: Size) {
  return traceIndex.value >= 0 && winIndex(row, col, size) === traceIndex.value
}

function cellHasLit(row: number, col: number) {
  return SIZE_ORDER.some(size => isLit(row, col, size))
}

const beforeTrace = computed(() => ['freeze', 'suspense', 'impact'].includes(phase.value))

function isDim(row: number, col: number, size: Size) {
  if (beforeTrace.value) return !isLast(row, col, size)
  if (phase.value === 'trace') return !isLit(row, col, size)
  return false
}

function isFaded(row: number, col: number, size: Size) {
  return (phase.value === 'reveal' || phase.value === 'title') && winIndex(row, col, size) < 0
}

function focusTranslate(row: number, col: number) {
  return `translate(calc(${1 - col} * var(--step)), calc(${1 - row} * var(--step)))`
}

const cameraStyle = computed(() => {
  const move = lastMove.value
  switch (phase.value) {
    case 'freeze':
      return { transform: 'scale(1.1)', transition: 'transform 0.7s cubic-bezier(0.2, 0.9, 0.3, 1)' }
    case 'suspense':
    case 'impact':
      return {
        transform: move ? `scale(2.5) ${focusTranslate(move.row, move.col)}` : 'scale(1.4)',
        transition: `transform ${SUSPENSE_MS}ms cubic-bezier(0.3, 0.35, 0.45, 1)`,
      }
    case 'trace': {
      const target = winOrder.value[Math.max(0, traceIndex.value)]
      return {
        transform: target ? `scale(1.85) ${focusTranslate(target.row, target.col)}` : 'scale(1.2)',
        transition: 'transform 0.5s cubic-bezier(0.5, 0, 0.2, 1)',
      }
    }
    case 'title':
      return { transform: 'translateY(-22%) scale(0.68)', transition: 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)' }
    default:
      return { transform: 'scale(1)', transition: 'transform 0.85s cubic-bezier(0.22, 1, 0.36, 1)' }
  }
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

function onKey(event: KeyboardEvent) {
  if (['Enter', ' ', 'Escape'].includes(event.key)) {
    event.preventDefault()
    finish()
  }
}

function heartbeat() {
  audio.playSfx('heartbeat')
  pulseKey.value++
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  audio.duckMusic(true)

  const steps = winOrder.value.length
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    phase.value = 'reveal'
    traceIndex.value = steps - 1
    lineOn.value = true
    audio.playSfx(lost.value ? 'lose' : 'fanfare')
    at(300, () => { phase.value = 'title' })
    at(3000, finish)
    return
  }

  // ── Freeze ──
  audio.playSfx('freeze')
  navigator.vibrate?.(30)

  // ── Suspense ──
  const suspenseAt = FREEZE_MS
  at(suspenseAt, () => {
    phase.value = 'suspense'
    audio.playSfx('riser', { duration: (SUSPENSE_MS - SILENCE_MS) / 1000 })
  })
  // Heartbeats that close in on each other.
  ;[250, 1150, 1900, 2500, 2950].forEach(offset => at(suspenseAt + offset, heartbeat))

  // ── Impact ──
  const impactAt = suspenseAt + SUSPENSE_MS
  at(impactAt, () => {
    phase.value = 'impact'
    impactBurst.value = true
    audio.playSfx('impact')
    navigator.vibrate?.([60, 40, 120])
  })

  // ── Trace: one winning piece per beat ──
  const traceAt = impactAt + IMPACT_HOLD_MS
  const stepMs = steps > 4 ? 380 : TRACE_STEP_MS
  for (let index = 0; index < steps; index++) {
    at(traceAt + index * stepMs, () => {
      phase.value = 'trace'
      traceIndex.value = index
      audio.playSfx('chime', { step: index })
      navigator.vibrate?.(18)
    })
  }

  // ── Reveal ──
  const revealAt = traceAt + steps * stepMs + 120
  at(revealAt, () => {
    phase.value = 'reveal'
    audio.playSfx('whoosh')
  })
  at(revealAt + 320, () => {
    lineOn.value = true
    audio.playSfx('chord')
  })

  // ── Title ──
  const titleAt = revealAt + REVEAL_MS
  at(titleAt, () => {
    phase.value = 'title'
    audio.playSfx(lost.value ? 'lose' : 'fanfare')
  })
  at(titleAt + TITLE_HOLD_MS, finish)
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
  background: radial-gradient(circle at 50% 50%, rgba(8, 6, 20, 0.72), rgba(4, 3, 12, 0.97) 70%);
  backdrop-filter: blur(6px) saturate(0.6);
  cursor: pointer;
  animation: cine-in 0.3s ease both;
}

@keyframes cine-in { from { opacity: 0; } }

/* Rotating light rays behind the board. */
.cine__rays {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 180vmax;
  height: 180vmax;
  margin: -90vmax 0 0 -90vmax;
  background: repeating-conic-gradient(color-mix(in srgb, var(--wc) 26%, transparent) 0 5deg, transparent 5deg 18deg);
  -webkit-mask: radial-gradient(circle, #000 0, transparent 58%);
  mask: radial-gradient(circle, #000 0, transparent 58%);
  opacity: 0;
  transition: opacity 1.6s ease;
  animation: cine-rays 50s linear infinite;
}

.cine--suspense .cine__rays { opacity: 0.55; }
.cine--impact .cine__rays { opacity: 1; transition-duration: 0.1s; }
.cine--trace .cine__rays,
.cine--reveal .cine__rays { opacity: 0.5; transition-duration: 0.5s; }
.cine--title .cine__rays {
  opacity: 0.85;
  background: repeating-conic-gradient(color-mix(in srgb, var(--win-gold) 30%, transparent) 0 5deg, transparent 5deg 18deg);
  animation-duration: 24s;
}

@keyframes cine-rays { to { transform: rotate(360deg); } }

/* One vignette throb per heartbeat. */
.cine__pulse {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 22vmin 6vmin color-mix(in srgb, var(--wc) 55%, transparent);
  opacity: 0;
  pointer-events: none;
}

.cine--suspense .cine__pulse { animation: cine-pulse 0.5s ease-out; }

@keyframes cine-pulse {
  0% { opacity: 0.9; }
  100% { opacity: 0; }
}

/* Letterbox bars: in for the suspense, out for the reveal. */
.cine__bars i {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  height: 12vh;
  background: #000;
  transition: transform 0.6s var(--ease-out);
}

.cine__bars i:first-child { top: 0; transform: translateY(-100%); }
.cine__bars i:last-child { bottom: 0; transform: translateY(100%); }

.cine--freeze .cine__bars i,
.cine--suspense .cine__bars i,
.cine--impact .cine__bars i { transform: none; }

.cine__bars span {
  color: rgba(255, 255, 255, 0.82);
  font-family: var(--font-display);
  font-size: clamp(16px, 3.4vh, 26px);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0;
  transition: opacity 0.5s ease 0.4s;
}

.cine--suspense .cine__bars span { opacity: 1; animation: cine-caption 1.1s ease-in-out infinite alternate; }

.cine--impact .cine__bars span {
  opacity: 1;
  color: var(--win-gold);
  transition: none;
  animation: cine-answer 0.45s var(--ease-snap) both;
}

@keyframes cine-answer {
  0% { transform: scale(2.2); }
  100% { transform: none; }
}

@keyframes cine-caption {
  from { letter-spacing: 0.12em; }
  to { letter-spacing: 0.2em; }
}

.cine__stage {
  position: relative;
  z-index: 1;
}

.cine--impact .cine__stage { animation: cine-shake 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97); }

@keyframes cine-shake {
  10%, 90% { transform: translate(-3px, 2px); }
  20%, 80% { transform: translate(7px, -4px); }
  30%, 50%, 70% { transform: translate(-14px, 6px) rotate(-0.6deg); }
  40%, 60% { transform: translate(14px, -6px) rotate(0.6deg); }
}

.cine__camera {
  position: relative;
  will-change: transform;
}

.cine__board {
  display: grid;
  grid-template-columns: repeat(3, var(--cell));
  gap: calc(var(--cell) * 0.09);
  padding: calc(var(--cell) * 0.13);
  border-radius: calc(var(--cell) * 0.3);
  background: linear-gradient(160deg, var(--board-rim), var(--board-bg) 40%);
  box-shadow: var(--shadow-tray), 0 0 90px -20px var(--wc);
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

.cine--suspense .cine__cell.is-focus {
  box-shadow:
    inset 0 2px 5px var(--groove),
    inset 0 0 0 1.5px color-mix(in srgb, var(--wc) 60%, transparent),
    0 0 40px -6px var(--wc);
}

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
  transition: opacity 0.5s ease;
}

.cine__piece.is-dim { filter: grayscale(0.75) brightness(0.4); }
.cine__piece.is-faded { opacity: 0.4; }

/* The falling piece: fast at first, then almost frozen above its slot. */
.cine--freeze .cine__piece.is-last { opacity: 0; }

.cine--suspense .cine__piece.is-last {
  animation: cine-fall calc(var(--suspense) - 380ms) cubic-bezier(0.05, 0.55, 0.15, 1) both;
}

@keyframes cine-fall {
  0% { opacity: 0; transform: translateY(calc(var(--cell) * -1.7)) scale(3.2) rotate(-240deg); }
  12% { opacity: 1; }
  100% { opacity: 1; transform: translateY(calc(var(--cell) * -0.3)) scale(1.32) rotate(-8deg); }
}

.cine--impact .cine__piece.is-last {
  animation: cine-slam 0.14s cubic-bezier(0.7, 0, 1, 1) both;
}

@keyframes cine-slam {
  0% { transform: translateY(calc(var(--cell) * -0.3)) scale(1.32) rotate(-8deg); }
  100% { transform: none; }
}

/* Targeting ring that keeps closing on the empty slot. */
.cine__reticle {
  position: absolute;
  inset: -6%;
  border: 2px dashed var(--wc);
  border-radius: 50%;
  opacity: 0;
  pointer-events: none;
}

.cine--suspense .cine__reticle { animation: cine-reticle 0.95s ease-in infinite; }

@keyframes cine-reticle {
  0% { opacity: 0; transform: scale(2.3) rotate(0deg); }
  40% { opacity: 0.9; }
  100% { opacity: 0; transform: scale(0.95) rotate(90deg); }
}

.cine__piece.is-lit {
  animation: cine-lit 0.55s var(--ease-snap) both, cine-glow 0.8s 0.55s ease-in-out infinite alternate;
}

@keyframes cine-lit {
  0% { transform: scale(1.7); filter: brightness(2.6) drop-shadow(0 0 20px var(--win-gold)); }
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
  animation: cine-shock 0.8s var(--ease-out) both;
}

.cine__shock--late { border-color: var(--win-gold); animation-delay: 0.12s; }
.cine__shock--later { border-color: #fff; animation-delay: 0.26s; }

.cine__shock--gold {
  inset: -30%;
  border-color: var(--win-gold);
  animation-duration: 0.55s;
}

@keyframes cine-shock {
  0% { opacity: 1; transform: scale(0.4); }
  100% { opacity: 0; transform: scale(3.2); border-width: 1px; }
}

.cine__flash {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: radial-gradient(circle at 50% 50%, #fff, color-mix(in srgb, var(--wc) 70%, transparent) 45%, transparent 75%);
  opacity: 0;
  pointer-events: none;
}

.cine--impact .cine__flash { animation: cine-flash 0.7s ease-out; }

@keyframes cine-flash {
  0% { opacity: 1; }
  100% { opacity: 0; }
}

.cine__burst { z-index: 2; }

.cine__line {
  position: absolute;
  /* Above every cell, including the focused one (z-index 2). */
  z-index: 6;
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
  animation: cine-line 0.5s var(--ease-out) forwards;
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
  animation: cine-letter 0.6s var(--ease-snap) both;
}

@keyframes cine-letter {
  0% { opacity: 0; transform: translateY(-80%) scale(2) rotate(-14deg); }
  100% { opacity: 1; transform: none; }
}

.cine__title p {
  color: rgba(255, 255, 255, 0.85);
  font-family: var(--font-display);
  font-size: clamp(18px, 3vw, 26px);
  font-weight: 700;
  animation: st-pop-in 0.5s 0.5s var(--ease-out) both;
}

.cine__skip {
  position: absolute;
  top: calc(12px + env(safe-area-inset-top, 0px));
  right: 16px;
  z-index: 4;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-weight: 600;
}
</style>
