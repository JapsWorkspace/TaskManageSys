import assert from 'node:assert/strict'
import test from 'node:test'

import { getPathForNav, getRouteState } from './routeLogic.jsx'

test('route helpers map sidebar items to browser paths', () => {
  assert.equal(getPathForNav('all-my-tasks'), '/tasks')
  assert.equal(getPathForNav('individual-activities'), '/activities')
  assert.equal(getPathForNav('admin-users'), '/admin/users')
  assert.equal(getPathForNav('activity-log'), '/admin/activity-log')
})

test('route helpers map browser paths back to app view state', () => {
  assert.deepEqual(getRouteState('/projects'), {
    activeNav: 'project-board',
    activeView: 'projects',
  })
  assert.deepEqual(getRouteState('/unknown'), {
    activeNav: 'my-day',
    activeView: 'dashboard',
  })
  assert.deepEqual(getRouteState('/admin/activity-log'), {
    activeNav: 'activity-log',
    activeView: 'activity-log',
  })
})
