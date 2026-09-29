<template>
  <div class="home">

    <!-- ── Username bar ── -->
    <div class="home__username-bar">
      <label class="home__username-label" for="username">Tu nombre</label>
      <input
        id="username"
        v-model="usernameInput"
        class="home__username-input"
        type="text"
        placeholder="¿Cómo te llamas?"
        maxlength="20"
        autocomplete="off"
      />
    </div>

    <section class="home__hero">
      <div>
        <span class="home__eyebrow">TABLETOP STRATEGY / ONLINE</span>
        <h1>Arma tu línea. <em>Rompe el patrón.</em></h1>
        <p>Combina tamaños, lee el tablero y encuentra una victoria que nadie vio venir.</p>
      </div>
      <div class="home__hero-mark" role="img" aria-label="Tablero de 3 por 3 por 3, 27 posiciones">
        <strong>3×3×3</strong>
        <span>STACK ARENA</span>
        <small>27 SLOTS</small>
      </div>
    </section>

    <div class="home__body">

      <!-- ── Left: public room list ── -->
      <section class="home__section">
        <div class="home__section-header">
          <h2 class="home__section-title">Salas disponibles</h2>
          <span class="home__section-count">{{ publicRooms.length }} sala{{ publicRooms.length !== 1 ? 's' : '' }}</span>
        </div>

        <div class="home__rooms">
          <TransitionGroup name="room-list" tag="div" class="home__rooms-inner">
            <div
              v-for="room in publicRooms"
              :key="room.roomId"
              class="room-card"
              :class="{ 'room-card--playing': room.phase === 'playing' }"
            >
              <div class="room-card__info">
                <span class="room-card__name">{{ room.name }}</span>
                <span class="room-card__meta">
                  <span class="room-card__dots">
                    <span
                      v-for="i in 4"
                      :key="i"
                      class="room-card__dot"
                      :class="{ 'room-card__dot--filled': i <= room.playerCount }"
                    />
                  </span>
                  {{ room.playerCount }}/4
                  <span class="room-card__phase">{{ room.phase === 'playing' ? '· En juego' : '· Esperando' }}</span>
                </span>
              </div>
              <button
                class="room-card__btn"
                :disabled="!canProceed || room.phase === 'playing' || loading"
                @click="handleJoinPublic(room.roomId)"
              >
                {{ loadingRoomId === room.roomId ? '...' : 'Unirse' }}
              </button>
            </div>
          </TransitionGroup>

          <div v-if="publicRooms.length === 0" class="home__empty">
            <span class="home__empty-icon">◎</span>
            <p>No hay salas públicas activas</p>
            <p class="home__empty-sub">Crea una para empezar</p>
          </div>
        </div>
      </section>

      <!-- ── Right: create + join private ── -->
      <section class="home__section home__section--actions">

        <!-- Create room -->
        <div class="home__card">
          <h3 class="home__card-title">Nueva sala</h3>

          <div class="home__field">
            <label class="home__label">Nombre</label>
            <input
              v-model="roomNameInput"
              class="home__input"
              type="text"
              :placeholder="`Sala de ${usernameInput || 'jugador'}`"
              maxlength="30"
              autocomplete="off"
            />
          </div>

          <div class="home__toggle-row">
            <button
              class="home__toggle-btn"
              :class="{ 'home__toggle-btn--active': !createIsPrivate }"
              @click="createIsPrivate = false"
            >
              Pública
            </button>
            <button
              class="home__toggle-btn"
              :class="{ 'home__toggle-btn--active': createIsPrivate }"
              @click="createIsPrivate = true"
            >
              Privada
            </button>
          </div>

          <Transition name="slide">
            <div v-if="createIsPrivate" class="home__field">
              <label class="home__label">Contraseña</label>
              <input
                v-model="createPasswordInput"
                class="home__input"
                type="text"
                placeholder="Contraseña de la sala..."
                maxlength="20"
                autocomplete="off"
              />
            </div>
          </Transition>

          <button
            class="home__btn home__btn--primary"
            :disabled="!canProceed || loading"
            @click="handleCreate"
          >
            {{ loading && action === 'create' ? 'Creando...' : 'Crear sala' }}
          </button>
        </div>

        <!-- Join private room -->
        <div class="home__card home__card--secondary">
          <h3 class="home__card-title">Sala privada</h3>
          <p class="home__card-sub">Únete con un código</p>

          <div class="home__field">
            <label class="home__label">Código</label>
            <input
              v-model="roomCodeInput"
              class="home__input home__input--code"
              type="text"
              placeholder="XK7F2A"
              maxlength="6"
              autocomplete="off"
              @input="roomCodeInput = roomCodeInput.toUpperCase()"
              @keydown.enter="handleJoinPrivate"
            />
          </div>

          <div class="home__field">
            <label class="home__label">Contraseña <span class="home__label-opt">(si aplica)</span></label>
            <input
              v-model="joinPasswordInput"
              class="home__input"
              type="text"
              placeholder="Opcional..."
              maxlength="20"
              autocomplete="off"
              @keydown.enter="handleJoinPrivate"
            />
          </div>

          <button
            class="home__btn home__btn--secondary"
            :disabled="!canJoin || loading"
            @click="handleJoinPrivate"
          >
            {{ loading && action === 'join' ? 'Uniéndose...' : 'Unirse' }}
          </button>
        </div>

        <!-- Spectator mode -->
        <div class="home__card home__card--spectator">
          <div class="home__spectator-heading">
            <h3 class="home__card-title">Modo espectador</h3>
            <span class="home__live-badge">LIVE</span>
          </div>
          <p class="home__card-sub">Muestra una partida en una pantalla grande</p>

          <div class="home__field">
            <label class="home__label">Código de sala</label>
            <input
              v-model="spectatorCodeInput"
              class="home__input home__input--code"
              type="text"
              placeholder="XK7F2A"
              maxlength="6"
              autocomplete="off"
              @input="spectatorCodeInput = spectatorCodeInput.toUpperCase()"
              @keydown.enter="handleSpectate"
            />
          </div>

          <button
            class="home__btn home__btn--spectator"
            :disabled="!canSpectate"
            @click="handleSpectate"
          >
            Ver partida en directo
          </button>
        </div>

        <p v-if="!canProceed" class="home__hint">Escribe tu nombre para continuar</p>
        <p v-if="errorMsg" class="home__error">{{ errorMsg }}</p>
      </section>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useRoomStore } from '@/stores/roomStore'
