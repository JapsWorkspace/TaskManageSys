import { useState } from 'react'
import { Archive, ArrowLeft, ArrowUpRight, Folder, LayoutGrid, List, Pencil, Plus, Search, SlidersHorizontal, UsersRound } from 'lucide-react'
import { getFilteredProjectTasks, getProjectProgress, getProjectStatusBuckets } from '../utils/projectLogic.jsx'
import { PRIORITIES, STATUSES } from '../utils/taskLogic.jsx'
import { canManageOwnedRecord } from '../utils/taskPermissions.jsx'
import { formatDate } from '../utils/display.jsx'
import { PaginationControls, StatusBadge, PriorityBadge } from '../components/common/WorkspaceUi.jsx'
import { usePaginatedRecords } from '../utils/usePaginatedRecords.jsx'

export function ProjectsPage({
  projects,
  tasks,
  isLoading,
  taskError,
  taskMessage,
  canManage,
  currentUser,
  onRefresh,
  onCreateProject,
  onOpenProject,
  onEditProject,
  onArchiveProject,
}) {
  const pagination = usePaginatedRecords(projects, 6)

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Projects</p>
          <h3 className="section-title">Workspace project board</h3>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button compact" onClick={onRefresh}>
            Refresh
          </button>
          {canManage && (
            <button type="button" className="primary-button compact" onClick={onCreateProject}>
              Add project
            </button>
          )}
        </div>
      </div>

      {taskMessage && <p className="form-message">{taskMessage}</p>}
      {taskError && (
        <div className="empty-state">
          <h3>Could not load projects</h3>
          <p>{taskError}</p>
        </div>
      )}

      <div className="project-grid">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading projects</h3>
            <p>Fetching the shared project list from the server.</p>
          </div>
        ) : projects.length ? (
          pagination.items.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              progress={getProjectProgress(project.id, tasks)}
              canManage={canManageOwnedRecord(currentUser, project)}
              onOpenProject={onOpenProject}
              onEditProject={onEditProject}
              onArchiveProject={onArchiveProject}
            />
          ))
        ) : (
          <div className="empty-state">
            <h3>No projects yet</h3>
            <p>Create a project to group related tasks and teammates.</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label="projects" />
    </section>
  )
}

export function ProjectCard({
  project,
  progress,
  canManage,
  onOpenProject,
  onEditProject,
  onArchiveProject,
}) {
  const teamSize = new Set([
    project.managerId,
    ...(project.memberIds || []),
  ].filter(Boolean)).size

  return (
    <article className="project-card">
      <button type="button" className="project-open-button" onClick={() => onOpenProject(project)}>
        <header className="project-card-header">
          <span className="project-card-icon" aria-hidden="true"><Folder size={20} /></span>
          <span className="project-card-kicker">{project.status} project</span>
          <span className="project-card-open-copy">Open <ArrowUpRight size={15} aria-hidden="true" /></span>
        </header>

        <div className="project-card-copy">
          <h3>{project.name}</h3>
          <p className="project-card-description">{project.description || 'No description yet.'}</p>
        </div>

        <div className="project-card-badges">
          <StatusBadge value={project.status} />
          <PriorityBadge value={project.priority} />
        </div>

        <div className="project-card-progress-copy">
          <span>Overall progress</span>
          <strong>{progress.percent}%</strong>
        </div>
        <div className="project-progress" aria-label={`${progress.percent}% complete`}>
          <span style={{ width: `${progress.percent}%` }} />
        </div>
        <p className="project-card-task-count">
          {progress.completed} of {progress.total} {progress.total === 1 ? 'task' : 'tasks'} completed
        </p>
      </button>

      <footer className="project-card-footer">
        <div className="project-card-manager">
          <span className="project-manager-avatar" aria-hidden="true">
            {(project.managerName || 'M').trim().charAt(0).toUpperCase()}
          </span>
          <span>
            <small>Manager</small>
            <strong>{project.managerName}</strong>
          </span>
        </div>
        <span className="project-card-team"><UsersRound size={15} aria-hidden="true" />{teamSize} {teamSize === 1 ? 'member' : 'members'}</span>
        {canManage && (
          <div className="project-card-actions">
            <button type="button" aria-label={`Edit ${project.name}`} onClick={() => onEditProject(project)}>
              <Pencil size={15} aria-hidden="true" />
              Edit
            </button>
            <button type="button" aria-label={`Archive ${project.name}`} onClick={() => onArchiveProject(project.id)}>
              <Archive size={15} aria-hidden="true" />
              Archive
            </button>
          </div>
        )}
      </footer>
    </article>
  )
}

