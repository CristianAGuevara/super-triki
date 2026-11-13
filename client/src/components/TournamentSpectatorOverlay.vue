<template>
  <div
    class="group-spectator"
    role="dialog"
    aria-modal="true"
    aria-label="Partida del torneo en modo espectador"
  >
    <WinCinematic v-if="gameStore.cinematicActive" @done="gameStore.finishCinematic()" />
    <header class="group-spectator__header">
      <div class="group-spectator__identity">
        <span class="group-spectator__eyebrow">Modo espectador</span>
        <strong>{{ groupLabel }}</strong>
        <span v-if="!gameStore.isGameOver" class="group-spectator__turn">
          Turno: {{ turnLabel }}
        </span>
      </div>
      <button
        type="button"
        class="group-spectator__back"
        data-tv-close
        @click="emit('close')"
      >
        Volver a la sala de espera
      </button>
    </header>

    <main class="group-spectator__main">
      <aside class="group-spectator__side">
        <PlayerPanel v-if="roomStore.players[0]" :player="roomStore.players[0].slot" :my-slot="null" />
        <PlayerPanel v-if="roomStore.players[2]" :player="roomStore.players[2].slot" :my-slot="null" />
      </aside>

      <section class="group-spectator__center">
        <MatchClocks />
        <div class="group-spectator__board">
          <Board />
        </div>
        <Scoreboard />
      </section>

      <aside class="group-spectator__side">
        <PlayerPanel v-if="roomStore.players[1]" :player="roomStore.players[1].slot" :my-slot="null" />
        <PlayerPanel v-if="roomStore.players[3]" :player="roomStore.players[3].slot" :my-slot="null" />
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoomStore } from '@/stores/roomStore'
import { useGameStore } from '@/stores/gameStore'
import Board from '@/components/Board.vue'
import PlayerPanel from '@/components/PlayerPanel.vue'
import Scoreboard from '@/components/Scoreboard.vue'
import MatchClocks from '@/components/MatchClocks.vue'
import WinCinematic from '@/components/WinCinematic.vue'

defineProps<{ groupLabel: string }>()
const emit = defineEmits<{ close: [] }>()

const roomStore = useRoomStore()
const gameStore = useGameStore()

const turnLabel = computed(() =>
  roomStore.players.find(player => player.slot === gameStore.currentPlayer)?.username
    ?? gameStore.playerMeta[gameStore.currentPlayer]?.label
    ?? 'Jugador'
)
</script>

<style scoped>
.group-spectator {
  position: fixed;
  inset: 0;
  z-index: 350;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
  padding: 18px clamp(12px, 3vw, 34px) 24px;
  background: var(--page-bg);
  background-image: var(--page-gradient);
}

.group-spectator__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.group-spectator__identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-spectator__eyebrow {
  color: var(--accent-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.group-spectator__identity strong {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 24px;
  letter-spacing: -0.02em;
}

.group-spectator__turn {
  color: var(--text-secondary);
  font-size: 14px;
}

.group-spectator__back {
  min-height: 44px;
  padding: 8px 18px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--control-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.group-spectator__back:hover { background: var(--control-hover); }

.group-spectator__main {
  display: flex;
  flex: 1;
  align-items: flex-start;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
}

.group-spectator__side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-spectator__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.group-spectator__board {
  transform-origin: top center;
}

@media (max-width: 820px) {
  .group-spectator {
    padding-top: 12px;
  }

  .group-spectator__main {
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: center;
  }

  .group-spectator__side {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
  }

}
</style>
