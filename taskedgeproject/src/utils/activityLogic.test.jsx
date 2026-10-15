import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildActivityPayload,
  buildActivityUpdatePayload,
  getActivityAttachmentDisplay,
  canReopenActivityAssignment,
  canSubmitActivityAssignment,
  getActivityHistoryItems,
  getActivityRecipientFacts,
  getActivityReminderState,
  getActivitySubmissionError,
  getActivitySubmissionHistory,
  getActivityMetrics,
  getActivityPolicyFacts,
  getVisibleActivityAssignments,
  normalizeActivityAssignmentFromApi,
  validateActivityAttachmentFile,
  validateActivityReview,
} from './activityLogic.jsx'

test('buildActivityPayload converts React activity form values into backend fields', () => {
  assert.deepEqual(
    buildActivityPayload({
      title: 'Submit weekly journal',
      description: 'Write your update.',
      projectId: 'project-1',
      priority: 'High',
      startDate: '2026-10-12',
      dueDate: '2026-10-15',
      dueTime: '17:30',
      recipientIds: ['user-1', 'user-2'],
      allowTextResponse: true,
      requireAttachment: false,
      allowResubmission: true,
      maxSubmissions: '3',
      maxFileSizeMB: '10',
      maximumScore: '100',
      allowedFileTypes: 'pdf, docx',
    }),
    {
      title: 'Submit weekly journal',
      description: 'Write your update.',
      project: 'project-1',
      priority: 'high',
      startDate: '2026-10-12',
      deadline: '2026-10-15T17:30',
      recipients: ['user-1', 'user-2'],
      activitySettings: {
        allowTextResponse: true,
        requireAttachment: false,
        allowResubmission: true,
        maxSubmissions: 3,
        maxFileSizeMB: 10,
        maximumScore: 100,
        allowedFileTypes: ['pdf', 'docx'],
      },
    },
  )
})

test('buildActivityUpdatePayload sends editable activity fields only', () => {
  assert.deepEqual(
    buildActivityUpdatePayload({
      title: 'Updated journal',
      description: 'New instructions.',
      projectId: 'project-1',
      priority: 'Urgent',
      startDate: '2026-10-12',
      dueDate: '2026-10-16',
      dueTime: '',
      recipientIds: ['user-1'],
      allowTextResponse: false,
      requireAttachment: true,
      allowResubmission: false,
      maxSubmissions: '2',
      maxFileSizeMB: '12',
      maximumScore: '50',
      allowedFileTypes: 'pdf, png',
    }),
    {
      title: 'Updated journal',
      description: 'New instructions.',
      priority: 'urgent',
      startDate: '2026-10-12',
      deadline: '2026-10-16',
      activitySettings: {
        allowTextResponse: false,
        requireAttachment: true,
        allowResubmission: false,
        maxSubmissions: 2,
        maxFileSizeMB: 12,
        maximumScore: 50,
        allowedFileTypes: ['pdf', 'png'],
      },
    },
  )
})

test('getActivityPolicyFacts describes submission settings for the activity detail page', () => {
  assert.deepEqual(
    getActivityPolicyFacts({
      activitySettings: {
        allowTextResponse: false,
        requireAttachment: true,
        allowResubmission: false,
        maxSubmissions: 2,
        maxFileSizeMB: 12,
        maximumScore: 50,
        allowedFileTypes: ['pdf', 'png'],
      },
    }),
    [
      { label: 'Text response', value: 'Off' },
      { label: 'Attachment', value: 'Required' },
      { label: 'Resubmission', value: 'Off' },
      { label: 'Submission limit', value: '2' },
      { label: 'File size', value: '12 MB' },
      { label: 'Maximum score', value: '50' },
      { label: 'File types', value: 'pdf, png' },
    ],
  )
})

test('getActivitySubmissionHistory returns latest attempts first with readable labels', () => {
  assert.deepEqual(
    getActivitySubmissionHistory({
      history: [
        { number: 1, submittedAt: '2026-10-12T09:00:00.000Z', isLate: false },
        { number: 2, submittedAt: '2026-10-13T11:30:00.000Z', isLate: true },
      ],
    }),
    [
      {
        number: 2,
        label: 'Late submission',
        submittedAt: '2026-10-13T11:30:00.000Z',
      },
      {
        number: 1,
        label: 'Submitted',
        submittedAt: '2026-10-12T09:00:00.000Z',
      },
    ],
  )
})

test('canReopenActivityAssignment only allows closed recipient assignments', () => {
  assert.equal(canReopenActivityAssignment({ status: 'accepted' }), true)
  assert.equal(canReopenActivityAssignment({ status: 'cancelled' }), true)
  assert.equal(canReopenActivityAssignment({ status: 'submitted' }), false)
  assert.equal(canReopenActivityAssignment({ status: 'assigned' }), false)
})

