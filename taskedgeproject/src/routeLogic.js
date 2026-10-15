const routeByNav = {
  'my-day': '/',
  'next-7-days': '/calendar',
  'all-my-tasks': '/tasks',
  'project-board': '/projects',
  teams: '/teams',
  'individual-activities': '/activities',
  notifications: '/notifications',
  archive: '/archive',
  'admin-users': '/admin/users',
  'activity-log': '/admin/activity-log',
  profile: '/profile',
}

const navByRoute = Object.entries(routeByNav).reduce((routes, [nav, path]) => ({
  ...routes,
  [path]: nav,
}), {})

const viewByNav = {
  'my-day': 'dashboard',
  'next-7-days': 'calendar',
  'all-my-tasks': 'tasks',
  'project-board': 'projects',
  teams: 'teams',
  'individual-activities': 'activities',
  notifications: 'notifications',
  archive: 'archive',
  'admin-users': 'admin-users',
  'activity-log': 'activity-log',
  profile: 'profile',
}

export function getPathForNav(navId) {
  return routeByNav[navId] || routeByNav['my-day']
}

export function getRouteState(pathname) {
  const nav = navByRoute[pathname] || 'my-day'
  return {
    activeNav: nav,
    activeView: viewByNav[nav] || 'dashboard',
  }
}
