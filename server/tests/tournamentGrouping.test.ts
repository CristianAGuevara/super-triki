import assert from 'node:assert/strict'
import test from 'node:test'
import { distributeGroupSizes } from '../src/tournaments/grouping.js'

function assertValidGroups(sizes: number[], count: number) {
  assert.equal(sizes.reduce((total, size) => total + size, 0), count)
  assert.ok(sizes.length > 0)
  assert.ok(sizes.every(size => size >= 3), `unexpected small group in ${sizes.join(',')}`)
  assert.ok(sizes.every(size => size <= 4), `unexpected large group in ${sizes.join(',')}`)
}

test('splits five players into 3 + 2', () => {
  assert.deepEqual(distributeGroupSizes(5), [3, 2])
})

test('splits nine players into three groups of three', () => {
  assert.deepEqual(distributeGroupSizes(9), [3, 3, 3])
})

test('keeps groups between 3 and 4 players when possible', () => {
  for (const count of [3, 4, 6, 7, 8, 10, 11, 12, 20, 49, 50]) {
    assertValidGroups(distributeGroupSizes(count), count)
  }
})

test('prioritizes groups of four and then groups of three', () => {
  assert.deepEqual(distributeGroupSizes(7), [4, 3])
  assert.deepEqual(distributeGroupSizes(10), [4, 3, 3])
  assert.deepEqual(distributeGroupSizes(12), [4, 4, 4])
  assert.deepEqual(distributeGroupSizes(13), [4, 3, 3, 3])

  const sizes = distributeGroupSizes(50)
  assert.equal(sizes.length, 13)
  assert.equal(sizes.filter(size => size === 4).length, 11)
  assert.equal(sizes.filter(size => size === 3).length, 2)
})

test('a two-player final is allowed', () => {
  assert.deepEqual(distributeGroupSizes(2), [2])
})