test('canSubmitActivityAssignment mirrors recipient submit and resubmit states', () => {
  const settings = { allowResubmission: true, maxSubmissions: 3 }

  assert.equal(canSubmitActivityAssignment({ status: 'assigned', submissionCount: 0 }, settings), true)
  assert.equal(canSubmitActivityAssignment({ status: 'returned', submissionCount: 1 }, settings), true)
  assert.equal(canSubmitActivityAssignment({ status: 'accepted', submissionCount: 1 }, settings), true)
  assert.equal(canSubmitActivityAssignment({ status: 'submitted', submissionCount: 3 }, settings), false)
  assert.equal(
    canSubmitActivityAssignment(
      { status: 'submitted', submissionCount: 1 },
      { allowResubmission: false, maxSubmissions: 3 },
    ),
    false,
  )
  assert.equal(canSubmitActivityAssignment({ status: 'cancelled', submissionCount: 0 }, settings), false)
})

test('getActivityRecipientFacts exposes late feedback score and remaining submissions', () => {
  assert.deepEqual(
    getActivityRecipientFacts(
      {
        status: 'late',
        isLate: true,
        submissionCount: 2,
        feedback: 'Revise sources.',
        score: 72,
        maximumScore: 100,
      },
      { maxSubmissions: 3 },
    ),
    [
      { label: 'Status', value: 'Late' },
      { label: 'Late', value: 'Submitted late' },
      { label: 'Score', value: '72 / 100' },
      { label: 'Feedback', value: 'Revise sources.' },
      { label: 'Submissions', value: '2 / 3' },
      { label: 'Remaining', value: '1' },
    ],
  )
})

test('getActivityAttachmentDisplay prepares activity file actions', () => {
  assert.deepEqual(
    getActivityAttachmentDisplay(
      {
        _id: 'reference-1',
        name: 'brief.docx',
        url: '/uploads/brief.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 2048,
      },
      'http://localhost:8000/api',
    ),
    {
      id: 'reference-1',
      name: 'brief.docx',
      typeLabel: 'Doc',
      sizeLabel: '2.0 KB',
      url: 'http://localhost:8000/uploads/brief.docx',
      canOpen: true,
      canRemove: true,
    },
  )
})

test('getActivityReminderState counts pending recipients for reminders', () => {
  assert.deepEqual(
    getActivityReminderState([
      { status: 'assigned' },
      { status: 'in-progress' },
      { status: 'returned' },
      { status: 'submitted' },
      { status: 'accepted' },
      { status: 'cancelled' },
    ]),
    {
      count: 3,
      canSend: true,
      label: 'Remind pending recipients',
      detail: '3 recipients can be reminded.',
    },
  )

  assert.deepEqual(getActivityReminderState([{ status: 'accepted' }]), {
    count: 0,
    canSend: false,
    label: 'No pending reminders',
    detail: 'No assigned, in-progress, or returned recipients need reminders.',
  })
})

test('normalizeActivityAssignmentFromApi keeps recipient review and submission fields', () => {
  const assignment = normalizeActivityAssignmentFromApi({
    _id: 'assignment-1',
    status: 'submitted',
    recipient: { _id: 'user-1', firstName: 'Jason', lastName: 'Raine' },
    textResponse: 'Done.',
    submissionCount: 2,
    latestSubmittedAt: '2026-10-13T10:00:00.000Z',
    feedback: 'Good work.',
    score: 90,
    maximumScore: 100,
    isLate: true,
  })

  assert.deepEqual(assignment, {
    id: 'assignment-1',
    status: 'submitted',
    recipientId: 'user-1',
    recipientName: 'Jason Raine',
    textResponse: 'Done.',
    submissionCount: 2,
    latestSubmittedAt: '2026-10-13T10:00:00.000Z',
    feedback: 'Good work.',
    score: 90,
    maximumScore: 100,
    isLate: true,
    attachments: [],
    history: [],
    raw: {
      _id: 'assignment-1',
      status: 'submitted',
      recipient: { _id: 'user-1', firstName: 'Jason', lastName: 'Raine' },
      textResponse: 'Done.',
      submissionCount: 2,
      latestSubmittedAt: '2026-10-13T10:00:00.000Z',
      feedback: 'Good work.',
      score: 90,
      maximumScore: 100,
      isLate: true,
    },
  })
})

test('getActivityMetrics counts review and recipient progress', () => {
  const metrics = getActivityMetrics([
    { id: 'a1', status: 'submitted' },
    { id: 'a2', status: 'late' },
    { id: 'a3', status: 'accepted' },
    { id: 'a4', status: 'returned' },
  ])

  assert.deepEqual(metrics, {
    total: 4,
    pending: 0,
    submitted: 2,
    accepted: 1,
    returned: 1,
  })
})

