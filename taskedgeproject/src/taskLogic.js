export const STATUSES = ['Todo', 'In Progress', 'For Review', 'Completed', 'Returned']

export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

const API_STATUS_TO_UI = {
  todo: 'Todo',
  'in-progress': 'In Progress',
  'for-review': 'For Review',
  completed: 'Completed',
  returned: 'Returned',
}

const UI_STATUS_TO_API = {
  Todo: 'todo',
  'In Progress': 'in-progress',
  Review: 'for-review',
  'For Review': 'for-review',
  Done: 'completed',
  Completed: 'completed',
  Returned: 'returned',
}

const API_PRIORITY_TO_UI = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

const UI_PRIORITY_TO_API = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Urgent: 'urgent',
}

export const initialTasks = [
  {
    id: 'task-101',
    title: 'Finalize project context',
    description: 'Write the Chapter 1 purpose, objectives, scope, and delimitation.',
    status: 'In Progress',
    priority: 'High',
    dueDate: '2026-10-09',
    owner: 'Jason',
  },
  {
    id: 'task-102',
    title: 'Design task dashboard',
    description: 'Prepare summary widgets for active, done, and urgent work.',
    status: 'For Review',
    priority: 'Medium',
    dueDate: '2026-10-10',
    owner: 'Mika',
  },
  {
    id: 'task-103',
    title: 'Connect auth API',
    description: 'Wire login and registration screens to the Express backend.',
    status: 'Todo',
    priority: 'Urgent',
    dueDate: '2026-10-11',
    owner: 'Frontend Team',
  },
  {
    id: 'task-104',
    title: 'Prepare validation messages',
    description: 'Add clear form feedback for required fields and failed requests.',
    status: 'Todo',
    priority: 'High',
    dueDate: '2026-10-13',
    owner: 'Jason',
  },
  {
    id: 'task-105',
    title: 'Review responsive layout',
    description: 'Check desktop, tablet, and mobile browser layouts.',
    status: 'In Progress',
    priority: 'Medium',
    dueDate: '2026-10-14',
    owner: 'QA',
  },
  {
    id: 'task-106',
    title: 'Collect source screenshots',
    description: 'Capture system screens for the project documentation.',
    status: 'Completed',
    priority: 'Low',
    dueDate: '2026-10-07',
    owner: 'Documentation',
  },
]

function personName(value, fallback = 'Unassigned') {
  if (!value) {
    return fallback
  }

  if (typeof value === 'string') {
    return value
  }

  const name = [value.firstName, value.lastName].filter(Boolean).join(' ').trim()
  return name || value.username || value.email || fallback
}

function entityId(value) {
  if (!value) {
    return ''
  }

  return typeof value === 'string' ? value : value._id || value.id || ''
}

function normalizeIdList(values = []) {
  if (!Array.isArray(values)) {
    return []
  }

  return values.map(entityId).filter(Boolean)
}

function normalizePersonList(values = []) {
  if (!Array.isArray(values)) {
    return []
  }

  return values
    .map((value) => ({
      id: entityId(value),
      name: personName(value, ''),
    }))
    .filter((value) => value.id)
}

function normalizeDependencyList(values = []) {
  if (!Array.isArray(values)) {
    return []
  }

  return values
    .map((value) => ({
      id: entityId(value),
      title: typeof value === 'object' && value ? value.title || 'Task' : 'Task',
      status: typeof value === 'object' && value ? value.status || 'todo' : 'todo',
    }))
    .filter((value) => value.id)
}

function normalizeRecurrence(value = {}) {
  return {
    frequency: value.frequency || 'none',
    interval: Number(value.interval) || 1,
    count: Number(value.count) || 1,
  }
}

function formatDateOnly(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function formatLocalDateKey(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value || '').slice(0, 10)
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addLocalDays(value, amount) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + amount)
  return date
}

function formatTime(value) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value)
}

