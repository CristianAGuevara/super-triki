<template>
  <div class="home">
    <Transition name="toast">
      <div v-if="notice" class="home__notice" role="status">
        <span class="home__notice-icon" aria-hidden="true">!</span>
        {{ notice }}
      </div>
    </Transition>

    <section class="home__hero">
      <div class="home__hero-copy">
        <span class="st-eyebrow home__eyebrow">Triqui para 2 a 4 jugadores · 27 huecos</span>
        <h1>Tres anillos.<br /><em>Una línea.</em></h1>
        <p>
          Grande, mediano y pequeño. Apílalos en el tablero de 3×3, lee las jugadas de tus rivales y cierra la línea antes que nadie.
        </p>

        <div class="home__username" :class="{ 'home__username--ready': canProceed }">
          <label class="home__username-label" for="username">Tu nombre de jugador</label>
          <div class="home__username-field">
            <span class="home__username-ring st-ring st-ring--large" aria-hidden="true" />
            <input
              id="username"
              ref="usernameField"
              v-model="usernameInput"
              class="home__username-input"
              type="text"
              placeholder="¿Cómo te llamas?"
              maxlength="20"
              autocomplete="nickname"
            />
            <span v-if="canProceed" class="home__username-ok" aria-hidden="true">✓</span>
          </div>
          <small v-if="!canProceed" class="home__username-hint">Escribe al menos 2 letras para crear o unirte.</small>
        </div>
      </div>

      <HeroBoard class="home__hero-board" />
    </section>

    <div class="home__body">
      <!-- ── Left: public rooms and tournaments ── -->
      <section class="home__section home__section--lobby">
        <div class="home__section-header">
          <h2 class="home__section-title">
            <span class="home__live-dot" aria-hidden="true" />
            Salas abiertas
          </h2>
          <div class="home__filters" role="group" aria-label="Filtrar salas y torneos">
            <button
              v-for="option in listingFilters"
              :key="option.id"
              type="button"
              class="home__filter"
              :class="{ 'home__filter--active': listingFilter === option.id }"
              :aria-pressed="listingFilter === option.id"
              @click="listingFilter = option.id"
            >
              {{ option.label }}
              <span>{{ option.count }}</span>
            </button>
          </div>
        </div>

        <div class="home__rooms">
          <TransitionGroup name="room-list" tag="div" class="home__rooms-inner">
            <div
              v-for="room in filteredListings"
              :key="`${room.kind}-${room.roomId}`"
              class="room-card"
              :class="{
                'room-card--playing': room.phase === 'playing',
                'room-card--tournament': room.kind === 'tournament',
              }"
            >
              <span class="room-card__badge" :class="`room-card__badge--${room.kind}`" aria-hidden="true">
                {{ room.kind === 'tournament' ? '★' : room.playerCount }}
              </span>
              <div class="room-card__info">
                <div class="room-card__heading">
                  <span class="room-card__name">{{ room.name }}</span>
                  <span class="room-card__kind" :class="`room-card__kind--${room.kind}`">
                    {{ room.kind === 'tournament' ? 'Torneo' : 'Sala' }}
                  </span>
                </div>
                <span class="room-card__meta">
                  <span v-if="room.kind === 'room'" class="room-card__dots">
                    <span
                      v-for="i in room.maxPlayers"
                      :key="i"
                      class="room-card__dot"
                      :class="{ 'room-card__dot--filled': i <= room.playerCount }"
                    />
                  </span>
                  {{ room.playerCount }}/{{ room.maxPlayers }}
                  <span class="room-card__phase" :class="{ 'room-card__phase--live': room.phase === 'playing' }">
                    {{ room.phase === 'playing' ? 'En juego' : 'Esperando' }}
                    <template v-if="room.kind === 'tournament' && room.stage">
                      · Ronda {{ room.stage }}
                    </template>
                  </span>
                </span>
              </div>
              <div class="room-card__actions">
                <button
                  v-if="room.kind === 'room'"
                  class="room-card__spectator-btn"
                  :disabled="loading"
                  @click="handleSpectatePublic(room.roomId)"
                >
                  Ver
                </button>
                <button
                  class="room-card__btn"
                  :disabled="isListingDisabled(room)"
                  :title="listingJoinTitle(room)"
                  @click="handleJoinListing(room)"
                >
                  {{ listingButtonLabel(room) }}
                </button>
              </div>
            </div>
          </TransitionGroup>

          <div v-if="filteredListings.length === 0" class="home__empty">
            <span class="home__empty-rings" aria-hidden="true">
              <i /><i /><i />
            </span>
            <p>{{ emptyListingTitle }}</p>
            <p class="home__empty-sub">{{ emptyListingSubtitle }}</p>
          </div>
        </div>

        <section class="home__guide" aria-label="Cómo se juega">
          <h2 class="home__section-title">Cómo se gana</h2>
          <div class="home__guide-grid">
            <article class="home__guide-card">
              <span class="home__guide-visual" aria-hidden="true">
                <i class="st-ring st-ring--medium" /><i class="st-ring st-ring--medium" /><i class="st-ring st-ring--medium" />
              </span>
              <div>
                <strong>Mismo tamaño en línea</strong>
                <p>Tres anillos iguales en fila, columna o diagonal.</p>
              </div>
            </article>
            <article class="home__guide-card">
              <span class="home__guide-visual home__guide-visual--order" aria-hidden="true">
                <i class="st-ring st-ring--large" /><i class="st-ring st-ring--medium" /><i class="st-ring st-ring--small" />
              </span>
              <div>
                <strong>Tamaños en orden</strong>
                <p>Grande, mediano y pequeño seguidos en una línea.</p>
              </div>
            </article>
            <article class="home__guide-card">
              <span class="home__guide-visual home__guide-visual--stack" aria-hidden="true">
                <i class="st-ring st-ring--large" /><i class="st-ring st-ring--medium" /><i class="st-ring st-ring--small" />
              </span>
              <div>
                <strong>Casilla completa</strong>
                <p>Tus tres tamaños dentro de la misma casilla.</p>
              </div>
            </article>
          </div>
        </section>
      </section>

      <!-- ── Right: create / join / tournament / watch ── -->
      <section class="home__section home__section--actions">
        <div class="home__tabs" role="tablist" aria-label="¿Qué quieres hacer?">
          <button
            v-for="tab in actionTabs"
            :id="`tab-${tab.id}`"
            :key="tab.id"
            type="button"
            role="tab"
            class="home__tab"
            :class="{ 'home__tab--active': activeTab === tab.id }"
            :aria-selected="activeTab === tab.id"
            :aria-controls="`panel-${tab.id}`"
            @click="selectTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="home__card">
          <Transition name="panel" mode="out-in">
            <!-- Create room -->
            <div v-if="activeTab === 'create'" id="panel-create" key="create" class="home__panel" role="tabpanel" aria-labelledby="tab-create">
              <div class="home__panel-head">
                <h3 class="home__card-title">Nueva sala</h3>
                <p class="home__card-sub">Invita a hasta 3 amigos con un código.</p>
              </div>

              <div class="home__field">
                <label class="home__label" for="room-name">Nombre de la sala</label>
                <input
                  id="room-name"
                  v-model="roomNameInput"
                  class="home__input"
                  type="text"
                  :placeholder="`Sala de ${usernameInput || 'jugador'}`"
                  maxlength="30"
                  autocomplete="off"
                />
              </div>

              <div class="home__toggle-row" role="group" aria-label="Visibilidad">
                <button
                  type="button"
                  class="home__toggle-btn"
                  :class="{ 'home__toggle-btn--active': !createIsPrivate }"
                  :aria-pressed="!createIsPrivate"
                  @click="createIsPrivate = false"
                >
                  Pública
                </button>
                <button
                  type="button"
                  class="home__toggle-btn"
                  :class="{ 'home__toggle-btn--active': createIsPrivate }"
                  :aria-pressed="createIsPrivate"
                  @click="createIsPrivate = true"
                >
                  Privada
                </button>
              </div>

              <Transition name="slide">
                <div v-if="createIsPrivate" class="home__field">
                  <label class="home__label" for="room-password">Contraseña</label>
                  <input
                    id="room-password"
                    v-model="createPasswordInput"
                    class="home__input"
                    type="text"
                    placeholder="Contraseña de la sala"
                    maxlength="20"
                    autocomplete="off"
                  />
                </div>
              </Transition>

              <button
                class="st-btn home__btn"
                :disabled="!canProceed || loading"
                @click="handleCreate"
              >
                {{ loading && action === 'create' ? 'Creando…' : 'Crear sala' }}
              </button>
            </div>

            <!-- Join private room -->
            <div v-else-if="activeTab === 'join'" id="panel-join" key="join" class="home__panel" role="tabpanel" aria-labelledby="tab-join">
              <div class="home__panel-head">
                <h3 class="home__card-title">Unirse con código</h3>
                <p class="home__card-sub">Pide el código de 6 letras a quien creó la sala.</p>
              </div>

              <div class="home__field">
                <label class="home__label" for="room-code">Código</label>
                <input
                  id="room-code"
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
                <label class="home__label" for="join-password">Contraseña <span class="home__label-opt">(si la sala es privada)</span></label>
                <input
                  id="join-password"
                  v-model="joinPasswordInput"
                  class="home__input"
                  type="text"
                  placeholder="Opcional"
                  maxlength="20"
                  autocomplete="off"
                  @keydown.enter="handleJoinPrivate"
                />
              </div>

              <button
                class="st-btn home__btn"
                :disabled="!canJoin || loading"
                @click="handleJoinPrivate"
              >
                {{ loading && action === 'join' ? 'Entrando…' : 'Entrar a la sala' }}
              </button>
            </div>

            <!-- Tournament -->
            <div v-else-if="activeTab === 'tournament'" id="panel-tournament" key="tournament" class="home__panel" role="tabpanel" aria-labelledby="tab-tournament">
              <div class="home__panel-head">
                <h3 class="home__card-title">Torneo <span class="home__tournament-badge">hasta 50</span></h3>
                <p class="home__card-sub">Grupos de 3 o 4 jugadores. Los ganadores avanzan hasta la final.</p>
              </div>

              <div class="home__field">
                <label class="home__label" for="tournament-name">Nombre del torneo</label>
                <input
                  id="tournament-name"
                  v-model="tournamentNameInput"
                  class="home__input"
                  type="text"
                  :placeholder="`Torneo de ${usernameInput || 'jugador'}`"
                  maxlength="30"
                  autocomplete="off"
                />
              </div>

              <button
                class="st-btn home__btn"
                :disabled="!canProceed || tournamentLoading"
                @click="handleCreateTournament"
              >
                {{ tournamentAction === 'create' ? 'Creando torneo…' : 'Crear torneo' }}
              </button>

              <div class="home__separator"><span>o únete con un código</span></div>

              <div class="home__inline-join">
                <label class="home__label home__sr" for="tournament-code">Código de torneo</label>
                <input
                  id="tournament-code"
                  v-model="tournamentCodeInput"
                  class="home__input home__input--code"
                  type="text"
                  placeholder="XK7F2A"
                  maxlength="6"
                  autocomplete="off"
                  @input="tournamentCodeInput = tournamentCodeInput.toUpperCase()"
                  @keydown.enter="handleJoinTournament"
                />
                <button
                  class="st-btn st-btn--ghost"
                  :disabled="!canJoinTournament || tournamentLoading"
                  @click="handleJoinTournament"
                >
                  {{ tournamentAction === 'join' ? '…' : 'Unirse' }}
                </button>
              </div>
            </div>

            <!-- Spectator mode -->
            <div v-else id="panel-watch" key="watch" class="home__panel" role="tabpanel" aria-labelledby="tab-watch">
              <div class="home__panel-head">
                <h3 class="home__card-title">Modo espectador <span class="home__live-badge">En directo</span></h3>
                <p class="home__card-sub">Muestra una partida en la tele o en un proyector. No necesitas nombre.</p>
              </div>

              <div class="home__field">
                <label class="home__label" for="spectator-code">Código de sala</label>
                <input
                  id="spectator-code"
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
                class="st-btn home__btn home__btn--watch"
                :disabled="!canSpectate"
                @click="handleSpectate"
              >
                Ver partida en directo
              </button>
            </div>
          </Transition>
        </div>

        <p v-if="errorMsg" class="home__error" role="alert">{{ errorMsg }}</p>
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
import { useTournamentStore } from '@/stores/tournamentStore'
import { connectSocket, getSocket, waitForSocketConnection } from '@/services/socket'
import type { TournamentCreateAck, TournamentJoinAck } from '@/types/socket'
import HeroBoard from '@/components/HeroBoard.vue'

