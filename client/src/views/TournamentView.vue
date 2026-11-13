<template>
  <div class="tournament" :class="`tournament--${store.phase}`">
    <TournamentSpectatorOverlay
      v-if="spectatingGroupId && spectatingRoomId"
      :group-label="spectatingGroupLabel"
      @close="closeSpectate"
    />

    <!-- ── Hero ── -->
    <header class="t-hero">
      <div class="t-hero__main">
        <span class="t-hero__status" :class="`t-hero__status--${store.phase}`">
          <i aria-hidden="true" />
          {{ statusLabel }}
        </span>
        <h1>{{ store.name || 'Torneo' }}</h1>
        <div class="t-hero__meta">
          <span class="t-chip">{{ formatShort }}</span>
          <span class="t-chip">{{ clockLabel(store.playerClockSeconds) }} por jugador</span>
          <span class="t-chip t-chip--mono">#{{ roomId }}</span>
        </div>
      </div>

      <div class="t-hero__side">
        <div v-if="store.phase === 'waiting'" class="t-gauge" :style="{ '--fill': gaugeFill }">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="52" class="t-gauge__track" />
            <circle cx="60" cy="60" r="52" class="t-gauge__value" pathLength="100" />
            <circle cx="60" cy="60" r="52" class="t-gauge__min" pathLength="100" :style="{ strokeDashoffset: String(100 - minMarker) }" />
          </svg>
          <div class="t-gauge__label">
            <strong>{{ store.participants.length }}</strong>
            <span>de {{ store.maxParticipants }}</span>
          </div>
        </div>
        <div v-else-if="store.phase === 'playing'" class="t-round">
          <span class="st-eyebrow">{{ store.stageKind === 'sudden-death' ? 'Muerte súbita' : 'Ronda' }}</span>
          <strong>{{ store.stage }}<small v-if="store.stageKind === 'league'">/{{ store.leagueRounds }}</small></strong>
        </div>
        <button type="button" class="t-leave" @click="goHome">Salir</button>
      </div>
    </header>

    <div v-if="fatalError" class="t-message t-message--error">
      <strong>No se pudo abrir el torneo</strong>
      <span>{{ fatalError }}</span>
      <button class="st-btn st-btn--ghost" @click="goHome">Volver al inicio</button>
    </div>

    <div v-else-if="loading" class="t-message">
      <span class="t-loader" aria-hidden="true"><i /><i /><i /></span>
      Conectando al torneo…
    </div>

    <template v-else>
      <Transition name="t-toast">
        <p v-if="actionError" class="t-error" role="alert">{{ actionError }}</p>
      </Transition>

      <!-- ── Waiting room ── -->
      <section v-if="store.phase === 'waiting'" class="t-lobby tournament__lobby">
        <div class="t-invite">
          <div class="t-invite__copy">
            <span class="st-eyebrow">Código del torneo</span>
            <p>Comparte el código o el enlace. Pueden entrar hasta {{ store.maxParticipants }} jugadores.</p>
          </div>
          <button type="button" class="t-invite__code" :aria-label="`Copiar enlace del torneo ${roomId}`" @click="copyLink">
            <span v-for="(char, index) in roomId.split('')" :key="index">{{ char }}</span>
          </button>
          <button type="button" class="st-btn st-btn--ghost t-invite__btn" :class="{ 'is-done': copied }" @click="copyLink">
            {{ copied ? '¡Enlace copiado!' : 'Copiar enlace' }}
          </button>
        </div>

        <div class="t-lobby__grid">
          <!-- Players -->
          <section class="t-panel">
            <header class="t-panel__head">
              <h2>Jugadores</h2>
              <span class="t-panel__count">
                <i class="t-online" aria-hidden="true" />
                {{ store.connectedCount }} conectados
              </span>
            </header>

            <TransitionGroup name="t-player" tag="ul" class="t-players">
              <li
                v-for="participant in store.participants"
                :key="participant.id"
                class="t-player"
                :class="{
                  't-player--offline': !participant.connected,
                  't-player--me': participant.id === store.myParticipantId,
                }"
                :style="{ '--avatar': avatarColor(participant.id) }"
              >
                <span class="t-avatar" aria-hidden="true">{{ initial(participant.username) }}</span>
                <span class="t-player__name">{{ participant.username }}</span>
                <span v-if="participant.id === store.hostId" class="t-badge t-badge--host">Anfitrión</span>
                <span v-if="participant.id === store.myParticipantId" class="t-badge">Tú</span>
                <span v-if="!participant.connected" class="t-badge t-badge--off">Sin conexión</span>
              </li>
              <li v-for="n in missingPlayers" :key="`missing-${n}`" class="t-player t-player--empty">
                <span class="t-avatar t-avatar--empty" aria-hidden="true" />
                <span class="t-player__name">Esperando jugador…</span>
              </li>
            </TransitionGroup>
          </section>

          <!-- Setup -->
          <section class="t-panel t-panel--setup">
            <header class="t-panel__head">
              <h2>Formato</h2>
              <span v-if="!isHost" class="t-panel__count">Lo elige el anfitrión</span>
            </header>

            <div class="t-formats" role="group" aria-label="Formato del torneo">
              <button
                v-for="option in formatOptions"
                :key="option.id"
                type="button"
                class="t-format"
                :class="{ 't-format--active': store.format === option.id }"
                :disabled="!isHost || savingSettings"
                :aria-pressed="store.format === option.id"
                @click="changeFormat(option.id)"
              >
                <svg v-if="option.id === 'elimination'" class="t-format__art" viewBox="0 0 64 40" aria-hidden="true">
                  <path d="M4 6h12v8H4zM4 26h12v8H4zM16 10h8v20h-8M24 20h10M34 16h12v8H34zM46 20h8" />
                  <circle cx="58" cy="20" r="4" />
                </svg>
                <svg v-else class="t-format__art" viewBox="0 0 64 40" aria-hidden="true">
                  <path d="M6 6h52M6 15h52M6 24h52M6 33h52M22 6v27M38 6v27" />
                  <circle cx="14" cy="10.5" r="2.5" />
                </svg>
                <strong>{{ option.label }}</strong>
                <small>{{ option.description }}</small>
              </button>
            </div>

            <div v-if="store.format === 'league'" class="t-setting">
              <span class="t-setting__label">Rondas de liga</span>
              <div v-if="isHost" class="t-stepper">
                <button type="button" aria-label="Menos rondas" :disabled="savingSettings || store.leagueRounds <= 1" @click="setLeagueRounds(store.leagueRounds - 1)">−</button>
                <strong>{{ store.leagueRounds }}</strong>
                <button type="button" aria-label="Más rondas" :disabled="savingSettings || store.leagueRounds >= 10" @click="setLeagueRounds(store.leagueRounds + 1)">+</button>
              </div>
              <strong v-else class="t-setting__value">{{ store.leagueRounds }}</strong>
            </div>

            <div class="t-setting t-setting--stack">
              <span class="t-setting__label">Reloj por jugador</span>
              <div v-if="isHost" class="t-chips" role="group" aria-label="Tiempo por jugador">
                <button
                  v-for="clock in playerClockOptions"
                  :key="clock.value"
                  type="button"
                  class="t-chip-btn"
                  :class="{ 't-chip-btn--active': store.playerClockSeconds === clock.value }"
                  :aria-pressed="store.playerClockSeconds === clock.value"
                  :disabled="savingSettings"
                  @click="setPlayerClock(clock.value)"
                >
                  {{ clock.label }}
                </button>
              </div>
              <strong v-else class="t-setting__value">{{ clockLabel(store.playerClockSeconds) }}</strong>
              <small>Cada partida dura como máximo este tiempo por el número de jugadores del grupo.</small>
            </div>

            <div class="t-preview">
              <span class="t-setting__label">Así se repartirían los grupos</span>
              <div v-if="groupPreview.length" class="t-preview__groups">
                <span v-for="group in groupPreview" :key="group.label" class="t-preview__group">
                  <b>{{ group.label }}</b>
                  <span class="t-preview__dots">
                    <i v-for="n in group.size" :key="n" />
                  </span>
                </span>
              </div>
              <small v-else>Se necesitan al menos 3 jugadores conectados.</small>
            </div>

            <div class="t-start">
              <template v-if="isHost">
                <button
                  type="button"
                  class="st-btn t-start__btn"
                  :disabled="!canStart || starting || savingSettings"
                  @click="startTournament"
                >
                  {{ starting ? 'Repartiendo grupos…' : 'Iniciar torneo' }}
                  <span aria-hidden="true">→</span>
                </button>
                <small v-if="store.connectedCount < 3">
                  Faltan {{ 3 - store.connectedCount }} jugador{{ 3 - store.connectedCount === 1 ? '' : 'es' }} conectado{{ 3 - store.connectedCount === 1 ? '' : 's' }} para iniciar.
                </small>
              </template>
              <p v-else class="t-start__wait">
                <span class="t-loader t-loader--inline" aria-hidden="true"><i /><i /><i /></span>
                Esperando a que el anfitrión inicie el torneo
              </p>
            </div>
          </section>
        </div>
      </section>

      <!-- ── Running stage ── -->
      <section v-else-if="store.phase === 'playing'" class="t-stage tournament__stage">
        <header class="t-stage__head">
          <div>
            <span class="st-eyebrow">{{ stageEyebrow }}</span>
            <h2>{{ groupHeading }}</h2>
          </div>
          <div class="t-progress" :aria-label="`${finishedGroups} de ${store.groups.length} grupos terminados`">
            <span>{{ finishedGroups }}/{{ store.groups.length }} terminados</span>
            <i><b :style="{ width: `${store.groups.length ? (finishedGroups / store.groups.length) * 100 : 0}%` }" /></i>
          </div>
        </header>

        <div class="t-groups">
          <article
            v-for="group in store.groups"
            :key="group.id"
            class="t-group"
            :class="`t-group--${groupState(group)}`"
          >
            <header class="t-group__head">
              <strong>{{ group.label }}</strong>
              <span class="t-group__status">
                <i aria-hidden="true" />
                {{ groupStatusLabel(group) }}
              </span>
            </header>

            <ul class="t-group__players">
              <li
                v-for="participantId in group.playerIds"
                :key="participantId"
                class="t-group__player"
                :class="{
                  'is-winner': group.winnerId === participantId,
                  'is-out': group.status === 'finished' && group.winnerId !== participantId && store.stageKind !== 'league',
                  'is-me': participantId === store.myParticipantId,
                }"
                :style="{ '--avatar': avatarColor(participantId) }"
              >
                <span class="t-avatar t-avatar--sm" aria-hidden="true">{{ initial(participantById(participantId)?.username) }}</span>
                <span class="t-group__name">{{ participantById(participantId)?.username || 'Jugador' }}</span>
                <span v-if="group.winnerId === participantId" class="t-badge t-badge--win">Ganador</span>
                <span v-else-if="group.status === 'finished' && store.stageKind !== 'league'" class="t-badge t-badge--off">Eliminado</span>
                <i v-else-if="!participantById(participantId)?.connected" class="t-offline-dot" title="Sin conexión" />
              </li>
            </ul>

            <footer class="t-group__foot">
              <span v-if="group.status === 'playing'" class="t-group__meta" :title="`Duración máxima: ${group.playerIds.length * store.playerClockSeconds} segundos`">
                Máx. {{ groupMaxTime(group) }}
              </span>
              <span v-if="group.spectatorCount > 0" class="t-group__meta">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
                {{ group.spectatorCount }}
              </span>
              <span v-if="group.replayCount > 0" class="t-group__meta">Repetición {{ group.replayCount }}</span>
              <button
                v-if="canSpectateGroup(group)"
                type="button"
                class="t-group__btn"
                :disabled="spectatingGroupId !== null || spectatorOpeningId !== null"
                @click="openSpectate(group)"
              >
                {{ spectatorOpeningId === group.id ? 'Abriendo…' : 'Ver partida' }}
              </button>
              <button
                v-if="group.status === 'draw' && canRetryGroup(group)"
                type="button"
                class="t-group__btn t-group__btn--alt"
                :disabled="retryingGroupId === group.id"
                @click="retryGroup(group.id)"
              >
                {{ retryingGroupId === group.id ? 'Preparando…' : 'Repetir grupo' }}
              </button>
            </footer>
          </article>
        </div>

        <TournamentLastGame v-if="showLastGame" :result="store.lastCompletedGame!" />

        <div v-if="store.canAdvance" class="t-ready">
          <div class="t-ready__head">
            <span class="st-eyebrow">Avance de ronda</span>
            <h3>{{ readyHeading }}</h3>
            <p>{{ readyProgressText }}</p>
          </div>

          <div class="t-ready__bar" aria-hidden="true">
            <b :style="{ width: `${store.readyRequiredIds.length ? (readyCount / store.readyRequiredIds.length) * 100 : 0}%` }" />
          </div>

          <ul class="t-ready__list">
            <li
              v-for="participantId in store.readyRequiredIds"
              :key="participantId"
              class="t-ready__chip"
              :class="{ 'is-ready': store.readyIds.includes(participantId) }"
              :style="{ '--avatar': avatarColor(participantId) }"
            >
              <span class="t-avatar t-avatar--sm" aria-hidden="true">{{ initial(participantById(participantId)?.username) }}</span>
              {{ participantById(participantId)?.username || 'Jugador' }}
              <small>{{ store.readyIds.includes(participantId) ? 'Listo' : 'Pendiente' }}</small>
            </li>
          </ul>

          <button
            v-if="mustConfirmReady"
            type="button"
            class="st-btn t-ready__btn"
            :class="{ 'is-done': myReady }"
            :disabled="myReady || readying"
            @click="confirmReady"
          >
            {{ myReady ? 'Listo ✓' : readying ? 'Confirmando…' : 'Estoy listo' }}
          </button>
          <p v-else class="t-note">No juegas la siguiente ronda. Esperando a los clasificados…</p>
          <p class="t-note">{{ readyAutoNote }}</p>
        </div>
        <p v-else-if="store.groups.some(group => group.status === 'draw')" class="t-note">
          Hay grupos empatados. Pulsa “Repetir grupo” para desempatar.
        </p>
        <p v-else class="t-note">Esperando a que terminen todos los grupos…</p>
      </section>

      <!-- ── Champion ── -->
      <section v-else class="t-champion">
        <RingBurst :colors="['var(--win-gold)', 'var(--win-gold)', 'var(--accent-secondary)', 'var(--player-2-color)', 'var(--player-color-emerald)']" :count="160" />
        <span class="t-champion__rings" aria-hidden="true">
          <i class="st-ring st-ring--large" />
          <i class="st-ring st-ring--medium" />
          <i class="st-ring st-ring--small" />
        </span>
        <span class="st-eyebrow t-champion__eyebrow">Campeón del torneo</span>
        <h2>{{ championName }}</h2>
        <p>se lleva {{ store.name }}</p>
        <button type="button" class="st-btn" @click="goHome">Volver al inicio</button>
      </section>

      <!-- ── League standings ── -->
      <section v-if="store.format === 'league' && store.phase !== 'waiting'" class="t-standings">
        <header class="t-panel__head">
          <div>
            <span class="st-eyebrow">Clasificación</span>
            <h2>{{ store.stageKind === 'sudden-death' ? 'Muerte súbita' : `Liga · ${store.leagueRounds} rondas` }}</h2>
          </div>
          <span class="t-panel__count">3 pts victoria · 1 pt empate</span>
        </header>

        <div class="t-table" role="table" aria-label="Clasificación de la liga">
          <div class="t-row t-row--head" role="row">
            <span role="columnheader">#</span>
            <span role="columnheader">Jugador</span>
            <span role="columnheader" title="Partidas jugadas">PJ</span>
            <span role="columnheader" title="Ganadas">G</span>
            <span role="columnheader" title="Empatadas">E</span>
            <span role="columnheader">Pts</span>
          </div>
          <TransitionGroup name="t-row">
            <div
              v-for="(participant, index) in standings"
              :key="participant.id"
              class="t-row"
              role="row"
              :class="{ 't-row--me': participant.id === store.myParticipantId }"
              :style="{ '--avatar': avatarColor(participant.id) }"
            >
              <span class="t-rank" :class="participant.leaguePoints > 0 && index < 3 ? `t-rank--${index + 1}` : ''">{{ index + 1 }}</span>
              <span class="t-row__name">
                <span class="t-avatar t-avatar--sm" aria-hidden="true">{{ initial(participant.username) }}</span>
                {{ participant.username }}
                <small v-if="!participant.connected">sin conexión</small>
              </span>
              <span>{{ participant.leagueGames }}</span>
              <span>{{ participant.leagueWins }}</span>
              <span>{{ participant.leagueDraws }}</span>
              <strong>{{ participant.leaguePoints }}</strong>
            </div>
          </TransitionGroup>
        </div>

        <p v-if="store.needsTiebreak" class="t-note t-note--accent">
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
import { useAudioStore } from '@/stores/audioStore'
import { useSocket } from '@/composables/useSocket'
import { connectSocket } from '@/services/socket'
import type { TournamentFormat, TournamentGroupSnapshot } from '@/types/tournament'
import { PLAYER_COLORS } from '@/types/game'
import TournamentSpectatorOverlay from '@/components/TournamentSpectatorOverlay.vue'
import TournamentLastGame from '@/components/TournamentLastGame.vue'
import RingBurst from '@/components/RingBurst.vue'

