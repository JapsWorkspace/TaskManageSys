const DEFAULT_API_BASE_URL = 'http://localhost:8000/api'

function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

export function getAppConfig(env = {}) {
  const apiBaseUrl = normalizeUrl(env.VITE_API_BASE_URL) || DEFAULT_API_BASE_URL
  const serverBaseUrl = normalizeUrl(env.VITE_SERVER_BASE_URL)
    || apiBaseUrl.replace(/\/api$/, '')

  return { apiBaseUrl, serverBaseUrl }
}