import { useLobbyStore } from '@/stores/lobbyStore'
import { useAudioStore } from '@/stores/audioStore'
import { connectSocket, getSocket, waitForSocketConnection } from '@/services/socket'

const router     = useRouter()
const route      = useRoute()
const userStore  = useUserStore()
const roomStore  = useRoomStore()
const lobbyStore = useLobbyStore()
const audioStore = useAudioStore()

const usernameInput       = ref(userStore.username ?? '')
const roomNameInput       = ref('')
const roomCodeInput       = ref((route.query.code as string) ?? '')
const spectatorCodeInput  = ref('')
const createPasswordInput = ref('')
const joinPasswordInput   = ref('')
const createIsPrivate     = ref(false)
const loading             = ref(false)
const loadingRoomId       = ref<string | null>(null)
const action              = ref<'create' | 'join' | null>(null)
const errorMsg            = ref<string | null>(null)

const publicRooms = computed(() => lobbyStore.publicRooms)
const canProceed  = computed(() => usernameInput.value.trim().length >= 2)
const canJoin     = computed(() => canProceed.value && roomCodeInput.value.trim().length === 6)
const canSpectate = computed(() => spectatorCodeInput.value.trim().length === 6)

onMounted(() => {
  connectSocket()
  const socket = getSocket()
  socket.on('rooms:list', rooms => lobbyStore.setRooms(rooms))

  const next = route.query.next as string | undefined
  if (next) {
    const match = next.match(/\/room\/([A-Z0-9]+)/)
    if (match) roomCodeInput.value = match[1]
  }
})

onUnmounted(() => {
  getSocket().off('rooms:list')
})

async function handleCreate() {
  if (!canProceed.value) return
  audioStore.playSfx('click')
  userStore.setUsername(usernameInput.value)
  loading.value  = true
  action.value   = 'create'
  errorMsg.value = null

  if (!await waitForSocketConnection()) {
    loading.value = false
    action.value = null
    errorMsg.value = 'No se pudo conectar con el servidor'
    return
  }
  const socket = getSocket()
  const name = roomNameInput.value.trim() || `Sala de ${usernameInput.value.trim()}`

  socket.emit('room:create', {
    username:  usernameInput.value.trim(),
    name,
    isPrivate: createIsPrivate.value,
    password:  createIsPrivate.value ? createPasswordInput.value || undefined : undefined,
  }, res => {
    loading.value = false
    if (!res.ok || !res.roomId || !res.playerSlot) {
      errorMsg.value = res.error ?? 'Error al crear sala'
      return
    }
    roomStore.setFromAck(res.roomId, res.playerSlot)
    router.push(`/room/${res.roomId}`)
  })
}

