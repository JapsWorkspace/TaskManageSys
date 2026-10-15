import { useRef, useState } from 'react'
import { getActivityAttachmentDisplay, canReopenActivityAssignment, canSubmitActivityAssignment, getActivityMetrics, getActivityHistoryItems, getActivityPolicyFacts, getActivityRecipientFacts, getActivityReminderState, getActivitySubmissionHistory, getActivitySubmissionError, getVisibleActivityAssignments, validateActivityAttachmentFile, validateActivityReview } from '../utils/activityLogic.jsx'
import { formatDate, formatNotificationDate, formatActivityStatus, getCommentAuthor, getUserId } from '../utils/display.jsx'
import { PaginationControls, PriorityBadge } from '../components/common/WorkspaceUi.jsx'
import { usePaginatedRecords } from '../utils/usePaginatedRecords.jsx'
import { API_BASE_URL } from '../config/runtime.jsx'

export function ActivitiesPage({
  activities,
  isLoading,
  taskError,
  taskMessage,
  canManage,
  onRefresh,
  onCreateActivity,
  onOpenActivity,
}) {
  const [now] = useState(() => Date.now())
  const pagination = usePaginatedRecords(activities, 6)
  const historyItems = getActivityHistoryItems(activities, { limit: 6 })
  const overdue = activities.filter((activity) => {
    const dueTime = new Date(activity.dueAt || activity.dueDate).getTime()
    return !Number.isNaN(dueTime) && dueTime < now
  }).length
  const overviewCards = [
    { label: 'Activities', value: activities.length, tone: 'blue' },
    { label: 'Overdue', value: overdue, tone: 'red' },
    { label: 'Awaiting me', value: activities.filter((activity) => activity.activityStatus).length, tone: 'amber' },
  ]

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Activities</p>
          <h3 className="section-title">Individual activities</h3>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button compact" onClick={onRefresh}>
            Refresh
          </button>
          {canManage && (
            <button type="button" className="primary-button compact" onClick={onCreateActivity}>
              Create activity
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
          <h3>Could not load activities</h3>
          <p>{taskError}</p>
        </div>
      )}

      <div className="activity-grid">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading activities</h3>
            <p>Fetching individual activities from the shared server.</p>
          </div>
        ) : activities.length ? (
          pagination.items.map((activity) => (
            <article className="activity-card" key={activity.id}>
              <button type="button" className="project-open-button" onClick={() => onOpenActivity(activity)}>
                <p className="task-path">{activity.project} &gt; {activity.reporter || 'Reporter'}</p>
                <h3>{activity.title}</h3>
                <p>{activity.description || 'No description yet.'}</p>
              </button>
              <div className="project-meta-row">
                <strong>{formatDate(activity.dueDate)}</strong>
                <PriorityBadge value={activity.priority} />
                {activity.activityStatus && <span>{activity.activityStatus}</span>}
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h3>No individual activities yet</h3>
            <p>Create an activity to collect private submissions from project members.</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label="activities" />

      <article className="activity-history-section activity-page-history">
        <div className="section-row compact">
          <div>
            <p className="eyebrow">History</p>
            <h3 className="section-title">Recent activity updates</h3>
          </div>
        </div>
        {historyItems.length ? (
          <div className="activity-history-list">
            {historyItems.map((item) => (
              <button
                type="button"
                className="activity-history-row activity-history-button"
                key={`activity-history-${item.id}`}
                onClick={() => {
                  const activity = activities.find((candidate) => candidate.id === item.id)
                  if (activity) {
                    onOpenActivity(activity)
                  }
                }}
              >
                <span>{item.title.charAt(0).toUpperCase()}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.project} · {item.status} · {item.actor} · {formatDate(item.changedAt)}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted-copy">Activity updates will appear here once records are created.</p>
        )}
      </article>
    </section>
  )
}

export function ActivityDetailsPage({
  activity,
  assignments,
  myAssignment,
  project,
  users,
  taskMessage,
  canReview,
  onBack,
  onEditActivity,
  onRemindActivity,
  onArchiveActivity,
  onCancelActivity,
  onReopenActivity,
  onReopenAssignment,
  onExportActivityResults,
  onAddActivityRecipients,
  onRemoveActivityRecipient,
  onStartAssignment,
  onSubmitAssignment,
  onReviewAssignment,
  onUploadReferenceAttachment,
  onDeleteReferenceAttachment,
  onUploadAssignmentAttachment,
  onDeleteAssignmentAttachment,
}) {
  const referenceInputRef = useRef(null)
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([])
  const [assignmentSearch, setAssignmentSearch] = useState('')
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('')
  const [assignmentSort, setAssignmentSort] = useState('name')
  const metrics = getActivityMetrics(assignments)
  const policyFacts = getActivityPolicyFacts(activity)
  const reminderState = getActivityReminderState(assignments)
  const assignmentStatusOptions = [
    'assigned',
    'in-progress',
    'submitted',
    'late',
    'returned',
    'reopened',
    'resubmitted',
    'accepted',
    'cancelled',
  ]
  const visibleAssignments = canReview
    ? getVisibleActivityAssignments(assignments, {
      query: assignmentSearch,
      status: assignmentStatusFilter,
      sort: assignmentSort,
    })
    : myAssignment ? [myAssignment] : []
  const referenceAttachments = activity.attachments || []
  const activeRecipientIds = new Set(
    assignments
      .filter((assignment) => assignment.status !== 'cancelled')
      .map((assignment) => assignment.recipientId)
      .filter(Boolean),
  )
  const projectMemberIds = new Set(project?.memberIds || [])
  const availableRecipients = users.filter((person) => {
    const userId = getUserId(person)
    return userId
      && !activeRecipientIds.has(userId)
      && (!projectMemberIds.size || projectMemberIds.has(userId))
  })

  function handleReferenceAttachmentChange(event) {
    const file = event.target.files?.[0]

    if (file) {
      onUploadReferenceAttachment(activity.id, file)
    }

    event.target.value = ''
  }

  function handleRecipientSelection(event) {
    setSelectedRecipientIds(Array.from(event.target.selectedOptions).map((option) => option.value))
  }

  function handleAddRecipients(event) {
    event.preventDefault()
    onAddActivityRecipients(activity.id, selectedRecipientIds)
    setSelectedRecipientIds([])
  }

  return (
    <section className="task-detail-page">
      <div className="task-detail-header panel">
        <button type="button" className="ghost-button compact" onClick={onBack}>
          Back to activities
        </button>
        <div>
          <p className="eyebrow">{activity.project}</p>
          <h3>{activity.title}</h3>
          <p>{activity.description || 'No description yet.'}</p>
        </div>
        <div className="task-detail-actions">
          {canReview && (
            <>
              <button type="button" className="ghost-button compact" onClick={() => onEditActivity(activity)}>
                Edit
              </button>
              <button type="button" className="ghost-button compact" onClick={() => onReopenActivity(activity.id)}>
                Reopen
              </button>
              <button type="button" className="ghost-button compact" onClick={() => onExportActivityResults(activity.id)}>
                Export CSV
              </button>
              <button type="button" className="ghost-button compact" onClick={() => onArchiveActivity(activity.id)}>
                Archive
              </button>
              <button type="button" className="ghost-button compact danger-action" onClick={() => onCancelActivity(activity.id)}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {taskMessage && <p className="form-message">{taskMessage}</p>}

      {assignments.length > 0 && (
        <div className="summary-grid team-summary">
          {[
            { label: 'Recipients', value: metrics.total, tone: 'blue' },
            { label: 'Submitted', value: metrics.submitted, tone: 'amber' },
            { label: 'Accepted', value: metrics.accepted, tone: 'green' },
            { label: 'Returned', value: metrics.returned, tone: 'red' },
          ].map((card) => (
            <article className={`metric-card metric-${card.tone}`} key={card.label}>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>
      )}

      <article className="panel details-panel activity-policy-panel">
        <div>
          <p className="eyebrow">Submission rules</p>
          <h4>Activity policy</h4>
          <p className="muted-copy">These rules apply to every recipient assignment for this activity.</p>
        </div>
        <dl className="activity-policy-grid">
          {policyFacts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </article>

      {canReview && (
        <article className="panel details-panel activity-recipient-panel">
          <div>
            <p className="eyebrow">Recipients</p>
            <h4>Add project members</h4>
            <p className="muted-copy">New recipients receive their own private assignment for this activity.</p>
          </div>
          <form className="activity-recipient-form" onSubmit={handleAddRecipients}>
            <select
              name="recipientIds"
              multiple
              size="4"
              value={selectedRecipientIds}
              onChange={handleRecipientSelection}
              disabled={!availableRecipients.length}
            >
              {availableRecipients.map((person) => {
                const userId = getUserId(person)
                return (
                  <option key={userId} value={userId}>
                    {getCommentAuthor(person)}
                  </option>
                )
              })}
            </select>
            <button type="submit" className="primary-button compact" disabled={!selectedRecipientIds.length}>
              Add recipients
            </button>
          </form>
          {!availableRecipients.length && (
            <p className="muted-copy">All available project members already have assignments.</p>
          )}
        </article>
      )}

      <article className="panel details-panel activity-reference-panel">
        <div className="attachment-heading compact-heading">
          <div>
            <p className="eyebrow">Reference files</p>
            <h4>Activity resources</h4>
          </div>
          {canReview && (
            <>
              <input
                ref={referenceInputRef}
                className="hidden-file-input"
                type="file"
                onChange={handleReferenceAttachmentChange}
              />
              <button
                type="button"
                className="ghost-button compact"
                onClick={() => referenceInputRef.current?.click()}
              >
                Add reference file
              </button>
            </>
          )}
        </div>

        {referenceAttachments.length ? (
          <div className="attachment-list">
            {referenceAttachments.map((attachment) => {
              const attachmentDisplay = getActivityAttachmentDisplay(attachment, API_BASE_URL)
              return (
                <div className="attachment-row task-attachment-row" key={attachmentDisplay.id || attachmentDisplay.url || attachmentDisplay.name}>
                  <div className="attachment-file-summary">
                    <span className="attachment-type-pill">{attachmentDisplay.typeLabel}</span>
                    <div>
                      <strong>{attachmentDisplay.name}</strong>
                      <span>{attachmentDisplay.sizeLabel}</span>
                    </div>
                  </div>
                  <div className="row-actions attachment-actions">
                    <a
                      className={`ghost-button compact ${attachmentDisplay.canOpen ? '' : 'is-disabled'}`}
                      href={attachmentDisplay.url || undefined}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={!attachmentDisplay.canOpen}
                    >
                      Open
                    </a>
                    <a
                      className={`ghost-button compact ${attachmentDisplay.canOpen ? '' : 'is-disabled'}`}
                      href={attachmentDisplay.url || undefined}
                      download={attachmentDisplay.name}
                      aria-disabled={!attachmentDisplay.canOpen}
                    >
                      Download
                    </a>
                    {canReview && (
                      <button
                        type="button"
                        className="ghost-button compact"
                        onClick={() => onDeleteReferenceAttachment(activity.id, attachmentDisplay.id)}
                        disabled={!attachmentDisplay.canRemove}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="muted-copy">No reference files attached.</p>
        )}
      </article>

      {canReview && (
        <article className="panel details-panel activity-review-tools">
          <div>
            <p className="eyebrow">Review queue</p>
            <h4>Find assignments</h4>
          </div>
          <div className="activity-reminder-row">
            <p className="muted-copy">{reminderState.detail}</p>
            <button
              type="button"
              className="ghost-button compact"
              onClick={() => onRemindActivity(activity.id)}
              disabled={!reminderState.canSend}
            >
              {reminderState.label}
            </button>
          </div>
          <div className="activity-review-controls">
            <label>
              Search recipients
              <input
                value={assignmentSearch}
                onChange={(event) => setAssignmentSearch(event.target.value)}
                placeholder="Search recipients"
              />
            </label>
            <label>
              Sort
              <select value={assignmentSort} onChange={(event) => setAssignmentSort(event.target.value)}>
                <option value="name">Name</option>
                <option value="status">Status</option>
                <option value="submitted">Submitted</option>
              </select>
            </label>
          </div>
          <div className="activity-status-filter" aria-label="Filter assignments by status">
            <button
              type="button"
              className={!assignmentStatusFilter ? 'active' : ''}
              onClick={() => setAssignmentStatusFilter('')}
            >
              All {assignments.length}
            </button>
            {assignmentStatusOptions.map((status) => {
              const count = assignments.filter((assignment) => assignment.status === status).length

              return (
                <button
                  type="button"
                  key={status}
                  className={assignmentStatusFilter === status ? 'active' : ''}
                  onClick={() => setAssignmentStatusFilter((currentStatus) => (
                    currentStatus === status ? '' : status
                  ))}
                >
                  {formatActivityStatus(status)} {count}
                </button>
              )
            })}
          </div>
        </article>
      )}

      <div className="activity-assignment-list">
        {visibleAssignments.length ? (
          visibleAssignments.map((assignment) => (
            <ActivityAssignmentCard
              key={assignment.id}
              activity={activity}
              assignment={assignment}
              canReview={canReview}
              onStartAssignment={onStartAssignment}
              onSubmitAssignment={onSubmitAssignment}
              onReviewAssignment={onReviewAssignment}
              onUploadAttachment={onUploadAssignmentAttachment}
              onDeleteAttachment={onDeleteAssignmentAttachment}
              onReopenAssignment={() => onReopenAssignment(activity.id, assignment.id, assignment.recipientName)}
              onRemoveRecipient={() => onRemoveActivityRecipient(activity.id, assignment.recipientId)}
            />
          ))
        ) : (
          <div className="empty-state">
            <h3>No assignments available</h3>
            <p>You may not be assigned to this activity, or assignment details are still loading.</p>
          </div>
        )}
      </div>
    </section>
  )
}

export function ActivityAssignmentCard({
  activity,
  assignment,
  canReview,
  onStartAssignment,
  onSubmitAssignment,
  onReviewAssignment,
  onUploadAttachment,
  onDeleteAttachment,
  onReopenAssignment,
  onRemoveRecipient,
}) {
  const attachmentInputRef = useRef(null)
  const [validationMessage, setValidationMessage] = useState('')
  const settings = activity.activitySettings || {}
  const canStart = !canReview && assignment.status === 'assigned'
  const canSubmit = !canReview && canSubmitActivityAssignment(assignment, settings)
  const canManageAttachments = canSubmit
  const canReopen = canReview && canReopenActivityAssignment(assignment)
  const attachments = assignment.attachments || []
  const recipientFacts = getActivityRecipientFacts(assignment, settings)
  const submissionHistory = getActivitySubmissionHistory(assignment)

  function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const textResponse = form.get('textResponse') || ''
    const error = getActivitySubmissionError({
      activity,
      assignment,
      textResponse,
    })

    if (error) {
      setValidationMessage(error)
      return
    }

    setValidationMessage('')
    onSubmitAssignment(assignment.id, textResponse)
  }

  function handleReview(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const status = form.get('status')
    const score = form.get('score')
    const error = validateActivityReview({
      status,
      score,
      maximumScore: assignment.maximumScore,
    })

    if (error) {
      setValidationMessage(error)
      return
    }

    setValidationMessage('')
    onReviewAssignment(assignment.id, {
      status,
      feedback: form.get('feedback') || '',
      score: score === '' || score == null ? undefined : Number(score),
    })
  }

  function handleAttachmentChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
      event.target.value = ''
      return
    }

    const error = validateActivityAttachmentFile(file, settings)

    if (error) {
      setValidationMessage(error)
      event.target.value = ''
      return
    }

    setValidationMessage('')
    onUploadAttachment(assignment.id, file)

    event.target.value = ''
  }

  return (
    <article className="activity-assignment-card">
      <div>
        <p className="task-path">{assignment.status}{assignment.isLate ? ' > Late' : ''}</p>
        <h3>{assignment.recipientName}</h3>
        <p>{assignment.textResponse || 'No response yet.'}</p>
      </div>
      <div className="project-meta-row">
        <strong>{assignment.submissionCount} submissions</strong>
        <span>{assignment.score ?? '-'} / {assignment.maximumScore}</span>
      </div>
      <dl className="activity-recipient-facts">
        {recipientFacts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {validationMessage && <p className="inline-error">{validationMessage}</p>}
      {!canReview && (
        <p className="muted-copy">
          {settings.maxSubmissions || 1} submission limit
          {settings.requireAttachment ? ' · Attachment required' : ''}
          {Array.isArray(settings.allowedFileTypes) && settings.allowedFileTypes.length
            ? ` · ${settings.allowedFileTypes.join(', ')} files`
            : ''}
        </p>
      )}
      {canStart && (
        <div className="activity-assignment-actions start-action">
          <button type="button" className="primary-button compact" onClick={() => onStartAssignment(assignment.id)}>
            Start activity
          </button>
        </div>
      )}

      <div className="activity-attachment-section">
        <div className="attachment-heading compact-heading">
          <div>
            <p className="eyebrow">Files</p>
            <h4>Submission attachments</h4>
          </div>
          {canManageAttachments && (
            <>
              <input
                ref={attachmentInputRef}
                className="hidden-file-input"
                type="file"
                onChange={handleAttachmentChange}
              />
              <button
                type="button"
                className="ghost-button compact"
                onClick={() => attachmentInputRef.current?.click()}
              >
                Upload file
              </button>
            </>
          )}
        </div>

        {attachments.length ? (
          <div className="attachment-list">
            {attachments.map((attachment) => {
              const attachmentDisplay = getActivityAttachmentDisplay(attachment, API_BASE_URL)
              return (
                <div className="attachment-row task-attachment-row" key={attachmentDisplay.id || attachmentDisplay.url || attachmentDisplay.name}>
                  <div className="attachment-file-summary">
                    <span className="attachment-type-pill">{attachmentDisplay.typeLabel}</span>
                    <div>
                      <strong>{attachmentDisplay.name}</strong>
                      <span>{attachmentDisplay.sizeLabel}</span>
                    </div>
                  </div>
                  <div className="row-actions attachment-actions">
                    <a
                      className={`ghost-button compact ${attachmentDisplay.canOpen ? '' : 'is-disabled'}`}
                      href={attachmentDisplay.url || undefined}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={!attachmentDisplay.canOpen}
                    >
                      Open
                    </a>
                    <a
                      className={`ghost-button compact ${attachmentDisplay.canOpen ? '' : 'is-disabled'}`}
                      href={attachmentDisplay.url || undefined}
                      download={attachmentDisplay.name}
                      aria-disabled={!attachmentDisplay.canOpen}
                    >
                      Download
                    </a>
                    {canManageAttachments && (
                      <button
                        type="button"
                        className="ghost-button compact"
                        onClick={() => onDeleteAttachment(assignment.id, attachmentDisplay.id)}
                        disabled={!attachmentDisplay.canRemove}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="muted-copy">No files attached.</p>
        )}
      </div>

      {canSubmit && (
        <form className="comment-form" onSubmit={handleSubmit}>
          <input name="textResponse" defaultValue={assignment.textResponse} placeholder="Write your response" />
          <button type="submit" className="primary-button compact">
            {assignment.submissionCount === 0 ? 'Submit activity' : 'Resubmit activity'}
          </button>
        </form>
      )}

      {submissionHistory.length > 0 && (
        <div className="activity-history-section">
          <div className="compact-heading">
            <p className="eyebrow">Submission history</p>
            <h4>Previous attempts</h4>
          </div>
          <div className="activity-history-list">
            {submissionHistory.map((attempt) => (
              <div className="activity-history-row" key={`${assignment.id}-attempt-${attempt.number}`}>
                <span>{attempt.number}</span>
                <div>
                  <strong>{attempt.label}</strong>
                  <p>{formatNotificationDate(attempt.submittedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {canReview && ['submitted', 'late', 'resubmitted'].includes(assignment.status) && (
        <form className="form-grid activity-review-form" onSubmit={handleReview}>
          <select name="status" defaultValue="accepted">
            <option value="accepted">Accept</option>
            <option value="returned">Return</option>
          </select>
          <input name="score" type="number" min="0" max={assignment.maximumScore} placeholder="Score" />
          <input name="feedback" placeholder="Feedback" />
          <button type="submit" className="primary-button compact">Review</button>
        </form>
      )}

      {canReview && (canReopen || assignment.recipientId) && (
        <div className="activity-assignment-actions">
          {canReopen && (
            <button type="button" className="ghost-button compact" onClick={onReopenAssignment}>
              Reopen
            </button>
          )}
          {assignment.recipientId && (
            <button type="button" className="ghost-button compact danger-action" onClick={onRemoveRecipient}>
              Remove recipient
            </button>
          )}
        </div>
      )}
    </article>
  )
}
