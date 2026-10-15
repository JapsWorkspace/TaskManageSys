import assert from 'node:assert/strict'
import test from 'node:test'

import { getPaginationState } from './paginationLogic.js'

test('getPaginationState slices records for the requested page', () => {
  const items = Array.from({ length: 14 }, (_, index) => `record-${index + 1}`)

  const state = getPaginationState(items, 2, 5)

  assert.deepEqual(state.items, ['record-6', 'record-7', 'record-8', 'record-9', 'record-10'])
  assert.equal(state.page, 2)
  assert.equal(state.totalPages, 3)
  assert.equal(state.hasPrevious, true)
  assert.equal(state.hasNext, true)
})

test('getPaginationState clamps empty and out of range pages', () => {
  const empty = getPaginationState([], 10, 5)
  const first = getPaginationState(['one', 'two'], -4, 5)

  assert.equal(empty.page, 1)
  assert.equal(empty.totalPages, 1)
  assert.deepEqual(empty.items, [])
  assert.equal(first.page, 1)
  assert.deepEqual(first.items, ['one', 'two'])
})
