<template>
  <div class="room">

    <!-- ── Lobby: waiting for players ── -->
    <div v-if="roomStore.phase === 'waiting'" class="lobby">
      <h2 class="lobby__title">Sala creada</h2>
      <p class="lobby__hint">Comparte el código con tus amigos</p>

      <div class="lobby__code">{{ roomId }}</div>

       <div class="lobby__copy-actions">
         <button class="lobby__copy-btn" @click="copyPlayerLink">
           {{ copied === 'player' ? '¡Copiado!' : 'Enlace para jugadores' }}
         </button>
         <button class="lobby__copy-btn lobby__copy-btn--spectator" @click="copySpectatorLink">
           {{ copied === 'spectator' ? '¡Copiado!' : 'Enlace espectador' }}
         </button>
       </div>

      <div class="lobby__players">
        <span
          v-for="p in roomStore.players"
          :key="p.slot"
          class="lobby__player-chip"
          :style="{ background: gameStore.playerMeta[p.slot]?.color }"
        >
          {{ p.username }}{{ p.slot === roomStore.mySlot ? ' (tú)' : '' }}
        </span>
        <span v-for="n in (4 - roomStore.playerCount)" :key="'empty-' + n" class="lobby__player-chip lobby__player-chip--empty">
          —
        </span>
      </div>

      <p class="lobby__count">{{ roomStore.playerCount }}/4 jugadores</p>

      <button
        v-if="roomStore.mySlot === 1 && roomStore.playerCount >= 2"
        class="lobby__start-btn"
        @click="handleStart"
      >
        Iniciar partida
      </button>

      <div v-else class="lobby__waiting">
        <span class="lobby__dot" />
        {{ roomStore.mySlot === 1 ? 'Esperando más jugadores...' : 'Esperando que el creador inicie...' }}
      </div>
    </div>

    <!-- ── Game ── -->
    <template v-else-if="roomStore.phase === 'playing' || roomStore.phase === 'finished'">
      <header class="room__header">
        <span class="room__code">{{ roomStore.name || roomId }} <span class="room__id">#{{ roomId }}</span></span>
        <span class="room__turn" v-if="!gameStore.isGameOver">
          Turno: <strong :style="{ color: turnColor }">{{ turnLabel }}</strong>
        </span>
      </header>

      <main class="room__main" :class="`room__main--${gameStore.players.length}p`">
        <div class="room__side room__side--left">
          <PlayerPanel :player="gameStore.players[0]" :my-slot="roomStore.mySlot" />
          <PlayerPanel v-if="gameStore.players[2]" :player="gameStore.players[2]" :my-slot="roomStore.mySlot" />
        </div>
        <div class="room__center">
          <Board />
          <Scoreboard />
        </div>
        <div class="room__side room__side--right">
          <PlayerPanel v-if="gameStore.players[1]" :player="gameStore.players[1]" :my-slot="roomStore.mySlot" />
          <PlayerPanel v-if="gameStore.players[3]" :player="gameStore.players[3]" :my-slot="roomStore.mySlot" />
        </div>
      </main>

      <GameStatus @rematch="handleRematch" />
    </template>

    <!-- ── Opponent disconnected overlay ── -->
    <Transition name="overlay">
      <div v-if="roomStore.opponentLeft" class="disconnect-overlay">
        <div class="disconnect-card">
          <p class="disconnect-icon">⚠</p>
          <span class="disconnect-eyebrow">Partida en pausa</span>
          <h2>{{ disconnectedName }} se desconectó</h2>
          <p class="disconnect-sub">Esperando a que vuelva a la sala.</p>

          <template v-if="canRestartAfterDisconnect">
            <p class="disconnect-host-note">Como host, puedes comenzar una nueva partida con los jugadores conectados.</p>
            <button class="disconnect-btn" @click="handleRestartAfterDisconnect">Reiniciar partida</button>
          </template>
          <p v-else class="disconnect-waiting">
            Esperando al host para decidir cómo continuar…
          </p>

          <button class="disconnect-btn disconnect-btn--secondary" @click="goHome">Salir de la sala</button>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/roomStore'
import { useGameStore } from '@/stores/gameStore'
import { useUserStore } from '@/stores/userStore'
import { useAudioStore } from '@/stores/audioStore'
import { useSocket } from '@/composables/useSocket'
import { connectSocket, disconnectSocket } from '@/services/socket'
import Board from '@/components/Board.vue'
import PlayerPanel from '@/components/PlayerPanel.vue'
import GameStatus from '@/components/GameStatus.vue'
import Scoreboard from '@/components/Scoreboard.vue'

const route     = useRoute()
const router    = useRouter()
const roomStore = useRoomStore()
const gameStore = useGameStore()
const userStore = useUserStore()
const audioStore = useAudioStore()
const { emitJoinRoom, emitRematch, emitStart } = useSocket()

const roomId = computed(() => route.params.id as string)
const copied = ref<'player' | 'spectator' | null>(null)

const disconnectedName = computed(() => roomStore.disconnectedPlayer?.username ?? 'Un jugador')
const connectedPlayerCount = computed(() => roomStore.players.filter(player => player.socketId).length)
const canRestartAfterDisconnect = computed(() =>
  roomStore.mySlot === 1 && connectedPlayerCount.value >= 2
)

const turnColor = computed(() => {
  const meta = gameStore.playerMeta[gameStore.currentPlayer]
  return meta?.color ?? '#fff'
})