const router     = useRouter()
const route      = useRoute()
const userStore  = useUserStore()
const roomStore  = useRoomStore()
const lobbyStore = useLobbyStore()
const audioStore = useAudioStore()
const tournamentStore = useTournamentStore()

const usernameInput       = ref(userStore.username ?? '')
const roomNameInput       = ref('')
const roomCodeInput       = ref((route.query.code as string) ?? '')
const tournamentNameInput = ref('')
const tournamentCodeInput = ref('')
const spectatorCodeInput  = ref('')
const createPasswordInput = ref('')
const joinPasswordInput   = ref('')
const createIsPrivate     = ref(false)
const loading             = ref(false)
const loadingRoomId       = ref<string | null>(null)
const joiningTournamentId = ref<string | null>(null)
const tournamentLoading   = ref(false)
const tournamentAction    = ref<'create' | 'join' | null>(null)
const action              = ref<'create' | 'join' | null>(null)
const listingFilter       = ref<'all' | 'room' | 'tournament'>('all')
const errorMsg            = ref<string | null>(null)
const notice              = ref<string | null>(null)
let noticeTimer: number | undefined
const usernameField = ref<HTMLInputElement | null>(null)

type ActionTab = 'create' | 'join' | 'tournament' | 'watch'
const actionTabs: Array<{ id: ActionTab; label: string }> = [
  { id: 'create', label: 'Crear' },
  { id: 'join', label: 'Unirse' },
  { id: 'tournament', label: 'Torneo' },
  { id: 'watch', label: 'Ver' },
]
const activeTab = ref<ActionTab>(route.query.code ? 'join' : 'create')

