import assert from 'node:assert/strict'
import test from 'node:test'
import { getSidebarIconName } from './sidebarNavigation.js'

test('sidebar destinations use the matching outline icon family', () => {
  assert.equal(getSidebarIconName('my-day'), 'House')
  assert.equal(getSidebarIconName('next-7-days'), 'CalendarDays')
  assert.equal(getSidebarIconName('all-my-tasks'), 'List')
  assert.equal(getSidebarIconName('project-board'), 'Folder')
  assert.equal(getSidebarIconName('teams'), 'Users')
  assert.equal(getSidebarIconName('notifications'), 'Bell')
  assert.equal(getSidebarIconName('archive'), 'Archive')
})

test('additional TaskEdge destinations stay in the same icon family', () => {
  assert.equal(getSidebarIconName('individual-activities'), 'ClipboardCheck')
  assert.equal(getSidebarIconName('admin-users'), 'ShieldCheck')
  assert.equal(getSidebarIconName('activity-log'), 'History')
  assert.equal(getSidebarIconName('unknown'), null)
})
