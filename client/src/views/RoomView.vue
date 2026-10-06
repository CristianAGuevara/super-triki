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
         v-if="roomStore.mySlot === roomStore.hostSlot && connectedPlayerCount >= 2"
        class="lobby__start-btn"
        :disabled="!roomStore.connected"
        @click="handleStart"
      >
        {{ roomStore.connected ? 'Iniciar partida' : 'Reconectando…' }}
      </button>

      <div v-else class="lobby__waiting">
        <span class="lobby__dot" />
        {{ roomStore.mySlot === roomStore.hostSlot ? 'Esperando más jugadores...' : 'Esperando que el creador inicie...' }}
      </div>

      <section v-if="gameStore.isGameOver" class="lobby__last-game">
        <div class="lobby__last-game-heading">
          <span>Última partida</span>
          <strong>{{ lastGameResult }}</strong>
        </div>
        <div class="lobby__board-wrap">
          <Board />
        </div>
        <p class="lobby__last-game-hint">Las fichas resaltadas forman la jugada ganadora.</p>
      </section>
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
          <PlayerPanel class="room__player room__player--mine" :player="orderedPlayers[0]" :my-slot="roomStore.mySlot" />
          <PlayerPanel v-if="orderedPlayers[2]" class="room__player" :player="orderedPlayers[2]" :my-slot="roomStore.mySlot" />
        </div>
        <div class="room__center">
          <Board />
          <Scoreboard />
        </div>
        <div class="room__side room__side--right">
          <PlayerPanel v-if="orderedPlayers[1]" class="room__player" :player="orderedPlayers[1]" :my-slot="roomStore.mySlot" />
          <PlayerPanel v-if="orderedPlayers[3]" class="room__player" :player="orderedPlayers[3]" :my-slot="roomStore.mySlot" />
        </div>
      </main>

      <GameStatus @rematch="handleRematch" />
    </template>

    <!-- ── Rules shown when the game starts ── -->
    <Transition name="rules-modal">
      <div v-if="showRules" class="rules-overlay" @click.self="closeRules">
        <article class="rules-card" role="dialog" aria-modal="true" aria-labelledby="rules-title">
          <button class="rules-card__close" aria-label="Cerrar reglas" @click="closeRules">×</button>
          <span class="rules-card__eyebrow">Antes de jugar</span>
          <h2 id="rules-title">Cómo ganar en <strong>3×3×3</strong></h2>
          <p class="rules-card__intro">Coloca tus piezas con estrategia. Cada turno puede cambiar toda la partida.</p>

          <div class="rules-grid">
            <section class="rules-step">
              <div class="rules-visual rules-visual--line rules-visual--same-line" aria-hidden="true">
                <i /><i /><i />
              </div>
              <strong>1. Mismo tamaño en línea</strong>
              <p>Coloca tres fichas del mismo tamaño en una fila, columna o diagonal.</p>
            </section>

            <section class="rules-step">
              <div class="rules-visual rules-visual--line rules-visual--ordered-line" aria-hidden="true">
                <i /><i /><i />
              </div>
              <strong>2. Tamaños en orden</strong>
              <p>Forma una línea con Grande → Mediana → Pequeña, o en orden inverso.</p>
            </section>

            <section class="rules-step">
              <div class="rules-visual rules-visual--cell" aria-hidden="true">
                <span class="rules-ring rules-ring--large" />
                <span class="rules-ring rules-ring--medium" />
                <span class="rules-ring rules-ring--small" />
              </div>
              <strong>3. Casilla completa</strong>
              <p>Reúne tus tres tamaños dentro de una misma casilla para ganar.</p>
            </section>
          </div>

          <button class="rules-card__button" @click="closeRules">Entendido, jugar</button>
        </article>
      </div>
    </Transition>

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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
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
const showRules = ref(false)
const RULES_STORAGE_KEY = 'st_rules_seen'
const RULES_DISPLAY_LIMIT = 2

function getRulesShownCount(): number {
  try {
    const value = Number(window.localStorage.getItem(RULES_STORAGE_KEY) ?? 0)
    return Number.isFinite(value) ? Math.max(0, value) : 0
  } catch {
    return 0
  }
}

