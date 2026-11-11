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
      <span class="match-clock__dot" />
      <span class="match-clock__name">{{ playerName(slot) }}</span>
      <strong>{{ formatted(slot) }}</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Player } from '@/types/game'
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'

const store = useGameStore()
const roomStore = useRoomStore()
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
  gap: 6px;
  width: 100%;
}

.match-clock {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 5px 10px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--control-bg);
  color: var(--text-secondary);
  font-size: 11px;
}

.match-clock__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-faint);
}

.match-clock__name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-clock strong {
  color: var(--text-primary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.match-clock--active {
  border-color: var(--accent-primary);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent-primary) 15%, transparent);
}

.match-clock--active .match-clock__dot {
  background: var(--accent-primary);
  box-shadow: 0 0 7px var(--accent-primary);
}

.match-clock--urgent strong {
  color: var(--accent-danger);
}

.match-clock--out {
  opacity: 0.45;
  text-decoration: line-through;
}
</style>
