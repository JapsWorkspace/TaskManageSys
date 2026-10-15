export function getUserDisplayName(user, fallback = 'User') {
  if (!user) {
    return fallback
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return user.username || fullName || user.email || fallback
}
