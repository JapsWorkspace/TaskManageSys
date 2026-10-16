import { getTaskPermissions } from '../../utils/taskPermissions.jsx'
import { formatDate, getInitials } from '../../utils/display.jsx'
import defaultProfileImage from '../../assets/default.jpg'

export function PaginationControls({ pagination, onPageChange, label }) {
  if (pagination.totalPages <= 1) {
    return null
  }

  return (
    <nav className="pagination-bar" aria-label={`${label} pagination`}>
      <span>
        Page {pagination.page} of {pagination.totalPages} · {pagination.totalItems} {label}
      </span>
      <div className="row-actions">
        <button
          type="button"
          className="ghost-button compact"
          disabled={!pagination.hasPrevious}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="ghost-button compact"
          disabled={!pagination.hasNext}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  )
}

export function TaskCard({ task, currentUser, onOpenTask, onEditTask, onDeleteTask }) {
  const permissions = getTaskPermissions(currentUser, task)

  return (
    <article className="task-card">
      <span className="check-dot" aria-hidden="true" />
      <button type="button" className="task-open-button" onClick={() => onOpenTask?.(task)}>
        <div className="task-content">
          <p className="task-path">{task.project} &gt; {task.owner}</p>
          <h3>{task.title}</h3>
          <p>{task.description}</p>
        </div>
      </button>
      <div className="task-meta">
        <span>{formatDate(task.dueDate)}</span>
        <StatusBadge value={task.status} />
        <PriorityBadge value={task.priority} />
      </div>
      {(permissions.canManage || permissions.canDelete) && (
        <div className="row-actions">
          {permissions.canManage && onEditTask && (
            <button type="button" onClick={() => onEditTask(task)}>
              Edit
            </button>
          )}
          {permissions.canDelete && onDeleteTask && (
            <button type="button" onClick={() => onDeleteTask(task.id)}>
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  )
}

export function StatusBadge({ value }) {
  return <span className={`badge status-${value.toLowerCase().replaceAll(' ', '-')}`}>{value}</span>
}

export function PriorityBadge({ value }) {
  return <span className={`badge priority-${value.toLowerCase()}`}>{value}</span>
}

export function UserAvatar({ user, className, label = '', fallback = 'initials' }) {
  const avatarUrl = user?.avatarUrl || (fallback === 'default' ? defaultProfileImage : '')
  const initials = label
    ? label.slice(0, 1).toUpperCase()
    : getInitials(user || {})

  return (
    <div className={className} aria-hidden="true">
      {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
    </div>
  )
}
