const test = require('node:test');
const assert = require('node:assert/strict');

const { buildUserAccountUpdateNotifications } = require('./userAccountNotifications');

test('buildUserAccountUpdateNotifications notifies target and admins for role changes', () => {
  const notifications = buildUserAccountUpdateNotifications({
    actor: { firstName: 'TaskEdge', lastName: 'Admin' },
    before: { _id: 'user-1', firstName: 'Justin', lastName: 'Raine', role: 'member' },
    after: { _id: 'user-1', firstName: 'Justin', lastName: 'Raine', role: 'manager' },
    changes: { role: 'manager' },
  });

  assert.deepEqual(notifications, [
    {
      audience: 'target',
      title: 'Role updated',
      message: 'TaskEdge Admin changed your role to manager.',
      type: 'account',
      entityType: 'User',
      entityId: 'user-1',
    },
    {
      audience: 'admins',
      title: 'User role updated',
      message: "TaskEdge Admin changed Justin Raine's role to manager.",
      type: 'admin',
      entityType: 'User',
      entityId: 'user-1',
    },
  ]);
});

test('buildUserAccountUpdateNotifications skips unchanged account updates', () => {
  assert.deepEqual(
    buildUserAccountUpdateNotifications({
      actor: { username: 'admin' },
      before: { _id: 'user-1', role: 'manager', isArchived: false },
      after: { _id: 'user-1', role: 'manager', isArchived: false },
      changes: { role: 'manager' },
    }),
    [],
  );
});
