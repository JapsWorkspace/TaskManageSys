import axios from 'axios'

import { buildAuthFromResponse } from './authLogic.js'

export function createAuthApi({
  baseUrl,
  getToken,
  onUnauthorized = () => {},
  fetchImpl = null,
  httpClient = axios,
}) {
  async function request(path, options = {}) {
    const token = getToken()
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    }

    if (!fetchImpl) {
      try {
        const response = await httpClient({
          url: `${baseUrl}${path}`,
          method: options.method || 'GET',
          data: options.body,
          headers,
        })

        return response.data || {}
      } catch (error) {
        if (error.response?.status === 401) onUnauthorized()
        throw new Error(
          error.response?.data?.message
          || (typeof error.response?.data === 'string' ? error.response.data : '')
          || 'The server could not complete the request.',
          { cause: error },
        )
      }
    }

    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...options,
      headers,
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      if (response.status === 401) onUnauthorized()
      throw new Error(data.message || 'The server could not complete the request.')
    }

    return data
  }

  return {
    async updateProfile(payload) {
      const data = await request('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })

      return {
        message: data.message || 'Profile updated.',
        user: buildAuthFromResponse({ token: getToken(), user: data.user }).user,
      }
    },
    async changePassword(newPassword) {
      const data = await request('/auth/change-password', {
        method: 'PATCH',
        body: JSON.stringify({ newPassword }),
      })

      return data.message || 'Password changed.'
    },
    async requestPasswordReset(email) {
      const data = await request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })

      return {
        message: data.message || 'If the account exists, a reset code has been created.',
        resetToken: data.resetToken || '',
      }
    },
    async resetPassword({ token, password }) {
      const data = await request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })

      return data.message || 'Password reset successfully.'
    },
    async logoutAllDevices() {
      const data = await request('/auth/logout-all', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      return data.message || 'Logged out of all devices.'
    },
    async deleteAccount() {
      const data = await request('/auth/me', {
        method: 'DELETE',
      })

      return data.message || 'Account deleted.'
    },
  }
}