const route = useRoute()
const router = useRouter()
const store = useTournamentStore()
const roomStore = useRoomStore()
const gameStore = useGameStore()
const userStore = useUserStore()
const audioStore = useAudioStore()
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
  { value: 180, label: '3 min' },
  { value: 300, label: '5 min' },
  { value: 480, label: '8 min' },
  { value: 600, label: '10 min' },
  { value: 900, label: '15 min' },
]

const formatShort = computed(() =>
  store.format === 'league'
    ? `Liga · ${store.leagueRounds} ronda${store.leagueRounds === 1 ? '' : 's'}`
    : 'Eliminación directa'
)

const gaugeFill = computed(() =>
  String(Math.min(100, (store.participants.length / Math.max(1, store.maxParticipants)) * 100))
)
// Tick on the gauge marking the 3 players needed to start.
const minMarker = computed(() => Math.min(100, (3 / Math.max(1, store.maxParticipants)) * 100))
const missingPlayers = computed(() => Math.max(0, 3 - store.participants.length))

function initial(name?: string): string {
  return (name ?? '?').trim().charAt(0).toUpperCase() || '?'
}

function avatarColor(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return `var(${PLAYER_COLORS[hash % PLAYER_COLORS.length].cssVar})`
}

/** Mirrors the server: as many groups of 4 as possible, then 3s; 5 → 3 + 2. */
function distributeGroupSizes(count: number): number[] {
  if (count < 3) return []
  if (count === 5) return [3, 2]
  let fours = Math.floor(count / 4)
  while (fours >= 0 && (count - fours * 4) % 3 !== 0) fours--
  if (fours < 0) return [count]
  return [...Array(fours).fill(4), ...Array((count - fours * 4) / 3).fill(3)]
}

