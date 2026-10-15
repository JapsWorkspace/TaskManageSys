import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Archive,
  Bell,
  CalendarDays,
  ClipboardCheck,
  Folder,
  History,
  House,
  List,
  ShieldCheck,
  Users,
} from 'lucide-react'
import './App.css'
import loginBg from './assets/Loginbg.png'
import loginBgTwo from './assets/Loginbg2.png'
import loginBgThree from './assets/Loginbg3.png'
import defaultProfileImage from './assets/default.jpg'
import {
  clearStoredAuth,
  createAuthHeaders,
  readStoredAuth,
  storeAuth,
} from './authStorage.js'
import { buildAuthFromResponse } from './authLogic.js'
import { createAuthApi } from './authApi.js'
import { createTaskApi } from './taskApi.js'
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  buildProjectPayload,
  getEligibleProjectPeople,
  getProjectProgress,
  getProjectStatusBuckets,
} from './projectLogic.js'
import {
  buildActivityPayload,
  buildActivityUpdatePayload,
  getActivityAttachmentDisplay,
  canReopenActivityAssignment,
  canSubmitActivityAssignment,
  getActivityMetrics,
  getActivityHistoryItems,
  getActivityPolicyFacts,
  getActivityRecipientFacts,
  getActivityReminderState,
  getActivitySubmissionHistory,
  getActivitySubmissionError,
  getVisibleActivityAssignments,
  validateActivityAttachmentFile,
  validateActivityReview,
} from './activityLogic.js'
import {
  buildTeamPayload,
  getTeamMetrics,
} from './teamLogic.js'
import { getNotificationMetrics } from './notificationLogic.js'
import { didCountIncrease } from './navBadgeLogic.js'
import { getSidebarIconName } from './sidebarNavigation.js'
import { getUserDisplayName } from './userDisplayLogic.js'
import {
  PRIORITIES,
  STATUSES,
  buildTaskPayload,
  getAgendaTasks,
  getCalendarDays,
  getCalendarMonthDays,
  getMyDayMetrics,
  getRecentTasks,
  getRecurrenceSummary,
  getTaskQueueGroups,
  getTaskAttachmentDisplay,
  getTaskDashboardShortcutFilters,
  getTaskPriorityBreakdown,
  getTaskStatusBreakdown,
  getUpcomingDeadlineTasks,
  getTaskDetailFacts,
  getVisibleTasks,
  removeSubtaskFromList,
  toggleSubtaskInList,
  uiStatusToApi,
} from './taskLogic.js'
import {
  buildProfileSettingsPayload,
  validateConfirmedPasswordChange,
  validateEmailChange,
  validateProfileImageFile,
  validateRegistration,
  validateProfileSettings,
} from './profileSettingsLogic.js'
import { createRealtimeSync } from './realtimeSync.js'
import { getPaginationState } from './paginationLogic.js'
import { getPathForNav, getRouteState } from './routeLogic.js'
import {
  canAccessAdminArea,
  canAccessArchive,
  canCreateTasks,
  canManageOwnedRecord,
  getArchiveRecordPermissions,
  getTaskCommentPermissions,
  getTaskPermissions,
} from './taskPermissions.js'
import {
  getAuthTransitionCopy,
  getRemainingTransitionTime,
} from './authTransitionLogic.js'
import { getAppConfig } from './appConfig.js'

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

const sidebarIconComponents = {
  Archive,
  Bell,
  CalendarDays,
  ClipboardCheck,
  Folder,
  History,
  House,
  List,
  ShieldCheck,
  Users,
}

const baseWorkspaceTabs = [
  { id: 'project-board', label: 'Project board', count: '' },
  { id: 'teams', label: 'Teams', count: '' },
  { id: 'individual-activities', label: 'Individual activities', count: '' },
  { id: 'notifications', label: 'Notifications', count: '' },
  { id: 'archive', label: 'Archive', count: '' },
]