async function handleJoinPublic(roomId: string) {
  if (!canProceed.value) return
  audioStore.playSfx('click')
  userStore.setUsername(usernameInput.value)
  loading.value       = true
  loadingRoomId.value = roomId
  action.value        = 'join'
  errorMsg.value      = null

  if (!await waitForSocketConnection()) {
    loading.value = false
    action.value = null
    errorMsg.value = 'No se pudo conectar con el servidor'
    return
  }
  const socket = getSocket()

  socket.emit('room:join', { roomId, username: usernameInput.value.trim() }, res => {
    loading.value       = false
    loadingRoomId.value = null
    if (!res.ok || !res.roomId || !res.playerSlot) {
      errorMsg.value = res.error ?? 'No se pudo unir'
      return
    }
    roomStore.setFromAck(res.roomId, res.playerSlot)
    if (res.roomState) roomStore.setRoomState(res.roomState)
    router.push(`/room/${res.roomId}`)
  })
}

async function handleJoinPrivate() {
  if (!canJoin.value) return
  audioStore.playSfx('click')
  userStore.setUsername(usernameInput.value)
  loading.value  = true
  action.value   = 'join'
  errorMsg.value = null

  if (!await waitForSocketConnection()) {
    loading.value = false
    action.value = null
    errorMsg.value = 'No se pudo conectar con el servidor'
    return
  }
  const socket = getSocket()
  const code = roomCodeInput.value.trim().toUpperCase()

  socket.emit('room:join', {
    roomId:   code,
    username: usernameInput.value.trim(),
    password: joinPasswordInput.value || undefined,
  }, res => {
    loading.value = false
    if (!res.ok || !res.roomId || !res.playerSlot) {
      errorMsg.value = res.error ?? 'No se pudo unir a la sala'
      return
    }
    roomStore.setFromAck(res.roomId, res.playerSlot)
    if (res.roomState) roomStore.setRoomState(res.roomState)
    router.push(`/room/${res.roomId}`)
  })
}

function handleSpectate() {
  if (!canSpectate.value) return
  audioStore.playSfx('click')
  router.push(`/spectate/${spectatorCodeInput.value.trim().toUpperCase()}`)
}
</script>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 24px 24px 40px;
  gap: 24px;
  max-width: 960px;
  margin: 0 auto;
}

/* ── Username bar ── */
.home__username-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--cell-bg);
  border: 1.5px solid var(--cell-border);
  border-radius: 12px;
  padding: 10px 16px;
}

.home__username-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.home__username-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}

.home__username-input::placeholder { color: var(--text-faint); }

/* ── Hero ── */
.home__hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 10px 4px 2px;
}

.home__eyebrow {
  color: var(--accent-primary);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 2px;
}

.home__hero h1 {
  max-width: 680px;
  margin-top: 8px;
  color: var(--text-primary);
  font-size: clamp(30px, 5vw, 52px);
  line-height: 0.98;
  letter-spacing: -2px;
}

.home__hero h1 em {
  color: var(--accent-secondary);
  font-style: normal;
}

.home__hero p {
  max-width: 510px;
  margin-top: 14px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
}

.home__hero-mark {
  display: grid;
  place-items: center;
  min-width: 86px;
  min-height: 86px;
  border: 1px solid var(--accent-primary);
  border-radius: 22px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-glow);
  color: var(--accent-primary);
  transform: rotate(4deg);
}

.home__hero-mark strong { font-size: 24px; line-height: 1; letter-spacing: -1px; }
.home__hero-mark span { font-size: 8px; font-weight: 900; letter-spacing: 1.5px; }
.home__hero-mark small { color: var(--text-muted); font-size: 7px; font-weight: 800; letter-spacing: 1px; }

/* ── Body columns ── */
.home__body {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  align-items: start;
  flex: 1;
}

@media (max-width: 700px) {
  .home__body { grid-template-columns: 1fr; }
}

/* ── Section ── */
.home__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.home__section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.home__section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.home__section-count {
  font-size: 12px;
  color: var(--text-muted);
}

/* ── Room list ── */
.home__rooms {
  display: flex;
  flex-direction: column;
}

.home__rooms-inner {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: var(--cell-bg);
  border: 1.5px solid var(--cell-border);
  border-radius: 12px;
  transition: border-color 0.2s;
}

