export function normalizeNotificationFromApi(notification) {
  return {
    id: notification._id || notification.id || '',
    title: notification.title || 'Notification',
    message: notification.message || '',
    type: notification.type || 'system',
    entityType: notification.entityType || '',
    entityId: notification.entityId || '',
    isRead: notification.isRead === true,
    createdAt: notification.createdAt || '',
    raw: notification,
  }
}

export function getNotificationMetrics(notifications) {
  const unread = notifications.filter((notification) => !notification.isRead).length

  return {
    total: notifications.length,
    unread,
    read: notifications.length - unread,
  }
}
