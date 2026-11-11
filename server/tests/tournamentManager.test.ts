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

test('prevents the same browser user id from joining a tournament twice', async () => {
  const userId = randomUUID()
  const hostSocket = `tournament-user-${randomUUID()}`
  const guestSocket = `tournament-user-${randomUUID()}`
  const created = await TournamentManager.createTournament(
    'Host',
    hostSocket,
    'Sin clones',
    userId,
  )

  const duplicate = await TournamentManager.joinTournament(
    created.tournament.tournamentId,
    'Otro nombre',
    guestSocket,
    userId,
  )
  assert.equal(duplicate.ok, false)
  if (!duplicate.ok) assert.match(duplicate.error, /otra pestaña|dispositivo/i)
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

test('runs a points league and resolves a top tie with sudden death', async () => {
  const hostSocket = `tournament-league-${randomUUID()}`
  const created = await TournamentManager.createTournament('Host', hostSocket, 'Liga de prueba')
  const sockets = [hostSocket]
  for (const [index, name] of ['Dos', 'Tres', 'Cuatro'].entries()) {
    const socketId = `tournament-league-${index}-${randomUUID()}`
    sockets.push(socketId)
    const joined = await TournamentManager.joinTournament(created.tournament.tournamentId, name, socketId)
    assert.equal(joined.ok, true)
  }

  const settings = await TournamentManager.setTournamentSettings(
    created.tournament.tournamentId,
    hostSocket,
    'league',
    2,
    300,
  )
  assert.equal(settings.ok, true)

  const started = await TournamentManager.startTournament(created.tournament.tournamentId, hostSocket)
  assert.equal(started.ok, true)
  if (!started.ok) return
  assert.equal(started.state.format, 'league')
  assert.equal(started.state.stageKind, 'league')
  assert.equal(started.state.stage, 1)

  const playGroup = async (winnerSlot: 1 | 2 | 3 | 4) => {
    const tournament = await TournamentManager.getTournament(created.tournament.tournamentId)
    assert.ok(tournament)
    const group = tournament.groups[0]
    assert.ok(group?.roomId)
    const room = await RoomManager.getRoom(group.roomId)
    assert.ok(room)
    const result = await TournamentManager.recordGroupResult(
      created.tournament.tournamentId,
      group.id,
      room.roomId,
      winnerSlot,
    )
    assert.ok(result)
    return result.state
  }

  const afterRoundOne = await playGroup(1)
  assert.equal(afterRoundOne.groups[0].status, 'finished')
  assert.equal(afterRoundOne.participants.filter(participant => participant.eliminated).length, 0)

  const roundTwo = await TournamentManager.advanceTournament(created.tournament.tournamentId, hostSocket)
  assert.equal(roundTwo.ok, true)
  if (!roundTwo.ok) return
  assert.equal(roundTwo.state.stage, 2)

  const afterRoundTwo = await playGroup(2)
  assert.equal(afterRoundTwo.phase, 'playing')
  assert.equal(afterRoundTwo.needsTiebreak, true)
  assert.equal(afterRoundTwo.canAdvance, true)

  const suddenDeath = await TournamentManager.advanceTournament(created.tournament.tournamentId, hostSocket)
  assert.equal(suddenDeath.ok, true)
  if (!suddenDeath.ok) return
  assert.equal(suddenDeath.state.stageKind, 'sudden-death')
  assert.equal(suddenDeath.state.groups[0].playerIds.length, 2)
  assert.equal(suddenDeath.assignments.length, 2)

  const finalTournament = await TournamentManager.getTournament(created.tournament.tournamentId)
  assert.ok(finalTournament)
  const finalGroup = finalTournament.groups[0]
  assert.ok(finalGroup?.roomId)
  const finalRoom = await RoomManager.getRoom(finalGroup.roomId)
  assert.ok(finalRoom)
  await TournamentManager.recordGroupResult(
    created.tournament.tournamentId,
    finalGroup.id,
    finalRoom.roomId,
    1,
  )

  const finished = await TournamentManager.getSnapshot(created.tournament.tournamentId)
  assert.ok(finished)
  assert.equal(finished.phase, 'finished')
  assert.ok(finished.championId)
  assert.equal(finished.participants.filter(participant => participant.leagueWins === 1).length, 2)
})

test('tracks how many tournament players are watching each group', async () => {
  const hostSocket = `tournament-watch-${randomUUID()}`
  const created = await TournamentManager.createTournament('Host', hostSocket, 'Con espectadores')
  for (let index = 2; index <= 5; index++) {
    const joined = await TournamentManager.joinTournament(
      created.tournament.tournamentId,
      `Jugador ${index}`,
      `tournament-watch-${index}-${randomUUID()}`,
    )
    assert.equal(joined.ok, true)
  }

  const started = await TournamentManager.startTournament(created.tournament.tournamentId, hostSocket)
  assert.equal(started.ok, true)
  if (!started.ok || started.state.groups.length < 2) return

  const groupA = started.state.groups[0]
  const groupB = started.state.groups[1]
  const spectator = started.state.participants.find(participant =>
    groupB.playerIds.includes(participant.id)
  )
  assert.ok(spectator?.connected)

  const tournament = await TournamentManager.getTournament(created.tournament.tournamentId)
  assert.ok(tournament)
  const participant = tournament.participants.find(candidate => candidate.id === spectator!.id)
  assert.ok(participant?.socketId)
  const startedWatching = await TournamentManager.startSpectating(participant.socketId, groupA.id)
  assert.ok(startedWatching)
  assert.equal(startedWatching.groups.find(group => group.id === groupA.id)?.spectatorCount, 1)

  const stoppedWatching = await TournamentManager.stopSpectating(participant.socketId)
  assert.ok(stoppedWatching)
  assert.equal(stoppedWatching.groups.find(group => group.id === groupA.id)?.spectatorCount, 0)
})

test('lists tournaments publicly until they finish', async () => {
  const hostSocket = `tournament-listing-${randomUUID()}`
  const created = await TournamentManager.createTournament('Host', hostSocket, 'Copa pública')
  for (const [index, name] of ['Dos', 'Tres'].entries()) {
    const joined = await TournamentManager.joinTournament(
      created.tournament.tournamentId,
      name,
      `tournament-listing-${index}-${randomUUID()}`,
    )
    assert.equal(joined.ok, true)
  }

  const waitingList = await TournamentManager.getPublicTournaments()
  const waitingEntry = waitingList.find(entry => entry.roomId === created.tournament.tournamentId)
  assert.equal(waitingEntry?.kind, 'tournament')
  assert.equal(waitingEntry?.maxPlayers, 50)

  const started = await TournamentManager.startTournament(created.tournament.tournamentId, hostSocket)
  assert.equal(started.ok, true)
  const playingList = await TournamentManager.getPublicTournaments()
  assert.equal(
    playingList.find(entry => entry.roomId === created.tournament.tournamentId)?.phase,
    'playing',
  )

  const group = started.ok ? started.state.groups[0] : null
  assert.ok(group)
  assert.ok(group.roomId)
  const room = await RoomManager.getRoom(group.roomId)
  assert.ok(room)
  await TournamentManager.recordGroupResult(
    created.tournament.tournamentId,
    group.id,
    room.roomId,
    1,
  )

  const finishedList = await TournamentManager.getPublicTournaments()
  assert.equal(finishedList.some(entry => entry.roomId === created.tournament.tournamentId), false)
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
