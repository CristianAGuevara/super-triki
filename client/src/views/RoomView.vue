<template>
  <div class="room">
    <SelectionBar />

    <WinCinematic v-if="gameStore.cinematicActive" @done="gameStore.finishCinematic()" />

    <MatchResultOverlay
      v-if="showMatchResult"
      :winner-name="resultWinnerName"
      :is-draw="resultIsDraw"
      :countdown="resultCountdown"
      :accent="resultAccent"
      :destination-label="resultDestination"
    />

    <Transition name="toast">
      <div v-if="roomStore.error" class="room__notice" role="alert">
        <span class="room__notice-icon" aria-hidden="true">!</span>
        <span>{{ roomStore.error }}</span>
        <button aria-label="Cerrar aviso" @click="roomStore.setError(null)">×</button>
      </div>
    </Transition>

    <!-- ── Lobby: waiting for players ── -->
    <div v-if="roomStore.phase === 'waiting'" class="lobby">
      <section class="lobby__invite">
        <span class="st-eyebrow">{{ gameStore.isGameOver ? 'Sala de espera' : 'Sala creada' }}</span>
        <h1 class="lobby__title">{{ roomStore.name || 'Tu sala' }}</h1>
        <p class="lobby__hint">
          {{ gameStore.isGameOver ? 'Revisa el resultado y prepara la revancha.' : 'Comparte el código para que entren tus amigos.' }}
        </p>

        <button class="lobby__code" type="button" :aria-label="`Copiar enlace de la sala ${roomId}`" @click="copyPlayerLink">
          <span v-for="(char, index) in roomId.split('')" :key="index" class="lobby__code-char">{{ char }}</span>
        </button>

        <div class="lobby__copy-actions">
          <button class="lobby__copy-btn" :class="{ 'is-done': copied === 'player' }" @click="copyPlayerLink">
            {{ copied === 'player' ? '¡Enlace copiado!' : 'Copiar enlace para jugar' }}
          </button>
          <button class="lobby__copy-btn lobby__copy-btn--spectator" :class="{ 'is-done': copied === 'spectator' }" @click="copySpectatorLink">
            {{ copied === 'spectator' ? '¡Copiado!' : 'Enlace espectador' }}
          </button>
        </div>

        <div class="lobby__seats">
          <div class="lobby__seats-head">
            <span class="st-eyebrow">Jugadores</span>
            <span class="lobby__count">{{ roomStore.playerCount }}/4</span>
          </div>
          <TransitionGroup name="seat" tag="ul" class="lobby__players">
            <li
              v-for="p in roomStore.players"
              :key="p.slot"
              class="lobby__player"
              :class="{ 'lobby__player--offline': !p.connected }"
              :style="{ '--piece-color': gameStore.playerMeta[p.slot]?.color }"
            >
              <span class="lobby__avatar st-ring st-ring--large" aria-hidden="true" />
              <span class="lobby__player-name">{{ p.username }}</span>
              <span v-if="p.slot === roomStore.hostSlot" class="lobby__tag">Anfitrión</span>
              <span v-if="p.slot === roomStore.mySlot" class="lobby__tag lobby__tag--me">Tú</span>
              <span v-if="!p.connected" class="lobby__tag lobby__tag--off">Desconectado</span>
            </li>
            <li v-for="n in (4 - roomStore.playerCount)" :key="'empty-' + n" class="lobby__player lobby__player--empty">
              <span class="lobby__avatar lobby__avatar--empty" aria-hidden="true" />
              <span class="lobby__player-name">Asiento libre</span>
            </li>
          </TransitionGroup>
        </div>
      </section>

      <section class="lobby__setup">
        <PlayerColorPicker
          v-if="roomStore.mySlot"
          :model-value="myColor"
          :taken="takenColors"
          :disabled="choosingColor !== null || !roomStore.connected"
          @select="chooseColor"
        />

        <details v-if="roomStore.mySlot === roomStore.hostSlot" class="lobby__options">
          <summary>
            <span>Opciones de partida</span>
            <small>{{ roomStore.gameSettings.turnTimerEnabled ? `Turnos de ${roomStore.gameSettings.turnDurationSeconds} s` : 'Sin límite de tiempo' }}</small>
          </summary>
          <label class="lobby__option">
            <input v-model="roomStore.gameSettings.turnTimerEnabled" type="checkbox" />
            <span>Temporizador por turno</span>
          </label>
          <div v-if="roomStore.gameSettings.turnTimerEnabled" class="lobby__timer-options">
            <label class="lobby__option lobby__option--select">
              <span>Tiempo para jugar</span>
              <select v-model.number="roomStore.gameSettings.turnDurationSeconds">
                <option :value="30">30 segundos</option>
                <option :value="60">1 minuto</option>
                <option :value="90">1 min 30 s</option>
                <option :value="120">2 minutos</option>
                <option :value="180">3 minutos</option>
              </select>
            </label>
            <label class="lobby__option">
              <input v-model="roomStore.gameSettings.removePieceOnTimeout" type="checkbox" />
              <span>Quitar una ficha a quien deje pasar su turno</span>
            </label>
          </div>
        </details>

        <button
          v-if="roomStore.mySlot === roomStore.hostSlot && connectedPlayerCount >= 2"
          class="st-btn lobby__start-btn"
          :disabled="!roomStore.connected"
          @click="handleStart"
        >
          {{ roomStore.connected ? 'Iniciar partida' : 'Reconectando…' }}
          <span aria-hidden="true">→</span>
        </button>

        <div v-else class="lobby__waiting">
          <span class="lobby__dots" aria-hidden="true"><i /><i /><i /></span>
          {{ roomStore.mySlot === roomStore.hostSlot ? 'Necesitas al menos un rival para empezar' : 'Esperando a que el anfitrión inicie la partida' }}
        </div>

        <button type="button" class="lobby__rules-link" @click="openRules">¿Cómo se gana?</button>
      </section>

      <section v-if="gameStore.isGameOver" class="lobby__last-game">
        <div class="lobby__last-game-heading">
          <span class="st-eyebrow">Última partida</span>
          <strong>{{ lastGameResult }}</strong>
        </div>
        <div class="lobby__board-wrap">
          <Board />
        </div>
        <p class="lobby__last-game-hint">La línea dorada marca la jugada ganadora.</p>
      </section>
    </div>

    <!-- ── Game ── -->
    <template v-else-if="roomStore.phase === 'playing' || roomStore.phase === 'finished'">
      <header class="room__header">
        <div class="room__identity">
          <span class="room__code">{{ roomStore.tournament?.name || roomStore.name || roomId }}</span>
          <span class="room__meta">
            <span class="room__id">#{{ roomId }}</span>
            <span v-if="roomStore.tournament" class="room__tournament">
              {{ roomStore.tournament.groupLabel }} · Ronda {{ roomStore.tournament.stage }}
            </span>
          </span>
        </div>

        <Transition name="turn-swap" mode="out-in">
          <div
            v-if="!gameStore.isGameOver"
            :key="gameStore.currentPlayer"
            class="room__turn"
            :class="{ 'room__turn--mine': isMyTurn }"
            :style="{ '--turn-color': turnColor }"
          >
            <span class="room__turn-dot" aria-hidden="true" />
            <span class="room__turn-label">{{ isMyTurn ? '¡Tu turno!' : `Turno de ${turnLabel}` }}</span>
            <span
              v-if="roomStore.gameSettings.turnTimerEnabled"
              class="room__turn-timer"
              :class="{ 'room__turn-timer--urgent': turnSecondsLeft <= 15 }"
            >{{ turnClock }}</span>
          </div>
        </Transition>

        <button type="button" class="room__help" aria-label="Ver cómo se gana" title="Cómo se gana" @click="openRules">?</button>
      </header>

      <TvGameControls v-if="tvStore.enabled && !gameStore.isGameOver" />

      <main class="room__main" :class="`room__main--${gameStore.players.length}p`">
        <div class="room__side room__side--left">
          <PlayerPanel class="room__player room__player--mine" :player="orderedPlayers[0]" :my-slot="roomStore.mySlot" />
          <PlayerPanel v-if="orderedPlayers[2]" class="room__player" :player="orderedPlayers[2]" :my-slot="roomStore.mySlot" />
        </div>
        <div class="room__center">
          <MatchClocks />
          <Board />
          <Scoreboard />
        </div>
        <div class="room__side room__side--right">
          <PlayerPanel v-if="orderedPlayers[1]" class="room__player" :player="orderedPlayers[1]" :my-slot="roomStore.mySlot" />
          <PlayerPanel v-if="orderedPlayers[3]" class="room__player" :player="orderedPlayers[3]" :my-slot="roomStore.mySlot" />
        </div>
      </main>

      <GameStatus v-if="!showMatchResult" @rematch="handleRematch" />
    </template>

    <!-- ── Rules ── -->
    <Transition name="rules-modal">
      <div v-if="showRules" class="rules-overlay" @click.self="closeRules">
        <article class="rules-card" role="dialog" aria-modal="true" aria-labelledby="rules-title">
          <button class="rules-card__close" aria-label="Cerrar reglas" @click="closeRules">×</button>
          <span class="st-eyebrow">Antes de jugar</span>
          <h2 id="rules-title">Tres formas de ganar</h2>
          <p class="rules-card__intro">
            Cada casilla guarda tres anillos: grande, mediano y pequeño. En tu turno colocas uno en un hueco libre de su tamaño.
          </p>

          <div class="rules-grid">
            <section class="rules-step">
              <div class="rules-mini" aria-hidden="true">
                <span v-for="n in 9" :key="n" class="rules-mini__cell">
                  <i v-if="n >= 1 && n <= 3" class="st-ring st-ring--medium rules-mini__ring rules-mini__ring--medium" />
                </span>
              </div>
              <strong>Mismo tamaño en línea</strong>
              <p>Tres anillos iguales en una fila, columna o diagonal.</p>
            </section>

            <section class="rules-step">
              <div class="rules-mini" aria-hidden="true">
                <span v-for="n in 9" :key="n" class="rules-mini__cell">
                  <i v-if="n === 1" class="st-ring st-ring--large rules-mini__ring rules-mini__ring--large" />
                  <i v-if="n === 5" class="st-ring st-ring--medium rules-mini__ring rules-mini__ring--medium" />
                  <i v-if="n === 9" class="st-ring st-ring--small rules-mini__ring rules-mini__ring--small" />
                </span>
              </div>
              <strong>Tamaños en orden</strong>
              <p>Grande → mediano → pequeño en línea, o al revés.</p>
            </section>

            <section class="rules-step">
              <div class="rules-mini" aria-hidden="true">
                <span v-for="n in 9" :key="n" class="rules-mini__cell">
                  <template v-if="n === 5">
                    <i class="st-ring st-ring--large rules-mini__ring rules-mini__ring--large" />
                    <i class="st-ring st-ring--medium rules-mini__ring rules-mini__ring--medium" />
                    <i class="st-ring st-ring--small rules-mini__ring rules-mini__ring--small" />
                  </template>
                </span>
              </div>
              <strong>Casilla completa</strong>
              <p>Tus tres tamaños dentro de una misma casilla.</p>
            </section>
          </div>

          <p class="rules-card__keys">
            <span><kbd class="st-kbd">1</kbd><kbd class="st-kbd">2</kbd><kbd class="st-kbd">3</kbd> eligen tamaño</span>
            <span><kbd class="st-kbd">Esc</kbd> cancela</span>
            <span>En el móvil: toca una ficha y luego una casilla iluminada.</span>
          </p>

          <button class="st-btn rules-card__button" @click="closeRules">Entendido, a jugar</button>
        </article>
      </div>
    </Transition>

    <!-- Non-blocking warning. Connected players may continue their turns. -->
    <Transition name="toast">
      <aside v-if="showDisconnectNotice" class="disconnect-banner" role="status">
        <span class="disconnect-banner__icon" aria-hidden="true">!</span>
        <span class="disconnect-banner__message">
          <strong>{{ disconnectedName }} se desconectó.</strong>
          {{ disconnectedTurn ? 'Su reloj sigue corriendo; al agotarse, el turno pasa al siguiente jugador.' : 'La partida continúa; cuando llegue su turno, su reloj también correrá.' }}
        </span>
        <button
          v-if="canFinishGameForHost"
          class="disconnect-banner__finish"
          @click="handleFinishGame"
        >
          Finalizar partida y volver a sala
        </button>
        <button class="disconnect-banner__close" aria-label="Cerrar aviso" @click="roomStore.setOpponentLeft(null)">×</button>
      </aside>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { PlayerColorId } from '@/types/game'
