const User = require('../models/authModel');
const Team = require('../models/teamModel');
const Project = require('../models/projectModel');
const Task = require('../models/taskModel');
const ActivityAssignment = require('../models/activityAssignmentModel');
const Comment = require('../models/commentModel');
const Notification = require('../models/notificationModel');
const Activity = require('../models/activityLogModel');
const { logActivity } = require('../services/activity');
const { notify } = require('../services/notifications');
const { emitAll, emitToUser } = require('../services/events');
const { buildUserAccountUpdateNotifications } = require('../utils/userAccountNotifications');
const {
  collectProjectRecipients,
  collectTaskRecipients,
  collectTeamRecipients,
} = require('../utils/notificationRecipients');
const fs = require('fs');
const path = require('path');
const { shiftDate, dependencyBlockMessage, personalTaskDateError } = require('../services/taskRules');
const {
  canAssignCreatedRecordManager,
  canCreateTaskInProject,
  canDeleteTask,
  canManageTask,
  canManageTaskAttachments,
  canViewArchivedUsers,
  getPermittedTaskChanges,
  getPermittedManagedRecordChanges,
  managerForCreatedRecord,
} = require('../services/taskAccess');

const forbiddenFieldsResponse = (res, deniedFields) => res.status(403).json({
  message: `You are not allowed to update: ${deniedFields.join(', ')}.`,
  forbiddenFields: deniedFields,
});
const validateManagedMembers = async (managerId, memberIds = []) => {
  const ids = [...new Set((Array.isArray(memberIds) ? memberIds : []).map(String))];
  if (managerId && ids.includes(String(managerId))) {
    return 'The selected manager cannot also be listed as a member.';
  }
  const admins = ids.length ? await User.find({ _id: { $in: ids }, role: 'admin' }).select('_id') : [];
  return admins.length ? 'Administrators manage the workspace and cannot be added as members.' : null;
};
const validateManagedManager = async (managerId) => {
  const manager = managerId ? await User.findById(managerId).select('role') : null;
  return manager?.role === 'manager' ? null : 'Choose an account with the manager role as the project or team manager.';
};
const hasAdminTaskParticipant = async (participantIds) => {
  const ids = [...new Set(participantIds.filter(Boolean).map(String))];
  return ids.length > 0 && await User.exists({ _id: { $in: ids }, role: 'admin' });
};

const visibleTaskQuery = async (user) => {
  const ownPersonal = { scope: 'personal', owner: user._id };
  const projectTask = { scope: { $ne: 'personal' } };
  if (user.role === 'admin') return { $or: [projectTask, ownPersonal] };
  const activityIds = await ActivityAssignment.find({ recipient: user._id }).distinct('activity');
  if (user.role === 'manager') {
    const managedProjects = await Project.find({ manager: user._id }).distinct('_id');
    return { $or: [ownPersonal, { ...projectTask, reporter: user._id }, { ...projectTask, assignee: user._id }, { ...projectTask, collaborators: user._id }, { ...projectTask, watchers: user._id }, { ...projectTask, _id: { $in: activityIds } }, { ...projectTask, project: { $in: managedProjects } }] };
  }
  return { $or: [ownPersonal, { ...projectTask, assignee: user._id }, { ...projectTask, collaborators: user._id }, { ...projectTask, watchers: user._id }, { ...projectTask, _id: { $in: activityIds } }] };
};
const sendPersonalReminders = async (userId) => {
  const now = new Date();
  const rules = [
    ['reminderAt', { $lte: now }, 'reminderNotifiedAt', 'Personal task reminder', 'reminder'],
    ['deadline', { $lt: now }, 'overdueNotifiedAt', 'Personal task overdue', 'overdue'],
    ['deadline', { $gte: now, $lte: new Date(now.getTime() + 86400000) }, 'dueSoonNotifiedAt', 'Personal task due soon', 'deadline'],
  ];
  for (const [dateField, dateQuery, notifiedField, title, type] of rules) {
    const due = await Task.find({ scope: 'personal', owner: userId, isArchived: false, isCancelled: false, status: { $ne: 'completed' }, [dateField]: dateQuery, [notifiedField]: null });
    for (const task of due) {
      await notify(userId, title, task.title, type, 'Task', task._id);
      task[notifiedField] = now;
      await task.save();
    }
  }
};
const list = (Model, populate = '') => async (req, res, next) => { try {
  const page = Math.max(Number(req.query.page) || 1, 1); const limit = Math.min(Number(req.query.limit) || 50, 100);
  const query = { isArchived: req.query.archived === 'true' };
  if (req.query.search) query.$or = ['name', 'title'].map((key) => ({ [key]: new RegExp(req.query.search, 'i') }));
  const [items, total] = await Promise.all([Model.find(query).populate(populate).sort('-createdAt').skip((page - 1) * limit).limit(limit), Model.countDocuments(query)]);
  res.json({ items, page, pages: Math.ceil(total / limit), total });
} catch (e) { next(e); } };
const notifyRecipients = (recipients, title, message, type, entityType, entityId) =>
  Promise.all(recipients.map((recipient) => notify(recipient, title, message, type, entityType, entityId)));