const groupPreview = computed(() =>
  distributeGroupSizes(store.connectedCount).map((size, index) => ({
    label: String.fromCharCode(65 + (index % 26)),
    size,
  }))
)

function groupState(group: TournamentGroupSnapshot): 'playing' | 'finished' | 'draw' {
  if (group.status === 'draw') return 'draw'
  if (group.status === 'finished' && store.stageKind === 'league' && !group.winnerId) return 'draw'
  return group.status
}

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

async function setLeagueRounds(rounds: number) {
  if (rounds < 1 || rounds > 10 || rounds === store.leagueRounds) return
  await saveSettings(store.format, rounds, store.playerClockSeconds)
}

async function setPlayerClock(seconds: number) {
  if (seconds === store.playerClockSeconds) return
  await saveSettings(store.format, store.leagueRounds, seconds)
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
  audioStore.playSfx('click')
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

// Spectators see the win cinematic before returning to the tournament.
watch(
  () => gameStore.isGameOver && !gameStore.cinematicActive,
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  min-height: 100vh;
  padding: clamp(20px, 4vw, 40px) max(16px, env(safe-area-inset-right, 0px)) 64px max(16px, env(safe-area-inset-left, 0px));
}

.tournament > * { width: min(100%, 1080px); }

/* ── Shared atoms ── */
.t-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 4px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.t-chip--mono { font-family: var(--font-mono); letter-spacing: 0.06em; }

.t-avatar {
  --avatar: var(--accent-primary);
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border: 4px solid var(--avatar);
  border-radius: 50%;
  background: color-mix(in srgb, var(--avatar) 14%, var(--surface));
  box-shadow: 0 2px 0 color-mix(in srgb, var(--avatar) 40%, #000), 0 0 14px -4px var(--avatar);
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 800;
}

.t-avatar--sm { width: 28px; height: 28px; border-width: 3px; font-size: 12px; }

.t-avatar--empty {
  border: 2px dashed var(--line-strong);
  background: transparent;
  box-shadow: none;
}

.t-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--control-hover);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.t-badge--host { background: color-mix(in srgb, var(--accent-primary) 22%, transparent); color: var(--text-primary); }
.t-badge--win { background: color-mix(in srgb, var(--win-gold) 24%, transparent); color: var(--win-gold); }
.t-badge--off { background: transparent; color: var(--text-muted); }

.t-online,
.t-offline-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-success);
}