import { resolvePlayerColorId } from '@/types/game'
import { useRoomStore } from '@/stores/roomStore'
import { useGameStore } from '@/stores/gameStore'
import { useUserStore } from '@/stores/userStore'
import { useAudioStore } from '@/stores/audioStore'
import { useTvModeStore } from '@/stores/tvStore'
import { useTurnClock } from '@/composables/useTurnClock'
import { useSocket } from '@/composables/useSocket'
import { useGameShortcuts } from '@/composables/useGameShortcuts'
import { connectSocket, disconnectSocket } from '@/services/socket'
import Board from '@/components/Board.vue'
import PlayerPanel from '@/components/PlayerPanel.vue'
import GameStatus from '@/components/GameStatus.vue'
import Scoreboard from '@/components/Scoreboard.vue'
import SelectionBar from '@/components/SelectionBar.vue'
import PlayerColorPicker from '@/components/PlayerColorPicker.vue'
import MatchResultOverlay from '@/components/MatchResultOverlay.vue'
import MatchClocks from '@/components/MatchClocks.vue'
import TvGameControls from '@/components/TvGameControls.vue'
import WinCinematic from '@/components/WinCinematic.vue'

const route     = useRoute()
const router    = useRouter()
const roomStore = useRoomStore()
const gameStore = useGameStore()
const userStore = useUserStore()
const audioStore = useAudioStore()
const tvStore = useTvModeStore()
const { emitJoinRoom, emitReconnectRoom, emitRematch, emitStart, emitFinishGame, emitSetColor } = useSocket()

