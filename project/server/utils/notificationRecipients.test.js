const test = require('node:test');
const assert = require('node:assert/strict');

const {
  collectProjectRecipients,
  collectTaskRecipients,
  collectTeamRecipients,
} = require('./notificationRecipients');

test('collectTaskRecipients dedupes task participants and excludes the actor', () => {
  assert.deepEqual(
    collectTaskRecipients({
      assignee: { _id: 'user-1' },
      reporter: 'user-2',
      collaborators: ['user-1', 'user-3'],
      watchers: [{ id: 'user-4' }, 'user-2'],
    }, { exclude: 'user-2' }),
    ['user-1', 'user-3', 'user-4'],
  );
});

test('collectProjectRecipients includes manager and members once', () => {
  assert.deepEqual(
    collectProjectRecipients({
      manager: { _id: 'manager-1' },
      members: ['member-1', { _id: 'member-2' }, 'manager-1'],
    }),
    ['manager-1', 'member-1', 'member-2'],
  );
});

test('collectTeamRecipients handles empty members and actor exclusion', () => {
  assert.deepEqual(
    collectTeamRecipients({
      manager: 'manager-1',
      members: ['member-1', 'manager-1'],
    }, { exclude: 'manager-1' }),
    ['member-1'],
  );
});
