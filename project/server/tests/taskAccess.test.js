const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canCreateTaskInProject,
  canDeleteTask,
  canManageTask,
  canManageTaskAttachments,
  canAssignCreatedRecordManager,
  canUpdateTaskProgress,
  canViewArchivedUsers,
  getPermittedTaskChanges,
  getPermittedManagedRecordChanges,
  managerForCreatedRecord,
} = require('../services/taskAccess');

const manager = { _id: 'manager-1', role: 'manager' };
const admin = { _id: 'admin-1', role: 'admin' };
const member = { _id: 'member-1', role: 'member' };
const managedProject = { manager: 'manager-1' };
const otherProject = { manager: 'manager-2' };

test('task creation is limited to administrators and the project manager', () => {
  assert.equal(canCreateTaskInProject(admin, otherProject), true);
  assert.equal(canCreateTaskInProject(manager, managedProject), true);
  assert.equal(canCreateTaskInProject(manager, otherProject), false);
  assert.equal(canCreateTaskInProject(member, managedProject), false);
});

test('full task management follows creator or managed-project ownership', () => {
  assert.equal(canManageTask(admin, {}, otherProject), true);
  assert.equal(canManageTask(manager, { reporter: 'manager-1' }, otherProject), true);
  assert.equal(canManageTask(manager, { reporter: 'manager-2' }, managedProject), true);
  assert.equal(canManageTask(manager, { reporter: 'manager-2' }, otherProject), false);
  assert.equal(canManageTask(member, { reporter: 'member-1' }, managedProject), false);
});

test('workers can update progress while attachments remain assignee-only', () => {
  const assignedTask = { assignee: 'member-1', collaborators: ['member-2'], watchers: ['member-3'] };

  assert.equal(canUpdateTaskProgress(member, assignedTask), true);
  assert.equal(canManageTaskAttachments(member, assignedTask, otherProject), true);
  assert.equal(canUpdateTaskProgress({ _id: 'member-2', role: 'member' }, assignedTask), true);
  assert.equal(canManageTaskAttachments({ _id: 'member-2', role: 'member' }, assignedTask, otherProject), false);
  assert.equal(canManageTaskAttachments({ _id: 'member-3', role: 'member' }, assignedTask, otherProject), false);
  assert.equal(canManageTaskAttachments(manager, assignedTask, otherProject), false);
  assert.equal(canManageTaskAttachments(admin, assignedTask, otherProject), false);
});

test('managers cannot assign a new project or team to another manager', () => {
  assert.equal(canAssignCreatedRecordManager(admin, 'manager-2'), true);
  assert.equal(canAssignCreatedRecordManager(manager, 'manager-1'), true);
  assert.equal(canAssignCreatedRecordManager(manager), true);
  assert.equal(canAssignCreatedRecordManager(manager, 'manager-2'), false);
  assert.equal(managerForCreatedRecord(admin, 'manager-2'), 'manager-2');
  assert.equal(managerForCreatedRecord(manager, 'manager-2'), 'manager-1');
  assert.equal(managerForCreatedRecord(manager), 'manager-1');
});

test('archived user records stay administrator-only', () => {
  assert.equal(canViewArchivedUsers(admin), true);
  assert.equal(canViewArchivedUsers(manager), false);
  assert.equal(canViewArchivedUsers(member), false);
});

test('task changes reject forbidden fields instead of silently applying a partial update', () => {
  const task = {
    reporter: 'manager-1',
    assignee: 'member-1',
    collaborators: [],
    subtasks: [{ _id: 'subtask-1', title: 'Existing work', completed: false }],
  };
  const requested = { title: 'Changed', status: 'completed', progress: 100, reporter: 'other', type: 'individual-activity', isArchived: true };

  assert.deepEqual(getPermittedTaskChanges(manager, task, otherProject, requested), {
    changes: {},
    deniedFields: ['reporter', 'type'],
  });
  assert.deepEqual(getPermittedTaskChanges(member, task, otherProject, requested), {
    changes: {},
    deniedFields: ['title', 'reporter', 'type', 'isArchived'],
  });
  assert.deepEqual(getPermittedTaskChanges(member, task, otherProject, { status: 'completed', progress: 100 }), {
    changes: { status: 'completed', progress: 100 },
    deniedFields: [],
  });
  const completedSubtasks = [{ _id: 'subtask-1', title: 'Existing work', completed: true }];
  assert.deepEqual(getPermittedTaskChanges(member, task, otherProject, { subtasks: completedSubtasks }), {
    changes: { subtasks: completedSubtasks },
    deniedFields: [],
  });
  assert.deepEqual(
    getPermittedTaskChanges(
      { _id: 'member-2', role: 'member' },
      { ...task, collaborators: ['member-2'] },
      otherProject,
      { subtasks: [{ title: 'Blocked', completed: true }] },
    ),
    { changes: {}, deniedFields: ['subtasks'] },
  );
  assert.deepEqual(getPermittedTaskChanges({ _id: 'member-2', role: 'member' }, task, otherProject, requested), {
    changes: {},
    deniedFields: Object.keys(requested),
  });
});

