import test from 'node:test'
import assert from 'node:assert/strict'

import {
  addSubtaskToList,
  buildTaskPayload,
  getRecurrenceSummary,
  getAgendaTasks,
  getCalendarDays,
  getCalendarMonthDays,
  getMyDayMetrics,
  getRecentTasks,
  getTaskQueueGroups,
  getTaskDashboardShortcutFilters,
  getTaskAttachmentDisplay,
  getTaskPriorityBreakdown,
  getTaskStatusBreakdown,
  getUpcomingDeadlineTasks,
  getTaskDetailFacts,
  getTasksForDate,
  getTaskMetrics,
  getVisibleTasks,
  normalizeTaskFromApi,
  removeSubtaskFromList,
  toggleSubtaskInList,
  uiStatusToApi,
} from './taskLogic.js'

const sampleTasks = [
  {
    id: 'task-1',
    title: 'Prepare project proposal',
    description: 'Draft the Chapter 1 project context.',
    status: 'Todo',
    priority: 'High',
    dueDate: '2026-10-12',
    owner: 'Jason',
  },
  {
    id: 'task-2',
    title: 'Build auth screens',
    description: 'Create login and registration forms.',
    status: 'In Progress',
    priority: 'Urgent',
    dueDate: '2026-10-09',
    owner: 'Mika',
  },
  {
    id: 'task-3',
    title: 'Review task dashboard',
    description: 'Check responsive dashboard cards.',
    status: 'Done',
    priority: 'Medium',
    dueDate: '2026-10-08',
    owner: 'Jason',
  },
]

test('filters tasks by search text across title, description, and owner', () => {
  const visible = getVisibleTasks(sampleTasks, {
    query: 'auth',
    status: 'All',
  })

  assert.deepEqual(
    visible.map((task) => task.id),
    ['task-2'],
  )
})

test('filters tasks by status after applying search text', () => {
  const visible = getVisibleTasks(sampleTasks, {
    query: 'jason',
    status: 'Done',
  })

  assert.deepEqual(
    visible.map((task) => task.id),
    ['task-3'],
  )
})

test('filters overdue active tasks by due date', () => {
  const visible = getVisibleTasks(
    [
      { id: 'late', title: 'Late task', status: 'Todo', priority: 'High', dueDate: '2026-10-13T08:00:00.000Z' },
      { id: 'future', title: 'Future task', status: 'Todo', priority: 'High', dueDate: '2026-10-15T08:00:00.000Z' },
      { id: 'done-late', title: 'Done late', status: 'Completed', priority: 'High', dueDate: '2026-10-12T08:00:00.000Z' },
      { id: 'no-date', title: 'No date', status: 'Todo', priority: 'High' },
    ],
    {
      query: '',
      status: 'All',
      due: 'overdue',
      now: new Date('2026-10-14T08:00:00.000Z'),
    },
  )

  assert.deepEqual(
    visible.map((task) => task.id),
    ['late'],
  )
})

test('filters tasks by user scope fields', () => {
  const scopedTasks = [
    {
      id: 'assigned',
      title: 'Assigned task',
      description: '',
      status: 'Todo',
      priority: 'Medium',
      assigneeId: 'user-1',
      reporterId: 'user-2',
      watcherIds: [],
    },
    {
      id: 'created',
      title: 'Created task',
      description: '',
      status: 'Todo',
      priority: 'Medium',
      assigneeId: 'user-2',
      reporterId: 'user-1',
      watcherIds: [],
    },
    {
      id: 'watching',
      title: 'Watching task',
      description: '',
      status: 'Todo',
      priority: 'Medium',
      assigneeId: 'user-3',
      reporterId: 'user-2',
      watcherIds: ['user-1'],
    },
  ]

  assert.deepEqual(
    getVisibleTasks(scopedTasks, { scope: 'assigned-to-me', currentUserId: 'user-1' }).map((task) => task.id),
    ['assigned'],
  )
  assert.deepEqual(
    getVisibleTasks(scopedTasks, { scope: 'created-by-me', currentUserId: 'user-1' }).map((task) => task.id),
    ['created'],
  )
  assert.deepEqual(
    getVisibleTasks(scopedTasks, { scope: 'watching', currentUserId: 'user-1' }).map((task) => task.id),
    ['watching'],
  )
})

