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
      <section class="spectator__players">
        <PlayerPanel
          v-for="player in roomStore.players"
          :key="player.slot"
          :player="player.slot"
          :my-slot="null"
        />
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
      </section>

      <aside class="spectator__scoreboard">
        <Scoreboard />
        <div class="spectator__rules">
          <span>3×3×3</span>
          <small>STACK ARENA</small>
        </div>
      </aside>
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

@media (max-width: 980px) {
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
</style>