test('assignees cannot change subtask structure', () => {
  const task = {
    reporter: 'manager-1',
    assignee: 'member-1',
    collaborators: [],
    subtasks: [
      { _id: 'subtask-1', title: 'First item', completed: false },
      { _id: 'subtask-2', title: 'Second item', completed: false },
    ],
  };
  const denied = { changes: {}, deniedFields: ['subtasks'] };

  assert.deepEqual(getPermittedTaskChanges(member, task, otherProject, {
    subtasks: [...task.subtasks, { title: 'Added by assignee', completed: false }],
  }), denied, 'adding');
  assert.deepEqual(getPermittedTaskChanges(member, task, otherProject, {
    subtasks: [task.subtasks[0]],
  }), denied, 'removing');
  assert.deepEqual(getPermittedTaskChanges(member, task, otherProject, {
    subtasks: [{ ...task.subtasks[0], title: 'Renamed' }, task.subtasks[1]],
  }), denied, 'renaming');
  assert.deepEqual(getPermittedTaskChanges(member, task, otherProject, {
    subtasks: [task.subtasks[1], task.subtasks[0]],
  }), denied, 'reordering');
});

test('project and team ownership transfers are rejected atomically for managers', () => {
  const requested = { name: 'Updated', manager: 'manager-2' };

  assert.deepEqual(getPermittedManagedRecordChanges(admin, requested), {
    changes: requested,
    deniedFields: [],
  });
  assert.deepEqual(getPermittedManagedRecordChanges(manager, requested), {
    changes: {},
    deniedFields: ['manager'],
  });
  assert.deepEqual(getPermittedManagedRecordChanges(manager, { name: 'Updated', manager: 'manager-1' }), {
    changes: { name: 'Updated', manager: 'manager-1' },
    deniedFields: [],
  });
});

test('task role-permission matrix covers every supported relationship', () => {
  const task = {
    reporter: 'creator-1',
    assignee: 'member-1',
    collaborators: ['collaborator-1'],
    watchers: ['watcher-1'],
  };
  const project = { manager: 'project-manager-1' };
  const cases = [
    { label: 'member', user: { _id: 'ordinary-member-1', role: 'member' }, manage: false, progress: false, attachments: false, delete: false },
    { label: 'watcher', user: { _id: 'watcher-1', role: 'member' }, manage: false, progress: false, attachments: false, delete: false },
    { label: 'collaborator', user: { _id: 'collaborator-1', role: 'member' }, manage: false, progress: true, attachments: false, delete: false },
    { label: 'task creator', user: { _id: 'creator-1', role: 'manager' }, manage: true, progress: false, attachments: false, delete: true },
    { label: 'project manager', user: { _id: 'project-manager-1', role: 'manager' }, manage: true, progress: false, attachments: false, delete: false },
    { label: 'unrelated manager', user: { _id: 'unrelated-manager-1', role: 'manager' }, manage: false, progress: false, attachments: false, delete: false },
    { label: 'admin', user: { _id: 'admin-1', role: 'admin' }, manage: true, progress: false, attachments: false, delete: true },
  ];

  for (const entry of cases) {
    assert.equal(canManageTask(entry.user, task, project), entry.manage, `${entry.label} management`);
    assert.equal(canUpdateTaskProgress(entry.user, task), entry.progress, `${entry.label} progress`);
    assert.equal(canManageTaskAttachments(entry.user, task, project), entry.attachments, `${entry.label} attachments`);
    assert.equal(canDeleteTask(entry.user, task), entry.delete, `${entry.label} deletion`);
  }
});