exports.users = async (req, res, next) => { try {
  if (req.query.archived === 'true' && !canViewArchivedUsers(req.user)) return res.status(403).json({ message: 'Archived user records are administrator-only.' });
  const query = {};
  if (req.query.archived === 'true') query.isArchived = true;
  if (req.query.archived === 'false') query.isArchived = { $ne: true };
  res.json({ items: await User.find(query).select('-password').sort('firstName') });
} catch (e) { next(e); } };
exports.updateUser = async (req, res, next) => { try {
  const allowed = ['role', 'isArchived'];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (String(req.user._id) === req.params.id && changes.isArchived === true) return res.status(400).json({ message: 'You cannot archive your own account.' });
  const before = await User.findById(req.params.id).select('-password');
  if (!before) return res.status(404).json({ message: 'User not found.' });
  const user = await User.findByIdAndUpdate(req.params.id, { $set: changes }, { new: true, runValidators: true }).select('-password');
  const notifications = buildUserAccountUpdateNotifications({ actor: req.user, before, after: user, changes });
  const adminIds = notifications.some((item) => item.audience === 'admins')
    ? await User.find({ role: 'admin', isArchived: false }).distinct('_id')
    : [];
  const recipients = new Set();
  for (const item of notifications) {
    if (item.audience === 'target') recipients.add(String(user._id));
    if (item.audience === 'admins') adminIds.forEach((id) => recipients.add(String(id)));
  }
  await Promise.all([...recipients].flatMap((recipient) =>
    notifications
      .filter((item) => item.audience === 'target' ? recipient === String(user._id) : adminIds.map(String).includes(recipient))
      .map((item) => notify(recipient, item.title, item.message, item.type, item.entityType, item.entityId)),
  ));
  await logActivity(req.user._id, 'UPDATE_USER', 'User', user._id, changes);
  emitAll('user:changed', user);
  res.json({ user });
} catch (e) { next(e); } };
exports.deleteUser = async (req, res, next) => { try {
  if (String(req.user._id) === req.params.id) return res.status(400).json({ message: 'You cannot delete your own account.' });
  const item = await User.findOneAndDelete({ _id: req.params.id, isArchived: true }).select('-password');
  if (!item) return res.status(404).json({ message: 'Archived user not found.' });
  await logActivity(req.user._id, 'DELETE_USER', 'User', req.params.id);
  emitAll('user:deleted', { id: req.params.id });
  res.json({ message: 'User deleted.', item });
} catch (e) { next(e); } };
exports.activityLog = async (req, res, next) => { try {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const query = {};
  if (req.query.search) {
    query.$or = ['action', 'entityType'].map((key) => ({ [key]: new RegExp(req.query.search, 'i') }));
  }
  const [items, total] = await Promise.all([
    Activity.find(query).populate('actor', 'firstName lastName username email role').sort('-createdAt').limit(limit),
    Activity.countDocuments(query),
  ]);
  res.json({ items, total });
} catch (e) { next(e); } };
exports.listTeams = async (req, res, next) => { try {
  const query = { isArchived: req.query.archived === 'true' };
  if (req.user.role !== 'admin') query.$or = [{ manager: req.user._id }, { members: req.user._id }];
  const items = await Team.find(query).populate('manager members').sort('-createdAt');
  res.json({ items, total: items.length });
} catch (e) { next(e); } };
const syncTeamProjects = async (team) => {
  const teamMembers = [...new Set((team.members || []).map((member) => String(member._id || member)))];
  const projects = await Project.find({ team: team._id }).select('_id manager');
  for (const project of projects) {
    const members = teamMembers.filter((id) => id !== String(project.manager));
    const updated = await Project.findByIdAndUpdate(project._id, { $set: { members } }, { new: true })
      .populate('team manager members');
    if (updated) emitAll('project:changed', updated);
  }
  return projects.length;
};
exports.teamOverview = async (req, res, next) => { try {
  const visibility = req.user.role === 'admin'
    ? { _id: req.params.id }
    : { _id: req.params.id, $or: [{ manager: req.user._id }, { members: req.user._id }] };
  const team = await Team.findOne(visibility).populate('manager members');
  if (!team) return res.status(404).json({ message: 'Team not found.' });
  const projects = await Project.find({ team: team._id, isArchived: false })
    .populate('team manager members').sort('-createdAt');
  const projectIds = projects.map((project) => project._id);
  const tasks = await Task.find({ project: { $in: projectIds }, isArchived: false, type: 'standard' })
    .populate('project assignee reporter collaborators watchers dependencies').sort('-createdAt');
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const overdue = tasks.filter((task) => task.deadline && task.deadline < new Date() && task.status !== 'completed').length;
  const participates = (task, userId) => String(task.assignee?._id || task.assignee || '') === String(userId)
    || (task.collaborators || []).some((value) => String(value._id || value) === String(userId));
  const people = [team.manager, ...(team.members || [])].filter(Boolean);
  const seenPeople = new Set();
  const workload = people.filter((person) => {
    const id = String(person._id || person);
    if (seenPeople.has(id)) return false;
    seenPeople.add(id);
    return true;
  }).map((person) => ({
    user: person,
    assigned: tasks.filter((task) => participates(task, person._id || person)).length,
    completed: tasks.filter((task) => task.status === 'completed' && participates(task, person._id || person)).length,
  }));
  res.json({ item: team, projects, tasks, summary: {
    projects: projects.length,
    tasks: tasks.length,
    completed,
    overdue,
    progress: tasks.length ? Math.round(completed / tasks.length * 100) : 0,
  }, workload });
} catch (e) { next(e); } };
exports.createTeam = async (req, res, next) => { try { if (!canAssignCreatedRecordManager(req.user, req.body.manager)) return forbiddenFieldsResponse(res, ['manager']); const manager = managerForCreatedRecord(req.user, req.body.manager); const invalidManager = await validateManagedManager(manager); if (invalidManager) return res.status(400).json({ message: invalidManager }); const invalidMembers = await validateManagedMembers(manager, req.body.members); if (invalidMembers) return res.status(400).json({ message: invalidMembers }); const item = await Team.create({ ...req.body, manager }); await notifyRecipients(collectTeamRecipients(item, { exclude: req.user._id }), 'Team created', item.name, 'team', 'Team', item._id); await logActivity(req.user._id, 'CREATE_TEAM', 'Team', item._id); emitAll('team:changed', item); res.status(201).json({ item }); } catch (e) { next(e); } };
exports.updateTeam = async (req, res, next) => { try {
  const query = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, manager: req.user._id };
  const authorization = getPermittedManagedRecordChanges(req.user, req.body);
  if (authorization.deniedFields.length) return forbiddenFieldsResponse(res, authorization.deniedFields);
  const changes = authorization.changes;
  const before = await Team.findOne(query).select('manager members');
  if (!before) return res.status(403).json({ message: 'Only this team manager can update it.' });
  if (Object.hasOwn(changes, 'manager')) {
    const invalidManager = await validateManagedManager(changes.manager);
    if (invalidManager) return res.status(400).json({ message: invalidManager });
  }
  if (Object.hasOwn(changes, 'members') || Object.hasOwn(changes, 'manager')) {
    const invalidMembers = await validateManagedMembers(changes.manager || before.manager, changes.members || before.members);
    if (invalidMembers) return res.status(400).json({ message: invalidMembers });
  }
  const item = await Team.findOneAndUpdate(query, changes, { new: true, runValidators: true }).populate('manager members');
  const synchronizedProjects = await syncTeamProjects(item);
  const title = Object.hasOwn(changes, 'isArchived') ? (item.isArchived ? 'Team archived' : 'Team restored') : 'Team updated';
  await notifyRecipients(collectTeamRecipients(item, { exclude: req.user._id }), title, item.name, 'team', 'Team', item._id);
  await logActivity(req.user._id, 'UPDATE_TEAM', 'Team', item._id);
  emitAll('team:changed', item);
  res.json({ item, synchronizedProjects });
} catch (e) { next(e); } };
exports.deleteTeam = async (req, res, next) => { try { const item = await Team.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ message: 'Team not found.' }); await notifyRecipients(collectTeamRecipients(item, { exclude: req.user._id }), 'Team deleted', item.name, 'team', 'Team', item._id); await logActivity(req.user._id, 'DELETE_TEAM', 'Team', req.params.id); res.json({ message: 'Team deleted.', item }); } catch (e) { next(e); } };
exports.setTeamMembers = async (req, res, next) => { try {
  const query = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, manager: req.user._id };
  const before = await Team.findOne(query).select('manager');
  if (!before) return res.status(403).json({ message: 'Only this team manager can update members.' });
  const invalidMembers = await validateManagedMembers(before.manager, req.body.members);
  if (invalidMembers) return res.status(400).json({ message: invalidMembers });
  const item = await Team.findOneAndUpdate(query, { members: req.body.members || [] }, { new: true, runValidators: true }).populate('manager members');
  if (!item) return res.status(403).json({ message: 'Only this team manager can update members.' });
  await notifyRecipients(collectTeamRecipients(item, { exclude: req.user._id }), 'Team members updated', item.name, 'team', 'Team', item._id);
  await logActivity(req.user._id, 'UPDATE_TEAM_MEMBERS', 'Team', item._id, { members: item.members.length });
  const synchronizedProjects = await syncTeamProjects(item);
  emitAll('team:changed', item); res.json({ item, synchronizedProjects });
} catch (e) { next(e); } };
exports.listProjects = list(Project, 'team manager members');
const projectWithSelectedTeam = async (body, user) => {
  const changes = { ...body };
  if (!body.team) return changes;
  const query = user.role === 'admin'
    ? { _id: body.team }
    : { _id: body.team, manager: user._id };
  const team = await Team.findOne(query).select('manager members');
  if (!team) {
    const error = new Error('You can only assign a team that you manage.');
    error.status = 403;
    throw error;
  }
  const managerId = String(team.manager);
  changes.manager = managerId;
  changes.members = [...new Set((team.members || []).map(String))]
    .filter((memberId) => memberId !== managerId);
  return changes;
};
exports.createProject = async (req, res, next) => { try {
  if (!canAssignCreatedRecordManager(req.user, req.body.manager)) return forbiddenFieldsResponse(res, ['manager']);
  const payload = await projectWithSelectedTeam(req.body, req.user);
  const manager = payload.manager || managerForCreatedRecord(req.user, req.body.manager);
  const invalidManager = await validateManagedManager(manager);
  if (invalidManager) return res.status(400).json({ message: invalidManager });
  const invalidMembers = await validateManagedMembers(manager, payload.members);
  if (invalidMembers) return res.status(400).json({ message: invalidMembers });
  const item = await Project.create({ ...payload, manager });
  await notifyRecipients(collectProjectRecipients(item, { exclude: req.user._id }), 'Project created', item.name, 'project', 'Project', item._id);
  await logActivity(req.user._id, 'CREATE_PROJECT', 'Project', item._id);
  emitAll('project:changed', item);
  res.status(201).json({ item: await item.populate('team manager members') });
} catch (e) { if (e.status) return res.status(e.status).json({ message: e.message }); next(e); } };
exports.updateProject = async (req, res, next) => { try {
  const query = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, manager: req.user._id };
  const authorization = getPermittedManagedRecordChanges(req.user, req.body);
  if (authorization.deniedFields.length) return forbiddenFieldsResponse(res, authorization.deniedFields);
  const before = await Project.findOne(query).select('manager members');
  if (!before) return res.status(403).json({ message: 'Only this project manager can update it.' });
  const changes = await projectWithSelectedTeam(authorization.changes, req.user);
  if (Object.hasOwn(changes, 'manager')) {
    const invalidManager = await validateManagedManager(changes.manager);
    if (invalidManager) return res.status(400).json({ message: invalidManager });
  }
  if (Object.hasOwn(changes, 'members') || Object.hasOwn(changes, 'manager')) {
    const invalidMembers = await validateManagedMembers(changes.manager || before.manager, changes.members || before.members);
    if (invalidMembers) return res.status(400).json({ message: invalidMembers });
  }
  const item = await Project.findOneAndUpdate(query, changes, { new: true, runValidators: true }).populate('team manager members');
  const title = Object.hasOwn(changes, 'isArchived') ? (item.isArchived ? 'Project archived' : 'Project restored') : 'Project updated';
  await notifyRecipients(collectProjectRecipients(item, { exclude: req.user._id }), title, item.name, 'project', 'Project', item._id);
  await logActivity(req.user._id, 'UPDATE_PROJECT', 'Project', item._id);
  emitAll('project:changed', item);
  res.json({ item });
} catch (e) { if (e.status) return res.status(e.status).json({ message: e.message }); next(e); } };
exports.deleteProject = async (req, res, next) => { try { const item = await Project.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ message: 'Project not found.' }); await notifyRecipients(collectProjectRecipients(item, { exclude: req.user._id }), 'Project deleted', item.name, 'project', 'Project', item._id); await logActivity(req.user._id, 'DELETE_PROJECT', 'Project', req.params.id); res.json({ message: 'Project deleted.', item }); } catch (e) { next(e); } };
exports.listTasks = async (req, res, next) => { try {
  await sendPersonalReminders(req.user._id);
  const query = { ...await visibleTaskQuery(req.user), isArchived: req.query.archived === 'true' };
  ['status', 'priority', 'project', 'team', 'assignee', 'type', 'scope'].forEach((key) => { if (req.query[key]) query[key] = req.query[key]; });
  if (req.query.search) query.title = new RegExp(req.query.search, 'i');
  const items = await Task.find(query).populate('project team owner assignee reporter collaborators watchers dependencies').sort(req.query.sort || '-createdAt');
  if (req.user.role !== 'admin') {
    const assignments = await ActivityAssignment.find({ recipient: req.user._id, activity: { $in: items.map((item) => item._id) } }).select('activity status');
    const statuses = new Map(assignments.map((item) => [String(item.activity), item.status]));
    const visibleItems = items.map((item) => ({ ...item.toObject(), myAssignmentStatus: statuses.get(String(item._id)) }));
    return res.json({ items: visibleItems, total: visibleItems.length });
  }
  res.json({ items, total: items.length });
} catch (e) { next(e); } };

