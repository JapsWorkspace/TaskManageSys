function getChangedProfileFields(beforeUser, changes) {
  return ['firstName', 'lastName', 'username', 'phone', 'avatarUrl', 'email']
    .filter((field) => changes[field] !== undefined && String(beforeUser[field] || '') !== String(changes[field] || ''))
}

function buildProfileUpdateNotification({ user, changedFields }) {
  if (!changedFields.length) {
    return null
  }

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || user.email || 'A user'
  const fieldList = changedFields
    .map((field) => (field === 'avatarUrl' ? 'profile image' : field.replace(/([A-Z])/g, ' $1').toLowerCase()))
    .join(', ')

  return {
    title: 'Profile updated',
    message: `${displayName} updated ${fieldList}.`,
    type: 'profile',
    entityType: 'User',
    entityId: user._id,
  }
}

module.exports = { buildProfileUpdateNotification, getChangedProfileFields }