test('getActivityHistoryItems sorts recent activity records and exposes display fields', () => {
  assert.deepEqual(
    getActivityHistoryItems([
      {
        id: 'older',
        title: 'Older activity',
        project: 'Planning',
        reporter: 'Mika',
        activityStatus: 'submitted',
        status: 'In Progress',
        updatedAt: '2026-10-11T08:00:00.000Z',
        createdAt: '2026-10-10T08:00:00.000Z',
      },
      {
        id: 'newer',
        title: 'Newer activity',
        project: 'Launch',
        reporter: '',
        activityStatus: '',
        status: 'For Review',
        updatedAt: '2026-10-13T08:00:00.000Z',
        createdAt: '2026-10-12T08:00:00.000Z',
      },
    ]),
    [
      {
        id: 'newer',
        title: 'Newer activity',
        project: 'Launch',
        actor: 'Reporter',
        status: 'For Review',
        changedAt: '2026-10-13T08:00:00.000Z',
      },
      {
        id: 'older',
        title: 'Older activity',
        project: 'Planning',
        actor: 'Mika',
        status: 'submitted',
        changedAt: '2026-10-11T08:00:00.000Z',
      },
    ],
  )
})

test('getVisibleActivityAssignments searches filters and sorts reviewer assignments', () => {
  const assignments = [
    {
      id: 'late',
      recipientName: 'Mika Tan',
      status: 'late',
      latestSubmittedAt: '2026-10-13T10:00:00.000Z',
    },
    {
      id: 'accepted',
      recipientName: 'Jason Raine',
      status: 'accepted',
      latestSubmittedAt: '2026-10-12T09:00:00.000Z',
    },
    {
      id: 'submitted',
      recipientName: 'Ava Lee',
      status: 'submitted',
      latestSubmittedAt: '2026-10-14T08:00:00.000Z',
    },
  ]

  assert.deepEqual(
    getVisibleActivityAssignments(assignments, { query: 'a', status: 'submitted', sort: 'submitted' })
      .map((assignment) => assignment.id),
    ['submitted'],
  )
  assert.deepEqual(
    getVisibleActivityAssignments(assignments, { query: '', status: '', sort: 'submitted' })
      .map((assignment) => assignment.id),
    ['submitted', 'late', 'accepted'],
  )
  assert.deepEqual(
    getVisibleActivityAssignments(assignments, { query: '', status: '', sort: 'status' })
      .map((assignment) => assignment.id),
    ['accepted', 'late', 'submitted'],
  )
})

test('getActivitySubmissionError mirrors activity submission rules', () => {
  const activity = {
    startDate: '2026-10-12T00:00:00.000Z',
    activitySettings: {
      allowTextResponse: true,
      requireAttachment: true,
      allowResubmission: false,
      maxSubmissions: 1,
    },
  }

  assert.equal(
    getActivitySubmissionError({
      activity,
      assignment: { status: 'in-progress', submissionCount: 0, attachments: [] },
      textResponse: 'Done',
      now: new Date('2026-10-13T00:00:00.000Z'),
    }),
    'At least one attachment is required.',
  )
  assert.equal(
    getActivitySubmissionError({
      activity,
      assignment: { status: 'submitted', submissionCount: 1, attachments: [{ id: 'file-1' }] },
      textResponse: 'Done again',
      now: new Date('2026-10-13T00:00:00.000Z'),
    }),
    'Resubmission is disabled.',
  )
})

test('validateActivityReview limits status and score before sending review', () => {
  assert.equal(
    validateActivityReview({ status: 'approved', score: 10, maximumScore: 100 }),
    'Choose Accept or Return.',
  )
  assert.equal(
    validateActivityReview({ status: 'accepted', score: 125, maximumScore: 100 }),
    'Score must be between 0 and 100.',
  )
  assert.equal(validateActivityReview({ status: 'returned', score: '', maximumScore: 100 }), '')
  assert.equal(validateActivityReview({ status: 'accepted', score: 0, maximumScore: 100 }), '')
})

test('validateActivityAttachmentFile checks size and allowed extensions', () => {
  assert.equal(
    validateActivityAttachmentFile(
      { name: 'notes.exe', size: 10 },
      { maxFileSizeMB: 1, allowedFileTypes: ['pdf', '.png'] },
    ),
    'Allowed file types: pdf, png.',
  )
  assert.equal(
    validateActivityAttachmentFile(
      { name: 'large.pdf', size: 2 * 1024 * 1024 },
      { maxFileSizeMB: 1, allowedFileTypes: ['pdf'] },
    ),
    'File must be 1MB or smaller.',
  )
  assert.equal(
    validateActivityAttachmentFile(
      { name: 'brief.pdf', size: 100 },
      { maxFileSizeMB: 1, allowedFileTypes: ['pdf'] },
    ),
    '',
  )
})