test('calculates dashboard metrics from the current task list', () => {
  const metrics = getTaskMetrics(sampleTasks)

  assert.deepEqual(metrics, {
    total: 3,
    todo: 1,
    inProgress: 1,
    review: 0,
    done: 1,
    urgent: 1,
  })
})

test('getTaskStatusBreakdown returns counts and percentages in dashboard order', () => {
  assert.deepEqual(
    getTaskStatusBreakdown([
      { status: 'Todo' },
      { status: 'In Progress' },
      { status: 'For Review' },
      { status: 'Completed' },
      { status: 'Returned' },
    ]),
    [
      { label: 'Todo', count: 1, percent: 20, tone: 'neutral' },
      { label: 'In Progress', count: 1, percent: 20, tone: 'blue' },
      { label: 'For Review', count: 1, percent: 20, tone: 'amber' },
      { label: 'Completed', count: 1, percent: 20, tone: 'green' },
      { label: 'Returned', count: 1, percent: 20, tone: 'red' },
    ],
  )
})

test('getTaskPriorityBreakdown counts active priorities and overdue work', () => {
  assert.deepEqual(
    getTaskPriorityBreakdown(
      [
        { status: 'Todo', priority: 'Urgent', dueDate: '2026-10-13T08:00:00.000Z' },
        { status: 'In Progress', priority: 'High', dueDate: '2026-10-15T08:00:00.000Z' },
        { status: 'For Review', priority: 'Medium', dueDate: '2026-10-16T08:00:00.000Z' },
        { status: 'Returned', priority: 'Low', dueDate: '2026-10-12T08:00:00.000Z' },
        { status: 'Completed', priority: 'Urgent', dueDate: '2026-10-11T08:00:00.000Z' },
      ],
      { now: new Date('2026-10-14T08:00:00.000Z') },
    ),
    [
      { label: 'Urgent', count: 1, tone: 'red' },
      { label: 'High', count: 1, tone: 'amber' },
      { label: 'Medium', count: 1, tone: 'blue' },
      { label: 'Low', count: 1, tone: 'neutral' },
      { label: 'Overdue', count: 2, tone: 'red' },
    ],
  )
})

test('getTaskDashboardShortcutFilters maps dashboard shortcuts to task list filters', () => {
  assert.deepEqual(getTaskDashboardShortcutFilters({ type: 'status', value: 'For Review' }), {
    status: 'For Review',
    priority: 'All',
    due: 'all',
    sort: 'deadline',
  })

  assert.deepEqual(getTaskDashboardShortcutFilters({ type: 'priority', value: 'Urgent' }), {
    status: 'All',
    priority: 'Urgent',
    due: 'all',
    sort: 'priority',
  })

  assert.deepEqual(getTaskDashboardShortcutFilters({ type: 'due', value: 'overdue' }), {
    status: 'All',
    priority: 'All',
    due: 'overdue',
    sort: 'deadline',
  })

  assert.deepEqual(getTaskDashboardShortcutFilters({ type: 'priority', value: 'Unknown' }), {
    status: 'All',
    priority: 'All',
    due: 'all',
    sort: 'deadline',
  })
})