function selectTab(tab: ActionTab) {
  if (tab === activeTab.value) return
  audioStore.playSfx('click')
  activeTab.value = tab
}

const publicListings = computed(() => lobbyStore.publicRooms)
const roomListings = computed(() => publicListings.value.filter(listing => listing.kind === 'room'))
const tournamentListings = computed(() =>
  publicListings.value.filter(listing => listing.kind === 'tournament')
)
const filteredListings = computed(() => {
  if (listingFilter.value === 'room') return roomListings.value
  if (listingFilter.value === 'tournament') return tournamentListings.value
  return publicListings.value
})
const listingFilters = computed(() => [
  { id: 'all' as const, label: 'Todos', count: publicListings.value.length },
  { id: 'room' as const, label: 'Salas', count: roomListings.value.length },
  { id: 'tournament' as const, label: 'Torneos', count: tournamentListings.value.length },
])
const emptyListingTitle = computed(() => {
  if (listingFilter.value === 'tournament') return 'No hay torneos públicos activos'
  if (listingFilter.value === 'room') return 'No hay salas públicas activas'
  return 'No hay salas ni torneos activos'
})
const emptyListingSubtitle = computed(() =>
  listingFilter.value === 'tournament'
    ? 'Crea un torneo para empezar'
    : listingFilter.value === 'room'
      ? 'Crea una sala para empezar'
      : 'Crea una sala o un torneo para empezar'
)
const canProceed  = computed(() => usernameInput.value.trim().length >= 2)
const canJoin     = computed(() => canProceed.value && roomCodeInput.value.trim().length === 6)
const canJoinTournament = computed(() =>
  canProceed.value && tournamentCodeInput.value.trim().length === 6
)
const canSpectate = computed(() => spectatorCodeInput.value.trim().length === 6)

