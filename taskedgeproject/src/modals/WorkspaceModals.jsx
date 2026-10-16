import { useEffect, useState } from 'react'
import { PROJECT_PRIORITIES, PROJECT_STATUSES, getEligibleProjectPeople } from '../utils/projectLogic.jsx'
import { PRIORITIES, STATUSES, getRecurrenceSummary, removeSubtaskFromList, toggleSubtaskInList } from '../utils/taskLogic.jsx'
import { getCommentAuthor, getUserId, getInitials } from '../utils/display.jsx'

export function TaskProgressModal({ values, isSaving, taskMessage, onClose, onSave }) {
  const [status, setStatus] = useState(values.status)
  const [progress, setProgress] = useState(values.progress)
  const [subtasks, setSubtasks] = useState(values.subtasks)
  const [subtaskTitle, setSubtaskTitle] = useState('')

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isSaving, onClose])

  function addSubtask(event) {
    event.preventDefault()
    const title = subtaskTitle.trim()
    if (!title) return
    setSubtasks((current) => [...current, { title, completed: false }])
    setSubtaskTitle('')
  }

  return (
    <div className="task-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isSaving && onClose()}>
      <section className="task-progress-modal" role="dialog" aria-modal="true" aria-labelledby="task-progress-title">
        <header className="task-progress-header">
          <div>
            <p className="eyebrow">Task progress</p>
            <h3 id="task-progress-title">Update progress</h3>
            <p>{values.title}</p>
          </div>
          <button type="button" className="task-modal-close" aria-label="Close progress editor" onClick={onClose} disabled={isSaving}>×</button>
        </header>

        <form
          className="task-progress-form"
          onSubmit={(event) => {
            event.preventDefault()
            onSave({ taskId: values.taskId, status, progress, subtasks })
          }}
        >
          <label>
            <span className="task-field-label">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUSES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <label>
            <span className="task-progress-label"><span className="task-field-label">Completion</span><strong>{progress}%</strong></span>
            <input type="range" min="0" max="100" step="5" value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
          </label>

          <div className="task-progress-subtasks">
            <span className="task-field-label">Subtasks</span>
            {subtasks.length ? subtasks.map((subtask, index) => (
              <div className="task-progress-subtask" key={`${subtask.title}-${index}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(subtask.completed)}
                    onChange={() => setSubtasks((current) => toggleSubtaskInList(current, index))}
                  />
                  <span>{subtask.title}</span>
                </label>
                <button type="button" className="ghost-button compact" onClick={() => setSubtasks((current) => removeSubtaskFromList(current, index))}>Remove</button>
              </div>
            )) : <p className="muted-copy">No subtasks yet.</p>}
            <div className="task-progress-add-row">
              <input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="Add a subtask" />
              <button type="button" className="ghost-button compact" onClick={addSubtask}>Add</button>
            </div>
          </div>

          {taskMessage && <p className="form-message">{taskMessage}</p>}

          <footer className="task-progress-footer">
            <button type="button" className="ghost-button" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save progress'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function TaskPeoplePicker({ label, name, people, selectedIds, onChange, placeholder, emptyMessage = 'No people available.', excludedIds = [] }) {
  const excluded = new Set(excludedIds.map(String))
  const selectablePeople = people.filter((person) => person.role !== 'admin' && !excluded.has(String(getUserId(person))))
  const selectableIds = new Set(selectablePeople.map((person) => String(getUserId(person))))
  const selectedPeople = selectablePeople.filter((person) => selectedIds.includes(getUserId(person)))
  const submittedIds = selectedIds.filter((id) => selectableIds.has(String(id)))

  function togglePerson(personId) {
    onChange(selectedIds.includes(personId)
      ? selectedIds.filter((id) => id !== personId)
      : [...selectedIds, personId])
  }

  return (
    <div className="task-people-field">
      <span className="task-field-label">{label}</span>
      {submittedIds.map((id) => <input key={id} type="hidden" name={name} value={id} />)}
      <details className="task-people-picker">
        <summary>
          <span className="task-field-icon people" aria-hidden="true" />
          <span>{selectedPeople.length ? `${selectedPeople.length} ${selectedPeople.length === 1 ? 'person' : 'people'} selected` : placeholder}</span>
          <span className="task-picker-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="task-people-menu">
          {selectablePeople.length ? selectablePeople.map((person) => {
            const personId = getUserId(person)
            const selected = selectedIds.includes(personId)
            return (
              <button key={personId} type="button" className={selected ? 'selected' : ''} onClick={() => togglePerson(personId)}>
                <span className="task-person-avatar">{getInitials(person)}</span>
                <span>{getCommentAuthor(person)}</span>
                <span className="task-person-check" aria-hidden="true">{selected ? '✓' : ''}</span>
              </button>
            )
          }) : <p>{emptyMessage}</p>}
        </div>
      </details>
      {selectedPeople.length > 0 && (
        <div className="task-person-chips">
          {selectedPeople.map((person) => (
            <button key={getUserId(person)} type="button" onClick={() => togglePerson(getUserId(person))}>
              <span>{getInitials(person)}</span>
              {getCommentAuthor(person)}
              <b aria-hidden="true">×</b>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TaskDependencyPicker({ tasks, selectedIds, onChange, emptyMessage }) {
  const selectedTasks = tasks.filter((task) => selectedIds.includes(task.id))

  function toggleTask(taskId) {
    onChange(selectedIds.includes(taskId)
      ? selectedIds.filter((id) => id !== taskId)
      : [...selectedIds, taskId])
  }

  return (
    <div className="task-dependency-field">
      <span className="task-field-label">Dependencies</span>
      {selectedIds.map((id) => <input key={id} type="hidden" name="dependencyIds" value={id} />)}
      <details className="task-dependency-picker">
        <summary>
          <span>{selectedTasks.length ? `${selectedTasks.length} prerequisite ${selectedTasks.length === 1 ? 'task' : 'tasks'} selected` : 'Select prerequisite tasks'}</span>
          <span className="task-picker-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="task-people-menu">
          {tasks.length ? tasks.map((task) => {
            const selected = selectedIds.includes(task.id)
            return (
              <button key={task.id} type="button" className={selected ? 'selected' : ''} onClick={() => toggleTask(task.id)}>
                <span className="task-dependency-dot" aria-hidden="true" />
                <span>{task.title}</span>
                <span className="task-person-check" aria-hidden="true">{selected ? '✓' : ''}</span>
              </button>
            )
          }) : <p>{emptyMessage}</p>}
        </div>
      </details>
      {selectedTasks.length > 0 && (
        <div className="task-dependency-chips">
          {selectedTasks.map((task) => (
            <button key={task.id} type="button" onClick={() => toggleTask(task.id)}>{task.title}<b aria-hidden="true">×</b></button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TaskModal({ formState, onClose, onSubmit, projects, users, tasks, isSaving, taskMessage }) {
  const values = formState.values
  const isEditing = formState.mode === 'edit'
  const [projectId, setProjectId] = useState(values.projectId || '')
  const [assigneeId, setAssigneeId] = useState(values.assigneeId || '')
  const [collaboratorIds, setCollaboratorIds] = useState(values.collaboratorIds || [])
  const [watcherIds, setWatcherIds] = useState(values.watcherIds || [])
  const [dependencyIds, setDependencyIds] = useState(values.dependencyIds || [])
  const [description, setDescription] = useState(values.description || '')
  const [recurrenceFrequency, setRecurrenceFrequency] = useState(values.recurrenceFrequency || 'none')
  const [recurrenceInterval, setRecurrenceInterval] = useState(values.recurrenceInterval || 1)
  const [recurrenceCount, setRecurrenceCount] = useState(values.recurrenceCount || 1)
  const dependencyOptions = tasks.filter((task) => task.id !== values.id && task.type !== 'individual-activity' && task.projectId === projectId)
  const selectedProject = projects.find((project) => project.id === projectId)
  const allowedIds = new Set([selectedProject?.managerId, ...(selectedProject?.memberIds || [])].filter(Boolean))
  const projectPeople = users.filter((person) => allowedIds.has(getUserId(person)))
  const selectedAssignee = users.find((person) => getUserId(person) === assigneeId)

  function chooseProject(nextProjectId) {
    const nextProject = projects.find((project) => project.id === nextProjectId)
    setProjectId(nextProjectId)
    setAssigneeId(nextProject?.managerId || nextProject?.memberIds?.[0] || '')
    setCollaboratorIds([])
    setWatcherIds([])
    setDependencyIds([])
  }

  return (
    <div className="app-modal-backdrop task-modal-backdrop" role="presentation">
      <section className="app-modal task-modal" role="dialog" aria-modal="true" aria-labelledby="task-form-title">
        <header className="task-modal-header">
          <div>
            <p className="eyebrow">{isEditing ? 'Update task' : 'New task'}</p>
            <h3 id="task-form-title">{isEditing ? 'Edit task' : 'Create a task'}</h3>
            <p>Capture the details now. You can always refine them later.</p>
          </div>
          <button type="button" className="task-modal-close" onClick={onClose} aria-label="Close task form">×</button>
        </header>

        <form
          className="task-create-form"
          onSubmit={onSubmit}
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key === 'Enter') event.currentTarget.requestSubmit()
          }}
        >
          <div className="task-form-scroll">
            <div className="task-form-main">
              <label>
                <span className="task-field-label">Task title <small>Required</small></span>
                <input name="title" defaultValue={values.title} maxLength="120" placeholder="Review final onboarding screens" required autoFocus />
              </label>
              <label>
                <span className="task-label-row"><span className="task-field-label">Description</span><small>{description.length} / 1,000</small></span>
                <textarea name="description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength="1000" rows="4" placeholder="Add context, links, or acceptance criteria..." required />
              </label>
              <div className="task-inline-fields">
                <label>
                  <span className="task-field-label">Status</span>
                  <select name="status" defaultValue={values.status}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
                </label>
                <label>
                  <span className="task-field-label">Priority</span>
                  <select name="priority" defaultValue={values.priority}>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select>
                </label>
              </div>
              <label>
                <span className="task-field-label">Tags <small>Optional</small></span>
                <span className="task-input-with-icon"><span className="task-field-icon tag" aria-hidden="true">◇</span><input name="tags" defaultValue={values.tags} placeholder="Add tags separated by commas" /></span>
              </label>

              <TaskPeoplePicker label="Collaborators" name="collaboratorIds" people={projectPeople} selectedIds={collaboratorIds} onChange={setCollaboratorIds} placeholder="Add people who will work on this task" />
              <TaskPeoplePicker label="Watchers" name="watcherIds" people={projectPeople} selectedIds={watcherIds} onChange={setWatcherIds} placeholder="Notify people about updates" />

              <details className="task-advanced-options">
                <summary>Advanced options <span className="task-advanced-action" aria-hidden="true" /></summary>
                <div className="task-advanced-content">
                <div className="task-advanced-grid">
                  <label>
                    <span className="task-field-label">Category</span>
                    <input name="category" defaultValue={values.category} placeholder="Optional" />
                  </label>
                  <TaskDependencyPicker
                    tasks={dependencyOptions}
                    selectedIds={dependencyIds}
                    onChange={setDependencyIds}
                    emptyMessage={projectId ? 'No other tasks are available in this project.' : 'Select a project first.'}
                  />
                  <label className="wide">
                    <span className="task-field-label">Subtasks</span>
                    <textarea name="subtaskLines" defaultValue={values.subtaskLines} rows="3" placeholder="One subtask per line" />
                  </label>
                  <div className="task-recurrence-fields wide">
                    <label><span className="task-field-label">Repeat</span><select name="recurrenceFrequency" value={recurrenceFrequency} onChange={(event) => setRecurrenceFrequency(event.target.value)}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
                    <label><span className="task-field-label">Every</span><input name="recurrenceInterval" type="number" min="1" max="30" value={recurrenceInterval} disabled={recurrenceFrequency === 'none'} onChange={(event) => setRecurrenceInterval(event.target.value)} /></label>
                    <label><span className="task-field-label">Occurrences</span><input name="recurrenceCount" type="number" min="1" max="24" value={recurrenceCount} disabled={recurrenceFrequency === 'none'} onChange={(event) => setRecurrenceCount(event.target.value)} /></label>
                    <p>{getRecurrenceSummary(recurrenceFrequency, recurrenceInterval, recurrenceCount)}</p>
                  </div>
                </div>
                </div>
              </details>
            </div>

            <aside className="task-form-side">
              <p className="task-section-label">Scheduling</p>
              <label><span className="task-field-label">Start date</span><input name="startDate" type="date" defaultValue={values.startDate} /></label>
              <label><span className="task-field-label">Due date</span><input name="dueDate" type="date" defaultValue={values.dueDate} required /></label>
              <label><span className="task-field-label">Due time</span><input name="dueTime" type="time" defaultValue={values.dueTime} /></label>
              <div className="task-side-divider" />
              <p className="task-section-label">Ownership</p>
              <label>
                <span className="task-field-label">Project <small>Required</small></span>
                <select name="projectId" value={projectId} onChange={(event) => chooseProject(event.target.value)} required>
                  <option value="">Select project</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </label>
              <label>
                <span className="task-field-label">Assignee</span>
                <select name="assigneeId" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                  <option value="">Unassigned</option>
                  {projectPeople.map((person) => <option key={getUserId(person)} value={getUserId(person)}>{getCommentAuthor(person)}</option>)}
                </select>
                {selectedAssignee && <small className="task-assignee-caption">{selectedAssignee.role || 'Project member'}</small>}
              </label>
            </aside>
          </div>

          {taskMessage && <p className="form-message task-modal-message">{taskMessage}</p>}
          <footer className="task-modal-footer">
            <span className="task-keyboard-hint"><kbd>Ctrl</kbd><kbd>↵</kbd> to create task</span>
            <div>
              <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary-button" disabled={isSaving}><span aria-hidden="true">＋</span>{isSaving ? 'Saving...' : isEditing ? 'Save changes' : 'Create task'}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function WorkspaceFormModal({ id, eyebrow, title, description, className = '', submitLabel, taskMessage, onClose, onSubmit, children }) {
  return (
    <div className="app-modal-backdrop workspace-modal-backdrop" role="presentation">
      <section className={`app-modal workspace-form-modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <header className="task-modal-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h3 id={id}>{title}</h3>
            <p>{description}</p>
          </div>
          <button type="button" className="task-modal-close" onClick={onClose} aria-label={`Close ${title.toLowerCase()} form`}>×</button>
        </header>
        <form
          className="workspace-modal-form"
          onSubmit={onSubmit}
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key === 'Enter') event.currentTarget.requestSubmit()
          }}
        >
          <div className="workspace-modal-scroll">{children}</div>
          {taskMessage && <p className="form-message task-modal-message">{taskMessage}</p>}
          <footer className="task-modal-footer">
            <span className="task-keyboard-hint"><kbd>Ctrl</kbd><kbd>↵</kbd> to save</span>
            <div>
              <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary-button"><span aria-hidden="true">＋</span>{submitLabel}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function ProjectModal({ formState, users, currentUser, taskMessage, onClose, onSubmit }) {
  const values = formState.values
  const isEditing = formState.mode === 'edit'
  const managerOptions = [...(currentUser?.role === 'manager' ? [currentUser] : []), ...users.filter((person) => person.role === 'manager')]
    .filter((person, index, people) => person && people.findIndex((candidate) => getUserId(candidate) === getUserId(person)) === index)
  const initialManagerId = managerOptions.some((person) => getUserId(person) === values.managerId)
    ? values.managerId
    : getUserId(managerOptions[0])
  const [memberIds, setMemberIds] = useState(() => (values.memberIds || []).filter((id) => id !== initialManagerId))
  const [managerId, setManagerId] = useState(initialManagerId)
  const memberCandidates = users.filter((person) => person.role !== 'admin' && getUserId(person) !== managerId)

  return (
    <WorkspaceFormModal
      id="project-form-title"
      eyebrow={isEditing ? 'Update project' : 'New project'}
      title={isEditing ? 'Edit project' : 'Create project'}
      description="Set the project direction, ownership, and working group."
      className="project-form-modal"
      submitLabel={isEditing ? 'Save changes' : 'Create project'}
      taskMessage={taskMessage}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="workspace-modal-grid">
        <section className="workspace-modal-primary">
          <p className="task-section-label">Project details</p>
          <label><span className="task-field-label">Project name <small>Required</small></span><input name="name" defaultValue={values.name} maxLength="120" placeholder="Website redesign" required autoFocus /></label>
          <label><span className="task-field-label">Description</span><textarea name="description" defaultValue={values.description} rows="6" maxLength="1000" placeholder="Describe the project goal and expected outcome..." /></label>
        </section>
        <aside className="workspace-modal-side">
          <p className="task-section-label">Configuration</p>
          <div className="task-inline-fields">
            <label><span className="task-field-label">Status</span><select name="status" defaultValue={values.status}>{PROJECT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label><span className="task-field-label">Priority</span><select name="priority" defaultValue={values.priority}>{PROJECT_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
          </div>
          <label><span className="task-field-label">Manager</span><select name="managerId" value={managerId || ''} required onChange={(event) => { setManagerId(event.target.value); setMemberIds((ids) => ids.filter((id) => id !== event.target.value)) }}><option value="" disabled>Select a manager</option>{managerOptions.map((person) => <option key={getUserId(person)} value={getUserId(person)}>{getCommentAuthor(person)}</option>)}</select></label>
          <TaskPeoplePicker label="Members" name="memberIds" people={memberCandidates} selectedIds={memberIds} onChange={setMemberIds} placeholder="Add project members" emptyMessage="No eligible members are available." />
        </aside>
      </div>
    </WorkspaceFormModal>
  )
}

export function TeamModal({ formState, users, currentUser, taskMessage, onClose, onSubmit }) {
  const values = formState.values
  const isEditing = formState.mode === 'edit'
  const managerOptions = [...(currentUser?.role === 'manager' ? [currentUser] : []), ...users.filter((person) => person.role === 'manager')]
    .filter((person, index, people) => person && people.findIndex((candidate) => getUserId(candidate) === getUserId(person)) === index)
  const initialManagerId = managerOptions.some((person) => getUserId(person) === values.managerId)
    ? values.managerId
    : getUserId(managerOptions[0])
  const [memberIds, setMemberIds] = useState(() => (values.memberIds || []).filter((id) => id !== initialManagerId))
  const [managerId, setManagerId] = useState(initialManagerId)
  const memberCandidates = users.filter((person) => person.role !== 'admin' && getUserId(person) !== managerId)

  return (
    <WorkspaceFormModal
      id="team-form-title"
      eyebrow={isEditing ? 'Update team' : 'New team'}
      title={isEditing ? 'Edit team' : 'Create team'}
      description="Define the team and choose who collaborates in it."
      className="team-form-modal"
      submitLabel={isEditing ? 'Save changes' : 'Create team'}
      taskMessage={taskMessage}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="workspace-modal-grid">
        <section className="workspace-modal-primary">
          <p className="task-section-label">Team details</p>
          <label><span className="task-field-label">Team name <small>Required</small></span><input name="name" defaultValue={values.name} maxLength="120" placeholder="Product design" required autoFocus /></label>
          <label><span className="task-field-label">Description</span><textarea name="description" defaultValue={values.description} rows="6" maxLength="1000" placeholder="Describe this team’s purpose and responsibilities..." /></label>
        </section>
        <aside className="workspace-modal-side">
          <p className="task-section-label">Ownership</p>
          <label><span className="task-field-label">Manager</span><select name="managerId" value={managerId || ''} required onChange={(event) => { setManagerId(event.target.value); setMemberIds((ids) => ids.filter((id) => id !== event.target.value)) }}><option value="" disabled>Select a manager</option>{managerOptions.map((person) => <option key={getUserId(person)} value={getUserId(person)}>{getCommentAuthor(person)}</option>)}</select></label>
          <TaskPeoplePicker label="Members" name="memberIds" people={memberCandidates} selectedIds={memberIds} onChange={setMemberIds} placeholder="Add team members" emptyMessage="No eligible members are available." />
        </aside>
      </div>
    </WorkspaceFormModal>
  )
}

export function ActivityModal({ formState, projects, users, taskMessage, onClose, onSubmit }) {
  const values = formState.values
  const isEditing = formState.mode === 'edit'
  const [projectId, setProjectId] = useState(values.projectId || '')
  const [recipientIds, setRecipientIds] = useState(values.recipientIds || [])
  const selectedProject = projects.find((project) => project.id === projectId)
  const eligibleRecipients = getEligibleProjectPeople(selectedProject, users)

  return (
    <WorkspaceFormModal
      id="activity-form-title"
      eyebrow={isEditing ? 'Update activity' : 'New activity'}
      title={isEditing ? 'Edit individual activity' : 'Create individual activity'}
      description="Collect private submissions and review each recipient independently."
      className="activity-form-modal"
      submitLabel={isEditing ? 'Save changes' : 'Create activity'}
      taskMessage={taskMessage}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="workspace-modal-grid activity-modal-grid">
        <section className="workspace-modal-primary">
          <p className="task-section-label">Activity details</p>
          <label><span className="task-field-label">Activity title <small>Required</small></span><input name="title" defaultValue={values.title} maxLength="120" placeholder="Submit design review" required autoFocus /></label>
          <label><span className="task-field-label">Description</span><textarea name="description" defaultValue={values.description} rows="5" maxLength="1000" placeholder="Add instructions, criteria, or submission notes..." /></label>
          {!isEditing && <TaskPeoplePicker label="Recipients" name="recipientIds" people={eligibleRecipients} selectedIds={recipientIds} onChange={setRecipientIds} placeholder="Select project recipients" emptyMessage={projectId ? 'No project members are available.' : 'Select a project first.'} />}
          <div className="activity-policy-switches">
            <p className="task-section-label">Response policy</p>
            <label className="workspace-check-row"><input name="allowTextResponse" type="checkbox" defaultChecked={values.allowTextResponse} /><span><b>Text response</b><small>Recipients may submit a written response.</small></span></label>
            <label className="workspace-check-row"><input name="requireAttachment" type="checkbox" defaultChecked={values.requireAttachment} /><span><b>Require attachment</b><small>A file must be included with every submission.</small></span></label>
            <label className="workspace-check-row"><input name="allowResubmission" type="checkbox" defaultChecked={values.allowResubmission} /><span><b>Allow resubmission</b><small>Returned work can be submitted again.</small></span></label>
          </div>
        </section>
        <aside className="workspace-modal-side">
          <p className="task-section-label">Scheduling</p>
          {!isEditing && <label><span className="task-field-label">Project <small>Required</small></span><select name="projectId" value={projectId} onChange={(event) => { setProjectId(event.target.value); setRecipientIds([]) }} required><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
          <label><span className="task-field-label">Priority</span><select name="priority" defaultValue={values.priority}>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
          <div className="task-inline-fields"><label><span className="task-field-label">Start date</span><input name="startDate" type="date" defaultValue={values.startDate} /></label><label><span className="task-field-label">Due date <small>Required</small></span><input name="dueDate" type="date" defaultValue={values.dueDate} required /></label></div>
          <label><span className="task-field-label">Due time</span><input name="dueTime" type="time" defaultValue={values.dueTime} /></label>
          <div className="task-side-divider" />
          <p className="task-section-label">Submission limits</p>
          <div className="task-inline-fields"><label><span className="task-field-label">Maximum score</span><input name="maximumScore" type="number" min="0" defaultValue={values.maximumScore} /></label><label><span className="task-field-label">Max submissions</span><input name="maxSubmissions" type="number" min="1" defaultValue={values.maxSubmissions} /></label></div>
          <label><span className="task-field-label">Max file size (MB)</span><input name="maxFileSizeMB" type="number" min="1" max="25" defaultValue={values.maxFileSizeMB} /></label>
          <label><span className="task-field-label">Allowed file types</span><input name="allowedFileTypes" defaultValue={values.allowedFileTypes} placeholder="pdf, docx, png" /></label>
        </aside>
      </div>
    </WorkspaceFormModal>
  )
}