exports.listPersonalTasks = async (req, res, next) => { try {
  await sendPersonalReminders(req.user._id);
  const items = await Task.find({ scope: 'personal', owner: req.user._id, isArchived: req.query.archived === 'true' })
    .populate('owner assignee reporter').sort(req.query.sort || '-createdAt');
  res.json({ items, total: items.length });
} catch (e) { next(e); } };

exports.createPersonalTask = async (req, res, next) => { try {
  if (!String(req.body.title || '').trim()) return res.status(400).json({ message: 'Title is required.' });
  const dateError = personalTaskDateError(req.body);
  if (dateError) return res.status(400).json({ message: dateError });
  const allowed = ['title', 'description', 'priority', 'status', 'startDate', 'deadline', 'reminderAt', 'tags', 'category', 'subtasks', 'recurrence'];
  const clean = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  const task = await Task.create({ ...clean, type: 'standard', scope: 'personal', owner: req.user._id, reporter: req.user._id, assignee: req.user._id, project: undefined, collaborators: [], watchers: [], dependencies: [] });
  const recurrence = clean.recurrence || {};
  const occurrences = [task];
  if (recurrence.frequency && recurrence.frequency !== 'none' && Number(recurrence.count) > 1) {
    const copies = [];
    for (let i = 1; i < Math.min(Number(recurrence.count), 50); i++) {
      const deadline = clean.deadline ? shiftDate(clean.deadline, recurrence.frequency, Number(recurrence.interval || 1), i) : undefined;
      if (recurrence.endDate && deadline && deadline > new Date(recurrence.endDate)) break;
      copies.push({ ...task.toObject(), _id: undefined, recurrenceParent: task._id, occurrenceDate: deadline, deadline,
        startDate: clean.startDate ? shiftDate(clean.startDate, recurrence.frequency, Number(recurrence.interval || 1), i) : undefined,
        reminderAt: clean.reminderAt ? shiftDate(clean.reminderAt, recurrence.frequency, Number(recurrence.interval || 1), i) : undefined });
    }
    if (copies.length) occurrences.push(...await Task.insertMany(copies));
  }
  await notify(req.user._id, 'Personal task created', task.title, 'personal-task', 'Task', task._id);
  await logActivity(req.user._id, 'CREATE_PERSONAL_TASK', 'Task', task._id, { occurrences: occurrences.length });
  emitToUser(String(req.user._id), 'task:changed', task);
  res.status(201).json({ item: await task.populate('owner assignee reporter'), occurrences: occurrences.length });
} catch (e) { next(e); } };

