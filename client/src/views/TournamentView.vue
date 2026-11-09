<template>
  <div class="tournament">
    <ConnectionBanner />

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

          <p class="tournament__note tournament__settings-note">
            {{ formatDescription }}
          </p>
        </div>

        <div class="tournament__invite">
          <code>{{ roomId }}</code>
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
            class="tournament__primary"
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
            </header>

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

        <div v-if="store.canAdvance" class="tournament__advance">
          <button
            type="button"
            class="tournament__primary"
            :disabled="advancing"
            @click="nextStage"
          >
            {{ advancing ? 'Preparando ronda…' : advanceLabel }}
          </button>
          <p class="tournament__note">{{ advanceNote }}</p>
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
        <span class="tournament__trophy" aria-hidden="true">★</span>
        <span class="tournament__eyebrow">Torneo finalizado</span>
        <h2>{{ championName }}</h2>
        <p>es el campeón de {{ store.name }}.</p>
        <button type="button" class="tournament__primary" @click="goHome">Volver al inicio</button>
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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournamentStore'
import { useUserStore } from '@/stores/userStore'
import { useSocket } from '@/composables/useSocket'
import { connectSocket } from '@/services/socket'
import type { TournamentFormat, TournamentGroupSnapshot } from '@/types/tournament'
import ConnectionBanner from '@/components/ConnectionBanner.vue'

const route = useRoute()
const router = useRouter()
const store = useTournamentStore()
const userStore = useUserStore()
const {
  emitJoinTournament,
  emitReconnectTournament,
  emitLeaveTournament,
  emitTournamentSettings,
  emitStartTournament,
  emitNextTournamentStage,
  emitRetryTournamentGroup,
  applyTournamentAssignment,
} = useSocket()

const roomId = String(route.params.id).toUpperCase()
const loading = ref(true)
const fatalError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const copied = ref(false)
const starting = ref(false)
const advancing = ref(false)
const savingSettings = ref(false)
const retryingGroupId = ref<string | null>(null)

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
    ? `Todos contra todos · ${store.leagueRounds} ronda${store.leagueRounds === 1 ? '' : 's'}`
    : 'Eliminación directa'
)

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

const advanceLabel = computed(() => {
  if (store.needsTiebreak) return 'Iniciar muerte súbita'
  if (store.stageKind === 'league') return 'Siguiente ronda'
  if (store.stageKind === 'sudden-death') return 'Siguiente ronda de muerte súbita'
  return 'Iniciar siguiente ronda'
})

const advanceNote = computed(() => {
  if (store.needsTiebreak) {
    return 'Hay empate en el liderato: los jugadores empatados jugarán a muerte súbita.'
  }
  if (store.stageKind === 'league') {
    return 'Los grupos se mezclan para que puedas enfrentarte a rivales distintos.'
  }
  if (store.stageKind === 'sudden-death') {
    return 'Solo los ganadores continúan en la muerte súbita.'
  }
  return 'Los ganadores de cada grupo pasarán a la siguiente ronda.'
})

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

