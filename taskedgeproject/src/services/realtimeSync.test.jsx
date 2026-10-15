import assert from 'node:assert/strict'
import test from 'node:test'

import { createRealtimeSync } from './realtimeSync.jsx'

test('createRealtimeSync connects with auth and reloads workspace data for shared change events', () => {
  const registered = new Map()
  const calls = []
  const socket = {
    on(event, handler) {
      registered.set(event, handler)
      calls.push(['on', event])
    },
    connect() {
      calls.push(['connect'])
    },
    disconnect() {
      calls.push(['disconnect'])
    },
  }

  const sync = createRealtimeSync({
    serverUrl: 'http://localhost:8000',
    token: 'token-1',
    socketFactory: (url, options) => {
      calls.push(['factory', url, options])
      return socket
    },
  })

  let reloads = 0
  const stop = sync.start(() => {
    reloads += 1
  })

  registered.get('task:changed')()
  registered.get('notification:new')()
  stop()

  assert.deepEqual(calls[0], [
    'factory',
    'http://localhost:8000',
    {
      auth: { token: 'token-1' },
      transports: ['websocket'],
      autoConnect: false,
    },
  ])
  assert.equal(registered.has('task:deleted'), true)
  assert.equal(registered.has('project:changed'), true)
  assert.equal(registered.has('team:changed'), true)
  assert.equal(registered.has('user:changed'), true)
  assert.equal(registered.has('activity-assignment:changed'), true)
  assert.equal(registered.has('comment:new'), true)
  assert.equal(reloads, 2)
  assert.deepEqual(calls.at(-1), ['disconnect'])
})

test('createRealtimeSync does not connect without a token', () => {
  const sync = createRealtimeSync({
    serverUrl: 'http://localhost:8000',
    token: '',
    socketFactory: () => {
      throw new Error('socket factory should not run')
    },
  })

  const stop = sync.start(() => {})

  assert.equal(stop(), undefined)
})