.t-offline-dot { margin-left: auto; background: var(--text-faint); }

.t-note {
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
}

.t-note--accent { color: var(--accent-secondary); font-weight: 700; }

.t-loader { display: inline-flex; gap: 5px; }
.t-loader i {
  width: 9px;
  height: 9px;
  border: 2.5px solid var(--accent-primary);
  border-radius: 50%;
  animation: t-bounce 1s ease-in-out infinite;
}
.t-loader i:nth-child(2) { animation-delay: 0.15s; border-color: var(--accent-secondary); }
.t-loader i:nth-child(3) { animation-delay: 0.3s; border-color: var(--player-2-color); }
.t-loader--inline i { width: 7px; height: 7px; border-width: 2px; }

@keyframes t-bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
}

/* ── Hero ── */
.t-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  animation: st-pop-in 0.5s var(--ease-out) both;
}

.t-hero__main { display: flex; min-width: 0; flex-direction: column; gap: 12px; }

.t-hero__status {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 8px;
  color: var(--accent-primary);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.t-hero__status i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: t-ping 1.6s ease-out infinite;
}

.t-hero__status--playing { color: var(--accent-secondary); }
.t-hero__status--finished { color: var(--win-gold); }
.t-hero__status--finished i { animation: none; }

@keyframes t-ping {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 60%, transparent); }
  100% { box-shadow: 0 0 0 9px transparent; }
}

