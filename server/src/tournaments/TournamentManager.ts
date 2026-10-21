import { randomUUID } from 'node:crypto'
import type { GameSettings, PlayerSlot } from '../types/game.js'
import type {
  TournamentGroup,
  TournamentParticipant,
  TournamentSnapshot,
  TournamentState,
} from '../types/tournament.js'
import type { PublicRoomInfo, TournamentRoomAssignment } from '../types/socket.js'
import { RoomManager } from '../rooms/RoomManager.js'
import { buildInitialGameState, toSnapshot as toGameSnapshot } from '../engine/GameEngine.js'
import { redisPrefix, roomRedis as redis } from '../redis.js'
import { generateRoomCode } from '../rooms/roomUtils.js'
import { distributeGroupSizes, shuffle } from './grouping.js'

const MAX_PARTICIPANTS = 50
const TOURNAMENT_TTL_SECONDS = 6 * 60 * 60
const TOURNAMENT_INDEX_KEY = `${redisPrefix}:tournaments`
const TOURNAMENT_GAME_SETTINGS: GameSettings = {
  turnTimerEnabled: true,
  turnDurationSeconds: 90,
  removePieceOnTimeout: false,
}
const LOCK_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`

const tournaments = new Map<string, TournamentState>()
const socketToTournament = new Map<string, string>()

export function tournamentChannel(tournamentId: string): string {
  return `tournament:${tournamentId}`
}

function tournamentKey(tournamentId: string): string {
  return `${redisPrefix}:tournament:${tournamentId}`
}

async function loadTournament(tournamentId: string): Promise<TournamentState | undefined> {
  if (!redis) return tournaments.get(tournamentId)

  try {
    const tournament = await redis.get<TournamentState>(tournamentKey(tournamentId))
    if (tournament) tournaments.set(tournamentId, tournament)
    else tournaments.delete(tournamentId)
    return tournament ?? undefined
  } catch (error) {
    console.error('[redis:load-tournament]', error)
    return tournaments.get(tournamentId)
  }
}

async function deleteTournament(tournamentId: string): Promise<void> {
  tournaments.delete(tournamentId)
  if (!redis) return
  try {
    await redis.del(tournamentKey(tournamentId))
    await redis.srem(TOURNAMENT_INDEX_KEY, tournamentId)
  } catch (error) {
    console.error('[redis:delete-tournament]', error)
  }
}

async function saveTournament(tournament: TournamentState): Promise<void> {
  tournaments.set(tournament.tournamentId, tournament)
  if (!redis) return

  try {
    await redis.set(tournamentKey(tournament.tournamentId), tournament, {
      ex: TOURNAMENT_TTL_SECONDS,
    })
    await redis.sadd(TOURNAMENT_INDEX_KEY, tournament.tournamentId)
    await redis.expire(TOURNAMENT_INDEX_KEY, TOURNAMENT_TTL_SECONDS * 2)
  } catch (error) {
    console.error('[redis:save-tournament]', error)
  }
}

async function withTournamentLock<T>(
  tournamentId: string,
  callback: () => Promise<T> | T,
): Promise<T> {
  if (!redis) return callback()

  const lockKey = `${redisPrefix}:lock:tournament:${tournamentId}`
  const owner = randomUUID()
  const deadline = Date.now() + 8_000
  let acquired = false

  try {
    while (!acquired && Date.now() < deadline) {
      acquired = (await redis.set(lockKey, owner, { nx: true, ex: 45 })) === 'OK'
      if (!acquired) await new Promise(resolve => setTimeout(resolve, 40))
    }
  } catch (error) {
    console.error('[redis:tournament-lock]', error)
    return callback()
  }

  if (!acquired) {
    console.error(`[redis:tournament-lock] Could not acquire lock for ${tournamentId}`)
    return callback()
  }

  try {
    return await callback()
  } finally {
    try {
      await redis.eval(LOCK_SCRIPT, [lockKey], [owner])
    } catch (error) {
      console.error('[redis:tournament-unlock]', error)
    }
  }
}

function groupLabel(stage: number, index: number, total: number): string {
  if (total === 1) return stage === 1 ? 'Grupo único' : 'Final'
  return `Grupo ${String.fromCharCode(65 + index)}`
}

function toSnapshot(state: TournamentState): TournamentSnapshot {
  const allGroupsFinished = state.groups.length > 0 &&
    state.groups.every(group => group.status === 'finished')

  return {
    tournamentId: state.tournamentId,
    name: state.name,
    hostId: state.hostId,
    phase: state.phase,
    stage: state.stage,
    participants: state.participants.map(participant => ({
      id: participant.id,
      username: participant.username,
      connected: Boolean(participant.socketId),
      eliminated: participant.eliminated,
      groupId: participant.groupId,
    })),
    groups: state.groups.map(group => ({
      id: group.id,
      label: group.label,
      stage: group.stage,
      status: group.status,
      playerIds: [...group.playerIds],
      roomId: group.roomId,
      winnerId: group.winnerId,
      replayCount: group.replayCount,
    })),
    championId: state.championId,
    connectedCount: state.participants.filter(participant => participant.socketId).length,
    maxParticipants: MAX_PARTICIPANTS,
    canAdvance: state.phase === 'playing' &&
      state.groups.length > 1 &&
      allGroupsFinished,
  }
}

interface TournamentActionResult {
  ok: true
  state: TournamentSnapshot
  assignments: TournamentRoomAssignment[]
}

interface TournamentActionError {
  ok: false
  error: string
}

type TournamentAction = TournamentActionResult | TournamentActionError

function participantsForGroup(
  state: TournamentState,
  group: TournamentGroup,
): TournamentParticipant[] {
  return group.playerIds
    .map(id => state.participants.find(participant => participant.id === id))
    .filter((participant): participant is TournamentParticipant => Boolean(participant))
}

async function createRoomForGroup(
  state: TournamentState,
  group: TournamentGroup,
  participants: TournamentParticipant[],
): Promise<TournamentRoomAssignment[]> {
  const room = await RoomManager.createTournamentRoom({
    name: `${state.name} · ${group.label}`,
    tournament: {
      id: state.tournamentId,
      name: state.name,
      stage: state.stage,
      groupId: group.id,
      groupLabel: group.label,
    },
    players: participants.map(participant => ({
      participantId: participant.id,
      username: participant.username,
      socketId: participant.socketId,
    })),
  })

  const slots = room.players.map(player => player.slot)
  const startingPlayer = slots[Math.floor(Math.random() * slots.length)]
  const game = buildInitialGameState(slots, startingPlayer, TOURNAMENT_GAME_SETTINGS)
  await RoomManager.setGame(room.roomId, game)
  const updatedRoom = await RoomManager.getRoom(room.roomId)
  if (!updatedRoom) throw new Error(`Tournament room ${room.roomId} disappeared`)

  group.roomId = updatedRoom.roomId
  group.status = 'playing'
  group.winnerId = null

  for (const participant of participants) {
    participant.groupId = group.id
    participant.eliminated = false
  }

  const assignments: TournamentRoomAssignment[] = []
  for (const participant of participants) {
    const slot = (Object.entries(updatedRoom.tournament?.participantIds ?? {}) as Array<[string, string]>)
      .find(([, participantId]) => participantId === participant.id)?.[0]
    if (!slot) continue
    const playerSlot = Number(slot) as PlayerSlot
    const reconnectToken = updatedRoom.reconnectTokens[playerSlot]
    if (!reconnectToken) continue
    assignments.push({
      tournamentId: state.tournamentId,
      roomId: updatedRoom.roomId,
      playerSlot,
      reconnectToken,
      groupLabel: group.label,
      roomState: RoomManager.toSnapshot(updatedRoom),
      gameState: toGameSnapshot(game),
    })
  }
  return assignments
}

async function buildStageGroups(
  state: TournamentState,
  participants: TournamentParticipant[],
  stage: number,
): Promise<{ groups: TournamentGroup[]; assignments: TournamentRoomAssignment[] }> {
  const sizes = distributeGroupSizes(participants.length)
  const shuffled = shuffle(participants)
  const groups: TournamentGroup[] = []
  const assignments: TournamentRoomAssignment[] = []
  let offset = 0

  for (let index = 0; index < sizes.length; index++) {
    const size = sizes[index]
    const groupParticipants = shuffled.slice(offset, offset + size)
    offset += size
    const label = groupLabel(stage, index, sizes.length)
    const group: TournamentGroup = {
      id: randomUUID(),
      label,
      stage,
      status: 'playing',
      playerIds: groupParticipants.map(participant => participant.id),
      roomId: null,
      winnerId: null,
      replayCount: 0,
    }
    groups.push(group)
    assignments.push(...await createRoomForGroup(state, group, groupParticipants))
  }

  return { groups, assignments }
}

async function assignmentForParticipant(
  state: TournamentState,
  participant: TournamentParticipant,
): Promise<TournamentRoomAssignment | undefined> {
  if (!participant.groupId) return undefined
  const group = state.groups.find(candidate => candidate.id === participant.groupId)
  if (!group || group.status !== 'playing' || !group.roomId) return undefined

  const room = await RoomManager.getRoom(group.roomId)
  if (!room?.game) return undefined
  const slotEntry = (Object.entries(room.tournament?.participantIds ?? {}) as Array<[string, string]>)
    .find(([, participantId]) => participantId === participant.id)
  if (!slotEntry) return undefined
  const playerSlot = Number(slotEntry[0]) as PlayerSlot
  const reconnectToken = room.reconnectTokens[playerSlot]
  if (!reconnectToken) return undefined

  return {
    tournamentId: state.tournamentId,
    roomId: room.roomId,
    playerSlot,
    reconnectToken,
    groupLabel: group.label,
    roomState: RoomManager.toSnapshot(room),
    gameState: toGameSnapshot(room.game),
  }
}

export const TournamentManager = {
  async createTournament(
    username: string,
    socketId: string,
    name: string,
  ): Promise<{ tournament: TournamentState; participant: TournamentParticipant }> {
    let tournamentId: string
    do { tournamentId = generateRoomCode() } while (await loadTournament(tournamentId))

    const participant: TournamentParticipant = {
      id: randomUUID(),
      username,
      socketId,
      reconnectToken: randomUUID(),
      eliminated: false,
      groupId: null,
    }
    const tournament: TournamentState = {
      tournamentId,
      name: name.trim() || `Torneo de ${username}`,
      hostId: participant.id,
      phase: 'waiting',
      stage: 0,
      participants: [participant],
      groups: [],
      championId: null,
      createdAt: Date.now(),
    }
    socketToTournament.set(socketId, tournamentId)
    await saveTournament(tournament)
    return { tournament, participant }
  },

  async joinTournament(
    tournamentId: string,
    username: string,
    socketId: string,
  ): Promise<{ ok: true; tournament: TournamentState; participant: TournamentParticipant } | TournamentActionError> {
    return withTournamentLock(tournamentId, async () => {
      const tournament = await loadTournament(tournamentId)
      if (!tournament) return { ok: false as const, error: 'Torneo no encontrado' }
      if (tournament.phase !== 'waiting') {
        return { ok: false as const, error: 'El torneo ya comenzó' }
      }
      if (tournament.participants.length >= MAX_PARTICIPANTS) {
        return { ok: false as const, error: 'El torneo está lleno (50 jugadores)' }
      }
      if (tournament.participants.some(participant =>
        participant.username.toLowerCase() === username.toLowerCase()
      )) {
        return { ok: false as const, error: 'Ese nombre ya está en el torneo' }
      }

      const participant: TournamentParticipant = {
        id: randomUUID(),
        username,
        socketId,
        reconnectToken: randomUUID(),
        eliminated: false,
        groupId: null,
      }
      tournament.participants.push(participant)
      socketToTournament.set(socketId, tournamentId)
      await saveTournament(tournament)
      return { ok: true as const, tournament, participant }
    })
  },

  async reconnectTournament(
    tournamentId: string,
    reconnectToken: string,
    socketId: string,
  ): Promise<{
    ok: true
    tournament: TournamentState
    participant: TournamentParticipant
    assignment?: TournamentRoomAssignment
    previousSocketId?: string
  } | TournamentActionError> {
    return withTournamentLock(tournamentId, async () => {
      const tournament = await loadTournament(tournamentId)
      if (!tournament) return { ok: false as const, error: 'Torneo no encontrado' }

      const participant = tournament.participants.find(candidate =>
        candidate.reconnectToken === reconnectToken
      )
      if (!participant) {
        return { ok: false as const, error: 'La sesión del torneo ya no es válida' }
      }

      const previousSocketId = participant.socketId && participant.socketId !== socketId
        ? participant.socketId
        : undefined
      participant.socketId = socketId
      socketToTournament.set(socketId, tournamentId)
      await saveTournament(tournament)
      const assignment = await assignmentForParticipant(tournament, participant)
      return { ok: true as const, tournament, participant, assignment, previousSocketId }
    })
  },

  async disconnectSocket(socketId: string): Promise<TournamentSnapshot | null> {
    const tournamentId = socketToTournament.get(socketId)
    if (!tournamentId) return null
    socketToTournament.delete(socketId)

    return withTournamentLock(tournamentId, async () => {
      const tournament = await loadTournament(tournamentId)
      if (!tournament) return null
      const participant = tournament.participants.find(candidate => candidate.socketId === socketId)
      if (!participant) return toSnapshot(tournament)

      participant.socketId = ''
      if (tournament.hostId === participant.id) {
        const nextHost = tournament.participants.find(candidate => candidate.socketId)
        if (nextHost) tournament.hostId = nextHost.id
      }
      await saveTournament(tournament)
      return toSnapshot(tournament)
    })
  },

  async leaveTournament(
    tournamentId: string,
    socketId: string,
  ): Promise<TournamentSnapshot | null> {
    socketToTournament.delete(socketId)
    return withTournamentLock(tournamentId, async () => {
      const tournament = await loadTournament(tournamentId)
      if (!tournament) return null
      const participant = tournament.participants.find(candidate => candidate.socketId === socketId)
      if (!participant) return toSnapshot(tournament)

      if (tournament.phase === 'waiting') {
        tournament.participants = tournament.participants.filter(candidate => candidate.id !== participant.id)
        if (tournament.hostId === participant.id) {
          tournament.hostId = tournament.participants.find(candidate => candidate.socketId)?.id
            ?? tournament.participants[0]?.id
            ?? ''
        }
        if (tournament.participants.length === 0) {
          await deleteTournament(tournamentId)
          return null
        }
      } else {
        participant.socketId = ''
        if (tournament.hostId === participant.id) {
          const nextHost = tournament.participants.find(candidate => candidate.socketId)
          if (nextHost) tournament.hostId = nextHost.id
        }
      }

      await saveTournament(tournament)
      return toSnapshot(tournament)
    })
  },

  async startTournament(tournamentId: string, socketId: string): Promise<TournamentAction> {
    return withTournamentLock(tournamentId, async () => {
      const tournament = await loadTournament(tournamentId)
      if (!tournament) return { ok: false as const, error: 'Torneo no encontrado' }
      if (tournament.phase !== 'waiting') {
        return { ok: false as const, error: 'El torneo ya comenzó' }
      }
      const actor = tournament.participants.find(participant => participant.socketId === socketId)
      if (!actor || actor.id !== tournament.hostId) {
        return { ok: false as const, error: 'Solo el anfitrión puede iniciar el torneo' }
      }

      tournament.participants = tournament.participants.filter(participant => participant.socketId)
      if (tournament.participants.length < 3) {
        return { ok: false as const, error: 'Se necesitan al menos 3 jugadores conectados' }
      }
      if (!tournament.participants.some(participant => participant.id === tournament.hostId)) {
        tournament.hostId = tournament.participants[0].id
      }

      tournament.phase = 'playing'
      tournament.stage = 1
      tournament.championId = null
      const stage = await buildStageGroups(tournament, tournament.participants, 1)
      tournament.groups = stage.groups
      await saveTournament(tournament)
      return { ok: true as const, state: toSnapshot(tournament), assignments: stage.assignments }
    })
  },

  async advanceTournament(tournamentId: string, socketId: string): Promise<TournamentAction> {
    return withTournamentLock(tournamentId, async () => {
      const tournament = await loadTournament(tournamentId)
      if (!tournament) return { ok: false as const, error: 'Torneo no encontrado' }
      if (tournament.phase !== 'playing') {
        return { ok: false as const, error: 'El torneo no está en juego' }
      }
      const actor = tournament.participants.find(participant => participant.socketId === socketId)
      if (!actor) return { ok: false as const, error: 'No perteneces a este torneo' }
      if (tournament.groups.some(group => group.status !== 'finished')) {
        return { ok: false as const, error: 'Todavía hay grupos sin terminar' }
      }

      const winners = tournament.groups
        .map(group => tournament.participants.find(participant => participant.id === group.winnerId))
        .filter((participant): participant is TournamentParticipant => Boolean(participant))
      if (winners.length !== tournament.groups.length) {
        return { ok: false as const, error: 'Faltan ganadores por confirmar' }
      }
      if (winners.some(winner => !winner.socketId)) {
        return { ok: false as const, error: 'Esperando a que se reconecten todos los ganadores' }
      }
      if (winners.length === 1) {
        tournament.phase = 'finished'
        tournament.championId = winners[0].id
        await saveTournament(tournament)
        return { ok: true as const, state: toSnapshot(tournament), assignments: [] }
      }

      tournament.stage += 1
      const stage = await buildStageGroups(tournament, winners, tournament.stage)
      tournament.groups = stage.groups
      await saveTournament(tournament)
      return { ok: true as const, state: toSnapshot(tournament), assignments: stage.assignments }
    })
  },

  async retryGroup(
    tournamentId: string,
    groupId: string,
    socketId: string,
  ): Promise<TournamentAction> {
    return withTournamentLock(tournamentId, async () => {
      const tournament = await loadTournament(tournamentId)
      if (!tournament) return { ok: false as const, error: 'Torneo no encontrado' }
      if (tournament.phase !== 'playing') {
        return { ok: false as const, error: 'El torneo no está en juego' }
      }
      const actor = tournament.participants.find(participant => participant.socketId === socketId)
      const group = tournament.groups.find(candidate => candidate.id === groupId)
      if (!actor || !group) return { ok: false as const, error: 'Grupo no encontrado' }
      if (actor.id !== tournament.hostId && !group.playerIds.includes(actor.id)) {
        return { ok: false as const, error: 'Solo los jugadores del grupo o el anfitrión pueden repetirlo' }
      }
      if (group.status !== 'draw') {
        return { ok: false as const, error: 'El grupo no necesita repetirse' }
      }
      const participants = participantsForGroup(tournament, group)
      if (participants.some(participant => !participant.socketId)) {
        return { ok: false as const, error: 'Esperando a que se reconecten todos los jugadores' }
      }

      group.replayCount += 1
      const assignments = await createRoomForGroup(tournament, group, participants)
      await saveTournament(tournament)
      return { ok: true as const, state: toSnapshot(tournament), assignments }
    })
  },

  async recordGroupResult(
    tournamentId: string,
    groupId: string,
    roomId: string,
    winnerSlot: PlayerSlot | null,
  ): Promise<{ state: TournamentSnapshot; assignments: TournamentRoomAssignment[] } | null> {
    return withTournamentLock(tournamentId, async () => {
      const tournament = await loadTournament(tournamentId)
      if (!tournament) return null
      const group = tournament.groups.find(candidate => candidate.id === groupId)
      if (!group || group.status === 'finished') return null
      if (!group.roomId || group.roomId !== roomId) return null

      const room = await RoomManager.getRoom(group.roomId)
      if (room) {
        for (const [slot, participantId] of Object.entries(room.tournament?.participantIds ?? {})) {
          const participant = tournament.participants.find(candidate => candidate.id === participantId)
          const player = room.players.find(candidate => candidate.slot === Number(slot))
          if (participant && player) participant.socketId = player.socketId
        }
      }

      if (winnerSlot === null) {
        group.status = 'draw'
        group.winnerId = null
        await saveTournament(tournament)
        return { state: toSnapshot(tournament), assignments: [] }
      }

      const winnerId = room?.tournament?.participantIds?.[winnerSlot]
      if (!winnerId) return null
      group.status = 'finished'
      group.winnerId = winnerId
      for (const participant of participantsForGroup(tournament, group)) {
        participant.eliminated = participant.id !== winnerId
      }

      const allGroupsFinished = tournament.groups.every(candidate => candidate.status === 'finished')
      if (allGroupsFinished && tournament.groups.length === 1) {
        tournament.phase = 'finished'
        tournament.championId = winnerId
      }
      await saveTournament(tournament)
      return { state: toSnapshot(tournament), assignments: [] }
    })
  },

  async getPublicTournaments(): Promise<PublicRoomInfo[]> {
    let loaded: Array<TournamentState | undefined>

    if (redis) {
      try {
        const tournamentIds = await redis.smembers<string[]>(TOURNAMENT_INDEX_KEY)
        loaded = await Promise.all(tournamentIds.map(tournamentId => loadTournament(tournamentId)))
        const expired = tournamentIds.filter((_, index) => !loaded[index])
        if (expired.length) await redis.srem(TOURNAMENT_INDEX_KEY, ...expired)
      } catch (error) {
        console.error('[redis:public-tournaments]', error)
        loaded = Array.from(tournaments.values())
      }
    } else {
      loaded = Array.from(tournaments.values())
    }

    return loaded.flatMap(tournament =>
      tournament &&
      tournament.phase !== 'finished' &&
      tournament.participants.some(participant => participant.socketId)
        ? [{
            kind: 'tournament' as const,
            roomId: tournament.tournamentId,
            name: tournament.name,
            playerCount: tournament.participants.length,
            maxPlayers: MAX_PARTICIPANTS,
            phase: tournament.phase as 'waiting' | 'playing',
            stage: tournament.stage,
          }]
        : [],
    )
  },

  async getTournament(tournamentId: string): Promise<TournamentState | undefined> {
    return loadTournament(tournamentId)
  },

  async getSnapshot(tournamentId: string): Promise<TournamentSnapshot | undefined> {
    const tournament = await loadTournament(tournamentId)
    return tournament ? toSnapshot(tournament) : undefined
  },

  getTournamentIdBySocket(socketId: string): string | undefined {
    return socketToTournament.get(socketId)
  },

  bindSocket(socketId: string, tournamentId: string): void {
    socketToTournament.set(socketId, tournamentId)
  },

  snapshot(state: TournamentState): TournamentSnapshot {
    return toSnapshot(state)
  },
}
