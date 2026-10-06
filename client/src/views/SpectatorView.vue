<template>
  <div class="spectator">
    <header class="spectator__header">
      <div>
        <span class="spectator__eyebrow"><span class="spectator__live-dot" /> LIVE VIEW</span>
        <h1>{{ roomStore.name || 'Sala en directo' }}</h1>
        <span class="spectator__room-id">#{{ roomId }}</span>
      </div>
      <div class="spectator__status" :class="`spectator__status--${roomStore.phase}`">
        {{ statusLabel }}
      </div>
    </header>

    <div v-if="joining" class="spectator__message">
      <span class="spectator__loader" />
      Conectando con la partida…
    </div>

    <div v-else-if="errorMessage" class="spectator__message spectator__message--error">
      <strong>No se pudo abrir la partida</strong>
      <span>{{ errorMessage }}</span>
      <button class="spectator__back" @click="goHome">Volver al inicio</button>
    </div>

    <div v-else-if="roomStore.phase === 'waiting'" class="spectator__message">
      <span class="spectator__waiting-mark">◌</span>
      <strong>La partida aún no comienza</strong>
      <span>Esta pantalla se actualizará cuando el host inicie la ronda.</span>
    </div>

    <main v-else class="spectator__stage">
      <section class="spectator__side spectator__side--left">
        <PlayerPanel v-if="roomStore.players[0]" :player="roomStore.players[0].slot" :my-slot="null" />
        <PlayerPanel v-if="roomStore.players[2]" :player="roomStore.players[2].slot" :my-slot="null" />
      </section>

      <section class="spectator__center">
        <div class="spectator__turn">
          <span class="spectator__turn-label">Turno actual</span>
          <strong :style="{ color: turnColor }">{{ turnLabel }}</strong>
        </div>

        <div class="spectator__board-wrap">
          <Board />
        </div>

        <div v-if="gameStore.isGameOver" class="spectator__result">
          <span>{{ gameStore.isDraw ? 'EMPATE' : 'GANADOR' }}</span>
          <strong>{{ resultLabel }}</strong>
        </div>
        <div v-else-if="roomStore.phase === 'finished'" class="spectator__paused">
          PARTIDA EN PAUSA · ESPERANDO AL HOST
        </div>
        <div class="spectator__scoreboard">
          <Scoreboard />
        </div>
      </section>

      <section class="spectator__side spectator__side--right">
        <PlayerPanel v-if="roomStore.players[1]" :player="roomStore.players[1].slot" :my-slot="null" />
        <PlayerPanel v-if="roomStore.players[3]" :player="roomStore.players[3].slot" :my-slot="null" />
        <div class="spectator__rules">
          <span>3×3×3</span>
          <small>STACK ARENA</small>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/roomStore'
import { useGameStore } from '@/stores/gameStore'
import { useSocket } from '@/composables/useSocket'
import { connectSocket, disconnectSocket } from '@/services/socket'
import Board from '@/components/Board.vue'
import PlayerPanel from '@/components/PlayerPanel.vue'
import Scoreboard from '@/components/Scoreboard.vue'

const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()
const gameStore = useGameStore()
const { emitJoinSpectator } = useSocket()

const roomId = computed(() => String(route.params.id).toUpperCase())
const joining = ref(true)
const errorMessage = ref<string | null>(null)

const statusLabel = computed(() => {
  if (roomStore.phase === 'playing') return 'EN DIRECT'
  if (roomStore.phase === 'finished') return 'FINAL / PAUSA'
  return 'SALA ABIERTA'
})

const turnLabel = computed(() => {
  if (gameStore.isGameOver) return 'Ronda terminada'
  return roomStore.players.find(player => player.slot === gameStore.currentPlayer)?.username
    ?? `Jugador ${gameStore.currentPlayer}`
})

const turnColor = computed(() =>
  gameStore.playerMeta[gameStore.currentPlayer]?.color ?? 'var(--accent-primary)'
)

const resultLabel = computed(() => {
  if (!gameStore.winResult) return 'Tablero completo'
  return roomStore.players.find(player => player.slot === gameStore.winResult?.winner)?.username
    ?? `Jugador ${gameStore.winResult.winner}`
})

onMounted(async () => {
  roomStore.setSpectating(true)
  connectSocket()
  const result = await emitJoinSpectator(roomId.value)
  if (!result.ok || !result.roomId) {
    errorMessage.value = result.error ?? 'Sala no encontrada'
    joining.value = false
    return
  }
  roomStore.setRoomState(result.roomState!)
  joining.value = false
})

onUnmounted(() => {
  roomStore.reset()
  gameStore.initGame(2)
  disconnectSocket()
})

function goHome() {
  router.push('/')
}
</script>