.t-hero h1 {
  color: var(--text-primary);
  font-size: clamp(40px, 7vw, 76px);
  letter-spacing: -0.045em;
  line-height: 0.95;
  overflow-wrap: anywhere;
}

.t-hero__meta { display: flex; flex-wrap: wrap; gap: 8px; }

.t-hero__side {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.t-gauge {
  --fill: 0;
  position: relative;
  width: 136px;
  height: 136px;
}

.t-gauge svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.t-gauge circle { fill: none; stroke-width: 11; }
.t-gauge__track { stroke: color-mix(in srgb, var(--text-primary) 10%, transparent); }

.t-gauge__value {
  stroke: var(--accent-primary);
  stroke-linecap: round;
  stroke-dasharray: 100;
  stroke-dashoffset: calc(100 - var(--fill));
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent-primary) 60%, transparent));
  transition: stroke-dashoffset 0.8s var(--ease-out);
}

.t-gauge__min {
  stroke: var(--text-primary);
  stroke-width: 15;
  stroke-dasharray: 0.8 100;
  opacity: 0.7;
}

.t-gauge__label {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
}

.t-gauge__label strong {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 40px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.t-gauge__label span { color: var(--text-muted); font-size: 13px; }

.t-round {
  display: grid;
  place-items: center;
  width: 136px;
  height: 136px;
  border-radius: 50%;
  background: var(--cell-bg);
  box-shadow: inset 0 2px 8px var(--groove), 0 0 0 10px color-mix(in srgb, var(--accent-secondary) 22%, transparent);
  text-align: center;
  align-content: center;
}

.t-round strong {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 54px;
  line-height: 1;
}

.t-round small { color: var(--text-muted); font-size: 22px; }

.t-leave {
  min-height: 38px;
  padding: 6px 18px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  transition: background 0.2s, color 0.2s;
}

.t-leave:hover { background: var(--control-hover); color: var(--text-primary); }

/* ── Messages ── */
.t-message {
  display: flex;
  max-width: 520px;
  min-height: 200px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 28px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-l);
  background: var(--surface);
  color: var(--text-secondary);
  text-align: center;
}

