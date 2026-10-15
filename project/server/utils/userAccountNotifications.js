function displayName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
    || user?.username
    || user?.email
    || 'A user'
}

function buildUserAccountUpdateNotifications({ actor, before, after, changes }) {
  const notifications = []
  const actorName = displayName(actor)
  const userName = displayName(after)
  const entityId = after?._id || after?.id

  if (changes.role && before?.role !== after?.role) {
    notifications.push({
      audience: 'target',
      title: 'Role updated',
      message: `${actorName} changed your role to ${after.role}.`,
      type: 'account',
      entityType: 'User',
      entityId,
    })
    notifications.push({
      audience: 'admins',
      title: 'User role updated',
      message: `${actorName} changed ${userName}'s role to ${after.role}.`,
      type: 'admin',
      entityType: 'User',
      entityId,
    })
  }

  if (Object.hasOwn(changes, 'isArchived') && before?.isArchived !== after?.isArchived) {
    const state = after.isArchived ? 'archived' : 'restored'
    notifications.push({
      audience: 'target',
      title: `Account ${state}`,
      message: `${actorName} ${state} your account.`,
      type: 'account',
      entityType: 'User',
      entityId,
    })
    notifications.push({
      audience: 'admins',
      title: `User account ${state}`,
      message: `${actorName} ${state} ${userName}'s account.`,
      type: 'admin',
      entityType: 'User',
      entityId,
    })
  }

  return notifications
}

module.exports = { buildUserAccountUpdateNotifications }