const rulesShownCount = ref(getRulesShownCount())

const disconnectedName = computed(() => roomStore.disconnectedPlayer?.username ?? 'Un jugador')
const connectedPlayerCount = computed(() => roomStore.players.filter(player => player.socketId).length)
const orderedPlayers = computed(() => {
  if (roomStore.mySlot === null) return gameStore.players
  return [
    roomStore.mySlot,
    ...gameStore.players.filter(player => player !== roomStore.mySlot),
  ]
})
const canRestartAfterDisconnect = computed(() =>
  roomStore.mySlot === roomStore.hostSlot && connectedPlayerCount.value >= 2
)

const lastGameResult = computed(() => {
  if (gameStore.isDraw) return 'Empate'
  const winner = gameStore.winResult?.winner
  return roomStore.players.find(player => player.slot === winner)?.username
    ?? (winner ? `Jugador ${winner}` : 'Partida terminada')
})

watch(() => roomStore.phase, phase => {
  if (phase !== 'playing' || rulesShownCount.value >= RULES_DISPLAY_LIMIT) return
  rulesShownCount.value++
  try {
    window.localStorage.setItem(RULES_STORAGE_KEY, String(rulesShownCount.value))
  } catch {
    // The modal can still be shown if storage is unavailable.
  }
  showRules.value = true
}, { immediate: true })

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

function closeRules() {
  showRules.value = false
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

@media (max-width: 700px) {
  .room__main {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 10px;
  }

  .room__side,
  .room__center { display: contents; }

  .room__center > :deep(.board) {
    order: 1;
    transform: scale(0.8);
    transform-origin: top center;
    margin-bottom: -78px;
  }

  .room__player {
    width: min(100%, 300px);
    order: 3;
  }

  .room__player--mine { order: 2; }

  .room__center > :deep(.scoreboard) {
    order: 4;
    width: min(100%, 300px);
  }
}

/* ── Rules modal ── */
.rules-overlay {
  position: fixed;
  inset: 0;
  z-index: 250;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: var(--overlay-bg);
  backdrop-filter: blur(8px);
}

.lobby__last-game {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(100%, 430px);
  margin-top: 8px;
  padding: 16px 14px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  background: var(--surface-muted);
}

.lobby__last-game-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  width: 100%;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.lobby__last-game-heading strong {
  color: var(--accent-secondary);
  font-size: 14px;
  letter-spacing: 0;
  text-transform: none;
}

.lobby__board-wrap {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 310px;
  height: 312px;
  margin-top: 8px;
  overflow: hidden;
}

.lobby__board-wrap :deep(.board) {
  transform: scale(0.78);
  transform-origin: top center;
}

.lobby__last-game-hint {
  color: var(--text-muted);
  font-size: 10px;
  text-align: center;
}

.rules-card {
  position: relative;
  width: min(700px, 100%);
  max-height: calc(100vh - 36px);
  overflow: auto;
  padding: 30px clamp(20px, 5vw, 44px) 34px;
  border: 1px solid var(--cell-border);
  border-radius: 24px;
  background: var(--cell-bg);
  box-shadow: var(--shadow-card), var(--shadow-glow);
  text-align: center;
}

.rules-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 14%;
  right: 14%;
  height: 3px;
  border-radius: 0 0 10px 10px;
  background: var(--gradient-brand);
}

.rules-card__close {
  position: absolute;
  top: 12px;
  right: 14px;
  width: 30px;
  height: 30px;
  border: 1px solid var(--line-soft);
  border-radius: 50%;
  background: var(--surface-muted);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
}