test('normalizes backend tasks into the React task shape', () => {
  const task = normalizeTaskFromApi({
    _id: 'task-99',
    title: 'Ship shared task module',
    description: 'Wire React to the task API.',
    status: 'for-review',
    priority: 'urgent',
    type: 'individual-activity',
    startDate: '2026-10-14T00:00:00.000Z',
    deadline: '2026-10-15T00:00:00.000Z',
    activitySettings: { maxSubmissions: 2, maximumScore: 50 },
    myAssignmentStatus: 'submitted',
    project: { _id: 'project-1', name: 'TaskEdge', manager: { _id: 'manager-1' } },
    assignee: { _id: 'user-1', firstName: 'Jason', lastName: 'Raine' },
    reporter: { _id: 'user-2', firstName: 'Mika', lastName: 'Tan' },
    collaborators: [{ _id: 'user-3', firstName: 'Ava', lastName: 'Lee' }],
    watchers: [{ _id: 'user-4', firstName: 'Noel', lastName: 'Ray' }],
    dependencies: [{ _id: 'task-1', title: 'Foundation task', status: 'completed' }],
    category: 'Frontend',
    tags: ['frontend'],
    recurrence: { frequency: 'weekly', interval: 2, count: 3 },
    subtasks: [{ title: 'Add details page', completed: false }],
  })

  assert.deepEqual(task, {
    id: 'task-99',
    title: 'Ship shared task module',
    description: 'Wire React to the task API.',
    status: 'For Review',
    priority: 'Urgent',
    type: 'individual-activity',
    progress: 0,
    startDate: '2026-10-14T00:00:00.000Z',
    dueDate: '2026-10-15',
    dueAt: '2026-10-15T00:00:00.000Z',
    activitySettings: { maxSubmissions: 2, maximumScore: 50 },
    activityStatus: 'submitted',
    projectId: 'project-1',
    projectManagerId: 'manager-1',
    project: 'TaskEdge',
    assigneeId: 'user-1',
    owner: 'Jason Raine',
    reporterId: 'user-2',
    reporter: 'Mika Tan',
    collaborators: [{ id: 'user-3', name: 'Ava Lee' }],
    collaboratorIds: ['user-3'],
    watchers: [{ id: 'user-4', name: 'Noel Ray' }],
    watcherIds: ['user-4'],
    dependencies: [{ id: 'task-1', title: 'Foundation task', status: 'completed' }],
    dependencyIds: ['task-1'],
    category: 'Frontend',
    tags: ['frontend'],
    recurrence: { frequency: 'weekly', interval: 2, count: 3 },
    subtasks: [{ title: 'Add details page', completed: false }],
    attachments: [],
    raw: {
      _id: 'task-99',
      title: 'Ship shared task module',
      description: 'Wire React to the task API.',
      status: 'for-review',
      priority: 'urgent',
      type: 'individual-activity',
      startDate: '2026-10-14T00:00:00.000Z',
      deadline: '2026-10-15T00:00:00.000Z',
      activitySettings: { maxSubmissions: 2, maximumScore: 50 },
      myAssignmentStatus: 'submitted',
      project: { _id: 'project-1', name: 'TaskEdge', manager: { _id: 'manager-1' } },
      assignee: { _id: 'user-1', firstName: 'Jason', lastName: 'Raine' },
      reporter: { _id: 'user-2', firstName: 'Mika', lastName: 'Tan' },
      collaborators: [{ _id: 'user-3', firstName: 'Ava', lastName: 'Lee' }],
      watchers: [{ _id: 'user-4', firstName: 'Noel', lastName: 'Ray' }],
      dependencies: [{ _id: 'task-1', title: 'Foundation task', status: 'completed' }],
      category: 'Frontend',
      tags: ['frontend'],
      recurrence: { frequency: 'weekly', interval: 2, count: 3 },
      subtasks: [{ title: 'Add details page', completed: false }],
    },
  })
})

test('normalizes task progress for the member progress editor', () => {
  const task = normalizeTaskFromApi({ _id: 'task-progress', progress: 45 })

  assert.equal(task.progress, 45)
})

test('getTaskDetailFacts exposes advanced task metadata for the detail page', () => {
  const facts = getTaskDetailFacts({
    startDate: '2026-10-15T00:00:00.000Z',
    category: 'Frontend',
    tags: ['react', 'api'],
    collaborators: [{ id: 'user-2', name: 'Ava Lee' }],
    watchers: [{ id: 'user-3', name: 'Noel Ray' }],
    recurrence: { frequency: 'weekly', interval: 2, count: 3 },
  })

  assert.deepEqual(facts, [
    { label: 'Start date', value: '2026-10-15' },
    { label: 'Category', value: 'Frontend' },
    { label: 'Tags', value: 'react, api' },
    { label: 'Collaborators', value: 'Ava Lee' },
    { label: 'Watchers', value: 'Noel Ray' },
    { label: 'Recurrence', value: 'Every 2 weekly (3 occurrences)' },
  ])
})

test('getTaskAttachmentDisplay prepares attachment labels and actions', () => {
  assert.deepEqual(
    getTaskAttachmentDisplay({
      _id: 'file-1',
      name: 'proposal.pdf',
      url: '/uploads/proposal.pdf',
      mimeType: 'application/pdf',
      size: 1536,
    }, 'http://localhost:8000/api'),
    {
      id: 'file-1',
      name: 'proposal.pdf',
      typeLabel: 'PDF',
      sizeLabel: '1.5 KB',
      url: 'http://localhost:8000/uploads/proposal.pdf',
      canOpen: true,
      canRemove: true,
    },
  )

  assert.deepEqual(
    getTaskAttachmentDisplay({}, 'http://localhost:8000/api'),
    {
      id: '',
      name: 'Attachment',
      typeLabel: 'File',
      sizeLabel: 'File',
      url: '',
      canOpen: false,
      canRemove: false,
    },
  )
})

