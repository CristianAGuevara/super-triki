<template>
  <div class="spectator">
    <header class="spectator__header">
      <div class="spectator__identity">
        <span class="spectator__eyebrow"><span class="spectator__live-dot" /> ESPECTADOR / EN DIRECTO</span>
        <h1>{{ roomStore.name || 'Sala en directo' }}</h1>
        <span class="spectator__room-id">#{{ roomId }}</span>
      </div>
      <span class="spectator__status" :class="`spectator__status--${roomStore.phase}`">
        {{ statusLabel }}
      </span>
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

    <main v-else class="spectator__main">
      <aside class="spectator__side spectator__side--left">
        <PlayerPanel v-if="roomStore.players[0]" :player="roomStore.players[0].slot" :my-slot="null" />
        <PlayerPanel v-if="roomStore.players[2]" :player="roomStore.players[2].slot" :my-slot="null" />
      </aside>

      <section class="spectator__center">
        <div class="spectator__turn">
          <span>Turno actual</span>
          <strong :style="{ color: turnColor }">{{ turnLabel }}</strong>
        </div>

        <div class="spectator__board">
          <Board />
        </div>

        <Scoreboard />

        <div v-if="gameStore.isGameOver" class="spectator__result">
          <span>{{ gameStore.isDraw ? 'EMPATE' : 'GANADOR' }}</span>
          <strong>{{ resultLabel }}</strong>
        </div>
        <div v-else-if="roomStore.phase === 'finished'" class="spectator__paused">
          PARTIDA EN PAUSA · ESPERANDO AL HOST
        </div>
      </section>

      <aside class="spectator__side spectator__side--right">
        <PlayerPanel v-if="roomStore.players[1]" :player="roomStore.players[1].slot" :my-slot="null" />
        <PlayerPanel v-if="roomStore.players[3]" :player="roomStore.players[3].slot" :my-slot="null" />
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
  if (roomStore.phase === 'playing') return 'EN DIRECTO'
  if (roomStore.phase === 'finished') return 'PAUSA'
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
  if (result.roomState) roomStore.setRoomState(result.roomState)
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
  padding: clamp(16px, 3vw, 32px) clamp(16px, 4vw, 52px);
}

.spectator__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  width: min(1440px, 100%);
  margin: 0 auto clamp(14px, 2vw, 24px);
}

.spectator__identity { min-width: 0; }

.spectator__eyebrow {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--accent-primary);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1.6px;
}

.spectator__live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-danger);
  box-shadow: 0 0 10px var(--accent-danger);
  animation: spectator-pulse 1.2s ease-in-out infinite alternate;
}

.spectator h1 {
  max-width: min(52vw, 580px);
  margin: 5px 0 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: clamp(20px, 3vw, 32px);
  letter-spacing: -1px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spectator__room-id {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.5px;
}

.spectator__status {
  flex-shrink: 0;
  padding: 7px 11px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1px;
}

.spectator__status--playing { color: var(--accent-primary); border-color: var(--accent-primary); }
.spectator__status--finished { color: var(--accent-secondary); }

.spectator__main {
  display: grid;
  grid-template-columns: minmax(180px, 250px) minmax(0, 1fr) minmax(180px, 250px);
  align-items: center;
  gap: clamp(12px, 2.5vw, 32px);
  width: min(1440px, 100%);
  height: calc(100vh - 150px);
  min-height: 0;
  margin: 0 auto;
}

.spectator__side {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  min-width: 0;
}

.spectator__side :deep(.player-panel) { width: 100%; min-width: 0; }

.spectator__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  min-height: 0;
}

.spectator__turn {
  display: flex;
  align-items: baseline;
  gap: 9px;
  padding: 6px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--surface-muted);
}

