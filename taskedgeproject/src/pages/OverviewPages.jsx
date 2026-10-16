import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { PRIORITIES, STATUSES, getAgendaTasks, getCalendarDays, getCalendarViewAnchor, getCalendarMonthDays, getMyDayMetrics, getRecentTasks, getTaskQueueGroups, getTaskPriorityBreakdown, getTaskStatusBreakdown, getUpcomingDeadlineTasks } from '../utils/taskLogic.jsx'
import { formatDate, getLocalDateKey, getTimeInputValue } from '../utils/display.jsx'
import { PaginationControls, StatusBadge, PriorityBadge, TaskCard, UserAvatar } from '../components/common/WorkspaceUi.jsx'
import { usePaginatedRecords } from '../utils/usePaginatedRecords.jsx'
import { getUserId } from '../utils/display.jsx'

export function Dashboard({ tasks, users = [], onCreateTask, onOpenTask, onOpenTaskShortcut }) {
  const agendaTasks = getAgendaTasks(tasks)
  const metrics = getMyDayMetrics(tasks)
  const recentTasks = getRecentTasks(tasks, { limit: 5 })
  const upcomingDeadlines = getUpcomingDeadlineTasks(tasks, { limit: 3 })
  const getAssignee = (task) => users.find((person) => getUserId(person) === task.assigneeId) || { avatarUrl: task.assigneeAvatarUrl }
  const statusBreakdown = getTaskStatusBreakdown(tasks)
  const priorityBreakdown = getTaskPriorityBreakdown(tasks)
  const overviewCards = [
    { label: 'Active tasks', value: metrics.active, tone: 'blue' },
    { label: 'Completed today', value: metrics.completedToday, tone: 'green' },
    { label: 'Due today', value: metrics.dueToday, tone: 'amber' },
    { label: 'Overdue', value: metrics.overdue, tone: 'red' },
  ]

  return (
    <section className="page-stack">
      <div className="summary-grid my-day-summary">
        {overviewCards.map((card) => (
          <article className={`metric-card metric-${card.tone}`} key={card.label}>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="today-strip">
        <div className="date-card">
          <span>{new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date())}</span>
          <strong>{new Intl.DateTimeFormat('en', { day: 'numeric' }).format(new Date())}</strong>
          <span>{new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date())}</span>
        </div>
        <div className="agenda-lines" aria-label="Today agenda">
          {agendaTasks.length ? (
            agendaTasks.map((task) => (
              <p key={`agenda-${task.id}`} className={task.isOverdue ? 'overdue' : ''}>
                <span />
                {task.label}
                {task.isOverdue ? ` ${task.title}` : ''}
              </p>
            ))
          ) : (
            <p><span /> No urgent tasks right now</p>
          )}
        </div>
      </div>

      <div className="dashboard-insight-grid">
        <article className="dashboard-status-panel">
          <div className="section-row compact">
            <div>
              <p className="eyebrow">Task status</p>
              <h3 className="section-title">Work distribution</h3>
            </div>
          </div>
          <div className="dashboard-status-bar" aria-label="Task status distribution">
            {statusBreakdown.map((item) => (
              item.count > 0 && (
                <span
                  className={`status-segment status-segment-${item.tone}`}
                  key={`segment-${item.label}`}
                  style={{ width: `${item.percent}%` }}
                  title={`${item.label}: ${item.count}`}
                />
              )
            ))}
          </div>
          <div className="dashboard-status-list">
            {statusBreakdown.map((item) => (
              <button
                type="button"
                className="dashboard-status-item"
                key={item.label}
                onClick={() => onOpenTaskShortcut({ type: 'status', value: item.label })}
              >
                <span className={`status-dot status-dot-${item.tone}`} />
                <div>
                  <strong>{item.count}</strong>
                  <p>{item.label}</p>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="dashboard-status-panel dashboard-priority-panel">
          <div className="section-row compact">
            <div>
              <p className="eyebrow">Priority focus</p>
              <h3 className="section-title">Urgency overview</h3>
            </div>
          </div>
          <div className="dashboard-priority-list">
            {priorityBreakdown.map((item) => {
              const isPriority = PRIORITIES.includes(item.label)
              const isOverdue = item.label === 'Overdue'

              return (
                <button
                  type="button"
                  className={`dashboard-priority-row priority-focus-${item.tone}`}
                  key={item.label}
                  disabled={!isPriority && !isOverdue}
                  onClick={() =>
                    onOpenTaskShortcut(
                      isOverdue
                        ? { type: 'due', value: 'overdue' }
                        : { type: 'priority', value: item.label },
                    )}
                >
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </button>
              )
            })}
          </div>
        </article>
      </div>

      <div className="section-row">
        <div>
          <p className="eyebrow">My Day</p>
          <h3 className="section-title">Recent active tasks</h3>
        </div>
      </div>

      <div className="task-card-list">
        {recentTasks.length ? (
          recentTasks.map((task) => (
            <TaskCard key={task.id} task={task} assigneeUser={getAssignee(task)} onOpenTask={onOpenTask} />
          ))
        ) : (
          <div className="empty-state">
            <h3>No active tasks yet</h3>
            <p>Create a task or update an existing one to see it here.</p>
          </div>
        )}
      </div>

      <div className="section-row">
        <div>
          <p className="eyebrow">Deadlines</p>
          <h3 className="section-title">Upcoming deadlines</h3>
        </div>
      </div>

      <div className="dashboard-deadline-list">
        {upcomingDeadlines.length ? (
          upcomingDeadlines.map((task) => (
            <button
              type="button"
              className="dashboard-deadline-card"
              key={`deadline-${task.id}`}
              onClick={() => onOpenTask(task)}
            >
              <UserAvatar
                user={getAssignee(task)}
                className="dashboard-assignee-avatar"
                label={task.owner}
                fallback="default"
              />
              <div>
                <strong>{task.title}</strong>
                <p>{task.project} · {formatDate(task.dueAt || task.dueDate)}</p>
              </div>
              <PriorityBadge value={task.priority} />
            </button>
          ))
        ) : (
          <div className="empty-state dashboard-deadline-empty">
            <h3>No upcoming deadlines</h3>
            <p>Future work with due dates will appear here.</p>
          </div>
        )}
      </div>

      {onCreateTask && (
        <button type="button" className="add-task-bar" onClick={onCreateTask}>
          <span>+</span>
          Add task
        </button>
      )}
    </section>
  )
}

export function CalendarPage({
  tasks,
  selectedDate,
  onSelectDate,
  onOpenTask,
  onCreateTask,
}) {
  const [calendarMode, setCalendarMode] = useState('month')
  const [isCalendarSwitching, setIsCalendarSwitching] = useState(false)
  const selected = new Date(selectedDate)
  const visibleDate = Number.isNaN(selected.getTime()) ? new Date() : selected
  const today = new Date()
  const monthDays = getCalendarMonthDays(tasks, { selectedDate: visibleDate, now: today })
  const weekDays = getCalendarDays(tasks, {
    now: getCalendarViewAnchor('week', { selectedDate: visibleDate, today }),
  })
  const days = calendarMode === 'month' ? monthDays : weekDays
  const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(visibleDate)
  const weekRangeLabel = weekDays.length
    ? `${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(weekDays[0].date)} - ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(weekDays.at(-1).date)}`
    : ''

  function shiftMonth(amount) {
    const nextDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + amount, 1)
    onSelectDate(getLocalDateKey(nextDate))
  }

  function toggleCalendarMode() {
    if (isCalendarSwitching) return
    setIsCalendarSwitching(true)
    setCalendarMode((currentMode) => (currentMode === 'month' ? 'week' : 'month'))
  }

  useEffect(() => {
    if (!isCalendarSwitching) return undefined
    const timeout = window.setTimeout(() => setIsCalendarSwitching(false), 360)
    return () => window.clearTimeout(timeout)
  }, [isCalendarSwitching])

  const calendarGrid = (
    <div
      key={calendarMode}
      className={`calendar-grid ${calendarMode === 'month' ? 'month-calendar-grid' : 'week-calendar-grid'}`}
      aria-label={calendarMode === 'month' ? `${monthLabel} deadline calendar` : 'Next 7 days calendar'}
    >
      {days.map((day, index) => {
        if (day.isBlank) {
          return (
            <span
              className="calendar-day calendar-day-blank"
              key={day.key}
              aria-hidden="true"
              style={{ '--calendar-card-index': index }}
            />
          )
        }

        const isSelected = day.dateKey === selectedDate
        const overdueCount = day.tasks.filter((task) => {
          const dueTime = new Date(task.dueAt || task.dueDate).getTime()
          return !['Completed', 'Done'].includes(task.status) && !Number.isNaN(dueTime) && dueTime < Date.now()
        }).length

        return (
          <article
            className={[
              'calendar-day',
              isSelected ? 'selected' : '',
              day.isToday ? 'today' : '',
              day.tasks.length ? '' : 'empty',
            ].filter(Boolean).join(' ')}
            key={day.dateKey}
            role="button"
            tabIndex={0}
            style={{ '--calendar-card-index': index }}
            onClick={() => onSelectDate(day.dateKey)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelectDate(day.dateKey)
              }
            }}
          >
            <div className="calendar-day-button">
              {calendarMode === 'week' && (
                <span>{new Intl.DateTimeFormat('en', { weekday: 'short' }).format(day.date)}</span>
              )}
              <strong>
                {calendarMode === 'month'
                  ? day.dayNumber
                  : new Intl.DateTimeFormat('en', { day: 'numeric' }).format(day.date)}
              </strong>
              <small>
                {calendarMode === 'month'
                  ? day.tasks.length ? `${day.tasks.length} task${day.tasks.length === 1 ? '' : 's'}` : 'Available'
                  : new Intl.DateTimeFormat('en', { month: 'short' }).format(day.date)}
              </small>
            </div>

            <div className="calendar-task-stack">
              {day.tasks.length ? (
                day.tasks.map((task) => (
                  <button
                    type="button"
                    className={`calendar-task-chip priority-${task.priority.toLowerCase()}`}
                    key={`calendar-${day.dateKey}-${task.id}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenTask(task)
                    }}
                  >
                    <span className="calendar-task-chip-top">
                      <b>{getTimeInputValue(task.dueAt || task.dueDate) || 'All day'}</b>
                      <i>{task.priority}</i>
                    </span>
                    <strong>{task.title}</strong>
                    <small>{task.owner || 'Unassigned'} · {task.status}</small>
                  </button>
                ))
              ) : (
                <p>{calendarMode === 'month' ? 'No deadlines' : 'No scheduled tasks'}</p>
              )}
            </div>

            {overdueCount > 0 && <span className="calendar-alert">{overdueCount} overdue</span>}
          </article>
        )
      })}
    </div>
  )

  return (
    <section className={`calendar-page calendar-${calendarMode}-view`}>
      <header className="calendar-toolbar">
        <div className="calendar-title-row">
          <span className="calendar-title-icon" aria-hidden="true"><CalendarDays size={21} /></span>
          <div>
            <p className="eyebrow">Deadline calendar</p>
            <div className="calendar-heading-line">
              <h3 className="section-title">{calendarMode === 'month' ? monthLabel : 'Next 7 days'}</h3>
              {calendarMode === 'week' && <span>{weekRangeLabel}</span>}
            </div>
          </div>
          <button
            type="button"
            className="calendar-mode-button"
            onClick={toggleCalendarMode}
            disabled={isCalendarSwitching}
          >
            {calendarMode === 'month' ? 'Show 7 days' : 'Show month'}
          </button>
        </div>

        <div className="calendar-toolbar-actions">
          {calendarMode === 'month' && (
            <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={17} aria-hidden="true" />
              <span>Previous</span>
            </button>
          )}
          <button type="button" onClick={() => onSelectDate(getLocalDateKey(new Date()))}>
            Today
          </button>
          {calendarMode === 'month' && (
            <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}>
              <span>Next</span>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          )}
          {onCreateTask && (
            <button type="button" className="calendar-add-task" onClick={onCreateTask}>
              <Plus size={17} aria-hidden="true" />
              Add task
            </button>
          )}
        </div>
      </header>

      {calendarMode === 'month' ? (
        <div className="calendar-month-shell">
          <div className="calendar-weekdays" aria-hidden="true">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
          </div>
          {calendarGrid}
        </div>
      ) : calendarGrid}
    </section>
  )
}

export function TasksPage({
  tasks,
  currentUser,
  isLoading,
  taskError,
  taskMessage,
  statusFilter,
  priorityFilter,
  dueFilter,
  scopeFilter,
  sortMode,
  onStatusFilterChange,
  onPriorityFilterChange,
  onDueFilterChange,
  onScopeFilterChange,
  onSortChange,
  onRefresh,
  onCreateTask,
  onOpenTask,
  onEditTask,
  onDeleteTask,
}) {
  const pagination = usePaginatedRecords(tasks, 6)

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div className="segmented-control" aria-label="Filter tasks by status">
          {['All', ...STATUSES].map((status) => (
            <button
              key={status}
              type="button"
              className={statusFilter === status ? 'active' : ''}
              onClick={() => onStatusFilterChange(status)}
            >
              {status}
            </button>
          ))}
        </div>
        {onCreateTask && (
          <button type="button" className="primary-button compact" onClick={onCreateTask}>
            Add task
          </button>
        )}
      </div>

      <div className="task-filter-row">
        <label>
          Priority
          <select value={priorityFilter} onChange={(event) => onPriorityFilterChange(event.target.value)}>
            {['All', ...PRIORITIES].map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
        <label>
          Due
          <select value={dueFilter} onChange={(event) => onDueFilterChange(event.target.value)}>
            <option value="all">All</option>
            <option value="overdue">Overdue</option>
          </select>
        </label>
        <label>
          Scope
          <select value={scopeFilter} onChange={(event) => onScopeFilterChange(event.target.value)}>
            <option value="all">All</option>
            <option value="assigned-to-me">Assigned to me</option>
            <option value="created-by-me">Created by me</option>
            <option value="watching">Watching</option>
          </select>
        </label>
        <label>
          Sort
          <select value={sortMode} onChange={(event) => onSortChange(event.target.value)}>
            <option value="deadline">Deadline</option>
            <option value="priority">Priority</option>
            <option value="title">Title</option>
          </select>
        </label>
        <button type="button" className="ghost-button compact" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {taskMessage && <p className="form-message">{taskMessage}</p>}
      {taskError && (
        <div className="empty-state">
          <h3>Could not load tasks</h3>
          <p>{taskError}</p>
          <button type="button" className="primary-button compact" onClick={onRefresh}>
            Retry
          </button>
        </div>
      )}

      <div className="task-card-list">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading tasks</h3>
            <p>Fetching the shared task queue from the server.</p>
          </div>
        ) : tasks.length ? (
          pagination.items.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentUser={currentUser}
              onOpenTask={onOpenTask}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
            />
          ))
        ) : (
          <div className="empty-state">
            <h3>No tasks found</h3>
            <p>{onCreateTask ? 'Adjust the search or status filter, or add a new task.' : 'Adjust the search or status filters.'}</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label="tasks" />
    </section>
  )
}

export function TaskQueuePanel({ tasks, onOpenTask, onCreateTask }) {
  const queueGroups = getTaskQueueGroups(tasks, { limit: 48 })
  const queueCount = queueGroups.reduce((total, group) => total + group.tasks.length, 0)

  return (
    <aside className="suggestions-panel task-queue-panel" aria-label="Task queue">
      <div className="suggestions-heading">
        <div>
          <span className="suggestions-icon" aria-hidden="true">≋</span>
          <h3>Task queue</h3>
          <span className="task-queue-count">{queueCount}</span>
        </div>
        {onCreateTask && (
          <div className="suggestions-actions">
            <button type="button" aria-label="Add task from queue" onClick={onCreateTask}>+</button>
          </div>
        )}
      </div>
      {queueGroups.length ? (
        <div className="task-queue-list">
          {queueGroups.map((group, groupIndex) => (
            <section
              className="task-queue-group"
              key={`queue-${group.dateKey}`}
              style={{ '--queue-group-index': groupIndex }}
            >
              <div className="task-queue-date">
                <span>{group.label}</span>
                {group.note && <small>{group.note}</small>}
              </div>
              <div className="task-queue-stack">
                {group.tasks.map((task, taskIndex) => (
                  <button
                    type="button"
                    className={`task-queue-card priority-${String(task.priority || 'medium').toLowerCase()}`}
                    key={`queue-task-${task.id}`}
                    style={{ '--queue-item-index': taskIndex }}
                    onClick={() => onOpenTask(task)}
                  >
                    <span className="task-queue-time">{task.isOverdue ? 'Overdue' : task.queueTimeLabel}</span>
                    <strong>{task.title}</strong>
                    <span className="task-queue-context">{task.project || 'Workspace'} · {task.owner || 'Unassigned'}</span>
                    <span className="task-queue-badges">
                      <PriorityBadge value={task.priority} />
                      <StatusBadge value={task.status} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-state task-queue-empty">
          <h3>No queued tasks</h3>
          <p>{onCreateTask ? 'Create a dated task and it will appear here.' : 'Assigned dated tasks will appear here.'}</p>
          {onCreateTask && <button type="button" className="ghost-button" onClick={onCreateTask}>Add task</button>}
        </div>
      )}
    </aside>
  )
}
