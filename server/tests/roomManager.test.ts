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

test('rejects a private room with the wrong password', async () => {
  const hostSocket = `test-host-${randomUUID()}`
  const guestSocket = `test-guest-${randomUUID()}`
  const room = await RoomManager.createRoom('Host', hostSocket, 'Privada', true, 'secreto')
  const rejected = await RoomManager.joinRoom(room.roomId, 'Guest', guestSocket, 'incorrecta')

  assert.equal(rejected.ok, false)
  if (!rejected.ok) assert.match(rejected.error, /Contraseña/i)
  await RoomManager.removePlayer(hostSocket)
})