const turnLabel = computed(() => {
  if (!roomStore.mySlot) return ''
  if (gameStore.currentPlayer === roomStore.mySlot) return 'Tu turno'
  return roomStore.players.find(p => p.slot === gameStore.currentPlayer)?.username ?? 'Oponente'
})

onMounted(async () => {
  connectSocket()

  // If we navigated here directly (shared link or page refresh) and have no slot yet
  if (!roomStore.mySlot) {
    if (!userStore.username) {
      router.replace({ name: 'home', query: { next: route.fullPath } })
      return
    }
    const res = await emitJoinRoom(roomId.value, userStore.username)
    if (!res.ok) {
      router.replace({ name: 'home', query: { code: roomId.value } })
      return
    }
    roomStore.setFromAck(res.roomId!, res.playerSlot!)
    if (res.roomState) roomStore.setRoomState(res.roomState)
  }
})

onUnmounted(() => {
  roomStore.reset()
  gameStore.initGame(2)
  disconnectSocket()
})

async function copyLink(url: string, type: 'player' | 'spectator') {
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    const input = document.createElement('textarea')
    input.value = url
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    input.remove()
  }
  copied.value = type
  setTimeout(() => { copied.value = null }, 2000)
}

function copyPlayerLink() {
  void copyLink(window.location.href, 'player')
}

function copySpectatorLink() {
  void copyLink(`${window.location.origin}/spectate/${roomId.value}`, 'spectator')
}

function handleRematch() {
  if (roomStore.roomId) {
    audioStore.playSfx('click')
    emitRematch(roomStore.roomId)
  }
}

function handleRestartAfterDisconnect() {
  if (roomStore.roomId) {
    audioStore.playSfx('click')
    emitRematch(roomStore.roomId)
  }
}

function handleStart() {
  if (roomStore.roomId) {
    audioStore.playSfx('click')
    emitStart(roomStore.roomId)
  }
}

function goHome() {
  router.push('/')
}

</script>

<style scoped>
.room {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  gap: 20px;
}

/* ── Lobby ── */
.lobby {
  width: min(100%, 560px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  margin-top: 80px;
}


.lobby__title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}

.lobby__hint {
  color: var(--text-secondary);
  font-size: 14px;
}

.lobby__code {
  font-size: 48px;
  font-weight: 900;
  letter-spacing: 10px;
  background: linear-gradient(135deg, var(--player-1-color), var(--player-2-color));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  padding: 8px 16px;
  border: 2px solid var(--cell-border);
  border-radius: 16px;
  background-color: var(--cell-bg);
}

.lobby__copy-btn {
  padding: 10px 24px;
  border: 1.5px solid var(--cell-border);
  border-radius: 10px;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.lobby__copy-btn:hover {
  border-color: var(--accent-primary);
  background: var(--control-hover);
}

.lobby__players {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.lobby__player-chip {
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-on-accent);
  text-shadow: 0 1px 2px rgba(0,0,0,0.18);
}

.lobby__player-chip--empty {
  background: var(--cell-border) !important;
  color: var(--text-muted);
  text-shadow: none;
}

.lobby__count {
  color: var(--text-secondary);
  font-size: 13px;
  margin: 0;
}

.lobby__start-btn {
  padding: 12px 36px;
  border: none;
  border-radius: 30px;
  background: var(--gradient-brand);
  color: var(--text-on-accent);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.lobby__start-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}

.lobby__waiting {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 14px;
  margin-top: 8px;
}

.lobby__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--player-2-color);
  animation: blink 1s ease-in-out infinite alternate;
}

@keyframes blink { from { opacity: 0.3; } to { opacity: 1; } }

/* ── Game ── */
.room__header {
  width: 100%;
  max-width: 700px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-secondary);
}

.room__code { font-weight: 600; }
.room__id   { font-weight: 400; color: var(--text-muted); font-size: 11px; letter-spacing: 1px; }

.room__main {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  flex-wrap: wrap;
  justify-content: center;
}

.room__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.room__side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Disconnect overlay ── */
.disconnect-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  backdrop-filter: blur(4px);
}

.disconnect-card {
  background: var(--cell-bg);
  border: 2px solid var(--cell-border);
  border-radius: 20px;
  padding: 40px 48px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: min(440px, calc(100vw - 32px));
}

.lobby__copy-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.lobby__copy-btn--spectator {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.disconnect-icon { font-size: 40px; }

.disconnect-eyebrow {
  color: var(--accent-secondary);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.8px;
  text-transform: uppercase;
}

.disconnect-card h2 {
  font-size: 24px;
  color: var(--text-primary);
}

.disconnect-sub { color: var(--text-secondary); font-size: 14px; }

.disconnect-host-note,
.disconnect-waiting {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.45;
  max-width: 330px;
  text-align: center;
}

.disconnect-btn {
  margin-top: 8px;
  padding: 12px 32px;
  border: none;
  border-radius: 30px;
  background: var(--player-1-color);
  color: var(--text-on-accent);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s;
}
.disconnect-btn:hover { transform: scale(1.04); }

.disconnect-btn--secondary {
  margin-top: 0;
  background: transparent;
  border: 1px solid var(--cell-border);
  color: var(--text-secondary);
  font-size: 13px;
}

.overlay-enter-active, .overlay-leave-active { transition: opacity 0.3s; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
</style>