.room-card:not(.room-card--playing):hover {
  border-color: var(--drop-border);
}

.room-card--playing { opacity: 0.5; }

.room-card__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.room-card__name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.room-card__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.room-card__dots { display: flex; gap: 3px; }

.room-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cell-border);
  transition: background 0.2s;
}

.room-card__dot--filled { background: var(--player-2-color); }
.room-card__phase { color: var(--text-muted); }

.room-card__btn {
  padding: 7px 16px;
  border: none;
  border-radius: 8px;
  background: var(--gradient-secondary);
  color: var(--text-on-accent);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: transform 0.15s, opacity 0.15s;
}

.room-card__btn:disabled { opacity: 0.35; cursor: not-allowed; }
.room-card__btn:not(:disabled):hover { transform: scale(1.04); }

/* Empty state */
.home__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 200px;
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;
  border: 1.5px dashed var(--cell-border);
  border-radius: 12px;
}

.home__empty-icon { font-size: 36px; color: var(--text-faint); line-height: 1; }
.home__empty-sub  { font-size: 12px; color: var(--text-secondary); }

/* ── Right side cards ── */
.home__section--actions { gap: 12px; }

.home__card {
  background: var(--cell-bg);
  border: 1.5px solid var(--cell-border);
  border-radius: 16px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.home__card--secondary {
  background: var(--surface-muted);
}

.home__card--spectator {
  border-color: color-mix(in srgb, var(--accent-primary) 38%, var(--cell-border));
  background: linear-gradient(145deg, var(--surface), var(--surface-raised));
}

.home__spectator-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.home__live-badge {
  padding: 4px 7px;
  border: 1px solid var(--accent-danger);
  border-radius: 6px;
  color: var(--accent-danger);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1px;
}

.home__card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.home__card-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: -6px;
}

/* ── Fields ── */
.home__field { display: flex; flex-direction: column; gap: 5px; }

.home__label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.home__label-opt { text-transform: none; font-size: 10px; color: var(--text-faint); }

.home__input {
  background: var(--control-bg);
  border: 1.5px solid var(--cell-border);
  border-radius: 8px;
  padding: 9px 12px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
}

.home__input:focus { border-color: var(--accent-primary); }
.home__input--code { text-transform: uppercase; letter-spacing: 3px; font-weight: 700; }

/* ── Toggle ── */
.home__toggle-row {
  display: flex;
  background: var(--control-bg);
  border: 1.5px solid var(--cell-border);
  border-radius: 8px;
  overflow: hidden;
}

.home__toggle-btn {
  flex: 1;
  padding: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.home__toggle-btn--active {
  background: var(--control-hover);
  color: var(--text-primary);
}

/* ── Buttons ── */
.home__btn {
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
}

.home__btn:disabled { opacity: 0.35; cursor: not-allowed; }
.home__btn:not(:disabled):hover { transform: scale(1.02); }

.home__btn--primary {
  background: var(--gradient-primary);
  color: var(--text-on-accent);
}

.home__btn--secondary {
  background: var(--gradient-secondary);
  color: var(--text-on-accent);
}

/* ── Hints ── */
.home__hint  { font-size: 12px; color: var(--text-muted); text-align: center; }
.home__error { font-size: 13px; color: var(--accent-danger); text-align: center; }

/* ── Slide transition ── */
.slide-enter-active, .slide-leave-active {
  transition: max-height 0.25s ease, opacity 0.2s ease;
  overflow: hidden;
  max-height: 80px;
}
.slide-enter-from, .slide-leave-to { max-height: 0; opacity: 0; }

/* ── Room list transition ── */
.room-list-enter-active { transition: all 0.25s ease; }
.room-list-leave-active { transition: all 0.2s ease; position: absolute; width: 100%; }
.room-list-enter-from   { opacity: 0; transform: translateY(-6px); }
.room-list-leave-to     { opacity: 0; transform: translateY(4px); }

@media (max-width: 520px) {
  .home__hero { align-items: flex-start; }
  .home__hero-mark { min-width: 66px; min-height: 66px; border-radius: 18px; }
  .home__hero-mark strong { font-size: 18px; }
  .home__hero-mark span { font-size: 7px; }
}

.home__btn--spectator {
  border: 1px solid var(--accent-primary);
  background: transparent;
  color: var(--accent-primary);
}

.home__btn--spectator:not(:disabled):hover {
  background: var(--control-hover);
}
</style>