const roomId = computed(() => route.params.id as string)
const mountedRoomId = String(route.params.id).toUpperCase()
const copied = ref<'player' | 'spectator' | null>(null)
const showMatchResult = ref(false)
const resultCountdown = ref(3)
let resultInterval: ReturnType<typeof setInterval> | null = null
const RESULT_SECONDS = 3
const choosingColor = ref<PlayerColorId | null>(null)
const showRules = ref(false)
const RULES_STORAGE_KEY = 'st_rules_seen'
const RULES_DISPLAY_LIMIT = 2
const BASE_TITLE = 'Super Triki'

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
const disconnectedTurn = computed(() => roomStore.disconnectedPlayer?.slot === gameStore.currentPlayer)
const showDisconnectNotice = computed(() => roomStore.opponentLeft && roomStore.phase === 'playing')
const connectedPlayerCount = computed(() => roomStore.players.filter(player => player.connected).length)
const myColor = computed<PlayerColorId>(() => {
  const me = roomStore.players.find(player => player.slot === roomStore.mySlot)
  return resolvePlayerColorId(me?.color, roomStore.mySlot ?? 1)
})
const takenColors = computed<PlayerColorId[]>(() =>
  roomStore.players
    .filter(player => player.slot !== roomStore.mySlot)
    .map(player => resolvePlayerColorId(player.color, player.slot))
)
const orderedPlayers = computed(() => {
  if (roomStore.mySlot === null) return gameStore.players
  return [
    roomStore.mySlot,
    ...gameStore.players.filter(player => player !== roomStore.mySlot),
  ]
})
const canFinishGameForHost = computed(() =>
  roomStore.mySlot === roomStore.hostSlot && roomStore.phase === 'playing' &&
  roomStore.players.some(player => !player.connected)
)
const { secondsLeft: turnSecondsLeft, formattedTime: turnClock } = useTurnClock(
  undefined,
  () => roomStore.gameSettings.turnDurationSeconds * 1_000,
)

