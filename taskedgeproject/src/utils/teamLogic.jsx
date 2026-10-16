function entityId(value) {
  if (!value) return ''
  return typeof value === 'string' ? value : value._id || value.id || ''
}

function personName(value, fallback = 'Team member') {
  if (!value) return fallback
  if (typeof value === 'string') return value
  return [value.firstName, value.lastName].filter(Boolean).join(' ').trim()
    || value.username
    || value.email
    || fallback
}

export function normalizeTeamFromApi(team) {
  const managerId = entityId(team.manager)
  const members = (Array.isArray(team.members) ? team.members : [])
    .filter((member) => member.role !== 'admin' && entityId(member) !== managerId)

  return {
    id: team._id || team.id || '',
    name: team.name || 'Team',
    description: team.description || '',
    isArchived: team.isArchived === true,
    managerId,
    managerName: personName(team.manager, 'No manager'),
    managerAvatarUrl: typeof team.manager === 'object' && team.manager ? team.manager.avatarUrl || '' : '',
    memberIds: members.map(entityId).filter(Boolean),
    members: members.map((member) => ({
      id: entityId(member),
      name: personName(member),
    })),
    raw: team,
  }
}

export function buildTeamPayload(values) {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    manager: values.managerId || undefined,
    members: values.memberIds || [],
  }
}

export function getTeamMetrics(teams) {
  const memberIds = new Set()
  const managerIds = new Set()

  teams.forEach((team) => {
    if (team.managerId) {
      managerIds.add(team.managerId)
    }

    ;(team.memberIds || []).forEach((memberId) => memberIds.add(memberId))
  })

  return {
    totalTeams: teams.length,
    totalMembers: memberIds.size,
    totalManagers: managerIds.size,
  }
}