<style scoped>
.spectator {
  min-height: calc(100vh - 53px);
  padding: clamp(22px, 4vw, 48px) clamp(16px, 5vw, 72px);
}

.spectator__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  max-width: 1440px;
  margin: 0 auto 28px;
}

.spectator__eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--accent-primary);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 2px;
}

.spectator__live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-danger);
  box-shadow: 0 0 12px var(--accent-danger);
  animation: spectator-pulse 1.2s ease-in-out infinite alternate;
}

.spectator h1 {
  margin-top: 8px;
  color: var(--text-primary);
  font-size: clamp(26px, 4vw, 46px);
  letter-spacing: -1.5px;
}

.spectator__room-id {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 2px;
}

.spectator__status {
  padding: 9px 14px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 1px;
}

.spectator__status--playing { color: var(--accent-primary); border-color: var(--accent-primary); }
.spectator__status--finished { color: var(--accent-secondary); }

.spectator__stage {
  display: grid;
  grid-template-columns: minmax(200px, 230px) minmax(360px, 1fr) minmax(200px, 250px);
  align-items: center;
  gap: clamp(20px, 4vw, 64px);
  max-width: 1440px;
  min-height: calc(100vh - 180px);
  margin: 0 auto;
}

.spectator__players {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.spectator__players :deep(.player-panel) {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  padding: 12px 8px;
}

.spectator__players :deep(.player-panel__header) {
  margin-bottom: 10px;
}

.spectator__players :deep(.player-panel__sets) {
  gap: 5px;
}

.spectator__players :deep(.player-panel__stack) {
  width: 58px;
  height: 58px;
}

.spectator__players :deep(.stack-ring--large) {
  width: 58px;
  height: 58px;
  border-width: 5px;
}

.spectator__players :deep(.stack-ring--medium) {
  width: 38px;
  height: 38px;
  border-width: 4px;
}

.spectator__players :deep(.stack-ring--small) {
  width: 20px;
  height: 20px;
  border-width: 3px;
}

.spectator__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.spectator__turn {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 8px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--surface-muted);
}

.spectator__turn-label {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.spectator__turn strong { font-size: 15px; }

.spectator__board-wrap {
  filter: drop-shadow(0 18px 32px rgba(0, 0, 0, 0.2));
  transform: scale(1.18);
  margin: 38px 0;
}

.spectator__result,
.spectator__paused {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--accent-secondary);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.5px;
  text-align: center;
}

.spectator__result strong { color: var(--text-primary); font-size: 22px; letter-spacing: 0; }
.spectator__paused { color: var(--text-muted); font-size: 11px; }

.spectator__scoreboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.spectator__scoreboard :deep(.scoreboard) {
  width: 100%;
  min-width: 0;
}

.spectator__rules {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: var(--surface-muted);
  color: var(--accent-primary);
  font-size: 18px;
  font-weight: 900;
}

.spectator__rules small { color: var(--text-muted); font-size: 8px; letter-spacing: 1px; }

.spectator__message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  max-width: 420px;
  min-height: 45vh;
  margin: 10vh auto 0;
  color: var(--text-secondary);
  text-align: center;
}

.spectator__message strong { color: var(--text-primary); font-size: 22px; }
.spectator__message--error strong { color: var(--accent-danger); }
.spectator__message--error span { font-size: 14px; }
.spectator__waiting-mark { color: var(--accent-primary); font-size: 60px; }

.spectator__loader {
  width: 34px;
  height: 34px;
  border: 3px solid var(--line-soft);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spectator-spin 0.8s linear infinite;
}

.spectator__back {
  margin-top: 10px;
  padding: 10px 18px;
  border: 1px solid var(--cell-border);
  border-radius: 10px;
  background: var(--surface-raised);
  color: var(--text-primary);
  cursor: pointer;
}

@keyframes spectator-spin { to { transform: rotate(360deg); } }
@keyframes spectator-pulse { from { opacity: 0.45; } to { opacity: 1; } }

/* Wide displays: keep the complete board in the viewport and surround it
   with the player cards instead of stacking everything on the left. */
