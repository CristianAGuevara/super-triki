<template>
  <div
    class="match-result"
    role="status"
    aria-live="assertive"
    :style="{ '--winner-color': accent, '--piece-color': accent }"
  >
    <RingBurst v-if="!isDraw" :colors="burstColors" />

    <article class="match-result__card">
      <div class="match-result__emblem" aria-hidden="true">
        <template v-if="!isDraw">
          <span class="st-ring st-ring--large match-result__ring match-result__ring--large" />
          <span class="st-ring st-ring--medium match-result__ring match-result__ring--medium" />
          <span class="st-ring st-ring--small match-result__ring match-result__ring--small" />
        </template>
        <span v-else class="match-result__draw">=</span>
      </div>

      <span class="st-eyebrow">{{ isDraw ? 'Partida terminada' : 'Ganador de la ronda' }}</span>
      <h2>{{ isDraw ? 'Empate' : winnerName }}</h2>
      <p>{{ isDraw ? 'Nadie consiguió cerrar una línea.' : 'se lleva la victoria' }}</p>

      <div class="match-result__countdown">
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="15.5" class="match-result__track" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            class="match-result__progress"
            pathLength="1"
            :style="{ strokeDashoffset: String(1 - countdown / 3) }"
          />
        </svg>
        <strong :aria-label="`${countdown} segundos`">{{ countdown }}</strong>
      </div>
      <small>Volviendo a {{ destinationLabel }}…</small>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import RingBurst from './RingBurst.vue'

const props = defineProps<{
  winnerName: string
  isDraw: boolean
  countdown: number
  accent: string
  destinationLabel: string
}>()

const burstColors = computed(() => [
  props.accent,
  props.accent,
  'var(--win-gold)',
  'var(--accent-secondary)',
  'var(--player-2-color)',
  'var(--player-color-emerald)',
])
</script>

<style scoped>
.match-result {
  position: fixed;
  inset: 0;
  z-index: 400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--winner-color) 22%, transparent), transparent 55%),
    var(--overlay-bg);
  backdrop-filter: blur(8px);
  animation: result-fade 0.3s ease both;
}

@keyframes result-fade { from { opacity: 0; } }

.match-result__card {
  position: relative;
  z-index: 1;
  display: flex;
  width: min(420px, calc(100vw - 32px));
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 30px 28px 24px;
  border: 1px solid color-mix(in srgb, var(--winner-color) 45%, var(--line-soft));
  border-radius: var(--radius-l);
  background: var(--surface);
  box-shadow: var(--shadow-card), 0 0 60px -10px color-mix(in srgb, var(--winner-color) 50%, transparent);
  text-align: center;
  animation: result-card 0.6s 0.05s var(--ease-snap) both;
}

@keyframes result-card {
  0% { opacity: 0; transform: scale(0.8) translateY(20px); }
  100% { opacity: 1; transform: none; }
}

.match-result__emblem {
  position: relative;
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  margin-bottom: 8px;
}

.match-result__ring {
  position: absolute;
  animation: emblem-drop 0.6s var(--ease-snap) both;
}

.match-result__ring--large { width: 96px; height: 96px; animation-delay: 0.2s; }
.match-result__ring--medium { width: 60px; height: 60px; animation-delay: 0.32s; }
.match-result__ring--small { width: 26px; height: 26px; animation-delay: 0.44s; }

@keyframes emblem-drop {
  0% { opacity: 0; transform: translateY(-40px) scale(1.3); }
  100% { opacity: 1; transform: none; }
}

.match-result__draw {
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  border: 2px dashed var(--line-strong);
  border-radius: 50%;
  color: var(--text-secondary);
  font-family: var(--font-display);
  font-size: 40px;
  font-weight: 800;
}

.match-result__card h2 {
  max-width: 100%;
  color: var(--text-primary);
  font-size: clamp(32px, 8vw, 48px);
  overflow-wrap: anywhere;
}

.match-result__card p {
  color: var(--text-secondary);
  font-size: 14px;
}

.match-result__countdown {
  position: relative;
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  margin-top: 14px;
}

.match-result__countdown svg {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
}

.match-result__track,
.match-result__progress {
  fill: none;
  stroke-width: 3;
}

.match-result__track { stroke: var(--line-soft); }

.match-result__progress {
  stroke: var(--winner-color);
  stroke-linecap: round;
  stroke-dasharray: 1;
  transition: stroke-dashoffset 1s linear;
}

.match-result__countdown strong {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.match-result__card small {
  color: var(--text-muted);
  font-size: 12px;
}
</style>
