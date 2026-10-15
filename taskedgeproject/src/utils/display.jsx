

export function formatDate(value) {
  if (!value) {
    return 'No date'
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function formatNotificationDate(value) {
  if (!value) {
    return 'No date'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'No date'
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function getAttachmentId(attachment) {
  return attachment?._id || attachment?.id || ''
}

export function formatActivityStatus(value) {
  return String(value || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getLocalDateKey(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getCommentAuthor(author) {
  return [author.firstName, author.lastName].filter(Boolean).join(' ').trim() || author.username || author.email || 'Team member'
}

export function getUserId(user) {
  return user?._id || user?.id || ''
}

export function getTimeInputValue(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function getInitials(user) {
  const first = user.firstName?.[0] || 'T'
  const last = user.lastName?.[0] || ''
  return `${first}${last}`.toUpperCase()
}

export function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) return 'Good Morning'
  if (hour < 18) return 'Good Afternoon'
  return 'Good Evening'
}
