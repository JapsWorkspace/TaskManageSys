const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildProfileUpdateNotification,
  getChangedProfileFields,
} = require('./profileNotifications');

test('getChangedProfileFields returns only edited profile fields', () => {
  const before = {
    firstName: 'Justin',
    lastName: 'Raine',
    username: 'try',
    phone: '09123451234',
    avatarUrl: '',
    email: 'justin@gmail.com',
  };

  assert.deepEqual(
    getChangedProfileFields(before, {
      firstName: 'Justin',
      username: 'justinr',
      phone: '09123451234',
      avatarUrl: 'data:image/png;base64,abc',
      role: 'admin',
    }),
    ['username', 'avatarUrl'],
  );
});

test('buildProfileUpdateNotification describes changed fields', () => {
  const notification = buildProfileUpdateNotification({
    user: {
      _id: 'user-1',
      firstName: 'Justin',
      lastName: 'Raine',
      username: 'justinr',
      email: 'justin@gmail.com',
    },
    changedFields: ['username', 'avatarUrl'],
  });

  assert.deepEqual(notification, {
    title: 'Profile updated',
    message: 'Justin Raine updated username, profile image.',
    type: 'profile',
    entityType: 'User',
    entityId: 'user-1',
  });
});

test('buildProfileUpdateNotification skips unchanged updates', () => {
  assert.equal(
    buildProfileUpdateNotification({
      user: { firstName: 'Justin' },
      changedFields: [],
    }),
    null,
  );
});
