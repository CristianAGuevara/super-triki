import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { getSocket, waitForSocketConnection } from '@/services/socket'
import { useRoomStore } from '@/stores/roomStore'
import { useGameStore } from '@/stores/gameStore'
import { useLobbyStore } from '@/stores/lobbyStore'
import { useAudioStore } from '@/stores/audioStore'
import { useUserStore } from '@/stores/userStore'
import { useTournamentStore } from '@/stores/tournamentStore'
import type { GameSettings, PlayerColorId } from '@/types/game'
import type {
  GameControlAck,
  GameMovePayload,
  RoomJoinAck,
  RoomReconnectAck,
  SpectateJoinAck,
  TournamentControlAck,
  TournamentCreateAck,
  TournamentJoinAck,
  TournamentReconnectAck,
  TournamentRoomAssignment,
} from '@/types/socket'

export function useSocket() {
  const socket          = getSocket()
  const router          = useRouter()
  const roomStore       = useRoomStore()
  const gameStore       = useGameStore()
  const lobbyStore      = useLobbyStore()
  const audioStore      = useAudioStore()
  const userStore       = useUserStore()
  const tournamentStore = useTournamentStore()

  async function resyncRoomAfterReconnect() {
    if (!roomStore.roomId) {
      roomStore.setConnection(true)
      return
    }

    if (roomStore.isSpectator) {
      const result = await emitJoinSpectator(roomStore.roomId)
      if (result.ok && result.roomState) {
        roomStore.setRoomState(result.roomState)
        roomStore.setConnection(true)
      } else {
        roomStore.setConnection(false)
        if (result.error) roomStore.setError(result.error)
      }
      return
    }

    if (!userStore.username) return
    const result = roomStore.reconnectToken
      ? await emitReconnectRoom(roomStore.roomId, roomStore.reconnectToken)
      : await emitJoinRoom(roomStore.roomId, userStore.username, roomStore.roomPassword)
    if (!result.ok) {
      roomStore.setConnection(false)
      roomStore.setError(result.error ?? 'No se pudo recuperar la sala')
      return
    }
    if (result.roomState) roomStore.setRoomState(result.roomState)
    if (result.playerSlot && result.roomId) {
      roomStore.setFromAck(result.roomId, result.playerSlot, roomStore.roomPassword, result.reconnectToken)
    }
    roomStore.setConnection(true)
  }

  function resumeSocketWhenVisible() {
    if (!document.hidden && roomStore.roomId && !socket.connected) socket.connect()
  }

  async function applyTournamentAssignment(assignment: TournamentRoomAssignment): Promise<boolean> {
    const result = await emitReconnectRoom(assignment.roomId, assignment.reconnectToken)
    if (!result.ok) {
      tournamentStore.setError(result.error ?? 'No se pudo entrar a la partida del torneo')
      return false
    }

    roomStore.setFromAck(
      assignment.roomId,
      result.playerSlot ?? assignment.playerSlot,
      undefined,
      result.reconnectToken ?? assignment.reconnectToken,
    )
    if (result.roomState) roomStore.setRoomState(result.roomState)
    else roomStore.setRoomState(assignment.roomState)
    gameStore.applyServerState(assignment.gameState)
    roomStore.setPhase('playing')
    roomStore.beginTournamentRoomSwitch()
    try {
      await router.push(`/room/${assignment.roomId}`)
    } finally {
      roomStore.consumeTournamentRoomSwitch()
    }
    return true
  }

  function registerListeners() {
    roomStore.setConnection(socket.connected)
    socket.on('connect', resyncRoomAfterReconnect)
    socket.on('disconnect', () => roomStore.setConnection(false))
    document.addEventListener('visibilitychange', resumeSocketWhenVisible)
    window.addEventListener('online', resumeSocketWhenVisible)

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

    socket.on('game:clock', payload => {
      gameStore.turnStartedAt = payload.turnStartedAt
    })

    socket.on('game:aborted', () => {
      gameStore.initGame(roomStore.players.map(player => player.slot))
      roomStore.setPhase('waiting')
    })

    socket.on('game:over', result => {
      gameStore.applyGameOver(result)
      if (roomStore.phase !== 'waiting') roomStore.setPhase('finished')
    })

    socket.on('player:joined', payload => {
      roomStore.addPlayer({ ...payload, connected: true })
      audioStore.playSfx('join')
    })

    socket.on('player:left', payload => {
      if (!roomStore.isSpectator) roomStore.setOpponentLeft(payload)
      audioStore.playSfx('leave')
    })

    socket.on('tournament:state', state => {
      tournamentStore.setState(state)
    })

    socket.on('tournament:assigned', assignment => {
      void applyTournamentAssignment(assignment)
    })

    socket.on('error', payload => {
      roomStore.setError(payload.message)
    })
  }

  function removeListeners() {
    socket.off('connect', resyncRoomAfterReconnect)
    socket.off('disconnect')
    document.removeEventListener('visibilitychange', resumeSocketWhenVisible)
    window.removeEventListener('online', resumeSocketWhenVisible)
    socket.off('rooms:list')
    socket.off('room:state')
    socket.off('game:state')
    socket.off('game:clock')
    socket.off('game:aborted')
    socket.off('game:over')
    socket.off('player:joined')
    socket.off('player:left')
    socket.off('tournament:state')
    socket.off('tournament:assigned')
    socket.off('error')
  }

  onMounted(registerListeners)
  onUnmounted(removeListeners)

  // ── Typed emit helpers ───────────────────────────────────────

  async function ackRequest<T extends { ok: boolean; error?: string }>(
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

  function emitCreateTournament(username: string, name: string): Promise<TournamentCreateAck> {
    return ackRequest<TournamentCreateAck>(
      'El servidor no respondió al crear el torneo',
      done => socket.emit('tournament:create', { username, name }, done),
    )
  }

  function emitJoinTournament(tournamentId: string, username: string): Promise<TournamentJoinAck> {
    return ackRequest<TournamentJoinAck>(
      'El servidor no respondió al unirse al torneo',
      done => socket.emit('tournament:join', { tournamentId, username }, done),
    )
  }

  function emitReconnectTournament(
    tournamentId: string,
    reconnectToken: string,
  ): Promise<TournamentReconnectAck> {
    return ackRequest<TournamentReconnectAck>(
      'El servidor no respondió al recuperar el torneo',
      done => socket.emit('tournament:reconnect', { tournamentId, reconnectToken }, done),
    )
  }

  function emitLeaveTournament(tournamentId: string): Promise<TournamentControlAck> {
    return ackRequest<TournamentControlAck>(
      'El servidor no respondió al salir del torneo',
      done => socket.emit('tournament:leave', { tournamentId }, done),
    )
  }

  function emitStartTournament(tournamentId: string): Promise<TournamentControlAck> {
    return ackRequest<TournamentControlAck>(
      'El servidor no respondió al iniciar el torneo',
      done => socket.emit('tournament:start', { tournamentId }, done),
    )
  }

  function emitNextTournamentStage(tournamentId: string): Promise<TournamentControlAck> {
    return ackRequest<TournamentControlAck>(
      'El servidor no respondió al iniciar la siguiente ronda',
      done => socket.emit('tournament:next-stage', { tournamentId }, done),
    )
  }

  function emitRetryTournamentGroup(
    tournamentId: string,
    groupId: string,
  ): Promise<TournamentControlAck> {
    return ackRequest<TournamentControlAck>(
      'El servidor no respondió al repetir el grupo',
      done => socket.emit('tournament:retry-group', { tournamentId, groupId }, done),
    )
  }

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

  async function emitSetColor(roomId: string, color: PlayerColorId): Promise<GameControlAck> {
    if (!await waitForSocketConnection()) {
      return { ok: false, error: 'No se pudo conectar con el servidor' }
    }
    return new Promise(resolve => {
      let settled = false
      const timeout = window.setTimeout(() => {
        if (settled) return
        settled = true
        resolve({ ok: false, error: 'El servidor no respondió al cambiar el color' })
      }, 8_000)
      socket.emit('room:set-color', { roomId, color }, result => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        resolve(result)
      })
    })
  }

  function emitRematch(roomId: string): void {
    socket.emit('game:rematch', { roomId }, result => {
      if (!result.ok) roomStore.setError(result.error ?? 'No se pudo iniciar la siguiente partida')
    })
  }

  function emitFinishGame(roomId: string): void {
    socket.emit('game:finish', { roomId }, result => {
      if (!result.ok) roomStore.setError(result.error ?? 'No se pudo finalizar la partida')
    })
  }

  async function emitReconnectRoom(roomId: string, reconnectToken: string): Promise<RoomReconnectAck> {
    if (!await waitForSocketConnection()) {
      return { ok: false, error: 'No se pudo conectar con el servidor' }
    }
    return new Promise(resolve => {
      let settled = false
      const timeout = window.setTimeout(() => {
        if (settled) return
        settled = true
        resolve({ ok: false, error: 'El servidor no respondió al recuperar la sala' })
      }, 8_000)
      socket.emit('room:reconnect', { roomId, reconnectToken }, result => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        resolve(result)
      })
    })
  }

  function emitStart(roomId: string, settings?: GameSettings): void {
    socket.emit('game:start', { roomId, settings }, result => {
      if (!result.ok) roomStore.setError(result.error ?? 'No se pudo iniciar la partida')
    })
  }

  return {
    emitJoinRoom,
    emitReconnectRoom,
    emitJoinSpectator,
    emitMove,
    emitSetColor,
    emitRematch,
    emitStart,
    emitFinishGame,
    emitCreateTournament,
    emitJoinTournament,
    emitReconnectTournament,
    emitLeaveTournament,
    emitStartTournament,
    emitNextTournamentStage,
    emitRetryTournamentGroup,
    applyTournamentAssignment,
  }
}
