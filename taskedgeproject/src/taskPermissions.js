function entityId(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value._id || value.id || ''
}

export function canCreateTasks(user) {
  return ['admin', 'manager'].includes(user?.role)
}

export function canManageOwnedRecord(user, record) {
  if (user?.role === 'admin') return true
  const userId = entityId(user)
  return user?.role === 'manager' && Boolean(userId) && record?.managerId === userId
}

export function canAccessArchive(user) {
  return ['admin', 'manager'].includes(user?.role)
}

export function canAccessAdminArea(user) {
  return user?.role === 'admin'
}

export function getArchiveRecordPermissions(user, type, record) {
  if (user?.role === 'admin') {
    return { canRestore: true, canDelete: true }
  }

  if (user?.role !== 'manager' || type === 'users') {
    return { canRestore: false, canDelete: false }
  }

  if (type === 'projects' || type === 'teams') {
    return { canRestore: canManageOwnedRecord(user, record), canDelete: false }
  }

  const taskPermissions = getTaskPermissions(user, record)
  return {
    canRestore: taskPermissions.canManage,
    canDelete: taskPermissions.canDelete,
  }
}

export function getTaskPermissions(user, task) {
  const userId = entityId(user)
  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'manager'
  const isReporter = Boolean(userId) && task?.reporterId === userId
  const managesProject = Boolean(userId) && task?.projectManagerId === userId
  const canManage = isAdmin || (isManager && (isReporter || managesProject))
  const isAssignee = Boolean(userId) && task?.assigneeId === userId
  const isCollaborator = Boolean(userId) && task?.collaboratorIds?.includes(userId)
  const isWatcher = Boolean(userId) && task?.watcherIds?.includes(userId)

  return {
    canManage,
    canDelete: isAdmin || (isManager && isReporter),
    canUpdateProgress: isAssignee || isCollaborator,
    canCompleteSubtasks: isAssignee,
    canManageAttachments: isAssignee,
    isAssignee,
    isCollaborator,
    isWatcherOnly: !canManage && isWatcher && !isAssignee && !isCollaborator,
  }
}

export function getTaskCommentPermissions(user, comment) {
  const userId = entityId(user)
  const authorId = entityId(comment?.author) || comment?.authorId || ''
  const isAuthor = Boolean(userId) && userId === authorId

  return {
    canEdit: isAuthor,
    canDelete: isAuthor || user?.role === 'admin',
  }
}
