function toId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || value.id || value);
}

function collectRecipients(values, { exclude } = {}) {
  const excludedId = toId(exclude);
  const recipients = [];
  const seen = new Set();

  values.flat().forEach((value) => {
    const id = toId(value);
    if (!id || id === excludedId || seen.has(id)) return;
    seen.add(id);
    recipients.push(id);
  });

  return recipients;
}

function collectTaskRecipients(task, options = {}) {
  return collectRecipients([
    task?.assignee,
    task?.reporter,
    task?.collaborators || [],
    task?.watchers || [],
  ], options);
}

function collectProjectRecipients(project, options = {}) {
  return collectRecipients([
    project?.manager,
    project?.members || [],
  ], options);
}

function collectTeamRecipients(team, options = {}) {
  return collectRecipients([
    team?.manager,
    team?.members || [],
  ], options);
}

module.exports = {
  collectProjectRecipients,
  collectRecipients,
  collectTaskRecipients,
  collectTeamRecipients,
  toId,
};