function isListingDisabled(listing: { kind: 'room' | 'tournament'; phase: string }): boolean {
  if (listing.phase === 'playing' || !canProceed.value) return true
  return listing.kind === 'tournament' ? tournamentLoading.value : loading.value
}

function listingJoinTitle(listing: { kind: 'room' | 'tournament'; phase: string }): string {
  if (listing.phase === 'playing') return 'La partida ya comenzó'
  if (!canProceed.value) return 'Escribe tu nombre para unirte'
  return listing.kind === 'tournament' ? 'Unirse al torneo' : 'Unirse a la sala'
}

function listingButtonLabel(listing: { kind: 'room' | 'tournament'; roomId: string; phase: string }): string {
  const busy = listing.kind === 'tournament'
    ? joiningTournamentId.value === listing.roomId
    : loadingRoomId.value === listing.roomId
  if (busy) return '...'
  if (listing.phase === 'playing') return 'En juego'
  return listing.kind === 'tournament' ? 'Unirse al torneo' : 'Unirse'
}

function handleJoinListing(listing: { kind: 'room' | 'tournament'; roomId: string }): void {
  if (listing.kind === 'tournament') {
    void handleJoinTournamentById(listing.roomId)
    return
  }
  void handleJoinPublic(listing.roomId)
}

onMounted(() => {
  connectSocket()
  const socket = getSocket()
  socket.on('rooms:list', rooms => lobbyStore.setRooms(rooms))
  socket.emit('rooms:get', rooms => lobbyStore.setRooms(rooms))

  const next = route.query.next as string | undefined
  if (next) {
    const roomMatch = next.match(/\/room\/([A-Z0-9]+)/)
    if (roomMatch) {
      roomCodeInput.value = roomMatch[1]
      activeTab.value = 'join'
    }
    const tournamentMatch = next.match(/\/tournament\/([A-Z0-9]+)/)
    if (tournamentMatch) {
      tournamentCodeInput.value = tournamentMatch[1]
      activeTab.value = 'tournament'
    }
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
    userId:    userStore.userId,
    name,
    isPrivate: createIsPrivate.value,
    password:  createIsPrivate.value ? createPasswordInput.value || undefined : undefined,
  }, res => {
    loading.value = false
    if (!res.ok || !res.roomId || !res.playerSlot) {
      errorMsg.value = res.error ?? 'Error al crear sala'
      return
    }
    roomStore.setFromAck(
      res.roomId,
      res.playerSlot,
      createIsPrivate.value ? createPasswordInput.value || undefined : undefined,
      res.reconnectToken,
    )
    if (res.roomState) roomStore.setRoomState(res.roomState)
    router.push(`/room/${res.roomId}`)
  })
}

