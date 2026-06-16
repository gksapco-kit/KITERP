import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'
import { useAuthStore } from '@/stores/authStore'

const API_URL = getStorefrontApiBaseUrl()

// ── In-memory vendor context (set by VendorContext on resolve) ──
let _vendorSlug: string | null = null
let _vendorId: string | null = null
let _branchQuery: string | null = null

export function setVendorContext(slug: string, id: string) {
  _vendorSlug = slug
  _vendorId = id
  // Also persist to localStorage as fallback
  localStorage.setItem('vendor_slug', slug)
  localStorage.setItem('vendor_id', id)
}

export function getVendorSlug(): string | null {
  return _vendorSlug || localStorage.getItem('vendor_slug')
}

/** Active ?branch= filter for catalog API calls (products, services, stock). */
export function setBranchQueryParam(branch: string | null) {
  _branchQuery = branch?.trim() || null
}

export const apiClient = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' }, timeout: 15000 })

apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('customer_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // SaaS model: send vendor context — prefer in-memory, fallback to localStorage
  const vendorSlug = _vendorSlug || localStorage.getItem('vendor_slug')
  if (vendorSlug) {
    config.headers['X-Vendor-Slug'] = vendorSlug
  } else {
    console.warn('No vendor slug found for request:', config.url)
  }

  const vendorId = _vendorId || localStorage.getItem('vendor_id')
  if (vendorId) {
    config.headers['X-Vendor-Id'] = vendorId
  }

  if (_branchQuery && typeof config.url === 'string' && config.url.startsWith('/catalog/')) {
    const params = (config.params && typeof config.params === 'object' ? config.params : {}) as Record<string, unknown>
    if (params.branch == null && params.store_id == null) {
      config.params = { ...params, branch: _branchQuery }
    }
  }

  return config
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (token) prom.resolve(token)
    else prom.reject(error)
  })
  failedQueue = []
}

/** Paths that require a signed-in customer; public catalog/home must not redirect to login. */
function storefrontPathRequiresLogin(pathname: string): boolean {
  const match = pathname.match(/^\/store\/[^/]+(\/.*)?$/)
  if (!match) return false
  const tail = match[1] ?? ''
  return /^\/account(\/|$)/.test(tail) || tail === '/checkout'
}

function clearStaleCustomerAuth() {
  useAuthStore.getState().logout()
}

function clearAuthAndRedirect() {
  clearStaleCustomerAuth()
  const pathname = window.location.pathname
  if (!storefrontPathRequiresLogin(pathname)) {
    // Expired session on a public page — browse as guest; do not hijack to login.
    return
  }
  const slug = getVendorSlug()
  const search = window.location.search
  window.location.href = slug ? `/store/${slug}/login${search}` : '/'
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Log 401 errors for debugging
    if (error.response?.status === 401) {
      console.error('401 Unauthorized error:', {
        url: originalRequest?.url,
        method: originalRequest?.method,
        hasToken: !!localStorage.getItem('customer_access_token'),
        vendorSlug: _vendorSlug || localStorage.getItem('vendor_slug'),
        vendorId: _vendorId || localStorage.getItem('vendor_id'),
        errorDetail: error.response?.data,
      })
    }

    // Only handle 401 responses, and only once per request
    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error)
    }

    // If we're already refreshing, queue this request to retry after refresh completes
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return apiClient(originalRequest)
        })
        .catch((err) => Promise.reject(err))
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const refreshToken = localStorage.getItem('customer_refresh_token')
      if (!refreshToken) {
        throw new Error('No refresh token')
      }

      // Ensure vendor context is sent with refresh request
      const vendorSlug = _vendorSlug || localStorage.getItem('vendor_slug')
      const vendorId = _vendorId || localStorage.getItem('vendor_id')
      
      const refreshHeaders: Record<string, string> = {}
      if (vendorSlug) refreshHeaders['X-Vendor-Slug'] = vendorSlug
      if (vendorId) refreshHeaders['X-Vendor-Id'] = vendorId
      
      const response = await axios.post(
        `${API_URL}/store/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: refreshHeaders, timeout: 15_000 },
      )

      const { access_token } = response.data
      localStorage.setItem('customer_access_token', access_token)

      // Update the Zustand persisted state with new token
      try {
        const stored = localStorage.getItem('customer-auth-storage')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.state) {
            parsed.state.accessToken = access_token
            parsed.state.isAuthenticated = true
            localStorage.setItem('customer-auth-storage', JSON.stringify(parsed))
          }
        }
      } catch {
        // non-critical: ignore
      }

      processQueue(null, access_token)

      originalRequest.headers.Authorization = `Bearer ${access_token}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      clearAuthAndRedirect()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export default apiClient
