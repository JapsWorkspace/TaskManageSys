import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, LockKeyhole, ShieldCheck, UserRound, Zap } from 'lucide-react'
import '../styles/App.css'
import {
  clearStoredAuth,
  createAuthHeaders,
  readStoredAuth,
  storeAuth,
} from '../services/authStorage.jsx'
import { buildAuthFromResponse } from '../utils/authLogic.jsx'
import { createAuthApi } from '../services/authApi.jsx'
import { createTaskApi } from '../services/taskApi.jsx'
import { buildProjectPayload, getTaskCreationProject } from '../utils/projectLogic.jsx'
import {
  buildActivityPayload,
  buildActivityUpdatePayload,
} from '../utils/activityLogic.jsx'
import { buildTeamPayload } from '../utils/teamLogic.jsx'
import { getUserDisplayName } from '../utils/userDisplayLogic.jsx'
import {
  buildTaskPayload,
  getAgendaTasks,
  getCalendarDays,
  getTaskDashboardShortcutFilters,
  getVisibleTasks,
  toggleSubtaskInList,
  uiStatusToApi,
} from '../utils/taskLogic.jsx'
import {
  buildProfileSettingsPayload,
  validateConfirmedPasswordChange,
  validateEmailChange,
  validateRegistration,
  validateProfileSettings,
} from '../utils/profileSettingsLogic.jsx'
import { createRealtimeSync } from '../services/realtimeSync.jsx'
import { getPathForNav, getRouteState } from '../utils/routeLogic.jsx'
import {
  canAccessAdminArea,
  canAccessArchive,
  canCreateTasks,
  canManageOwnedRecord,
  getArchiveRecordPermissions,
  getTaskPermissions,
} from '../utils/taskPermissions.jsx'
import {
  getAuthTransitionCopy,
  getRemainingTransitionTime,
} from '../utils/authTransitionLogic.jsx'
import { getAppConfig } from '../config/appConfig.jsx'
import { SidebarTab, SidebarSection } from '../components/layout/Sidebar.jsx'
import { Dashboard, CalendarPage, TasksPage, TaskQueuePanel } from '../pages/OverviewPages.jsx'
import { ProjectsPage, ProjectDetailsPage } from '../pages/ProjectPages.jsx'
import { TeamsPage, AdminUsersPage, ActivityLogPage, NotificationsPage, ArchivePage } from '../pages/OrganizationPages.jsx'
import { ActivitiesPage, ActivityDetailsPage } from '../pages/ActivityPages.jsx'
import { TaskDetailsPage } from '../pages/TaskDetailsPage.jsx'
import { ProfilePage } from '../pages/ProfilePage.jsx'
import { TaskProgressModal, TaskModal, ProjectModal, TeamModal, ActivityModal } from '../modals/WorkspaceModals.jsx'
import { UserAvatar } from '../components/common/WorkspaceUi.jsx'
import { getAttachmentId, getLocalDateKey, getUserId, getTimeInputValue, getGreeting } from '../utils/display.jsx'

const { apiBaseUrl: API_BASE_URL, serverBaseUrl: SERVER_BASE_URL } = getAppConfig(import.meta.env)

const emptyTask = {
  title: '',
  description: '',
  status: 'Todo',
  priority: 'Medium',
  startDate: '',
  dueDate: '',
  dueTime: '',
  projectId: '',
  assigneeId: '',
  collaboratorIds: [],
  watcherIds: [],
  dependencyIds: [],
  tags: '',
  category: '',
  subtaskLines: '',
  recurrenceFrequency: 'none',
  recurrenceInterval: 1,
  recurrenceCount: 1,
}

const baseFocusTabs = [
  { id: 'my-day', label: 'My day' },
  { id: 'next-7-days', label: 'Calendar' },
  { id: 'all-my-tasks', label: 'My tasks' },
]

const baseWorkspaceTabs = [
  { id: 'project-board', label: 'Project board', count: '' },
  { id: 'teams', label: 'Teams', count: '' },
  { id: 'individual-activities', label: 'Individual activities', count: '' },
  { id: 'notifications', label: 'Notifications', count: '' },
  { id: 'archive', label: 'Archive', count: '' },
]

async function sendAuthRequest(path, body, token = '') {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...createAuthHeaders(token),
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'The server could not complete the request.')
  }

  return data
}