.rules-card__eyebrow {
  color: var(--accent-primary);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.rules-card h2 {
  margin-top: 8px;
  color: var(--text-primary);
  font-size: clamp(24px, 4vw, 36px);
  letter-spacing: -1px;
}

.rules-card h2 strong { color: var(--accent-secondary); }

.rules-card__intro {
  max-width: 480px;
  margin: 10px auto 24px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.rules-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  padding: 16px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  background: var(--surface-muted);
}

.rules-step strong {
  margin-top: 14px;
  color: var(--text-primary);
  font-size: 13px;
}

.rules-step p {
  margin-top: 7px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.45;
}

.rules-visual {
  position: relative;
  display: grid;
  place-items: center;
  width: 86px;
  height: 70px;
}

.rules-visual--turn {
  grid-template-columns: repeat(2, 22px);
  grid-template-rows: repeat(2, 22px);
  gap: 5px;
  border: 1px solid var(--cell-border);
  border-radius: 12px;
  background: var(--surface-raised);
}

.rules-visual--turn i {
  display: block;
  width: 22px;
  height: 22px;
  border: 3px solid var(--text-faint);
  border-radius: 6px;
}

.rules-visual--turn i:first-child {
  border-color: var(--accent-primary);
  box-shadow: 0 0 10px color-mix(in srgb, var(--accent-primary) 35%, transparent);
}

.rules-move-arrow {
  position: absolute;
  right: -15px;
  bottom: -8px;
  color: var(--accent-secondary);
  font-size: 28px;
  font-weight: 900;
  transform: rotate(-12deg);
}

.rules-ring {
  position: absolute;
  display: block;
  border: 5px solid var(--accent-primary);
  border-radius: 50%;
  box-shadow: 0 0 10px color-mix(in srgb, var(--accent-primary) 38%, transparent);
}

.rules-ring--large { width: 64px; height: 64px; border-color: var(--player-1-color); }
.rules-ring--medium { width: 42px; height: 42px; border-color: var(--player-2-color); }
.rules-ring--small { width: 22px; height: 22px; border-color: var(--player-3-color); border-width: 4px; }

.rules-visual--line {
  gap: 8px;
  grid-template-columns: repeat(3, 18px);
}

.rules-visual--same-line {
  --rule-piece: var(--player-1-color);
  --rule-line: var(--accent-primary);
}

.rules-visual--ordered-line {
  --rule-piece: var(--player-2-color);
  --rule-line: var(--accent-secondary);
}

.rules-visual--cell {
  --rule-piece: var(--player-3-color);
  --rule-line: var(--accent-secondary);
}

.rules-visual--line::before {
  content: '';
  position: absolute;
  left: 13px;
  right: 13px;
  top: 34px;
  z-index: 2;
  height: 3px;
  border-radius: 5px;
  background: var(--rule-line);
  box-shadow: 0 0 8px color-mix(in srgb, var(--rule-line) 55%, transparent);
}

.rules-visual--line i {
  z-index: 1;
  display: block;
  width: 18px;
  height: 18px;
  border: 4px solid var(--rule-piece);
  border-radius: 50%;
  background: var(--cell-bg);
  box-shadow: 0 0 8px color-mix(in srgb, var(--rule-piece) 35%, transparent);
}

.rules-visual--ordered-line i:nth-child(1) { width: 22px; height: 22px; }
.rules-visual--ordered-line i:nth-child(2) { width: 17px; height: 17px; }
.rules-visual--ordered-line i:nth-child(3) { width: 12px; height: 12px; border-width: 3px; }

.rules-visual--cell {
  border: 2px solid var(--rule-line);
  border-radius: 14px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-glow);
}

.rules-visual--cell .rules-ring {
  border-color: var(--rule-piece);
  box-shadow: 0 0 10px color-mix(in srgb, var(--rule-piece) 38%, transparent);
}

.rules-card__button {
  width: min(300px, 100%);
  margin-top: 24px;
  padding: 12px 20px;
  border: 0;
  border-radius: 12px;
  background: var(--gradient-brand);
  color: var(--text-on-accent);
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}

.rules-modal-enter-active, .rules-modal-leave-active { transition: opacity 0.2s ease; }
.rules-modal-enter-from, .rules-modal-leave-to { opacity: 0; }

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

@media (max-width: 620px) {
  .rules-grid { grid-template-columns: 1fr; }
  .rules-step { display: grid; grid-template-columns: 82px 1fr; gap: 0 12px; text-align: left; }
  .rules-step strong { margin-top: 0; align-self: end; }
  .rules-step p { margin-top: 4px; grid-column: 2; }
  .rules-visual { grid-row: 1 / span 2; }
}
</style>
