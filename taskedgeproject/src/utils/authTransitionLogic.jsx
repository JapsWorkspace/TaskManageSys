export const AUTH_TRANSITION_DURATION = 1800

const transitionCopy = {
  login: {
    message: 'Preparing your workspace',
    accessibleLabel: 'Signing in and preparing your workspace',
  },
  logout: {
    message: 'Securing your session',
    accessibleLabel: 'Signing out and securing your session',
  },
}

export function getAuthTransitionCopy(type) {
  return transitionCopy[type] || transitionCopy.login
}

export function getRemainingTransitionTime(startedAt, currentTime = Date.now()) {
  return Math.max(0, AUTH_TRANSITION_DURATION - (currentTime - startedAt))
}
