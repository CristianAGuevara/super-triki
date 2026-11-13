<template>
  <div class="scoreboard">
    <div class="scoreboard__header">
      <span class="st-eyebrow">Marcador</span>
      <span class="scoreboard__round">Ronda {{ roomStore.roundNumber + 1 }}</span>
    </div>

    <TransitionGroup name="score-row" tag="div" class="scoreboard__rows">
      <div
        v-for="(entry, i) in sortedEntries"
        :key="entry.slot"
        class="scoreboard__row"
        :class="{ 'scoreboard__row--leader': i === 0 && entry.wins > 0 }"
        :style="{ '--accent': gameStore.playerMeta[entry.slot]?.color }"
      >
        <span class="scoreboard__rank">{{ i === 0 && entry.wins > 0 ? '★' : i + 1 }}</span>
        <span class="scoreboard__dot" />
        <span class="scoreboard__name">
          {{ entry.username }}
          <span v-if="entry.slot === roomStore.mySlot" class="scoreboard__you">tú</span>
        </span>
        <span :key="entry.wins" class="scoreboard__wins">{{ entry.wins }}</span>
        <span class="scoreboard__label">{{ entry.wins === 1 ? 'victoria' : 'victorias' }}</span>
      </div>
    </TransitionGroup>

    <div v-if="sortedEntries.length === 0" class="scoreboard__empty">
      Sin partidas aún
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
  min-width: 220px;
  padding: 14px 14px 12px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-m);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.scoreboard__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.scoreboard__round {
  padding: 2px 9px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
}

.scoreboard__rows {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scoreboard__row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 9px;
  border-radius: var(--radius-xs);
  transition: background 0.2s;
}

.scoreboard__row--leader {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.scoreboard__rank {
  width: 14px;
  flex-shrink: 0;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  text-align: center;
}

.scoreboard__row--leader .scoreboard__rank { color: var(--win-gold); }

.scoreboard__dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--accent);
}

.scoreboard__name {
  flex: 1;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scoreboard__you {
  margin-left: 4px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.scoreboard__wins {
  flex-shrink: 0;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
  animation: score-bump 0.5s var(--ease-snap);
}

@keyframes score-bump {
  0% { transform: scale(1.6); color: var(--accent); }
}

.scoreboard__label {
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 11px;
}

.scoreboard__empty {
  padding: 8px 0;
  color: var(--text-faint);
  font-size: 12px;
  text-align: center;
}

.score-row-move { transition: transform 0.4s var(--ease-out); }
</style>