@media (orientation: landscape) and (min-width: 700px) {
  .spectator {
    height: calc(100vh - 53px);
    min-height: 0;
    overflow: hidden;
    padding: 10px clamp(16px, 3vw, 48px);
  }

  .spectator__header {
    height: 44px;
    margin-bottom: 8px;
    align-items: center;
  }

  .spectator h1 {
    display: inline-block;
    max-width: 45vw;
    margin: 0 8px 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
    font-size: clamp(18px, 2.4vw, 30px);
    letter-spacing: -0.8px;
    white-space: nowrap;
  }

  .spectator__eyebrow { display: inline-flex; font-size: 8px; letter-spacing: 1.5px; }
  .spectator__room-id { font-size: 9px; }
  .spectator__status { padding: 6px 10px; font-size: 9px; }

  .spectator__stage {
    display: grid;
    grid-template-columns: minmax(165px, 200px) minmax(300px, 1fr) minmax(165px, 200px);
    grid-template-rows: minmax(96px, auto) minmax(0, 1fr) minmax(96px, auto);
    grid-template-areas:
      ". top score"
      "left center right"
      ". bottom .";
    gap: 8px 10px;
    height: calc(100vh - 115px);
    min-height: 0;
    align-items: center;
  }

  .spectator__players { display: contents; }
  .spectator__players :deep(.player-panel) {
    align-self: center;
    width: 100%;
    max-width: 200px;
    padding: 8px 6px;
  }
  .spectator__players :deep(.player-panel:nth-child(1)) { grid-area: top; justify-self: center; }
  .spectator__players :deep(.player-panel:nth-child(2)) { grid-area: right; }
  .spectator__players :deep(.player-panel:nth-child(3)) { grid-area: bottom; justify-self: center; }
  .spectator__players :deep(.player-panel:nth-child(4)) { grid-area: left; }
  .spectator__players :deep(.player-panel:nth-child(2)),
  .spectator__players :deep(.player-panel:nth-child(4)) {
    width: 120px;
    justify-self: center;
  }
  .spectator__players :deep(.player-panel:nth-child(2) .player-panel__sets),
  .spectator__players :deep(.player-panel:nth-child(4) .player-panel__sets) {
    flex-direction: column;
  }
  .spectator__players :deep(.player-panel__header) { margin-bottom: 6px; }
  .spectator__players :deep(.player-panel__sets) { gap: 4px; }
  .spectator__players :deep(.player-panel__stack) { width: 48px; height: 48px; }
  .spectator__players :deep(.stack-ring--large) { width: 48px; height: 48px; border-width: 4px; }
  .spectator__players :deep(.stack-ring--medium) { width: 31px; height: 31px; border-width: 3px; }
  .spectator__players :deep(.stack-ring--small) { width: 17px; height: 17px; border-width: 3px; }

  .spectator__center {
    grid-area: center;
    min-width: 0;
    min-height: 0;
    gap: 4px;
  }

  .spectator__turn { padding: 5px 11px; }
  .spectator__turn-label { font-size: 8px; }
  .spectator__turn strong { font-size: 12px; }

  .spectator__board-wrap {
    --spectator-cell: clamp(60px, 10vh, 110px);
    --spectator-gap: calc(var(--spectator-cell) * 0.11);
    --spectator-padding: calc(var(--spectator-cell) * 0.145);
    width: calc(var(--spectator-cell) * 3 + var(--spectator-gap) * 2 + var(--spectator-padding) * 2);
    height: calc(var(--spectator-cell) * 3 + var(--spectator-gap) * 2 + var(--spectator-padding) * 2);
    margin: 0;
    filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.2));
    transform: none;
  }

  .spectator__board-wrap :deep(.board) {
    gap: var(--spectator-gap);
    padding: var(--spectator-padding);
  }

  .spectator__board-wrap :deep(.cell) {
    width: var(--spectator-cell);
    height: var(--spectator-cell);
  }

  .spectator__board-wrap :deep(.cell__stack) {
    width: calc(var(--spectator-cell) * 0.76);
    height: calc(var(--spectator-cell) * 0.76);
  }

  .spectator__board-wrap :deep(.cell__ring--large) {
    width: calc(var(--spectator-cell) * 0.76);
    height: calc(var(--spectator-cell) * 0.76);
  }

  .spectator__board-wrap :deep(.cell__ring--medium) {
    width: calc(var(--spectator-cell) * 0.51);
    height: calc(var(--spectator-cell) * 0.51);
  }

  .spectator__board-wrap :deep(.cell__ring--small) {
    width: calc(var(--spectator-cell) * 0.255);
    height: calc(var(--spectator-cell) * 0.255);
  }

  .spectator__board-wrap :deep(.piece--large) {
    width: calc(var(--spectator-cell) * 0.69);
    height: calc(var(--spectator-cell) * 0.69);
  }

  .spectator__board-wrap :deep(.piece--medium) {
    width: calc(var(--spectator-cell) * 0.44);
    height: calc(var(--spectator-cell) * 0.44);
  }

  .spectator__board-wrap :deep(.piece--small) {
    width: calc(var(--spectator-cell) * 0.2);
    height: calc(var(--spectator-cell) * 0.2);
  }

  .spectator__result { font-size: 8px; }
  .spectator__result strong { font-size: 16px; }
  .spectator__paused { font-size: 8px; }

  .spectator__scoreboard {
    grid-area: score;
    align-self: start;
    width: 100%;
    max-width: 200px;
    gap: 6px;
  }

  .spectator__scoreboard :deep(.scoreboard) { padding: 8px; }
  .spectator__scoreboard :deep(.scoreboard__header) { margin-bottom: 5px; }
  .spectator__scoreboard :deep(.scoreboard__row) { padding: 3px 4px; gap: 4px; }
  .spectator__scoreboard :deep(.scoreboard__label) { display: none; }
  .spectator__rules { padding: 6px 9px; font-size: 13px; }
}

