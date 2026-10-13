import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlayerInfo, PlayerSlot, RoomStateSnapshot } from '@/types/socket'

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
  const error        = ref<string | null>(null)

  function setFromAck(ackRoomId: string, slot: PlayerSlot, password?: string) {
    roomId.value = ackRoomId
    mySlot.value = slot
    isSpectator.value = false
    roomPassword.value = password
    error.value  = null
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
    players.value     = snapshot.players
    playerCount.value = snapshot.playerCount
    scores.value      = snapshot.scores
    roundNumber.value = snapshot.roundNumber
    error.value = null
    if (snapshot.phase !== 'finished') {
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

  function setOpponentLeft(info: { username: string; slot: PlayerSlot }) {
    opponentLeft.value = true
    disconnectedPlayer.value = info
    phase.value = 'finished'
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
    error.value        = null
  }

  return {
    roomId, name, isPrivate, phase, mySlot, hostSlot, players, playerCount,
    scores, roundNumber, opponentLeft, disconnectedPlayer, isSpectator, connected, roomPassword, error,
    setFromAck, setSpectating, setConnection, setRoomState, setPhase, addPlayer, setOpponentLeft, setError, reset,
  }
})