async function requestTournament<T extends { ok: boolean; error?: string }>(
  timeoutMessage: string,
  emit: (done: (result: T) => void) => void,
): Promise<T> {
  if (!await waitForSocketConnection()) {
    return { ok: false, error: 'No se pudo conectar con el servidor' } as T
  }
  return new Promise(resolve => {
    let settled = false
    const timeout = window.setTimeout(() => {
      if (settled) return
      settled = true
      resolve({ ok: false, error: timeoutMessage } as T)
    }, 8_000)
    emit(result => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      resolve(result)
    })
  })
}

async function handleCreateTournament() {
  if (!canProceed.value || tournamentLoading.value) return
  audioStore.playSfx('click')
  userStore.setUsername(usernameInput.value)
  tournamentLoading.value = true
  tournamentAction.value = 'create'
  errorMsg.value = null

  const socket = getSocket()
  const result = await requestTournament<TournamentCreateAck>(
    'El servidor no respondió al crear el torneo',
    done => socket.emit('tournament:create', {
      username: usernameInput.value.trim(),
      userId: userStore.userId,
      name: tournamentNameInput.value.trim(),
    }, done),
  )
  tournamentLoading.value = false
  tournamentAction.value = null

  if (!result.ok || !result.tournamentId || !result.participantId || !result.reconnectToken) {
    errorMsg.value = result.error ?? 'No se pudo crear el torneo'
    return
  }
  tournamentStore.setFromAck(
    result.tournamentId,
    result.participantId,
    result.reconnectToken,
    result.state,
  )
  await router.push(`/tournament/${result.tournamentId}`)
}

async function handleJoinTournament() {
  if (!canJoinTournament.value) return
  await handleJoinTournamentById(tournamentCodeInput.value.trim().toUpperCase())
}

async function handleJoinTournamentById(tournamentId: string) {
  if (!canProceed.value) {
    showNotice('Escribe tu nombre antes de unirte a un torneo')
    return
  }
  if (tournamentLoading.value || !/^[A-Z0-9]{6}$/.test(tournamentId)) return

  audioStore.playSfx('click')
  userStore.setUsername(usernameInput.value)
  tournamentLoading.value = true
  joiningTournamentId.value = tournamentId
  tournamentAction.value = 'join'
  errorMsg.value = null

  try {
    const socket = getSocket()
    const result = await requestTournament<TournamentJoinAck>(
      'El servidor no respondió al unirse al torneo',
      done => socket.emit('tournament:join', {
        tournamentId,
        username: usernameInput.value.trim(),
        userId: userStore.userId,
      }, done),
    )

    if (!result.ok || !result.tournamentId || !result.participantId || !result.reconnectToken) {
      errorMsg.value = result.error ?? 'No se pudo unir al torneo'
      return
    }
    tournamentStore.setFromAck(
      result.tournamentId,
      result.participantId,
      result.reconnectToken,
      result.state,
    )
    await router.push(`/tournament/${result.tournamentId}`)
  } finally {
    tournamentLoading.value = false
    joiningTournamentId.value = null
    tournamentAction.value = null
  }
}