function AuthLoadingScreen({ type }) {
  const copy = getAuthTransitionCopy(type)

  return (
    <main
      className="auth-loading-screen"
      role="status"
      aria-live="assertive"
      aria-label={copy.accessibleLabel}
    >
      <div className="auth-loader-frame" aria-hidden="true" />
      <div className="auth-loader-rings" aria-hidden="true" />

      <section className="auth-loader-content">
        <div className="auth-loader-emblem" aria-hidden="true">
          <div className="auth-loader-orbit auth-loader-orbit-outer">
            <span className="auth-loader-orb auth-loader-orb-one" />
            <span className="auth-loader-orb auth-loader-orb-two" />
          </div>
          <div className="auth-loader-orbit auth-loader-orbit-inner" />
          <div className="auth-loader-hexagon">
            <span className="auth-loader-bolt" />
          </div>
        </div>

        <div className="auth-loader-wordmark" aria-label="EdgeRunners">
          <span>EDGE</span><strong>RUNNERS</strong>
        </div>
        <p className="auth-loader-tagline">Move beyond the expected</p>

        <div className="auth-loader-progress-block">
          <p>{copy.message}<span className="auth-loader-dots" aria-hidden="true">...</span></p>
          <div className="auth-loader-track">
            <span className="auth-loader-progress" />
          </div>
        </div>
      </section>

      <div className="auth-loader-system"><i /> Systems online</div>
      <div className="auth-loader-index">EDGR / 01</div>
    </main>
  )
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const initialRoute = getRouteState(location.pathname)
  const [auth, setAuth] = useState(() => readStoredAuth())
  const [authMode, setAuthMode] = useState('login')
  const [authMessage, setAuthMessage] = useState('')
  const [registerValidation, setRegisterValidation] = useState({})
  const [resetValidation, setResetValidation] = useState({})
  const [resetRequested, setResetRequested] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false)
  const [authTransition, setAuthTransition] = useState('')
  const [activeView, setActiveView] = useState(initialRoute.activeView)
  const [activeNav, setActiveNav] = useState(initialRoute.activeNav)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [projects, setProjects] = useState([])
  const [teams, setTeams] = useState([])
  const [users, setUsers] = useState([])
  const [notifications, setNotifications] = useState([])
  const [auditLog, setAuditLog] = useState({ items: [], total: 0 })
  const [archivedRecords, setArchivedRecords] = useState({ projects: [], tasks: [], activities: [], teams: [], users: [] })
  const [activeArchiveTab, setActiveArchiveTab] = useState('projects')
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [taskError, setTaskError] = useState('')
  const [taskMessage, setTaskMessage] = useState('')
  const [archiveMessage, setArchiveMessage] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileValidation, setProfileValidation] = useState({})
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [dueFilter, setDueFilter] = useState('all')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [taskSort, setTaskSort] = useState('deadline')
  const [taskForm, setTaskForm] = useState(null)
  const [taskProgressForm, setTaskProgressForm] = useState(null)
  const [projectForm, setProjectForm] = useState(null)
  const [teamForm, setTeamForm] = useState(null)
  const [activityForm, setActivityForm] = useState(null)
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedActivityId, setSelectedActivityId] = useState('')
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => getLocalDateKey(new Date()))
  const [activityAssignments, setActivityAssignments] = useState([])
  const [myActivityAssignment, setMyActivityAssignment] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [editingComment, setEditingComment] = useState(null)
  const [isSavingTask, setIsSavingTask] = useState(false)

  const expireSession = useCallback(() => {
    if (!auth.token) return
    clearStoredAuth()
    setAuth({ user: null, token: '' })
    setTasks([])
    setActivities([])
    setProjects([])
    setTeams([])
    setUsers([])
    setNotifications([])
    setAuditLog({ items: [], total: 0 })
    setArchivedRecords({ projects: [], tasks: [], activities: [], teams: [], users: [] })
    setSelectedTaskId('')
    setSelectedProjectId('')
    setSelectedActivityId('')
    setComments([])
    setTaskForm(null)
    setTaskProgressForm(null)
    setProjectForm(null)
    setTeamForm(null)
    setActivityForm(null)
    setAuthMessage('Your session expired. Please sign in again.')
  }, [auth.token])

  const taskApi = useMemo(
    () =>
      createTaskApi({
        baseUrl: API_BASE_URL,
        getToken: () => auth.token,
        onUnauthorized: expireSession,
      }),
    [auth.token, expireSession],
  )
  const authApi = useMemo(
    () =>
      createAuthApi({
        baseUrl: API_BASE_URL,
        getToken: () => auth.token,
        onUnauthorized: expireSession,
      }),
    [auth.token, expireSession],
  )

  const visibleTasks = useMemo(
    () =>
      getVisibleTasks(tasks, {
        status: statusFilter,
        priority: priorityFilter,
        due: dueFilter,
        scope: scopeFilter,
        currentUserId: auth.user?._id || auth.user?.id || '',
        sort: taskSort,
      }),
    [auth.user?._id, auth.user?.id, dueFilter, priorityFilter, scopeFilter, statusFilter, taskSort, tasks],
  )
  const selectedTask = tasks.find((task) => task.id === selectedTaskId)
  const selectedProject = projects.find((project) => project.id === selectedProjectId)
  const selectedActivity = activities.find((activity) => activity.id === selectedActivityId)
  const selectedTaskIdRef = useRef(selectedTaskId)
  const canManageProjects = ['admin', 'manager'].includes(auth.user?.role)
  const canManageTeams = ['admin', 'manager'].includes(auth.user?.role)
  const canManageUsers = canAccessAdminArea(auth.user)
  const user = auth.user
  const canCreateTask = canCreateTasks(user)
  const canOpenArchive = canAccessArchive(user)
  const manageableProjects = projects.filter((project) => canManageOwnedRecord(user, project))
  const selectedTaskPermissions = getTaskPermissions(user, selectedTask)
  function openDashboardTaskShortcut(shortcut) {
    const filters = getTaskDashboardShortcutFilters(shortcut)

    setStatusFilter(filters.status)
    setPriorityFilter(filters.priority)
    setDueFilter(filters.due)
    setTaskSort(filters.sort)
    setSelectedTaskId('')
    setTaskProgressForm(null)
    setComments([])
    setEditingComment(null)
    setActiveView('tasks')
    setActiveNav('all-my-tasks')
  }

  function openTaskFromQueue(task) {
    setActiveView('tasks')
    setActiveNav('all-my-tasks')
    setComments([])
    setEditingComment(null)
    setSelectedTaskId(task.id)
  }

  const navigationCounts = useMemo(() => {
    const todayTasks = getAgendaTasks(tasks, { limit: tasks.length }).length
    const nextSevenDaysTasks = getCalendarDays(tasks, new Date()).reduce(
      (total, day) => total + day.tasks.length,
      0,
    )
    const unreadNotifications = notifications.filter((notification) => !notification.isRead).length
    const archivedCount =
      archivedRecords.projects.length
      + archivedRecords.tasks.length
      + (archivedRecords.activities?.length || 0)
      + (archivedRecords.teams?.length || 0)
      + (archivedRecords.users?.length || 0)

    return {
      todayTasks,
      nextSevenDaysTasks,
      allTasks: tasks.length,
      unreadNotifications,
      archivedCount,
    }
  }, [archivedRecords, notifications, tasks])
  const focusTabs = useMemo(
    () =>
      baseFocusTabs.map((item) => {
        if (item.id === 'my-day') {
          return { ...item, count: navigationCounts.todayTasks ? String(navigationCounts.todayTasks) : '' }
        }

        if (item.id === 'next-7-days') {
          return { ...item, count: navigationCounts.nextSevenDaysTasks ? String(navigationCounts.nextSevenDaysTasks) : '' }
        }

        return { ...item, count: navigationCounts.allTasks ? String(navigationCounts.allTasks) : '' }
      }),
    [navigationCounts],
  )
  const workspaceTabs = useMemo(
    () =>
      baseWorkspaceTabs.filter((item) => item.id !== 'archive' || canOpenArchive).map((item) =>
        item.id === 'notifications'
          ? {
              ...item,
              count: navigationCounts.unreadNotifications ? String(navigationCounts.unreadNotifications) : '',
            }
          : item.id === 'archive'
            ? {
                ...item,
                count: navigationCounts.archivedCount ? String(navigationCounts.archivedCount) : '',
              }
          : item,
      ),
    [canOpenArchive, navigationCounts.archivedCount, navigationCounts.unreadNotifications],
  )
  const visibleWorkspaceTabs = useMemo(
    () =>
      canManageUsers
        ? [
            ...workspaceTabs,
            { id: 'admin-users', label: 'Admin users', count: '' },
            { id: 'activity-log', label: 'Activity log', count: auditLog.total ? String(auditLog.total) : '' },
          ]
        : workspaceTabs,
    [auditLog.total, canManageUsers, workspaceTabs],
  )

  useEffect(() => {
    if (!user) return
    const archiveRestricted = activeView === 'archive' && !canOpenArchive
    const adminRestricted = ['admin-users', 'activity-log'].includes(activeView) && !canManageUsers

    if (archiveRestricted || adminRestricted) {
      const redirectTimer = window.setTimeout(() => {
        setActiveView('dashboard')
        setActiveNav('my-day')
        navigate('/my-day', { replace: true })
      }, 0)

      return () => window.clearTimeout(redirectTimer)
    }

    return undefined
  }, [activeView, canManageUsers, canOpenArchive, navigate, user])

  const loadWorkspaceData = useCallback(async () => {
    setIsLoadingTasks(true)
    setTaskError('')

    try {
      const [
        taskItems,
        activityItems,
        projectItems,
        teamItems,
        userItems,
        notificationItems,
        archivedItems,
        auditItems,
      ] = await Promise.all([
        taskApi.listTasks(),
        taskApi.listActivities().catch(() => []),
        taskApi.listProjects().catch(() => []),
        taskApi.listTeams().catch(() => []),
        taskApi.listUsers().catch(() => []),
        taskApi.listNotifications().catch(() => []),
        canOpenArchive
          ? taskApi.listArchivedRecords({ includeUsers: canManageUsers }).catch(() => ({ projects: [], tasks: [], activities: [], teams: [], users: [] }))
          : Promise.resolve({ projects: [], tasks: [], activities: [], teams: [], users: [] }),
        canManageUsers ? taskApi.listAuditLog().catch(() => ({ items: [], total: 0 })) : Promise.resolve({ items: [], total: 0 }),
      ])

      setTasks(taskItems)
      setActivities(activityItems)
      setProjects(projectItems)
      setTeams(teamItems)
      setUsers(userItems)
      setNotifications(notificationItems)
      setArchivedRecords(archivedItems)
      setAuditLog(auditItems)
    } catch (error) {
      setTaskError(error.message)
    } finally {
      setIsLoadingTasks(false)
    }
  }, [canManageUsers, canOpenArchive, taskApi])

  useEffect(() => {
    if (!user || !auth.token) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      loadWorkspaceData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [auth.token, loadWorkspaceData, user])

  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId
  }, [selectedTaskId])

  useEffect(() => {
    if (!user || !auth.token) {
      return undefined
    }

    const realtime = createRealtimeSync({
      serverUrl: SERVER_BASE_URL,
      token: auth.token,
      socketFactory: io,
    })

    return realtime.start(() => {
      loadWorkspaceData()

      const activeTaskId = selectedTaskIdRef.current
      if (activeTaskId) {
        taskApi
          .listComments(activeTaskId)
          .then(setComments)
          .catch(() => setComments([]))
      }
    })
  }, [auth.token, loadWorkspaceData, taskApi, user])

  useEffect(() => {
    if (!selectedTaskId || !auth.token) {
      return undefined
    }

    taskApi
      .listComments(selectedTaskId)
      .then(setComments)
      .catch(() => setComments([]))

    return undefined
  }, [auth.token, selectedTaskId, taskApi])

  useEffect(() => {
    if (!selectedActivityId || !auth.token) {
      return undefined
    }

    taskApi
      .listActivityAssignments(selectedActivityId)
      .then((data) => {
        setActivityAssignments(data.items)
        setMyActivityAssignment(null)
      })
      .catch(() => {
        taskApi
          .getMyActivityAssignment(selectedActivityId)
          .then((assignment) => {
            setActivityAssignments([])
            setMyActivityAssignment(assignment)
          })
          .catch(() => {
            setActivityAssignments([])
            setMyActivityAssignment(null)
          })
      })

    return undefined
  }, [auth.token, selectedActivityId, taskApi])

  function completeAuth(nextAuth, message = '') {
    storeAuth(nextAuth)
    setAuth(nextAuth)
    setAuthMessage(message)
  }

  async function handleLogin(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const payload = {
      usernameOrEmail: form.get('usernameOrEmail').trim(),
      password: form.get('password'),
    }

    if (!payload.usernameOrEmail || !payload.password) {
      setAuthMessage('Enter your username/email and password.')
      return
    }

    setIsSubmittingAuth(true)
    setAuthMessage('')

    try {
      const data = await sendAuthRequest('/auth/login', payload)
      const transitionStartedAt = Date.now()
      setAuthTransition('login')
      await new Promise((resolve) => {
        window.setTimeout(resolve, getRemainingTransitionTime(transitionStartedAt))
      })
      completeAuth(buildAuthFromResponse(data))
      setAuthTransition('')
    } catch (error) {
      setAuthTransition('')
      setAuthMessage(error.message)
    } finally {
      setIsSubmittingAuth(false)
    }
  }

  async function handleRegister(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const payload = {
      firstName: form.get('firstName').trim(),
      lastName: form.get('lastName').trim(),
      birthday: form.get('birthday'),
      username: form.get('username').trim(),
      email: form.get('email').trim(),
      phone: form.get('phone').trim(),
      password: form.get('password'),
    }
    const errors = validateRegistration(payload)

    if (Object.keys(errors).length) {
      setRegisterValidation(errors)
      setAuthMessage('')
      return
    }

    setIsSubmittingAuth(true)
    setAuthMessage('')
    setRegisterValidation({})

    try {
      const data = await sendAuthRequest('/auth/register', payload)
      completeAuth(buildAuthFromResponse(data))
    } catch (error) {
      setAuthMessage(error.message)
    } finally {
      setIsSubmittingAuth(false)
    }
  }

  function resetAuthForms(nextMode = 'login') {
    setAuthMode(nextMode)
    setRegisterValidation({})
    setResetValidation({})
    setResetRequested(false)
    setResetEmail('')
    setResetToken('')
    setResetPassword('')
    setAuthMessage('')
  }

  async function handleRequestPasswordReset(event) {
    event.preventDefault()
    const email = resetEmail.trim()
    const errors = validateEmailChange({ email })

    if (Object.keys(errors).length) {
      setResetValidation(errors)
      setAuthMessage('')
      return
    }

    setIsSubmittingAuth(true)
    setResetValidation({})
    setAuthMessage('')

    try {
      const result = await authApi.requestPasswordReset(email)
      setResetRequested(true)
      setAuthMessage(result.message)
    } catch (error) {
      setAuthMessage(error.message)
    } finally {
      setIsSubmittingAuth(false)
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault()
    const token = resetToken.trim()
    const errors = {}
    const passwordErrors = validateConfirmedPasswordChange({
      newPassword: resetPassword,
      confirmPassword: resetPassword,
    })

    if (!token) {
      errors.token = 'Reset code is required.'
    }

    if (passwordErrors.newPassword) {
      errors.password = passwordErrors.newPassword
    }

    if (Object.keys(errors).length) {
      setResetValidation(errors)
      setAuthMessage('')
      return
    }

    setIsSubmittingAuth(true)
    setResetValidation({})
    setAuthMessage('')

    try {
      const message = await authApi.resetPassword({ token, password: resetPassword })
      resetAuthForms('login')
      setAuthMessage(message || 'Password reset successfully. You may now sign in.')
    } catch (error) {
      setAuthMessage(error.message)
    } finally {
      setIsSubmittingAuth(false)
    }
  }

  async function handleLogout() {
    if (authTransition) {
      return
    }

    const transitionStartedAt = Date.now()
    setProfileMenuOpen(false)
    setAuthTransition('logout')
    await new Promise((resolve) => {
      window.setTimeout(resolve, getRemainingTransitionTime(transitionStartedAt))
    })
    clearStoredAuth()
    setAuth({ user: null, token: '' })
    setTasks([])
    setActivities([])
    setProjects([])
    setTeams([])
    setUsers([])
    setNotifications([])
    setAuditLog({ items: [], total: 0 })
    setArchivedRecords({ projects: [], tasks: [], activities: [], teams: [] })
    setSelectedTaskId('')
    setSelectedProjectId('')
    setSelectedActivityId('')
    setActiveView('dashboard')
    setActiveNav('my-day')
    setAuthMessage('')
    setProfileMessage('')
    setProfileValidation({})
    setAuthTransition('')
  }

  function openNewTaskForm(preferredProjectId = '') {
    if (!canCreateTask) {
      setTaskMessage('Only managers and administrators can create tasks.')
      return
    }

    const defaultProject = getTaskCreationProject(projects, preferredProjectId)
    setTaskForm({
      mode: 'create',
      values: {
        ...emptyTask,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        dueTime: '17:00',
        projectId: defaultProject?.id || '',
        assigneeId: defaultProject?.managerId || defaultProject?.memberIds?.[0] || '',
        collaboratorIds: [],
        watcherIds: [],
        dependencyIds: [],
      },
    })
  }

  function openNewProjectForm() {
    setProjectForm({
      mode: 'create',
      values: {
        name: '',
        description: '',
        status: 'active',
        priority: 'medium',
        managerId: auth.user?.id || '',
        memberIds: [],
      },
    })
  }

  function openNewTeamForm() {
    setTeamForm({
      mode: 'create',
      values: {
        name: '',
        description: '',
        managerId: auth.user?.id || '',
        memberIds: [],
      },
    })
  }

  function openNewActivityForm() {
    setActivityForm({
      mode: 'create',
      values: {
        title: '',
        description: '',
        projectId: projects[0]?.id || '',
        priority: 'Medium',
        startDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        dueTime: '17:00',
        recipientIds: [],
        allowTextResponse: true,
        requireAttachment: false,
        allowResubmission: true,
        maxSubmissions: 3,
        maxFileSizeMB: 10,
        maximumScore: 100,
        allowedFileTypes: '',
      },
    })
  }

  function openEditActivityForm(activity) {
    if (!getTaskPermissions(user, activity).canManage) {
      setTaskMessage('Only the activity creator, project manager, or an administrator can edit this activity.')
      return
    }

    const settings = activity.activitySettings || {}

    setActivityForm({
      mode: 'edit',
      activityId: activity.id,
      values: {
        title: activity.title,
        description: activity.description,
        projectId: activity.projectId,
        priority: activity.priority || 'Medium',
        startDate: activity.startDate ? getLocalDateKey(activity.startDate) : '',
        dueDate: getLocalDateKey(activity.dueAt || activity.dueDate),
        dueTime: getTimeInputValue(activity.dueAt || activity.dueDate),
        recipientIds: [],
        allowTextResponse: settings.allowTextResponse !== false,
        requireAttachment: settings.requireAttachment === true,
        allowResubmission: settings.allowResubmission !== false,
        maxSubmissions: settings.maxSubmissions ?? 3,
        maxFileSizeMB: settings.maxFileSizeMB ?? 10,
        maximumScore: settings.maximumScore ?? 100,
        allowedFileTypes: Array.isArray(settings.allowedFileTypes)
          ? settings.allowedFileTypes.join(', ')
          : settings.allowedFileTypes || '',
      },
    })
  }

  function handleSidebarSelect(itemId) {
    const nextPath = getPathForNav(itemId)
    const routeState = getRouteState(nextPath)
    setActiveNav(routeState.activeNav)
    setActiveView(routeState.activeView)
    setSelectedTaskId('')
    setSelectedProjectId('')
    setSelectedActivityId('')
    setActivityAssignments([])
    setMyActivityAssignment(null)
    setComments([])
    setEditingComment(null)

    if (itemId === 'next-7-days') {
      setSelectedCalendarDate(getLocalDateKey(new Date()))
    }

    navigate(nextPath)
  }

  function openEditTaskForm(task) {
    if (!getTaskPermissions(user, task).canManage) {
      setTaskMessage('Only managers and administrators can edit task details.')
      return
    }

    setTaskForm({
      mode: 'edit',
      values: {
        ...task,
        startDate: task.startDate ? getLocalDateKey(task.startDate) : '',
        tags: task.tags?.join(', ') || '',
        collaboratorIds: task.collaboratorIds || [],
        watcherIds: task.watcherIds || [],
        dependencyIds: task.dependencyIds || [],
        subtaskLines: Array.isArray(task.subtasks)
          ? task.subtasks.map((subtask) => subtask.title).filter(Boolean).join('\n')
          : '',
        recurrenceFrequency: task.recurrence?.frequency || 'none',
        recurrenceInterval: task.recurrence?.interval || 1,
        recurrenceCount: task.recurrence?.count || 1,
        dueDate: getLocalDateKey(task.dueAt || task.dueDate),
        dueTime: task.dueAt ? getTimeInputValue(task.dueAt) : '',
      },
    })
  }

  function openTaskProgressForm(task) {
    if (!getTaskPermissions(user, task).canUpdateProgress) {
      setTaskMessage('You can view this task, but you cannot update its progress.')
      return
    }

    setTaskProgressForm({
      taskId: task.id,
      title: task.title,
      status: task.status,
      progress: task.progress || 0,
      subtasks: (task.subtasks || []).map((subtask) => ({ ...subtask })),
    })
  }

  async function handleTaskSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const existingSubtasks = Array.isArray(taskForm.values.subtasks) ? taskForm.values.subtasks : []
    const values = {
      title: form.get('title').trim(),
      description: form.get('description').trim(),
      status: form.get('status'),
      priority: form.get('priority'),
      startDate: form.get('startDate'),
      dueDate: form.get('dueDate'),
      dueTime: form.get('dueTime'),
      projectId: form.get('projectId'),
      assigneeId: form.get('assigneeId'),
      collaboratorIds: form.getAll('collaboratorIds'),
      watcherIds: form.getAll('watcherIds'),
      dependencyIds: form.getAll('dependencyIds'),
      tags: form.get('tags') || '',
      category: form.get('category') || '',
      subtasks: String(form.get('subtaskLines') || '')
        .split('\n')
        .map((title) => title.trim())
        .filter(Boolean)
        .map((title) => ({
          title,
          completed: existingSubtasks.find((subtask) => subtask.title === title)?.completed || false,
        })),
      recurrenceFrequency: form.get('recurrenceFrequency') || 'none',
      recurrenceInterval: form.get('recurrenceInterval') || 1,
      recurrenceCount: form.get('recurrenceCount') || 1,
    }

    if (!values.title || !values.description || !values.dueDate || !values.projectId) {
      return
    }

    setIsSavingTask(true)
    setTaskMessage('')

    try {
      const payload = buildTaskPayload(values)
      const savedTask =
        taskForm.mode === 'edit'
          ? await taskApi.updateTask(taskForm.values.id, payload)
          : await taskApi.createTask(payload)

      setTasks((currentTasks) =>
        taskForm.mode === 'edit'
          ? currentTasks.map((task) => (task.id === savedTask.id ? savedTask : task))
          : [savedTask, ...currentTasks],
      )
      setTaskForm(null)
      setActiveView('tasks')
      setActiveNav('all-my-tasks')
      setSelectedTaskId(savedTask.id)
    } catch (error) {
      setTaskMessage(error.message)
    } finally {
      setIsSavingTask(false)
    }
  }

  function openEditProjectForm(project) {
    if (!canManageOwnedRecord(user, project)) {
      setTaskMessage('Only this project manager or an administrator can edit it.')
      return
    }

    setProjectForm({
      mode: 'edit',
      values: {
        ...project,
        managerId: project.managerId || auth.user?.id || '',
      },
    })
  }

  function openEditTeamForm(team) {
    if (!canManageOwnedRecord(user, team)) {
      setTaskMessage('Only this team manager or an administrator can edit it.')
      return
    }

    setTeamForm({
      mode: 'edit',
      values: {
        ...team,
        managerId: team.managerId || auth.user?.id || '',
      },
    })
  }

  async function handleTeamSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      name: form.get('name').trim(),
      description: form.get('description').trim(),
      managerId: form.get('managerId'),
      memberIds: form.getAll('memberIds'),
    }

    if (!values.name) {
      return
    }

    setTaskMessage('')

    try {
      const payload = buildTeamPayload(values)
      const savedTeam =
        teamForm.mode === 'edit'
          ? await taskApi.updateTeam(teamForm.values.id, payload)
          : await taskApi.createTeam(payload)

      setTeams((currentTeams) =>
        teamForm.mode === 'edit'
          ? currentTeams.map((team) => (team.id === savedTeam.id ? savedTeam : team))
          : [savedTeam, ...currentTeams],
      )
      setTeamForm(null)
      setActiveView('teams')
      setActiveNav('teams')
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function archiveTeam(teamId) {
    const team = teams.find((item) => item.id === teamId)
    if (!canManageOwnedRecord(user, team)) {
      setTaskMessage('Only this team manager or an administrator can archive it.')
      return
    }

    if (!window.confirm('Archive this team? You can restore it from Archive.')) {
      return
    }

    setTaskMessage('')

    try {
      const archived = await taskApi.archiveTeam(teamId)
      setTeams((currentTeams) => currentTeams.filter((team) => team.id !== archived.id))
      setArchivedRecords((currentRecords) => ({
        ...currentRecords,
        teams: [archived, ...(currentRecords.teams || [])],
      }))
      setTaskMessage('Team archived.')
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function updateUserAccount(userId, changes) {
    setTaskMessage('')

    try {
      const updatedUser = await taskApi.updateUser(userId, changes)
      setUsers((currentUsers) =>
        currentUsers.map((item) => (getUserId(item) === getUserId(updatedUser) ? updatedUser : item)),
      )
      if (Object.hasOwn(changes, 'isArchived')) {
        setArchivedRecords((currentRecords) => ({
          ...currentRecords,
          users: updatedUser.isArchived
            ? [
                updatedUser,
                ...(currentRecords.users || []).filter((record) => getUserId(record) !== getUserId(updatedUser)),
              ]
            : (currentRecords.users || []).filter((record) => getUserId(record) !== getUserId(updatedUser)),
        }))
      }
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function handleActivitySubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      title: form.get('title').trim(),
      description: form.get('description').trim(),
      projectId: form.get('projectId'),
      priority: form.get('priority'),
      startDate: form.get('startDate'),
      dueDate: form.get('dueDate'),
      dueTime: form.get('dueTime'),
      recipientIds: form.getAll('recipientIds'),
      allowTextResponse: form.get('allowTextResponse') === 'on',
      requireAttachment: form.get('requireAttachment') === 'on',
      allowResubmission: form.get('allowResubmission') === 'on',
      maxSubmissions: form.get('maxSubmissions'),
      maxFileSizeMB: form.get('maxFileSizeMB'),
      maximumScore: form.get('maximumScore'),
      allowedFileTypes: form.get('allowedFileTypes') || '',
    }

    if (!values.title || !values.dueDate || (activityForm.mode === 'create' && (!values.projectId || !values.recipientIds.length))) {
      setTaskMessage(
        activityForm.mode === 'create'
          ? 'Complete the title, project, deadline, and recipients.'
          : 'Complete the title and deadline.',
      )
      return
    }

    setTaskMessage('')

    try {
      if (activityForm.mode === 'edit') {
        const updated = await taskApi.updateActivity(activityForm.activityId, buildActivityUpdatePayload(values))
        setActivities((currentActivities) =>
          currentActivities.map((activity) => (activity.id === updated.id ? updated : activity)),
        )
        setTaskMessage('Activity updated.')
      } else {
        const created = await taskApi.createActivity(buildActivityPayload(values))
        setActivities((currentActivities) => [created, ...currentActivities])
        setActiveView('activities')
        setActiveNav('individual-activities')
        setSelectedActivityId(created.id)
      }

      setActivityForm(null)
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function submitActivityAssignment(assignmentId, textResponse) {
    setTaskMessage('')

    try {
      const savedAssignment = await taskApi.submitActivityAssignment(assignmentId, textResponse)
      setMyActivityAssignment(savedAssignment)
      setActivityAssignments((currentAssignments) =>
        currentAssignments.map((assignment) => (assignment.id === savedAssignment.id ? savedAssignment : assignment)),
      )
      setTaskMessage('Activity submitted.')
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function startActivityAssignment(assignmentId) {
    setTaskMessage('')

    try {
      const savedAssignment = await taskApi.startActivityAssignment(assignmentId)
      setMyActivityAssignment(savedAssignment)
      setActivityAssignments((currentAssignments) =>
        currentAssignments.map((assignment) => (assignment.id === savedAssignment.id ? savedAssignment : assignment)),
      )
      setTaskMessage('Activity started.')
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function reviewActivityAssignment(assignmentId, payload) {
    setTaskMessage('')

    try {
      const savedAssignment = await taskApi.reviewActivityAssignment(assignmentId, payload)
      setActivityAssignments((currentAssignments) =>
        currentAssignments.map((assignment) => (assignment.id === savedAssignment.id ? savedAssignment : assignment)),
      )
      setTaskMessage('Review saved.')
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  function updateActivityAssignment(assignmentId, updater) {
    setMyActivityAssignment((currentAssignment) =>
      currentAssignment?.id === assignmentId ? updater(currentAssignment) : currentAssignment,
    )
    setActivityAssignments((currentAssignments) =>
      currentAssignments.map((assignment) => (assignment.id === assignmentId ? updater(assignment) : assignment)),
    )
  }

  async function uploadActivityAssignmentAttachment(assignmentId, file) {
    if (!file) {
      return
    }

    setTaskMessage('')

    try {
      const attachment = await taskApi.uploadActivityAssignmentAttachment(assignmentId, file)
      updateActivityAssignment(assignmentId, (assignment) => ({
        ...assignment,
        attachments: [...assignment.attachments, attachment],
      }))
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function deleteActivityAssignmentAttachment(assignmentId, attachmentId) {
    setTaskMessage('')

    try {
      await taskApi.deleteActivityAssignmentAttachment(assignmentId, attachmentId)
      updateActivityAssignment(assignmentId, (assignment) => ({
        ...assignment,
        attachments: assignment.attachments.filter((attachment) => getAttachmentId(attachment) !== attachmentId),
      }))
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function uploadActivityReferenceAttachment(activityId, file) {
    if (!file) {
      return
    }

    setTaskMessage('')

    try {
      const result = await taskApi.uploadTaskAttachment(activityId, file)
      setActivities((currentActivities) =>
        currentActivities.map((activity) =>
          activity.id === activityId
            ? result.task || { ...activity, attachments: [...activity.attachments, result.attachment] }
            : activity,
        ),
      )
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function deleteActivityReferenceAttachment(activityId, attachmentId) {
    setTaskMessage('')

    try {
      const updated = await taskApi.deleteTaskAttachment(activityId, attachmentId)
      setActivities((currentActivities) =>
        currentActivities.map((activity) =>
          activity.id === activityId
            ? updated || {
              ...activity,
              attachments: activity.attachments.filter((attachment) => getAttachmentId(attachment) !== attachmentId),
            }
            : activity,
        ),
      )
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function remindActivity(activityId) {
    setTaskMessage('')

    try {
      const result = await taskApi.remindActivity(activityId)
      setTaskMessage(result.message)
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function archiveActivity(activityId) {
    const activity = activities.find((item) => item.id === activityId)
    if (!getTaskPermissions(user, activity).canManage) {
      setTaskMessage('Only the activity creator, project manager, or an administrator can archive it.')
      return
    }

    if (!window.confirm('Archive this activity? You can restore it from Archive.')) {
      return
    }

    setArchiveMessage('')

    try {
      const archived = await taskApi.archiveActivity(activityId)
      setActivities((currentActivities) =>
        currentActivities.filter((activity) => activity.id !== archived.id),
      )
      setArchivedRecords((currentRecords) => ({
        ...currentRecords,
        activities: [archived, ...currentRecords.activities.filter((item) => item.id !== archived.id)],
      }))
      setSelectedActivityId('')
      setActiveArchiveTab('activities')
      setActiveView('archive')
      setActiveNav('archive')
      setArchiveMessage('Activity archived.')
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function cancelActivity(activityId) {
    const reason = window.prompt('Why are you cancelling this activity? You can leave this blank.') ?? null

    if (reason === null) {
      return
    }

    setTaskMessage('')

    try {
      const cancelled = await taskApi.cancelActivity(activityId, reason.trim())
      setActivities((currentActivities) =>
        currentActivities.filter((activity) => activity.id !== cancelled.id),
      )
      setSelectedActivityId('')
      setTaskMessage('Activity cancelled.')
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function reopenActivity(activityId) {
    const reason = window.prompt('Reason for reopening? You can leave this blank.') ?? null

    if (reason === null) {
      return
    }

    setTaskMessage('')

    try {
      const result = await taskApi.reopenActivity(activityId, { reason: reason.trim() })
      setActivities((currentActivities) =>
        currentActivities.map((activity) =>
          activity.id === result.activity.id ? result.activity : activity,
        ),
      )

      const data = await taskApi.listActivityAssignments(activityId)
      setActivityAssignments(data.items)
      setMyActivityAssignment(null)
      setTaskMessage(`${result.count} assignment(s) reopened.`)
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function reopenActivityAssignment(activityId, assignmentId, recipientName) {
    const reason = window.prompt(`Reason for reopening ${recipientName || 'this assignment'}? You can leave this blank.`) ?? null

    if (reason === null) {
      return
    }

    setTaskMessage('')

    try {
      const result = await taskApi.reopenActivity(activityId, {
        assignmentIds: [assignmentId],
        reason: reason.trim(),
      })
      setActivities((currentActivities) =>
        currentActivities.map((activity) =>
          activity.id === result.activity.id ? result.activity : activity,
        ),
      )

      const data = await taskApi.listActivityAssignments(activityId)
      setActivityAssignments(data.items)
      setMyActivityAssignment(null)
      setTaskMessage(`${result.count} assignment(s) reopened.`)
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function exportActivityResults(activityId) {
    setTaskMessage('')

    try {
      const { csv, filename } = await taskApi.exportActivityResults(activityId)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.append(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setTaskMessage('Activity results exported.')
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function addActivityRecipients(activityId, recipientIds) {
    if (!recipientIds.length) {
      setTaskMessage('Select at least one recipient to add.')
      return
    }

    setTaskMessage('')

    try {
      const result = await taskApi.addActivityRecipients(activityId, recipientIds)
      const data = await taskApi.listActivityAssignments(activityId)
      setActivityAssignments(data.items)
      setMyActivityAssignment(null)
      setTaskMessage(`${result.count} recipient(s) added.`)
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function removeActivityRecipient(activityId, userId) {
    if (!window.confirm('Remove this recipient from the activity?')) {
      return
    }

    setTaskMessage('')

    try {
      const result = await taskApi.removeActivityRecipient(activityId, userId)
      const data = await taskApi.listActivityAssignments(activityId)
      setActivityAssignments(data.items)
      setMyActivityAssignment(null)
      setTaskMessage(result.message)
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function markNotificationRead(notificationId) {
    setTaskMessage('')

    try {
      const updatedNotification = await taskApi.markNotificationRead(notificationId)
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === updatedNotification.id ? updatedNotification : notification,
        ),
      )
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function markAllNotificationsRead() {
    setTaskMessage('')

    try {
      const message = await taskApi.markAllNotificationsRead()
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({ ...notification, isRead: true })),
      )
      setTaskMessage(message)
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function deleteNotification(notificationId) {
    setTaskMessage('')

    try {
      await taskApi.deleteNotification(notificationId)
      setNotifications((currentNotifications) =>
        currentNotifications.filter((notification) => notification.id !== notificationId),
      )
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function restoreArchivedRecord(type, recordId) {
    const record = (archivedRecords[type] || []).find((item) => (type === 'users' ? getUserId(item) : item.id) === recordId)
    if (!getArchiveRecordPermissions(user, type, record).canRestore) {
      setArchiveMessage('You do not have permission to restore this archived record.')
      return
    }

    setArchiveMessage('')

    try {
      const restoredRecord = await taskApi.restoreArchivedRecord(type, recordId)
      setArchivedRecords((currentRecords) => ({
        ...currentRecords,
        [type]: (currentRecords[type] || []).filter((record) => record.id !== recordId),
      }))

      if (type === 'projects') {
        setProjects((currentProjects) => [restoredRecord, ...currentProjects])
      } else if (type === 'activities') {
        setActivities((currentActivities) => [restoredRecord, ...currentActivities])
      } else if (type === 'teams') {
        setTeams((currentTeams) => [restoredRecord, ...currentTeams])
      } else if (type === 'users') {
        setUsers((currentUsers) => {
          const restoredUserId = getUserId(restoredRecord)
          const userExists = currentUsers.some((item) => getUserId(item) === restoredUserId)

          return userExists
            ? currentUsers.map((item) => (getUserId(item) === restoredUserId ? restoredRecord : item))
            : [restoredRecord, ...currentUsers]
        })
      } else {
        setTasks((currentTasks) => [restoredRecord, ...currentTasks])
      }

      const restoredLabel =
        type === 'projects'
          ? 'Project'
          : type === 'activities'
            ? 'Activity'
            : type === 'teams'
              ? 'Team'
              : type === 'users'
                ? 'User'
                : 'Task'
      setArchiveMessage(`${restoredLabel} restored.`)
    } catch (error) {
      setArchiveMessage(error.message)
    }
  }

  async function deleteArchivedRecord(type, recordId) {
    const record = (archivedRecords[type] || []).find((item) => (type === 'users' ? getUserId(item) : item.id) === recordId)
    if (!getArchiveRecordPermissions(user, type, record).canDelete) {
      setArchiveMessage('You do not have permission to permanently delete this archived record.')
      return
    }

    const recordLabel =
      type === 'projects'
        ? 'project'
        : type === 'activities'
          ? 'activity'
          : type === 'teams'
            ? 'team'
            : type === 'users'
              ? 'user'
              : 'task'

    if (!window.confirm(`Permanently delete this archived ${recordLabel}? This cannot be undone.`)) {
      return
    }

    setArchiveMessage('')

    try {
      await taskApi.deleteArchivedRecord(type, recordId)
      setArchivedRecords((currentRecords) => ({
        ...currentRecords,
        [type]: (currentRecords[type] || []).filter((record) => record.id !== recordId),
      }))
      setArchiveMessage(`Archived ${recordLabel} deleted.`)
    } catch (error) {
      setArchiveMessage(error.message)
    }
  }

  async function saveProfileSettings(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      firstName: form.get('firstName').trim(),
      lastName: form.get('lastName').trim(),
      username: form.get('username').trim(),
      phone: form.get('phone').trim(),
      avatarUrl: form.get('avatarUrl').trim(),
    }
    const payload = buildProfileSettingsPayload(values, auth.user)
    const errors = validateProfileSettings(payload)

    if (Object.keys(errors).length) {
      setProfileValidation(errors)
      return
    }

    setProfileMessage('')
    setProfileValidation({})

    try {
      const result = await authApi.updateProfile(payload)
      const nextAuth = { ...auth, user: result.user }
      storeAuth(nextAuth)
      setAuth(nextAuth)
      setUsers((currentUsers) =>
        currentUsers.map((person) =>
          getUserId(person) === getUserId(result.user)
            ? { ...person, ...result.user, _id: person._id || result.user.id }
            : person,
        ),
      )

      setProfileMessage('Account settings saved.')
    } catch (error) {
      setProfileMessage(error.message)
    }
  }

  async function changeProfilePassword(values) {
    const errors = validateConfirmedPasswordChange(values)

    if (Object.keys(errors).length) {
      setProfileValidation(errors)
      return false
    }

    setProfileMessage('')
    setProfileValidation({})

    try {
      const message = await authApi.changePassword(values.newPassword)
      setProfileMessage(message || 'Password changed.')
      return true
    } catch (error) {
      setProfileMessage(error.message)
      return false
    }
  }

  async function changeProfileEmail(values) {
    const email = values.email.trim()
    const errors = validateEmailChange({ email })

    if (Object.keys(errors).length) {
      setProfileValidation(errors)
      return false
    }

    setProfileMessage('')
    setProfileValidation({})

    try {
      const result = await authApi.updateProfile({ email })
      const nextAuth = { ...auth, user: result.user }
      storeAuth(nextAuth)
      setAuth(nextAuth)
      setUsers((currentUsers) =>
        currentUsers.map((person) =>
          getUserId(person) === getUserId(result.user)
            ? { ...person, ...result.user, _id: person._id || result.user.id }
            : person,
        ),
      )
      setProfileMessage('Email updated.')
      return true
    } catch (error) {
      setProfileMessage(error.message)
      return false
    }
  }

  function clearProfileFeedback() {
    setProfileMessage('')
    setProfileValidation({})
  }

  async function logoutAllDevices() {
    setProfileMessage('')
    setProfileValidation({})

    try {
      await authApi.logoutAllDevices()
      await handleLogout()
    } catch (error) {
      setProfileMessage(error.message)
    }
  }

  async function deleteAccount() {
    if (!window.confirm('Delete your account? This archives your account and removes access from all devices.')) {
      return
    }

    setProfileMessage('')
    setProfileValidation({})

    try {
      await authApi.deleteAccount()
      await handleLogout()
    } catch (error) {
      setProfileMessage(error.message)
    }
  }

  async function handleProjectSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      name: form.get('name').trim(),
      description: form.get('description').trim(),
      status: form.get('status'),
      priority: form.get('priority'),
      managerId: form.get('managerId'),
      memberIds: form.getAll('memberIds'),
    }

    if (!values.name) {
      return
    }

    setTaskMessage('')

    try {
      const payload = buildProjectPayload(values)
      const savedProject =
        projectForm.mode === 'edit'
          ? await taskApi.updateProject(projectForm.values.id, payload)
          : await taskApi.createProject(payload)

      setProjects((currentProjects) =>
        projectForm.mode === 'edit'
          ? currentProjects.map((project) => (project.id === savedProject.id ? savedProject : project))
          : [savedProject, ...currentProjects],
      )
      setProjectForm(null)
      setActiveView('projects')
      setActiveNav('project-board')
      setSelectedProjectId(savedProject.id)
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function archiveProject(projectId) {
    const project = projects.find((item) => item.id === projectId)
    if (!canManageOwnedRecord(user, project)) {
      setTaskMessage('Only this project manager or an administrator can archive it.')
      return
    }

    try {
      const archived = await taskApi.archiveProject(projectId)
      setProjects((currentProjects) => currentProjects.filter((project) => project.id !== archived.id))
      setSelectedProjectId('')
      setTaskMessage('Project archived.')
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function deleteTask(taskId) {
    const task = tasks.find((item) => item.id === taskId)
    if (!getTaskPermissions(user, task).canDelete) {
      setTaskMessage('Only the task creator or an administrator can delete it.')
      return
    }

    if (!window.confirm('Delete this task permanently?')) {
      return
    }

    try {
      await taskApi.deleteTask(taskId)
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId))
      setSelectedTaskId('')
      setTaskMessage('')
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function archiveTask(taskId) {
    const task = tasks.find((item) => item.id === taskId)
    if (!getTaskPermissions(user, task).canManage) {
      setTaskMessage('Only the task creator, project manager, or an administrator can archive it.')
      return
    }

    try {
      const archived = await taskApi.updateTask(taskId, { isArchived: true })
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== archived.id))
      setSelectedTaskId('')
      setTaskMessage('Task archived.')
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function updateTaskStatus(task, status) {
    const previousTasks = tasks
    setTasks((currentTasks) =>
      currentTasks.map((item) => (item.id === task.id ? { ...item, status } : item)),
    )

    try {
      const updated = await taskApi.updateTask(task.id, { status: uiStatusToApi(status) })
      setTasks((currentTasks) =>
        currentTasks.map((item) => (item.id === updated.id ? updated : item)),
      )
    } catch (error) {
      setTasks(previousTasks)
      setTaskMessage(error.message)
    }
  }

  async function saveTaskProgress(values) {
    const task = tasks.find((item) => item.id === values.taskId)
    const permissions = task ? getTaskPermissions(user, task) : null
    if (!task || !permissions.canUpdateProgress) {
      setTaskMessage('You no longer have permission to update this task.')
      setTaskProgressForm(null)
      return
    }

    setIsSavingTask(true)
    setTaskMessage('')

    try {
      const changes = {
        status: uiStatusToApi(values.status),
        progress: Math.min(Math.max(Number(values.progress) || 0, 0), 100),
      }
      if (permissions.canCompleteSubtasks) {
        changes.subtasks = values.subtasks
      }
      const updated = await taskApi.updateTask(task.id, changes)
      setTasks((currentTasks) =>
        currentTasks.map((item) => (item.id === updated.id ? updated : item)),
      )
      setTaskProgressForm(null)
      setTaskMessage('Task progress updated.')
    } catch (error) {
      setTaskMessage(error.message)
    } finally {
      setIsSavingTask(false)
    }
  }

  async function updateTaskSubtasks(task, subtasks) {
    try {
      const updated = await taskApi.updateTask(task.id, { subtasks })
      setTasks((currentTasks) =>
        currentTasks.map((item) => (item.id === updated.id ? updated : item)),
      )
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  function toggleSubtask(task, index) {
    return updateTaskSubtasks(task, toggleSubtaskInList(task.subtasks, index))
  }

  async function addComment(event) {
    event.preventDefault()
    const body = commentText.trim()

    if (!selectedTaskId || !body) {
      return
    }

    try {
      const comment = await taskApi.createComment(selectedTaskId, body)
      setComments((currentComments) => [...currentComments, comment])
      setCommentText('')
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function updateComment(commentId, body) {
    const nextBody = body.trim()

    if (!nextBody) {
      return
    }

    setTaskMessage('')

    try {
      const updatedComment = await taskApi.updateComment(commentId, nextBody)
      setComments((currentComments) =>
        currentComments.map((comment) =>
          (comment._id || comment.id) === (updatedComment._id || updatedComment.id) ? updatedComment : comment,
        ),
      )
      setEditingComment(null)
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function deleteComment(commentId) {
    if (!window.confirm('Delete this comment?')) {
      return
    }

    setTaskMessage('')

    try {
      await taskApi.deleteComment(commentId)
      setComments((currentComments) => currentComments.filter((comment) => (comment._id || comment.id) !== commentId))
      setEditingComment((currentComment) => (currentComment?.id === commentId ? null : currentComment))
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function uploadTaskAttachment(taskId, file) {
    if (!file) {
      return
    }

    try {
      const result = await taskApi.uploadTaskAttachment(taskId, file)

      if (result.task) {
        setTasks((currentTasks) =>
          currentTasks.map((task) => (task.id === result.task.id ? result.task : task)),
        )
      } else {
        setTasks((currentTasks) =>
          currentTasks.map((task) =>
            task.id === taskId
              ? { ...task, attachments: [...task.attachments, result.attachment] }
              : task,
          ),
        )
      }

      setTaskMessage('')
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function deleteTaskAttachment(taskId, attachmentId) {
    try {
      const updated = await taskApi.deleteTaskAttachment(taskId, attachmentId)

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === taskId
            ? updated || {
              ...task,
              attachments: task.attachments.filter((attachment) => getAttachmentId(attachment) !== attachmentId),
            }
            : task,
        ),
      )
      setTaskMessage('')
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  if (authTransition) {
    return <AuthLoadingScreen type={authTransition} />
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-panel" aria-label="TaskEdge authentication">
          <aside className="auth-brand-panel">
            <div className="auth-brand-mark">
              <span aria-hidden="true"><Zap size={20} /></span>
              <strong>TaskEdge</strong>
            </div>

            <div className="auth-brand-content">
              <h1>Your work,<br />all in one place.</h1>
              <p>Plan projects, assign responsibilities, and keep every deadline visible to your team.</p>
              <ul className="auth-brand-benefits">
                <li><Check size={16} /> One clear view of active work</li>
                <li><Check size={16} /> Roles and permissions built in</li>
                <li><Check size={16} /> Deadlines that stay in focus</li>
              </ul>
            </div>

            <div className="auth-brand-footer">
              <span><i /> Systems online</span>
              <small>Task management workspace</small>
            </div>
          </aside>

          <div className={`auth-card ${
            authMode === 'register'
              ? 'register-page'
              : authMode === 'forgot'
                ? 'forgot-page'
                : 'login-page'
          }`}>
            <div className="auth-card-topbar">
              <span className="auth-mobile-brand"><Zap size={16} /> TaskEdge</span>
              <p className="auth-mode-prompt">
                {authMode === 'register'
                  ? 'Already have an account?'
                  : authMode === 'forgot'
                    ? 'Remembered your password?'
                    : 'New here?'}
                <button
                  type="button"
                  onClick={() => {
                    resetAuthForms(
                      authMode === 'register'
                        ? 'login'
                        : authMode === 'forgot'
                          ? 'login'
                          : 'register',
                    )
                  }}
                >
                  {authMode === 'register' ? 'Go to login' : authMode === 'forgot' ? 'Back to login' : 'Create an account'}
                </button>
              </p>
            </div>

            <div className="auth-card-title">
              <span>{authMode === 'login' ? 'Welcome back' : authMode === 'register' ? 'Get started' : 'Account recovery'}</span>
              <h2>
                {authMode === 'register'
                  ? 'Create your account'
                  : authMode === 'forgot'
                    ? 'Reset your password'
                    : 'Sign in to your account'}
              </h2>
              <p>
                {authMode === 'register'
                  ? 'Add your details to create a TaskEdge workspace account.'
                  : authMode === 'forgot'
                    ? 'Request a reset code, then choose a new password.'
                    : 'Enter your details below to access your workspace.'}
              </p>
            </div>

            {authMode === 'login' ? (
              <form key="login" className="form-grid auth-form-page turn-back" onSubmit={handleLogin}>
                <label>
                  Username or email
                  <span className="auth-input-shell">
                    <UserRound size={18} aria-hidden="true" />
                    <input
                      name="usernameOrEmail"
                      autoComplete="username"
                      placeholder="Enter username or email"
                      required
                    />
                  </span>
                </label>
                <label>
                  <span className="auth-label-row">
                    <span>Password</span>
                    <button
                      type="button"
                      className="text-button auth-forgot-button"
                      onClick={() => resetAuthForms('forgot')}
                    >
                      Forgot password?
                    </button>
                  </span>
                  <span className="auth-input-shell">
                    <LockKeyhole size={18} aria-hidden="true" />
                    <input
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      required
                    />
                  </span>
                </label>
                <button className="primary-button" type="submit" disabled={isSubmittingAuth}>
                  {isSubmittingAuth ? 'Checking...' : 'Sign in'}
                </button>
              </form>
            ) : authMode === 'forgot' ? (
              <form
                key="forgot"
                className="form-grid auth-form-page turn-forward"
                onSubmit={resetRequested ? handleResetPassword : handleRequestPasswordReset}
                noValidate
              >
                <label>
                  Account email
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter account email"
                    maxLength="34"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                    required
                    aria-invalid={Boolean(resetValidation.email)}
                    aria-describedby={resetValidation.email ? 'reset-email-error' : undefined}
                  />
                  {resetValidation.email && (
                    <small className="field-error" id="reset-email-error">{resetValidation.email}</small>
                  )}
                </label>

                {resetRequested && (
                  <>
                    <label>
                      Reset code
                      <input
                        name="token"
                        autoComplete="one-time-code"
                        placeholder="Paste reset code"
                        value={resetToken}
                        onChange={(event) => setResetToken(event.target.value)}
                        required
                        aria-invalid={Boolean(resetValidation.token)}
                        aria-describedby={resetValidation.token ? 'reset-token-error' : undefined}
                      />
                      {resetValidation.token && (
                        <small className="field-error" id="reset-token-error">{resetValidation.token}</small>
                      )}
                    </label>
                    <label>
                      New password
                      <input
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Enter new password"
                        minLength="8"
                        maxLength="24"
                        value={resetPassword}
                        onChange={(event) => setResetPassword(event.target.value)}
                        required
                        aria-invalid={Boolean(resetValidation.password)}
                        aria-describedby={resetValidation.password ? 'reset-password-error' : undefined}
                      />
                      {resetValidation.password && (
                        <small className="field-error" id="reset-password-error">{resetValidation.password}</small>
                      )}
                    </label>
                  </>
                )}

                <button className="primary-button" type="submit" disabled={isSubmittingAuth}>
                  {isSubmittingAuth
                    ? 'Working...'
                    : resetRequested
                      ? 'Reset password'
                      : 'Request reset code'}
                </button>
              </form>
            ) : (
              <form
                key="register"
                className="form-grid two-column auth-form-page turn-forward"
                onSubmit={handleRegister}
                noValidate
              >
                <label>
                  First name
                  <input
                    name="firstName"
                    autoComplete="given-name"
                    placeholder="First name"
                    maxLength="40"
                    required
                    aria-invalid={Boolean(registerValidation.firstName)}
                    aria-describedby={registerValidation.firstName ? 'register-first-name-error' : undefined}
                  />
                  {registerValidation.firstName && (
                    <small className="field-error" id="register-first-name-error">{registerValidation.firstName}</small>
                  )}
                </label>
                <label>
                  Last name
                  <input
                    name="lastName"
                    autoComplete="family-name"
                    placeholder="Last name"
                    maxLength="40"
                    required
                    aria-invalid={Boolean(registerValidation.lastName)}
                    aria-describedby={registerValidation.lastName ? 'register-last-name-error' : undefined}
                  />
                  {registerValidation.lastName && (
                    <small className="field-error" id="register-last-name-error">{registerValidation.lastName}</small>
                  )}
                </label>
                <label>
                  Birthday
                  <input
                    name="birthday"
                    type="date"
                    required
                    aria-invalid={Boolean(registerValidation.birthday)}
                    aria-describedby={registerValidation.birthday ? 'register-birthday-error' : undefined}
                  />
                  {registerValidation.birthday && (
                    <small className="field-error" id="register-birthday-error">{registerValidation.birthday}</small>
                  )}
                </label>
                <label>
                  Username
                  <input
                    name="username"
                    autoComplete="username"
                    placeholder="Username"
                    minLength="3"
                    maxLength="20"
                    pattern="[A-Za-z0-9_.]+"
                    required
                    aria-invalid={Boolean(registerValidation.username)}
                    aria-describedby={registerValidation.username ? 'register-username-error' : undefined}
                  />
                  {registerValidation.username && (
                    <small className="field-error" id="register-username-error">{registerValidation.username}</small>
                  )}
                </label>
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    maxLength="34"
                    required
                    aria-invalid={Boolean(registerValidation.email)}
                    aria-describedby={registerValidation.email ? 'register-email-error' : undefined}
                  />
                  {registerValidation.email && (
                    <small className="field-error" id="register-email-error">{registerValidation.email}</small>
                  )}
                </label>
                <label>
                  Phone
                  <input
                    name="phone"
                    autoComplete="tel"
                    inputMode="numeric"
                    minLength="7"
                    maxLength="15"
                    pattern="[0-9]+"
                    placeholder="Phone number"
                    required
                    aria-invalid={Boolean(registerValidation.phone)}
                    aria-describedby={registerValidation.phone ? 'register-phone-error' : undefined}
                  />
                  {registerValidation.phone && (
                    <small className="field-error" id="register-phone-error">{registerValidation.phone}</small>
                  )}
                </label>
                <label className="full">
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Enter your password"
                    minLength="8"
                    maxLength="24"
                    required
                    aria-invalid={Boolean(registerValidation.password)}
                    aria-describedby={registerValidation.password ? 'register-password-error' : undefined}
                  />
                  {registerValidation.password && (
                    <small className="field-error" id="register-password-error">{registerValidation.password}</small>
                  )}
                </label>
                <button className="primary-button full" type="submit" disabled={isSubmittingAuth}>
                  {isSubmittingAuth ? 'Creating...' : 'Create account'}
                </button>
              </form>
            )}

            {authMessage && <p className="form-message">{authMessage}</p>}

            <div className="auth-security-note">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Your account data is protected by secure sessions.</span>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="account-card">
          <UserAvatar user={user} className="brand-mark" fallback="default" />
          <button
            type="button"
            className="profile-menu-trigger"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((isOpen) => !isOpen)}
          >
            <span>{getUserDisplayName(user)}</span>
              <i aria-hidden="true">▾</i>
          </button>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button
                type="button"
                onClick={() => {
                  handleSidebarSelect('profile')
                  setProfileMenuOpen(false)
                }}
              >
                Profile
              </button>
              <button type="button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>

        <nav className="nav-groups">
          <div className="nav-group">
            {focusTabs.map((item) => (
              <SidebarTab
                key={item.id}
                item={item}
                activeNav={activeNav}
                onSelect={handleSidebarSelect}
              />
            ))}
          </div>

          <SidebarSection
            title="Workspace"
            items={visibleWorkspaceTabs}
            activeNav={activeNav}
            onSelect={handleSidebarSelect}
          />
        </nav>
      </aside>

      <section className="workspace">
        <div className="workspace-main">
          <header className="topbar">
            <div>
              <h2>
                {getGreeting()}, {user.firstName}
                <span>.</span>
              </h2>
              <p>
                {activeView === 'dashboard'
                  ? 'What is your focus for today?'
                  : selectedTask
                    ? 'Review the full task record.'
                    : activeView === 'projects'
                      ? 'Track project progress and work.'
                    : activeView === 'teams'
                      ? 'Manage teams and members.'
                    : activeView === 'admin-users'
                      ? 'Manage roles and access.'
                    : activeView === 'activity-log'
                      ? 'Review system activity and changes.'
                    : activeView === 'activities'
                      ? 'Assign and review individual work.'
                    : activeView === 'notifications'
                      ? 'Review alerts and updates.'
                    : activeView === 'archive'
                      ? 'Restore completed or hidden records.'
                    : activeView === 'calendar'
                      ? 'Plan the next seven days.'
                    : activeView === 'tasks'
                      ? 'Organize the shared work queue.'
                      : 'Review your account details.'}
              </p>
            </div>
          </header>

          <section className="focus-main">
            {activeView === 'dashboard' && (
              <Dashboard
                tasks={tasks}
                users={users}
                onCreateTask={canCreateTask ? openNewTaskForm : null}
                onOpenTaskShortcut={openDashboardTaskShortcut}
                onOpenTask={openTaskFromQueue}
              />
            )}

            {activeView === 'tasks' && (
              selectedTask ? (
                <TaskDetailsPage
                  task={selectedTask}
                  currentUser={user}
                  permissions={selectedTaskPermissions}
                  comments={comments}
                  commentText={commentText}
                  editingComment={editingComment}
                  taskMessage={taskMessage}
                  onBack={() => {
                    setSelectedTaskId('')
                    setComments([])
                    setEditingComment(null)
                  }}
                  onCommentTextChange={setCommentText}
                  onAddComment={addComment}
                  onStartEditComment={(comment) =>
                    setEditingComment({ id: comment._id || comment.id, body: comment.body || '' })}
                  onCancelEditComment={() => setEditingComment(null)}
                  onUpdateComment={updateComment}
                  onDeleteComment={deleteComment}
                  onStatusChange={(status) => updateTaskStatus(selectedTask, status)}
                  onToggleSubtask={(index) => toggleSubtask(selectedTask, index)}
                  onUploadAttachment={(file) => uploadTaskAttachment(selectedTask.id, file)}
                  onDeleteAttachment={(attachmentId) => deleteTaskAttachment(selectedTask.id, attachmentId)}
                  onOpenProgress={openTaskProgressForm}
                  onEditTask={selectedTaskPermissions.canManage ? openEditTaskForm : null}
                  onArchiveTask={selectedTaskPermissions.canManage ? archiveTask : null}
                  onDeleteTask={selectedTaskPermissions.canDelete ? deleteTask : null}
                />
              ) : (
                <TasksPage
                  tasks={visibleTasks}
                  isLoading={isLoadingTasks}
                  taskError={taskError}
                  taskMessage={taskMessage}
                  statusFilter={statusFilter}
                  priorityFilter={priorityFilter}
                  dueFilter={dueFilter}
                  scopeFilter={scopeFilter}
                  sortMode={taskSort}
                  onStatusFilterChange={setStatusFilter}
                  onPriorityFilterChange={setPriorityFilter}
                  onDueFilterChange={setDueFilter}
                  onScopeFilterChange={setScopeFilter}
                  onSortChange={setTaskSort}
                  onRefresh={loadWorkspaceData}
                  onCreateTask={canCreateTask ? openNewTaskForm : null}
                  onOpenTask={(task) => {
                    setComments([])
                    setEditingComment(null)
                    setSelectedTaskId(task.id)
                  }}
                  onEditTask={canCreateTask ? openEditTaskForm : null}
                  onDeleteTask={canCreateTask ? deleteTask : null}
                  currentUser={user}
                />
              )
            )}

            {activeView === 'calendar' && (
              <CalendarPage
                tasks={tasks}
                selectedDate={selectedCalendarDate}
                onSelectDate={setSelectedCalendarDate}
                onOpenTask={(task) => {
                  setActiveView('tasks')
                  setActiveNav('all-my-tasks')
                  setComments([])
                  setEditingComment(null)
                  setSelectedTaskId(task.id)
                }}
                onCreateTask={canCreateTask ? openNewTaskForm : null}
              />
            )}

            {activeView === 'projects' && (
              selectedProject ? (
                <ProjectDetailsPage
                  project={selectedProject}
                  tasks={tasks.filter((task) => task.projectId === selectedProject.id)}
                  taskMessage={taskMessage}
                  onBack={() => setSelectedProjectId('')}
                  onOpenTask={(task) => {
                    setSelectedProjectId('')
                    setActiveView('tasks')
                    setActiveNav('all-my-tasks')
                    setComments([])
                    setEditingComment(null)
                    setSelectedTaskId(task.id)
                  }}
                  onStatusChange={canManageOwnedRecord(user, selectedProject) ? updateTaskStatus : null}
                  onCreateTask={() => openNewTaskForm(selectedProject.id)}
                  onEditProject={openEditProjectForm}
                  onArchiveProject={archiveProject}
                  canManage={canManageOwnedRecord(user, selectedProject)}
                />
              ) : (
                <ProjectsPage
                  projects={projects}
                  tasks={tasks}
                  isLoading={isLoadingTasks}
                  taskError={taskError}
                  taskMessage={taskMessage}
                  canManage={canManageProjects}
                  currentUser={user}
                  onRefresh={loadWorkspaceData}
                  onCreateProject={openNewProjectForm}
                  onOpenProject={(project) => setSelectedProjectId(project.id)}
                  onEditProject={openEditProjectForm}
                  onArchiveProject={archiveProject}
                />
              )
            )}

            {activeView === 'teams' && (
              <TeamsPage
                teams={teams}
                isLoading={isLoadingTasks}
                taskError={taskError}
                taskMessage={archiveMessage}
                canManage={canManageTeams}
                currentUser={user}
                onRefresh={loadWorkspaceData}
                onCreateTeam={openNewTeamForm}
                onEditTeam={openEditTeamForm}
                onArchiveTeam={archiveTeam}
              />
            )}

            {activeView === 'activities' && (
              selectedActivity ? (
                <ActivityDetailsPage
                  activity={selectedActivity}
                  assignments={activityAssignments}
                  myAssignment={myActivityAssignment}
                  project={projects.find((project) => project.id === selectedActivity.projectId)}
                  users={users}
                  canReview={getTaskPermissions(user, selectedActivity).canManage}
                  taskMessage={taskMessage}
                  onBack={() => setSelectedActivityId('')}
                  onEditActivity={openEditActivityForm}
                  onRemindActivity={remindActivity}
                  onArchiveActivity={archiveActivity}
                  onCancelActivity={cancelActivity}
                  onReopenActivity={reopenActivity}
                  onReopenAssignment={reopenActivityAssignment}
                  onExportActivityResults={exportActivityResults}
                  onAddActivityRecipients={addActivityRecipients}
                  onRemoveActivityRecipient={removeActivityRecipient}
                  onStartAssignment={startActivityAssignment}
                  onSubmitAssignment={submitActivityAssignment}
                  onReviewAssignment={reviewActivityAssignment}
                  onUploadReferenceAttachment={uploadActivityReferenceAttachment}
                  onDeleteReferenceAttachment={deleteActivityReferenceAttachment}
                  onUploadAssignmentAttachment={uploadActivityAssignmentAttachment}
                  onDeleteAssignmentAttachment={deleteActivityAssignmentAttachment}
                />
              ) : (
                <ActivitiesPage
                  activities={activities}
                  isLoading={isLoadingTasks}
                  taskError={taskError}
                  taskMessage={taskMessage}
                  canManage={canManageProjects}
                  onRefresh={loadWorkspaceData}
                  onCreateActivity={openNewActivityForm}
                  onOpenActivity={(activity) => setSelectedActivityId(activity.id)}
                />
              )
            )}

            {activeView === 'admin-users' && canManageUsers && (
              <AdminUsersPage
                users={users}
                currentUser={auth.user}
                isLoading={isLoadingTasks}
                taskError={taskError}
                taskMessage={taskMessage}
                onRefresh={loadWorkspaceData}
                onUpdateUser={updateUserAccount}
              />
            )}

            {activeView === 'activity-log' && canManageUsers && (
              <ActivityLogPage
                auditLog={auditLog}
                isLoading={isLoadingTasks}
                taskError={taskError}
                taskMessage={taskMessage}
                onRefresh={loadWorkspaceData}
              />
            )}

            {activeView === 'notifications' && (
              <NotificationsPage
                notifications={notifications}
                isLoading={isLoadingTasks}
                taskError={taskError}
                taskMessage={taskMessage}
                onRefresh={loadWorkspaceData}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onDeleteNotification={deleteNotification}
              />
            )}

            {activeView === 'archive' && canOpenArchive && (
              <ArchivePage
                archivedRecords={archivedRecords}
                activeArchiveTab={activeArchiveTab}
                onArchiveTabChange={setActiveArchiveTab}
                currentUser={user}
                isLoading={isLoadingTasks}
                taskError={taskError}
                taskMessage={taskMessage}
                onRefresh={loadWorkspaceData}
                onRestore={restoreArchivedRecord}
                onDelete={deleteArchivedRecord}
              />
            )}

            {activeView === 'profile' && (
              <ProfilePage
                user={user}
                tasks={tasks}
                profileMessage={profileMessage}
                validation={profileValidation}
                onSaveChanges={saveProfileSettings}
                onChangeEmail={changeProfileEmail}
                onChangePassword={changeProfilePassword}
                onClearFeedback={clearProfileFeedback}
                onLogout={handleLogout}
                onLogoutAllDevices={logoutAllDevices}
                onDeleteAccount={deleteAccount}
              />
            )}
          </section>
        </div>
        <TaskQueuePanel tasks={tasks} onOpenTask={openTaskFromQueue} onCreateTask={canCreateTask ? openNewTaskForm : null} />
      </section>

      {taskForm && (
        <TaskModal
          formState={taskForm}
          onClose={() => setTaskForm(null)}
          onSubmit={handleTaskSubmit}
          projects={taskForm.mode === 'edit'
            ? projects.filter((project) => canManageOwnedRecord(user, project) || project.id === taskForm.values.projectId)
            : manageableProjects}
          users={users}
          tasks={tasks}
          isSaving={isSavingTask}
          taskMessage={taskMessage}
        />
      )}

      {taskProgressForm && (
        <TaskProgressModal
          values={taskProgressForm}
          isSaving={isSavingTask}
          taskMessage={taskMessage}
          onClose={() => setTaskProgressForm(null)}
          onSave={saveTaskProgress}
        />
      )}

      {projectForm && (
        <ProjectModal
          formState={projectForm}
          users={users}
          currentUser={auth.user}
          taskMessage={taskMessage}
          onClose={() => setProjectForm(null)}
          onSubmit={handleProjectSubmit}
        />
      )}

      {teamForm && (
        <TeamModal
          formState={teamForm}
          users={users}
          currentUser={auth.user}
          taskMessage={taskMessage}
          onClose={() => setTeamForm(null)}
          onSubmit={handleTeamSubmit}
        />
      )}

      {activityForm && (
        <ActivityModal
          formState={activityForm}
          projects={activityForm.mode === 'edit'
            ? projects.filter((project) => canManageOwnedRecord(user, project) || project.id === activityForm.values.projectId)
            : manageableProjects}
          users={users}
          taskMessage={taskMessage}
          onClose={() => setActivityForm(null)}
          onSubmit={handleActivitySubmit}
        />
      )}
    </main>
  )
}

export default App