const isMyTurn = computed(() =>
  roomStore.phase === 'playing' &&
  !gameStore.isGameOver &&
  roomStore.mySlot !== null &&
  gameStore.currentPlayer === roomStore.mySlot
)

useGameShortcuts(() => roomStore.phase === 'playing' && !showRules.value)

const lastGameResult = computed(() => {
  if (gameStore.isDraw) return 'Empate'
  const winner = gameStore.winResult?.winner
  const name = roomStore.players.find(player => player.slot === winner)?.username
    ?? (winner ? `Jugador ${winner}` : null)
  return name ? `Ganó ${name}` : 'Partida terminada'
})

const resultIsDraw = computed(() => !gameStore.winResult)
const resultWinnerName = computed(() => {
  const winner = gameStore.winResult?.winner
  if (!winner) return ''
  return roomStore.players.find(player => player.slot === winner)?.username
    ?? gameStore.playerMeta[winner]?.label
    ?? `Jugador ${winner}`
})
const resultAccent = computed(() => {
  const winner = gameStore.winResult?.winner
  return winner
    ? gameStore.playerMeta[winner]?.color ?? 'var(--accent-primary)'
    : 'var(--accent-secondary)'
})
const resultDestination = computed(() =>
  roomStore.tournament ? 'la sala de espera del torneo' : 'la sala de espera'
)

watch(() => roomStore.phase, (phase, previous) => {
  if (phase === 'playing' && previous && previous !== 'playing') audioStore.playSfx('start')
  if (phase !== 'playing' || roomStore.tournament ||
      rulesShownCount.value >= RULES_DISPLAY_LIMIT) return
  rulesShownCount.value++
  try {
    window.localStorage.setItem(RULES_STORAGE_KEY, String(rulesShownCount.value))
  } catch {
    // The modal can still be shown if storage is unavailable.
  }
  showRules.value = true
}, { immediate: true })