exports.updatePersonalTask = async (req, res, next) => { try {
  const before = await Task.findOne({ _id: req.params.id, scope: 'personal', owner: req.user._id });
  if (!before) return res.status(404).json({ message: 'Personal task not found.' });
  const dateError = personalTaskDateError(req.body, before);
  if (dateError) return res.status(400).json({ message: dateError });
  const allowed = ['title', 'description', 'priority', 'status', 'startDate', 'deadline', 'reminderAt', 'tags', 'category', 'subtasks', 'progress'];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (changes.status === 'completed') changes.completedAt = new Date();
  else if (changes.status) changes.completedAt = null;
  if (changes.reminderAt !== undefined || changes.deadline !== undefined) {
    changes.reminderNotifiedAt = null; changes.dueSoonNotifiedAt = null; changes.overdueNotifiedAt = null;
  }
  const task = await Task.findByIdAndUpdate(before._id, { $set: changes }, { new: true, runValidators: true }).populate('owner assignee reporter');
  await notify(req.user._id, changes.status === 'completed' ? 'Personal task completed' : 'Personal task updated', task.title, 'personal-task', 'Task', task._id);
  await logActivity(req.user._id, 'UPDATE_PERSONAL_TASK', 'Task', task._id, changes);
  emitToUser(String(req.user._id), 'task:changed', task);
  res.json({ item: task });
} catch (e) { next(e); } };

