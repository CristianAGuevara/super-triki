import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { GameSettings } from '@/types/game'
import { DEFAULT_GAME_SETTINGS } from '@/types/game'
import type { PlayerInfo, PlayerSlot, RoomStateSnapshot } from '@/types/socket'

const ROOM_SESSION_KEY = 'st_room_session'

interface SavedRoomSession {
  roomId: string
  playerSlot: PlayerSlot
  reconnectToken: string
}

export const useRoomStore = defineStore('room', () => {
  const roomId       = ref<string | null>(null)
  const name         = ref('')
  const isPrivate    = ref(false)
  const phase        = ref<'idle' | 'waiting' | 'playing' | 'finished'>('idle')
  const mySlot       = ref<PlayerSlot | null>(null)
  const hostSlot     = ref<PlayerSlot>(1)
  const players      = ref<PlayerInfo[]>([])
  const playerCount  = ref(0)
  const scores       = ref<Record<number, number>>({})
  const roundNumber  = ref(0)
  const opponentLeft = ref(false)
  const disconnectedPlayer = ref<{ username: string; slot: PlayerSlot } | null>(null)
  const isSpectator = ref(false)
  const connected = ref(false)
  const roomPassword = ref<string | undefined>(undefined)
  const gameSettings = ref<GameSettings>({ ...DEFAULT_GAME_SETTINGS })
  const reconnectToken = ref<string | null>(null)
  const error        = ref<string | null>(null)

  function setFromAck(ackRoomId: string, slot: PlayerSlot, password?: string, token?: string) {
    if (token !== undefined) reconnectToken.value = token
    else if (roomId.value !== ackRoomId) reconnectToken.value = null
    roomId.value = ackRoomId
    mySlot.value = slot
    isSpectator.value = false
    roomPassword.value = password
    saveSession()
    error.value  = null
  }

  function saveSession() {
    if (!roomId.value || !mySlot.value || !reconnectToken.value) return
    try {
      const session: SavedRoomSession = {
        roomId: roomId.value,
        playerSlot: mySlot.value,
        reconnectToken: reconnectToken.value,
      }
      window.localStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(session))
    } catch {
      // Keep the in-memory session if local storage is unavailable.
    }
  }

  function restoreSession(targetRoomId: string): boolean {
    try {
      const raw = window.localStorage.getItem(ROOM_SESSION_KEY)
      if (!raw) return false
      const session = JSON.parse(raw) as Partial<SavedRoomSession>
      if (session.roomId?.toUpperCase() !== targetRoomId.toUpperCase() ||
          typeof session.reconnectToken !== 'string' ||
          ![1, 2, 3, 4].includes(Number(session.playerSlot))) return false

      roomId.value = session.roomId
      mySlot.value = session.playerSlot as PlayerSlot
      reconnectToken.value = session.reconnectToken
      isSpectator.value = false
      return true
    } catch {
      return false
    }
  }

  function clearSavedSession() {
    reconnectToken.value = null
    try {
      window.localStorage.removeItem(ROOM_SESSION_KEY)
    } catch {
      // Ignore storage restrictions.
    }
  }

  function setSpectating(value: boolean) {
    isSpectator.value = value
    if (value) mySlot.value = null
  }

  function setConnection(value: boolean) {
    connected.value = value
  }

  function setRoomState(snapshot: RoomStateSnapshot) {
    roomId.value      = snapshot.roomId
    name.value        = snapshot.name
    isPrivate.value   = snapshot.isPrivate
    phase.value       = snapshot.phase
    hostSlot.value    = snapshot.hostSlot
    gameSettings.value = { ...DEFAULT_GAME_SETTINGS, ...(snapshot.gameSettings ?? {}) }
    players.value     = snapshot.players
    playerCount.value = snapshot.playerCount
    scores.value      = snapshot.scores
    roundNumber.value = snapshot.roundNumber
    error.value = null
    const missing = snapshot.players.find(player => !player.socketId)
    if ((snapshot.phase === 'playing' || snapshot.phase === 'finished') && missing) {
      disconnectedPlayer.value = { username: missing.username, slot: missing.slot }
      opponentLeft.value = true
    } else {
      opponentLeft.value = false
      disconnectedPlayer.value = null
    }
  }

  function setPhase(p: typeof phase.value) {
    phase.value = p
  }

  function addPlayer(info: PlayerInfo) {
    if (!players.value.find(p => p.slot === info.slot)) {
      players.value.push(info)
    }
  }

  function setOpponentLeft(info: { username: string; slot: PlayerSlot } | null) {
    opponentLeft.value = info !== null
    disconnectedPlayer.value = info
  }

  function setError(msg: string | null) {
    error.value = msg
  }

  function reset() {
    roomId.value       = null
    name.value         = ''
    isPrivate.value    = false
    phase.value        = 'idle'
    mySlot.value       = null
    hostSlot.value     = 1
    players.value      = []
    playerCount.value  = 0
    scores.value       = {}
    roundNumber.value  = 0
    opponentLeft.value = false
    disconnectedPlayer.value = null
    isSpectator.value = false
    connected.value = false
    roomPassword.value = undefined
    gameSettings.value = { ...DEFAULT_GAME_SETTINGS }
    reconnectToken.value = null
    error.value        = null
  }

  return {
    roomId, name, isPrivate, phase, mySlot, hostSlot, players, playerCount,
    scores, roundNumber, opponentLeft, disconnectedPlayer, isSpectator, connected, roomPassword, reconnectToken, gameSettings, error,
    setFromAck, restoreSession, clearSavedSession, setSpectating, setConnection, setRoomState, setPhase, addPlayer, setOpponentLeft, setError, reset,
  }
})