async function saveSettings(format: TournamentFormat, leagueRounds: number): Promise<boolean> {
  if (!isHost.value || savingSettings.value || store.phase !== 'waiting') return false
  savingSettings.value = true
  setActionError(null)
  try {
    const result = await emitTournamentSettings(
      store.tournamentId ?? roomId,
      format,
      leagueRounds,
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
  await saveSettings(format, store.leagueRounds)
}

async function changeLeagueRounds(event: Event) {
  const select = event.target as HTMLSelectElement
  const rounds = Number(select.value)
  const saved = await saveSettings(store.format, rounds)
  if (!saved) select.value = String(store.leagueRounds)
}

async function startTournament() {
  if (!canStart.value || starting.value || savingSettings.value) return
  starting.value = true
  setActionError(null)
  const result = await emitStartTournament(store.tournamentId ?? roomId)
  starting.value = false
  if (!result.ok) setActionError(result.error ?? 'No se pudo iniciar el torneo')
}

async function nextStage() {
  if (advancing.value) return
  advancing.value = true
  setActionError(null)
  const result = await emitNextTournamentStage(store.tournamentId ?? roomId)
  advancing.value = false
  if (!result.ok) setActionError(result.error ?? 'No se pudo iniciar la siguiente ronda')
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

async function goHome() {
  const tournamentId = store.tournamentId
  store.clearSession()
  store.reset()
  if (tournamentId) await emitLeaveTournament(tournamentId)
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

onUnmounted(() => {
  const nextRoute = router.currentRoute.value
  if (nextRoute.name === 'room' || nextRoute.name === 'tournament') return
  if (store.tournamentId) void emitLeaveTournament(store.tournamentId)
})
</script>

<style scoped>
.tournament {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 24px 16px 48px;
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
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.2px;
  text-transform: uppercase;
}
.tournament__identity h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(24px, 5vw, 38px);
  line-height: 1.05;
}
.tournament__code { color: var(--accent-secondary); font-size: 12px; font-weight: 800; letter-spacing: 1px; }

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
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.7px;
}
.tournament__status--waiting { border-color: var(--accent-primary); color: var(--accent-primary); }
.tournament__status--playing { border-color: var(--accent-secondary); color: var(--accent-secondary); }
.tournament__status--finished { border-color: var(--accent-danger); color: var(--accent-danger); }

.tournament__leave {
  min-height: 32px;
  padding: 5px 10px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10px;
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
  padding: 22px;
  border: 1px solid var(--line-soft);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
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
  border-radius: 12px;
  background: var(--control-bg);
}
.tournament__summary strong { color: var(--text-primary); font-size: 22px; }
.tournament__summary span { color: var(--text-muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; }

.tournament__hint {
  max-width: 580px;
  color: var(--text-secondary);
  font-size: 13px;
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
  border-radius: 14px;
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

.tournament__format-option strong { color: var(--text-primary); font-size: 12px; }
.tournament__format-option small { color: var(--text-muted); font-size: 10px; line-height: 1.3; }
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
  padding: 8px 14px;
  border: 1px solid var(--cell-border);
  border-radius: 10px;
  background: var(--cell-bg);
  color: var(--accent-primary);
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 3px;
}
.tournament__invite button,
.tournament__secondary {
  min-height: 40px;
  padding: 8px 14px;
  border: 1px solid var(--cell-border);
  border-radius: 10px;
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
  font-size: 9px;
  font-weight: 900;
  text-transform: uppercase;
}
.tournament__host-badge { background: var(--accent-secondary); color: var(--text-on-accent); }
.tournament__you { background: var(--control-hover); color: var(--text-secondary); }

.tournament__primary {
  min-height: 46px;
  padding: 10px 24px;
  border: 0;
  border-radius: 999px;
  background: var(--gradient-brand);
  color: var(--text-on-accent);
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}
.tournament__primary:disabled,
.tournament__secondary:disabled { cursor: not-allowed; opacity: 0.45; }
.tournament__host-actions { display: flex; flex-direction: column; align-items: center; gap: 6px; }

.tournament__note { color: var(--text-muted); font-size: 11px; text-align: center; }

.tournament__stage { align-items: stretch; }
.tournament__stage-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.tournament__stage-heading h2 { margin: 3px 0 0; color: var(--text-primary); font-size: 22px; }
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
  padding: 13px;
  border: 1px solid var(--line-soft);
  border-radius: 14px;
  background: var(--cell-bg);
}
.tournament__group--finished { border-color: color-mix(in srgb, var(--accent-primary) 40%, var(--line-soft)); }
.tournament__group--draw { border-color: color-mix(in srgb, var(--accent-secondary) 48%, var(--line-soft)); }
.tournament__group-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tournament__group-header strong { color: var(--text-primary); font-size: 13px; }
.tournament__group-status { color: var(--text-muted); font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4px; }
.tournament__group-status--finished { color: var(--accent-primary); }
.tournament__group-status--draw { color: var(--accent-secondary); }
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
.tournament__out-badge { margin-left: auto; font-size: 8px; font-weight: 900; text-transform: uppercase; }
.tournament__winner-badge { color: var(--accent-primary); }
.tournament__out-badge { color: var(--text-faint); }

.tournament__advance { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 4px; }

.tournament__finished { align-items: center; text-align: center; }
.tournament__trophy {
  display: grid;
  place-items: center;
  width: 78px;
  height: 78px;
  border: 2px solid var(--accent-secondary);
  border-radius: 50%;
  color: var(--accent-secondary);
  font-size: 34px;
  box-shadow: 0 0 28px color-mix(in srgb, var(--accent-secondary) 26%, transparent);
}
.tournament__finished h2 { margin: 0; color: var(--text-primary); font-size: clamp(26px, 6vw, 42px); }
.tournament__finished p { color: var(--text-secondary); font-size: 14px; }

.tournament__standings {
  display: flex;
  width: min(100%, 900px);
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  background: var(--surface);
}

.tournament__standings-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.tournament__standings-heading h3 { margin: 3px 0 0; color: var(--text-primary); font-size: 17px; }
.tournament__standings-heading .tournament__note { white-space: nowrap; }

.tournament__standings-table {
  overflow-y: auto;
  max-height: 320px;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
}

.tournament__standing-row {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 38px 34px 34px 46px;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-top: 1px solid var(--line-soft);
  color: var(--text-secondary);
  font-size: 12px;
}
.tournament__standing-row:first-child { border-top: 0; }
.tournament__standing-row--header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface-raised);
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.tournament__standing-row--leader { background: color-mix(in srgb, var(--accent-primary) 10%, transparent); }
.tournament__standing-row--me { color: var(--text-primary); font-weight: 800; }
.tournament__standing-name { display: flex; min-width: 0; flex-direction: column; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tournament__standing-name small { color: var(--text-faint); font-size: 8px; font-weight: 500; }
.tournament__standing-row strong { color: var(--accent-primary); text-align: right; }
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
  border-radius: 18px;
  background: var(--surface);
  color: var(--text-secondary);
  text-align: center;
}
.tournament__message strong { color: var(--text-primary); }
.tournament__message--error { border-color: var(--accent-danger); }
.tournament__back {
  margin-top: 8px;
  padding: 9px 16px;
  border: 1px solid var(--cell-border);
  border-radius: 9px;
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
  .tournament__summary span { font-size: 8px; }
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