function isSameLocalDay(value, reference) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return false
  }

  return date.getFullYear() === reference.getFullYear()
    && date.getMonth() === reference.getMonth()
    && date.getDate() === reference.getDate()
}

function isCompleted(task) {
  return ['Completed', 'Done'].includes(task.status)
}

function priorityScore(priority) {
  return {
    Urgent: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  }[priority] || 0
}

function formatQueueDateLabel(value) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(value)
}

function attachmentId(attachment) {
  return attachment?._id || attachment?.id || ''
}

function attachmentUrl(attachment, baseUrl = '') {
  const url = attachment?.url || ''

  if (!url || url.startsWith('http') || url.startsWith('data:')) {
    return url
  }

  return `${baseUrl.replace('/api', '')}${url}`
}

function attachmentTypeLabel(attachment) {
  const source = attachment?.mimeType || attachment?.name || ''
  const normalized = source.toLowerCase()

  if (normalized.includes('pdf') || normalized.endsWith('.pdf')) {
    return 'PDF'
  }

  if (normalized.includes('image') || /\.(png|jpe?g|gif|webp)$/i.test(source)) {
    return 'Image'
  }

  if (normalized.includes('spreadsheet') || /\.(xlsx?|csv)$/i.test(source)) {
    return 'Sheet'
  }

  if (normalized.includes('word') || /\.(docx?|rtf)$/i.test(source)) {
    return 'Doc'
  }

  return 'File'
}

