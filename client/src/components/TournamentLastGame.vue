<template>
  <section class="last-game">
    <header class="last-game__header">
      <div>
        <span class="last-game__eyebrow">Última partida</span>
        <strong>{{ result.groupLabel }} · Ronda {{ result.stage }}</strong>
      </div>
      <span class="last-game__result" :class="{ 'last-game__result--draw': !result.game.winResult }">
        {{ resultLabel }}
      </span>
    </header>

    <div class="last-game__body">
      <div class="last-game__board" aria-label="Tablero final de la última partida">
        <div
          v-for="(row, rowIndex) in result.game.board"
          :key="rowIndex"
          class="last-game__row"
        >
          <div
            v-for="(_, colIndex) in row"
            :key="colIndex"
            class="last-game__cell"
          >
            <div
              v-for="size in SIZE_ORDER"
              :key="size"
              class="last-game__ring"
              :class="`last-game__ring--${size}`"
            >
              <span
                v-if="pieceAt(rowIndex, colIndex, size)"
                class="last-game__piece"
                :class="[
                  `last-game__piece--${size}`,
                  { 'last-game__piece--win': isHighlighted(rowIndex, colIndex, size) },
                ]"
                :style="{ '--piece-color': colorFor(pieceAt(rowIndex, colIndex, size)!.player) }"
              />
              <span v-else class="last-game__empty" />
            </div>
          </div>
        </div>
      </div>

      <div class="last-game__players">
        <div
          v-for="player in result.players"
          :key="player.slot"
          class="last-game__player"
        >
          <span
            class="last-game__color-dot"
            :style="{ background: colorFor(player.slot) }"
          />
          <span class="last-game__player-name">{{ player.username }}</span>
          <span
            v-if="result.game.winResult?.winner === player.slot"
            class="last-game__winner"
          >
            Ganador
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Piece, Player, Size } from '@/types/game'
import { SIZE_ORDER, playerColorCss } from '@/types/game'
import type { TournamentLastGameSnapshot } from '@/types/tournament'

const props = defineProps<{ result: TournamentLastGameSnapshot }>()

const winnerName = computed(() => {
  const winnerSlot = props.result.game.winResult?.winner
  if (winnerSlot === undefined) return ''
  return props.result.players.find(player => player.slot === winnerSlot)?.username
    ?? `Jugador ${winnerSlot}`
})

const resultLabel = computed(() => {
  if (!props.result.game.winResult) return 'Empate'
  if (props.result.game.winResult.condition === 'timeout') {
    return `Ganó ${winnerName.value} por tiempo`
  }
  return `Ganó ${winnerName.value}`
})

function pieceAt(row: number, col: number, size: Size): Piece | null {
  return props.result.game.board[row]?.[col]?.[size] ?? null
}

function isHighlighted(row: number, col: number, size: Size): boolean {
  return props.result.game.winResult?.highlights.some(
    highlight => highlight.coord[0] === row && highlight.coord[1] === col && highlight.size === size,
  ) ?? false
}

function colorFor(slot: Player): string {
  const player = props.result.players.find(candidate => candidate.slot === slot)
  return playerColorCss(player?.color, slot)
}
</script>

<style scoped>
.last-game {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-card);
}

.last-game__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.last-game__header > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.last-game__eyebrow {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.last-game__header strong {
  color: var(--text-primary);
  font-size: 14px;
}

.last-game__result {
  padding: 5px 9px;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 50%, transparent);
  border-radius: 999px;
  color: var(--accent-primary);
  font-size: 11px;
  font-weight: 800;
}

.last-game__result--draw {
  border-color: var(--line-soft);
  color: var(--text-secondary);
}

.last-game__body {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.last-game__board {
  --preview-cell: 72px;
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: repeat(3, var(--preview-cell));
  gap: 7px;
  padding: 11px;
  border-radius: 14px;
  background: var(--board-bg);
  box-shadow: var(--shadow-glow);
}

.last-game__row {
  display: contents;
}

.last-game__cell {
  position: relative;
  display: flex;
  width: var(--preview-cell);
  height: var(--preview-cell);
  align-items: center;
  justify-content: center;
  border: 2px solid var(--cell-border);
  border-radius: 10px;
  background: var(--cell-bg);
}

.last-game__ring {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.last-game__ring--large { width: calc(var(--preview-cell) * 0.77); height: calc(var(--preview-cell) * 0.77); }
.last-game__ring--medium { width: calc(var(--preview-cell) * 0.53); height: calc(var(--preview-cell) * 0.53); }
.last-game__ring--small { width: calc(var(--preview-cell) * 0.28); height: calc(var(--preview-cell) * 0.28); }

.last-game__empty {
  display: block;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border: 1px dashed var(--placeholder-border);
  border-radius: 50%;
  opacity: 0.5;
}

.last-game__piece {
  display: block;
  box-sizing: border-box;
  border-radius: 50%;
  border: 0 solid var(--piece-color);
  box-shadow: 0 0 7px color-mix(in srgb, var(--piece-color) 65%, transparent);
}

.last-game__piece--large {
  width: calc(var(--preview-cell) * 0.68);
  height: calc(var(--preview-cell) * 0.68);
  border-width: 4px;
}

.last-game__piece--medium {
  width: calc(var(--preview-cell) * 0.42);
  height: calc(var(--preview-cell) * 0.42);
  border-width: 3px;
}

.last-game__piece--small {
  width: calc(var(--preview-cell) * 0.18);
  height: calc(var(--preview-cell) * 0.18);
  background: var(--piece-color);
}

.last-game__piece--win {
  box-shadow:
    0 0 8px gold,
    0 0 16px color-mix(in srgb, gold 55%, transparent);
  animation: last-game-win-pulse 0.9s ease-in-out infinite alternate;
}

@keyframes last-game-win-pulse {
  from { filter: drop-shadow(0 0 3px gold); }
  to { filter: drop-shadow(0 0 10px gold) brightness(1.25); }
}

.last-game__players {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 150px;
}

.last-game__player {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-secondary);
  font-size: 12px;
}

.last-game__color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 6px currentColor;
}

.last-game__player-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.last-game__winner {
  margin-left: auto;
  color: var(--accent-primary);
  font-size: 9px;
  font-weight: 900;
  text-transform: uppercase;
}

@media (max-width: 520px) {
  .last-game {
    padding: 12px;
  }

  .last-game__board {
    --preview-cell: clamp(48px, 20vw, 62px);
    margin: 0 auto;
  }

  .last-game__body {
    justify-content: center;
  }

  .last-game__players {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
  }

  .last-game__winner {
    margin-left: 0;
  }
}
</style>