exports.reopenPersonalTask = async (req, res, next) => { req.body = { ...req.body, status: 'todo' }; return exports.updatePersonalTask(req, res, next); };
exports.archivePersonalTask = async (req, res, next) => { try {
  const task = await Task.findOneAndUpdate({ _id: req.params.id, scope: 'personal', owner: req.user._id }, { isArchived: req.body.archived !== false }, { new: true });
  if (!task) return res.status(404).json({ message: 'Personal task not found.' });
  emitToUser(String(req.user._id), 'task:changed', task); res.json({ item: task });
} catch (e) { next(e); } };
exports.deletePersonalTask = async (req, res, next) => { try {
  const task = await Task.findOneAndDelete({ _id: req.params.id, scope: 'personal', owner: req.user._id });
  if (!task) return res.status(404).json({ message: 'Personal task not found.' });
  emitToUser(String(req.user._id), 'task:deleted', { id: task._id }); res.json({ message: 'Personal task deleted.' });
} catch (e) { next(e); } };
exports.getTask = async (req, res, next) => { try { const item = await Task.findOne({ _id: req.params.id, ...await visibleTaskQuery(req.user) }).populate('project team owner assignee reporter collaborators watchers dependencies'); if (!item) return res.status(404).json({ message: 'Task not found.' }); res.json({ item }); } catch (e) { next(e); } };

