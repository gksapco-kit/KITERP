import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'

/**
 * In `npm run dev`, always use same-origin `/api/v1` so Vite proxies to the backend (vite.config.ts).
 * Ignores `VITE_API_URL` in dev so the browser never has to reach :8000 directly — avoids failures from
 * embedded browsers, IPv6/localhost quirks, or env files copied from examples pointing at localhost:8000.
 * For dev against a remote API, set `vite.config.ts` `server.proxy['/api'].target` instead.
 */
function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function resolveApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return '/api/v1'
  }
  const fallback = '/api/v1'
  const fromEnv = import.meta.env.VITE_API_URL
  const candidate =
    typeof fromEnv === 'string' && fromEnv.trim()
      ? fromEnv.trim().replace(/\/$/, '')
      : fallback

  if (typeof window === 'undefined') return candidate

  if (isLoopbackHostname(window.location.hostname)) return candidate
  if (candidate.startsWith('/')) return candidate

  try {
    if (isLoopbackHostname(new URL(candidate).hostname)) return fallback
  } catch {
    return fallback
  }
  return candidate
}

export const API_URL = resolveApiBaseUrl()

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 25_000,
})

apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const reqUrl = (originalRequest?.url || '').split('?')[0]
    // Axios may store url as `auth/login` or `/auth/login` — both must skip refresh handling.
    const isAuthEndpoint = reqUrl.includes('/auth/') || reqUrl.startsWith('auth/')

    // Handle 401 - Token expired (not on auth endpoints)
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true
      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          })

          const { access_token } = response.data
          localStorage.setItem('access_token', access_token)

          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return apiClient(originalRequest)
        }
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