async function handleJoinPublic(roomId: string) {
  if (!canProceed.value) {
    showNotice('Escribe tu nombre antes de unirte a una sala')
    return
  }
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

  socket.emit('room:join', {
    roomId,
    username: usernameInput.value.trim(),
    userId: userStore.userId,
  }, res => {
    loading.value       = false
    loadingRoomId.value = null
    if (!res.ok || !res.roomId || !res.playerSlot) {
      errorMsg.value = res.error ?? 'No se pudo unir'
      return
    }
    roomStore.setFromAck(res.roomId, res.playerSlot, undefined, res.reconnectToken)
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
    userId:   userStore.userId,
    password: joinPasswordInput.value || undefined,
  }, res => {
    loading.value = false
    if (!res.ok || !res.roomId || !res.playerSlot) {
      errorMsg.value = res.error ?? 'No se pudo unir a la sala'
      return
    }
    roomStore.setFromAck(res.roomId, res.playerSlot, joinPasswordInput.value || undefined, res.reconnectToken)
    if (res.roomState) roomStore.setRoomState(res.roomState)
    router.push(`/room/${res.roomId}`)
  })
}

function handleSpectate() {
  if (!canSpectate.value) return
  audioStore.playSfx('click')
  router.push(`/spectate/${spectatorCodeInput.value.trim().toUpperCase()}`)
}

function handleSpectatePublic(roomId: string) {
  audioStore.playSfx('click')
  router.push(`/spectate/${roomId}`)
}

function showNotice(message: string) {
  notice.value = message
  if (!canProceed.value) usernameField.value?.focus()
  if (noticeTimer) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    notice.value = null
    noticeTimer = undefined
  }, 3_200)
}
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: clamp(28px, 5vw, 48px);
  width: 100%;
  max-width: 1160px;
  min-height: 100vh;
  margin: 0 auto;
  padding: clamp(20px, 4vw, 44px) max(16px, env(safe-area-inset-right, 0px)) 64px max(16px, env(safe-area-inset-left, 0px));
  padding-left: max(clamp(16px, 4vw, 40px), env(safe-area-inset-left, 0px));
  padding-right: max(clamp(16px, 4vw, 40px), env(safe-area-inset-right, 0px));
}

.home__notice {
  position: fixed;
  top: 78px;
  left: 50%;
  z-index: 300;
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: calc(100vw - 32px);
  padding: 11px 16px 11px 12px;
  border: 1px solid var(--accent-secondary);
  border-radius: 999px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-card);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  transform: translateX(-50%);
}

.home__notice-icon {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent-secondary);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
}

.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.3s var(--ease-spring); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, -10px); }

/* ── Hero ── */
.home__hero {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  align-items: center;
  gap: clamp(24px, 5vw, 64px);
}

.home__hero-copy {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: st-pop-in 0.6s var(--ease-out) both;
}

.home__eyebrow { color: var(--accent-primary); }

.home__hero h1 {
  color: var(--text-primary);
  font-size: clamp(44px, 7.4vw, 88px);
  font-weight: 800;
  line-height: 0.92;
  letter-spacing: -0.045em;
}

.home__hero h1 em {
  background: var(--gradient-brand);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-style: normal;
}

.home__hero p {
  max-width: 52ch;
  color: var(--text-secondary);
  font-size: clamp(15px, 1.6vw, 17px);
  line-height: 1.55;
}

.home__hero-board {
  justify-self: center;
  animation: st-pop-in 0.7s 0.15s var(--ease-out) both;
}

/* Username */
.home__username {
  display: flex;
  flex-direction: column;
  gap: 7px;
  max-width: 440px;
  margin-top: 6px;
}

.home__username-label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.home__username-field {
  --piece-color: var(--text-faint);
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px 8px 10px;
  border: 1.5px solid var(--line-strong);
  border-radius: 999px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.home__username-field:focus-within {
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-card), 0 0 0 4px color-mix(in srgb, var(--accent-primary) 18%, transparent);
}

.home__username--ready .home__username-field { --piece-color: var(--accent-primary); }

.home__username-ring {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  transition: transform 0.5s var(--ease-spring);
}

.home__username--ready .home__username-ring { transform: rotate(180deg); }

.home__username-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
}

.home__username-input::placeholder { color: var(--text-faint); font-weight: 500; }

.home__username-ok {
  color: var(--accent-success);
  font-size: 18px;
  font-weight: 900;
  animation: st-pop-in 0.3s var(--ease-spring);
}

.home__username-hint { color: var(--text-muted); font-size: 13px; }

/* ── Body columns ── */
.home__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 28px;
  align-items: start;
}

.home__section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.home__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.home__section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
  font-size: 22px;
}