function attachmentSizeLabel(value) {
  const size = Number(value)

  if (!Number.isFinite(size) || size <= 0) {
    return 'File'
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function apiStatusToUi(value = 'todo') {
  return API_STATUS_TO_UI[value] || 'Todo'
}

export function uiStatusToApi(value = 'Todo') {
  return UI_STATUS_TO_API[value] || 'todo'
}

export function apiPriorityToUi(value = 'medium') {
  return API_PRIORITY_TO_UI[value] || 'Medium'
}

export function uiPriorityToApi(value = 'Medium') {
  return UI_PRIORITY_TO_API[value] || 'medium'
}

export function addSubtaskToList(subtasks = [], title = '') {
  const nextTitle = title.trim()

  if (!nextTitle) {
    return subtasks
  }

  return [...subtasks, { title: nextTitle, completed: false }]
}

export function toggleSubtaskInList(subtasks = [], index) {
  return subtasks.map((subtask, currentIndex) =>
    currentIndex === index ? { ...subtask, completed: !subtask.completed } : subtask,
  )
}

export function removeSubtaskFromList(subtasks = [], index) {
  return subtasks.filter((_, currentIndex) => currentIndex !== index)
}

export function normalizeTaskFromApi(task) {
  const project = task.project
  const assignee = task.assignee
  const collaborators = normalizePersonList(task.collaborators)
  const watchers = normalizePersonList(task.watchers)
  const dependencies = normalizeDependencyList(task.dependencies)

  return {
    id: task._id || task.id || '',
    title: task.title || '',
    description: task.description || '',
    status: apiStatusToUi(task.status),
    priority: apiPriorityToUi(task.priority),
    type: task.type || 'standard',
    progress: Number.isFinite(Number(task.progress)) ? Number(task.progress) : 0,
    startDate: task.startDate || '',
    dueDate: formatDateOnly(task.deadline || task.dueDate),
    dueAt: task.deadline || task.dueAt || task.dueDate || '',
    activitySettings: task.activitySettings || {},
    activityStatus: task.myAssignmentStatus || task.activityStatus || '',
    projectId: entityId(project),
    projectManagerId: entityId(typeof project === 'object' ? project?.manager : ''),
    project: typeof project === 'object' && project ? project.name || 'Project' : 'Project',
    assigneeId: entityId(assignee),
    owner: personName(assignee),
    reporterId: entityId(task.reporter),
    reporter: personName(task.reporter, ''),
    collaborators,
    collaboratorIds: collaborators.map((person) => person.id),
    watchers,
    watcherIds: watchers.map((person) => person.id),
    dependencies,
    dependencyIds: dependencies.map((dependency) => dependency.id),
    category: task.category || '',
    tags: Array.isArray(task.tags) ? task.tags : [],
    recurrence: normalizeRecurrence(task.recurrence),
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    attachments: Array.isArray(task.attachments) ? task.attachments : [],
    raw: task,
  }
}

export function getTaskAttachmentDisplay(attachment, baseUrl = '') {
  const id = attachmentId(attachment)
  const url = attachmentUrl(attachment, baseUrl)

  return {
    id,
    name: attachment?.name || 'Attachment',
    typeLabel: attachmentTypeLabel(attachment),
    sizeLabel: attachmentSizeLabel(attachment?.size),
    url,
    canOpen: Boolean(url),
    canRemove: Boolean(id),
  }
}

export function getRecurrenceSummary(frequency = 'none', interval = 1, count = 1) {
  if (frequency === 'none') return 'Choose a repeat pattern to schedule recurring tasks.'

  const safeInterval = Math.max(Number(interval) || 1, 1)
  const safeCount = Math.max(Number(count) || 1, 1)
  const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[frequency] || 'period'
  const cadence = safeInterval === 1 ? `every ${unit}` : `every ${safeInterval} ${unit}s`
  return `Creates ${safeCount} ${safeCount === 1 ? 'occurrence' : 'occurrences'}, ${cadence}.`
}

export function buildTaskPayload(values) {
  const deadline = values.dueTime ? `${values.dueDate}T${values.dueTime}` : values.dueDate
  const frequency = values.recurrenceFrequency || values.recurrence?.frequency || 'none'
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    status: uiStatusToApi(values.status),
    priority: uiPriorityToApi(values.priority),
    startDate: values.startDate || undefined,
    deadline,
    project: values.projectId,
    assignee: values.assigneeId || undefined,
    collaborators: normalizeIdList(values.collaboratorIds || values.collaborators),
    watchers: normalizeIdList(values.watcherIds || values.watchers),
    dependencies: normalizeIdList(values.dependencyIds || values.dependencies),
    tags: typeof values.tags === 'string'
      ? values.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : values.tags || [],
    category: values.category?.trim() || '',
    subtasks: Array.isArray(values.subtasks) ? values.subtasks : [],
    recurrence: {
      frequency,
      interval: Number(values.recurrenceInterval || values.recurrence?.interval) || 1,
      count: Number(values.recurrenceCount || values.recurrence?.count) || 1,
    },
  }

}

function joinNames(values = []) {
  return values.map((value) => value.name).filter(Boolean).join(', ')
}

export function getTaskDetailFacts(task) {
  const recurrence = normalizeRecurrence(task.recurrence)
  const facts = [
    task.startDate ? { label: 'Start date', value: formatDateOnly(task.startDate) } : null,
    task.category ? { label: 'Category', value: task.category } : null,
    task.tags?.length ? { label: 'Tags', value: task.tags.join(', ') } : null,
    task.collaborators?.length ? { label: 'Collaborators', value: joinNames(task.collaborators) } : null,
    task.watchers?.length ? { label: 'Watchers', value: joinNames(task.watchers) } : null,
    recurrence.frequency !== 'none'
      ? {
        label: 'Recurrence',
        value: `Every ${recurrence.interval} ${recurrence.frequency} (${recurrence.count} occurrences)`,
      }
      : null,
  ]

  return facts.filter(Boolean)
}

export function getAgendaTasks(tasks, { now = new Date(), limit = 3 } = {}) {
  const currentTime = now.getTime()

  return tasks
    .filter((task) => !isCompleted(task))
    .map((task) => {
      const due = new Date(task.dueAt || task.dueDate)
      const dueTime = due.getTime()
      const hasValidDueTime = !Number.isNaN(dueTime)
      const isOverdue = hasValidDueTime && dueTime < currentTime

      return {
        ...task,
        isOverdue,
        dueTime: hasValidDueTime ? dueTime : Number.POSITIVE_INFINITY,
        label: isOverdue
          ? 'Overdue'
          : `${hasValidDueTime ? formatTime(due) : 'No time'} ${task.title}`,
      }
    })
    .sort((left, right) => {
      if (left.isOverdue !== right.isOverdue) {
        return left.isOverdue ? -1 : 1
      }

      return left.dueTime - right.dueTime
    })
    .slice(0, limit)
}

export function getMyDayMetrics(tasks, { now = new Date() } = {}) {
  const currentTime = now.getTime()

  return {
    active: tasks.filter((task) => !isCompleted(task)).length,
    completedToday: tasks.filter((task) => isCompleted(task) && isSameLocalDay(task.updatedAt || task.dueAt || task.dueDate, now)).length,
    overdue: tasks.filter((task) => {
      const due = new Date(task.dueAt || task.dueDate).getTime()
      return !isCompleted(task) && !Number.isNaN(due) && due < currentTime
    }).length,
    dueToday: tasks.filter((task) => !isCompleted(task) && isSameLocalDay(task.dueAt || task.dueDate, now)).length,
    inProgress: tasks.filter((task) => task.status === 'In Progress').length,
    review: tasks.filter((task) => task.status === 'Review' || task.status === 'For Review').length,
  }
}

export function getRecentTasks(tasks, { limit = 5, includeCompleted = false } = {}) {
  return [...tasks]
    .filter((task) => includeCompleted || !isCompleted(task))
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.dueAt || left.dueDate || 0).getTime()
      const rightTime = new Date(right.updatedAt || right.dueAt || right.dueDate || 0).getTime()

      return rightTime - leftTime
    })
    .slice(0, limit)
}