// "Your turn" cue: a chime, plus a tab title marker when the tab is hidden.
let turnCueTimer: number | undefined
watch(isMyTurn, mine => {
  if (turnCueTimer) window.clearTimeout(turnCueTimer)
  if (!mine) {
    document.title = BASE_TITLE
    return
  }
  turnCueTimer = window.setTimeout(() => audioStore.playSfx('turn'), 380)
  if (document.hidden) document.title = '● ¡Tu turno! · Super Triki'
})

function handleVisibility() {
  if (!document.hidden) document.title = BASE_TITLE
}

function stopResultCountdown() {
  if (resultInterval) {
    clearInterval(resultInterval)
    resultInterval = null
  }
}

function finishMatchResult() {
  stopResultCountdown()
  showMatchResult.value = false

  if (roomStore.tournament) {
    void router.push(`/tournament/${roomStore.tournament.id}`)
  }
}

function startResultCountdown() {
  stopResultCountdown()
  showMatchResult.value = true
  resultCountdown.value = RESULT_SECONDS
  resultInterval = setInterval(() => {
    resultCountdown.value -= 1
    if (resultCountdown.value <= 0) finishMatchResult()
  }, 1000)
}

watch(() => gameStore.isGameOver, over => {
  stopResultCountdown()

  if (!over) {
    showMatchResult.value = false
    return
  }

  // A live win plays the cinematic first; the result card follows it.
  if (!gameStore.cinematicActive) startResultCountdown()
}, { immediate: true })

watch(() => gameStore.cinematicActive, (active, wasActive) => {
  if (!active && wasActive && gameStore.isGameOver) startResultCountdown()
})

const turnColor = computed(() => {
  const meta = gameStore.playerMeta[gameStore.currentPlayer]
  return meta?.color ?? 'var(--accent-primary)'
})

const turnLabel = computed(() => {
  return roomStore.players.find(p => p.slot === gameStore.currentPlayer)?.username ?? 'tu rival'
})

onMounted(async () => {
  document.addEventListener('visibilitychange', handleVisibility)
  const hasSavedSession = !roomStore.mySlot && roomStore.restoreSession(roomId.value)
  connectSocket()

  if (hasSavedSession && roomStore.reconnectToken) {
    const resumed = await emitReconnectRoom(roomId.value, roomStore.reconnectToken)
    if (resumed.ok && resumed.roomId && resumed.playerSlot) {
      roomStore.setFromAck(resumed.roomId, resumed.playerSlot, roomStore.roomPassword, resumed.reconnectToken)
      if (resumed.roomState) roomStore.setRoomState(resumed.roomState)
      roomStore.setConnection(true)
      return
    }
    roomStore.clearSavedSession()
    roomStore.reset()
  }

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
  stopResultCountdown()
  if (turnCueTimer) window.clearTimeout(turnCueTimer)
  document.removeEventListener('visibilitychange', handleVisibility)
  document.title = BASE_TITLE

  const nextRoute = router.currentRoute.value
  const nextRoomId = String(nextRoute.params.id ?? '').toUpperCase()
  const switchingTournamentRoom = roomStore.consumeTournamentRoomSwitch() &&
    nextRoute.name === 'room' &&
    nextRoomId !== mountedRoomId
  if (switchingTournamentRoom) return

  const goingToTournament = nextRoute.name === 'tournament'
  roomStore.reset()
  gameStore.initGame(2)
  if (!goingToTournament) disconnectSocket()
})

async function copyLink(url: string, type: 'player' | 'spectator') {
  audioStore.playSfx('click')
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

function handleFinishGame() {
  if (roomStore.roomId) {
    audioStore.playSfx('click')
    emitFinishGame(roomStore.roomId)
  }
}

function handleStart() {
  if (roomStore.roomId) {
    audioStore.playSfx('click')
    emitStart(roomStore.roomId, roomStore.gameSettings)
  }
}

async function chooseColor(color: PlayerColorId) {
  if (!roomStore.roomId || choosingColor.value || color === myColor.value) return
  choosingColor.value = color
  audioStore.playSfx('click')

  try {
    const result = await emitSetColor(roomStore.roomId, color)
    if (!result.ok) roomStore.setError(result.error ?? 'No se pudo cambiar el color')
  } finally {
    choosingColor.value = null
  }
}

function openRules() {
  audioStore.playSfx('click')
  gameStore.clearSelection()
  showRules.value = true
}

function closeRules() {
  showRules.value = false
}
</script>

<style scoped>
.room {
  min-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 22px max(16px, env(safe-area-inset-left, 0px)) 110px max(16px, env(safe-area-inset-right, 0px));
}

/* ── Notices ── */
.room__notice,
.disconnect-banner {
  position: fixed;
  z-index: 300;
  top: 76px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: calc(100vw - 24px);
  padding: 10px 12px 10px 12px;
  border: 1px solid color-mix(in srgb, var(--accent-secondary) 60%, transparent);
  border-radius: var(--radius-s);
  background: var(--surface-raised);
  box-shadow: var(--shadow-card);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  transform: translateX(-50%);
}

.room__notice-icon,
.disconnect-banner__icon {
  display: grid;
  place-items: center;
  flex: 0 0 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent-secondary);
  color: #fff;
  font-weight: 900;
  font-size: 12px;
}