.home__live-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent-success);
  animation: live-ping 1.8s ease-out infinite;
}

@keyframes live-ping {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-success) 70%, transparent); }
  100% { box-shadow: 0 0 0 9px transparent; }
}

.home__filters {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--surface-muted);
}

.home__filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 4px 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  transition: background 0.2s ease, color 0.2s ease;
}

.home__filter span {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
}

.home__filter:hover { color: var(--text-primary); }

.home__filter--active {
  background: var(--surface-raised);
  color: var(--text-primary);
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.25);
}

.home__filter--active span { color: var(--accent-primary); }

/* ── Room list ── */
.home__rooms { display: flex; flex-direction: column; }

.home__rooms-inner {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 12px 12px 14px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-m);
  background: var(--surface);
  transition: border-color 0.2s ease, transform 0.25s var(--ease-spring), box-shadow 0.25s ease;
}

.room-card:not(.room-card--playing):hover {
  border-color: var(--line-strong);
  transform: translateY(-2px);
  box-shadow: var(--shadow-card);
}

.room-card--playing { opacity: 0.6; }

.room-card__badge {
  display: grid;
  place-items: center;
  flex: 0 0 42px;
  height: 42px;
  border-radius: 50%;
  border: 5px solid var(--player-2-color);
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 800;
}

.room-card__badge--tournament {
  border-color: var(--accent-secondary);
  color: var(--accent-secondary);
  font-size: 16px;
}

.room-card__info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.room-card__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.room-card__kind {
  flex: 0 0 auto;
  padding: 1px 7px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.room-card__kind--tournament {
  border-color: color-mix(in srgb, var(--accent-secondary) 55%, transparent);
  color: var(--accent-secondary);
}

.room-card__name {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-card__meta {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
}

.room-card__dots { display: flex; gap: 3px; }

.room-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--line-strong);
}

.room-card__dot--filled { border-color: var(--player-2-color); background: var(--player-2-color); }

.room-card__phase { font-family: var(--font-body); }
.room-card__phase--live { color: var(--accent-secondary); font-weight: 700; }

.room-card__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.room-card__btn,
.room-card__spectator-btn {
  min-height: 38px;
  padding: 7px 16px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  transition: transform 0.2s var(--ease-spring), background 0.2s ease, opacity 0.2s ease;
}

.room-card__btn {
  border: 0;
  background: var(--gradient-primary);
  color: var(--text-on-accent);
}

.room-card--tournament .room-card__btn { background: var(--gradient-brand); }
.room-card__btn:not(:disabled):hover { transform: translateY(-1px) scale(1.03); }

.room-card__spectator-btn {
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--text-secondary);
}

.room-card__spectator-btn:not(:disabled):hover { background: var(--control-hover); color: var(--text-primary); }

.room-card__btn:disabled,
.room-card__spectator-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Empty state */
.home__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 190px;
  padding: 24px;
  border: 1.5px dashed var(--line-strong);
  border-radius: var(--radius-m);
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 600;
  text-align: center;
}

.home__empty-rings {
  position: relative;
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  margin-bottom: 10px;
}

.home__empty-rings i {
  position: absolute;
  border: 2px dashed var(--line-strong);
  border-radius: 50%;
  animation: st-spin 18s linear infinite;
}

.home__empty-rings i:nth-child(1) { inset: 0; }
.home__empty-rings i:nth-child(2) { inset: 12px; animation-direction: reverse; }
.home__empty-rings i:nth-child(3) { inset: 22px; border-style: solid; background: var(--line-soft); }

.home__empty-sub { color: var(--text-muted); font-size: 13px; font-weight: 400; }

/* ── Quick rules ── */
.home__guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 18px;
}

.home__guide-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.home__guide-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-m);
  background: var(--surface-muted);
}

.home__guide-visual {
  --piece-color: var(--accent-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
}

.home__guide-visual i { width: 24px; height: 24px; }
.home__guide-visual--order { --piece-color: var(--player-2-color); }
.home__guide-visual--order i:nth-child(2) { width: 17px; height: 17px; }
.home__guide-visual--order i:nth-child(3) { width: 10px; height: 10px; }

.home__guide-visual--stack {
  --piece-color: var(--accent-secondary);
  position: relative;
  width: 30px;
}

.home__guide-visual--stack i { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.home__guide-visual--stack i:nth-child(1) { width: 30px; height: 30px; }
.home__guide-visual--stack i:nth-child(2) { width: 18px; height: 18px; }
.home__guide-visual--stack i:nth-child(3) { width: 8px; height: 8px; }

.home__guide-card strong {
  display: block;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 15px;
  line-height: 1.2;
}

.home__guide-card p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

/* ── Actions ── */
.home__section--actions {
  position: sticky;
  top: 84px;
  gap: 10px;
}

.home__tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--surface-muted);
}

