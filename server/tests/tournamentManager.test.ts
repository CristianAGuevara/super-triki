import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { TournamentManager } from '../src/tournaments/TournamentManager.js'
import { RoomManager } from '../src/rooms/RoomManager.js'

test('leaving the waiting room releases the player socket', async () => {
  const socketId = `tournament-solo-${randomUUID()}`
  const created = await TournamentManager.createTournament('Solo', socketId, 'Copa solitaria')
  const left = await TournamentManager.leaveTournament(created.tournament.tournamentId, socketId)
  assert.equal(left, null)

  const recreated = await TournamentManager.createTournament('Solo', socketId, 'Nueva copa')
  assert.ok(recreated.tournament.tournamentId)
})

test('limits tournament registration to fifty participants', async () => {
  const hostSocket = `tournament-host-${randomUUID()}`
  const { tournament } = await TournamentManager.createTournament('Host', hostSocket, 'Copa llena')

  for (let index = 2; index <= 50; index++) {
    const joined = await TournamentManager.joinTournament(
      tournament.tournamentId,
      `Jugador ${index}`,
      `tournament-limit-${index}-${randomUUID()}`,
    )
    assert.equal(joined.ok, true)
  }

  const rejected = await TournamentManager.joinTournament(
    tournament.tournamentId,
    'Jugador 51',
    `tournament-limit-51-${randomUUID()}`,
  )
  assert.equal(rejected.ok, false)
  if (!rejected.ok) assert.match(rejected.error, /lleno/i)
})

test('starts a five-player tournament with a 3 + 2 split', async () => {
  const hostSocket = `tournament-host-${randomUUID()}`
  const { tournament } = await TournamentManager.createTournament(
    'Anfitrión',
    hostSocket,
    'Copa de prueba',
  )

  const guestSockets: string[] = []
  for (const name of ['Dos', 'Tres', 'Cuatro', 'Cinco']) {
    const socketId = `tournament-guest-${randomUUID()}`
    guestSockets.push(socketId)
    const joined = await TournamentManager.joinTournament(tournament.tournamentId, name, socketId)
    assert.equal(joined.ok, true)
  }

  const result = await TournamentManager.startTournament(tournament.tournamentId, hostSocket)
  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal(result.state.phase, 'playing')
  assert.deepEqual(result.state.groups.map(group => group.playerIds.length).sort(), [2, 3])
  assert.equal(result.assignments.length, 5)
  assert.ok(result.assignments.every(assignment => assignment.gameState.moveNumber === 0))

  for (const group of result.state.groups) {
    const room = await RoomManager.getRoom(group.roomId!)
    assert.ok(room)
    const recorded = await TournamentManager.recordGroupResult(
      tournament.tournamentId,
      group.id,
      room.roomId,
      1,
    )
    assert.ok(recorded)
  }

  const advanced = await TournamentManager.advanceTournament(tournament.tournamentId, hostSocket)
  assert.equal(advanced.ok, true)
  if (!advanced.ok) return
  assert.equal(advanced.state.stage, 2)
  assert.equal(advanced.state.groups.length, 1)
  assert.equal(advanced.state.groups[0].playerIds.length, 2)
  assert.equal(advanced.assignments.length, 2)
})