export function ProjectDetailsPage({
  project,
  tasks,
  taskMessage,
  canManage,
  onBack,
  onOpenTask,
  onStatusChange,
  onCreateTask,
  onEditProject,
  onArchiveProject,
}) {
  const [boardView, setBoardView] = useState('board')
  const [taskSearch, setTaskSearch] = useState('')
  const [memberFilter, setMemberFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const progress = getProjectProgress(project.id, tasks)
  const projectPeople = [
    { id: project.managerId, name: project.managerName },
    ...(project.members || []),
  ].filter((person, index, people) => person.id && people.findIndex((item) => item.id === person.id) === index)
  const visibleTasks = getFilteredProjectTasks(tasks, {
    search: taskSearch,
    memberId: memberFilter,
    priority: priorityFilter,
  })
  const statusBuckets = getProjectStatusBuckets(visibleTasks)

  function getPersonInitials(name) {
    return String(name || 'Unassigned')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
  }

  function renderTaskCard(task, index) {
    const taskCode = task.id ? `TASK-${String(task.id).slice(-4).toUpperCase()}` : `TASK-${index + 1}`

    return (
      <article className="project-board-task" key={`project-task-${task.id}`}>
        <button type="button" className="project-task-open" onClick={() => onOpenTask(task)}>
          <span className="project-task-code">{taskCode}</span>
          <h4>{task.title}</h4>
          <p>{task.description || 'No task description yet.'}</p>
        </button>

        <div className="project-task-labels">
          <PriorityBadge value={task.priority} />
          {(task.tags || []).slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
          {!task.tags?.length && task.category && <span>{task.category}</span>}
        </div>

        <div className="project-task-assignment">
          <span className="project-member-avatar" aria-hidden="true">{getPersonInitials(task.owner)}</span>
          <span>
            <small>Assigned to</small>
            <strong>{task.owner || 'Unassigned'}</strong>
          </span>
          <time dateTime={task.dueDate || undefined}>{formatDate(task.dueDate)}</time>
        </div>

        <div className="project-task-footer">
          <span>{Math.max(0, Math.min(100, Number(task.progress) || 0))}% complete</span>
          {onStatusChange ? (
            <select
              aria-label={`Status for ${task.title}`}
              value={task.status}
              onChange={(event) => onStatusChange(task, event.target.value)}
            >
              {STATUSES.map((nextStatus) => <option key={nextStatus}>{nextStatus}</option>)}
            </select>
          ) : (
            <StatusBadge value={task.status} />
          )}
        </div>
      </article>
    )
  }

  return (
    <section className="project-detail-page">
      <div className="project-detail-toolbar">
        <button type="button" className="project-back-button" onClick={onBack}>
          <ArrowLeft size={17} aria-hidden="true" />
          Back to projects
        </button>
        {canManage && (
          <div className="project-detail-primary-actions">
            <button type="button" className="project-action-button" onClick={() => onEditProject(project)}>
              <Pencil size={16} aria-hidden="true" />
              Edit project
            </button>
            <button type="button" className="project-action-button" onClick={() => onArchiveProject(project.id)}>
              <Archive size={16} aria-hidden="true" />
              Archive
            </button>
            <button type="button" className="project-new-task-button" onClick={onCreateTask}>
              <Plus size={17} aria-hidden="true" />
              New task
            </button>
          </div>
        )}
      </div>

      <article className="project-summary-card">
        <div className="project-summary-main">
          <div className="project-summary-icon" aria-hidden="true"><Folder size={24} /></div>
          <div className="project-summary-copy">
            <p className="eyebrow">{project.status} project</p>
            <h2>{project.name}</h2>
            <p>{project.description || 'No description yet.'}</p>
            <div className="project-summary-meta">
              <span><small>Manager</small><strong>{project.managerName}</strong></span>
              <span><small>Status</small><strong>{project.status}</strong></span>
              <span><small>Priority</small><strong>{project.priority}</strong></span>
            </div>
          </div>
        </div>

        <div className="project-summary-progress">
          <div
            className="project-progress-ring"
            style={{ '--project-progress': `${progress.percent * 3.6}deg` }}
            aria-label={`${progress.percent}% complete`}
          >
            <strong>{progress.percent}%</strong>
          </div>
          <span>
            <small>Overall progress</small>
            <strong>{progress.completed} of {progress.total} tasks complete</strong>
          </span>
        </div>

        <div className="project-summary-team">
          <div>
            <small>Project team</small>
            <strong>{projectPeople.length} {projectPeople.length === 1 ? 'member' : 'members'}</strong>
          </div>
          <div className="project-member-stack" aria-label={projectPeople.map((person) => person.name).join(', ') || 'No project members'}>
            {projectPeople.slice(0, 5).map((person) => (
              <span className="project-member-avatar" key={person.id} title={person.name}>
                {getPersonInitials(person.name)}
              </span>
            ))}
            {projectPeople.length > 5 && <span className="project-member-avatar more">+{projectPeople.length - 5}</span>}
          </div>
        </div>
      </article>

      {taskMessage && <p className="form-message">{taskMessage}</p>}

      <section className="project-work-section">
        <header className="project-work-heading">
          <div>
            <p className="eyebrow">Project work</p>
            <h3>Team task board</h3>
            <p>Track each member&apos;s work through the project workflow.</p>
          </div>
          <div className="project-view-toggle" aria-label="Task view">
            <button type="button" className={boardView === 'board' ? 'active' : ''} onClick={() => setBoardView('board')}>
              <LayoutGrid size={16} aria-hidden="true" />
              Board
            </button>
            <button type="button" className={boardView === 'list' ? 'active' : ''} onClick={() => setBoardView('list')}>
              <List size={16} aria-hidden="true" />
              List
            </button>
          </div>
        </header>

        <div className="project-board-filters">
          <label className="project-task-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search tasks or members</span>
            <input
              type="search"
              value={taskSearch}
              onChange={(event) => setTaskSearch(event.target.value)}
              placeholder="Search tasks or members..."
            />
          </label>
          <span className="project-filter-label"><SlidersHorizontal size={15} aria-hidden="true" />Filter</span>
          <select aria-label="Filter by member" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}>
            <option value="all">All members</option>
            {projectPeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
          <select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="all">All priorities</option>
            {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
          </select>
          <strong className="project-visible-count">{visibleTasks.length} of {tasks.length} tasks</strong>
        </div>

        {boardView === 'board' ? (
          <div className="project-board-scroll">
            <div className="project-kanban-board">
              {statusBuckets.map((bucket) => (
                <section className={`project-kanban-column status-${bucket.status.toLowerCase().replace(/\s+/g, '-')}`} key={bucket.status}>
                  <div className="kanban-heading">
                    <span className="project-status-dot" aria-hidden="true" />
                    <strong>{bucket.status}</strong>
                    <span className="project-column-count">{bucket.tasks.length}</span>
                  </div>
                  <div className="project-kanban-list">
                    {bucket.tasks.length
                      ? bucket.tasks.map((task, index) => renderTaskCard(task, index))
                      : <div className="project-kanban-empty"><p>No {bucket.status.toLowerCase()} tasks.</p></div>}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="project-task-list-view">
            {visibleTasks.length
              ? visibleTasks.map((task, index) => renderTaskCard(task, index))
              : <div className="project-kanban-empty"><p>No tasks match these filters.</p></div>}
          </div>
        )}
      </section>
    </section>
  )
}
