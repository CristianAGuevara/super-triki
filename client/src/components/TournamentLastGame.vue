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
                class="last-game__piece st-ring"
                :class="[
                  `last-game__piece--${size}`,
                  `st-ring--${size}`,
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

      <div class="last-game__summary">
        <span class="last-game__summary-label">Cómo terminó</span>
        <strong>{{ conditionLabel }}</strong>
        <p>{{ summaryText }}</p>
        <small>Los anillos con brillo dorado forman la jugada ganadora.</small>
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

const conditionLabel = computed(() => {
  if (!props.result.game.winResult) return 'Tablero completo'
  const labels = {
    'same-size': 'Línea del mismo tamaño',
    'ordered-sequence': 'Secuencia ordenada',
    'complete-cell': 'Casilla completa',
    timeout: 'Tiempo agotado',
  }
  return labels[props.result.game.winResult.condition]
})

const summaryText = computed(() => {
  if (!props.result.game.winResult) {
    return 'Ya no quedaban movimientos posibles.'
  }
  if (props.result.game.winResult.condition === 'timeout') {
    return `${winnerName.value} ganó porque su rival agotó el tiempo.`
  }
  return `${winnerName.value} encontró la combinación ganadora.`
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
  border-radius: var(--radius-l);
  background: var(--surface);
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
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.last-game__header strong {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 18px;
}

.last-game__result {
  padding: 5px 9px;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 50%, transparent);
  border-radius: 999px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
}

.last-game__result--draw {
  border-color: var(--line-soft);
  color: var(--text-secondary);
}

.last-game__body {
  display: grid;
  grid-template-columns: auto minmax(150px, 180px) minmax(190px, 1fr);
  align-items: center;
  gap: 18px;
}

.last-game__board {
  --preview-cell: 72px;
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: repeat(3, var(--preview-cell));
  gap: calc(var(--preview-cell) * 0.09);
  padding: calc(var(--preview-cell) * 0.14);
  border-radius: calc(var(--preview-cell) * 0.3);
  background: linear-gradient(160deg, var(--board-rim), var(--board-bg) 40%);
  box-shadow: var(--shadow-tray);
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
  border-radius: calc(var(--preview-cell) * 0.22);
  background: var(--cell-bg);
  box-shadow: inset 0 2px 5px var(--groove), 0 1px 0 var(--groove-light);
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
  border: 1px solid var(--placeholder-border);
  border-radius: 50%;
  box-shadow: inset 0 1px 2px var(--groove);
  opacity: 0.6;
}

.last-game__piece { display: block; }

.last-game__piece--large {
  width: calc(var(--preview-cell) * 0.68);
  height: calc(var(--preview-cell) * 0.68);
}

.last-game__piece--medium {
  width: calc(var(--preview-cell) * 0.42);
  height: calc(var(--preview-cell) * 0.42);
}

.last-game__piece--small {
  width: calc(var(--preview-cell) * 0.18);
  height: calc(var(--preview-cell) * 0.18);
}

.last-game__piece--win {
  animation: last-game-win-pulse 0.9s ease-in-out infinite alternate;
}

@keyframes last-game-win-pulse {
  from { filter: drop-shadow(0 0 3px var(--win-gold)); }
  to { filter: drop-shadow(0 0 10px var(--win-gold)) brightness(1.25); }
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
  font-size: 14px;
}

.last-game__color-dot {
  width: 10px;
  height: 10px;
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
  color: var(--win-gold);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.last-game__summary {
  align-self: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 12px 14px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-m);
  background: var(--surface-muted);
}

.last-game__summary-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.last-game__summary strong {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 16px;
}

.last-game__summary p {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.last-game__summary small {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.35;
}

@media (max-width: 760px) {
  .last-game__body {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .last-game__summary {
    grid-column: 1 / -1;
  }
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
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .last-game__players {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
  }

  .last-game__summary {
    width: 100%;
    text-align: center;
  }

  .last-game__winner {
    margin-left: 0;
  }
}
</style>
