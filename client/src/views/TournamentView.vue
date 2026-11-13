<template>
  <div class="tournament">
    <header class="tournament__header">
      <div class="tournament__identity">
        <span class="tournament__eyebrow">Modo torneo</span>
        <h1>{{ store.name || 'Torneo' }}</h1>
        <span class="tournament__code">#{{ roomId }}</span>
      </div>
      <div class="tournament__header-actions">
        <span class="tournament__status" :class="`tournament__status--${store.phase}`">
          {{ statusLabel }}
        </span>
        <button type="button" class="tournament__leave" @click="goHome">Salir</button>
      </div>
    </header>

    <TournamentSpectatorOverlay
      v-if="spectatingGroupId && spectatingRoomId"
      :group-label="spectatingGroupLabel"
      @close="closeSpectate"
    />

    <div v-if="fatalError" class="tournament__message tournament__message--error">
      <strong>No se pudo abrir el torneo</strong>
      <span>{{ fatalError }}</span>
      <button class="tournament__back" @click="goHome">Volver al inicio</button>
    </div>

    <div v-else-if="loading" class="tournament__message">
      <span class="tournament__loader" />
      Conectando al torneo…
    </div>

    <template v-else>
      <p v-if="actionError" class="tournament__action-error" role="alert">{{ actionError }}</p>

      <!-- Waiting room -->
      <section v-if="store.phase === 'waiting'" class="tournament__lobby">
        <div class="tournament__summary">
          <div>
            <strong>{{ store.connectedCount }}</strong>
            <span>conectados</span>
          </div>
          <div>
            <strong>{{ store.participants.length }}/{{ store.maxParticipants }}</strong>
            <span>inscritos</span>
          </div>
          <div>
            <strong>3</strong>
            <span>mínimo para iniciar</span>
          </div>
        </div>

        <p class="tournament__hint">
          Los jugadores se repartirán priorizando grupos de 4 y después grupos de 3.
          Solo se usará un grupo de 2 cuando el total no permita otra combinación,
          como ocurre con 5 jugadores.
        </p>

        <div class="tournament__settings">
          <span class="tournament__eyebrow">Formato del torneo</span>
          <div v-if="isHost" class="tournament__format-grid">
            <button
              v-for="option in formatOptions"
              :key="option.id"
              type="button"
              class="tournament__format-option"
              :class="{ 'tournament__format-option--active': store.format === option.id }"
              :disabled="savingSettings"
              :aria-pressed="store.format === option.id"
              @click="changeFormat(option.id)"
            >
              <strong>{{ option.label }}</strong>
              <small>{{ option.description }}</small>
            </button>
          </div>
          <p v-else class="tournament__format-summary">
            {{ formatSummary }}
          </p>

          <label
            v-if="isHost && store.format === 'league'"
            class="tournament__rounds"
          >
            <span>Rondas de liga</span>
            <select
              :value="store.leagueRounds"
              :disabled="savingSettings"
              @change="changeLeagueRounds"
            >
              <option v-for="rounds in 10" :key="rounds" :value="rounds">{{ rounds }}</option>
            </select>
          </label>

          <label v-if="isHost" class="tournament__rounds">
            <span>Tiempo por jugador</span>
            <select
              :value="store.playerClockSeconds"
              :disabled="savingSettings"
              @change="changePlayerClock"
            >
              <option v-for="clock in playerClockOptions" :key="clock.value" :value="clock.value">
                {{ clock.label }}
              </option>
            </select>
          </label>

          <p class="tournament__note tournament__settings-note">
            {{ clockSummary }}
          </p>

          <p class="tournament__note tournament__settings-note">
            {{ formatDescription }}
          </p>
        </div>

        <div class="tournament__invite">
          <code><span v-for="(char, index) in roomId.split('')" :key="index">{{ char }}</span></code>
          <button type="button" @click="copyLink">
            {{ copied ? '¡Copiado!' : 'Copiar enlace del torneo' }}
          </button>
        </div>

        <div class="tournament__participants">
          <article
            v-for="participant in store.participants"
            :key="participant.id"
            class="tournament__participant"
            :class="{ 'tournament__participant--offline': !participant.connected }"
          >
            <span class="tournament__participant-dot" :class="{ 'is-online': participant.connected }" />
            <span class="tournament__participant-name">{{ participant.username }}</span>
            <span v-if="participant.id === store.hostId" class="tournament__host-badge">Anfitrión</span>
            <span v-if="participant.id === store.myParticipantId" class="tournament__you">tú</span>
          </article>
        </div>

        <div v-if="isHost" class="tournament__host-actions">
          <button
            type="button"
            class="st-btn tournament__primary"
            :disabled="!canStart || starting || savingSettings"
            @click="startTournament"
          >
            {{ starting ? 'Repartiendo grupos…' : 'Iniciar torneo' }}
          </button>
          <p v-if="store.connectedCount < 3" class="tournament__note">
            Faltan {{ 3 - store.connectedCount }} jugador{{ 3 - store.connectedCount === 1 ? '' : 'es' }} conectado{{ 3 - store.connectedCount === 1 ? '' : 's' }} para iniciar.
          </p>
        </div>
        <p v-else class="tournament__note">Esperando a que el host inicie el torneo…</p>
      </section>

      <!-- Running stage -->
      <section v-else-if="store.phase === 'playing'" class="tournament__stage">
        <div class="tournament__stage-heading">
          <div>
            <span class="tournament__eyebrow">{{ stageEyebrow }}</span>
            <h2>{{ groupHeading }}</h2>
          </div>
          <span class="tournament__advance-count">{{ finishedGroups }}/{{ store.groups.length }} terminados</span>
        </div>

        <div class="tournament__groups">
          <article
            v-for="group in store.groups"
            :key="group.id"
            class="tournament__group"
            :class="{
              'tournament__group--finished': group.status === 'finished',
              'tournament__group--draw': group.status === 'draw' ||
                (store.stageKind === 'league' && group.status === 'finished' && !group.winnerId),
            }"
          >
            <header class="tournament__group-header">
              <strong>{{ group.label }}</strong>
              <div class="tournament__group-tools">
                <span
                  v-if="group.status === 'playing'"
                  class="tournament__max-time"
                  :title="`Duración máxima: ${group.playerIds.length * store.playerClockSeconds} segundos`"
                >
                  Máx. {{ groupMaxTime(group) }}
                </span>
                <span
                  v-if="group.spectatorCount > 0"
                  class="tournament__spectator-count"
                  :title="`${group.spectatorCount} espectador${group.spectatorCount === 1 ? '' : 'es'}`"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
                  {{ group.spectatorCount }}
                </span>
                <span
                  class="tournament__group-status"
                  :class="`tournament__group-status--${
                    group.status === 'finished' &&
                    store.stageKind === 'league' &&
                    !group.winnerId ? 'draw' : group.status
                  }`"
                >
                  {{ groupStatusLabel(group) }}
                </span>
              </div>
            </header>

            <button
              v-if="canSpectateGroup(group)"
              type="button"
              class="tournament__watch"
              :disabled="spectatingGroupId !== null || spectatorOpeningId !== null"
              @click="openSpectate(group)"
            >
              {{ spectatorOpeningId === group.id ? 'Abriendo…' : 'Ver partida' }}
            </button>

            <div class="tournament__group-players">
              <div
                v-for="participantId in group.playerIds"
                :key="participantId"
                class="tournament__group-player"
                :class="{
                  'tournament__group-player--winner': group.winnerId === participantId,
                  'tournament__group-player--out': group.status === 'finished' &&
                    group.winnerId !== participantId &&
                    store.stageKind !== 'league',
                }"
              >
                <span class="tournament__participant-dot" :class="{ 'is-online': participantById(participantId)?.connected }" />
                <span>{{ participantById(participantId)?.username || 'Jugador' }}</span>
                <span v-if="group.winnerId === participantId" class="tournament__winner-badge">Ganador</span>
                <span
                  v-else-if="group.status === 'finished' && store.stageKind !== 'league'"
                  class="tournament__out-badge"
                >
                  Eliminado
                </span>
              </div>
            </div>

            <p v-if="group.replayCount > 0" class="tournament__note">
              Repetición {{ group.replayCount }} por empate.
            </p>

            <button
              v-if="group.status === 'draw' && canRetryGroup(group)"
              type="button"
              class="tournament__secondary"
              :disabled="retryingGroupId === group.id"
              @click="retryGroup(group.id)"
            >
              {{ retryingGroupId === group.id ? 'Preparando…' : 'Repetir grupo' }}
            </button>
          </article>
        </div>

        <TournamentLastGame
          v-if="showLastGame"
          :result="store.lastCompletedGame!"
        />

        <div v-if="store.canAdvance" class="tournament__advance">
          <div class="tournament__ready-card">
            <div class="tournament__ready-copy">
              <span class="tournament__eyebrow">Avance de ronda</span>
              <strong>{{ readyHeading }}</strong>
              <p class="tournament__note">{{ readyProgressText }}</p>
            </div>

            <div class="tournament__ready-list">
              <span
                v-for="participantId in store.readyRequiredIds"
                :key="participantId"
                class="tournament__ready-chip"
                :class="{ 'tournament__ready-chip--done': store.readyIds.includes(participantId) }"
              >
                <span class="tournament__ready-dot" />
                {{ participantById(participantId)?.username || 'Jugador' }}
                <small>{{ store.readyIds.includes(participantId) ? 'Listo' : 'Pendiente' }}</small>
              </span>
            </div>

            <button
              v-if="mustConfirmReady"
              type="button"
              class="st-btn tournament__primary"
              :disabled="myReady || readying"
              @click="confirmReady"
            >
              {{ myReady ? 'Listo ✓' : readying ? 'Confirmando…' : 'Estoy listo' }}
            </button>
            <p v-else class="tournament__note">
              No participas en la siguiente ronda. Esperando a los clasificados…
            </p>

            <p class="tournament__note tournament__ready-auto-note">
              {{ readyAutoNote }}
            </p>
          </div>
        </div>
        <p v-else-if="store.groups.some(group => group.status === 'draw')" class="tournament__note">
          Hay grupos empatados. Pulsa “Repetir grupo” para desempatar.
        </p>
        <p v-else class="tournament__note">
          Esperando a que terminen todos los grupos…
        </p>
      </section>

      <!-- Champion -->
      <section v-else class="tournament__finished">
        <RingBurst :colors="['var(--win-gold)', 'var(--accent-secondary)', 'var(--player-2-color)', 'var(--player-color-emerald)']" :count="140" />
        <span class="tournament__trophy" aria-hidden="true">
          <i class="st-ring st-ring--large" />
          <i class="st-ring st-ring--medium" />
          <i class="st-ring st-ring--small" />
        </span>
        <span class="tournament__eyebrow">Torneo finalizado</span>
        <h2>{{ championName }}</h2>
        <p>es el campeón de {{ store.name }}.</p>
        <button type="button" class="st-btn tournament__primary" @click="goHome">Volver al inicio</button>
      </section>

      <!-- League standings -->
      <section
        v-if="store.format === 'league' && store.phase !== 'waiting'"
        class="tournament__standings"
      >
        <div class="tournament__standings-heading">
          <div>
            <span class="tournament__eyebrow">Clasificación</span>
            <h3>
              {{ store.stageKind === 'sudden-death' ? 'Muerte súbita' : `Liga · ${store.leagueRounds} rondas` }}
            </h3>
          </div>
          <span class="tournament__note">3 pts victoria · 1 pt empate</span>
        </div>

        <div class="tournament__standings-table">
          <div class="tournament__standing-row tournament__standing-row--header">
            <span>#</span>
            <span>Jugador</span>
            <span>PJ</span>
            <span>G</span>
            <span>E</span>
            <span>PTS</span>
          </div>
          <div
            v-for="(participant, index) in standings"
            :key="participant.id"
            class="tournament__standing-row"
            :class="{
              'tournament__standing-row--leader': index === 0 && participant.leaguePoints > 0,
              'tournament__standing-row--me': participant.id === store.myParticipantId,
            }"
          >
            <span>{{ index + 1 }}</span>
            <span class="tournament__standing-name">
              {{ participant.username }}
              <small v-if="!participant.connected">desconectado</small>
            </span>
            <span>{{ participant.leagueGames }}</span>
            <span>{{ participant.leagueWins }}</span>
            <span>{{ participant.leagueDraws }}</span>
            <strong>{{ participant.leaguePoints }}</strong>
          </div>
        </div>

        <p v-if="store.needsTiebreak" class="tournament__note tournament__tiebreak-note">
          Empate en el liderato: hace falta una muerte súbita para decidir el campeón.
        </p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournamentStore'
import { useRoomStore } from '@/stores/roomStore'
import { useGameStore } from '@/stores/gameStore'
import { useUserStore } from '@/stores/userStore'
import { useSocket } from '@/composables/useSocket'
import { connectSocket } from '@/services/socket'
import type { TournamentFormat, TournamentGroupSnapshot } from '@/types/tournament'
import TournamentSpectatorOverlay from '@/components/TournamentSpectatorOverlay.vue'
import TournamentLastGame from '@/components/TournamentLastGame.vue'
import RingBurst from '@/components/RingBurst.vue'

const route = useRoute()
const router = useRouter()
const store = useTournamentStore()
const roomStore = useRoomStore()
const gameStore = useGameStore()
const userStore = useUserStore()
const {
  emitJoinTournament,
  emitReconnectTournament,
  emitLeaveTournament,
  emitTournamentSettings,
  emitStartTournament,
  emitTournamentReady,
  emitRetryTournamentGroup,
  emitJoinSpectator,
  emitLeaveSpectator,
  applyTournamentAssignment,
} = useSocket()

const roomId = String(route.params.id).toUpperCase()
const loading = ref(true)
const fatalError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const copied = ref(false)
const starting = ref(false)
const readying = ref(false)
const savingSettings = ref(false)
const retryingGroupId = ref<string | null>(null)
const spectatingGroupId = ref<string | null>(null)
const spectatingRoomId = ref<string | null>(null)
const spectatorOpeningId = ref<string | null>(null)

const formatOptions = [
  {
    id: 'elimination' as const,
    label: 'Eliminación directa',
    description: 'El ganador de cada grupo avanza hasta la final.',
  },
  {
    id: 'league' as const,
    label: 'Todos contra todos',
    description: 'Todos juegan todas las rondas y suman puntos.',
  },
]

const playerClockOptions = [
  { value: 180, label: '3 minutos' },
  { value: 300, label: '5 minutos' },
  { value: 480, label: '8 minutos' },
  { value: 600, label: '10 minutos' },
  { value: 900, label: '15 minutos' },
]

const isHost = computed(() => store.myParticipantId !== null && store.myParticipantId === store.hostId)
const canStart = computed(() => isHost.value && store.connectedCount >= 3)
const finishedGroups = computed(() =>
  store.groups.filter(group => group.status === 'finished').length
)
const championName = computed(() => {
  const champion = store.participants.find(participant => participant.id === store.championId)
  return champion?.username ?? 'Sin campeón'
})
const statusLabel = computed(() => {
  if (store.phase === 'waiting') return 'SALA DE ESPERA'
  if (store.phase === 'playing') {
    if (store.stageKind === 'sudden-death') return 'MUERTE SÚBITA'
    if (store.format === 'league') return `LIGA · RONDA ${store.stage}/${store.leagueRounds}`
    return 'EN JUEGO'
  }
  return 'FINALIZADO'
})

const formatDescription = computed(() =>
  store.format === 'league'
    ? 'Liga: todos juegan todas las rondas y suman puntos. Victoria = 3 puntos, empate = 1 punto. Si hay empate en el liderato, los empatados juegan una muerte súbita.'
    : 'Eliminación directa: el ganador de cada grupo avanza a la siguiente ronda hasta que queda un campeón.'
)

const formatSummary = computed(() =>
  store.format === 'league'
    ? `Todos contra todos · ${store.leagueRounds} ronda${store.leagueRounds === 1 ? '' : 's'} · ${clockLabel(store.playerClockSeconds)}`
    : `Eliminación directa · ${clockLabel(store.playerClockSeconds)}`
)

const clockSummary = computed(() =>
  `Reloj: ${clockLabel(store.playerClockSeconds)} por jugador. La partida dura como máximo ese tiempo multiplicado por la cantidad de jugadores del grupo.`
)

function clockLabel(seconds: number): string {
  return `${Math.round(seconds / 60)} min`
}

function groupMaxTime(group: TournamentGroupSnapshot): string {
  return `${Math.round((group.playerIds.length * store.playerClockSeconds) / 60)} min`
}

const stageEyebrow = computed(() => {
  if (store.stageKind === 'sudden-death') return `Muerte súbita · Ronda ${store.stage}`
  if (store.stageKind === 'league') {
    return `Liga · Ronda ${store.stage} de ${store.leagueRounds}`
  }
  return `Ronda ${store.stage}`
})

const groupHeading = computed(() => {
  if (store.groups.length !== 1) return `${store.groups.length} grupos`
  return store.stageKind === 'league' ? 'Grupo único' : 'La final'
})

const myCurrentGroup = computed(() => {
  const participant = store.participants.find(candidate => candidate.id === store.myParticipantId)
  if (!participant?.groupId) return null
  return store.groups.find(group => group.id === participant.groupId) ?? null
})
const showLastGame = computed(() =>
  Boolean(store.lastCompletedGame) && myCurrentGroup.value?.status !== 'playing'
)
const readyCount = computed(() =>
  store.readyRequiredIds.filter(participantId => store.readyIds.includes(participantId)).length
)
const myReady = computed(() =>
  Boolean(store.myParticipantId && store.readyIds.includes(store.myParticipantId))
)
const mustConfirmReady = computed(() =>
  Boolean(store.myParticipantId && store.readyRequiredIds.includes(store.myParticipantId))
)
const allReady = computed(() =>
  store.readyRequiredIds.length > 0 && readyCount.value === store.readyRequiredIds.length
)
const readyHeading = computed(() => {
  if (store.needsTiebreak) return 'Listos para la muerte súbita'
  if (store.stageKind === 'league') return 'Listos para la siguiente ronda'
  if (store.stageKind === 'sudden-death') return 'Listos para la siguiente partida'
  return 'Listos para la siguiente ronda'
})
const readyProgressText = computed(() => {
  const total = store.readyRequiredIds.length
  const pending = store.readyRequiredIds.filter(id => !store.readyIds.includes(id))
  if (pending.length === 0) return `${readyCount.value}/${total} clasificados listos.`
  const names = pending
    .map(id => participantById(id)?.username)
    .filter((name): name is string => Boolean(name))
  const waiting = names.length > 0 ? ` Esperando a ${names.join(', ')}.` : ''
  return `${readyCount.value}/${total} listos.${waiting}`
})
const readyAutoNote = computed(() => {
  if (allReady.value) return 'Todos están listos. Comenzando la siguiente ronda…'
  return 'La ronda comenzará automáticamente cuando todos los clasificados confirmen.'
})

const spectatingGroupLabel = computed(() =>
  store.groups.find(group => group.id === spectatingGroupId.value)?.label ?? 'Partida del torneo'
)

function canSpectateGroup(group: TournamentGroupSnapshot): boolean {
  if (group.status !== 'playing' || !group.roomId) return false
  return !store.myParticipantId || !group.playerIds.includes(store.myParticipantId)
}

const standings = computed(() =>
  [...store.participants].sort((a, b) =>
    b.leaguePoints - a.leaguePoints ||
    b.leagueWins - a.leagueWins ||
    b.leagueDraws - a.leagueDraws ||
    a.username.localeCompare(b.username)
  )
)

function participantById(id: string) {
  return store.participants.find(participant => participant.id === id)
}

function groupStatusLabel(group: TournamentGroupSnapshot): string {
  if (group.status === 'draw') return 'Empate'
  if (group.status === 'finished' && store.stageKind === 'league' && !group.winnerId) {
    return 'Empate'
  }
  if (group.status === 'finished') return 'Finalizado'
  return 'En juego'
}

function canRetryGroup(group: { id: string; playerIds: string[] }): boolean {
  return isHost.value || (store.myParticipantId !== null && group.playerIds.includes(store.myParticipantId))
}

function setActionError(message: string | null) {
  actionError.value = message
  store.setError(message)
}

async function saveSettings(
  format: TournamentFormat,
  leagueRounds: number,
  playerClockSeconds: number,
): Promise<boolean> {
  if (!isHost.value || savingSettings.value || store.phase !== 'waiting') return false
  savingSettings.value = true
  setActionError(null)
  try {
    const result = await emitTournamentSettings(
      store.tournamentId ?? roomId,
      format,
      leagueRounds,
      playerClockSeconds,
    )
    if (!result.ok) {
      setActionError(result.error ?? 'No se pudo guardar el formato')
      return false
    }
    return true
  } finally {
    savingSettings.value = false
  }
}

async function changeFormat(format: TournamentFormat) {
  if (format === store.format) return
  await saveSettings(format, store.leagueRounds, store.playerClockSeconds)
}

async function changeLeagueRounds(event: Event) {
  const select = event.target as HTMLSelectElement
  const rounds = Number(select.value)
  const saved = await saveSettings(store.format, rounds, store.playerClockSeconds)
  if (!saved) select.value = String(store.leagueRounds)
}

async function changePlayerClock(event: Event) {
  const select = event.target as HTMLSelectElement
  const seconds = Number(select.value)
  const saved = await saveSettings(store.format, store.leagueRounds, seconds)
  if (!saved) select.value = String(store.playerClockSeconds)
}

async function startTournament() {
  if (!canStart.value || starting.value || savingSettings.value) return
  starting.value = true
  setActionError(null)
  const result = await emitStartTournament(store.tournamentId ?? roomId)
  starting.value = false
  if (!result.ok) setActionError(result.error ?? 'No se pudo iniciar el torneo')
}

async function confirmReady() {
  if (myReady.value || readying.value) return
  readying.value = true
  setActionError(null)
  const result = await emitTournamentReady(store.tournamentId ?? roomId)
  readying.value = false
  if (!result.ok) setActionError(result.error ?? 'No se pudo confirmar tu disponibilidad')
}

async function retryGroup(groupId: string) {
  if (retryingGroupId.value) return
  retryingGroupId.value = groupId
  setActionError(null)
  const result = await emitRetryTournamentGroup(store.tournamentId ?? roomId, groupId)
  retryingGroupId.value = null
  if (!result.ok) setActionError(result.error ?? 'No se pudo repetir el grupo')
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    window.setTimeout(() => { copied.value = false }, 2000)
  } catch {
    setActionError('No se pudo copiar el enlace')
  }
}

async function openSpectate(group: TournamentGroupSnapshot) {
  if (!group.roomId || spectatorOpeningId.value) return
  spectatorOpeningId.value = group.id
  setActionError(null)
  roomStore.reset()
  gameStore.initGame(2)

  const result = await emitJoinSpectator(group.roomId)
  spectatorOpeningId.value = null

  if (!result.ok || !result.roomId) {
    setActionError(result.error ?? 'No se pudo abrir la partida como espectador')
    return
  }

  roomStore.setSpectating(true)
  roomStore.setConnection(true)
  if (result.roomState) roomStore.setRoomState(result.roomState)
  spectatingGroupId.value = group.id
  spectatingRoomId.value = result.roomId
}

async function closeSpectate() {
  if (!spectatingGroupId.value) return
  spectatingGroupId.value = null
  spectatingRoomId.value = null
  await emitLeaveSpectator()
  if (roomStore.isSpectator) {
    roomStore.reset()
    gameStore.initGame(2)
  }
}

watch(
  () => gameStore.isGameOver,
  over => {
    if (over && spectatingGroupId.value) void closeSpectate()
  },
)

function goHome() {
  const tournamentId = store.tournamentId
  store.clearSession()
  store.reset()
  if (tournamentId) void emitLeaveTournament(tournamentId)
  void router.push('/')
}

onMounted(async () => {
  connectSocket()

  const hasSession = store.hasSessionFor(roomId) || store.restoreSession(roomId)
  if (hasSession && store.reconnectToken) {
    const result = await emitReconnectTournament(roomId, store.reconnectToken)
    if (result.ok && result.tournamentId && result.participantId && result.reconnectToken) {
      store.setFromAck(result.tournamentId, result.participantId, result.reconnectToken, result.state)
      loading.value = false
      if (result.assignment) {
        const applied = await applyTournamentAssignment(result.assignment)
        if (!applied) setActionError(store.error ?? 'No se pudo entrar a la partida del torneo')
      }
      return
    }
    if (!result.error) {
      loading.value = false
      return
    }
    store.clearSession()
  }

  if (!userStore.username) {
    void router.replace({ name: 'home', query: { next: route.fullPath } })
    return
  }

  const result = await emitJoinTournament(roomId, userStore.username)
  if (!result.ok || !result.tournamentId || !result.participantId || !result.reconnectToken) {
    fatalError.value = result.error ?? 'No se pudo unir al torneo'
    loading.value = false
    return
  }
  store.setFromAck(result.tournamentId, result.participantId, result.reconnectToken, result.state)
  loading.value = false
})

watch(
  () => store.error,
  message => {
    if (message) actionError.value = message
  },
)

onUnmounted(() => {
  const wasSpectating = Boolean(spectatingGroupId.value)
  if (wasSpectating) void emitLeaveSpectator()
  const nextRoute = router.currentRoute.value
  if (nextRoute.name === 'room' || nextRoute.name === 'tournament') return
  if (wasSpectating) {
    roomStore.reset()
    gameStore.initGame(2)
  }
  const tournamentId = store.tournamentId
  if (tournamentId) void emitLeaveTournament(tournamentId)
  store.clearSession()
  store.reset()
})
</script>

<style scoped>
.tournament {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 28px max(16px, env(safe-area-inset-right, 0px)) 56px max(16px, env(safe-area-inset-left, 0px));
}

.tournament__header {
  display: flex;
  width: min(100%, 900px);
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.tournament__identity { display: flex; flex-direction: column; gap: 3px; }
.tournament__eyebrow {
  color: var(--accent-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.tournament__identity h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(32px, 6vw, 56px);
  letter-spacing: -0.035em;
  overflow-wrap: anywhere;
}
.tournament__code { color: var(--text-muted); font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.08em; }

.tournament__header-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.tournament__status {
  flex: 0 0 auto;
  padding: 7px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.7px;
}
.tournament__status--waiting { border-color: var(--accent-primary); color: var(--accent-primary); }
.tournament__status--playing { border-color: var(--accent-secondary); color: var(--accent-secondary); }
.tournament__status--finished { border-color: var(--accent-danger); color: var(--accent-danger); }

.tournament__leave {
  min-height: 38px;
  padding: 6px 16px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}
.tournament__leave:hover { background: var(--control-hover); color: var(--text-primary); }

.tournament__lobby,
.tournament__stage,
.tournament__finished {
  display: flex;
  width: min(100%, 900px);
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: clamp(18px, 3vw, 28px);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-l);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  animation: st-pop-in 0.45s var(--ease-out) both;
}

.tournament__summary {
  display: grid;
  width: min(100%, 560px);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.tournament__summary > div {
  display: flex;
  min-height: 72px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 8px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-m);
  background: var(--surface-muted);
}
.tournament__summary strong { color: var(--text-primary); font-family: var(--font-display); font-size: 30px; font-variant-numeric: tabular-nums; }
.tournament__summary span { color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; }

.tournament__hint {
  max-width: 62ch;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.45;
  text-align: center;
}

.tournament__settings {
  display: flex;
  width: min(100%, 620px);
  flex-direction: column;
  gap: 10px;
  padding: 13px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-m);
  background: var(--control-bg);
}

.tournament__format-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.tournament__format-option {
  display: flex;
  min-height: 74px;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 11px;
  background: var(--cell-bg);
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
}

.tournament__format-option strong { color: var(--text-primary); font-family: var(--font-display); font-size: 15px; }
.tournament__format-option small { color: var(--text-muted); font-size: 12px; line-height: 1.3; }
.tournament__format-option:hover:not(:disabled) { background: var(--control-hover); }
.tournament__format-option--active {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 1px var(--accent-primary), 0 0 18px color-mix(in srgb, var(--accent-primary) 16%, transparent);
}
.tournament__format-option:disabled { cursor: not-allowed; opacity: 0.55; }

.tournament__format-summary {
  padding: 9px 11px;
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.tournament__rounds {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.tournament__rounds select {
  min-width: 70px;
  padding: 7px 9px;
  border: 1px solid var(--cell-border);
  border-radius: 8px;
  background: var(--cell-bg);
  color: var(--text-primary);
  font-weight: 800;
}

.tournament__settings-note { text-align: left; }

.tournament__invite {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
.tournament__invite code {
  display: flex;
  gap: 5px;
}

.tournament__invite code span {
  display: grid;
  place-items: center;
  width: 40px;
  height: 50px;
  border-radius: var(--radius-s);
  background: var(--cell-bg);
  box-shadow: inset 0 2px 5px var(--groove), 0 1px 0 var(--groove-light);
  color: var(--accent-primary);
  font-size: 24px;
  font-weight: 700;
}
.tournament__invite button,
.tournament__secondary {
  min-height: 42px;
  padding: 8px 18px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--control-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}
.tournament__invite button:hover,
.tournament__secondary:hover { background: var(--control-hover); }

.tournament__participants {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.tournament__participant {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--control-bg);
  color: var(--text-secondary);
  font-size: 12px;
}
.tournament__participant--offline { opacity: 0.5; }
.tournament__participant-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-faint);
}
.tournament__participant-dot.is-online { background: var(--accent-primary); box-shadow: 0 0 6px var(--accent-primary); }
.tournament__participant-name { color: var(--text-primary); font-weight: 700; }
.tournament__host-badge,
.tournament__you {
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}
.tournament__host-badge { background: var(--accent-secondary); color: var(--text-on-accent); }
.tournament__you { background: var(--control-hover); color: var(--text-secondary); }

.tournament__primary {
  min-width: min(280px, 100%);
  min-height: 50px;
  font-size: 16px;
}
.tournament__primary:disabled,
.tournament__secondary:disabled { cursor: not-allowed; opacity: 0.45; }
.tournament__host-actions { display: flex; flex-direction: column; align-items: center; gap: 6px; }

.tournament__note { color: var(--text-muted); font-size: 13px; line-height: 1.45; text-align: center; }

.tournament__stage { align-items: stretch; }
.tournament__stage-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.tournament__stage-heading h2 { margin: 3px 0 0; color: var(--text-primary); font-size: 30px; }
.tournament__advance-count { color: var(--text-muted); font-size: 11px; font-weight: 700; white-space: nowrap; }

.tournament__groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.tournament__group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-m);
  background: var(--cell-bg);
}
.tournament__group--finished { border-color: color-mix(in srgb, var(--accent-primary) 40%, var(--line-soft)); }
.tournament__group--draw { border-color: color-mix(in srgb, var(--accent-secondary) 48%, var(--line-soft)); }
.tournament__group-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tournament__group-header strong { color: var(--text-primary); font-family: var(--font-display); font-size: 17px; }
.tournament__group-tools { display: flex; align-items: center; gap: 7px; }
.tournament__group-status { color: var(--text-muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; }
.tournament__group-status--finished { color: var(--accent-primary); }
.tournament__group-status--draw { color: var(--accent-secondary); }

.tournament__max-time {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.tournament__spectator-count svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}

.tournament__spectator-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 800;
}

.tournament__watch {
  align-self: flex-start;
  min-height: 36px;
  padding: 6px 14px;
  border: 1px solid var(--accent-primary);
  border-radius: 999px;
  background: transparent;
  color: var(--accent-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.tournament__watch:hover { background: var(--control-hover); }
.tournament__watch:disabled { opacity: 0.45; cursor: not-allowed; }
.tournament__group-players { display: flex; flex-direction: column; gap: 6px; }
.tournament__group-player {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 7px;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}
.tournament__group-player--winner { background: color-mix(in srgb, var(--accent-primary) 12%, transparent); color: var(--text-primary); }
.tournament__group-player--out { opacity: 0.5; text-decoration: line-through; }
.tournament__winner-badge,
.tournament__out-badge { margin-left: auto; font-size: 11px; font-weight: 800; text-transform: uppercase; }
.tournament__winner-badge { color: var(--accent-primary); }
.tournament__out-badge { color: var(--text-faint); }

.tournament__advance {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  margin-top: 4px;
}

.tournament__ready-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 11px;
  padding: 16px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.tournament__ready-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.tournament__ready-copy strong {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 22px;
}

.tournament__ready-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 7px;
}

.tournament__ready-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 11px;
}

.tournament__ready-chip small {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.tournament__ready-chip--done {
  border-color: color-mix(in srgb, var(--accent-primary) 50%, var(--line-soft));
  color: var(--text-primary);
}

.tournament__ready-chip--done small { color: var(--accent-primary); }

.tournament__ready-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-faint);
}

.tournament__ready-chip--done .tournament__ready-dot {
  background: var(--accent-primary);
  box-shadow: 0 0 6px var(--accent-primary);
}

.tournament__ready-auto-note { max-width: 520px; }

.tournament__finished { position: relative; overflow: hidden; align-items: center; text-align: center; }
.tournament__trophy {
  --piece-color: var(--win-gold);
  position: relative;
  display: grid;
  place-items: center;
  width: 120px;
  height: 120px;
  margin-bottom: 6px;
}
.tournament__trophy i { position: absolute; animation: trophy-drop 0.7s var(--ease-snap) both; }
.tournament__trophy i:nth-child(1) { width: 120px; height: 120px; animation-delay: 0.1s; }
.tournament__trophy i:nth-child(2) { width: 74px; height: 74px; animation-delay: 0.25s; }
.tournament__trophy i:nth-child(3) { width: 32px; height: 32px; animation-delay: 0.4s; }
@keyframes trophy-drop {
  0% { opacity: 0; transform: translateY(-50px) scale(1.3); }
  100% { opacity: 1; transform: none; }
}
.tournament__finished h2 { margin: 0; color: var(--text-primary); font-size: clamp(40px, 8vw, 72px); letter-spacing: -0.04em; }
.tournament__finished p { color: var(--text-secondary); font-size: 16px; }

.tournament__standings {
  display: flex;
  width: min(100%, 900px);
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.tournament__standings-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.tournament__standings-heading h3 { margin: 3px 0 0; color: var(--text-primary); font-size: 22px; }
.tournament__standings-heading .tournament__note { white-space: nowrap; }

.tournament__standings-table {
  overflow-y: auto;
  max-height: 320px;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
}

.tournament__standing-row {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 40px 36px 36px 48px;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-top: 1px solid var(--line-soft);
  color: var(--text-secondary);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.tournament__standing-row:first-child { border-top: 0; }
.tournament__standing-row--header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface-raised);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.tournament__standing-row--leader { background: color-mix(in srgb, var(--win-gold) 12%, transparent); }
.tournament__standing-row--leader strong { color: var(--win-gold); }
.tournament__standing-row--me { color: var(--text-primary); font-weight: 800; }
.tournament__standing-name { display: flex; min-width: 0; flex-direction: column; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tournament__standing-name small { color: var(--text-faint); font-size: 11px; font-weight: 500; }
.tournament__standing-row strong { color: var(--text-primary); font-family: var(--font-display); font-size: 16px; text-align: right; }
.tournament__tiebreak-note { color: var(--accent-secondary); font-weight: 700; }

.tournament__action-error {
  width: min(100%, 900px);
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--accent-danger);
  border-radius: 10px;
  background: var(--surface-raised);
  color: var(--accent-danger);
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

.tournament__message {
  display: flex;
  width: min(100%, 520px);
  min-height: 180px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-l);
  background: var(--surface);
  color: var(--text-secondary);
  text-align: center;
}
.tournament__message strong { color: var(--text-primary); }
.tournament__message--error { border-color: var(--accent-danger); }
.tournament__back {
  margin-top: 8px;
  min-height: 44px;
  padding: 9px 20px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--control-bg);
  color: var(--text-primary);
  cursor: pointer;
}

.tournament__loader {
  width: 18px;
  height: 18px;
  border: 2px solid var(--line-soft);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: tournament-spin 0.8s linear infinite;
}
@keyframes tournament-spin { to { transform: rotate(360deg); } }

@media (max-width: 560px) {
  .tournament { padding: 16px 12px 36px; }
  .tournament__header { flex-direction: column; gap: 8px; }
  .tournament__lobby,
  .tournament__stage { padding: 16px 12px; }
  .tournament__summary { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
  .tournament__summary > div { min-height: 62px; padding: 5px; }
  .tournament__summary strong { font-size: 18px; }
  .tournament__summary span { font-size: 11px; }
  .tournament__stage-heading { align-items: flex-start; flex-direction: column; gap: 4px; }
  .tournament__groups { grid-template-columns: 1fr; }
  .tournament__format-grid { grid-template-columns: 1fr; }
  .tournament__standings { padding: 12px; }
  .tournament__standings-heading { flex-wrap: wrap; align-items: flex-start; }
  .tournament__standing-row {
    grid-template-columns: 22px minmax(0, 1fr) 30px 26px 26px 38px;
    gap: 5px;
    padding: 6px 7px;
  }
}
</style>
