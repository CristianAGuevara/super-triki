<template>
  <div
    class="match-result"
    role="status"
    aria-live="assertive"
    :style="{ '--winner-color': accent }"
  >
    <div v-if="!isDraw" class="match-result__confetti" aria-hidden="true">
      <span
        v-for="piece in confetti"
        :key="piece.id"
        :style="{
          left: `${piece.left}%`,
          '--confetti-color': piece.color,
          '--confetti-width': `${piece.width}px`,
          '--confetti-height': `${piece.height}px`,
          '--confetti-delay': `${piece.delay}s`,
          '--confetti-duration': `${piece.duration}s`,
          '--confetti-drift': `${piece.drift}px`,
          '--confetti-spin': `${piece.spin}deg`,
          '--confetti-radius': piece.radius,
        }"
      />
    </div>

    <article class="match-result__card">
      <span class="match-result__mark" aria-hidden="true">{{ isDraw ? '=' : '★' }}</span>
      <span class="match-result__eyebrow">{{ isDraw ? 'Partida terminada' : 'Ganador' }}</span>
      <h2>{{ isDraw ? 'Empate' : winnerName }}</h2>
      <p v-if="!isDraw">se lleva la victoria</p>

      <div class="match-result__countdown" :aria-label="`${countdown} segundos`">
        <strong>{{ countdown }}</strong>
        <span>{{ destinationLabel }}</span>
      </div>
      <small>
        En {{ countdown }} segundo{{ countdown === 1 ? '' : 's' }} irás a {{ destinationLabel }}.
      </small>
    </article>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  winnerName: string
  isDraw: boolean
  countdown: number
  accent: string
  destinationLabel: string
}>()

const colors = [
  'var(--player-1-color)',
  'var(--player-2-color)',
  'var(--player-3-color)',
  'var(--player-4-color)',
  'var(--accent-primary)',
  'var(--accent-secondary)',
  'var(--player-color-emerald)',
  'var(--player-color-violet)',
]

const confetti = Array.from({ length: 72 }, (_, index) => ({
  id: index,
  left: Math.random() * 100,
  color: colors[index % colors.length],
  width: 5 + Math.random() * 7,
  height: 8 + Math.random() * 10,
  delay: Math.random() * 0.8,
  duration: 1.8 + Math.random() * 1.6,
  drift: -110 + Math.random() * 220,
  spin: 220 + Math.random() * 900,
  radius: Math.random() > 0.75 ? '50%' : '2px',
}))
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
  background: var(--overlay-bg);
  backdrop-filter: blur(6px);
}

.match-result__confetti {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.match-result__confetti span {
  position: absolute;
  top: -12vh;
  width: var(--confetti-width);
  height: var(--confetti-height);
  border-radius: var(--confetti-radius);
  background: var(--confetti-color);
  box-shadow: 0 0 8px color-mix(in srgb, var(--confetti-color) 50%, transparent);
  opacity: 0;
  animation: confetti-fall var(--confetti-duration) linear var(--confetti-delay) forwards;
}

@keyframes confetti-fall {
  0% {
    opacity: 1;
    transform: translate3d(0, -8vh, 0) rotate(0deg);
  }
  100% {
    opacity: 0.9;
    transform: translate3d(var(--confetti-drift), 112vh, 0) rotate(var(--confetti-spin));
  }
}

.match-result__card {
  position: relative;
  display: flex;
  width: min(420px, calc(100vw - 32px));
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 26px 28px 22px;
  border: 1px solid color-mix(in srgb, var(--winner-color) 48%, var(--line-soft));
  border-radius: 24px;
  background: var(--cell-bg);
  box-shadow: var(--shadow-card), 0 0 36px color-mix(in srgb, var(--winner-color) 22%, transparent);
  text-align: center;
}

.match-result__card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 14%;
  right: 14%;
  height: 3px;
  border-radius: 0 0 10px 10px;
  background: var(--winner-color);
}

.match-result__mark {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border: 2px solid var(--winner-color);
  border-radius: 50%;
  color: var(--winner-color);
  font-size: 28px;
  line-height: 1;
  box-shadow: 0 0 22px color-mix(in srgb, var(--winner-color) 30%, transparent);
}

.match-result__eyebrow {
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.2px;
  text-transform: uppercase;
}

.match-result__card h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(28px, 7vw, 40px);
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.match-result__card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.match-result__countdown {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 8px 13px 8px 9px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--control-bg);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
}

.match-result__countdown strong {
  display: grid;
  place-items: center;
  width: 31px;
  height: 31px;
  border: 1px solid var(--winner-color);
  border-radius: 50%;
  color: var(--winner-color);
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}

.match-result__card small {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 10px;
}
</style>