test('buildTaskPayload converts React form values into backend task fields', () => {
  assert.deepEqual(
    buildTaskPayload({
      title: 'Create task details',
      description: 'Use a full page.',
      status: 'In Progress',
      priority: 'High',
      startDate: '2026-10-15',
      dueDate: '2026-10-16',
      dueTime: '17:30',
      projectId: 'project-1',
      assigneeId: 'user-1',
      collaboratorIds: ['user-2'],
      watcherIds: ['user-3'],
      dependencyIds: ['task-1'],
      tags: 'react, backend',
      category: 'Frontend',
      subtasks: [{ title: 'Draft modal', completed: false }],
      recurrenceFrequency: 'weekly',
      recurrenceInterval: '2',
      recurrenceCount: '3',
    }),
    {
      title: 'Create task details',
      description: 'Use a full page.',
      status: 'in-progress',
      priority: 'high',
      startDate: '2026-10-15',
      deadline: '2026-10-16T17:30',
      project: 'project-1',
      assignee: 'user-1',
      collaborators: ['user-2'],
      watchers: ['user-3'],
      dependencies: ['task-1'],
      tags: ['react', 'backend'],
      category: 'Frontend',
      subtasks: [{ title: 'Draft modal', completed: false }],
      recurrence: { frequency: 'weekly', interval: 2, count: 3 },
    },
  )
})

test('getRecurrenceSummary explains inactive and repeating task schedules', () => {
  assert.equal(getRecurrenceSummary('none', 1, 1), 'Choose a repeat pattern to schedule recurring tasks.')
  assert.equal(getRecurrenceSummary('weekly', 2, 4), 'Creates 4 occurrences, every 2 weeks.')
  assert.equal(getRecurrenceSummary('daily', 1, 3), 'Creates 3 occurrences, every day.')
})

test('uiStatusToApi maps all standard task statuses to backend values', () => {
  assert.equal(uiStatusToApi('Todo'), 'todo')
  assert.equal(uiStatusToApi('In Progress'), 'in-progress')
  assert.equal(uiStatusToApi('For Review'), 'for-review')
  assert.equal(uiStatusToApi('Completed'), 'completed')
  assert.equal(uiStatusToApi('Returned'), 'returned')
})

test('subtask helpers add toggle and remove subtasks without mutating the original list', () => {
  const subtasks = [{ title: 'Draft', completed: false }]

  const added = addSubtaskToList(subtasks, '  Review copy  ')
  const toggled = toggleSubtaskInList(added, 1)
  const removed = removeSubtaskFromList(toggled, 0)

  assert.deepEqual(subtasks, [{ title: 'Draft', completed: false }])
  assert.deepEqual(added, [
    { title: 'Draft', completed: false },
    { title: 'Review copy', completed: false },
  ])
  assert.deepEqual(toggled[1], { title: 'Review copy', completed: true })
  assert.deepEqual(removed, [{ title: 'Review copy', completed: true }])
  assert.equal(addSubtaskToList(subtasks, '   '), subtasks)
})

test('getAgendaTasks puts overdue work first with an overdue label', () => {
  const agenda = getAgendaTasks(
    [
      {
        id: 'later',
        title: 'Later upcoming task',
        status: 'Todo',
        dueAt: '2026-10-12T18:00:00',
      },
      {
        id: 'soon',
        title: 'Submit reports',
        status: 'In Progress',
        dueAt: '2026-10-12T16:30:00',
      },
      {
        id: 'forgotten',
        title: 'Forgotten task',
        status: 'Todo',
        dueAt: '2026-10-12T13:00:00',
      },
    ],
    {
      now: new Date('2026-10-12T14:36:00'),
      limit: 3,
    },
  )

  assert.deepEqual(
    agenda.map((item) => [item.id, item.label, item.isOverdue]),
    [
      ['forgotten', 'Overdue', true],
      ['soon', '16:30 Submit reports', false],
      ['later', '18:00 Later upcoming task', false],
    ],
  )
})