@media (max-width: 980px) and (orientation: portrait) {
  .spectator__stage {
    grid-template-columns: 1fr 1fr;
    min-height: auto;
  }
  .spectator__center { grid-column: 1 / -1; grid-row: 1; }
  .spectator__players { grid-column: 1; }
  .spectator__scoreboard { grid-column: 2; }
}

@media (max-width: 600px) {
  .spectator__header { align-items: flex-start; flex-direction: column; }
  .spectator__stage { display: flex; flex-direction: column; }
  .spectator__center { order: 1; width: 100%; }
  .spectator__players { order: 2; width: 100%; flex-direction: row; flex-wrap: wrap; justify-content: center; }
  .spectator__scoreboard { order: 3; width: min(100%, 300px); }
  .spectator__board-wrap { transform: scale(0.82); margin: 4px 0; }
}

/* Final spectator composition: the same left / board / right arrangement as
   the game room, with a board size derived from the viewport height. */
.spectator__side {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  min-width: 0;
}

.spectator__side :deep(.player-panel) { width: 100%; min-width: 0; }

@media (orientation: landscape) and (min-width: 700px) {
  .spectator__stage {
    display: grid;
    grid-template-columns: minmax(150px, 250px) minmax(0, 1fr) minmax(150px, 250px);
    grid-template-areas: "left center right";
    align-items: center;
    gap: clamp(10px, 2vw, 28px);
    height: calc(100vh - 115px);
    min-height: 0;
  }

  .spectator__side--left { grid-area: left; }
  .spectator__side--right { grid-area: right; }

  .spectator__center {
    grid-area: center;
    min-width: 0;
    min-height: 0;
    gap: 5px;
  }

  .spectator__board-wrap {
    --spectator-cell: clamp(62px, 10vh, 110px);
    --spectator-gap: calc(var(--spectator-cell) * 0.11);
    --spectator-padding: calc(var(--spectator-cell) * 0.145);
    width: calc(var(--spectator-cell) * 3 + var(--spectator-gap) * 2 + var(--spectator-padding) * 2);
    height: calc(var(--spectator-cell) * 3 + var(--spectator-gap) * 2 + var(--spectator-padding) * 2);
    margin: 0 auto;
    transform: none;
  }

  .spectator__board-wrap :deep(.board) {
    gap: var(--spectator-gap);
    padding: var(--spectator-padding);
  }

  .spectator__board-wrap :deep(.cell) {
    width: var(--spectator-cell);
    height: var(--spectator-cell);
  }

  .spectator__board-wrap :deep(.cell__stack) {
    width: calc(var(--spectator-cell) * 0.76);
    height: calc(var(--spectator-cell) * 0.76);
  }

  .spectator__board-wrap :deep(.cell__ring--large) {
    width: calc(var(--spectator-cell) * 0.76);
    height: calc(var(--spectator-cell) * 0.76);
  }

  .spectator__board-wrap :deep(.cell__ring--medium) {
    width: calc(var(--spectator-cell) * 0.51);
    height: calc(var(--spectator-cell) * 0.51);
  }

  .spectator__board-wrap :deep(.cell__ring--small) {
    width: calc(var(--spectator-cell) * 0.255);
    height: calc(var(--spectator-cell) * 0.255);
  }

  .spectator__board-wrap :deep(.piece--large) {
    width: calc(var(--spectator-cell) * 0.69);
    height: calc(var(--spectator-cell) * 0.69);
  }

  .spectator__board-wrap :deep(.piece--medium) {
    width: calc(var(--spectator-cell) * 0.44);
    height: calc(var(--spectator-cell) * 0.44);
  }

  .spectator__board-wrap :deep(.piece--small) {
    width: calc(var(--spectator-cell) * 0.2);
    height: calc(var(--spectator-cell) * 0.2);
  }

  .spectator__scoreboard {
    width: min(100%, 220px);
    margin: 0 auto;
  }

  .spectator__scoreboard :deep(.scoreboard) {
    min-width: 0;
    padding: 8px;
  }
}

@media (orientation: portrait) {
  .spectator__stage { display: flex; flex-direction: column; min-height: auto; }
  .spectator__center { order: 1; width: 100%; }
  .spectator__side--left { order: 2; width: 100%; flex-direction: row; flex-wrap: wrap; justify-content: center; }
  .spectator__side--right { order: 3; width: min(100%, 300px); }
}
</style>
