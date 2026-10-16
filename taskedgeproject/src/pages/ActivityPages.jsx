import { useRef, useState } from 'react'
import { Archive, ArrowLeft, Ban, Download, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react'
import { getActivityAttachmentDisplay, canReopenActivityAssignment, canSubmitActivityAssignment, getActivityMetrics, getActivityHistoryItems, getActivityPolicyFacts, getActivityRecipientFacts, getActivityReminderState, getActivitySubmissionHistory, getActivitySubmissionError, getVisibleActivityAssignments, validateActivityAttachmentFile, validateActivityReview } from '../utils/activityLogic.jsx'
import { formatDate, formatNotificationDate, formatActivityStatus, getCommentAuthor, getUserId } from '../utils/display.jsx'
import { PaginationControls, PriorityBadge, UserAvatar } from '../components/common/WorkspaceUi.jsx'
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
  const pagination = usePaginatedRecords(activities, 4)
  const historyItems = getActivityHistoryItems(activities)
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

      <div className="activity-dashboard-layout">
        <div className="activity-dashboard-main">
          <div className="activity-grid">
            {isLoading ? (
              <div className="empty-state">
                <h3>Loading activities</h3>
                <p>Fetching individual activities from the shared server.</p>
              </div>
            ) : activities.length ? (
              pagination.items.map((activity) => (
                <article className="activity-card activity-list-card" key={activity.id}>
                  <button type="button" className="activity-card-open" onClick={() => onOpenActivity(activity)}>
                    <p className="task-path">{activity.project} &gt; {activity.reporter || 'Reporter'}</p>
                    <h3>{activity.title}</h3>
                    <p>{activity.description || 'No description yet.'}</p>
                  </button>
                  <footer className="activity-card-footer">
                    <span className="activity-card-due">Due <strong>{formatDate(activity.dueDate)}</strong></span>
                    <PriorityBadge value={activity.priority} />
                    {activity.activityStatus && <span className="activity-card-status">{activity.activityStatus}</span>}
                  </footer>
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
        </div>

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
                  <UserAvatar
                    user={{ avatarUrl: item.actorAvatarUrl }}
                    className="activity-history-avatar"
                    label={item.actor}
                    fallback="default"
                  />
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
      </div>
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
    <section className="task-detail-page activity-detail-page">
      <div className="activity-detail-toolbar">
        <button type="button" className="project-back-button" onClick={onBack}>
          <ArrowLeft size={17} aria-hidden="true" />
          Back to activities
        </button>
        {!canReview && myAssignment?.status === 'assigned' && (
          <button
            type="button"
            className="project-new-task-button"
            onClick={() => onStartAssignment(myAssignment.id)}
          >
            <Play size={16} aria-hidden="true" />
            Start activity
          </button>
        )}
        {canReview && (
          <div className="project-detail-primary-actions activity-detail-actions">
            <button type="button" className="project-action-button" onClick={() => onEditActivity(activity)}>
              <Pencil size={16} aria-hidden="true" />
              Edit
            </button>
            <button type="button" className="project-action-button" onClick={() => onReopenActivity(activity.id)}>
              <RotateCcw size={16} aria-hidden="true" />
              Reopen
            </button>
            <button type="button" className="project-action-button" onClick={() => onExportActivityResults(activity.id)}>
              <Download size={16} aria-hidden="true" />
              Export CSV
            </button>
            <button type="button" className="project-action-button activity-archive-button" onClick={() => onArchiveActivity(activity.id)}>
              <Archive size={16} aria-hidden="true" />
              Archive
            </button>
            <button type="button" className="project-action-button danger-action" onClick={() => onCancelActivity(activity.id)}>
              <Ban size={16} aria-hidden="true" />
              Cancel
            </button>
          </div>
        )}
      </div>

      {taskMessage && <p className="form-message">{taskMessage}</p>}

      <article className="activity-summary-card">
        <div className="activity-summary-main">
          <p className="eyebrow">{activity.project}</p>
          <h3>{activity.title}</h3>
          {activity.description && <p>{activity.description}</p>}
        </div>
        {[
          { label: 'Recipients', value: metrics.total },
          { label: 'Submitted', value: metrics.submitted },
          { label: 'Accepted', value: metrics.accepted },
          { label: 'Returned', value: metrics.returned },
        ].map((metric) => (
          <div className="activity-summary-metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </article>

      {canReview && availableRecipients.length > 0 && (
        <details className="activity-compact-disclosure">
          <summary>Add project members</summary>
          <form className="activity-recipient-form" onSubmit={handleAddRecipients}>
            <select
              name="recipientIds"
              multiple
              size={Math.min(3, availableRecipients.length)}
              value={selectedRecipientIds}
              onChange={handleRecipientSelection}
            >
              {availableRecipients.map((person) => {
                const userId = getUserId(person)
                return <option key={userId} value={userId}>{getCommentAuthor(person)}</option>
              })}
            </select>
            <button type="submit" className="primary-button compact" disabled={!selectedRecipientIds.length}>
              Add recipients
            </button>
          </form>
        </details>
      )}

      {(referenceAttachments.length > 0 || canReview) && (
      <details className="activity-compact-disclosure">
        <summary>Activity resources ({referenceAttachments.length})</summary>
        {canReview && (
          <>
            <input ref={referenceInputRef} className="hidden-file-input" type="file" onChange={handleReferenceAttachmentChange} />
            <button type="button" className="ghost-button compact" onClick={() => referenceInputRef.current?.click()}>
              Add reference file
            </button>
          </>
        )}

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
        ) : null}
      </details>
      )}

      {canReview && (
        <div className="activity-assignment-toolbar">
          <label className="activity-assignment-search">
            Search recipients
            <input value={assignmentSearch} onChange={(event) => setAssignmentSearch(event.target.value)} placeholder="Search recipients" />
          </label>
          <label>
            Sort
            <select value={assignmentSort} onChange={(event) => setAssignmentSort(event.target.value)}>
              <option value="name">Name</option>
              <option value="status">Status</option>
              <option value="submitted">Submitted</option>
            </select>
          </label>
          <label>
            Status
            <select value={assignmentStatusFilter} onChange={(event) => setAssignmentStatusFilter(event.target.value)}>
              <option value="">All statuses ({assignments.length})</option>
              {assignmentStatusOptions.map((status) => {
                const count = assignments.filter((assignment) => assignment.status === status).length
                return <option value={status} key={status}>{formatActivityStatus(status)} ({count})</option>
              })}
            </select>
          </label>
          <div className="activity-reminder-compact" title={reminderState.detail}>
            <span>{reminderState.detail}</span>
            <button type="button" className="ghost-button compact" onClick={() => onRemindActivity(activity.id)} disabled={!reminderState.canSend}>
              {reminderState.label}
            </button>
          </div>
        </div>
      )}

      <div className="activity-assignment-list">
        {visibleAssignments.length ? (
          visibleAssignments.map((assignment) => (
            <ActivityAssignmentCard
              key={assignment.id}
              activity={activity}
              assignment={assignment}
              policyFacts={policyFacts}
              canReview={canReview}
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
            <dl className="activity-policy-inline">
              {policyFacts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </section>
  )
}

export function ActivityAssignmentCard({
  activity,
  assignment,
  policyFacts,
  canReview,
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
  const canSubmit = !canReview && canSubmitActivityAssignment(assignment, settings)
  const canManageAttachments = canSubmit
  const canReopen = canReview && canReopenActivityAssignment(assignment)
  const attachments = assignment.attachments || []
  const recipientFacts = getActivityRecipientFacts(assignment, settings)
  const submissionHistory = getActivitySubmissionHistory(assignment)
  const recipient = { avatarUrl: assignment.recipientAvatarUrl }

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
      <div className="activity-assignment-heading">
        <UserAvatar user={recipient} className="activity-recipient-avatar" label={assignment.recipientName} fallback="default" />
        <div className="activity-recipient-heading-copy">
          <p className="task-path">{assignment.status}{assignment.isLate ? ' > Late' : ''}</p>
          <h3>{assignment.recipientName}</h3>
        </div>
        <span className={`activity-status-badge activity-status-${assignment.status}`}>
          {formatActivityStatus(assignment.status)}
        </span>
      </div>
      <p className="activity-recipient-response">{assignment.textResponse || 'No response has been submitted yet.'}</p>
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
      <dl className="activity-policy-inline" aria-label="Activity submission rules">
        {policyFacts.map((fact) => (
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
          <button type="submit" className="primary-button compact">Submit review</button>
        </form>
      )}

      {canReview && (canReopen || assignment.recipientId) && (
        <div className="activity-assignment-actions activity-assignment-footer">
          {canReopen && (
            <button type="button" className="ghost-button compact" onClick={onReopenAssignment}>
              Reopen
            </button>
          )}
          {assignment.recipientId && (
            <button
              type="button"
              className="ghost-button compact danger-action activity-recipient-remove"
              onClick={onRemoveRecipient}
              aria-label="Remove recipient"
              title="Remove recipient"
            >
              <Trash2 size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </article>
  )
}
