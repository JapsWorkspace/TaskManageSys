import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildProjectPayload,
  getEligibleProjectPeople,
  getFilteredProjectTasks,
  getProjectProgress,
  getProjectStatusBuckets,
  getTaskCreationProject,
  normalizeProjectFromApi,
} from './projectLogic.js'

test('getEligibleProjectPeople returns only unique project members and the manager', () => {
  const users = [
    { _id: 'manager-1', username: 'manager' },
    { _id: 'member-1', username: 'member' },
    { _id: 'outsider-1', username: 'outsider' },
  ]

  assert.deepEqual(
    getEligibleProjectPeople({ managerId: 'manager-1', memberIds: ['member-1', 'manager-1'] }, users),
    users.slice(0, 2),
  )
  assert.deepEqual(getEligibleProjectPeople(null, users), [])
})

test('normalizeProjectFromApi keeps project manager and members display data', () => {
  assert.deepEqual(
    normalizeProjectFromApi({
      _id: 'project-1',
      name: 'Capstone',
      description: 'Final project work.',
      status: 'active',
      priority: 'urgent',
      manager: { _id: 'user-1', firstName: 'Jason', lastName: 'Raine' },
      members: [{ _id: 'user-2', firstName: 'Mika', lastName: 'Tan' }],
    }),
    {
      id: 'project-1',
      name: 'Capstone',
      description: 'Final project work.',
      status: 'active',
      priority: 'urgent',
      managerId: 'user-1',
      managerName: 'Jason Raine',
      memberIds: ['user-2'],
      members: [{ id: 'user-2', name: 'Mika Tan' }],
      raw: {
        _id: 'project-1',
        name: 'Capstone',
        description: 'Final project work.',
        status: 'active',
        priority: 'urgent',
        manager: { _id: 'user-1', firstName: 'Jason', lastName: 'Raine' },
        members: [{ _id: 'user-2', firstName: 'Mika', lastName: 'Tan' }],
      },
    },
  )
})

test('getProjectProgress counts completed tasks for a project', () => {
  assert.deepEqual(
    getProjectProgress('project-1', [
      { projectId: 'project-1', status: 'Completed' },
      { projectId: 'project-1', status: 'Todo' },
      { projectId: 'project-2', status: 'Completed' },
    ]),
    {
      total: 2,
      completed: 1,
      percent: 50,
    },
  )
})

test('getProjectStatusBuckets groups tasks in project board order', () => {
  assert.deepEqual(
    getProjectStatusBuckets([
      { id: 'task-1', status: 'Completed' },
      { id: 'task-2', status: 'Todo' },
      { id: 'task-3', status: 'For Review' },
      { id: 'task-4', status: 'Blocked' },
    ]),
    [
      { status: 'Todo', tasks: [{ id: 'task-2', status: 'Todo' }] },
      { status: 'In Progress', tasks: [] },
      { status: 'For Review', tasks: [{ id: 'task-3', status: 'For Review' }] },
      { status: 'Completed', tasks: [{ id: 'task-1', status: 'Completed' }] },
      { status: 'Returned', tasks: [] },
    ],
  )
})

test('getFilteredProjectTasks searches task copy and applies member and priority filters', () => {
  const tasks = [
    { id: 'task-1', title: 'Build dashboard', description: 'Analytics UI', assigneeId: 'user-1', owner: 'Maya Chen', priority: 'High' },
    { id: 'task-2', title: 'Write API tests', description: 'Backend coverage', assigneeId: 'user-2', owner: 'Noah Williams', priority: 'Medium' },
  ]

  assert.deepEqual(getFilteredProjectTasks(tasks, { search: 'maya' }), [tasks[0]])
  assert.deepEqual(getFilteredProjectTasks(tasks, { memberId: 'user-2', priority: 'Medium' }), [tasks[1]])
  assert.deepEqual(getFilteredProjectTasks(tasks, { search: 'missing' }), [])
})

test('getTaskCreationProject prefers the open project and falls back to the first project', () => {
  const projects = [{ id: 'project-1' }, { id: 'project-2' }]

  assert.equal(getTaskCreationProject(projects, 'project-2'), projects[1])
  assert.equal(getTaskCreationProject(projects, 'missing'), projects[0])
  assert.equal(getTaskCreationProject([], 'project-2'), undefined)
})

test('buildProjectPayload converts form values into backend project fields', () => {
  assert.deepEqual(
    buildProjectPayload({
      name: 'Capstone',
      description: 'Shared work',
      status: 'active',
      priority: 'high',
      managerId: 'user-1',
      memberIds: ['user-2', 'user-3'],
    }),
    {
      name: 'Capstone',
      description: 'Shared work',
      status: 'active',
      priority: 'high',
      manager: 'user-1',
      members: ['user-2', 'user-3'],
    },
  )
})
