<template>
  <div class="scoreboard">
    <div class="scoreboard__header">
      <span class="scoreboard__title">Marcador</span>
      <span class="scoreboard__round">Ronda {{ roomStore.roundNumber + 1 }}</span>
    </div>

    <div class="scoreboard__rows">
      <div
        v-for="(entry, i) in sortedEntries"
        :key="entry.slot"
        class="scoreboard__row"
        :class="{ 'scoreboard__row--leader': i === 0 && entry.wins > 0 }"
        :style="{ '--accent': gameStore.playerMeta[entry.slot]?.color }"
      >
        <span class="scoreboard__rank">{{ i + 1 }}</span>
        <span class="scoreboard__dot" />
        <span class="scoreboard__name">
          {{ entry.username }}
          <span v-if="entry.slot === roomStore.mySlot" class="scoreboard__you">(tú)</span>
        </span>
        <span class="scoreboard__wins">{{ entry.wins }}</span>
        <span class="scoreboard__label">{{ entry.wins === 1 ? 'victoria' : 'victorias' }}</span>
      </div>

      <div v-if="sortedEntries.length === 0" class="scoreboard__empty">
        Sin partidas aún
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoomStore } from '@/stores/roomStore'
import { useGameStore } from '@/stores/gameStore'

const roomStore = useRoomStore()
const gameStore = useGameStore()

const sortedEntries = computed(() => {
  return roomStore.players
    .map(p => ({
      slot:     p.slot,
      username: p.username,
      wins:     roomStore.scores[p.slot] ?? 0,
    }))
    .sort((a, b) => b.wins - a.wins)
})
</script>

<style scoped>
.scoreboard {
  background: var(--cell-bg);
  border: 2px solid var(--cell-border);
  border-radius: 12px;
  padding: 14px 16px;
  min-width: 200px;
}

.scoreboard__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.scoreboard__title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  font-weight: 700;
}

.scoreboard__round {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--control-bg);
  padding: 2px 8px;
  border-radius: 20px;
  border: 1px solid var(--cell-border);
}

.scoreboard__rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scoreboard__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: border-color 0.2s;
}

.scoreboard__row--leader {
  border-color: var(--accent);
  background: var(--surface-muted);
}

.scoreboard__rank {
  font-size: 11px;
  color: var(--text-muted);
  width: 12px;
  text-align: center;
  flex-shrink: 0;
}

.scoreboard__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.scoreboard__name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.scoreboard__you {
  font-weight: 400;
  color: var(--text-muted);
  font-size: 11px;
}

.scoreboard__wins {
  font-size: 18px;
  font-weight: 800;
  color: var(--accent);
  line-height: 1;
  flex-shrink: 0;
}

.scoreboard__label {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.scoreboard__empty {
  font-size: 12px;
  color: var(--text-faint);
  text-align: center;
  padding: 8px 0;
}
</style>
