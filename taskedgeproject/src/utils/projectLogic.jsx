function entityId(value) {
  if (!value) return ''
  return typeof value === 'string' ? value : value._id || value.id || ''
}

function personName(value, fallback = 'Unassigned') {
  if (!value) return fallback
  if (typeof value === 'string') return value
  return [value.firstName, value.lastName].filter(Boolean).join(' ').trim()
    || value.username
    || value.email
    || fallback
}

export const PROJECT_STATUSES = ['planning', 'active', 'on-hold', 'completed']
export const PROJECT_PRIORITIES = ['low', 'medium', 'high', 'urgent']
export const PROJECT_TASK_STATUSES = ['Todo', 'In Progress', 'For Review', 'Completed', 'Returned']

export function getEligibleProjectPeople(project, users = []) {
  if (!project) return []
  const allowedIds = new Set([project.managerId, ...(project.memberIds || [])].filter(Boolean))
  return users.filter((person) => person.role !== 'admin' && allowedIds.has(entityId(person)))
}

export function normalizeProjectFromApi(project) {
  const managerId = entityId(project.manager)
  const members = (Array.isArray(project.members) ? project.members : [])
    .filter((member) => member.role !== 'admin' && entityId(member) !== managerId)

  return {
    id: project._id || project.id || '',
    name: project.name || 'Project',
    description: project.description || '',
    status: project.status || 'planning',
    priority: project.priority || 'medium',
    managerId,
    managerName: personName(project.manager, 'No manager'),
    managerAvatarUrl: typeof project.manager === 'object' ? project.manager.avatarUrl || '' : '',
    memberIds: members.map(entityId).filter(Boolean),
    members: members.map((member) => ({
      id: entityId(member),
      name: personName(member, 'Team member'),
      avatarUrl: member.avatarUrl || '',
    })),
    raw: project,
  }
}

export function getProjectProgress(projectId, tasks) {
  const projectTasks = tasks.filter((task) => task.projectId === projectId)
  const completed = projectTasks.filter((task) => ['Completed', 'Done'].includes(task.status)).length

  return {
    total: projectTasks.length,
    completed,
    percent: projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0,
  }
}

export function getProjectStatusBuckets(tasks) {
  return PROJECT_TASK_STATUSES.map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status),
  }))
}

export function getFilteredProjectTasks(tasks, { search = '', memberId = 'all', priority = 'all' } = {}) {
  const query = search.trim().toLowerCase()

  return tasks.filter((task) => {
    const matchesSearch = !query || [task.title, task.description, task.owner, task.category]
      .some((value) => String(value || '').toLowerCase().includes(query))
    const matchesMember = memberId === 'all' || task.assigneeId === memberId
    const matchesPriority = priority === 'all' || task.priority === priority

    return matchesSearch && matchesMember && matchesPriority
  })
}

export function getTaskCreationProject(projects, preferredProjectId = '') {
  return projects.find((project) => project.id === preferredProjectId) || projects[0]
}

export function buildProjectPayload(values) {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    status: values.status,
    priority: values.priority,
    manager: values.managerId || undefined,
    members: values.memberIds || [],
  }
}