const validateDependencies = async (taskId, projectId, dependencies = []) => {
  const ids = [...new Set(dependencies.map(String))];
  if (taskId && ids.includes(String(taskId))) return 'A task cannot depend on itself.';
  const valid = await Task.countDocuments({ _id: { $in: ids }, project: projectId, type: 'standard' });
  if (valid !== ids.length) return 'Dependencies must be Standard Tasks in the same project.';
  if (taskId) {
    const visit = async (idsToVisit, seen = new Set()) => { for (const current of idsToVisit) { if (String(current) === String(taskId)) return true; if (seen.has(String(current))) continue; seen.add(String(current)); const task = await Task.findById(current).select('dependencies'); if (task && await visit(task.dependencies, seen)) return true; } return false; };
    if (await visit(ids)) return 'This dependency would create a cycle.';
  }
  return null;
};

exports.createTask = async (req, res, next) => { try {
  const project = await Project.findById(req.body.project);
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  if (!canCreateTaskInProject(req.user, project)) return res.status(403).json({ message: 'Managers can only create tasks in projects they manage.' });
  const allowedMembers = new Set([String(project.manager), ...(project.members || []).map(String)]);
  const participants = [req.body.assignee, ...(req.body.collaborators || []), ...(req.body.watchers || [])].filter(Boolean).map(String);
  if (participants.some((userId) => !allowedMembers.has(userId))) return res.status(400).json({ message: 'Assignee, collaborators, and watchers must belong to the project.' });
  if (await hasAdminTaskParticipant(participants)) return res.status(400).json({ message: 'Administrators manage the workspace and cannot be assigned task work.' });
  const dependencyError = await validateDependencies(null, req.body.project, req.body.dependencies || []);
  if (dependencyError) return res.status(400).json({ message: dependencyError });
  if (req.body.status && (req.body.dependencies || []).length) { const incomplete = await Task.countDocuments({ _id: { $in: req.body.dependencies }, status: { $ne: 'completed' } }); const message = dependencyBlockMessage(req.body.status, incomplete); if (message) return res.status(409).json({ message }); }
  const recurrence = req.body.recurrence || { frequency: 'none', count: 1, interval: 1 };
  const item = await Task.create({ ...req.body, type: 'standard', reporter: req.user._id });
  const occurrences = [item];
  if (recurrence.frequency && recurrence.frequency !== 'none' && recurrence.count > 1) {
    const copies = [];
    for (let index = 1; index < Math.min(Number(recurrence.count), 50); index++) {
      const deadline = req.body.deadline ? shiftDate(req.body.deadline, recurrence.frequency, Number(recurrence.interval || 1), index) : undefined;
      if (recurrence.endDate && deadline && deadline > new Date(recurrence.endDate)) break;
      copies.push({ ...req.body, type: 'standard', reporter: req.user._id, recurrenceParent: item._id, occurrenceDate: deadline, deadline, startDate: req.body.startDate ? shiftDate(req.body.startDate, recurrence.frequency, Number(recurrence.interval || 1), index) : undefined, recurrence });
    }
    if (copies.length) occurrences.push(...await Task.insertMany(copies));
  }
  const recipients = collectTaskRecipients(item, { exclude: req.user._id });
  await notifyRecipients(recipients, 'New task assigned', item.title, 'assignment', 'Task', item._id);
  await logActivity(req.user._id, 'CREATE_TASK', 'Task', item._id, { occurrences: occurrences.length }); emitAll('task:changed', item);
  res.status(201).json({ item: await item.populate('project assignee reporter collaborators watchers dependencies'), occurrences: occurrences.length });
} catch (e) { next(e); } };

