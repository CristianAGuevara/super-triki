import { onMounted, onUnmounted } from 'vue'
import { getSocket, waitForSocketConnection } from '@/services/socket'
import { useRoomStore } from '@/stores/roomStore'
import { useGameStore } from '@/stores/gameStore'
import { useLobbyStore } from '@/stores/lobbyStore'
import { useAudioStore } from '@/stores/audioStore'
import type { GameMovePayload, RoomJoinAck, SpectateJoinAck } from '@/types/socket'

export function useSocket() {
  const socket     = getSocket()
  const roomStore  = useRoomStore()
  const gameStore  = useGameStore()
  const lobbyStore = useLobbyStore()
  const audioStore = useAudioStore()

  function registerListeners() {
    socket.on('rooms:list', rooms => {
      lobbyStore.setRooms(rooms)
    })

    socket.on('room:state', snapshot => {
      roomStore.setRoomState(snapshot)
    })

    socket.on('game:state', state => {
      gameStore.applyServerState(state)
      roomStore.setPhase('playing')
    })

    socket.on('game:over', result => {
      gameStore.applyGameOver(result)
      roomStore.setPhase('finished')
    })

    socket.on('player:joined', payload => {
      roomStore.addPlayer({ ...payload, socketId: '' })
      audioStore.playSfx('join')
    })

    socket.on('player:left', payload => {
      if (!roomStore.isSpectator) roomStore.setOpponentLeft(payload)
      audioStore.playSfx('leave')
    })

    socket.on('error', payload => {
      roomStore.setError(payload.message)
    })
  }

  function removeListeners() {
    socket.off('rooms:list')
    socket.off('room:state')
    socket.off('game:state')
    socket.off('game:over')
    socket.off('player:joined')
    socket.off('player:left')
    socket.off('error')
  }

  onMounted(registerListeners)
  onUnmounted(removeListeners)

  // ── Typed emit helpers ───────────────────────────────────────

  async function emitJoinRoom(roomId: string, username: string, password?: string): Promise<RoomJoinAck> {
    if (!await waitForSocketConnection()) {
      return { ok: false, error: 'No se pudo conectar con el servidor' }
    }
    return new Promise(resolve => {
      let settled = false
      const timeout = window.setTimeout(() => {
        if (settled) return
        settled = true
        resolve({ ok: false, error: 'El servidor no respondió' })
      }, 8_000)
      socket.emit('room:join', { roomId, username, password }, result => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        resolve(result)
      })
    })
  }

  async function emitJoinSpectator(roomId: string): Promise<SpectateJoinAck> {
    if (!await waitForSocketConnection()) {
      return { ok: false, error: 'No se pudo conectar con el servidor' }
    }
    return new Promise(resolve => {
      let settled = false
      const timeout = window.setTimeout(() => {
        if (settled) return
        settled = true
        resolve({ ok: false, error: 'El servidor no respondió' })
      }, 8_000)
      socket.emit('spectate:join', { roomId }, result => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        resolve(result)
      })
    })
  }

  function emitMove(payload: GameMovePayload): void {
    socket.emit('game:move', payload, res => {
      if (!res.ok) roomStore.setError(res.error ?? 'Movimiento rechazado')
    })
  }

  function emitRematch(roomId: string): void {
    socket.emit('game:rematch', { roomId })
  }

  function emitStart(roomId: string): void {
    socket.emit('game:start', { roomId })
  }

  return { emitJoinRoom, emitJoinSpectator, emitMove, emitRematch, emitStart }
}
