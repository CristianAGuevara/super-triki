import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { RoomManager } from '../src/rooms/RoomManager.js'

test('creates a room and assigns joining players sequential slots', async () => {
  const hostSocket = `test-host-${randomUUID()}`
  const guestSocket = `test-guest-${randomUUID()}`
  const room = await RoomManager.createRoom('Anfitrión', hostSocket, 'Sala de prueba', false)
  const joined = await RoomManager.joinRoom(room.roomId, 'Invitado', guestSocket)

  assert.equal(room.hostSlot, 1)
  assert.equal(room.players[0].username, 'Anfitrión')
  const snapshot = RoomManager.toSnapshot(room)
  assert.equal(snapshot.players[0].connected, true)
  assert.equal('socketId' in snapshot.players[0], false)
  assert.equal(joined.ok, true)
  if (joined.ok) {
    assert.equal(joined.room.players.length, 2)
    assert.equal(joined.room.players[1].slot, 2)
    assert.equal(joined.room.players[1].username, 'Invitado')
  }

  await RoomManager.removePlayer(hostSocket)
  await RoomManager.removePlayer(guestSocket)
})

test('assigns distinct default colors and allows changing them while waiting', async () => {
  const hostSocket = `test-host-${randomUUID()}`
  const guestSocket = `test-guest-${randomUUID()}`
  const room = await RoomManager.createRoom('Anfitrión', hostSocket, 'Colores', false)
  const joined = await RoomManager.joinRoom(room.roomId, 'Invitado', guestSocket)
  assert.equal(joined.ok, true)
  if (!joined.ok) return

  assert.equal(joined.room.players[0].color, 'coral')
  assert.equal(joined.room.players[1].color, 'cyan')

  const changed = await RoomManager.setPlayerColor(joined.room.roomId, 2, 'emerald')
  assert.equal(changed.ok, true)
  if (changed.ok) {
    assert.equal(changed.room.players[1].color, 'emerald')
    assert.equal(RoomManager.toSnapshot(changed.room).players[1].color, 'emerald')
  }

  const conflict = await RoomManager.setPlayerColor(joined.room.roomId, 2, 'coral')
  assert.equal(conflict.ok, false)
  if (!conflict.ok) assert.match(conflict.error, /ocupado/i)

  await RoomManager.removePlayer(hostSocket)
  await RoomManager.removePlayer(guestSocket)
})

test('prevents the same browser user id from joining a room twice', async () => {
  const hostSocket = `test-host-${randomUUID()}`
  const guestSocket = `test-guest-${randomUUID()}`
  const userId = randomUUID()
  const room = await RoomManager.createRoom(
    'Anfitrión',
    hostSocket,
    'Sin clones',
    false,
    undefined,
    userId,
  )

  const duplicate = await RoomManager.joinRoom(
    room.roomId,
    'Anfitrión',
    guestSocket,
    undefined,
    userId,
  )
  assert.equal(duplicate.ok, false)
  if (!duplicate.ok) assert.match(duplicate.error, /otra pestaña|dispositivo/i)

  const differentUser = await RoomManager.joinRoom(
    room.roomId,
    'Invitado',
    guestSocket,
    undefined,
    randomUUID(),
  )
  assert.equal(differentUser.ok, true)

  await RoomManager.removePlayer(hostSocket)
  await RoomManager.removePlayer(guestSocket)
})

test('rejects a private room with the wrong password', async () => {
  const hostSocket = `test-host-${randomUUID()}`
  const guestSocket = `test-guest-${randomUUID()}`
  const room = await RoomManager.createRoom('Host', hostSocket, 'Privada', true, 'secreto')
  const rejected = await RoomManager.joinRoom(room.roomId, 'Guest', guestSocket, 'incorrecta')

  assert.equal(rejected.ok, false)
  if (!rejected.ok) assert.match(rejected.error, /Contraseña/i)
  await RoomManager.removePlayer(hostSocket)
})

test('the host can configure a bot in an empty seat', async () => {
  const hostSocket = `test-host-${randomUUID()}`
  const guestSocket = `test-guest-${randomUUID()}`
  const room = await RoomManager.createRoom('Anfitrión', hostSocket, 'Bots', false)

  const added = await RoomManager.addBot(room.roomId, hostSocket, 2)
  assert.equal(added.ok, true)
  if (!added.ok) return
  const bot = added.room.players.find(player => player.slot === 2)
  assert.equal(bot?.isBot, true)
  assert.equal(bot?.botDifficulty, 'normal')
  assert.equal(bot?.username, 'Bot Normal')
  const snapshot = RoomManager.toSnapshot(added.room)
  assert.equal(snapshot.playerCount, 2)
  assert.equal(snapshot.players[1].isBot, true)
  assert.equal(snapshot.players[1].connected, false)

  const repeated = await RoomManager.addBot(room.roomId, hostSocket, 2)
  assert.equal(repeated.ok, false)
  if (!repeated.ok) assert.match(repeated.error, /ocupado/i)

  const guest = await RoomManager.joinRoom(room.roomId, 'Invitado', guestSocket)
  assert.equal(guest.ok, true)
  if (guest.ok) assert.equal(guest.room.players.find(player => player.socketId === guestSocket)?.slot, 3)

  const notHost = await RoomManager.addBot(room.roomId, guestSocket, 4)
  assert.equal(notHost.ok, false)
  if (!notHost.ok) assert.match(notHost.error, /anfitrión/i)

  const difficulty = await RoomManager.setBotDifficulty(room.roomId, hostSocket, 2, 'expert')
  assert.equal(difficulty.ok, true)
  if (difficulty.ok) {
    const configured = difficulty.room.players.find(player => player.slot === 2)
    assert.equal(configured?.botDifficulty, 'expert')
    assert.equal(configured?.username, 'Bot Experto')
  }

  const color = await RoomManager.setBotColor(room.roomId, hostSocket, 2, 'emerald')
  assert.equal(color.ok, true)
  if (color.ok) assert.equal(color.room.players.find(player => player.slot === 2)?.color, 'emerald')

  const conflict = await RoomManager.setBotColor(room.roomId, hostSocket, 2, 'coral')
  assert.equal(conflict.ok, false)
  if (!conflict.ok) assert.match(conflict.error, /ocupado/i)

  const removed = await RoomManager.removeBot(room.roomId, hostSocket, 2)
  assert.equal(removed.ok, true)
  if (removed.ok) assert.equal(removed.room.players.some(player => player.isBot), false)

  await RoomManager.removePlayer(hostSocket)
  await RoomManager.removePlayer(guestSocket)
})

test('disconnected cleanup keeps bots in the room', async () => {
  const hostSocket = `test-host-${randomUUID()}`
  const room = await RoomManager.createRoom('Anfitrión', hostSocket, 'Bots persistentes', false)
  const added = await RoomManager.addBot(room.roomId, hostSocket, 2)
  assert.equal(added.ok, true)
  if (!added.ok) return

  await RoomManager.removeDisconnectedPlayers(room.roomId)
  const loaded = await RoomManager.getRoom(room.roomId)
  assert.ok(loaded)
  assert.equal(loaded?.players.some(player => player.isBot), true)
  assert.equal(loaded?.players.length, 2)

  await RoomManager.removePlayer(hostSocket)
})