export function getUpcomingDeadlineTasks(tasks, { now = new Date(), limit = 3 } = {}) {
  const currentTime = now.getTime()

  return [...tasks]
    .filter((task) => {
      if (isCompleted(task)) return false

      const dueTime = new Date(task.dueAt || task.dueDate).getTime()
      return !Number.isNaN(dueTime) && dueTime >= currentTime
    })
    .sort((left, right) => {
      const leftTime = new Date(left.dueAt || left.dueDate).getTime()
      const rightTime = new Date(right.dueAt || right.dueDate).getTime()

      return leftTime - rightTime
    })
    .slice(0, limit)
}

export function getTaskQueueGroups(tasks, { now = new Date(), limit = 40 } = {}) {
  const currentTime = now.getTime()
  const todayKey = formatLocalDateKey(now)
  const tomorrowKey = formatLocalDateKey(addLocalDays(now, 1))

  const queueItems = [...tasks]
    .filter((task) => !isCompleted(task))
    .map((task) => {
      const due = new Date(task.dueAt || task.dueDate)
      const dueTime = due.getTime()
      const hasValidDueTime = !Number.isNaN(dueTime)
      const dateKey = hasValidDueTime ? formatLocalDateKey(due) : 'no-date'
      const isOverdue = hasValidDueTime && dueTime < currentTime

      return {
        ...task,
        queueDateKey: dateKey,
        queueDateLabel: hasValidDueTime ? formatQueueDateLabel(due) : 'No date',
        queueDateNote: dateKey === todayKey ? 'Today' : dateKey === tomorrowKey ? 'Tomorrow' : '',
        queueDueTime: hasValidDueTime ? dueTime : Number.POSITIVE_INFINITY,
        queueTimeLabel: hasValidDueTime ? formatTime(due) : 'Anytime',
        isOverdue,
      }
    })
    .sort((left, right) => {
      if (left.queueDateKey !== right.queueDateKey) {
        return left.queueDueTime - right.queueDueTime
      }

      if (left.isOverdue !== right.isOverdue) {
        return left.isOverdue ? -1 : 1
      }

      const priorityDifference = priorityScore(right.priority) - priorityScore(left.priority)

      if (priorityDifference !== 0) {
        return priorityDifference
      }

      if (left.queueDueTime !== right.queueDueTime) {
        return left.queueDueTime - right.queueDueTime
      }

      return String(left.title || '').localeCompare(String(right.title || ''))
    })
    .slice(0, limit)

  return queueItems.reduce((groups, task) => {
    const currentGroup = groups.at(-1)

    if (!currentGroup || currentGroup.dateKey !== task.queueDateKey) {
      groups.push({
        dateKey: task.queueDateKey,
        label: task.queueDateLabel,
        note: task.queueDateNote,
        tasks: [task],
      })
      return groups
    }

    currentGroup.tasks.push(task)
    return groups
  }, [])
}