.spectator__turn span {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.spectator__turn strong { font-size: 13px; }

.spectator__board {
  --spectator-cell: clamp(62px, 10vh, 110px);
  --spectator-gap: calc(var(--spectator-cell) * 0.11);
  --spectator-padding: calc(var(--spectator-cell) * 0.145);
  width: calc(var(--spectator-cell) * 3 + var(--spectator-gap) * 2 + var(--spectator-padding) * 2);
  height: calc(var(--spectator-cell) * 3 + var(--spectator-gap) * 2 + var(--spectator-padding) * 2);
  filter: drop-shadow(0 18px 32px rgba(0, 0, 0, 0.2));
}

.spectator__board :deep(.board) { gap: var(--spectator-gap); padding: var(--spectator-padding); }
.spectator__board :deep(.cell) { width: var(--spectator-cell); height: var(--spectator-cell); }
.spectator__board :deep(.cell__stack) { width: calc(var(--spectator-cell) * .76); height: calc(var(--spectator-cell) * .76); }
.spectator__board :deep(.cell__ring--large) { width: calc(var(--spectator-cell) * .76); height: calc(var(--spectator-cell) * .76); }
.spectator__board :deep(.cell__ring--medium) { width: calc(var(--spectator-cell) * .51); height: calc(var(--spectator-cell) * .51); }
.spectator__board :deep(.cell__ring--small) { width: calc(var(--spectator-cell) * .255); height: calc(var(--spectator-cell) * .255); }
.spectator__board :deep(.piece--large) { width: calc(var(--spectator-cell) * .69); height: calc(var(--spectator-cell) * .69); }
.spectator__board :deep(.piece--medium) { width: calc(var(--spectator-cell) * .44); height: calc(var(--spectator-cell) * .44); }
.spectator__board :deep(.piece--small) { width: calc(var(--spectator-cell) * .2); height: calc(var(--spectator-cell) * .2); }

.spectator__center :deep(.scoreboard) { width: min(100%, 220px); min-width: 0; padding: 8px; }
.spectator__center :deep(.scoreboard__header) { margin-bottom: 5px; }
.spectator__center :deep(.scoreboard__row) { padding: 3px 5px; gap: 5px; }
.spectator__center :deep(.scoreboard__label) { display: none; }

.spectator__result,
.spectator__paused {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  color: var(--accent-secondary);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1.3px;
  text-align: center;
}

.spectator__result strong { color: var(--text-primary); font-size: 18px; letter-spacing: 0; }
.spectator__paused { color: var(--text-muted); }

.spectator__rules {
  padding: 10px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: var(--surface-muted);
  color: var(--accent-primary);
  font-size: 16px;
  font-weight: 900;
  text-align: center;
}

.spectator__rules small { display: block; margin-top: 3px; color: var(--text-muted); font-size: 7px; letter-spacing: 1px; }

.spectator__message { display: flex; flex-direction: column; align-items: center; gap: 10px; min-height: 45vh; margin: 10vh auto 0; color: var(--text-secondary); text-align: center; }
.spectator__message strong { color: var(--text-primary); font-size: 22px; }
.spectator__message--error strong { color: var(--accent-danger); }
.spectator__waiting-mark { color: var(--accent-primary); font-size: 60px; }
.spectator__loader { width: 34px; height: 34px; border: 3px solid var(--line-soft); border-top-color: var(--accent-primary); border-radius: 50%; animation: spectator-spin .8s linear infinite; }
.spectator__back { padding: 10px 18px; border: 1px solid var(--cell-border); border-radius: 10px; background: var(--surface-raised); color: var(--text-primary); cursor: pointer; }

@keyframes spectator-spin { to { transform: rotate(360deg); } }
@keyframes spectator-pulse { from { opacity: .45; } to { opacity: 1; } }

@media (max-width: 700px), (orientation: portrait) {
  .spectator { padding: 16px; }
  .spectator__header { align-items: flex-start; }
  .spectator__main { display: flex; flex-direction: column; height: auto; min-height: 0; }
  .spectator__center { order: 1; width: 100%; }
  .spectator__side--left { order: 2; width: 100%; flex-direction: row; flex-wrap: wrap; justify-content: center; }
  .spectator__side--right { order: 3; width: min(100%, 300px); }
  .spectator__board { --spectator-cell: clamp(52px, 19vw, 82px); }
}
</style>