.t-message strong { color: var(--text-primary); font-family: var(--font-display); font-size: 22px; }
.t-message--error { border-color: color-mix(in srgb, var(--accent-danger) 50%, transparent); }

.t-error {
  padding: 12px 16px;
  border: 1px solid color-mix(in srgb, var(--accent-danger) 55%, transparent);
  border-radius: var(--radius-s);
  background: color-mix(in srgb, var(--accent-danger) 10%, var(--surface));
  color: var(--accent-danger);
  font-size: 14px;
  font-weight: 700;
  text-align: center;
}

.t-toast-enter-active, .t-toast-leave-active { transition: opacity 0.2s ease, transform 0.25s var(--ease-spring); }
.t-toast-enter-from, .t-toast-leave-to { opacity: 0; transform: translateY(-8px); }

/* ── Lobby ── */
.t-lobby {
  display: flex;
  flex-direction: column;
  gap: 18px;
  animation: st-pop-in 0.5s 0.05s var(--ease-out) both;
}

.t-invite {
  display: flex;
  align-items: center;
  gap: 18px 24px;
  flex-wrap: wrap;
  padding: 18px 22px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-l);
  background:
    radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--accent-primary) 12%, transparent), transparent 55%),
    var(--surface);
  box-shadow: var(--shadow-card);
}

.t-invite__copy { display: flex; flex: 1 1 220px; flex-direction: column; gap: 4px; }
.t-invite__copy p { color: var(--text-secondary); font-size: 14px; }

.t-invite__code {
  display: flex;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  cursor: copy;
}

.t-invite__code span {
  display: grid;
  place-items: center;
  width: clamp(38px, 6vw, 48px);
  height: clamp(50px, 8vw, 60px);
  border-radius: var(--radius-s);
  background: var(--cell-bg);
  box-shadow: inset 0 2px 5px var(--groove), 0 1px 0 var(--groove-light);
  color: var(--accent-primary);
  font-family: var(--font-mono);
  font-size: clamp(22px, 3.6vw, 28px);
  font-weight: 700;
  transition: transform 0.25s var(--ease-spring);
}

.t-invite__code:hover span { transform: translateY(-2px); }
.t-invite__code:hover span:nth-child(even) { transform: translateY(2px); }

.t-invite__btn.is-done { border-color: var(--accent-success); color: var(--accent-success); }

.t-lobby__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  gap: 18px;
  align-items: start;
}

.t-panel,
.t-standings {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: clamp(18px, 3vw, 24px);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-l);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.t-panel__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.t-panel__head h2 { color: var(--text-primary); font-size: 24px; }

.t-panel__count {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
}

.t-players {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 520px;
  overflow-y: auto;
  list-style: none;
}

.t-player {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 8px 12px 8px 9px;
  border: 1px solid transparent;
  border-radius: var(--radius-m);
  background: var(--surface-muted);
}

.t-player--me { border-color: color-mix(in srgb, var(--avatar) 45%, transparent); }
.t-player--offline { opacity: 0.5; }
.t-player--empty { border: 1.5px dashed var(--line-strong); background: transparent; }

.t-player__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.t-player--empty .t-player__name { color: var(--text-faint); font-weight: 500; }

.t-player-enter-active { transition: opacity 0.3s ease, transform 0.45s var(--ease-spring); }
.t-player-leave-active { transition: opacity 0.2s ease; }
.t-player-enter-from { opacity: 0; transform: translateX(-16px) scale(0.96); }
.t-player-leave-to { opacity: 0; }
.t-player-move { transition: transform 0.35s var(--ease-out); }

/* Format */
.t-formats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.t-format {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 14px;
  border: 1.5px solid var(--line-soft);
  border-radius: var(--radius-m);
  background: var(--surface-muted);
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.25s var(--ease-spring);
}

.t-format:hover:not(:disabled) { transform: translateY(-2px); border-color: var(--line-strong); }
.t-format:disabled { cursor: default; }
.t-format:disabled:not(.t-format--active) { opacity: 0.5; }

.t-format--active {
  border-color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 9%, var(--surface));
  box-shadow: 0 0 30px -12px var(--accent-primary);
}

.t-format__art {
  width: 64px;
  height: 40px;
  margin-bottom: 4px;
  fill: none;
  stroke: var(--text-muted);
  stroke-width: 2;
  stroke-linejoin: round;
}

.t-format__art circle { fill: var(--text-muted); stroke: none; }
.t-format--active .t-format__art { stroke: var(--accent-primary); }
.t-format--active .t-format__art circle { fill: var(--accent-primary); }

.t-format strong { color: var(--text-primary); font-family: var(--font-display); font-size: 16px; }
.t-format small { color: var(--text-muted); font-size: 13px; line-height: 1.4; }

