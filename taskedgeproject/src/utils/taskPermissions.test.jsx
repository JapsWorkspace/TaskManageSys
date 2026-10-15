import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canAccessAdminArea,
  canAccessArchive,
  canCreateTasks,
  canManageOwnedRecord,
  getArchiveRecordPermissions,
  getTaskPermissions,
  getTaskCommentPermissions,
} from './taskPermissions.jsx'

const assignedTask = {
  assigneeId: 'member-1',
  collaboratorIds: ['member-2'],
  watcherIds: ['member-3'],
}

test('only managers and admins can create tasks', () => {
  assert.equal(canCreateTasks({ id: 'member-1', role: 'member' }), false)
  assert.equal(canCreateTasks({ id: 'manager-1', role: 'manager' }), true)
  assert.equal(canCreateTasks({ id: 'admin-1', role: 'admin' }), true)
})

test('managers only fully manage tasks they created or whose project they manage', () => {
  const manager = { id: 'manager-1', role: 'manager' }

  assert.equal(getTaskPermissions({ id: 'member-1', role: 'member' }, assignedTask).canManage, false)
  assert.equal(getTaskPermissions(manager, assignedTask).canManage, false)
  assert.equal(getTaskPermissions(manager, { ...assignedTask, reporterId: 'manager-1' }).canManage, true)
  assert.equal(getTaskPermissions(manager, { ...assignedTask, projectManagerId: 'manager-1' }).canManage, true)
  assert.equal(getTaskPermissions({ id: 'admin-1', role: 'admin' }, assignedTask).canManage, true)
})

test('managers only delete tasks they created while admins can delete any task', () => {
  const manager = { id: 'manager-1', role: 'manager' }

  assert.equal(getTaskPermissions(manager, { reporterId: 'manager-1' }).canDelete, true)
  assert.equal(getTaskPermissions(manager, { projectManagerId: 'manager-1', reporterId: 'manager-2' }).canDelete, false)
  assert.equal(getTaskPermissions({ id: 'admin-1', role: 'admin' }, {}).canDelete, true)
})

test('assigned members and collaborators can update progress and attachments', () => {
  const assigned = getTaskPermissions({ id: 'member-1', role: 'member' }, assignedTask)
  const collaborator = getTaskPermissions({ _id: 'member-2', role: 'member' }, assignedTask)

  assert.deepEqual(assigned, {
    canManage: false,
    canDelete: false,
    canUpdateProgress: true,
    canCompleteSubtasks: true,
    canManageAttachments: true,
    isAssignee: true,
    isCollaborator: false,
    isWatcherOnly: false,
  })
  assert.deepEqual(collaborator, {
    canManage: false,
    canDelete: false,
    canUpdateProgress: true,
    canCompleteSubtasks: false,
    canManageAttachments: false,
    isAssignee: false,
    isCollaborator: true,
    isWatcherOnly: false,
  })
})

test('watchers can view and comment but cannot mutate task work', () => {
  assert.deepEqual(getTaskPermissions({ id: 'member-3', role: 'member' }, assignedTask), {
    canManage: false,
    canDelete: false,
    canUpdateProgress: false,
    canCompleteSubtasks: false,
    canManageAttachments: false,
    isAssignee: false,
    isCollaborator: false,
    isWatcherOnly: true,
  })
})

