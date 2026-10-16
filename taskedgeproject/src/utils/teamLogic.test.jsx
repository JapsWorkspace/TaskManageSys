import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildTeamPayload,
  getTeamMetrics,
  normalizeTeamFromApi,
} from './teamLogic.jsx'

test('normalizeTeamFromApi keeps manager and member display data', () => {
  const team = normalizeTeamFromApi({
    _id: 'team-1',
    name: 'Design Team',
    description: 'Owns product screens.',
    isArchived: true,
    manager: { _id: 'user-1', firstName: 'Mika', lastName: 'Tan' },
    members: [
      { _id: 'user-2', firstName: 'Jason', lastName: 'Raine' },
      { _id: 'user-3', username: 'alex' },
    ],
  })

  assert.deepEqual(team, {
    id: 'team-1',
    name: 'Design Team',
    description: 'Owns product screens.',
    isArchived: true,
    managerId: 'user-1',
    managerName: 'Mika Tan',
    memberIds: ['user-2', 'user-3'],
    members: [
      { id: 'user-2', name: 'Jason Raine' },
      { id: 'user-3', name: 'alex' },
    ],
    raw: {
      _id: 'team-1',
      name: 'Design Team',
      description: 'Owns product screens.',
      isArchived: true,
      manager: { _id: 'user-1', firstName: 'Mika', lastName: 'Tan' },
      members: [
        { _id: 'user-2', firstName: 'Jason', lastName: 'Raine' },
        { _id: 'user-3', username: 'alex' },
      ],
    },
  })
})

test('buildTeamPayload trims team fields and sends selected people', () => {
  assert.deepEqual(
    buildTeamPayload({
      name: '  Backend Team ',
      description: '  Handles APIs. ',
      managerId: 'user-1',
      memberIds: ['user-2', 'user-3'],
    }),
    {
      name: 'Backend Team',
      description: 'Handles APIs.',
      manager: 'user-1',
      members: ['user-2', 'user-3'],
    },
  )
})

test('getTeamMetrics counts teams members and managers', () => {
  const metrics = getTeamMetrics([
    { id: 'team-1', managerId: 'user-1', memberIds: ['user-1', 'user-2'] },
    { id: 'team-2', managerId: 'user-3', memberIds: ['user-2', 'user-4'] },
  ])

  assert.deepEqual(metrics, {
    totalTeams: 2,
    totalMembers: 3,
    totalManagers: 2,
  })
})