.t-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.t-setting--stack { flex-direction: column; align-items: stretch; gap: 8px; }
.t-setting--stack small { color: var(--text-muted); font-size: 12.5px; line-height: 1.45; }

.t-setting__label {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.t-setting__value { color: var(--text-primary); font-family: var(--font-display); font-size: 17px; }

.t-stepper {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--surface-muted);
}

.t-stepper button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-raised);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 18px;
  font-weight: 700;
}

.t-stepper button:disabled { opacity: 0.35; cursor: not-allowed; }

.t-stepper strong {
  min-width: 32px;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 18px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.t-chips {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--surface-muted);
}

.t-chip-btn {
  min-height: 36px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  transition: background 0.2s ease, color 0.2s ease;
}

.t-chip-btn:hover:not(:disabled) { color: var(--text-primary); }

.t-chip-btn--active {
  background: var(--surface-raised);
  color: var(--text-primary);
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.3);
}

/* Group preview */
.t-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-m);
}

.t-preview small { color: var(--text-muted); font-size: 13px; }

.t-preview__groups { display: flex; flex-wrap: wrap; gap: 6px; }

.t-preview__group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px 5px 6px;
  border-radius: 999px;
  background: var(--cell-bg);
  box-shadow: inset 0 1px 3px var(--groove);
  animation: st-pop-in 0.35s var(--ease-spring) both;
}

.t-preview__group b {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--surface-raised);
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 12px;
}

.t-preview__dots { display: inline-flex; gap: 3px; }
.t-preview__dots i {
  width: 9px;
  height: 9px;
  border: 2.5px solid var(--accent-primary);
  border-radius: 50%;
}

.t-start {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  text-align: center;
}

.t-start__btn { min-height: 56px; font-size: 17px; }
.t-start small { color: var(--text-muted); font-size: 13px; }

.t-start__wait {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 56px;
  padding: 10px 16px;
  border: 1px dashed var(--line-strong);
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 14px;
}

/* ── Running stage ── */
.t-stage {
  display: flex;
  flex-direction: column;
  gap: 18px;
  animation: st-pop-in 0.5s var(--ease-out) both;
}

.t-stage__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.t-stage__head h2 { color: var(--text-primary); font-size: clamp(28px, 4vw, 38px); }

.t-progress {
  display: flex;
  flex: 0 1 260px;
  flex-direction: column;
  gap: 6px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  text-align: right;
}

.t-progress i,
.t-ready__bar {
  display: block;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--cell-bg);
  box-shadow: inset 0 1px 3px var(--groove);
}

.t-progress b,
.t-ready__bar b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--gradient-brand);
  transition: width 0.6s var(--ease-out);
}

.t-groups {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.t-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-l);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.t-group--playing { border-color: color-mix(in srgb, var(--accent-secondary) 40%, var(--line-soft)); }
.t-group--finished { border-color: color-mix(in srgb, var(--win-gold) 40%, var(--line-soft)); }
.t-group--draw { border-style: dashed; }

.t-group__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.t-group__head strong { color: var(--text-primary); font-family: var(--font-display); font-size: 19px; }

.t-group__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.t-group__status i { width: 7px; height: 7px; border-radius: 50%; background: var(--text-faint); }
.t-group--playing .t-group__status { background: color-mix(in srgb, var(--accent-secondary) 16%, transparent); color: var(--text-primary); }
.t-group--playing .t-group__status i { background: var(--accent-secondary); color: var(--accent-secondary); animation: t-ping 1.6s ease-out infinite; }
.t-group--finished .t-group__status { background: color-mix(in srgb, var(--win-gold) 18%, transparent); color: var(--win-gold); }
.t-group--finished .t-group__status i { background: var(--win-gold); }

.t-group__players { display: flex; flex-direction: column; gap: 4px; list-style: none; }

.t-group__player {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: var(--radius-s);
  color: var(--text-secondary);
  font-size: 14px;
}

.t-group__player.is-me { background: var(--surface-muted); color: var(--text-primary); font-weight: 700; }
.t-group__player.is-winner { background: color-mix(in srgb, var(--win-gold) 12%, transparent); color: var(--text-primary); font-weight: 700; }
.t-group__player.is-out { opacity: 0.45; }
.t-group__player.is-out .t-group__name { text-decoration: line-through; }

.t-group__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.t-group__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px dashed var(--line-soft);
}

.t-group__meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
}

.t-group__meta svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; }

.t-group__btn {
  margin-left: auto;
  min-height: 34px;
  padding: 5px 14px;
  border: 0;
  border-radius: 999px;
  background: var(--gradient-primary);
  color: var(--text-on-accent);
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
  transition: transform 0.2s var(--ease-spring);
}

.t-group__btn:hover:not(:disabled) { transform: translateY(-1px); }
.t-group__btn:disabled { opacity: 0.45; cursor: not-allowed; }
.t-group__btn--alt { background: var(--gradient-secondary); }

