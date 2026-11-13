<template>
  <div v-if="hasClocks" class="match-clocks" aria-label="Tiempo restante por jugador">
    <div
      v-for="slot in store.players"
      :key="slot"
      class="match-clock"
      :class="{
        'match-clock--active': slot === store.currentPlayer && !store.isGameOver,
        'match-clock--urgent': isUrgent(slot),
        'match-clock--out': store.eliminatedByTimeout.includes(slot),
      }"
    >
      <span class="match-clock__dot" :style="{ background: store.playerMeta[slot]?.color }" />
      <span class="match-clock__name">{{ playerName(slot) }}</span>
      <strong>{{ formatted(slot) }}</strong>
      <span class="match-clock__bar" :style="{ transform: `scaleX(${fraction(slot)})` }" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Player } from '@/types/game'
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'
import { useAudioStore } from '@/stores/audioStore'

const store = useGameStore()
const roomStore = useRoomStore()
const audioStore = useAudioStore()
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

const hasClocks = computed(() =>
  Object.keys(store.playerClocks).length > 0
)

function remainingMs(slot: Player): number {
  const stored = store.playerClocks[slot] ?? 0
  if (slot === store.currentPlayer && !store.isGameOver) {
    return Math.max(0, stored - (now.value - store.turnStartedAt))
  }
  return Math.max(0, stored)
}

function formatted(slot: Player): string {
  const seconds = Math.ceil(remainingMs(slot) / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

const initialClock = ref(0)
watch(() => store.playerClocks, clocks => {
  const max = Math.max(0, ...Object.values(clocks).map(value => value ?? 0))
  if (max > initialClock.value) initialClock.value = max
}, { immediate: true, deep: true })

function fraction(slot: Player): number {
  if (!initialClock.value) return 1
  return Math.min(1, remainingMs(slot) / initialClock.value)
}

// Audible countdown in the last ten seconds of my own clock.
const mySecondsLeft = computed(() => {
  const slot = roomStore.mySlot
  if (!hasClocks.value || !slot || slot !== store.currentPlayer || store.isGameOver) return null
  return Math.ceil(remainingMs(slot) / 1000)
})
watch(mySecondsLeft, (seconds, previous) => {
  if (seconds !== null && previous !== null && seconds < previous && seconds <= 10 && seconds > 0) {
    audioStore.playSfx('tick')
  }
})

function isUrgent(slot: Player): boolean {
  return remainingMs(slot) <= 30_000 && !store.isGameOver
}

function playerName(slot: Player): string {
  return roomStore.players.find(player => player.slot === slot)?.username
    ?? store.playerMeta[slot]?.label
    ?? `Jugador ${slot}`
}

onMounted(() => {
  ticker = setInterval(() => { now.value = Date.now() }, 250)
})

onUnmounted(() => {
  if (ticker) clearInterval(ticker)
})
</script>

<style scoped>
.match-clocks {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.match-clock {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 6px 12px;
  overflow: hidden;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12px;
  transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.3s var(--ease-spring);
}

.match-clock__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--text-faint);
  flex-shrink: 0;
}

.match-clock__name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-clock strong {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.match-clock__bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: var(--text-faint);
  transform-origin: left;
  transition: transform 0.25s linear;
}

.match-clock--active {
  border-color: color-mix(in srgb, var(--accent-primary) 70%, transparent);
  box-shadow: 0 0 22px -6px color-mix(in srgb, var(--accent-primary) 60%, transparent);
  transform: translateY(-1px);
}

.match-clock--active .match-clock__bar { background: var(--accent-primary); }

.match-clock--urgent strong { color: var(--accent-danger); }
.match-clock--urgent .match-clock__bar { background: var(--accent-danger); }
.match-clock--urgent.match-clock--active { animation: clock-urgent 1s ease-in-out infinite; }

@keyframes clock-urgent {
  50% { box-shadow: 0 0 26px -4px color-mix(in srgb, var(--accent-danger) 75%, transparent); }
}

.match-clock--out {
  opacity: 0.45;
  text-decoration: line-through;
}
</style>
