import { useState } from 'react'
import { getTeamMetrics } from '../utils/teamLogic.jsx'
import { getNotificationMetrics } from '../utils/notificationLogic.jsx'
import { getUserDisplayName } from '../utils/userDisplayLogic.jsx'
import { canManageOwnedRecord, getArchiveRecordPermissions } from '../utils/taskPermissions.jsx'
import { formatDate, formatNotificationDate, getUserId } from '../utils/display.jsx'
import { PaginationControls, StatusBadge, PriorityBadge, UserAvatar } from '../components/common/WorkspaceUi.jsx'
import { usePaginatedRecords } from '../utils/usePaginatedRecords.jsx'

export function TeamsPage({
  teams,
  isLoading,
  taskError,
  taskMessage,
  canManage,
  currentUser,
  onRefresh,
  onCreateTeam,
  onEditTeam,
  onArchiveTeam,
}) {
  const metrics = getTeamMetrics(teams)
  const pagination = usePaginatedRecords(teams, 6)
  const overviewCards = [
    { label: 'Teams', value: metrics.totalTeams, tone: 'blue' },
    { label: 'Members', value: metrics.totalMembers, tone: 'green' },
    { label: 'Managers', value: metrics.totalManagers, tone: 'amber' },
  ]

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Teams</p>
          <h3 className="section-title">Teams and members</h3>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button compact" onClick={onRefresh}>
            Refresh
          </button>
          {canManage && (
            <button type="button" className="primary-button compact" onClick={onCreateTeam}>
              Add team
            </button>
          )}
        </div>
      </div>

      <div className="summary-grid team-summary">
        {overviewCards.map((card) => (
          <article className={`metric-card metric-${card.tone}`} key={card.label}>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      {taskMessage && <p className="form-message">{taskMessage}</p>}
      {taskError && (
        <div className="empty-state">
          <h3>Could not load teams</h3>
          <p>{taskError}</p>
        </div>
      )}

      <div className="team-grid">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading teams</h3>
            <p>Fetching teams and members from the shared server.</p>
          </div>
        ) : teams.length ? (
          pagination.items.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              canManage={canManageOwnedRecord(currentUser, team)}
              onEditTeam={onEditTeam}
              onArchiveTeam={onArchiveTeam}
            />
          ))
        ) : (
          <div className="empty-state">
            <h3>No teams yet</h3>
            <p>Create a team to group members under a shared manager.</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label="teams" />
    </section>
  )
}