.home__tab {
  min-height: 38px;
  padding: 6px 4px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  transition: background 0.2s ease, color 0.2s ease;
}

.home__tab:hover { color: var(--text-primary); }

.home__tab--active {
  background: var(--surface-raised);
  color: var(--text-primary);
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.25);
}

.home__card {
  padding: 22px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-l);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.home__panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.home__panel-head { display: flex; flex-direction: column; gap: 4px; }

.home__card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: 22px;
}

.home__card-sub {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.45;
}

.home__tournament-badge,
.home__live-badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.home__tournament-badge { background: color-mix(in srgb, var(--accent-secondary) 18%, transparent); color: var(--accent-secondary); }
.home__live-badge { background: color-mix(in srgb, var(--accent-danger) 18%, transparent); color: var(--accent-danger); }

.home__separator {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 12px;
}

.home__separator::before,
.home__separator::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--line-soft);
}

.home__inline-join {
  display: flex;
  gap: 8px;
}

.home__inline-join .home__input { flex: 1; min-width: 0; }
.home__inline-join .st-btn { min-height: 44px; padding: 8px 18px; }

.home__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ── Fields ── */
.home__field { display: flex; flex-direction: column; gap: 6px; }

.home__label {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.home__label-opt { color: var(--text-muted); font-weight: 400; }

.home__input {
  width: 100%;
  min-height: 46px;
  padding: 10px 14px;
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-s);
  outline: none;
  background: var(--cell-bg);
  color: var(--text-primary);
  font-size: 15px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.home__input::placeholder { color: var(--text-faint); }

.home__input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-primary) 16%, transparent);
}

.home__input--code {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

/* ── Toggle ── */
.home__toggle-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-s);
  background: var(--surface-muted);
}

.home__toggle-btn {
  min-height: 36px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  transition: background 0.15s, color 0.15s;
}

.home__toggle-btn--active {
  background: var(--surface-raised);
  color: var(--text-primary);
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.25);
}

.home__btn { width: 100%; margin-top: 2px; }

.home__btn--watch {
  background: var(--gradient-secondary);
}

.home__error {
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--accent-danger) 50%, transparent);
  border-radius: var(--radius-s);
  background: color-mix(in srgb, var(--accent-danger) 10%, transparent);
  color: var(--accent-danger);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}

/* ── Transitions ── */
.panel-enter-active { transition: opacity 0.25s ease, transform 0.3s var(--ease-out); }
.panel-leave-active { transition: opacity 0.12s ease; }
.panel-enter-from { opacity: 0; transform: translateY(8px); }
.panel-leave-to { opacity: 0; }

.slide-enter-active, .slide-leave-active {
  transition: max-height 0.25s ease, opacity 0.2s ease;
  overflow: hidden;
  max-height: 90px;
}
.slide-enter-from, .slide-leave-to { max-height: 0; opacity: 0; }

.room-list-enter-active { transition: opacity 0.3s ease, transform 0.35s var(--ease-spring); }
.room-list-leave-active { transition: opacity 0.2s ease; position: absolute; width: 100%; }
.room-list-enter-from { opacity: 0; transform: translateY(-8px) scale(0.98); }
.room-list-leave-to { opacity: 0; }
.room-list-move { transition: transform 0.35s var(--ease-out); }

/* ── Responsive ── */
@media (max-width: 980px) {
  .home__body { grid-template-columns: 1fr; }
  .home__section--actions { position: static; order: -1; }
}

@media (max-width: 760px) {
  .home__hero { grid-template-columns: 1fr; }
  .home__hero-board { --cell: clamp(54px, 17vw, 80px); grid-row: 1; }
  .home__guide-grid { grid-template-columns: 1fr; }
  .home__guide-card { flex-direction: row; align-items: center; }
  .home__guide-visual { flex: 0 0 90px; }
}

@media (max-width: 520px) {
  .room-card { flex-wrap: wrap; }
  .room-card__info { flex: 1 1 calc(100% - 60px); }
  .room-card__actions { width: 100%; justify-content: flex-end; }
  .home__card { padding: 18px; }
  .home__tab { font-size: 12px; }
}
</style>