const authSlides = [
  {
    image: loginBg,
  },
  {
    image: loginBgTwo,
  },
  {
    image: loginBgThree,
  },
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
  const [activeAuthSlide, setActiveAuthSlide] = useState(0)
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
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [taskError, setTaskError] = useState('')
  const [taskMessage, setTaskMessage] = useState('')
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
    if (user) {
      return undefined
    }

    const slideTimer = window.setInterval(() => {
      setActiveAuthSlide((currentSlide) => (currentSlide + 1) % authSlides.length)
    }, 4200)

    return () => window.clearInterval(slideTimer)
  }, [user])

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

  function openNewTaskForm() {
    if (!canCreateTask) {
      setTaskMessage('Only managers and administrators can create tasks.')
      return
    }

    const defaultProject = projects[0]
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

    setTaskMessage('')

    try {
      const archived = await taskApi.archiveActivity(activityId)
      setActivities((currentActivities) =>
        currentActivities.filter((activity) => activity.id !== archived.id),
      )
      setSelectedActivityId('')
      setTaskMessage('Activity archived.')
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
      setTaskMessage('You do not have permission to restore this archived record.')
      return
    }

    setTaskMessage('')

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
      setTaskMessage(`${restoredLabel} restored.`)
    } catch (error) {
      setTaskMessage(error.message)
    }
  }

  async function deleteArchivedRecord(type, recordId) {
    const record = (archivedRecords[type] || []).find((item) => (type === 'users' ? getUserId(item) : item.id) === recordId)
    if (!getArchiveRecordPermissions(user, type, record).canDelete) {
      setTaskMessage('You do not have permission to permanently delete this archived record.')
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

    setTaskMessage('')

    try {
      await taskApi.deleteArchivedRecord(type, recordId)
      setArchivedRecords((currentRecords) => ({
        ...currentRecords,
        [type]: (currentRecords[type] || []).filter((record) => record.id !== recordId),
      }))
      setTaskMessage(`Archived ${recordLabel} deleted.`)
    } catch (error) {
      setTaskMessage(error.message)
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
          <div className="auth-intro">
            <div className="auth-slides" aria-live="polite">
              {authSlides.map((slide, index) => (
                <img
                  key={slide.image}
                  className={index === activeAuthSlide ? 'active' : ''}
                  src={slide.image}
                  alt=""
                />
              ))}
            </div>
            <div className="auth-intro-top">
              <p className="eyebrow">Task Management System</p>
            </div>
            <div className="auth-intro-bottom">
              <h1>TaskEdge keeps project work visible and moving.</h1>
              <div className="auth-slide-bars" aria-label="Authentication image carousel">
                {authSlides.map((slide, index) => (
                  <button
                    key={slide.image}
                    type="button"
                    className={index === activeAuthSlide ? 'active' : ''}
                    aria-label={`Show slide ${index + 1}`}
                    onClick={() => setActiveAuthSlide(index)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className={`auth-card ${
            authMode === 'register'
              ? 'register-page'
              : authMode === 'forgot'
                ? 'forgot-page'
                : 'login-page'
          }`}>
            <div className="auth-card-title">
              <p>
                {authMode === 'register'
                  ? 'Create an account'
                  : authMode === 'forgot'
                    ? 'Reset password'
                    : 'Login'}
              </p>
            </div>

            {authMode === 'login' ? (
              <form key="login" className="form-grid auth-form-page turn-back" onSubmit={handleLogin}>
                <label>
                  Username or email
                  <input
                    name="usernameOrEmail"
                    autoComplete="username"
                    placeholder="Enter username or email"
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                  />
                </label>
                <button className="primary-button" type="submit" disabled={isSubmittingAuth}>
                  {isSubmittingAuth ? 'Checking...' : 'Login'}
                </button>
                <button
                  type="button"
                  className="text-button auth-forgot-button"
                  onClick={() => resetAuthForms('forgot')}
                >
                  Forgot password?
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

            <p className="auth-mode-prompt">
              {authMode === 'register'
                ? 'Already have an account?'
                : authMode === 'forgot'
                  ? 'Remembered your password?'
                  : 'Not registered yet?'}
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
                taskMessage={taskMessage}
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

function SidebarTab({ item, activeNav, onSelect, isEditing = false, onRemove = null }) {
  const previousCountRef = useRef(item.count)
  const [countIncreased, setCountIncreased] = useState(false)

  useEffect(() => {
    if (didCountIncrease(previousCountRef.current, item.count)) {
      setCountIncreased(false)
      const animationFrame = window.requestAnimationFrame(() => setCountIncreased(true))
      const timer = window.setTimeout(() => setCountIncreased(false), 900)
      previousCountRef.current = item.count

      return () => {
        window.cancelAnimationFrame(animationFrame)
        window.clearTimeout(timer)
      }
    }

    previousCountRef.current = item.count
    return undefined
  }, [item.count])

  return (
    <div className={activeNav === item.id ? 'nav-row active' : 'nav-row'}>
      <button
        type="button"
        className="nav-link"
        onClick={() => onSelect(item.id)}
      >
        <SidebarNavIcon itemId={item.id} />
        <span>{item.label}</span>
        {item.count && <small className={countIncreased ? 'count-bump' : ''}>{item.count}</small>}
      </button>
      {isEditing && onRemove && (
        <button
          type="button"
          className="nav-delete"
          aria-label={`Delete ${item.label}`}
          onClick={() => onRemove(item.id)}
        >
          x
        </button>
      )}
    </div>
  )
}

function SidebarNavIcon({ itemId }) {
  const iconName = getSidebarIconName(itemId)
  const Icon = sidebarIconComponents[iconName]

  return Icon ? <Icon className="nav-icon" size={18} strokeWidth={1.7} aria-hidden="true" /> : null
}

function SidebarSection({
  title,
  items,
  activeNav,
  onSelect,
}) {
  return (
    <div className="nav-group">
      <div className="nav-group-title">
        <span>{title}</span>
      </div>

      {items.map((item) => (
        <SidebarTab
          key={item.id}
          item={item}
          activeNav={activeNav}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function Dashboard({ tasks, onCreateTask, onOpenTask, onOpenTaskShortcut }) {
  const agendaTasks = getAgendaTasks(tasks)
  const metrics = getMyDayMetrics(tasks)
  const recentTasks = getRecentTasks(tasks, { limit: 5 })
  const upcomingDeadlines = getUpcomingDeadlineTasks(tasks, { limit: 3 })
  const statusBreakdown = getTaskStatusBreakdown(tasks)
  const priorityBreakdown = getTaskPriorityBreakdown(tasks)
  const overviewCards = [
    { label: 'Active tasks', value: metrics.active, tone: 'blue' },
    { label: 'Completed today', value: metrics.completedToday, tone: 'green' },
    { label: 'Due today', value: metrics.dueToday, tone: 'amber' },
    { label: 'Overdue', value: metrics.overdue, tone: 'red' },
  ]

  return (
    <section className="page-stack">
      <div className="summary-grid my-day-summary">
        {overviewCards.map((card) => (
          <article className={`metric-card metric-${card.tone}`} key={card.label}>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="today-strip">
        <div className="date-card">
          <span>{new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date())}</span>
          <strong>{new Intl.DateTimeFormat('en', { day: 'numeric' }).format(new Date())}</strong>
          <span>{new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date())}</span>
        </div>
        <div className="agenda-lines" aria-label="Today agenda">
          {agendaTasks.length ? (
            agendaTasks.map((task) => (
              <p key={`agenda-${task.id}`} className={task.isOverdue ? 'overdue' : ''}>
                <span />
                {task.label}
                {task.isOverdue ? ` ${task.title}` : ''}
              </p>
            ))
          ) : (
            <p><span /> No urgent tasks right now</p>
          )}
        </div>
      </div>

      <div className="dashboard-insight-grid">
        <article className="dashboard-status-panel">
          <div className="section-row compact">
            <div>
              <p className="eyebrow">Task status</p>
              <h3 className="section-title">Work distribution</h3>
            </div>
          </div>
          <div className="dashboard-status-bar" aria-label="Task status distribution">
            {statusBreakdown.map((item) => (
              item.count > 0 && (
                <span
                  className={`status-segment status-segment-${item.tone}`}
                  key={`segment-${item.label}`}
                  style={{ width: `${item.percent}%` }}
                  title={`${item.label}: ${item.count}`}
                />
              )
            ))}
          </div>
          <div className="dashboard-status-list">
            {statusBreakdown.map((item) => (
              <button
                type="button"
                className="dashboard-status-item"
                key={item.label}
                onClick={() => onOpenTaskShortcut({ type: 'status', value: item.label })}
              >
                <span className={`status-dot status-dot-${item.tone}`} />
                <div>
                  <strong>{item.count}</strong>
                  <p>{item.label}</p>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="dashboard-status-panel dashboard-priority-panel">
          <div className="section-row compact">
            <div>
              <p className="eyebrow">Priority focus</p>
              <h3 className="section-title">Urgency overview</h3>
            </div>
          </div>
          <div className="dashboard-priority-list">
            {priorityBreakdown.map((item) => {
              const isPriority = PRIORITIES.includes(item.label)
              const isOverdue = item.label === 'Overdue'

              return (
                <button
                  type="button"
                  className={`dashboard-priority-row priority-focus-${item.tone}`}
                  key={item.label}
                  disabled={!isPriority && !isOverdue}
                  onClick={() =>
                    onOpenTaskShortcut(
                      isOverdue
                        ? { type: 'due', value: 'overdue' }
                        : { type: 'priority', value: item.label },
                    )}
                >
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </button>
              )
            })}
          </div>
        </article>
      </div>

      <div className="section-row">
        <div>
          <p className="eyebrow">My Day</p>
          <h3 className="section-title">Recent active tasks</h3>
        </div>
      </div>

      <div className="task-card-list">
        {recentTasks.length ? (
          recentTasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpenTask={onOpenTask} />
          ))
        ) : (
          <div className="empty-state">
            <h3>No active tasks yet</h3>
            <p>Create a task or update an existing one to see it here.</p>
          </div>
        )}
      </div>

      <div className="section-row">
        <div>
          <p className="eyebrow">Deadlines</p>
          <h3 className="section-title">Upcoming deadlines</h3>
        </div>
      </div>

      <div className="dashboard-deadline-list">
        {upcomingDeadlines.length ? (
          upcomingDeadlines.map((task) => (
            <button
              type="button"
              className="dashboard-deadline-card"
              key={`deadline-${task.id}`}
              onClick={() => onOpenTask(task)}
            >
              <span>{task.project?.charAt(0) || 'T'}</span>
              <div>
                <strong>{task.title}</strong>
                <p>{task.project} · {formatDate(task.dueAt || task.dueDate)}</p>
              </div>
              <PriorityBadge value={task.priority} />
            </button>
          ))
        ) : (
          <div className="empty-state dashboard-deadline-empty">
            <h3>No upcoming deadlines</h3>
            <p>Future work with due dates will appear here.</p>
          </div>
        )}
      </div>

      {onCreateTask && (
        <button type="button" className="add-task-bar" onClick={onCreateTask}>
          <span>+</span>
          Add task
        </button>
      )}
    </section>
  )
}

function CalendarPage({
  tasks,
  selectedDate,
  onSelectDate,
  onOpenTask,
  onCreateTask,
}) {
  const [calendarMode, setCalendarMode] = useState('month')
  const [isCalendarSwitching, setIsCalendarSwitching] = useState(false)
  const selected = new Date(selectedDate)
  const visibleDate = Number.isNaN(selected.getTime()) ? new Date() : selected
  const monthDays = getCalendarMonthDays(tasks, { selectedDate: visibleDate })
  const weekDays = getCalendarDays(tasks, { now: visibleDate })
  const days = calendarMode === 'month' ? monthDays : weekDays
  const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(visibleDate)

  function shiftMonth(amount) {
    const nextDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + amount, 1)
    onSelectDate(getLocalDateKey(nextDate))
  }

  function toggleCalendarMode() {
    if (isCalendarSwitching) {
      return
    }

    setIsCalendarSwitching(true)
    setCalendarMode((currentMode) => (currentMode === 'month' ? 'week' : 'month'))
  }

  useEffect(() => {
    if (!isCalendarSwitching) {
      return undefined
    }

    const timeout = window.setTimeout(() => setIsCalendarSwitching(false), 360)
    return () => window.clearTimeout(timeout)
  }, [isCalendarSwitching])

  return (
    <section className={`calendar-page calendar-${calendarMode}-view`}>
      <div className="calendar-toolbar">
        <div className="calendar-title-row">
          <div>
            <p className="eyebrow">Deadline calendar</p>
            <h3 className="section-title">{calendarMode === 'month' ? monthLabel : 'Next 7 days'}</h3>
          </div>
          <button
            type="button"
            className="ghost-button compact"
            onClick={toggleCalendarMode}
            disabled={isCalendarSwitching}
          >
            {calendarMode === 'month' ? 'Show 7 days' : 'Show month'}
          </button>
        </div>
        <div className="row-actions">
          {calendarMode === 'month' && (
            <button type="button" className="ghost-button compact" onClick={() => shiftMonth(-1)}>
              Previous
            </button>
          )}
          <button type="button" className="ghost-button compact" onClick={() => onSelectDate(getLocalDateKey(new Date()))}>
            Today
          </button>
          {calendarMode === 'month' && (
            <button type="button" className="ghost-button compact" onClick={() => shiftMonth(1)}>
              Next
            </button>
          )}
          {onCreateTask && (
            <button type="button" className="primary-button compact" onClick={onCreateTask}>
              Add task
            </button>
          )}
        </div>
      </div>

      {calendarMode === 'month' && (
        <div className="calendar-weekdays" aria-hidden="true">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
      )}

      <div
        key={calendarMode}
        className={`calendar-grid ${calendarMode === 'month' ? 'month-calendar-grid' : 'week-calendar-grid'}`}
        aria-label={calendarMode === 'month' ? `${monthLabel} deadline calendar` : 'Next 7 days calendar'}
      >
        {days.map((day, index) => {
          if (day.isBlank) {
            return (
              <span
                className="calendar-day calendar-day-blank"
                key={day.key}
                aria-hidden="true"
                style={{ '--calendar-card-index': index }}
              />
            )
          }

          const isSelected = day.dateKey === selectedDate
          const overdueCount = day.tasks.filter((task) => {
            const dueTime = new Date(task.dueAt || task.dueDate).getTime()
            return !['Completed', 'Done'].includes(task.status) && !Number.isNaN(dueTime) && dueTime < Date.now()
          }).length

          return (
            <article
              className={[
                'calendar-day',
                isSelected ? 'selected' : '',
                day.isToday ? 'today' : '',
                day.tasks.length ? '' : 'empty',
              ].filter(Boolean).join(' ')}
              key={day.dateKey}
              role="button"
              tabIndex={0}
              style={{ '--calendar-card-index': index }}
              onClick={() => onSelectDate(day.dateKey)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectDate(day.dateKey)
                }
              }}
            >
              <div className="calendar-day-button">
                {calendarMode === 'week' && (
                  <span>{new Intl.DateTimeFormat('en', { weekday: 'short' }).format(day.date)}</span>
                )}
                <strong>
                  {calendarMode === 'month'
                    ? day.dayNumber
                    : new Intl.DateTimeFormat('en', { day: 'numeric' }).format(day.date)}
                </strong>
                <small>
                  {calendarMode === 'month'
                    ? day.tasks.length ? `${day.tasks.length} task${day.tasks.length === 1 ? '' : 's'}` : 'No tasks'
                    : new Intl.DateTimeFormat('en', { month: 'short' }).format(day.date)}
                </small>
              </div>

              <div className="calendar-task-stack">
                {day.tasks.length ? (
                  day.tasks.map((task) => (
                    <button
                      type="button"
                      className={`calendar-task-chip priority-${task.priority.toLowerCase()}`}
                      key={`calendar-${day.dateKey}-${task.id}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpenTask(task)
                      }}
                    >
                      <span>{getTimeInputValue(task.dueAt || task.dueDate) || 'All day'}</span>
                      <strong>{task.title}</strong>
                    </button>
                  ))
                ) : (
                  <p>No scheduled tasks</p>
                )}
              </div>

              {overdueCount > 0 && (
                <span className="calendar-alert">{overdueCount} overdue</span>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function TasksPage({
  tasks,
  currentUser,
  isLoading,
  taskError,
  taskMessage,
  statusFilter,
  priorityFilter,
  dueFilter,
  scopeFilter,
  sortMode,
  onStatusFilterChange,
  onPriorityFilterChange,
  onDueFilterChange,
  onScopeFilterChange,
  onSortChange,
  onRefresh,
  onCreateTask,
  onOpenTask,
  onEditTask,
  onDeleteTask,
}) {
  const pagination = usePaginatedRecords(tasks, 6)

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div className="segmented-control" aria-label="Filter tasks by status">
          {['All', ...STATUSES].map((status) => (
            <button
              key={status}
              type="button"
              className={statusFilter === status ? 'active' : ''}
              onClick={() => onStatusFilterChange(status)}
            >
              {status}
            </button>
          ))}
        </div>
        {onCreateTask && (
          <button type="button" className="primary-button compact" onClick={onCreateTask}>
            Add task
          </button>
        )}
      </div>

      <div className="task-filter-row">
        <label>
          Priority
          <select value={priorityFilter} onChange={(event) => onPriorityFilterChange(event.target.value)}>
            {['All', ...PRIORITIES].map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
        <label>
          Due
          <select value={dueFilter} onChange={(event) => onDueFilterChange(event.target.value)}>
            <option value="all">All</option>
            <option value="overdue">Overdue</option>
          </select>
        </label>
        <label>
          Scope
          <select value={scopeFilter} onChange={(event) => onScopeFilterChange(event.target.value)}>
            <option value="all">All</option>
            <option value="assigned-to-me">Assigned to me</option>
            <option value="created-by-me">Created by me</option>
            <option value="watching">Watching</option>
          </select>
        </label>
        <label>
          Sort
          <select value={sortMode} onChange={(event) => onSortChange(event.target.value)}>
            <option value="deadline">Deadline</option>
            <option value="priority">Priority</option>
            <option value="title">Title</option>
          </select>
        </label>
        <button type="button" className="ghost-button compact" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {taskMessage && <p className="form-message">{taskMessage}</p>}
      {taskError && (
        <div className="empty-state">
          <h3>Could not load tasks</h3>
          <p>{taskError}</p>
          <button type="button" className="primary-button compact" onClick={onRefresh}>
            Retry
          </button>
        </div>
      )}

      <div className="task-card-list">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading tasks</h3>
            <p>Fetching the shared task queue from the server.</p>
          </div>
        ) : tasks.length ? (
          pagination.items.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentUser={currentUser}
              onOpenTask={onOpenTask}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
            />
          ))
        ) : (
          <div className="empty-state">
            <h3>No tasks found</h3>
            <p>{onCreateTask ? 'Adjust the search or status filter, or add a new task.' : 'Adjust the search or status filters.'}</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label="tasks" />
    </section>
  )
}

function ProjectsPage({
  projects,
  tasks,
  isLoading,
  taskError,
  taskMessage,
  canManage,
  currentUser,
  onRefresh,
  onCreateProject,
  onOpenProject,
  onEditProject,
  onArchiveProject,
}) {
  const pagination = usePaginatedRecords(projects, 6)

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Projects</p>
          <h3 className="section-title">Workspace project board</h3>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button compact" onClick={onRefresh}>
            Refresh
          </button>
          {canManage && (
            <button type="button" className="primary-button compact" onClick={onCreateProject}>
              Add project
            </button>
          )}
        </div>
      </div>

      {taskMessage && <p className="form-message">{taskMessage}</p>}
      {taskError && (
        <div className="empty-state">
          <h3>Could not load projects</h3>
          <p>{taskError}</p>
        </div>
      )}

      <div className="project-grid">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading projects</h3>
            <p>Fetching the shared project list from the server.</p>
          </div>
        ) : projects.length ? (
          pagination.items.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              progress={getProjectProgress(project.id, tasks)}
              canManage={canManageOwnedRecord(currentUser, project)}
              onOpenProject={onOpenProject}
              onEditProject={onEditProject}
              onArchiveProject={onArchiveProject}
            />
          ))
        ) : (
          <div className="empty-state">
            <h3>No projects yet</h3>
            <p>Create a project to group related tasks and teammates.</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label="projects" />
    </section>
  )
}

function ProjectCard({
  project,
  progress,
  canManage,
  onOpenProject,
  onEditProject,
  onArchiveProject,
}) {
  return (
    <article className="project-card">
      <button type="button" className="project-open-button" onClick={() => onOpenProject(project)}>
        <p className="task-path">Manager &gt; {project.managerName}</p>
        <h3>{project.name}</h3>
        <p>{project.description || 'No description yet.'}</p>
      </button>
      <div className="project-progress">
        <span style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="project-meta-row">
        <strong>{progress.completed} of {progress.total} tasks completed</strong>
        <span>{project.status}</span>
        <span>{project.priority}</span>
      </div>
      {canManage && (
        <div className="row-actions">
          <button type="button" onClick={() => onEditProject(project)}>
            Edit
          </button>
          <button type="button" onClick={() => onArchiveProject(project.id)}>
            Archive
          </button>
        </div>
      )}
    </article>
  )
}

function TeamsPage({
  teams,
  isLoading,
  taskError,
  taskMessage,
  canManage,
  currentUser,
  onRefresh,
  onCreateTeam,
  onEditTeam,
  onArchiveTeam,
}) {
  const metrics = getTeamMetrics(teams)
  const pagination = usePaginatedRecords(teams, 6)
  const overviewCards = [
    { label: 'Teams', value: metrics.totalTeams, tone: 'blue' },
    { label: 'Members', value: metrics.totalMembers, tone: 'green' },
    { label: 'Managers', value: metrics.totalManagers, tone: 'amber' },
  ]

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Teams</p>
          <h3 className="section-title">Teams and members</h3>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button compact" onClick={onRefresh}>
            Refresh
          </button>
          {canManage && (
            <button type="button" className="primary-button compact" onClick={onCreateTeam}>
              Add team
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
          <h3>Could not load teams</h3>
          <p>{taskError}</p>
        </div>
      )}

      <div className="team-grid">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading teams</h3>
            <p>Fetching teams and members from the shared server.</p>
          </div>
        ) : teams.length ? (
          pagination.items.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              canManage={canManageOwnedRecord(currentUser, team)}
              onEditTeam={onEditTeam}
              onArchiveTeam={onArchiveTeam}
            />
          ))
        ) : (
          <div className="empty-state">
            <h3>No teams yet</h3>
            <p>Create a team to group members under a shared manager.</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label="teams" />
    </section>
  )
}

function TeamCard({ team, canManage, onEditTeam, onArchiveTeam }) {
  const previewMembers = team.members.slice(0, 4)
  const extraMembers = Math.max(team.members.length - previewMembers.length, 0)

  return (
    <article className="team-card">
      <div className="team-card-header">
        <div className="team-avatar" aria-hidden="true">
          {team.name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="task-path">Manager &gt; {team.managerName}</p>
          <h3>{team.name}</h3>
        </div>
      </div>
      <p>{team.description || 'No description yet.'}</p>
      <div className="team-member-row">
        {previewMembers.length ? (
          previewMembers.map((member) => (
            <span className="member-pill" key={member.id}>
              {member.name}
            </span>
          ))
        ) : (
          <span className="member-pill muted">No members yet</span>
        )}
        {extraMembers > 0 && <span className="member-pill muted">+{extraMembers} more</span>}
      </div>
      <div className="project-meta-row">
        <strong>{team.members.length} members</strong>
        <span>{team.managerName}</span>
      </div>
      {canManage && (
        <div className="row-actions">
          <button type="button" onClick={() => onEditTeam(team)}>
            Edit
          </button>
          <button type="button" onClick={() => onArchiveTeam(team.id)}>
            Archive
          </button>
        </div>
      )}
    </article>
  )
}

function AdminUsersPage({
  users,
  currentUser,
  isLoading,
  taskError,
  taskMessage,
  onRefresh,
  onUpdateUser,
}) {
  const activeUsers = users.filter((user) => user.isArchived !== true).length
  const managerUsers = users.filter((user) => user.role === 'manager').length
  const adminUsers = users.filter((user) => user.role === 'admin').length
  const pagination = usePaginatedRecords(users, 4)
  const overviewCards = [
    { label: 'Active users', value: activeUsers, tone: 'green' },
    { label: 'Managers', value: managerUsers, tone: 'blue' },
    { label: 'Admins', value: adminUsers, tone: 'amber' },
  ]

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h3 className="section-title">User management</h3>
        </div>
        <button type="button" className="ghost-button compact" onClick={onRefresh}>
          Refresh
        </button>
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
          <h3>Could not load users</h3>
          <p>{taskError}</p>
        </div>
      )}

      <div className="admin-user-grid">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading users</h3>
            <p>Fetching user accounts from the shared server.</p>
          </div>
        ) : users.length ? (
          pagination.items.map((person) => (
            <UserAdminCard
              key={getUserId(person)}
              person={person}
              isCurrentUser={getUserId(person) === currentUser?.id}
              onUpdateUser={onUpdateUser}
            />
          ))
        ) : (
          <div className="empty-state">
            <h3>No users found</h3>
            <p>Registered accounts will appear here.</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label="users" />
    </section>
  )
}

function ActivityLogPage({
  auditLog,
  isLoading,
  taskError,
  taskMessage,
  onRefresh,
}) {
  const records = auditLog.items || []
  const pagination = usePaginatedRecords(records, 8)
  const userActions = records.filter((item) => item.entityType === 'User').length
  const taskActions = records.filter((item) => item.entityType === 'Task').length
  const overviewCards = [
    { label: 'Audit records', value: auditLog.total || records.length, tone: 'blue' },
    { label: 'User changes', value: userActions, tone: 'amber' },
    { label: 'Task changes', value: taskActions, tone: 'green' },
  ]

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h3 className="section-title">Activity log</h3>
        </div>
        <button type="button" className="ghost-button compact" onClick={onRefresh}>
          Refresh
        </button>
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
          <h3>Could not load activity log</h3>
          <p>{taskError}</p>
        </div>
      )}

      <div className="audit-log-list">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading activity log</h3>
            <p>Fetching the latest system actions from the shared server.</p>
          </div>
        ) : records.length ? (
          pagination.items.map((record) => (
            <article className="audit-log-card" key={record.id}>
              <div>
                <p className="task-path">
                  {record.actorName} {record.actorRole ? `> ${record.actorRole}` : ''}
                </p>
                <h3>{record.actionLabel}</h3>
                <p>{record.entityType} record {record.entityId ? `#${String(record.entityId).slice(-6)}` : ''}</p>
              </div>
              <div className="project-meta-row">
                <strong>{formatDate(record.createdAt)}</strong>
                <span>{Object.keys(record.metadata || {}).length ? JSON.stringify(record.metadata) : 'No metadata'}</span>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h3>No activity recorded yet</h3>
            <p>Admin and workspace changes will appear here once users start working.</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label="audit records" />
    </section>
  )
}

function NotificationsPage({
  notifications,
  isLoading,
  taskError,
  taskMessage,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
  onDeleteNotification,
}) {
  const metrics = getNotificationMetrics(notifications)
  const pagination = usePaginatedRecords(notifications, 6)
  const overviewCards = [
    { label: 'Notifications', value: metrics.total, tone: 'blue' },
    { label: 'Unread', value: metrics.unread, tone: 'amber' },
    { label: 'Read', value: metrics.read, tone: 'green' },
  ]

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Notifications</p>
          <h3 className="section-title">Workspace alerts</h3>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button compact" onClick={onRefresh}>
            Refresh
          </button>
          <button
            type="button"
            className="primary-button compact"
            onClick={onMarkAllRead}
            disabled={!metrics.unread}
          >
            Mark all read
          </button>
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
          <h3>Could not load notifications</h3>
          <p>{taskError}</p>
        </div>
      )}

      <div className="notification-list">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading notifications</h3>
            <p>Fetching alerts from the shared server.</p>
          </div>
        ) : notifications.length ? (
          pagination.items.map((notification) => (
            <article
              className={`notification-card ${notification.isRead ? '' : 'unread'}`}
              key={notification.id}
            >
              <button
                type="button"
                className="notification-main"
                onClick={() => onMarkRead(notification.id)}
              >
                <span className="notification-dot" aria-hidden="true" />
                <span>
                  <span className="task-path">
                    {notification.entityType || notification.type} &gt; {formatNotificationDate(notification.createdAt)}
                  </span>
                  <strong>{notification.title}</strong>
                  <small>{notification.message || 'No details included.'}</small>
                </span>
              </button>
              <div className="row-actions">
                {!notification.isRead && (
                  <button type="button" onClick={() => onMarkRead(notification.id)}>
                    Mark read
                  </button>
                )}
                <button type="button" onClick={() => onDeleteNotification(notification.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h3>No notifications yet</h3>
            <p>Task updates, activity submissions, and reminders will appear here.</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label="notifications" />
    </section>
  )
}

function ArchivePage({
  archivedRecords,
  currentUser,
  isLoading,
  taskError,
  taskMessage,
  onRefresh,
  onRestore,
  onDelete,
}) {
  const [activeArchiveTab, setActiveArchiveTab] = useState('projects')
  const records = archivedRecords[activeArchiveTab] || []
  const pagination = usePaginatedRecords(records, 6)
  const archivedActivitiesCount = archivedRecords.activities?.length || 0
  const archivedTeamsCount = archivedRecords.teams?.length || 0
  const archivedUsersCount = currentUser?.role === 'admin' ? archivedRecords.users?.length || 0 : 0
  const overviewCards = [
    { label: 'Archived projects', value: archivedRecords.projects.length, tone: 'blue' },
    { label: 'Archived tasks', value: archivedRecords.tasks.length, tone: 'amber' },
    { label: 'Archived activities', value: archivedActivitiesCount, tone: 'green' },
    { label: 'Archived teams', value: archivedTeamsCount, tone: 'blue' },
    { label: 'Archived users', value: archivedUsersCount, tone: 'amber' },
    {
      label: 'Total records',
      value: archivedRecords.projects.length + archivedRecords.tasks.length + archivedActivitiesCount + archivedTeamsCount + archivedUsersCount,
      tone: 'neutral',
    },
  ]

  return (
    <section className="page-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Archive</p>
          <h3 className="section-title">Archived records</h3>
        </div>
        <button type="button" className="ghost-button compact" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <div className="summary-grid team-summary">
        {overviewCards.map((card) => (
          <article className={`metric-card metric-${card.tone}`} key={card.label}>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="archive-tabs" aria-label="Archive record type">
        {[
          ['projects', 'Projects'],
          ['tasks', 'Tasks'],
          ['activities', 'Activities'],
          ['teams', 'Teams'],
          ...(currentUser?.role === 'admin' ? [['users', 'Users']] : []),
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={activeArchiveTab === value ? 'active' : ''}
            onClick={() => setActiveArchiveTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {taskMessage && <p className="form-message">{taskMessage}</p>}
      {taskError && (
        <div className="empty-state">
          <h3>Could not load archive</h3>
          <p>{taskError}</p>
        </div>
      )}

      <div className="archive-grid">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading archive</h3>
            <p>Fetching archived projects, tasks, activities, teams, and users from the shared server.</p>
          </div>
        ) : records.length ? (
          pagination.items.map((record) => (
            <ArchiveRecordCard
              key={record.id}
              record={record}
              type={activeArchiveTab}
              onRestore={onRestore}
              onDelete={onDelete}
              currentUser={currentUser}
            />
          ))
        ) : (
          <div className="empty-state">
            <h3>No archived {activeArchiveTab}</h3>
            <p>Records you archive will stay here until you restore them.</p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} onPageChange={pagination.setPage} label={activeArchiveTab} />
    </section>
  )
}

function ArchiveRecordCard({ record, type, onRestore, onDelete, currentUser }) {
  const isProject = type === 'projects'
  const isActivity = type === 'activities'
  const isTeam = type === 'teams'
  const isUser = type === 'users'
  const recordId = isUser ? getUserId(record) : record.id
  const userName = isUser ? getUserDisplayName(record) : ''
  const permissions = getArchiveRecordPermissions(currentUser, type, record)

  return (
    <article className="archive-card">
      <div>
        <p className="task-path">
          {isProject
            ? 'Project'
            : isActivity
              ? 'Activity'
              : isTeam
                ? 'Team'
                : isUser
                  ? 'User'
                  : record.project || 'Task'} &gt; Archived
        </p>
        <h3>{isUser ? userName : isProject || isTeam ? record.name : record.title}</h3>
        <p>
          {isUser
            ? record.email || 'No email address.'
            : record.description
            || (isProject
              ? 'No project description.'
              : isActivity
                ? 'No activity description.'
                : isTeam
                  ? 'No team description.'
                  : 'No task description.')}
        </p>
      </div>
      <div className="project-meta-row">
        {isUser ? (
          <>
            <strong>{record.role || 'member'}</strong>
            <span>{record.username || 'Archived account'}</span>
          </>
        ) : isProject || isTeam ? (
          <>
            <strong>{isTeam ? `${record.members?.length || 0} members` : record.status || 'Project'}</strong>
            <span>{isTeam ? record.managerName || 'No manager' : record.priority || 'Archived'}</span>
          </>
        ) : (
          <>
            <StatusBadge value={record.status} />
            <PriorityBadge value={record.priority} />
          </>
        )}
      </div>
      {(permissions.canRestore || permissions.canDelete) && (
        <div className="row-actions">
          {permissions.canRestore && (
            <button type="button" className="primary-button compact" onClick={() => onRestore(type, recordId)}>
              Restore
            </button>
          )}
          {permissions.canDelete && (
            <button type="button" className="ghost-button compact danger-action" onClick={() => onDelete(type, recordId)}>
              Delete permanently
            </button>
          )}
        </div>
      )}
    </article>
  )
}

function UserAdminCard({ person, isCurrentUser, onUpdateUser }) {
  const userId = getUserId(person)
  const archived = person.isArchived === true
  const displayName = getUserDisplayName(person)

  return (
    <article className={`admin-user-card ${archived ? 'archived' : ''}`}>
      <div className="team-card-header">
        <UserAvatar user={person} className="team-avatar" label={displayName} />
        <div>
          <p className="task-path">{person.email || 'No email'}</p>
          <h3>{displayName}</h3>
        </div>
      </div>

      <div className="admin-user-controls">
        <label>
          Role
          <select
            value={person.role || 'member'}
            onChange={(event) => onUpdateUser(userId, { role: event.target.value })}
          >
            {['admin', 'manager', 'member'].map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ghost-button compact"
          disabled={isCurrentUser && !archived}
          onClick={() => onUpdateUser(userId, { isArchived: !archived })}
        >
          {archived ? 'Restore' : 'Archive'}
        </button>
      </div>

      <div className="project-meta-row">
        <strong>{person.role || 'member'}</strong>
        <span>{archived ? 'Archived' : 'Active'}</span>
      </div>
    </article>
  )
}

function ActivitiesPage({
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
  const pagination = usePaginatedRecords(activities, 6)
  const historyItems = getActivityHistoryItems(activities, { limit: 6 })
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

      <div className="activity-grid">
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading activities</h3>
            <p>Fetching individual activities from the shared server.</p>
          </div>
        ) : activities.length ? (
          pagination.items.map((activity) => (
            <article className="activity-card" key={activity.id}>
              <button type="button" className="project-open-button" onClick={() => onOpenActivity(activity)}>
                <p className="task-path">{activity.project} &gt; {activity.reporter || 'Reporter'}</p>
                <h3>{activity.title}</h3>
                <p>{activity.description || 'No description yet.'}</p>
              </button>
              <div className="project-meta-row">
                <strong>{formatDate(activity.dueDate)}</strong>
                <PriorityBadge value={activity.priority} />
                {activity.activityStatus && <span>{activity.activityStatus}</span>}
              </div>
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
                <span>{item.title.charAt(0).toUpperCase()}</span>
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
    </section>
  )
}

function usePaginatedRecords(records, pageSize) {
  const [page, setPage] = useState(1)
  const pagination = getPaginationState(records, page, pageSize)

  return {
    ...pagination,
    setPage,
  }
}

function PaginationControls({ pagination, onPageChange, label }) {
  if (pagination.totalPages <= 1) {
    return null
  }

  return (
    <nav className="pagination-bar" aria-label={`${label} pagination`}>
      <span>
        Page {pagination.page} of {pagination.totalPages} · {pagination.totalItems} {label}
      </span>
      <div className="row-actions">
        <button
          type="button"
          className="ghost-button compact"
          disabled={!pagination.hasPrevious}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="ghost-button compact"
          disabled={!pagination.hasNext}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  )
}

function ActivityDetailsPage({
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
    <section className="task-detail-page">
      <div className="task-detail-header panel">
        <button type="button" className="ghost-button compact" onClick={onBack}>
          Back to activities
        </button>
        <div>
          <p className="eyebrow">{activity.project}</p>
          <h3>{activity.title}</h3>
          <p>{activity.description || 'No description yet.'}</p>
        </div>
        <div className="task-detail-actions">
          {canReview && (
            <>
              <button type="button" className="ghost-button compact" onClick={() => onEditActivity(activity)}>
                Edit
              </button>
              <button type="button" className="ghost-button compact" onClick={() => onReopenActivity(activity.id)}>
                Reopen
              </button>
              <button type="button" className="ghost-button compact" onClick={() => onExportActivityResults(activity.id)}>
                Export CSV
              </button>
              <button type="button" className="ghost-button compact" onClick={() => onArchiveActivity(activity.id)}>
                Archive
              </button>
              <button type="button" className="ghost-button compact danger-action" onClick={() => onCancelActivity(activity.id)}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {taskMessage && <p className="form-message">{taskMessage}</p>}

      {assignments.length > 0 && (
        <div className="summary-grid team-summary">
          {[
            { label: 'Recipients', value: metrics.total, tone: 'blue' },
            { label: 'Submitted', value: metrics.submitted, tone: 'amber' },
            { label: 'Accepted', value: metrics.accepted, tone: 'green' },
            { label: 'Returned', value: metrics.returned, tone: 'red' },
          ].map((card) => (
            <article className={`metric-card metric-${card.tone}`} key={card.label}>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>
      )}

      <article className="panel details-panel activity-policy-panel">
        <div>
          <p className="eyebrow">Submission rules</p>
          <h4>Activity policy</h4>
          <p className="muted-copy">These rules apply to every recipient assignment for this activity.</p>
        </div>
        <dl className="activity-policy-grid">
          {policyFacts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </article>

      {canReview && (
        <article className="panel details-panel activity-recipient-panel">
          <div>
            <p className="eyebrow">Recipients</p>
            <h4>Add project members</h4>
            <p className="muted-copy">New recipients receive their own private assignment for this activity.</p>
          </div>
          <form className="activity-recipient-form" onSubmit={handleAddRecipients}>
            <select
              name="recipientIds"
              multiple
              size="4"
              value={selectedRecipientIds}
              onChange={handleRecipientSelection}
              disabled={!availableRecipients.length}
            >
              {availableRecipients.map((person) => {
                const userId = getUserId(person)
                return (
                  <option key={userId} value={userId}>
                    {getCommentAuthor(person)}
                  </option>
                )
              })}
            </select>
            <button type="submit" className="primary-button compact" disabled={!selectedRecipientIds.length}>
              Add recipients
            </button>
          </form>
          {!availableRecipients.length && (
            <p className="muted-copy">All available project members already have assignments.</p>
          )}
        </article>
      )}

      <article className="panel details-panel activity-reference-panel">
        <div className="attachment-heading compact-heading">
          <div>
            <p className="eyebrow">Reference files</p>
            <h4>Activity resources</h4>
          </div>
          {canReview && (
            <>
              <input
                ref={referenceInputRef}
                className="hidden-file-input"
                type="file"
                onChange={handleReferenceAttachmentChange}
              />
              <button
                type="button"
                className="ghost-button compact"
                onClick={() => referenceInputRef.current?.click()}
              >
                Add reference file
              </button>
            </>
          )}
        </div>

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
        ) : (
          <p className="muted-copy">No reference files attached.</p>
        )}
      </article>

      {canReview && (
        <article className="panel details-panel activity-review-tools">
          <div>
            <p className="eyebrow">Review queue</p>
            <h4>Find assignments</h4>
          </div>
          <div className="activity-reminder-row">
            <p className="muted-copy">{reminderState.detail}</p>
            <button
              type="button"
              className="ghost-button compact"
              onClick={() => onRemindActivity(activity.id)}
              disabled={!reminderState.canSend}
            >
              {reminderState.label}
            </button>
          </div>
          <div className="activity-review-controls">
            <label>
              Search recipients
              <input
                value={assignmentSearch}
                onChange={(event) => setAssignmentSearch(event.target.value)}
                placeholder="Search recipients"
              />
            </label>
            <label>
              Sort
              <select value={assignmentSort} onChange={(event) => setAssignmentSort(event.target.value)}>
                <option value="name">Name</option>
                <option value="status">Status</option>
                <option value="submitted">Submitted</option>
              </select>
            </label>
          </div>
          <div className="activity-status-filter" aria-label="Filter assignments by status">
            <button
              type="button"
              className={!assignmentStatusFilter ? 'active' : ''}
              onClick={() => setAssignmentStatusFilter('')}
            >
              All {assignments.length}
            </button>
            {assignmentStatusOptions.map((status) => {
              const count = assignments.filter((assignment) => assignment.status === status).length

              return (
                <button
                  type="button"
                  key={status}
                  className={assignmentStatusFilter === status ? 'active' : ''}
                  onClick={() => setAssignmentStatusFilter((currentStatus) => (
                    currentStatus === status ? '' : status
                  ))}
                >
                  {formatActivityStatus(status)} {count}
                </button>
              )
            })}
          </div>
        </article>
      )}

      <div className="activity-assignment-list">
        {visibleAssignments.length ? (
          visibleAssignments.map((assignment) => (
            <ActivityAssignmentCard
              key={assignment.id}
              activity={activity}
              assignment={assignment}
              canReview={canReview}
              onStartAssignment={onStartAssignment}
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
          </div>
        )}
      </div>
    </section>
  )
}

function ActivityAssignmentCard({
  activity,
  assignment,
  canReview,
  onStartAssignment,
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
  const canStart = !canReview && assignment.status === 'assigned'
  const canSubmit = !canReview && canSubmitActivityAssignment(assignment, settings)
  const canManageAttachments = canSubmit
  const canReopen = canReview && canReopenActivityAssignment(assignment)
  const attachments = assignment.attachments || []
  const recipientFacts = getActivityRecipientFacts(assignment, settings)
  const submissionHistory = getActivitySubmissionHistory(assignment)

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
      <div>
        <p className="task-path">{assignment.status}{assignment.isLate ? ' > Late' : ''}</p>
        <h3>{assignment.recipientName}</h3>
        <p>{assignment.textResponse || 'No response yet.'}</p>
      </div>
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
      {canStart && (
        <div className="activity-assignment-actions start-action">
          <button type="button" className="primary-button compact" onClick={() => onStartAssignment(assignment.id)}>
            Start activity
          </button>
        </div>
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
          <button type="submit" className="primary-button compact">Review</button>
        </form>
      )}

      {canReview && (canReopen || assignment.recipientId) && (
        <div className="activity-assignment-actions">
          {canReopen && (
            <button type="button" className="ghost-button compact" onClick={onReopenAssignment}>
              Reopen
            </button>
          )}
          {assignment.recipientId && (
            <button type="button" className="ghost-button compact danger-action" onClick={onRemoveRecipient}>
              Remove recipient
            </button>
          )}
        </div>
      )}
    </article>
  )
}

function ProjectDetailsPage({
  project,
  tasks,
  taskMessage,
  canManage,
  onBack,
  onOpenTask,
  onStatusChange,
  onEditProject,
  onArchiveProject,
}) {
  const progress = getProjectProgress(project.id, tasks)
  const statusBuckets = getProjectStatusBuckets(tasks)

  return (
    <section className="project-detail-page">
      <div className="task-detail-header panel">
        <button type="button" className="ghost-button compact" onClick={onBack}>
          Back to projects
        </button>
        <div>
          <p className="eyebrow">Project</p>
          <h3>{project.name}</h3>
          <p>{project.description || 'No description yet.'}</p>
        </div>
        {canManage && (
          <div className="task-detail-actions">
            <button type="button" className="ghost-button compact" onClick={() => onEditProject(project)}>
              Edit
            </button>
            <button type="button" className="ghost-button compact" onClick={() => onArchiveProject(project.id)}>
              Archive
            </button>
          </div>
        )}
      </div>

      {taskMessage && <p className="form-message">{taskMessage}</p>}

      <div className="project-overview-grid">
        <article className="panel details-panel">
          <p className="eyebrow">Overview</p>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{project.status}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{project.priority}</dd>
            </div>
            <div>
              <dt>Manager</dt>
              <dd>{project.managerName}</dd>
            </div>
            <div>
              <dt>Members</dt>
              <dd>{project.members.length ? project.members.map((member) => member.name).join(', ') : 'No members yet'}</dd>
            </div>
          </dl>
        </article>
        <article className="panel details-panel">
          <p className="eyebrow">Progress</p>
          <strong className="project-percent">{progress.percent}%</strong>
          <div className="project-progress large">
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="muted-copy">{progress.completed} of {progress.total} tasks completed</p>
        </article>
      </div>

      <div className="project-status-summary" aria-label="Project task status summary">
        {statusBuckets.map((bucket) => (
          <article className="project-status-card" key={`summary-${bucket.status}`}>
            <span>{bucket.status}</span>
            <strong>{bucket.tasks.length}</strong>
          </article>
        ))}
      </div>

      <div className="kanban-board project-kanban-board">
        {statusBuckets.map((bucket) => (
          <section className="kanban-column project-kanban-column" key={bucket.status}>
            <div className="kanban-heading">
              <strong>{bucket.status}</strong>
              <span>{bucket.tasks.length}</span>
            </div>
            <div className="kanban-list">
              {bucket.tasks.length ? (
                bucket.tasks.map((task) => (
                  <article className="kanban-card project-kanban-card" key={`project-task-${task.id}`}>
                    <button type="button" className="kanban-open-button" onClick={() => onOpenTask(task)}>
                      <span className="task-path">{task.owner || 'Unassigned'}</span>
                      <h4>{task.title}</h4>
                      <p>{task.description || 'No task description yet.'}</p>
                    </button>
                    <div className="project-kanban-meta">
                      <span>{formatDate(task.dueDate)}</span>
                      <StatusBadge value={task.status} />
                      <PriorityBadge value={task.priority} />
                    </div>
                    {onStatusChange ? (
                      <select value={task.status} onChange={(event) => onStatusChange(task, event.target.value)}>
                        {STATUSES.map((nextStatus) => (
                          <option key={nextStatus}>{nextStatus}</option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge value={task.status} />
                    )}
                  </article>
                ))
              ) : (
                <div className="project-kanban-empty">
                  <p>No {bucket.status.toLowerCase()} tasks.</p>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

function TaskCard({ task, currentUser, onOpenTask, onEditTask, onDeleteTask }) {
  const permissions = getTaskPermissions(currentUser, task)

  return (
    <article className="task-card">
      <span className="check-dot" aria-hidden="true" />
      <button type="button" className="task-open-button" onClick={() => onOpenTask?.(task)}>
        <div className="task-content">
          <p className="task-path">{task.project} &gt; {task.owner}</p>
          <h3>{task.title}</h3>
          <p>{task.description}</p>
        </div>
      </button>
      <div className="task-meta">
        <span>{formatDate(task.dueDate)}</span>
        <StatusBadge value={task.status} />
        <PriorityBadge value={task.priority} />
      </div>
      {(permissions.canManage || permissions.canDelete) && (
        <div className="row-actions">
          {permissions.canManage && onEditTask && (
            <button type="button" onClick={() => onEditTask(task)}>
              Edit
            </button>
          )}
          {permissions.canDelete && onDeleteTask && (
            <button type="button" onClick={() => onDeleteTask(task.id)}>
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  )
}

function TaskDetailsPage({
  task,
  currentUser,
  permissions,
  comments,
  commentText,
  editingComment,
  taskMessage,
  onBack,
  onCommentTextChange,
  onAddComment,
  onStartEditComment,
  onCancelEditComment,
  onUpdateComment,
  onDeleteComment,
  onStatusChange,
  onToggleSubtask,
  onUploadAttachment,
  onDeleteAttachment,
  onOpenProgress,
  onEditTask,
  onArchiveTask,
  onDeleteTask,
}) {
  const attachmentInputRef = useRef(null)
  const detailFacts = getTaskDetailFacts(task)
  const dependencies = task.dependencies || []
  const subtasks = task.subtasks || []
  const completedSubtasks = subtasks.filter((subtask) => subtask.completed).length
  const subtaskProgress = subtasks.length ? Math.round((completedSubtasks / subtasks.length) * 100) : 0
  const assigneeName = task.owner || 'Unassigned'
  const assigneeInitials = assigneeName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'NA'

  function handleAttachmentChange(event) {
    const file = event.target.files?.[0]
    if (file) {
      onUploadAttachment(file)
    }
    event.target.value = ''
  }

  return (
    <section className="task-detail-page task-work-detail">
      <header className="task-work-hero">
        <button type="button" className="task-work-back" onClick={onBack}>Back to tasks</button>
        <div className="task-work-hero-grid">
          <div className="task-work-hero-copy">
            <p className="eyebrow">{task.project}</p>
            <h2>{task.title}</h2>
            <p className="task-work-summary">{task.description || 'No description has been added to this task.'}</p>
            <div className="task-work-badges">
              <StatusBadge value={task.status} />
              <PriorityBadge value={task.priority} />
              <span className="task-work-date">Due {formatDate(task.dueDate)}</span>
            </div>
          </div>
          <div className="task-work-assignee">
            <span>Assigned to</span>
            <div>
              <strong className="task-work-avatar">{assigneeInitials}</strong>
              <div>
                <b>{assigneeName}</b>
                <small>{permissions.isAssignee ? 'You are responsible for this task' : 'Responsible assignee'}</small>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="task-work-toolbar">
        <div className="task-work-status-control">
          <span>Status</span>
          {permissions.canManage ? (
            <select value={task.status} onChange={(event) => onStatusChange(event.target.value)}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          ) : (
            <StatusBadge value={task.status} />
          )}
        </div>
        <div className="task-work-actions">
          {permissions.canManage && (
            <>
              <button type="button" className="ghost-button compact" onClick={() => onEditTask(task)}>Edit task</button>
              <button type="button" className="ghost-button compact" onClick={() => onArchiveTask(task.id)}>Archive</button>
              {permissions.canDelete && onDeleteTask && (
                <button type="button" className="ghost-button compact danger-action" onClick={() => onDeleteTask(task.id)}>Delete</button>
              )}
            </>
          )}
          {permissions.canUpdateProgress && (
            <button type="button" className="primary-button compact" onClick={() => onOpenProgress(task)}>Update progress</button>
          )}
          {!permissions.canManage && !permissions.canUpdateProgress && (
            <span className="task-read-only-badge">View only</span>
          )}
        </div>
      </div>

      {taskMessage && <p className="form-message task-work-message">{taskMessage}</p>}

      <div className="task-work-layout">
        <div className="task-work-main">
          {dependencies.length > 0 && (
            <article className="panel task-work-card task-work-dependencies">
              <div className="task-work-section-heading">
                <div><p className="eyebrow">Dependencies</p><h3>Blocked by</h3></div>
                <span>{dependencies.length}</span>
              </div>
              <div className="dependency-list">
                {dependencies.map((dependency) => (
                  <div className="dependency-row" key={dependency.id}>
                    <span className={dependency.status === 'completed' ? 'dependency-done' : 'dependency-open'} />
                    <div><strong>{dependency.title}</strong><p>{dependency.status || 'todo'}</p></div>
                  </div>
                ))}
              </div>
            </article>
          )}

          <article className="panel task-work-card task-work-subtasks">
            <div className="task-work-section-heading">
              <div><p className="eyebrow">Subtasks</p><h3>Break down the work</h3></div>
              <span>{completedSubtasks}/{subtasks.length}</span>
            </div>
            <div className="task-work-progress" aria-label={`${subtaskProgress}% of subtasks complete`}>
              <span style={{ width: `${subtaskProgress}%` }} />
            </div>
            {subtasks.length ? (
              <div className="subtask-list task-work-subtask-list">
                {subtasks.map((subtask, index) => (
                  <div key={`${subtask.title}-${index}`} className={`subtask-row ${subtask.completed ? 'is-complete' : ''}`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(subtask.completed)}
                        disabled={!permissions.canCompleteSubtasks}
                        onChange={() => onToggleSubtask(index)}
                      />
                      <span>{subtask.title}</span>
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-copy">No subtasks have been added.</p>
            )}
          </article>

          <article className="panel task-work-card task-work-comments">
            <div className="task-work-section-heading">
              <div><p className="eyebrow">Team discussion</p><h3>Updates and comments</h3></div>
              <span>{comments.length}</span>
            </div>
            <div className="comment-list task-work-comment-list">
              {comments.length ? comments.map((comment) => {
                const commentId = comment._id || comment.id
                const isEditing = editingComment?.id === commentId
                const commentPermissions = getTaskCommentPermissions(currentUser, comment)
                const authorName = comment.author ? getCommentAuthor(comment.author) : 'Team member'

                return (
                  <div className="comment-row task-work-comment" key={commentId}>
                    <span className="task-work-comment-avatar">{authorName.charAt(0).toUpperCase()}</span>
                    <div className="task-work-comment-body">
                      <div className="comment-row-header">
                        <div>
                          <strong>{authorName}</strong>
                          <span>{formatNotificationDate(comment.updatedAt || comment.createdAt)}</span>
                        </div>
                        {(commentPermissions.canEdit || commentPermissions.canDelete) && (
                          <div className="row-actions">
                            {commentPermissions.canEdit && <button type="button" className="ghost-button compact" onClick={() => onStartEditComment(comment)}>Edit</button>}
                            {commentPermissions.canDelete && <button type="button" className="ghost-button compact danger-action" onClick={() => onDeleteComment(commentId)}>Delete</button>}
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <form className="comment-edit-form" onSubmit={(event) => {
                          event.preventDefault()
                          const formData = new FormData(event.currentTarget)
                          onUpdateComment(commentId, String(formData.get('body') || ''))
                        }}>
                          <input key={commentId} name="body" defaultValue={editingComment?.body || ''} placeholder="Edit comment" />
                          <button type="submit" className="primary-button compact">Save</button>
                          <button type="button" className="ghost-button compact" onClick={onCancelEditComment}>Cancel</button>
                        </form>
                      ) : <p>{comment.body}</p>}
                    </div>
                  </div>
                )
              }) : <p className="muted-copy">No comments yet. Start the conversation below.</p>}
            </div>
            <form className="task-work-comment-form" onSubmit={onAddComment}>
              <textarea value={commentText} onChange={(event) => onCommentTextChange(event.target.value)} placeholder="Write an update for everyone on this task" rows="3" />
              <div><span>Visible to everyone with access</span><button type="submit" className="primary-button compact">Send comment</button></div>
            </form>
          </article>
        </div>

        <aside className="task-work-side">
          <article className="panel task-work-card task-work-information">
            <div className="task-work-section-heading"><div><p className="eyebrow">Details</p><h3>Task information</h3></div></div>
            <dl>
              <div><dt>Status</dt><dd><StatusBadge value={task.status} /></dd></div>
              <div><dt>Priority</dt><dd><PriorityBadge value={task.priority} /></dd></div>
              <div><dt>Deadline</dt><dd>{formatDate(task.dueDate)}</dd></div>
              <div><dt>Project</dt><dd>{task.project}</dd></div>
              <div><dt>Assignee</dt><dd>{assigneeName}</dd></div>
              <div><dt>Reporter</dt><dd>{task.reporter || 'Not recorded'}</dd></div>
              {detailFacts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
            </dl>
          </article>

          <article className="panel task-work-card task-work-attachments">
            <div className="attachment-heading">
              <div><p className="eyebrow">Attachments</p><h3>Supporting files</h3></div>
              <input ref={attachmentInputRef} className="hidden-file-input" type="file" onChange={handleAttachmentChange} />
              {permissions.canManageAttachments && (
                <button type="button" className="ghost-button compact" onClick={() => attachmentInputRef.current?.click()}>Upload file</button>
              )}
            </div>
            {task.attachments.length ? (
              <div className="attachment-list">
                {task.attachments.map((attachment) => {
                  const attachmentDisplay = getTaskAttachmentDisplay(attachment, API_BASE_URL)
                  return (
                    <div className="attachment-row task-attachment-row" key={attachmentDisplay.id || attachmentDisplay.url || attachmentDisplay.name}>
                      <div className="attachment-file-summary">
                        <span className="attachment-type-pill">{attachmentDisplay.typeLabel}</span>
                        <div><strong>{attachmentDisplay.name}</strong><span>{attachmentDisplay.sizeLabel}</span></div>
                      </div>
                      <div className="row-actions attachment-actions">
                        <a className={`ghost-button compact ${attachmentDisplay.canOpen ? '' : 'is-disabled'}`} href={attachmentDisplay.url || undefined} target="_blank" rel="noreferrer" aria-disabled={!attachmentDisplay.canOpen}>Open</a>
                        <a className={`ghost-button compact ${attachmentDisplay.canOpen ? '' : 'is-disabled'}`} href={attachmentDisplay.url || undefined} download={attachmentDisplay.name} aria-disabled={!attachmentDisplay.canOpen}>Download</a>
                        {permissions.canManageAttachments && (
                          <button type="button" className="ghost-button compact danger-action" onClick={() => onDeleteAttachment(attachmentDisplay.id)} disabled={!attachmentDisplay.canRemove}>Remove</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <p className="muted-copy">No files attached.</p>}
            {permissions.canManageAttachments && (
              <button type="button" className="task-work-upload-zone" onClick={() => attachmentInputRef.current?.click()}>Choose a file to upload</button>
            )}
            {!permissions.canManageAttachments && <p className="task-work-readonly-note">Attachments are read-only for your role on this task.</p>}
          </article>
        </aside>
      </div>
    </section>
  )
}

function TaskQueuePanel({ tasks, onOpenTask, onCreateTask }) {
  const queueGroups = getTaskQueueGroups(tasks, { limit: 48 })
  const queueCount = queueGroups.reduce((total, group) => total + group.tasks.length, 0)

  return (
    <aside className="suggestions-panel task-queue-panel" aria-label="Task queue">
      <div className="suggestions-heading">
        <div>
          <span className="suggestions-icon" aria-hidden="true">≋</span>
          <h3>Task queue</h3>
          <span className="task-queue-count">{queueCount}</span>
        </div>
        {onCreateTask && (
          <div className="suggestions-actions">
            <button type="button" aria-label="Add task from queue" onClick={onCreateTask}>+</button>
          </div>
        )}
      </div>
      {queueGroups.length ? (
        <div className="task-queue-list">
          {queueGroups.map((group, groupIndex) => (
            <section
              className="task-queue-group"
              key={`queue-${group.dateKey}`}
              style={{ '--queue-group-index': groupIndex }}
            >
              <div className="task-queue-date">
                <span>{group.label}</span>
                {group.note && <small>{group.note}</small>}
              </div>
              <div className="task-queue-stack">
                {group.tasks.map((task, taskIndex) => (
                  <button
                    type="button"
                    className={`task-queue-card priority-${String(task.priority || 'medium').toLowerCase()}`}
                    key={`queue-task-${task.id}`}
                    style={{ '--queue-item-index': taskIndex }}
                    onClick={() => onOpenTask(task)}
                  >
                    <span className="task-queue-time">{task.isOverdue ? 'Overdue' : task.queueTimeLabel}</span>
                    <strong>{task.title}</strong>
                    <span className="task-queue-context">{task.project || 'Workspace'} · {task.owner || 'Unassigned'}</span>
                    <span className="task-queue-badges">
                      <PriorityBadge value={task.priority} />
                      <StatusBadge value={task.status} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-state task-queue-empty">
          <h3>No queued tasks</h3>
          <p>{onCreateTask ? 'Create a dated task and it will appear here.' : 'Assigned dated tasks will appear here.'}</p>
          {onCreateTask && <button type="button" className="ghost-button" onClick={onCreateTask}>Add task</button>}
        </div>
      )}
    </aside>
  )
}

function ProfilePage({
  user,
  tasks,
  profileMessage,
  validation,
  onSaveChanges,
  onChangeEmail,
  onChangePassword,
  onClearFeedback,
  onLogout,
  onLogoutAllDevices,
  onDeleteAccount,
}) {
  const fileInputRef = useRef(null)
  const [avatarValue, setAvatarValue] = useState(user.avatarUrl || '')
  const [avatarPreview, setAvatarPreview] = useState(user.avatarUrl || defaultProfileImage)
  const [avatarError, setAvatarError] = useState('')
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [emailValue, setEmailValue] = useState(user.email || '')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordValues, setPasswordValues] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const ownedTasks = tasks.filter((task) => task.owner.toLowerCase().includes(user.firstName.toLowerCase()))

  function changeProfileImage(event) {
    const file = event.target.files?.[0]
    const errors = validateProfileImageFile(file)

    if (errors.avatarImage) {
      setAvatarError(errors.avatarImage)
      event.target.value = ''
      return
    }

    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const nextAvatar = String(reader.result || '')
      setAvatarValue(nextAvatar)
      setAvatarPreview(nextAvatar || defaultProfileImage)
      setAvatarError('')
    }
    reader.onerror = () => {
      setAvatarError('Could not read that image. Try another file.')
    }
    reader.readAsDataURL(file)
  }

  function removeProfileImage() {
    setAvatarValue('')
    setAvatarPreview(defaultProfileImage)
    setAvatarError('')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function beginPasswordChange() {
    onClearFeedback()
    setIsChangingPassword(true)
  }

  function beginEmailChange() {
    onClearFeedback()
    setEmailValue(user.email || '')
    setIsChangingEmail(true)
  }

  async function confirmEmailChange() {
    const didChange = await onChangeEmail({ email: emailValue })

    if (didChange) {
      setIsChangingEmail(false)
    }
  }

  function cancelEmailChange() {
    onClearFeedback()
    setEmailValue(user.email || '')
    setIsChangingEmail(false)
  }

  function updatePasswordValue(event) {
    setPasswordValues((currentValues) => ({
      ...currentValues,
      [event.target.name]: event.target.value,
    }))
  }

  async function confirmPasswordChange() {
    const didChange = await onChangePassword(passwordValues)

    if (didChange) {
      setPasswordValues({
        newPassword: '',
        confirmPassword: '',
      })
      setIsChangingPassword(false)
    }
  }

  function cancelPasswordChange() {
    onClearFeedback()
    setPasswordValues({
      newPassword: '',
      confirmPassword: '',
    })
    setIsChangingPassword(false)
  }

  return (
    <section className="profile-settings-page">
      <form className="panel profile-settings-surface" onSubmit={onSaveChanges} noValidate>
        <section className="profile-settings-section">
          <h3>My Profile</h3>
          <div className="profile-image-row">
            <div className="avatar profile-image-preview" aria-hidden="true">
              <img src={avatarPreview} alt="" />
            </div>
            <div className="profile-image-actions">
              <div className="profile-image-buttons">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif"
                  className="visually-hidden"
                  onChange={changeProfileImage}
                />
                <input type="hidden" name="avatarUrl" value={avatarValue} />
                <button type="button" className="primary-button compact" onClick={() => fileInputRef.current?.click()}>
                  Change image
                </button>
                <button type="button" className="ghost-button compact" onClick={removeProfileImage}>
                  Remove image
                </button>
              </div>
              <small>We support PNGs, JPEGs and GIFs under 2MB.</small>
              {avatarError && <small className="field-error">{avatarError}</small>}
              {validation.avatarUrl && <small className="field-error">{validation.avatarUrl}</small>}
            </div>
          </div>

          <div className="profile-settings-group profile-name-grid">
            <label>
              First name
              <input
                name="firstName"
                defaultValue={user.firstName}
                maxLength="40"
                aria-invalid={Boolean(validation.firstName)}
                aria-describedby={validation.firstName ? 'profile-first-name-error' : undefined}
              />
              {validation.firstName && (
                <small className="field-error" id="profile-first-name-error">{validation.firstName}</small>
              )}
            </label>
            <label>
              Last name
              <input
                name="lastName"
                defaultValue={user.lastName}
                maxLength="40"
                aria-invalid={Boolean(validation.lastName)}
                aria-describedby={validation.lastName ? 'profile-last-name-error' : undefined}
              />
              {validation.lastName && (
                <small className="field-error" id="profile-last-name-error">{validation.lastName}</small>
              )}
            </label>
            <label>
              Username
              <input
                name="username"
                defaultValue={user.username}
                minLength="3"
                maxLength="20"
                pattern="[A-Za-z0-9_.]+"
                aria-invalid={Boolean(validation.username)}
                aria-describedby={validation.username ? 'profile-username-error' : undefined}
              />
              {validation.username && (
                <small className="field-error" id="profile-username-error">{validation.username}</small>
              )}
            </label>
            <label>
              Phone
              <input
                name="phone"
                defaultValue={user.phone}
                inputMode="numeric"
                minLength="7"
                maxLength="15"
                pattern="[0-9]+"
                aria-invalid={Boolean(validation.phone)}
                aria-describedby={validation.phone ? 'profile-phone-error' : undefined}
              />
              {validation.phone && (
                <small className="field-error" id="profile-phone-error">{validation.phone}</small>
              )}
            </label>
          </div>
        </section>

        <section className="profile-settings-section">
          <h3>Account Security</h3>
          <div className="security-list">
            <div className="security-row security-field-row">
              <div>
                <strong>Email</strong>
                <input value={user.email || 'Not provided'} disabled readOnly />
              </div>
              {isChangingEmail ? (
                <div className="email-inline-editor">
                  <label>
                    New email
                    <input
                      name="email"
                      type="email"
                      value={emailValue}
                      autoComplete="email"
                      maxLength="34"
                      onChange={(event) => setEmailValue(event.target.value)}
                      aria-invalid={Boolean(validation.email)}
                      aria-describedby={validation.email ? 'profile-email-error' : undefined}
                    />
                    {validation.email && (
                      <small className="field-error" id="profile-email-error">{validation.email}</small>
                    )}
                  </label>
                  <button type="button" className="primary-button compact" onClick={confirmEmailChange}>
                    Confirm
                  </button>
                  <button type="button" className="ghost-button compact" onClick={cancelEmailChange}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className="ghost-button compact" onClick={beginEmailChange}>
                  Change email
                </button>
              )}
            </div>
            <div className={`security-row security-field-row password-security-row${isChangingPassword ? ' is-editing' : ''}`}>
              <div>
                <strong>Password</strong>
                <input value="••••••••••" disabled readOnly />
              </div>
              {isChangingPassword ? (
                <div className="password-inline-editor">
                  <label>
                    New password
                    <input
                      name="newPassword"
                      type="password"
                      value={passwordValues.newPassword}
                      autoComplete="new-password"
                      minLength="8"
                      maxLength="24"
                      onChange={updatePasswordValue}
                      aria-invalid={Boolean(validation.newPassword)}
                      aria-describedby={validation.newPassword ? 'profile-new-password-error' : undefined}
                    />
                    {validation.newPassword && (
                      <small className="field-error" id="profile-new-password-error">{validation.newPassword}</small>
                    )}
                  </label>
                  <label>
                    Confirm password
                    <input
                      name="confirmPassword"
                      type="password"
                      value={passwordValues.confirmPassword}
                      autoComplete="new-password"
                      minLength="8"
                      maxLength="24"
                      onChange={updatePasswordValue}
                      aria-invalid={Boolean(validation.confirmPassword)}
                      aria-describedby={validation.confirmPassword ? 'profile-confirm-password-error' : undefined}
                    />
                    {validation.confirmPassword && (
                      <small className="field-error" id="profile-confirm-password-error">{validation.confirmPassword}</small>
                    )}
                  </label>
                  <div className="password-inline-actions">
                    <button type="button" className="primary-button compact" onClick={confirmPasswordChange}>
                      Confirm
                    </button>
                    <button type="button" className="ghost-button compact" onClick={cancelPasswordChange}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="ghost-button compact" onClick={beginPasswordChange}>
                  Change password
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="profile-settings-section">
          <h3>Account Access</h3>
          <div className="security-list">
            <div className="security-row">
              <div>
                <strong>Log out of this device</strong>
                <p>Clear this browser session only.</p>
              </div>
              <button type="button" className="ghost-button compact" onClick={onLogout}>
                Log out
              </button>
            </div>
            <div className="security-row">
              <div>
                <strong>Log out of all devices</strong>
                <p>Invalidates active web and mobile tokens after their next server request.</p>
              </div>
              <button type="button" className="ghost-button compact" onClick={onLogoutAllDevices}>
                Log out all
              </button>
            </div>
            <div className="security-row danger-row">
              <div>
                <strong>Delete my account</strong>
                <p>Archive this account and remove access from all devices.</p>
              </div>
              <button type="button" className="ghost-button compact" onClick={onDeleteAccount}>
                Delete account
              </button>
            </div>
          </div>
        </section>

        <section className="profile-settings-section profile-summary-strip">
          <div>
            <strong>{ownedTasks.length}</strong>
            <span>Assigned tasks</span>
          </div>
          <div>
            <strong>{user.role || 'member'}</strong>
            <span>Role</span>
          </div>
        </section>

        {profileMessage && <p className="form-message profile-message">{profileMessage}</p>}

        <div className="profile-save-row">
          <button type="submit" className="primary-button compact">
            Save changes
          </button>
        </div>
      </form>
    </section>
  )
}

function TaskProgressModal({ values, isSaving, taskMessage, onClose, onSave }) {
  const [status, setStatus] = useState(values.status)
  const [progress, setProgress] = useState(values.progress)
  const [subtasks, setSubtasks] = useState(values.subtasks)
  const [subtaskTitle, setSubtaskTitle] = useState('')

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isSaving, onClose])

  function addSubtask(event) {
    event.preventDefault()
    const title = subtaskTitle.trim()
    if (!title) return
    setSubtasks((current) => [...current, { title, completed: false }])
    setSubtaskTitle('')
  }

  return (
    <div className="task-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isSaving && onClose()}>
      <section className="task-progress-modal" role="dialog" aria-modal="true" aria-labelledby="task-progress-title">
        <header className="task-progress-header">
          <div>
            <p className="eyebrow">Task progress</p>
            <h3 id="task-progress-title">Update progress</h3>
            <p>{values.title}</p>
          </div>
          <button type="button" className="task-modal-close" aria-label="Close progress editor" onClick={onClose} disabled={isSaving}>×</button>
        </header>

        <form
          className="task-progress-form"
          onSubmit={(event) => {
            event.preventDefault()
            onSave({ taskId: values.taskId, status, progress, subtasks })
          }}
        >
          <label>
            <span className="task-field-label">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUSES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <label>
            <span className="task-progress-label"><span className="task-field-label">Completion</span><strong>{progress}%</strong></span>
            <input type="range" min="0" max="100" step="5" value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
          </label>

          <div className="task-progress-subtasks">
            <span className="task-field-label">Subtasks</span>
            {subtasks.length ? subtasks.map((subtask, index) => (
              <div className="task-progress-subtask" key={`${subtask.title}-${index}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(subtask.completed)}
                    onChange={() => setSubtasks((current) => toggleSubtaskInList(current, index))}
                  />
                  <span>{subtask.title}</span>
                </label>
                <button type="button" className="ghost-button compact" onClick={() => setSubtasks((current) => removeSubtaskFromList(current, index))}>Remove</button>
              </div>
            )) : <p className="muted-copy">No subtasks yet.</p>}
            <div className="task-progress-add-row">
              <input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="Add a subtask" />
              <button type="button" className="ghost-button compact" onClick={addSubtask}>Add</button>
            </div>
          </div>

          {taskMessage && <p className="form-message">{taskMessage}</p>}

          <footer className="task-progress-footer">
            <button type="button" className="ghost-button" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save progress'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function TaskPeoplePicker({ label, name, people, selectedIds, onChange, placeholder, emptyMessage = 'No people available.' }) {
  const selectedPeople = people.filter((person) => selectedIds.includes(getUserId(person)))

  function togglePerson(personId) {
    onChange(selectedIds.includes(personId)
      ? selectedIds.filter((id) => id !== personId)
      : [...selectedIds, personId])
  }

  return (
    <div className="task-people-field">
      <span className="task-field-label">{label}</span>
      {selectedIds.map((id) => <input key={id} type="hidden" name={name} value={id} />)}
      <details className="task-people-picker">
        <summary>
          <span className="task-field-icon people" aria-hidden="true" />
          <span>{selectedPeople.length ? `${selectedPeople.length} ${selectedPeople.length === 1 ? 'person' : 'people'} selected` : placeholder}</span>
          <span className="task-picker-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="task-people-menu">
          {people.length ? people.map((person) => {
            const personId = getUserId(person)
            const selected = selectedIds.includes(personId)
            return (
              <button key={personId} type="button" className={selected ? 'selected' : ''} onClick={() => togglePerson(personId)}>
                <span className="task-person-avatar">{getInitials(person)}</span>
                <span>{getCommentAuthor(person)}</span>
                <span className="task-person-check" aria-hidden="true">{selected ? '✓' : ''}</span>
              </button>
            )
          }) : <p>{emptyMessage}</p>}
        </div>
      </details>
      {selectedPeople.length > 0 && (
        <div className="task-person-chips">
          {selectedPeople.map((person) => (
            <button key={getUserId(person)} type="button" onClick={() => togglePerson(getUserId(person))}>
              <span>{getInitials(person)}</span>
              {getCommentAuthor(person)}
              <b aria-hidden="true">×</b>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TaskDependencyPicker({ tasks, selectedIds, onChange, emptyMessage }) {
  const selectedTasks = tasks.filter((task) => selectedIds.includes(task.id))

  function toggleTask(taskId) {
    onChange(selectedIds.includes(taskId)
      ? selectedIds.filter((id) => id !== taskId)
      : [...selectedIds, taskId])
  }

  return (
    <div className="task-dependency-field">
      <span className="task-field-label">Dependencies</span>
      {selectedIds.map((id) => <input key={id} type="hidden" name="dependencyIds" value={id} />)}
      <details className="task-dependency-picker">
        <summary>
          <span>{selectedTasks.length ? `${selectedTasks.length} prerequisite ${selectedTasks.length === 1 ? 'task' : 'tasks'} selected` : 'Select prerequisite tasks'}</span>
          <span className="task-picker-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="task-people-menu">
          {tasks.length ? tasks.map((task) => {
            const selected = selectedIds.includes(task.id)
            return (
              <button key={task.id} type="button" className={selected ? 'selected' : ''} onClick={() => toggleTask(task.id)}>
                <span className="task-dependency-dot" aria-hidden="true" />
                <span>{task.title}</span>
                <span className="task-person-check" aria-hidden="true">{selected ? '✓' : ''}</span>
              </button>
            )
          }) : <p>{emptyMessage}</p>}
        </div>
      </details>
      {selectedTasks.length > 0 && (
        <div className="task-dependency-chips">
          {selectedTasks.map((task) => (
            <button key={task.id} type="button" onClick={() => toggleTask(task.id)}>{task.title}<b aria-hidden="true">×</b></button>
          ))}
        </div>
      )}
    </div>
  )
}

function TaskModal({ formState, onClose, onSubmit, projects, users, tasks, isSaving, taskMessage }) {
  const values = formState.values
  const isEditing = formState.mode === 'edit'
  const [projectId, setProjectId] = useState(values.projectId || '')
  const [assigneeId, setAssigneeId] = useState(values.assigneeId || '')
  const [collaboratorIds, setCollaboratorIds] = useState(values.collaboratorIds || [])
  const [watcherIds, setWatcherIds] = useState(values.watcherIds || [])
  const [dependencyIds, setDependencyIds] = useState(values.dependencyIds || [])
  const [description, setDescription] = useState(values.description || '')
  const [recurrenceFrequency, setRecurrenceFrequency] = useState(values.recurrenceFrequency || 'none')
  const [recurrenceInterval, setRecurrenceInterval] = useState(values.recurrenceInterval || 1)
  const [recurrenceCount, setRecurrenceCount] = useState(values.recurrenceCount || 1)
  const dependencyOptions = tasks.filter((task) => task.id !== values.id && task.type !== 'individual-activity' && task.projectId === projectId)
  const selectedProject = projects.find((project) => project.id === projectId)
  const allowedIds = new Set([selectedProject?.managerId, ...(selectedProject?.memberIds || [])].filter(Boolean))
  const projectPeople = users.filter((person) => allowedIds.has(getUserId(person)))
  const selectedAssignee = users.find((person) => getUserId(person) === assigneeId)

  function chooseProject(nextProjectId) {
    const nextProject = projects.find((project) => project.id === nextProjectId)
    setProjectId(nextProjectId)
    setAssigneeId(nextProject?.managerId || nextProject?.memberIds?.[0] || '')
    setCollaboratorIds([])
    setWatcherIds([])
    setDependencyIds([])
  }

  return (
    <div className="app-modal-backdrop task-modal-backdrop" role="presentation">
      <section className="app-modal task-modal" role="dialog" aria-modal="true" aria-labelledby="task-form-title">
        <header className="task-modal-header">
          <div>
            <p className="eyebrow">{isEditing ? 'Update task' : 'New task'}</p>
            <h3 id="task-form-title">{isEditing ? 'Edit task' : 'Create a task'}</h3>
            <p>Capture the details now. You can always refine them later.</p>
          </div>
          <button type="button" className="task-modal-close" onClick={onClose} aria-label="Close task form">×</button>
        </header>

        <form
          className="task-create-form"
          onSubmit={onSubmit}
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key === 'Enter') event.currentTarget.requestSubmit()
          }}
        >
          <div className="task-form-scroll">
            <div className="task-form-main">
              <label>
                <span className="task-field-label">Task title <small>Required</small></span>
                <input name="title" defaultValue={values.title} maxLength="120" placeholder="Review final onboarding screens" required autoFocus />
              </label>
              <label>
                <span className="task-label-row"><span className="task-field-label">Description</span><small>{description.length} / 1,000</small></span>
                <textarea name="description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength="1000" rows="4" placeholder="Add context, links, or acceptance criteria..." required />
              </label>
              <div className="task-inline-fields">
                <label>
                  <span className="task-field-label">Status</span>
                  <select name="status" defaultValue={values.status}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
                </label>
                <label>
                  <span className="task-field-label">Priority</span>
                  <select name="priority" defaultValue={values.priority}>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select>
                </label>
              </div>
              <label>
                <span className="task-field-label">Tags <small>Optional</small></span>
                <span className="task-input-with-icon"><span className="task-field-icon tag" aria-hidden="true">◇</span><input name="tags" defaultValue={values.tags} placeholder="Add tags separated by commas" /></span>
              </label>

              <TaskPeoplePicker label="Collaborators" name="collaboratorIds" people={projectPeople} selectedIds={collaboratorIds} onChange={setCollaboratorIds} placeholder="Add people who will work on this task" />
              <TaskPeoplePicker label="Watchers" name="watcherIds" people={projectPeople} selectedIds={watcherIds} onChange={setWatcherIds} placeholder="Notify people about updates" />

              <details className="task-advanced-options">
                <summary>Advanced options <span className="task-advanced-action" aria-hidden="true" /></summary>
                <div className="task-advanced-content">
                <div className="task-advanced-grid">
                  <label>
                    <span className="task-field-label">Category</span>
                    <input name="category" defaultValue={values.category} placeholder="Optional" />
                  </label>
                  <TaskDependencyPicker
                    tasks={dependencyOptions}
                    selectedIds={dependencyIds}
                    onChange={setDependencyIds}
                    emptyMessage={projectId ? 'No other tasks are available in this project.' : 'Select a project first.'}
                  />
                  <label className="wide">
                    <span className="task-field-label">Subtasks</span>
                    <textarea name="subtaskLines" defaultValue={values.subtaskLines} rows="3" placeholder="One subtask per line" />
                  </label>
                  <div className="task-recurrence-fields wide">
                    <label><span className="task-field-label">Repeat</span><select name="recurrenceFrequency" value={recurrenceFrequency} onChange={(event) => setRecurrenceFrequency(event.target.value)}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
                    <label><span className="task-field-label">Every</span><input name="recurrenceInterval" type="number" min="1" max="30" value={recurrenceInterval} disabled={recurrenceFrequency === 'none'} onChange={(event) => setRecurrenceInterval(event.target.value)} /></label>
                    <label><span className="task-field-label">Occurrences</span><input name="recurrenceCount" type="number" min="1" max="24" value={recurrenceCount} disabled={recurrenceFrequency === 'none'} onChange={(event) => setRecurrenceCount(event.target.value)} /></label>
                    <p>{getRecurrenceSummary(recurrenceFrequency, recurrenceInterval, recurrenceCount)}</p>
                  </div>
                </div>
                </div>
              </details>
            </div>

            <aside className="task-form-side">
              <p className="task-section-label">Scheduling</p>
              <label><span className="task-field-label">Start date</span><input name="startDate" type="date" defaultValue={values.startDate} /></label>
              <label><span className="task-field-label">Due date</span><input name="dueDate" type="date" defaultValue={values.dueDate} required /></label>
              <label><span className="task-field-label">Due time</span><input name="dueTime" type="time" defaultValue={values.dueTime} /></label>
              <div className="task-side-divider" />
              <p className="task-section-label">Ownership</p>
              <label>
                <span className="task-field-label">Project <small>Required</small></span>
                <select name="projectId" value={projectId} onChange={(event) => chooseProject(event.target.value)} required>
                  <option value="">Select project</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </label>
              <label>
                <span className="task-field-label">Assignee</span>
                <select name="assigneeId" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                  <option value="">Unassigned</option>
                  {projectPeople.map((person) => <option key={getUserId(person)} value={getUserId(person)}>{getCommentAuthor(person)}</option>)}
                </select>
                {selectedAssignee && <small className="task-assignee-caption">{selectedAssignee.role || 'Project member'}</small>}
              </label>
            </aside>
          </div>

          {taskMessage && <p className="form-message task-modal-message">{taskMessage}</p>}
          <footer className="task-modal-footer">
            <span className="task-keyboard-hint"><kbd>Ctrl</kbd><kbd>↵</kbd> to create task</span>
            <div>
              <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary-button" disabled={isSaving}><span aria-hidden="true">＋</span>{isSaving ? 'Saving...' : isEditing ? 'Save changes' : 'Create task'}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}

function WorkspaceFormModal({ id, eyebrow, title, description, className = '', submitLabel, taskMessage, onClose, onSubmit, children }) {
  return (
    <div className="app-modal-backdrop workspace-modal-backdrop" role="presentation">
      <section className={`app-modal workspace-form-modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <header className="task-modal-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h3 id={id}>{title}</h3>
            <p>{description}</p>
          </div>
          <button type="button" className="task-modal-close" onClick={onClose} aria-label={`Close ${title.toLowerCase()} form`}>×</button>
        </header>
        <form
          className="workspace-modal-form"
          onSubmit={onSubmit}
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key === 'Enter') event.currentTarget.requestSubmit()
          }}
        >
          <div className="workspace-modal-scroll">{children}</div>
          {taskMessage && <p className="form-message task-modal-message">{taskMessage}</p>}
          <footer className="task-modal-footer">
            <span className="task-keyboard-hint"><kbd>Ctrl</kbd><kbd>↵</kbd> to save</span>
            <div>
              <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary-button"><span aria-hidden="true">＋</span>{submitLabel}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}

function ProjectModal({ formState, users, currentUser, taskMessage, onClose, onSubmit }) {
  const values = formState.values
  const isEditing = formState.mode === 'edit'
  const [memberIds, setMemberIds] = useState(values.memberIds || [])
  const managerOptions = (currentUser?.role === 'admin' ? [currentUser, ...users] : [currentUser])
    .filter((person, index, people) => person && people.findIndex((candidate) => getUserId(candidate) === getUserId(person)) === index)

  return (
    <WorkspaceFormModal
      id="project-form-title"
      eyebrow={isEditing ? 'Update project' : 'New project'}
      title={isEditing ? 'Edit project' : 'Create project'}
      description="Set the project direction, ownership, and working group."
      className="project-form-modal"
      submitLabel={isEditing ? 'Save changes' : 'Create project'}
      taskMessage={taskMessage}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="workspace-modal-grid">
        <section className="workspace-modal-primary">
          <p className="task-section-label">Project details</p>
          <label><span className="task-field-label">Project name <small>Required</small></span><input name="name" defaultValue={values.name} maxLength="120" placeholder="Website redesign" required autoFocus /></label>
          <label><span className="task-field-label">Description</span><textarea name="description" defaultValue={values.description} rows="6" maxLength="1000" placeholder="Describe the project goal and expected outcome..." /></label>
        </section>
        <aside className="workspace-modal-side">
          <p className="task-section-label">Configuration</p>
          <div className="task-inline-fields">
            <label><span className="task-field-label">Status</span><select name="status" defaultValue={values.status}>{PROJECT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label><span className="task-field-label">Priority</span><select name="priority" defaultValue={values.priority}>{PROJECT_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
          </div>
          <label><span className="task-field-label">Manager</span><select name="managerId" defaultValue={values.managerId || getUserId(currentUser)}>{managerOptions.map((person) => <option key={getUserId(person)} value={getUserId(person)}>{getCommentAuthor(person)}</option>)}</select></label>
          <TaskPeoplePicker label="Members" name="memberIds" people={users} selectedIds={memberIds} onChange={setMemberIds} placeholder="Add project members" emptyMessage="No users are available." />
        </aside>
      </div>
    </WorkspaceFormModal>
  )
}

function TeamModal({ formState, users, currentUser, taskMessage, onClose, onSubmit }) {
  const values = formState.values
  const isEditing = formState.mode === 'edit'
  const [memberIds, setMemberIds] = useState(values.memberIds || [])
  const managerOptions = (currentUser?.role === 'admin' ? [currentUser, ...users] : [currentUser])
    .filter((person, index, people) => person && people.findIndex((candidate) => getUserId(candidate) === getUserId(person)) === index)

  return (
    <WorkspaceFormModal
      id="team-form-title"
      eyebrow={isEditing ? 'Update team' : 'New team'}
      title={isEditing ? 'Edit team' : 'Create team'}
      description="Define the team and choose who collaborates in it."
      className="team-form-modal"
      submitLabel={isEditing ? 'Save changes' : 'Create team'}
      taskMessage={taskMessage}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="workspace-modal-grid">
        <section className="workspace-modal-primary">
          <p className="task-section-label">Team details</p>
          <label><span className="task-field-label">Team name <small>Required</small></span><input name="name" defaultValue={values.name} maxLength="120" placeholder="Product design" required autoFocus /></label>
          <label><span className="task-field-label">Description</span><textarea name="description" defaultValue={values.description} rows="6" maxLength="1000" placeholder="Describe this team’s purpose and responsibilities..." /></label>
        </section>
        <aside className="workspace-modal-side">
          <p className="task-section-label">Ownership</p>
          <label><span className="task-field-label">Manager</span><select name="managerId" defaultValue={values.managerId || getUserId(currentUser)}>{managerOptions.map((person) => <option key={getUserId(person)} value={getUserId(person)}>{getCommentAuthor(person)}</option>)}</select></label>
          <TaskPeoplePicker label="Members" name="memberIds" people={users} selectedIds={memberIds} onChange={setMemberIds} placeholder="Add team members" emptyMessage="No users are available." />
        </aside>
      </div>
    </WorkspaceFormModal>
  )
}

function ActivityModal({ formState, projects, users, taskMessage, onClose, onSubmit }) {
  const values = formState.values
  const isEditing = formState.mode === 'edit'
  const [projectId, setProjectId] = useState(values.projectId || '')
  const [recipientIds, setRecipientIds] = useState(values.recipientIds || [])
  const selectedProject = projects.find((project) => project.id === projectId)
  const eligibleRecipients = getEligibleProjectPeople(selectedProject, users)

  return (
    <WorkspaceFormModal
      id="activity-form-title"
      eyebrow={isEditing ? 'Update activity' : 'New activity'}
      title={isEditing ? 'Edit individual activity' : 'Create individual activity'}
      description="Collect private submissions and review each recipient independently."
      className="activity-form-modal"
      submitLabel={isEditing ? 'Save changes' : 'Create activity'}
      taskMessage={taskMessage}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="workspace-modal-grid activity-modal-grid">
        <section className="workspace-modal-primary">
          <p className="task-section-label">Activity details</p>
          <label><span className="task-field-label">Activity title <small>Required</small></span><input name="title" defaultValue={values.title} maxLength="120" placeholder="Submit design review" required autoFocus /></label>
          <label><span className="task-field-label">Description</span><textarea name="description" defaultValue={values.description} rows="5" maxLength="1000" placeholder="Add instructions, criteria, or submission notes..." /></label>
          {!isEditing && <TaskPeoplePicker label="Recipients" name="recipientIds" people={eligibleRecipients} selectedIds={recipientIds} onChange={setRecipientIds} placeholder="Select project recipients" emptyMessage={projectId ? 'No project members are available.' : 'Select a project first.'} />}
          <div className="activity-policy-switches">
            <p className="task-section-label">Response policy</p>
            <label className="workspace-check-row"><input name="allowTextResponse" type="checkbox" defaultChecked={values.allowTextResponse} /><span><b>Text response</b><small>Recipients may submit a written response.</small></span></label>
            <label className="workspace-check-row"><input name="requireAttachment" type="checkbox" defaultChecked={values.requireAttachment} /><span><b>Require attachment</b><small>A file must be included with every submission.</small></span></label>
            <label className="workspace-check-row"><input name="allowResubmission" type="checkbox" defaultChecked={values.allowResubmission} /><span><b>Allow resubmission</b><small>Returned work can be submitted again.</small></span></label>
          </div>
        </section>
        <aside className="workspace-modal-side">
          <p className="task-section-label">Scheduling</p>
          {!isEditing && <label><span className="task-field-label">Project <small>Required</small></span><select name="projectId" value={projectId} onChange={(event) => { setProjectId(event.target.value); setRecipientIds([]) }} required><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
          <label><span className="task-field-label">Priority</span><select name="priority" defaultValue={values.priority}>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
          <div className="task-inline-fields"><label><span className="task-field-label">Start date</span><input name="startDate" type="date" defaultValue={values.startDate} /></label><label><span className="task-field-label">Due date <small>Required</small></span><input name="dueDate" type="date" defaultValue={values.dueDate} required /></label></div>
          <label><span className="task-field-label">Due time</span><input name="dueTime" type="time" defaultValue={values.dueTime} /></label>
          <div className="task-side-divider" />
          <p className="task-section-label">Submission limits</p>
          <div className="task-inline-fields"><label><span className="task-field-label">Maximum score</span><input name="maximumScore" type="number" min="0" defaultValue={values.maximumScore} /></label><label><span className="task-field-label">Max submissions</span><input name="maxSubmissions" type="number" min="1" defaultValue={values.maxSubmissions} /></label></div>
          <label><span className="task-field-label">Max file size (MB)</span><input name="maxFileSizeMB" type="number" min="1" max="25" defaultValue={values.maxFileSizeMB} /></label>
          <label><span className="task-field-label">Allowed file types</span><input name="allowedFileTypes" defaultValue={values.allowedFileTypes} placeholder="pdf, docx, png" /></label>
        </aside>
      </div>
    </WorkspaceFormModal>
  )
}

function StatusBadge({ value }) {
  return <span className={`badge status-${value.toLowerCase().replaceAll(' ', '-')}`}>{value}</span>
}

function PriorityBadge({ value }) {
  return <span className={`badge priority-${value.toLowerCase()}`}>{value}</span>
}

function formatDate(value) {
  if (!value) {
    return 'No date'
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function formatNotificationDate(value) {
  if (!value) {
    return 'No date'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'No date'
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function getAttachmentId(attachment) {
  return attachment?._id || attachment?.id || ''
}

function formatActivityStatus(value) {
  return String(value || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getLocalDateKey(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCommentAuthor(author) {
  return [author.firstName, author.lastName].filter(Boolean).join(' ').trim() || author.username || author.email || 'Team member'
}

function getUserId(user) {
  return user?._id || user?.id || ''
}

function getTimeInputValue(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function getInitials(user) {
  const first = user.firstName?.[0] || 'T'
  const last = user.lastName?.[0] || ''
  return `${first}${last}`.toUpperCase()
}

function UserAvatar({ user, className, label = '', fallback = 'initials' }) {
  const avatarUrl = user?.avatarUrl || (fallback === 'default' ? defaultProfileImage : '')
  const initials = label
    ? label.slice(0, 1).toUpperCase()
    : getInitials(user || {})

  return (
    <div className={className} aria-hidden="true">
      {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) return 'Good Morning'
  if (hour < 18) return 'Good Afternoon'
  return 'Good Evening'
}

export default App
