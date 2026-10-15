const SIDEBAR_ICON_NAMES = Object.freeze({
  'my-day': 'House',
  'next-7-days': 'CalendarDays',
  'all-my-tasks': 'List',
  'project-board': 'Folder',
  teams: 'Users',
  'individual-activities': 'ClipboardCheck',
  notifications: 'Bell',
  archive: 'Archive',
  'admin-users': 'ShieldCheck',
  'activity-log': 'History',
})

export function getSidebarIconName(itemId) {
  return SIDEBAR_ICON_NAMES[itemId] || null
}
