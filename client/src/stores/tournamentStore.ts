import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  TournamentGroupSnapshot,
  TournamentParticipantSnapshot,
  TournamentSnapshot,
} from '@/types/tournament'

const SESSION_KEY = 'st_tournament_session'

interface SavedTournamentSession {
  tournamentId: string
  participantId: string
  reconnectToken: string
}

export const useTournamentStore = defineStore('tournament', () => {
  const tournamentId = ref<string | null>(null)
  const name = ref('')
  const hostId = ref<string | null>(null)
  const phase = ref<'waiting' | 'playing' | 'finished'>('waiting')
  const stage = ref(0)
  const participants = ref<TournamentParticipantSnapshot[]>([])
  const groups = ref<TournamentGroupSnapshot[]>([])
  const championId = ref<string | null>(null)
  const connectedCount = ref(0)
  const maxParticipants = ref(50)
  const canAdvance = ref(false)
  const myParticipantId = ref<string | null>(null)
  const reconnectToken = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  function setFromAck(
    id: string,
    participantId: string,
    token: string,
    snapshot?: TournamentSnapshot,
  ) {
    tournamentId.value = id
    myParticipantId.value = participantId
    reconnectToken.value = token
    saveSession()
    if (snapshot) setState(snapshot)
  }

  function setState(snapshot: TournamentSnapshot) {
    tournamentId.value = snapshot.tournamentId
    name.value = snapshot.name
    hostId.value = snapshot.hostId
    phase.value = snapshot.phase
    stage.value = snapshot.stage
    participants.value = snapshot.participants
    groups.value = snapshot.groups
    championId.value = snapshot.championId
    connectedCount.value = snapshot.connectedCount
    maxParticipants.value = snapshot.maxParticipants
    canAdvance.value = snapshot.canAdvance
    error.value = null
  }

  function saveSession() {
    if (!tournamentId.value || !myParticipantId.value || !reconnectToken.value) return
    try {
      const session: SavedTournamentSession = {
        tournamentId: tournamentId.value,
        participantId: myParticipantId.value,
        reconnectToken: reconnectToken.value,
      }
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {
      // Keep the in-memory session if local storage is unavailable.
    }
  }

  function restoreSession(targetTournamentId: string): boolean {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY)
      if (!raw) return false
      const session = JSON.parse(raw) as Partial<SavedTournamentSession>
      if (session.tournamentId?.toUpperCase() !== targetTournamentId.toUpperCase() ||
          typeof session.participantId !== 'string' ||
          typeof session.reconnectToken !== 'string') return false

      tournamentId.value = session.tournamentId
      myParticipantId.value = session.participantId
      reconnectToken.value = session.reconnectToken
      return true
    } catch {
      return false
    }
  }

  function hasSessionFor(targetTournamentId: string): boolean {
    return tournamentId.value?.toUpperCase() === targetTournamentId.toUpperCase() &&
      Boolean(myParticipantId.value) &&
      Boolean(reconnectToken.value)
  }

  function clearSession() {
    reconnectToken.value = null
    try {
      window.localStorage.removeItem(SESSION_KEY)
    } catch {
      // Ignore storage restrictions.
    }
  }

  function setError(message: string | null) {
    error.value = message
  }

  function reset() {
    tournamentId.value = null
    name.value = ''
    hostId.value = null
    phase.value = 'waiting'
    stage.value = 0
    participants.value = []
    groups.value = []
    championId.value = null
    connectedCount.value = 0
    maxParticipants.value = 50
    canAdvance.value = false
    myParticipantId.value = null
    reconnectToken.value = null
    loading.value = false
    error.value = null
  }

  return {
    tournamentId,
    name,
    hostId,
    phase,
    stage,
    participants,
    groups,
    championId,
    connectedCount,
    maxParticipants,
    canAdvance,
    myParticipantId,
    reconnectToken,
    loading,
    error,
    setFromAck,
    setState,
    saveSession,
    restoreSession,
    hasSessionFor,
    clearSession,
    setError,
    reset,
  }
})