export function TeamCard({ team, canManage, onEditTeam, onArchiveTeam }) {
  const previewMembers = team.members.slice(0, 4)
  const extraMembers = Math.max(team.members.length - previewMembers.length, 0)

  return (
    <article className="team-card">
      <div className="team-card-header">
        <div className="team-avatar" aria-hidden="true">
          {team.name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="task-path">Manager &gt; {team.managerName}</p>
          <h3>{team.name}</h3>
        </div>
      </div>
      <p>{team.description || 'No description yet.'}</p>
      <div className="team-member-row">
        {previewMembers.length ? (
          previewMembers.map((member) => (
            <span className="member-pill" key={member.id}>
              {member.name}
            </span>
          ))
        ) : (
          <span className="member-pill muted">No members yet</span>
        )}
        {extraMembers > 0 && <span className="member-pill muted">+{extraMembers} more</span>}
      </div>
      <div className="project-meta-row">
        <strong>{team.members.length} members</strong>
        <span>{team.managerName}</span>
      </div>
      {canManage && (
        <div className="row-actions">
          <button type="button" onClick={() => onEditTeam(team)}>
            Edit
          </button>
          <button type="button" onClick={() => onArchiveTeam(team.id)}>
            Archive
          </button>
        </div>
      )}
    </article>
  )
}

export function AdminUsersPage({
  users,
  currentUser,
  isLoading,
  taskError,
  taskMessage,
  onRefresh,
  onUpdateUser,
}) {
  const activeUsers = users.filter((user) => user.isArchived !== true).length
  const managerUsers = users.filter((user) => user.role === 'manager').length
  const adminUsers = users.filter((user) => user.role === 'admin').length
  const pagination = usePaginatedRecords(users, 4)
  const overviewCards = [
    { label: 'Active users', value: activeUsers, tone: 'green' },
    { label: 'Managers', value: managerUsers, tone: 'blue' },
    { label: 'Admins', value: adminUsers, tone: 'amber' },
  ]

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h3 className="section-title">User management</h3>
        </div>
        <button type="button" className="ghost-button compact" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <div className="summary-grid team-summary">
        {overviewCards.map((card) => (
          <article className={`metric-card metric-${card.tone}`} key={card.label}>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      {taskMessage && <p className="form-message">{taskMessage}</p>}
      {taskError && (
        <div className="empty-state">
          <h3>Could not load users</h3>
          <p>{taskError}</p>
        </div>
      )}

      <div className="admin-user-grid">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading users</h3>
            <p>Fetching user accounts from the shared server.</p>
          </div>
        ) : users.length ? (
          pagination.items.map((person) => (
            <UserAdminCard
              key={getUserId(person)}
              person={person}
              isCurrentUser={getUserId(person) === currentUser?.id}
              onUpdateUser={onUpdateUser}
            />
          ))
        ) : (
          <div className="empty-state">
            <h3>No users found</h3>
            <p>Registered accounts will appear here.</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label="users" />
    </section>
  )
}

export function ActivityLogPage({
  auditLog,
  isLoading,
  taskError,
  taskMessage,
  onRefresh,
}) {
  const records = auditLog.items || []
  const pagination = usePaginatedRecords(records, 8)
  const userActions = records.filter((item) => item.entityType === 'User').length
  const taskActions = records.filter((item) => item.entityType === 'Task').length
  const overviewCards = [
    { label: 'Audit records', value: auditLog.total || records.length, tone: 'blue' },
    { label: 'User changes', value: userActions, tone: 'amber' },
    { label: 'Task changes', value: taskActions, tone: 'green' },
  ]

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h3 className="section-title">Activity log</h3>
        </div>
        <button type="button" className="ghost-button compact" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <div className="summary-grid team-summary">
        {overviewCards.map((card) => (
          <article className={`metric-card metric-${card.tone}`} key={card.label}>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      {taskMessage && <p className="form-message">{taskMessage}</p>}
      {taskError && (
        <div className="empty-state">
          <h3>Could not load activity log</h3>
          <p>{taskError}</p>
        </div>
      )}

      <div className="audit-log-list">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading activity log</h3>
            <p>Fetching the latest system actions from the shared server.</p>
          </div>
        ) : records.length ? (
          pagination.items.map((record) => (
            <article className="audit-log-card" key={record.id}>
              <div>
                <p className="task-path">
                  {record.actorName} {record.actorRole ? `> ${record.actorRole}` : ''}
                </p>
                <h3>{record.actionLabel}</h3>
                <p>{record.entityType} record {record.entityId ? `#${String(record.entityId).slice(-6)}` : ''}</p>
              </div>
              <div className="project-meta-row">
                <strong>{formatDate(record.createdAt)}</strong>
                <span>{Object.keys(record.metadata || {}).length ? JSON.stringify(record.metadata) : 'No metadata'}</span>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h3>No activity recorded yet</h3>
            <p>Admin and workspace changes will appear here once users start working.</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label="audit records" />
    </section>
  )
}

export function NotificationsPage({
  notifications,
  isLoading,
  taskError,
  taskMessage,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
  onDeleteNotification,
}) {
  const metrics = getNotificationMetrics(notifications)
  const pagination = usePaginatedRecords(notifications, 6)
  const overviewCards = [
    { label: 'Notifications', value: metrics.total, tone: 'blue' },
    { label: 'Unread', value: metrics.unread, tone: 'amber' },
    { label: 'Read', value: metrics.read, tone: 'green' },
  ]

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Notifications</p>
          <h3 className="section-title">Workspace alerts</h3>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button compact" onClick={onRefresh}>
            Refresh
          </button>
          <button
            type="button"
            className="primary-button compact"
            onClick={onMarkAllRead}
            disabled={!metrics.unread}
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="summary-grid team-summary">
        {overviewCards.map((card) => (
          <article className={`metric-card metric-${card.tone}`} key={card.label}>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      {taskMessage && <p className="form-message">{taskMessage}</p>}
      {taskError && (
        <div className="empty-state">
          <h3>Could not load notifications</h3>
          <p>{taskError}</p>
        </div>
      )}

      <div className="notification-list">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading notifications</h3>
            <p>Fetching alerts from the shared server.</p>
          </div>
        ) : notifications.length ? (
          pagination.items.map((notification) => (
            <article
              className={`notification-card ${notification.isRead ? '' : 'unread'}`}
              key={notification.id}
            >
              <button
                type="button"
                className="notification-main"
                onClick={() => onMarkRead(notification.id)}
              >
                <span className="notification-dot" aria-hidden="true" />
                <span>
                  <span className="task-path">
                    {notification.entityType || notification.type} &gt; {formatNotificationDate(notification.createdAt)}
                  </span>
                  <strong>{notification.title}</strong>
                  <small>{notification.message || 'No details included.'}</small>
                </span>
              </button>
              <div className="row-actions">
                {!notification.isRead && (
                  <button type="button" onClick={() => onMarkRead(notification.id)}>
                    Mark read
                  </button>
                )}
                <button type="button" onClick={() => onDeleteNotification(notification.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h3>No notifications yet</h3>
            <p>Task updates, activity submissions, and reminders will appear here.</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label="notifications" />
    </section>
  )
}

export function ArchivePage({
  archivedRecords,
  currentUser,
  isLoading,
  taskError,
  taskMessage,
  onRefresh,
  onRestore,
  onDelete,
}) {
  const [activeArchiveTab, setActiveArchiveTab] = useState('projects')
  const records = archivedRecords[activeArchiveTab] || []
  const pagination = usePaginatedRecords(records, 6)
  const archivedActivitiesCount = archivedRecords.activities?.length || 0
  const archivedTeamsCount = archivedRecords.teams?.length || 0
  const archivedUsersCount = currentUser?.role === 'admin' ? archivedRecords.users?.length || 0 : 0
  const overviewCards = [
    { label: 'Archived projects', value: archivedRecords.projects.length, tone: 'blue' },
    { label: 'Archived tasks', value: archivedRecords.tasks.length, tone: 'amber' },
    { label: 'Archived activities', value: archivedActivitiesCount, tone: 'green' },
    { label: 'Archived teams', value: archivedTeamsCount, tone: 'blue' },
    { label: 'Archived users', value: archivedUsersCount, tone: 'amber' },
    {
      label: 'Total records',
      value: archivedRecords.projects.length + archivedRecords.tasks.length + archivedActivitiesCount + archivedTeamsCount + archivedUsersCount,
      tone: 'neutral',
    },
  ]

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Archive</p>
          <h3 className="section-title">Archived records</h3>
        </div>
        <button type="button" className="ghost-button compact" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <div className="summary-grid team-summary">
        {overviewCards.map((card) => (
          <article className={`metric-card metric-${card.tone}`} key={card.label}>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="archive-tabs" aria-label="Archive record type">
        {[
          ['projects', 'Projects'],
          ['tasks', 'Tasks'],
          ['activities', 'Activities'],
          ['teams', 'Teams'],
          ...(currentUser?.role === 'admin' ? [['users', 'Users']] : []),
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={activeArchiveTab === value ? 'active' : ''}
            onClick={() => setActiveArchiveTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {taskMessage && <p className="form-message">{taskMessage}</p>}
      {taskError && (
        <div className="empty-state">
          <h3>Could not load archive</h3>
          <p>{taskError}</p>
        </div>
      )}

      <div className="archive-grid">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading archive</h3>
            <p>Fetching archived projects, tasks, activities, teams, and users from the shared server.</p>
          </div>
        ) : records.length ? (
          pagination.items.map((record) => (
            <ArchiveRecordCard
              key={record.id}
              record={record}
              type={activeArchiveTab}
              onRestore={onRestore}
              onDelete={onDelete}
              currentUser={currentUser}
            />
          ))
        ) : (
          <div className="empty-state">
            <h3>No archived {activeArchiveTab}</h3>
            <p>Records you archive will stay here until you restore them.</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label={activeArchiveTab} />
    </section>
  )
}

export function ArchiveRecordCard({ record, type, onRestore, onDelete, currentUser }) {
  const isProject = type === 'projects'
  const isActivity = type === 'activities'
  const isTeam = type === 'teams'
  const isUser = type === 'users'
  const recordId = isUser ? getUserId(record) : record.id
  const userName = isUser ? getUserDisplayName(record) : ''
  const permissions = getArchiveRecordPermissions(currentUser, type, record)

  return (
    <article className="archive-card">
      <div>
        <p className="task-path">
          {isProject
            ? 'Project'
            : isActivity
              ? 'Activity'
              : isTeam
                ? 'Team'
                : isUser
                  ? 'User'
                  : record.project || 'Task'} &gt; Archived
        </p>
        <h3>{isUser ? userName : isProject || isTeam ? record.name : record.title}</h3>
        <p>
          {isUser
            ? record.email || 'No email address.'
            : record.description
            || (isProject
              ? 'No project description.'
              : isActivity
                ? 'No activity description.'
                : isTeam
                  ? 'No team description.'
                  : 'No task description.')}
        </p>
      </div>
      <div className="project-meta-row">
        {isUser ? (
          <>
            <strong>{record.role || 'member'}</strong>
            <span>{record.username || 'Archived account'}</span>
          </>
        ) : isProject || isTeam ? (
          <>
            <strong>{isTeam ? `${record.members?.length || 0} members` : record.status || 'Project'}</strong>
            <span>{isTeam ? record.managerName || 'No manager' : record.priority || 'Archived'}</span>
          </>
        ) : (
          <>
            <StatusBadge value={record.status} />
            <PriorityBadge value={record.priority} />
          </>
        )}
      </div>
      {(permissions.canRestore || permissions.canDelete) && (
        <div className="row-actions">
          {permissions.canRestore && (
            <button type="button" className="primary-button compact" onClick={() => onRestore(type, recordId)}>
              Restore
            </button>
          )}
          {permissions.canDelete && (
            <button type="button" className="ghost-button compact danger-action" onClick={() => onDelete(type, recordId)}>
              Delete permanently
            </button>
          )}
        </div>
      )}
    </article>
  )
}

export function UserAdminCard({ person, isCurrentUser, onUpdateUser }) {
  const userId = getUserId(person)
  const archived = person.isArchived === true
  const displayName = getUserDisplayName(person)

  return (
    <article className={`admin-user-card ${archived ? 'archived' : ''}`}>
      <div className="team-card-header">
        <UserAvatar user={person} className="team-avatar" label={displayName} />
        <div>
          <p className="task-path">{person.email || 'No email'}</p>
          <h3>{displayName}</h3>
        </div>
      </div>

      <div className="admin-user-controls">
        <label>
          Role
          <select
            value={person.role || 'member'}
            onChange={(event) => onUpdateUser(userId, { role: event.target.value })}
          >
            {['admin', 'manager', 'member'].map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ghost-button compact"
          disabled={isCurrentUser && !archived}
          onClick={() => onUpdateUser(userId, { isArchived: !archived })}
        >
          {archived ? 'Restore' : 'Archive'}
        </button>
      </div>

      <div className="project-meta-row">
        <strong>{person.role || 'member'}</strong>
        <span>{archived ? 'Archived' : 'Active'}</span>
      </div>
    </article>
  )
}
