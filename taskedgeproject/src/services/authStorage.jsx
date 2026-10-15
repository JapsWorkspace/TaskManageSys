export const AUTH_STORAGE_KEY = 'taskedge-auth'
export const LEGACY_USER_STORAGE_KEY = 'taskedge-user'

export function readStoredAuth(storage = localStorage) {
  try {
    const storedAuth = storage.getItem(AUTH_STORAGE_KEY)

    if (storedAuth) {
      return JSON.parse(storedAuth)
    }

    const legacyUser = storage.getItem(LEGACY_USER_STORAGE_KEY)

    if (legacyUser) {
      return {
        user: JSON.parse(legacyUser),
        token: '',
      }
    }
  } catch {
    return {
      user: null,
      token: '',
    }
  }

  return {
    user: null,
    token: '',
  }
}

export function storeAuth(auth, storage = localStorage) {
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
}

export function clearStoredAuth(storage = localStorage) {
  storage.removeItem(AUTH_STORAGE_KEY)
  storage.removeItem(LEGACY_USER_STORAGE_KEY)
}

export function createAuthHeaders(token) {
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {}
}
