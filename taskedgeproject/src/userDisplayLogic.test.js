import assert from 'node:assert/strict'
import test from 'node:test'

import { getUserDisplayName } from './userDisplayLogic.js'

test('getUserDisplayName prefers username before full name and email', () => {
  assert.equal(
    getUserDisplayName({
      username: 'try',
      firstName: 'Justin',
      lastName: 'Raine',
      email: 'justin@gmail.com',
    }),
    'try',
  )
})

test('getUserDisplayName falls back when username is missing', () => {
  assert.equal(getUserDisplayName({ firstName: 'Justin', lastName: 'Raine' }), 'Justin Raine')
  assert.equal(getUserDisplayName({ email: 'justin@gmail.com' }), 'justin@gmail.com')
  assert.equal(getUserDisplayName(null), 'User')
})