/* Ready */
.t-ready {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: clamp(20px, 3vw, 28px);
  border: 1px solid color-mix(in srgb, var(--accent-primary) 35%, var(--line-soft));
  border-radius: var(--radius-l);
  background:
    radial-gradient(100% 120% at 50% 0%, color-mix(in srgb, var(--accent-primary) 10%, transparent), transparent 60%),
    var(--surface);
  box-shadow: var(--shadow-card);
  text-align: center;
}

.t-ready__head { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.t-ready__head h3 { color: var(--text-primary); font-size: clamp(24px, 3.4vw, 32px); }
.t-ready__head p { color: var(--text-secondary); font-size: 14px; }
.t-ready__bar { width: min(100%, 420px); }

.t-ready__list { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; list-style: none; }

.t-ready__chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 14px;
  transition: border-color 0.3s ease, background 0.3s ease;
}

.t-ready__chip small {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.t-ready__chip.is-ready {
  border-color: color-mix(in srgb, var(--accent-success) 55%, transparent);
  color: var(--text-primary);
  animation: st-pop-in 0.35s var(--ease-spring);
}

.t-ready__chip.is-ready small { color: var(--accent-success); }

.t-ready__btn { min-width: min(300px, 100%); min-height: 56px; font-size: 17px; }
.t-ready__btn.is-done { background: var(--accent-success); opacity: 1; }

/* ── Champion ── */
.t-champion {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  padding: clamp(32px, 6vw, 60px) 20px;
  border: 1px solid color-mix(in srgb, var(--win-gold) 40%, var(--line-soft));
  border-radius: var(--radius-l);
  background:
    radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--win-gold) 18%, transparent), transparent 60%),
    var(--surface);
  box-shadow: var(--shadow-card);
  text-align: center;
}

.t-champion__rings {
  --piece-color: var(--win-gold);
  position: relative;
  display: grid;
  place-items: center;
  width: 140px;
  height: 140px;
  margin-bottom: 8px;
}

.t-champion__rings i { position: absolute; animation: t-champion-drop 0.75s var(--ease-snap) both; }
.t-champion__rings i:nth-child(1) { width: 140px; height: 140px; animation-delay: 0.15s; }
.t-champion__rings i:nth-child(2) { width: 86px; height: 86px; animation-delay: 0.32s; }
.t-champion__rings i:nth-child(3) { width: 38px; height: 38px; animation-delay: 0.49s; }

@keyframes t-champion-drop {
  0% { opacity: 0; transform: translateY(-60px) scale(1.4); }
  100% { opacity: 1; transform: none; }
}

.t-champion__eyebrow { color: var(--win-gold); }

.t-champion h2 {
  color: var(--text-primary);
  font-size: clamp(48px, 9vw, 92px);
  letter-spacing: -0.045em;
  overflow-wrap: anywhere;
}

.t-champion p { margin-bottom: 10px; color: var(--text-secondary); font-size: 17px; }

/* ── Standings ── */
.t-standings h2 { margin-top: 4px; color: var(--text-primary); font-size: 24px; }

.t-table {
  max-height: 420px;
  overflow: auto;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-m);
}

.t-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 44px 40px 40px 56px;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--line-soft);
  color: var(--text-secondary);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.t-row:first-child { border-top: 0; }

.t-row--head {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface-raised);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.t-row--head span:nth-child(2) { text-align: left; }
.t-row--me { background: var(--surface-muted); color: var(--text-primary); font-weight: 700; }

.t-row__name {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  color: var(--text-primary);
  text-align: left;
  white-space: nowrap;
}

.t-row__name small { color: var(--text-faint); font-size: 12px; font-weight: 500; }

.t-row strong { color: var(--text-primary); font-family: var(--font-display); font-size: 18px; }

.t-rank {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: 0 auto;
  border-radius: 50%;
  color: var(--text-muted);
  font-family: var(--font-display);
  font-weight: 800;
}

.t-rank--1 { border: 3px solid var(--win-gold); color: var(--win-gold); }
.t-rank--2 { border: 3px solid #c3c7d6; color: var(--text-primary); }
.t-rank--3 { border: 3px solid #d08a4e; color: var(--text-primary); }

.t-row-move { transition: transform 0.45s var(--ease-out); }

/* ── Responsive ── */
@media (max-width: 860px) {
  .t-lobby__grid { grid-template-columns: 1fr; }
}

@media (max-width: 620px) {
  .t-hero { flex-direction: column-reverse; align-items: stretch; }
  .t-hero__side { flex-direction: row; justify-content: space-between; }
  .t-gauge, .t-round { width: 104px; height: 104px; }
  .t-gauge__label strong { font-size: 30px; }
  .t-round strong { font-size: 40px; }
  .t-invite { padding: 16px; }
  .t-chips { grid-template-columns: repeat(3, minmax(0, 1fr)); border-radius: var(--radius-m); }
  .t-formats { grid-template-columns: 1fr; }
  .t-progress { flex-basis: 100%; text-align: left; }
  .t-row { grid-template-columns: 30px minmax(0, 1fr) 30px 28px 28px 40px; gap: 4px; padding: 8px 10px; }
  .t-row__name .t-avatar { display: none; }
}
</style>