exports.updateTask = async (req, res, next) => { try {
  const before = await Task.findOne({ _id: req.params.id, ...await visibleTaskQuery(req.user) }); if (!before) return res.status(404).json({ message: 'Task not found.' });
  if (before.scope === 'personal') return exports.updatePersonalTask(req, res, next);
  const project = await Project.findById(before.project).select('manager members');
  const canFullyManage = canManageTask(req.user, before, project);
  if (before.type === 'individual-activity' && !canFullyManage) return res.status(403).json({ message: 'Use your individual assignment to update this activity.' });
  const authorization = getPermittedTaskChanges(req.user, before, project, req.body);
  if (authorization.deniedFields.length) return forbiddenFieldsResponse(res, authorization.deniedFields);
  const changes = authorization.changes;
  const targetProject = changes.project && String(changes.project) !== String(before.project)
    ? await Project.findById(changes.project)
    : project;
  if (!targetProject) return res.status(404).json({ message: 'Project not found.' });
  if (changes.project && !canCreateTaskInProject(req.user, targetProject)) return res.status(403).json({ message: 'Managers can only move tasks into projects they manage.' });
  if (changes.assignee || changes.collaborators || changes.watchers) {
    const allowedMembers = new Set([String(targetProject.manager), ...(targetProject.members || []).map(String)]);
    const participants = [changes.assignee ?? before.assignee, ...(changes.collaborators ?? before.collaborators ?? []), ...(changes.watchers ?? before.watchers ?? [])].filter(Boolean).map(String);
    if (participants.some((userId) => !allowedMembers.has(userId))) return res.status(400).json({ message: 'Assignee, collaborators, and watchers must belong to the project.' });
    if (await hasAdminTaskParticipant(participants)) return res.status(400).json({ message: 'Administrators manage the workspace and cannot be assigned task work.' });
  }
  if (changes.dependencies) { const error = await validateDependencies(before._id, before.project, changes.dependencies); if (error) return res.status(400).json({ message: error }); }
  const effectiveDependencies = changes.dependencies || before.dependencies;
  if (changes.status && effectiveDependencies.length) { const incomplete = await Task.countDocuments({ _id: { $in: effectiveDependencies }, status: { $ne: 'completed' } }); const message = dependencyBlockMessage(changes.status, incomplete); if (message) return res.status(409).json({ message }); }
  const item = await Task.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true }).populate('project assignee reporter collaborators watchers dependencies');
  await logActivity(req.user._id, 'UPDATE_TASK', 'Task', item._id, { status: item.status });
  { const recipients = collectTaskRecipients(item, { exclude: req.user._id }); const title = Object.hasOwn(changes, 'isArchived') ? (item.isArchived ? 'Task archived' : 'Task restored') : before.status !== item.status ? 'Task status updated' : 'Task updated'; const message = before.status !== item.status ? `${item.title}: ${item.status}` : item.title; await notifyRecipients(recipients, title, message, before.status !== item.status ? 'status' : 'task', 'Task', item._id); }
  emitAll('task:changed', item); res.json({ item });
} catch (e) { next(e); } };
exports.deleteTask = async (req, res, next) => { try { const item = await Task.findById(req.params.id); if (!item) return res.status(404).json({ message: 'Task not found.' }); if (item.scope === 'personal') return res.status(403).json({ message: 'Use the personal task endpoint to delete a personal task.' }); if (!canDeleteTask(req.user, item)) return res.status(403).json({ message: 'Only the creator or an administrator can delete this task.' }); await item.deleteOne(); await notifyRecipients(collectTaskRecipients(item, { exclude: req.user._id }), 'Task deleted', item.title, 'task', 'Task', item._id); if (item.type === 'individual-activity') await ActivityAssignment.deleteMany({ activity: item._id }); await logActivity(req.user._id, 'DELETE_TASK', 'Task', req.params.id); emitAll('task:deleted', { id: req.params.id }); res.json({ message: 'Task deleted.', item }); } catch (e) { next(e); } };
exports.addAttachment = async (req, res, next) => { try {
  if (!req.file) return res.status(400).json({ message: 'Choose a file to upload.' });
  const task = await Task.findOne({ _id: req.params.id, ...await visibleTaskQuery(req.user) });
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  if (task.scope === 'personal' && String(task.owner) !== String(req.user._id)) { fs.unlink(req.file.path, () => {}); return res.status(403).json({ message: 'Only the owner can manage personal task files.' }); }
  const project = await Project.findById(task.project).select('manager');
  const canMutateAttachment = task.type === 'individual-activity'
    ? canManageTask(req.user, task, project)
    : canManageTaskAttachments(req.user, task, project);
  if (!canMutateAttachment) { fs.unlink(req.file.path, () => {}); return res.status(403).json({ message: task.type === 'individual-activity' ? 'Only an activity creator or reviewer can add reference files.' : 'Only task managers, assignees, and collaborators can upload task files.' }); }
  const attachment = { name: req.file.originalname, url: `/uploads/${req.file.filename}`, mimeType: req.file.mimetype, size: req.file.size };
  task.attachments.push(attachment); await task.save();
  if (task.recurrence?.frequency && task.recurrence.frequency !== 'none' && !task.recurrenceParent) await Task.updateMany({ recurrenceParent: task._id }, { $push: { attachments: attachment } });
  await notifyRecipients(collectTaskRecipients(task, { exclude: req.user._id }), 'Task attachment added', `${task.title}: ${attachment.name}`, 'attachment', 'Task', task._id);
  await logActivity(req.user._id, 'ADD_ATTACHMENT', 'Task', task._id, { name: attachment.name });
  emitAll('task:changed', task); res.status(201).json({ item: attachment, task });
} catch (e) { next(e); } };
exports.deleteAttachment = async (req, res, next) => { try {
  const task = await Task.findOne({ _id: req.params.id, ...await visibleTaskQuery(req.user) });
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  if (task.scope === 'personal' && String(task.owner) !== String(req.user._id)) return res.status(403).json({ message: 'Only the owner can manage personal task files.' });
  const project = await Project.findById(task.project).select('manager');
  const canMutateAttachment = task.type === 'individual-activity'
    ? canManageTask(req.user, task, project)
    : canManageTaskAttachments(req.user, task, project);
  if (!canMutateAttachment) return res.status(403).json({ message: task.type === 'individual-activity' ? 'Only an activity creator or reviewer can delete reference files.' : 'Only task managers, assignees, and collaborators can delete task files.' });
  const attachment = task.attachments.id(req.params.attachmentId);
  if (!attachment) return res.status(404).json({ message: 'Attachment not found.' });
  const attachmentUrl = attachment.url, filename = path.basename(attachmentUrl); attachment.deleteOne(); await task.save();
  if (task.recurrence?.frequency && task.recurrence.frequency !== 'none' && !task.recurrenceParent) await Task.updateMany({ recurrenceParent: task._id }, { $pull: { attachments: { url: attachmentUrl } } });
  fs.unlink(path.join(__dirname, '..', 'uploads', filename), () => {});
  await notifyRecipients(collectTaskRecipients(task, { exclude: req.user._id }), 'Task attachment removed', task.title, 'attachment', 'Task', task._id);
  await logActivity(req.user._id, 'DELETE_ATTACHMENT', 'Task', task._id, { name: filename });
  emitAll('task:changed', task); res.json({ message: 'Attachment deleted.' });
} catch (e) { next(e); } };
exports.listComments = async (req, res, next) => { try { const task = await Task.findOne({ _id: req.params.taskId, ...await visibleTaskQuery(req.user) }); if (!task) return res.status(404).json({ message: 'Task not found.' }); res.json({ items: await Comment.find({ task: task._id }).populate('author').sort('createdAt') }); } catch (e) { next(e); } };
exports.createComment = async (req, res, next) => { try { const task = await Task.findOne({ _id: req.params.taskId, ...await visibleTaskQuery(req.user) }); if (!task) return res.status(404).json({ message: 'Task not found.' }); const item = await Comment.create({ task: task._id, author: req.user._id, body: req.body.body }); await notifyRecipients(collectTaskRecipients(task, { exclude: req.user._id }), 'New task comment', task.title, 'comment', 'Task', task._id); await logActivity(req.user._id, 'COMMENT_TASK', 'Task', task._id); if (task.scope === 'personal') emitToUser(String(req.user._id), 'comment:new', item); else emitAll('comment:new', item); res.status(201).json({ item }); } catch (e) { next(e); } };
exports.updateComment = async (req, res, next) => { try { const item = await Comment.findOneAndUpdate({ _id: req.params.id, author: req.user._id }, { body: req.body.body }, { new: true, runValidators: true }); if (!item) return res.status(404).json({ message: 'Comment not found.' }); res.json({ item }); } catch (e) { next(e); } };
exports.deleteComment = async (req, res, next) => { try { const query = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, author: req.user._id }; const item = await Comment.findOneAndDelete(query); if (!item) return res.status(404).json({ message: 'Comment not found.' }); res.json({ message: 'Comment deleted.' }); } catch (e) { next(e); } };
exports.notifications = async (req, res, next) => { try { res.json({ items: await Notification.find({ user: req.user._id }).sort('-createdAt') }); } catch (e) { next(e); } };
exports.readNotification = async (req, res, next) => { try { res.json({ item: await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true }, { new: true }) }); } catch (e) { next(e); } };
exports.readAll = async (req, res, next) => { try { await Notification.updateMany({ user: req.user._id }, { isRead: true }); res.json({ message: 'Notifications marked as read.' }); } catch (e) { next(e); } };
exports.deleteNotification = async (req, res, next) => { try { await Notification.deleteOne({ _id: req.params.id, user: req.user._id }); res.json({ message: 'Notification deleted.' }); } catch (e) { next(e); } };
exports.activity = async (req, res, next) => { try { res.json({ items: await Activity.find({}).populate('actor').sort('-createdAt').limit(200) }); } catch (e) { next(e); } };
exports.dashboard = async (req, res, next) => { try { const tq = await visibleTaskQuery(req.user); const recentQuery = req.user.role === 'admin' ? Activity.find({}).populate('actor').sort('-createdAt').limit(10) : Promise.resolve([]); const [projects, total, todo, inProgress, review, completed, overdue, recent] = await Promise.all([Project.countDocuments({ isArchived: false }), Task.countDocuments(tq), Task.countDocuments({ ...tq, status: 'todo' }), Task.countDocuments({ ...tq, status: 'in-progress' }), Task.countDocuments({ ...tq, status: 'for-review' }), Task.countDocuments({ ...tq, status: 'completed' }), Task.countDocuments({ ...tq, deadline: { $lt: new Date() }, status: { $ne: 'completed' } }), recentQuery]); res.json({ projects, total, todo, inProgress, review, completed, overdue, recent }); } catch (e) { next(e); } };