.room__notice button,
.disconnect-banner__close {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
}

.disconnect-banner {
  z-index: 260;
  width: min(900px, calc(100vw - 24px));
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}

.disconnect-banner__message { flex: 1; }
.disconnect-banner__message strong { color: var(--text-primary); }

.disconnect-banner__finish {
  flex: 0 0 auto;
  padding: 7px 12px;
  border: 1px solid var(--accent-secondary);
  border-radius: 999px;
  background: transparent;
  color: var(--accent-secondary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.disconnect-banner__finish:hover { background: var(--control-hover); }

.toast-enter-active, .toast-leave-active { transition: opacity 0.2s ease, transform 0.3s var(--ease-spring); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, -12px); }

/* ── Lobby ── */
.lobby {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 18px;
  width: min(100%, 940px);
  margin-top: 10px;
  animation: st-pop-in 0.45s var(--ease-out) both;
}

.lobby__invite,
.lobby__setup,
.lobby__last-game {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: clamp(20px, 3vw, 30px);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-l);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.lobby__setup { align-items: stretch; justify-content: flex-start; }

.lobby__title {
  margin-top: -6px;
  color: var(--text-primary);
  font-size: clamp(28px, 4vw, 40px);
  overflow-wrap: anywhere;
}

.lobby__hint {
  margin-top: -8px;
  color: var(--text-secondary);
  font-size: 14px;
}

.lobby__code {
  display: flex;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  cursor: copy;
}

.lobby__code-char {
  display: grid;
  place-items: center;
  width: clamp(40px, 7vw, 52px);
  height: clamp(52px, 9vw, 64px);
  border-radius: var(--radius-s);
  background: var(--cell-bg);
  box-shadow: inset 0 2px 5px var(--groove), 0 1px 0 var(--groove-light);
  color: var(--accent-primary);
  font-family: var(--font-mono);
  font-size: clamp(24px, 4.4vw, 32px);
  font-weight: 700;
  transition: transform 0.25s var(--ease-spring);
}

.lobby__code:hover .lobby__code-char { transform: translateY(-2px); }
.lobby__code:hover .lobby__code-char:nth-child(even) { transform: translateY(2px); }

.lobby__copy-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.lobby__copy-btn {
  min-height: 40px;
  padding: 8px 16px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--control-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.lobby__copy-btn:hover { background: var(--control-hover); }
.lobby__copy-btn--spectator { color: var(--text-secondary); }
.lobby__copy-btn.is-done { border-color: var(--accent-success); color: var(--accent-success); }

.lobby__seats { display: flex; flex-direction: column; gap: 10px; }
.lobby__seats-head { display: flex; align-items: baseline; justify-content: space-between; }
.lobby__count { color: var(--text-muted); font-family: var(--font-mono); font-size: 12px; }

.lobby__players {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  list-style: none;
}

.lobby__player {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 8px 12px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-s);
  background: var(--surface-muted);
  flex-wrap: wrap;
}

.lobby__player--offline { opacity: 0.55; }

.lobby__player--empty {
  border-style: dashed;
  background: transparent;
  color: var(--text-faint);
}

.lobby__avatar {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
}

.lobby__avatar--empty {
  border: 1.5px dashed var(--line-strong);
  border-radius: 50%;
}

.lobby__player-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lobby__player--empty .lobby__player-name { color: var(--text-faint); font-weight: 500; }

.lobby__tag {
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-primary) 18%, transparent);
  color: var(--text-primary);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.lobby__tag--me { background: var(--control-hover); color: var(--text-secondary); }
.lobby__tag--off { background: transparent; color: var(--accent-danger); }

.seat-enter-active { transition: opacity 0.3s ease, transform 0.4s var(--ease-spring); }
.seat-enter-from { opacity: 0; transform: scale(0.9); }

