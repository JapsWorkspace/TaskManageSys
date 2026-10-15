import test from 'node:test'
import assert from 'node:assert/strict'

import { createAuthHeaders, readStoredAuth, storeAuth } from './authStorage.jsx'

test('storeAuth and readStoredAuth preserve user and token', () => {
  const storage = new Map()
  const localStorageLike = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  }

  storeAuth(
    {
      user: { id: 'user-1', firstName: 'Jason' },
      token: 'jwt-token',
    },
    localStorageLike,
  )

  assert.deepEqual(readStoredAuth(localStorageLike), {
    user: { id: 'user-1', firstName: 'Jason' },
    token: 'jwt-token',
  })
})

test('createAuthHeaders returns bearer header when token exists', () => {
  assert.deepEqual(createAuthHeaders('jwt-token'), {
    Authorization: 'Bearer jwt-token',
  })
})

test('createAuthHeaders returns empty headers without token', () => {
  assert.deepEqual(createAuthHeaders(''), {})
})