test('task role-permission matrix covers every supported relationship', () => {
  const task = {
    reporterId: 'creator-1',
    projectManagerId: 'project-manager-1',
    assigneeId: 'member-1',
    collaboratorIds: ['collaborator-1'],
    watcherIds: ['watcher-1'],
  }
  const cases = [
    { label: 'member', user: { id: 'ordinary-member-1', role: 'member' }, expected: [false, false, false, false, false, false, false, false] },
    { label: 'watcher', user: { id: 'watcher-1', role: 'member' }, expected: [false, false, false, false, false, false, false, true] },
    { label: 'assignee', user: { id: 'member-1', role: 'member' }, expected: [false, false, true, true, true, true, false, false] },
    { label: 'collaborator', user: { id: 'collaborator-1', role: 'member' }, expected: [false, false, true, false, false, false, true, false] },
    { label: 'task creator', user: { id: 'creator-1', role: 'manager' }, expected: [true, true, false, false, false, false, false, false] },
    { label: 'project manager', user: { id: 'project-manager-1', role: 'manager' }, expected: [true, false, false, false, false, false, false, false] },
    { label: 'unrelated manager', user: { id: 'unrelated-manager-1', role: 'manager' }, expected: [false, false, false, false, false, false, false, false] },
    { label: 'admin', user: { id: 'admin-1', role: 'admin' }, expected: [true, true, false, false, false, false, false, false] },
    { label: 'manager assignee', user: { id: 'member-1', role: 'manager' }, expected: [false, false, true, true, true, true, false, false] },
  ]

  for (const entry of cases) {
    const permissions = getTaskPermissions(entry.user, task)
    assert.deepEqual(
      [
        permissions.canManage,
        permissions.canDelete,
        permissions.canUpdateProgress,
        permissions.canCompleteSubtasks,
        permissions.canManageAttachments,
        permissions.isAssignee,
        permissions.isCollaborator,
        permissions.isWatcherOnly,
      ],
      entry.expected,
      entry.label,
    )
  }
})

test('project and team controls follow record ownership', () => {
  assert.equal(canManageOwnedRecord({ id: 'admin-1', role: 'admin' }, { managerId: 'manager-2' }), true)
  assert.equal(canManageOwnedRecord({ id: 'manager-1', role: 'manager' }, { managerId: 'manager-1' }), true)
  assert.equal(canManageOwnedRecord({ id: 'manager-1', role: 'manager' }, { managerId: 'manager-2' }), false)
  assert.equal(canManageOwnedRecord({ id: 'member-1', role: 'member' }, { managerId: 'member-1' }), false)
})

test('archive excludes members and administration pages exclude non-admins', () => {
  assert.equal(canAccessArchive({ role: 'member' }), false)
  assert.equal(canAccessArchive({ role: 'manager' }), true)
  assert.equal(canAccessArchive({ role: 'admin' }), true)
  assert.equal(canAccessAdminArea({ role: 'manager' }), false)
  assert.equal(canAccessAdminArea({ role: 'admin' }), true)
})

test('archive actions follow ownership and reserve user records for admins', () => {
  const manager = { id: 'manager-1', role: 'manager' }

  assert.deepEqual(getArchiveRecordPermissions(manager, 'projects', { managerId: 'manager-1' }), {
    canRestore: true,
    canDelete: false,
  })
  assert.deepEqual(getArchiveRecordPermissions(manager, 'tasks', { reporterId: 'manager-1' }), {
    canRestore: true,
    canDelete: true,
  })
  assert.deepEqual(getArchiveRecordPermissions(manager, 'users', { id: 'user-1' }), {
    canRestore: false,
    canDelete: false,
  })
  assert.deepEqual(getArchiveRecordPermissions({ id: 'admin-1', role: 'admin' }, 'users', { id: 'user-1' }), {
    canRestore: true,
    canDelete: true,
  })
})

test('comment actions are limited to the author except admin deletion', () => {
  const comment = { author: { _id: 'member-1' } }

  assert.deepEqual(getTaskCommentPermissions({ id: 'member-1', role: 'member' }, comment), {
    canEdit: true,
    canDelete: true,
  })
  assert.deepEqual(getTaskCommentPermissions({ id: 'member-2', role: 'member' }, comment), {
    canEdit: false,
    canDelete: false,
  })
  assert.deepEqual(getTaskCommentPermissions({ id: 'admin-1', role: 'admin' }, comment), {
    canEdit: false,
    canDelete: true,
  })
})