.lobby__options {
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-s);
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.lobby__options summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  list-style: none;
}

.lobby__options summary::-webkit-details-marker { display: none; }
.lobby__options summary small { color: var(--text-muted); font-size: 12px; font-weight: 500; }
.lobby__options[open] summary { border-bottom: 1px solid var(--line-soft); }
.lobby__options > .lobby__option { padding: 12px 14px 0; }
.lobby__options > :last-child { padding-bottom: 14px; }

.lobby__timer-options { display: flex; flex-direction: column; gap: 12px; padding: 12px 14px 14px; }
.lobby__option { display: flex; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 13px; cursor: pointer; }
.lobby__option--select { justify-content: space-between; }
.lobby__option select {
  padding: 7px 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-xs);
  background-color: var(--cell-bg);
  color: var(--text-primary);
}

.lobby__start-btn { width: 100%; min-height: 54px; font-size: 17px; }

.lobby__waiting {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 54px;
  padding: 10px 14px;
  border: 1px dashed var(--line-strong);
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: center;
}

.lobby__dots { display: inline-flex; gap: 4px; }
.lobby__dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-primary);
  animation: dot-bounce 1.1s ease-in-out infinite;
}
.lobby__dots i:nth-child(2) { animation-delay: 0.15s; }
.lobby__dots i:nth-child(3) { animation-delay: 0.3s; }

@keyframes dot-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-5px); opacity: 1; }
}

.lobby__rules-link {
  align-self: center;
  border: 0;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.lobby__rules-link:hover { color: var(--text-primary); }

.lobby__last-game {
  grid-column: 1 / -1;
  align-items: center;
}

.lobby__last-game-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  width: min(100%, 420px);
}

.lobby__last-game-heading strong {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 18px;
}

.lobby__board-wrap :deep(.board) { --cell: 86px; }

.lobby__last-game-hint {
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

/* ── Game ── */
.room__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  width: min(100%, 1040px);
}

.room__identity { display: flex; min-width: 0; flex-direction: column; gap: 2px; }

.room__code {
  overflow: hidden;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room__meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.room__id { color: var(--text-muted); font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; }

.room__tournament {
  padding: 1px 8px;
  border: 1px solid color-mix(in srgb, var(--accent-secondary) 55%, transparent);
  border-radius: 999px;
  color: var(--accent-secondary);
  font-size: 11px;
  font-weight: 700;
}

.room__turn {
  --turn-color: var(--accent-primary);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 6px 8px 6px 16px;
  border: 1px solid color-mix(in srgb, var(--turn-color) 50%, var(--line-soft));
  border-radius: 999px;
  background: color-mix(in srgb, var(--turn-color) 10%, var(--surface));
  box-shadow: 0 0 30px -12px var(--turn-color);
  color: var(--text-primary);
  font-weight: 700;
  white-space: nowrap;
}

.room__turn:not(:has(.room__turn-timer)) { padding-right: 16px; }

.room__turn-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--turn-color);
}

.room__turn--mine {
  background: color-mix(in srgb, var(--turn-color) 22%, var(--surface));
  animation: my-turn-glow 1.8s ease-in-out infinite;
}

.room__turn--mine .room__turn-label {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 800;
}

@keyframes my-turn-glow {
  50% { box-shadow: 0 0 40px -6px var(--turn-color); }
}

.room__turn-timer {
  display: inline-flex;
  min-width: 52px;
  justify-content: center;
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--control-bg);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.room__turn-timer--urgent {
  background: color-mix(in srgb, var(--accent-danger) 20%, transparent);
  color: var(--accent-danger);
  animation: timer-urgent 1s ease-in-out infinite;
}

@keyframes timer-urgent {
  50% { transform: scale(1.08); }
}

.turn-swap-enter-active { transition: opacity 0.25s ease, transform 0.4s var(--ease-spring); }
.turn-swap-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.turn-swap-enter-from { opacity: 0; transform: translateY(-8px) scale(0.92); }
.turn-swap-leave-to { opacity: 0; transform: translateY(6px) scale(0.96); }

.room__help {
  justify-self: end;
  width: 38px;
  height: 38px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: var(--control-bg);
  color: var(--text-secondary);
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 800;
  transition: background 0.2s, color 0.2s, transform 0.25s var(--ease-spring);
}

.room__help:hover { background: var(--control-hover); color: var(--text-primary); transform: rotate(-12deg); }

