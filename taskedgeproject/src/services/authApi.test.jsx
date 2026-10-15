import assert from 'node:assert/strict'
import test from 'node:test'

import { createAuthApi } from './authApi.jsx'

test('createAuthApi updates profile through authenticated server endpoint', async () => {
  const calls = []
  const api = createAuthApi({
    baseUrl: 'http://localhost:8000/api',
    getToken: () => 'token-1',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      return {
        ok: true,
        json: async () => ({
          message: 'Profile updated.',
          user: {
            _id: 'user-1',
            firstName: 'Justin',
            lastName: 'Raine',
            username: 'justin',
            email: 'justin@example.com',
            phone: '555',
            role: 'member',
          },
        }),
      }
    },
  })

  const result = await api.updateProfile({
    firstName: 'Justin',
    lastName: 'Raine',
    username: 'justin',
    phone: '555',
  })

  assert.equal(result.message, 'Profile updated.')
  assert.equal(result.user.firstName, 'Justin')
  assert.equal(calls[0].url, 'http://localhost:8000/api/auth/me')
  assert.equal(calls[0].options.method, 'PATCH')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-1')
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    firstName: 'Justin',
    lastName: 'Raine',
    username: 'justin',
    phone: '555',
  })
})

test('createAuthApi changes password through authenticated server endpoint', async () => {
  const calls = []
  const api = createAuthApi({
    baseUrl: 'http://localhost:8000/api',
    getToken: () => 'token-1',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      return {
        ok: true,
        json: async () => ({ message: 'Password changed.' }),
      }
    },
  })

  const message = await api.changePassword('new-password')

  assert.equal(message, 'Password changed.')
  assert.equal(calls[0].url, 'http://localhost:8000/api/auth/change-password')
  assert.equal(calls[0].options.method, 'PATCH')
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    newPassword: 'new-password',
  })
})

test('createAuthApi uses the configured Axios-style client by default', async () => {
  const calls = []
  const api = createAuthApi({
    baseUrl: 'http://localhost:8000/api',
    getToken: () => 'token-1',
    httpClient: async (config) => {
      calls.push(config)
      return {
        data: {
          message: 'Password changed.',
        },
      }
    },
  })

  const message = await api.changePassword('new-password')

  assert.equal(message, 'Password changed.')
  assert.equal(calls[0].url, 'http://localhost:8000/api/auth/change-password')
  assert.equal(calls[0].method, 'PATCH')
  assert.equal(calls[0].headers.Authorization, 'Bearer token-1')
  assert.deepEqual(JSON.parse(calls[0].data), { newPassword: 'new-password' })
})

test('createAuthApi logs out all devices and deletes the account', async () => {
  const calls = []
  const api = createAuthApi({
    baseUrl: 'http://localhost:8000/api',
    getToken: () => 'token-1',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      return {
        ok: true,
        json: async () => ({
          message: url.endsWith('/logout-all') ? 'Logged out of all devices.' : 'Account deleted.',
        }),
      }
    },
  })

  assert.equal(await api.logoutAllDevices(), 'Logged out of all devices.')
  assert.equal(await api.deleteAccount(), 'Account deleted.')
  assert.equal(calls[0].url, 'http://localhost:8000/api/auth/logout-all')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[1].url, 'http://localhost:8000/api/auth/me')
  assert.equal(calls[1].options.method, 'DELETE')
})

test('createAuthApi requests and completes password reset', async () => {
  const calls = []
  const api = createAuthApi({
    baseUrl: 'http://localhost:8000/api',
    getToken: () => '',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      return {
        ok: true,
        json: async () => (
          url.endsWith('/forgot-password')
            ? {
                message: 'If the account exists, a reset code has been created.',
              }
            : { message: 'Password reset successfully.' }
        ),
      }
    },
  })

  const requestResult = await api.requestPasswordReset('justin@gmail.com')
  const resetMessage = await api.resetPassword({
    token: 'dev-token',
    password: 'Newpass1!',
  })

  assert.deepEqual(requestResult, {
    message: 'If the account exists, a reset code has been created.',
    resetToken: '',
  })
  assert.equal(resetMessage, 'Password reset successfully.')
  assert.equal(calls[0].url, 'http://localhost:8000/api/auth/forgot-password')
  assert.equal(calls[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'justin@gmail.com' })
  assert.equal(calls[1].url, 'http://localhost:8000/api/auth/reset-password')
  assert.equal(calls[1].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    token: 'dev-token',
    password: 'Newpass1!',
  })
})

test('createAuthApi reports unauthorized responses without treating forbidden responses as expired sessions', async () => {
  const statuses = [401, 403]
  let unauthorizedCount = 0
  const api = createAuthApi({
    baseUrl: 'http://localhost:8000/api',
    getToken: () => 'token-1',
    onUnauthorized: () => { unauthorizedCount += 1 },
    fetchImpl: async () => {
      const status = statuses.shift()
      return {
        ok: false,
        status,
        json: async () => ({ message: status === 401 ? 'Invalid or expired token.' : 'Permission denied.' }),
      }
    },
  })

  await assert.rejects(() => api.changePassword('Password1!'), /expired token/)
  await assert.rejects(() => api.changePassword('Password1!'), /Permission denied/)
  assert.equal(unauthorizedCount, 1)
})

test('createAuthApi reports unauthorized Axios responses', async () => {
  let unauthorizedCount = 0
  const api = createAuthApi({
    baseUrl: 'http://localhost:8000/api',
    getToken: () => 'token-1',
    onUnauthorized: () => { unauthorizedCount += 1 },
    httpClient: async () => {
      const error = new Error('Unauthorized')
      error.response = { status: 401, data: { message: 'Invalid or expired token.' } }
      throw error
    },
  })

  await assert.rejects(() => api.changePassword('Password1!'), /expired token/)
  assert.equal(unauthorizedCount, 1)
})