export function getTasksForDate(tasks, dateKey) {
  return tasks
    .filter((task) => formatLocalDateKey(task.dueAt || task.dueDate) === dateKey)
    .sort((left, right) => {
      const leftTime = new Date(left.dueAt || left.dueDate || 0).getTime()
      const rightTime = new Date(right.dueAt || right.dueDate || 0).getTime()

      return leftTime - rightTime
    })
}

export function getCalendarDays(tasks, { now = new Date(), days = 7 } = {}) {
  const todayKey = formatLocalDateKey(now)

  return Array.from({ length: days }, (_, index) => {
    const date = addLocalDays(now, index)
    const dateKey = formatLocalDateKey(date)

    return {
      date,
      dateKey,
      isToday: dateKey === todayKey,
      tasks: getTasksForDate(tasks, dateKey),
    }
  })
}

export function getCalendarMonthDays(tasks, { selectedDate = new Date(), now = new Date() } = {}) {
  const selected = new Date(selectedDate)
  const safeSelected = Number.isNaN(selected.getTime()) ? new Date() : selected
  const firstDay = new Date(safeSelected.getFullYear(), safeSelected.getMonth(), 1)
  const daysInMonth = new Date(safeSelected.getFullYear(), safeSelected.getMonth() + 1, 0).getDate()
  const leadingBlanks = firstDay.getDay()
  const selectedKey = formatLocalDateKey(safeSelected)
  const todayKey = formatLocalDateKey(now)

  return [
    ...Array.from({ length: leadingBlanks }, (_, index) => ({
      isBlank: true,
      key: `blank-${index}`,
    })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(safeSelected.getFullYear(), safeSelected.getMonth(), index + 1)
      const dateKey = formatLocalDateKey(date)

      return {
        date,
        dateKey,
        dayNumber: index + 1,
        isToday: dateKey === todayKey,
        isSelected: dateKey === selectedKey,
        tasks: getTasksForDate(tasks, dateKey),
      }
    }),
  ]
}

export function getVisibleTasks(
  tasks,
  {
    query = '',
    status = 'All',
    priority = 'All',
    due = 'all',
    scope = 'all',
    currentUserId = '',
    sort = 'deadline',
    now = new Date(),
  },
) {
  const normalizedQuery = query.trim().toLowerCase()
  const currentTime = now.getTime()

  const priorityRank = new Map(PRIORITIES.map((value, index) => [value, index]))

  return tasks.filter((task) => {
    const matchesStatus = status === 'All' || task.status === status
    const matchesPriority = priority === 'All' || task.priority === priority
    const dueTime = new Date(task.dueAt || task.dueDate).getTime()
    const isOverdue = !isCompleted(task) && !Number.isNaN(dueTime) && dueTime < currentTime
    const matchesDue = due !== 'overdue' || isOverdue
    const matchesScope = scope === 'all'
      || (scope === 'assigned-to-me' && task.assigneeId === currentUserId)
      || (scope === 'created-by-me' && task.reporterId === currentUserId)
      || (scope === 'watching' && task.watcherIds?.includes(currentUserId))
    const searchableText = [
      task.title,
      task.description,
      task.owner,
      task.project,
      task.priority,
      task.status,
    ]
      .join(' ')
      .toLowerCase()

    return matchesStatus
      && matchesPriority
      && matchesDue
      && matchesScope
      && (!normalizedQuery || searchableText.includes(normalizedQuery))
  }).sort((left, right) => {
    if (sort === 'title') {
      return left.title.localeCompare(right.title)
    }

    if (sort === 'priority') {
      return (priorityRank.get(right.priority) ?? 0) - (priorityRank.get(left.priority) ?? 0)
    }

    return new Date(left.dueDate || 0) - new Date(right.dueDate || 0)
  })
}