test('getAgendaTasks skips completed tasks and limits agenda items', () => {
  const agenda = getAgendaTasks(
    [
      {
        id: 'done',
        title: 'Already done',
        status: 'Completed',
        dueAt: '2026-10-12T03:00:00.000Z',
      },
      {
        id: 'one',
        title: 'First',
        status: 'Todo',
        dueAt: '2026-10-12T07:00:00.000Z',
      },
      {
        id: 'two',
        title: 'Second',
        status: 'Todo',
        dueAt: '2026-10-12T08:00:00.000Z',
      },
    ],
    {
      now: new Date('2026-10-12T06:36:00.000Z'),
      limit: 1,
    },
  )

  assert.deepEqual(
    agenda.map((item) => item.id),
    ['one'],
  )
})

test('getMyDayMetrics counts completed today overdue and due today', () => {
  const metrics = getMyDayMetrics(
    [
      {
        id: 'completed-today',
        status: 'Completed',
        dueAt: '2026-10-12T09:00:00',
        updatedAt: '2026-10-12T10:00:00',
      },
      {
        id: 'overdue',
        status: 'Todo',
        dueAt: '2026-10-12T13:00:00',
      },
      {
        id: 'due-today',
        status: 'In Progress',
        dueAt: '2026-10-12T16:30:00',
      },
      {
        id: 'review',
        status: 'For Review',
        dueAt: '2026-10-13T09:00:00',
      },
    ],
    { now: new Date('2026-10-12T14:36:00') },
  )

  assert.deepEqual(metrics, {
    active: 3,
    completedToday: 1,
    overdue: 1,
    dueToday: 2,
    inProgress: 1,
    review: 1,
  })
})

test('getRecentTasks returns newest changed tasks and skips completed work by default', () => {
  const recent = getRecentTasks(
    [
      {
        id: 'old',
        status: 'Todo',
        updatedAt: '2026-10-10T09:00:00',
        dueAt: '2026-10-20T09:00:00',
      },
      {
        id: 'new',
        status: 'In Progress',
        updatedAt: '2026-10-12T09:00:00',
        dueAt: '2026-10-21T09:00:00',
      },
      {
        id: 'done',
        status: 'Completed',
        updatedAt: '2026-10-13T09:00:00',
        dueAt: '2026-10-22T09:00:00',
      },
    ],
    { limit: 2 },
  )

  assert.deepEqual(
    recent.map((task) => task.id),
    ['new', 'old'],
  )
})

test('getUpcomingDeadlineTasks returns future incomplete work by nearest deadline', () => {
  const upcoming = getUpcomingDeadlineTasks(
    [
      { id: 'done', title: 'Done', status: 'Completed', dueDate: '2026-10-14T08:00:00.000Z' },
      { id: 'overdue', title: 'Overdue', status: 'Todo', dueDate: '2026-10-13T08:00:00.000Z' },
      { id: 'later', title: 'Later', status: 'Todo', dueDate: '2026-10-16T08:00:00.000Z' },
      { id: 'soon', title: 'Soon', status: 'In Progress', dueDate: '2026-10-15T08:00:00.000Z' },
      { id: 'no-date', title: 'No date', status: 'Todo', dueDate: '' },
    ],
    { now: new Date('2026-10-14T09:00:00.000Z'), limit: 2 },
  )

  assert.deepEqual(upcoming.map((task) => task.id), ['soon', 'later'])
})

test('getTaskQueueGroups groups active work by date with overdue and priority ordering', () => {
  const groups = getTaskQueueGroups(
    [
      { id: 'done', title: 'Done', status: 'Completed', priority: 'Urgent', dueAt: '2026-10-15T08:00:00' },
      { id: 'low-overdue', title: 'Low overdue', status: 'Todo', priority: 'Low', dueAt: '2026-10-15T09:00:00' },
      { id: 'urgent-overdue', title: 'Urgent overdue', status: 'Todo', priority: 'Urgent', dueAt: '2026-10-15T08:30:00' },
      { id: 'high-future', title: 'High future', status: 'Todo', priority: 'High', dueAt: '2026-10-15T16:00:00' },
      { id: 'tomorrow', title: 'Tomorrow', status: 'In Progress', priority: 'Medium', dueAt: '2026-10-16T10:00:00' },
      { id: 'undated', title: 'Undated', status: 'Todo', priority: 'Urgent', dueAt: '' },
    ],
    { now: new Date('2026-10-15T12:00:00'), limit: 10 },
  )

  assert.deepEqual(
    groups.map((group) => [group.label, group.note, group.tasks.map((task) => task.id)]),
    [
      ['Oct 15', 'Today', ['urgent-overdue', 'low-overdue', 'high-future']],
      ['Oct 16', 'Tomorrow', ['tomorrow']],
      ['No date', '', ['undated']],
    ],
  )
})

