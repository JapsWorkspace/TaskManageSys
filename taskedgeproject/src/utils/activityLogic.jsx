import { getTaskAttachmentDisplay, uiPriorityToApi } from './taskLogic.jsx'

function entityId(value) {
  if (!value) return ''
  return typeof value === 'string' ? value : value._id || value.id || ''
}

function personName(value, fallback = 'Recipient') {
  if (!value) return fallback
  if (typeof value === 'string') return value
  return [value.firstName, value.lastName].filter(Boolean).join(' ').trim()
    || value.username
    || value.email
    || fallback
}

function toNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function formatActivityStatus(value) {
  return String(value || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function canReopenActivityAssignment(assignment) {
  return ['accepted', 'cancelled'].includes(assignment?.status)
}

export function canSubmitActivityAssignment(assignment, settings = {}) {
  const directSubmitStatuses = ['assigned', 'in-progress', 'returned', 'reopened']
  const resubmitStatuses = ['submitted', 'late', 'accepted', 'resubmitted']
  const status = assignment?.status || ''
  const submissionCount = Number(assignment?.submissionCount || 0)
  const maxSubmissions = Number(settings.maxSubmissions || 1)

  if (status === 'cancelled' || submissionCount >= maxSubmissions) {
    return false
  }

  if (directSubmitStatuses.includes(status)) {
    return true
  }

  return settings.allowResubmission === true && resubmitStatuses.includes(status)
}

export function buildActivityPayload(values) {
  const deadline = values.dueTime ? `${values.dueDate}T${values.dueTime}` : values.dueDate

  return {
    title: values.title.trim(),
    description: values.description.trim(),
    project: values.projectId,
    priority: uiPriorityToApi(values.priority),
    startDate: values.startDate || undefined,
    deadline,
    recipients: values.recipientIds || [],
    activitySettings: {
      allowTextResponse: Boolean(values.allowTextResponse),
      requireAttachment: Boolean(values.requireAttachment),
      allowResubmission: Boolean(values.allowResubmission),
      maxSubmissions: toNumber(values.maxSubmissions, 3),
      maxFileSizeMB: toNumber(values.maxFileSizeMB, 10),
      maximumScore: toNumber(values.maximumScore, 100),
      allowedFileTypes: typeof values.allowedFileTypes === 'string'
        ? values.allowedFileTypes.split(',').map((item) => item.trim()).filter(Boolean)
        : values.allowedFileTypes || [],
    },
  }
}

export function buildActivityUpdatePayload(values) {
  const deadline = values.dueTime ? `${values.dueDate}T${values.dueTime}` : values.dueDate

  return {
    title: values.title.trim(),
    description: values.description.trim(),
    priority: uiPriorityToApi(values.priority),
    startDate: values.startDate || undefined,
    deadline,
    activitySettings: {
      allowTextResponse: Boolean(values.allowTextResponse),
      requireAttachment: Boolean(values.requireAttachment),
      allowResubmission: Boolean(values.allowResubmission),
      maxSubmissions: toNumber(values.maxSubmissions, 3),
      maxFileSizeMB: toNumber(values.maxFileSizeMB, 10),
      maximumScore: toNumber(values.maximumScore, 100),
      allowedFileTypes: typeof values.allowedFileTypes === 'string'
        ? values.allowedFileTypes.split(',').map((item) => item.trim()).filter(Boolean)
        : values.allowedFileTypes || [],
    },
  }
}

export function getActivityPolicyFacts(activity) {
  const settings = activity.activitySettings || {}
  const allowedFileTypes = Array.isArray(settings.allowedFileTypes)
    ? settings.allowedFileTypes
    : []

  return [
    { label: 'Text response', value: settings.allowTextResponse === false ? 'Off' : 'On' },
    { label: 'Attachment', value: settings.requireAttachment === true ? 'Required' : 'Optional' },
    { label: 'Resubmission', value: settings.allowResubmission === false ? 'Off' : 'On' },
    { label: 'Submission limit', value: String(settings.maxSubmissions || 1) },
    { label: 'File size', value: `${settings.maxFileSizeMB || 10} MB` },
    { label: 'Maximum score', value: String(settings.maximumScore || 100) },
    { label: 'File types', value: allowedFileTypes.length ? allowedFileTypes.join(', ') : 'Any supported file' },
  ]
}

export function getActivitySubmissionHistory(assignment) {
  const history = Array.isArray(assignment.history) ? assignment.history : []

  return [...history]
    .sort((left, right) => {
      const leftNumber = Number(left.number || 0)
      const rightNumber = Number(right.number || 0)

      if (leftNumber !== rightNumber) {
        return rightNumber - leftNumber
      }

      return new Date(right.submittedAt || 0).getTime() - new Date(left.submittedAt || 0).getTime()
    })
    .map((attempt, index, attempts) => ({
      number: Number(attempt.number || attempts.length - index),
      label: attempt.isLate === true ? 'Late submission' : 'Submitted',
      submittedAt: attempt.submittedAt || '',
    }))
}

export function getActivityRecipientFacts(assignment, settings = {}) {
  const maxSubmissions = Number(settings.maxSubmissions || 1)
  const submissionCount = Number(assignment?.submissionCount || 0)
  const remaining = Math.max(maxSubmissions - submissionCount, 0)
  const facts = [
    { label: 'Status', value: formatActivityStatus(assignment?.status || 'assigned') },
  ]

  if (assignment?.isLate) {
    facts.push({ label: 'Late', value: 'Submitted late' })
  }

  if (assignment?.score != null) {
    facts.push({ label: 'Score', value: `${assignment.score} / ${assignment.maximumScore || 100}` })
  }

  if (assignment?.feedback) {
    facts.push({ label: 'Feedback', value: assignment.feedback })
  }

  facts.push(
    { label: 'Submissions', value: `${submissionCount} / ${maxSubmissions}` },
    { label: 'Remaining', value: String(remaining) },
  )

  return facts
}

export function getActivityAttachmentDisplay(attachment, baseUrl = '') {
  return getTaskAttachmentDisplay(attachment, baseUrl)
}

export function normalizeActivityAssignmentFromApi(assignment) {
  const recipient = assignment.recipient

  return {
    id: assignment._id || assignment.id || '',
    status: assignment.status || 'assigned',
    recipientId: entityId(recipient),
    recipientName: personName(recipient),
    recipientAvatarUrl: recipient && typeof recipient === 'object' ? recipient.avatarUrl || '' : '',
    textResponse: assignment.textResponse || '',
    submissionCount: assignment.submissionCount || 0,
    latestSubmittedAt: assignment.latestSubmittedAt || '',
    feedback: assignment.feedback || '',
    score: assignment.score,
    maximumScore: assignment.maximumScore || 100,
    isLate: assignment.isLate === true,
    attachments: Array.isArray(assignment.attachments) ? assignment.attachments : [],
    history: Array.isArray(assignment.submissionHistory) ? assignment.submissionHistory : [],
    raw: assignment,
  }
}

export function getActivityMetrics(assignments) {
  return {
    total: assignments.length,
    pending: assignments.filter((item) => ['assigned', 'in-progress', 'reopened'].includes(item.status)).length,
    submitted: assignments.filter((item) => ['submitted', 'late', 'resubmitted'].includes(item.status)).length,
    accepted: assignments.filter((item) => item.status === 'accepted').length,
    returned: assignments.filter((item) => item.status === 'returned').length,
  }
}

export function getActivityReminderState(assignments = []) {
  const reminderStatuses = ['assigned', 'in-progress', 'returned']
  const count = assignments.filter((assignment) => reminderStatuses.includes(assignment.status)).length

  if (count === 0) {
    return {
      count,
      canSend: false,
      label: 'No pending reminders',
      detail: 'No assigned, in-progress, or returned recipients need reminders.',
    }
  }

  return {
    count,
    canSend: true,
    label: 'Remind pending recipients',
    detail: `${count} ${count === 1 ? 'recipient can' : 'recipients can'} be reminded.`,
  }
}

export function getActivityHistoryItems(activities = [], { limit = activities.length } = {}) {
  return [...activities]
    .map((activity) => ({
      id: activity.id,
      title: activity.title || 'Untitled activity',
      project: activity.project || 'Project',
      actor: activity.reporter || 'Reporter',
      actorAvatarUrl: activity.reporterAvatarUrl || '',
      status: activity.activityStatus || activity.status || 'Activity',
      changedAt: activity.updatedAt || activity.createdAt || activity.dueAt || activity.dueDate || '',
    }))
    .sort((left, right) => {
      const leftTime = new Date(left.changedAt || 0).getTime()
      const rightTime = new Date(right.changedAt || 0).getTime()

      return rightTime - leftTime
    })
    .slice(0, limit)
}

export function getVisibleActivityAssignments(assignments, { query = '', status = '', sort = 'name' } = {}) {
  const normalizedQuery = query.trim().toLowerCase()

  return [...assignments]
    .filter((assignment) => {
      const matchesQuery = !normalizedQuery
        || assignment.recipientName.toLowerCase().includes(normalizedQuery)
      const matchesStatus = !status || assignment.status === status
      return matchesQuery && matchesStatus
    })
    .sort((left, right) => {
      if (sort === 'status') {
        return left.status.localeCompare(right.status)
      }

      if (sort === 'submitted') {
        const leftTime = new Date(left.latestSubmittedAt || 0).getTime()
        const rightTime = new Date(right.latestSubmittedAt || 0).getTime()
        return rightTime - leftTime
      }

      return left.recipientName.localeCompare(right.recipientName)
    })
}

export function getActivitySubmissionError({ activity, assignment, textResponse = '', now = new Date() }) {
  const settings = activity?.activitySettings || {}

  if (activity?.startDate && new Date(activity.startDate) > now) {
    return 'This activity has not started.'
  }

  if (assignment.status === 'accepted' && settings.allowResubmission !== true) {
    return 'An accepted submission cannot be changed.'
  }

  if (assignment.status === 'cancelled') {
    return 'This assignment is cancelled.'
  }

  if (assignment.submissionCount && settings.allowResubmission === false) {
    return 'Resubmission is disabled.'
  }

  if (assignment.submissionCount >= (settings.maxSubmissions || 1)) {
    return 'Submission limit reached.'
  }

  if (settings.requireAttachment && !assignment.attachments.length) {
    return 'At least one attachment is required.'
  }

  if (settings.allowTextResponse === false && textResponse) {
    return 'Text responses are disabled.'
  }

  if (settings.allowTextResponse !== false && !settings.requireAttachment && !String(textResponse).trim()) {
    return 'Enter a response.'
  }

  return ''
}

export function validateActivityReview({ status, score, maximumScore = 100 }) {
  if (!['accepted', 'returned'].includes(status)) {
    return 'Choose Accept or Return.'
  }

  if (score === '' || score == null) {
    return ''
  }

  const numericScore = Number(score)
  const numericMax = Number(maximumScore || 100)

  if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > numericMax) {
    return `Score must be between 0 and ${numericMax}.`
  }

  return ''
}

export function validateActivityAttachmentFile(file, settings = {}) {
  if (!file) {
    return 'Choose a file.'
  }

  const maxFileSizeMB = Number(settings.maxFileSizeMB || 10)
  const maxFileSize = maxFileSizeMB * 1024 * 1024

  if (file.size > maxFileSize) {
    return `File must be ${maxFileSizeMB}MB or smaller.`
  }

  const allowedTypes = Array.isArray(settings.allowedFileTypes)
    ? settings.allowedFileTypes.map((value) => String(value).replace(/^\./, '').toLowerCase()).filter(Boolean)
    : []
  const extension = String(file.name || '').split('.').pop()?.toLowerCase() || ''

  if (allowedTypes.length && !allowedTypes.includes(extension)) {
    return `Allowed file types: ${allowedTypes.join(', ')}.`
  }

  return ''
}
