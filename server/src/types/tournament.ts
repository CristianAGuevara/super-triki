export type TournamentPhase = 'waiting' | 'playing' | 'finished'

export type TournamentGroupStatus = 'playing' | 'finished' | 'draw'

export interface TournamentParticipant {
  id: string
  username: string
  socketId: string
  reconnectToken: string
  eliminated: boolean
  groupId: string | null
}

export interface TournamentGroup {
  id: string
  label: string
  stage: number
  status: TournamentGroupStatus
  playerIds: string[]
  roomId: string | null
  winnerId: string | null
  replayCount: number
}

export interface TournamentState {
  tournamentId: string
  name: string
  hostId: string
  phase: TournamentPhase
  stage: number
  participants: TournamentParticipant[]
  groups: TournamentGroup[]
  championId: string | null
  createdAt: number
}

export interface TournamentParticipantSnapshot {
  id: string
  username: string
  connected: boolean
  eliminated: boolean
  groupId: string | null
}

export interface TournamentGroupSnapshot {
  id: string
  label: string
  stage: number
  status: TournamentGroupStatus
  playerIds: string[]
  roomId: string | null
  winnerId: string | null
  replayCount: number
}

export interface TournamentSnapshot {
  tournamentId: string
  name: string
  hostId: string
  phase: TournamentPhase
  stage: number
  participants: TournamentParticipantSnapshot[]
  groups: TournamentGroupSnapshot[]
  championId: string | null
  connectedCount: number
  maxParticipants: number
  canAdvance: boolean
}