export function getTaskMetrics(tasks) {
  return {
    total: tasks.length,
    todo: tasks.filter((task) => task.status === 'Todo').length,
    inProgress: tasks.filter((task) => task.status === 'In Progress').length,
    review: tasks.filter((task) => task.status === 'Review' || task.status === 'For Review').length,
    done: tasks.filter((task) => task.status === 'Done' || task.status === 'Completed').length,
    urgent: tasks.filter((task) => task.priority === 'Urgent').length,
  }
}

export function getTaskStatusBreakdown(tasks) {
  const total = tasks.length
  const groups = [
    { label: 'Todo', statuses: ['Todo'], tone: 'neutral' },
    { label: 'In Progress', statuses: ['In Progress'], tone: 'blue' },
    { label: 'For Review', statuses: ['For Review', 'Review'], tone: 'amber' },
    { label: 'Completed', statuses: ['Completed', 'Done'], tone: 'green' },
    { label: 'Returned', statuses: ['Returned'], tone: 'red' },
  ]

  return groups.map((group) => {
    const count = tasks.filter((task) => group.statuses.includes(task.status)).length

    return {
      label: group.label,
      count,
      percent: total ? Math.round((count / total) * 100) : 0,
      tone: group.tone,
    }
  })
}

export function getTaskPriorityBreakdown(tasks, { now = new Date() } = {}) {
  const currentTime = now.getTime()
  const activeTasks = tasks.filter((task) => !isCompleted(task))
  const groups = [
    { label: 'Urgent', tone: 'red' },
    { label: 'High', tone: 'amber' },
    { label: 'Medium', tone: 'blue' },
    { label: 'Low', tone: 'neutral' },
  ]

  const priorityItems = groups.map((group) => ({
    label: group.label,
    count: activeTasks.filter((task) => task.priority === group.label).length,
    tone: group.tone,
  }))

  const overdueCount = activeTasks.filter((task) => {
    const dueTime = new Date(task.dueAt || task.dueDate).getTime()
    return !Number.isNaN(dueTime) && dueTime < currentTime
  }).length

  return [
    ...priorityItems,
    { label: 'Overdue', count: overdueCount, tone: 'red' },
  ]
}

export function getTaskDashboardShortcutFilters(shortcut = {}) {
  if (shortcut.type === 'status' && STATUSES.includes(shortcut.value)) {
    return {
      status: shortcut.value,
      priority: 'All',
      due: 'all',
      sort: 'deadline',
    }
  }

  if (shortcut.type === 'priority' && PRIORITIES.includes(shortcut.value)) {
    return {
      status: 'All',
      priority: shortcut.value,
      due: 'all',
      sort: 'priority',
    }
  }

  if (shortcut.type === 'due' && shortcut.value === 'overdue') {
    return {
      status: 'All',
      priority: 'All',
      due: 'overdue',
      sort: 'deadline',
    }
  }

  return {
    status: 'All',
    priority: 'All',
    due: 'all',
    sort: 'deadline',
  }
}

export function sortByDueDate(tasks) {
  return [...tasks].sort((left, right) => new Date(left.dueDate) - new Date(right.dueDate))
}
