import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getNotificationMetrics,
  normalizeNotificationFromApi,
} from './notificationLogic.jsx'

test('normalizeNotificationFromApi keeps notification display fields', () => {
  const notification = normalizeNotificationFromApi({
    _id: 'notification-1',
    title: 'Activity submission received',
    message: 'Jason submitted Weekly journal',
    type: 'submission',
    entityType: 'Task',
    entityId: 'task-1',
    isRead: false,
    createdAt: '2026-10-12T08:00:00.000Z',
  })

  assert.deepEqual(notification, {
    id: 'notification-1',
    title: 'Activity submission received',
    message: 'Jason submitted Weekly journal',
    type: 'submission',
    entityType: 'Task',
    entityId: 'task-1',
    isRead: false,
    createdAt: '2026-10-12T08:00:00.000Z',
    raw: {
      _id: 'notification-1',
      title: 'Activity submission received',
      message: 'Jason submitted Weekly journal',
      type: 'submission',
      entityType: 'Task',
      entityId: 'task-1',
      isRead: false,
      createdAt: '2026-10-12T08:00:00.000Z',
    },
  })
})

test('getNotificationMetrics counts unread notifications', () => {
  assert.deepEqual(
    getNotificationMetrics([
      { id: 'one', isRead: false },
      { id: 'two', isRead: true },
      { id: 'three', isRead: false },
    ]),
    {
      total: 3,
      unread: 2,
      read: 1,
    },
  )
})
