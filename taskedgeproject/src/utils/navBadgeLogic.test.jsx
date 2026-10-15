import assert from 'node:assert/strict'
import test from 'node:test'

import { didCountIncrease } from './navBadgeLogic.jsx'

test('didCountIncrease detects numeric sidebar badge increases', () => {
  assert.equal(didCountIncrease('23', '24'), true)
  assert.equal(didCountIncrease('', '1'), true)
  assert.equal(didCountIncrease('24', '24'), false)
  assert.equal(didCountIncrease('24', '23'), false)
  assert.equal(didCountIncrease('', ''), false)
})
