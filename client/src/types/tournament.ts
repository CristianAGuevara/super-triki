export type TournamentPhase = 'waiting' | 'playing' | 'finished'

export type TournamentFormat = 'elimination' | 'league'
export type TournamentStageKind = 'elimination' | 'league' | 'sudden-death'

export type TournamentGroupStatus = 'playing' | 'finished' | 'draw'

export interface TournamentParticipantSnapshot {
  id: string
  username: string
  connected: boolean
  eliminated: boolean
  groupId: string | null
  leaguePoints: number
  leagueWins: number
  leagueDraws: number
  leagueLosses: number
  leagueGames: number
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
  spectatorCount: number
}

export interface TournamentSnapshot {
  tournamentId: string
  name: string
  hostId: string
  phase: TournamentPhase
  format: TournamentFormat
  leagueRounds: number
  playerClockSeconds: number
  stageKind: TournamentStageKind
  stage: number
  participants: TournamentParticipantSnapshot[]
  groups: TournamentGroupSnapshot[]
  championId: string | null
  connectedCount: number
  maxParticipants: number
  canAdvance: boolean
  needsTiebreak: boolean
}
