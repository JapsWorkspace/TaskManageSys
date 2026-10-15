import { getAppConfig } from './appConfig.jsx'

const appConfig = getAppConfig(import.meta.env)

export const API_BASE_URL = appConfig.apiBaseUrl
export const SERVER_BASE_URL = appConfig.serverBaseUrl
