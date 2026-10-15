import test from 'node:test'
import assert from 'node:assert/strict'

import {
  AUTH_TRANSITION_DURATION,
  getAuthTransitionCopy,
  getRemainingTransitionTime,
} from './authTransitionLogic.js'

test('uses workspace copy for login and session copy for logout', () => {
  assert.deepEqual(getAuthTransitionCopy('login'), {
    message: 'Preparing your workspace',
    accessibleLabel: 'Signing in and preparing your workspace',
  })
  assert.deepEqual(getAuthTransitionCopy('logout'), {
    message: 'Securing your session',
    accessibleLabel: 'Signing out and securing your session',
  })
})

test('keeps auth transitions visible for the configured minimum duration', () => {
  assert.equal(getRemainingTransitionTime(1_000, 1_400), AUTH_TRANSITION_DURATION - 400)
  assert.equal(getRemainingTransitionTime(1_000, 4_000), 0)
})
