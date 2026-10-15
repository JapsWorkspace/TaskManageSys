import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAuthFromResponse } from './authLogic.jsx'

test('buildAuthFromResponse keeps the shared backend token and profile fields', () => {
  const auth = buildAuthFromResponse({
    token: 'server-token',
    user: {
      _id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada',
      email: 'ada@example.com',
      phone: '555',
      birthday: '1815-12-10T00:00:00.000Z',
      role: 'manager',
      avatarUrl: '/uploads/avatar.png',
    },
  })

  assert.equal(auth.token, 'server-token')
  assert.deepEqual(auth.user, {
    id: 'user-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    username: 'ada',
    email: 'ada@example.com',
    phone: '555',
    birthday: '1815-12-10T00:00:00.000Z',
    role: 'manager',
    avatarUrl: '/uploads/avatar.png',
  })
})

test('buildAuthFromResponse rejects incomplete server auth responses', () => {
  assert.throws(
    () => buildAuthFromResponse({ user: { firstName: 'Ada' } }),
    /valid login session/,
  )
})
