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
const { emitAll } = require('../services/events');
const { buildUserAccountUpdateNotifications } = require('../utils/userAccountNotifications');
const {
  collectProjectRecipients,
  collectTaskRecipients,
  collectTeamRecipients,
} = require('../utils/notificationRecipients');
const fs = require('fs');
const path = require('path');
const { shiftDate, dependencyBlockMessage } = require('../services/taskRules');
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

const visibleTaskQuery = async (user) => {
  if (user.role === 'admin') return {};
  const activityIds = await ActivityAssignment.find({ recipient: user._id }).distinct('activity');
  if (user.role === 'manager') {
    const managedProjects = await Project.find({ manager: user._id }).distinct('_id');
    return { $or: [{ reporter: user._id }, { assignee: user._id }, { collaborators: user._id }, { watchers: user._id }, { _id: { $in: activityIds } }, { project: { $in: managedProjects } }] };
  }
  return { $or: [{ assignee: user._id }, { collaborators: user._id }, { watchers: user._id }, { _id: { $in: activityIds } }] };
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
exports.listTeams = list(Team, 'manager members');
exports.createTeam = async (req, res, next) => { try { if (!canAssignCreatedRecordManager(req.user, req.body.manager)) return forbiddenFieldsResponse(res, ['manager']); const item = await Team.create({ ...req.body, manager: managerForCreatedRecord(req.user, req.body.manager) }); await notifyRecipients(collectTeamRecipients(item, { exclude: req.user._id }), 'Team created', item.name, 'team', 'Team', item._id); await logActivity(req.user._id, 'CREATE_TEAM', 'Team', item._id); emitAll('team:changed', item); res.status(201).json({ item }); } catch (e) { next(e); } };
exports.updateTeam = async (req, res, next) => { try { const query = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, manager: req.user._id }; const authorization = getPermittedManagedRecordChanges(req.user, req.body); if (authorization.deniedFields.length) return forbiddenFieldsResponse(res, authorization.deniedFields); const changes = authorization.changes; const item = await Team.findOneAndUpdate(query, changes, { new: true, runValidators: true }); if (!item) return res.status(403).json({ message: 'Only this team manager can update it.' }); const title = Object.hasOwn(changes, 'isArchived') ? (item.isArchived ? 'Team archived' : 'Team restored') : 'Team updated'; await notifyRecipients(collectTeamRecipients(item, { exclude: req.user._id }), title, item.name, 'team', 'Team', item._id); await logActivity(req.user._id, 'UPDATE_TEAM', 'Team', item._id); emitAll('team:changed', item); res.json({ item }); } catch (e) { next(e); } };
exports.deleteTeam = async (req, res, next) => { try { const item = await Team.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ message: 'Team not found.' }); await notifyRecipients(collectTeamRecipients(item, { exclude: req.user._id }), 'Team deleted', item.name, 'team', 'Team', item._id); await logActivity(req.user._id, 'DELETE_TEAM', 'Team', req.params.id); res.json({ message: 'Team deleted.', item }); } catch (e) { next(e); } };
exports.setTeamMembers = async (req, res, next) => { try {
  const query = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, manager: req.user._id };
  const item = await Team.findOneAndUpdate(query, { members: req.body.members || [] }, { new: true, runValidators: true }).populate('manager members');
  if (!item) return res.status(403).json({ message: 'Only this team manager can update members.' });
  await notifyRecipients(collectTeamRecipients(item, { exclude: req.user._id }), 'Team members updated', item.name, 'team', 'Team', item._id);
  await logActivity(req.user._id, 'UPDATE_TEAM_MEMBERS', 'Team', item._id, { members: item.members.length });
  emitAll('team:changed', item); res.json({ item });
} catch (e) { next(e); } };
exports.listProjects = list(Project, 'team manager members');
exports.createProject = async (req, res, next) => { try { if (!canAssignCreatedRecordManager(req.user, req.body.manager)) return forbiddenFieldsResponse(res, ['manager']); const item = await Project.create({ ...req.body, manager: managerForCreatedRecord(req.user, req.body.manager) }); await notifyRecipients(collectProjectRecipients(item, { exclude: req.user._id }), 'Project created', item.name, 'project', 'Project', item._id); await logActivity(req.user._id, 'CREATE_PROJECT', 'Project', item._id); emitAll('project:changed', item); res.status(201).json({ item }); } catch (e) { next(e); } };
exports.updateProject = async (req, res, next) => { try { const query = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, manager: req.user._id }; const authorization = getPermittedManagedRecordChanges(req.user, req.body); if (authorization.deniedFields.length) return forbiddenFieldsResponse(res, authorization.deniedFields); const changes = authorization.changes; const item = await Project.findOneAndUpdate(query, changes, { new: true, runValidators: true }); if (!item) return res.status(403).json({ message: 'Only this project manager can update it.' }); const title = Object.hasOwn(changes, 'isArchived') ? (item.isArchived ? 'Project archived' : 'Project restored') : 'Project updated'; await notifyRecipients(collectProjectRecipients(item, { exclude: req.user._id }), title, item.name, 'project', 'Project', item._id); await logActivity(req.user._id, 'UPDATE_PROJECT', 'Project', item._id); emitAll('project:changed', item); res.json({ item }); } catch (e) { next(e); } };
exports.deleteProject = async (req, res, next) => { try { const item = await Project.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ message: 'Project not found.' }); await notifyRecipients(collectProjectRecipients(item, { exclude: req.user._id }), 'Project deleted', item.name, 'project', 'Project', item._id); await logActivity(req.user._id, 'DELETE_PROJECT', 'Project', req.params.id); res.json({ message: 'Project deleted.', item }); } catch (e) { next(e); } };
exports.listTasks = async (req, res, next) => { try {
  const query = { ...await visibleTaskQuery(req.user), isArchived: req.query.archived === 'true' };
  ['status', 'priority', 'project', 'assignee', 'type'].forEach((key) => { if (req.query[key]) query[key] = req.query[key]; });
  if (req.query.search) query.title = new RegExp(req.query.search, 'i');
  const items = await Task.find(query).populate('project assignee reporter collaborators watchers dependencies').sort(req.query.sort || '-createdAt');
  if (req.user.role !== 'admin') {
    const assignments = await ActivityAssignment.find({ recipient: req.user._id, activity: { $in: items.map((item) => item._id) } }).select('activity status');
    const statuses = new Map(assignments.map((item) => [String(item.activity), item.status]));
    const visibleItems = items.map((item) => ({ ...item.toObject(), myAssignmentStatus: statuses.get(String(item._id)) }));
    return res.json({ items: visibleItems, total: visibleItems.length });
  }
  res.json({ items, total: items.length });
} catch (e) { next(e); } };
exports.getTask = async (req, res, next) => { try { const item = await Task.findOne({ _id: req.params.id, ...await visibleTaskQuery(req.user) }).populate('project assignee reporter collaborators watchers dependencies'); if (!item) return res.status(404).json({ message: 'Task not found.' }); res.json({ item }); } catch (e) { next(e); } };

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
  }
  if (changes.dependencies) { const error = await validateDependencies(before._id, before.project, changes.dependencies); if (error) return res.status(400).json({ message: error }); }
  const effectiveDependencies = changes.dependencies || before.dependencies;
  if (changes.status && effectiveDependencies.length) { const incomplete = await Task.countDocuments({ _id: { $in: effectiveDependencies }, status: { $ne: 'completed' } }); const message = dependencyBlockMessage(changes.status, incomplete); if (message) return res.status(409).json({ message }); }
  const item = await Task.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true }).populate('project assignee reporter collaborators watchers dependencies');
  await logActivity(req.user._id, 'UPDATE_TASK', 'Task', item._id, { status: item.status });
  { const recipients = collectTaskRecipients(item, { exclude: req.user._id }); const title = Object.hasOwn(changes, 'isArchived') ? (item.isArchived ? 'Task archived' : 'Task restored') : before.status !== item.status ? 'Task status updated' : 'Task updated'; const message = before.status !== item.status ? `${item.title}: ${item.status}` : item.title; await notifyRecipients(recipients, title, message, before.status !== item.status ? 'status' : 'task', 'Task', item._id); }
  emitAll('task:changed', item); res.json({ item });
} catch (e) { next(e); } };
exports.deleteTask = async (req, res, next) => { try { const item = await Task.findById(req.params.id); if (!item) return res.status(404).json({ message: 'Task not found.' }); if (!canDeleteTask(req.user, item)) return res.status(403).json({ message: 'Only the creator or an administrator can delete this task.' }); await item.deleteOne(); await notifyRecipients(collectTaskRecipients(item, { exclude: req.user._id }), 'Task deleted', item.title, 'task', 'Task', item._id); if (item.type === 'individual-activity') await ActivityAssignment.deleteMany({ activity: item._id }); await logActivity(req.user._id, 'DELETE_TASK', 'Task', req.params.id); emitAll('task:deleted', { id: req.params.id }); res.json({ message: 'Task deleted.', item }); } catch (e) { next(e); } };
exports.addAttachment = async (req, res, next) => { try {
  if (!req.file) return res.status(400).json({ message: 'Choose a file to upload.' });
  const task = await Task.findOne({ _id: req.params.id, ...await visibleTaskQuery(req.user) });
  if (!task) return res.status(404).json({ message: 'Task not found.' });
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
exports.createComment = async (req, res, next) => { try { const task = await Task.findOne({ _id: req.params.taskId, ...await visibleTaskQuery(req.user) }); if (!task) return res.status(404).json({ message: 'Task not found.' }); const item = await Comment.create({ task: task._id, author: req.user._id, body: req.body.body }); await notifyRecipients(collectTaskRecipients(task, { exclude: req.user._id }), 'New task comment', task.title, 'comment', 'Task', task._id); await logActivity(req.user._id, 'COMMENT_TASK', 'Task', task._id); emitAll('comment:new', item); res.status(201).json({ item }); } catch (e) { next(e); } };
exports.updateComment = async (req, res, next) => { try { const item = await Comment.findOneAndUpdate({ _id: req.params.id, author: req.user._id }, { body: req.body.body }, { new: true, runValidators: true }); if (!item) return res.status(404).json({ message: 'Comment not found.' }); res.json({ item }); } catch (e) { next(e); } };
exports.deleteComment = async (req, res, next) => { try { const query = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, author: req.user._id }; const item = await Comment.findOneAndDelete(query); if (!item) return res.status(404).json({ message: 'Comment not found.' }); res.json({ message: 'Comment deleted.' }); } catch (e) { next(e); } };
exports.notifications = async (req, res, next) => { try { res.json({ items: await Notification.find({ user: req.user._id }).sort('-createdAt') }); } catch (e) { next(e); } };
exports.readNotification = async (req, res, next) => { try { res.json({ item: await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true }, { new: true }) }); } catch (e) { next(e); } };
exports.readAll = async (req, res, next) => { try { await Notification.updateMany({ user: req.user._id }, { isRead: true }); res.json({ message: 'Notifications marked as read.' }); } catch (e) { next(e); } };
exports.deleteNotification = async (req, res, next) => { try { await Notification.deleteOne({ _id: req.params.id, user: req.user._id }); res.json({ message: 'Notification deleted.' }); } catch (e) { next(e); } };
exports.activity = async (req, res, next) => { try { res.json({ items: await Activity.find({}).populate('actor').sort('-createdAt').limit(200) }); } catch (e) { next(e); } };
exports.dashboard = async (req, res, next) => { try { const tq = await visibleTaskQuery(req.user); const recentQuery = req.user.role === 'admin' ? Activity.find({}).populate('actor').sort('-createdAt').limit(10) : Promise.resolve([]); const [projects, total, todo, inProgress, review, completed, overdue, recent] = await Promise.all([Project.countDocuments({ isArchived: false }), Task.countDocuments(tq), Task.countDocuments({ ...tq, status: 'todo' }), Task.countDocuments({ ...tq, status: 'in-progress' }), Task.countDocuments({ ...tq, status: 'for-review' }), Task.countDocuments({ ...tq, status: 'completed' }), Task.countDocuments({ ...tq, deadline: { $lt: new Date() }, status: { $ne: 'completed' } }), recentQuery]); res.json({ projects, total, todo, inProgress, review, completed, overdue, recent }); } catch (e) { next(e); } };
