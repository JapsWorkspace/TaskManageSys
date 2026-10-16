const entityId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || value.id || value);
};

const isTaskAssignee = (user, task) => {
  const userId = entityId(user);
  return Boolean(userId) && entityId(task?.assignee) === userId;
};

const isTaskCollaborator = (user, task) => {
  const userId = entityId(user);
  return Boolean(userId)
    && (task?.collaborators || []).some((person) => entityId(person) === userId);
};

const isAssignedWorker = (user, task) => isTaskAssignee(user, task) || isTaskCollaborator(user, task);

const managesProject = (user, project) => (
  user?.role === 'manager'
  && Boolean(entityId(user))
  && entityId(project?.manager) === entityId(user)
);

const canCreateTaskInProject = (user, project) => (
  user?.role === 'admin' || managesProject(user, project)
);

const canManageTask = (user, task, project) => (
  user?.role === 'admin'
  || (
    user?.role === 'manager'
    && (entityId(task?.reporter) === entityId(user) || managesProject(user, project))
  )
);

const canUpdateTaskProgress = (user, task) => (
  isAssignedWorker(user, task)
);

const canManageTaskAttachments = (user, task, project) => (
  isAssignedWorker(user, task) || canManageTask(user, task, project)
);

const canDeleteTask = (user, task) => (
  user?.role === 'admin'
  || (user?.role === 'manager' && entityId(task?.reporter) === entityId(user))
);

const authorizeChanges = (requestedChanges, isAllowed) => {
  const deniedFields = Object.entries(requestedChanges)
    .filter(([key, value]) => !isAllowed(key, value))
    .map(([key]) => key);
  return {
    changes: deniedFields.length ? {} : requestedChanges,
    deniedFields,
  };
};

const isSubtaskCompletionOnlyChange = (currentSubtasks = [], requestedSubtasks = []) => {
  if (!Array.isArray(requestedSubtasks) || currentSubtasks.length !== requestedSubtasks.length) {
    return false;
  }

  return currentSubtasks.every((currentSubtask, index) => {
    const requestedSubtask = requestedSubtasks[index];
    if (!requestedSubtask || typeof requestedSubtask.completed !== 'boolean') {
      return false;
    }

    const currentId = entityId(currentSubtask?._id);
    const requestedId = entityId(requestedSubtask?._id);
    const idsMatch = !currentId || !requestedId || currentId === requestedId;

    return idsMatch && currentSubtask.title === requestedSubtask.title;
  });
};

const getPermittedTaskChanges = (user, task, project, requestedChanges = {}) => {
  if (canManageTask(user, task, project)) {
    return authorizeChanges(requestedChanges, (key) => !['reporter', 'type'].includes(key));
  }
  const assignee = isTaskAssignee(user, task);
  return authorizeChanges(
    requestedChanges,
    (key, value) => {
      if (!canUpdateTaskProgress(user, task)) return false;
      if (['status', 'progress'].includes(key)) return true;
      return key === 'subtasks'
        && assignee
        && isSubtaskCompletionOnlyChange(task?.subtasks || [], value);
    },
  );
};

const canAssignCreatedRecordManager = (user, requestedManager) => (
  user?.role === 'admin'
  || !requestedManager
  || entityId(requestedManager) === entityId(user)
);

const managerForCreatedRecord = (user, requestedManager) => (
  user?.role === 'admin' && requestedManager ? entityId(requestedManager) : entityId(user)
);

const canViewArchivedUsers = (user) => user?.role === 'admin';

const getPermittedManagedRecordChanges = (user, requestedChanges = {}) => (
  authorizeChanges(
    requestedChanges,
    (key, value) => user?.role === 'admin' || key !== 'manager' || entityId(value) === entityId(user),
  )
);

module.exports = {
  canAssignCreatedRecordManager,
  canCreateTaskInProject,
  canDeleteTask,
  canManageTask,
  canManageTaskAttachments,
  canUpdateTaskProgress,
  canViewArchivedUsers,
  getPermittedTaskChanges,
  getPermittedManagedRecordChanges,
  isSubtaskCompletionOnlyChange,
  managerForCreatedRecord,
};