.room__main {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  flex-wrap: wrap;
  justify-content: center;
  animation: st-pop-in 0.5s var(--ease-out) both;
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

@media (max-width: 760px) {
  .lobby { grid-template-columns: 1fr; }
}

@media (max-width: 700px) {
  .room { gap: 12px; padding-top: 14px; }

  .room__header { grid-template-columns: minmax(0, 1fr) auto; }
  .room__turn { grid-column: 1 / -1; grid-row: 2; justify-self: center; }
  .room__help { grid-column: 2; grid-row: 1; }

  .room__main {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 12px;
  }

  .room__side,
  .room__center { display: contents; }

  .room__center > :deep(.match-clocks) { order: 0; }
  .room__center > :deep(.board) { order: 1; }

  .room__player {
    width: min(100%, 360px);
    order: 3;
  }

  .room__player--mine { order: 2; }

  .room__player:not(.room__player--mine) {
    --stack: 50px;
    padding: 10px 12px;
    gap: 8px;
  }

  .room__center > :deep(.scoreboard) {
    order: 4;
    width: min(100%, 360px);
  }
}

@media (max-width: 420px) {
  .lobby__players { grid-template-columns: 1fr; }
  .room__player--mine { --stack: 68px; }
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
  backdrop-filter: blur(10px);
}

.rules-card {
  position: relative;
  width: min(720px, 100%);
  max-height: calc(100vh - 36px);
  overflow: auto;
  padding: 30px clamp(20px, 5vw, 44px) 30px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-l);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  text-align: center;
}

.rules-card__close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 34px;
  height: 34px;
  border: 1px solid var(--line-soft);
  border-radius: 50%;
  background: var(--control-bg);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
}

.rules-card h2 {
  margin-top: 6px;
  color: var(--text-primary);
  font-size: clamp(28px, 4.6vw, 40px);
}

.rules-card__intro {
  max-width: 500px;
  margin: 10px auto 22px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.55;
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
  gap: 6px;
  min-width: 0;
  padding: 16px 12px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-m);
  background: var(--surface-muted);
  animation: st-pop-in 0.45s var(--ease-out) both;
}

.rules-step:nth-child(2) { animation-delay: 0.08s; }
.rules-step:nth-child(3) { animation-delay: 0.16s; }

.rules-step strong {
  margin-top: 8px;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 15px;
}

.rules-step p {
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.45;
}

.rules-mini {
  --mini: 26px;
  display: grid;
  grid-template-columns: repeat(3, var(--mini));
  gap: 3px;
  padding: 5px;
  border-radius: 10px;
  background: var(--board-bg);
  box-shadow: var(--shadow-tray);
}

.rules-mini__cell {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--mini);
  height: var(--mini);
  border-radius: 6px;
  background: var(--cell-bg);
  box-shadow: inset 0 1px 3px var(--groove);
}

.rules-mini__ring {
  --piece-color: var(--accent-primary);
  position: absolute;
  filter: none;
}

.rules-mini__ring--large { width: 21px; height: 21px; }
.rules-mini__ring--medium { width: 13px; height: 13px; }
.rules-mini__ring--small { width: 6px; height: 6px; }

.rules-card__keys {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 18px;
  margin-top: 20px;
  color: var(--text-muted);
  font-size: 12.5px;
}

.rules-card__keys span { display: inline-flex; align-items: center; gap: 5px; }

.rules-card__button { width: min(320px, 100%); margin-top: 20px; }

.rules-modal-enter-active, .rules-modal-leave-active { transition: opacity 0.25s ease; }
.rules-modal-enter-active .rules-card { transition: transform 0.4s var(--ease-spring); }
.rules-modal-enter-from, .rules-modal-leave-to { opacity: 0; }
.rules-modal-enter-from .rules-card { transform: translateY(24px) scale(0.96); }

@media (max-width: 620px) {
  .rules-grid { grid-template-columns: 1fr; }
  .rules-step { display: grid; grid-template-columns: auto 1fr; gap: 2px 14px; text-align: left; }
  .rules-step strong { margin-top: 0; align-self: end; }
  .rules-step p { grid-column: 2; }
  .rules-mini { grid-row: 1 / span 2; --mini: 20px; }
  .rules-mini__ring--large { width: 16px; height: 16px; }
  .rules-mini__ring--medium { width: 10px; height: 10px; }
  .rules-mini__ring--small { width: 5px; height: 5px; }
  .disconnect-banner { align-items: flex-start; flex-wrap: wrap; }
  .disconnect-banner__message { min-width: calc(100% - 48px); }
  .disconnect-banner__finish { margin-left: 34px; }
}
</style>