test('getTaskQueueGroups limits queue items before grouping', () => {
  const groups = getTaskQueueGroups(
    [
      { id: 'one', title: 'One', status: 'Todo', priority: 'Medium', dueAt: '2026-10-15T08:00:00' },
      { id: 'two', title: 'Two', status: 'Todo', priority: 'Medium', dueAt: '2026-10-16T08:00:00' },
    ],
    { now: new Date('2026-10-14T12:00:00'), limit: 1 },
  )

  assert.deepEqual(groups.map((group) => group.tasks.map((task) => task.id)), [['one']])
})

test('getCalendarDays builds the next seven dated task buckets', () => {
  const days = getCalendarDays(
    [
      {
        id: 'morning',
        title: 'Morning work',
        status: 'Todo',
        dueAt: '2026-10-12T09:00:00',
      },
      {
        id: 'afternoon',
        title: 'Afternoon work',
        status: 'In Progress',
        dueAt: '2026-10-12T16:30:00',
      },
      {
        id: 'next-week',
        title: 'Next week work',
        status: 'Todo',
        dueAt: '2026-10-18T11:00:00',
      },
      {
        id: 'outside',
        title: 'Outside range',
        status: 'Todo',
        dueAt: '2026-10-19T11:00:00',
      },
    ],
    { now: new Date('2026-10-12T14:36:00') },
  )

  assert.equal(days.length, 7)
  assert.deepEqual(
    days.map((day) => [day.dateKey, day.isToday, day.tasks.map((task) => task.id)]),
    [
      ['2026-10-12', true, ['morning', 'afternoon']],
      ['2026-10-13', false, []],
      ['2026-10-14', false, []],
      ['2026-10-15', false, []],
      ['2026-10-16', false, []],
      ['2026-10-17', false, []],
      ['2026-10-18', false, ['next-week']],
    ],
  )
})

test('getCalendarMonthDays builds a month grid with leading blanks and task counts', () => {
  const days = getCalendarMonthDays(
    [
      {
        id: 'month-start',
        title: 'Kickoff',
        status: 'Todo',
        dueAt: '2026-10-01T09:00:00',
      },
      {
        id: 'selected',
        title: 'Selected task',
        status: 'In Progress',
        dueAt: '2026-10-13T14:00:00',
      },
      {
        id: 'other-month',
        title: 'Other month',
        status: 'Todo',
        dueAt: '2026-11-01T09:00:00',
      },
    ],
    { selectedDate: '2026-10-13', now: new Date('2026-10-12T08:00:00') },
  )

  assert.equal(days.length, 35)
  assert.deepEqual(days.slice(0, 4), [
    { isBlank: true, key: 'blank-0' },
    { isBlank: true, key: 'blank-1' },
    { isBlank: true, key: 'blank-2' },
    { isBlank: true, key: 'blank-3' },
  ])
  assert.deepEqual(days[4], {
    date: new Date('2026-10-01T00:00:00'),
    dateKey: '2026-10-01',
    dayNumber: 1,
    isToday: false,
    isSelected: false,
    tasks: [
      {
        id: 'month-start',
        title: 'Kickoff',
        status: 'Todo',
        dueAt: '2026-10-01T09:00:00',
      },
    ],
  })
  assert.deepEqual(days[16].tasks.map((task) => task.id), ['selected'])
  assert.equal(days[16].isSelected, true)
})

test('getTasksForDate returns selected day tasks sorted by due time', () => {
  const selectedTasks = getTasksForDate(
    [
      {
        id: 'late',
        title: 'Late task',
        status: 'Todo',
        dueAt: '2026-10-13T17:00:00',
      },
      {
        id: 'early',
        title: 'Early task',
        status: 'Todo',
        dueAt: '2026-10-13T09:00:00',
      },
      {
        id: 'other',
        title: 'Other day task',
        status: 'Todo',
        dueAt: '2026-10-14T09:00:00',
      },
    ],
    '2026-10-13',
  )

  assert.deepEqual(
    selectedTasks.map((task) => task.id),
    ['early', 'late'],
  )
})
