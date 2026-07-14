import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'
import { useAuthStore } from '@/stores/authStore'
import {
  authBagKey,
  getActiveAuthScope,
  readScopedCustomerTokens,
  setAuthStorageScope,
  writeScopedCustomerTokens,
} from '@/lib/customerAuthStorage'

const API_URL = getStorefrontApiBaseUrl()

// ── In-memory vendor / BU context (set by VendorContext / StorefrontBuSync) ──
let _vendorSlug: string | null = null
let _vendorId: string | null = null
let _branchQuery: string | null = null
let _storeId: string | null = null

export { readScopedCustomerTokens, writeScopedCustomerTokens } from '@/lib/customerAuthStorage'

export function setVendorContext(slug: string, id: string) {
  _vendorSlug = slug
  _vendorId = id
  // Also persist to localStorage as fallback
  localStorage.setItem('vendor_slug', slug)
  localStorage.setItem('vendor_id', id)
  setAuthStorageScope(id, _storeId)
}

export function getVendorSlug(): string | null {
  return _vendorSlug || localStorage.getItem('vendor_slug')
}

export function getStorefrontStoreId(): string | null {
  return _storeId
}

/** Active ?branch= filter for catalog API calls (products, services, stock). */
export function setBranchQueryParam(branch: string | null) {
  _branchQuery = branch?.trim() || null
}

/**
 * Active business unit for customer auth + catalog.
 * When the BU changes, swap the in-memory/local customer session to the bag for that BU.
 */
export function setStorefrontBuContext(storeId: string | null, branch: string | null) {
  const nextStore = storeId?.trim() || null
  const nextBranch = branch?.trim() || null
  const prevScope = getActiveAuthScope()
  _storeId = nextStore
  _branchQuery = nextBranch
  setAuthStorageScope(_vendorId || localStorage.getItem('vendor_id'), _storeId)
  const nextScope = getActiveAuthScope()

  if (prevScope === nextScope) return

  // Persist current global bag under the previous scope (if any), then load the next.
  try {
    const currentBag = localStorage.getItem('customer-auth-storage')
    if (currentBag) localStorage.setItem(authBagKey(prevScope), currentBag)
  } catch {
    // ignore
  }

  const nextAccess = localStorage.getItem(`customer_access_token:${nextScope}`)
  const nextRefresh = localStorage.getItem(`customer_refresh_token:${nextScope}`)
  const nextBag = localStorage.getItem(authBagKey(nextScope))

  if (nextAccess) localStorage.setItem('customer_access_token', nextAccess)
  else localStorage.removeItem('customer_access_token')
  if (nextRefresh) localStorage.setItem('customer_refresh_token', nextRefresh)
  else localStorage.removeItem('customer_refresh_token')

  if (nextBag) {
    localStorage.setItem('customer-auth-storage', nextBag)
    try {
      const parsed = JSON.parse(nextBag)
      const state = parsed?.state
      useAuthStore.setState({
        customer: state?.customer ?? null,
        accessToken: state?.accessToken ?? nextAccess,
        isAuthenticated: !!(state?.isAuthenticated || nextAccess),
      })
    } catch {
      useAuthStore.getState().logout()
      if (nextAccess) {
        useAuthStore.setState({ accessToken: nextAccess, isAuthenticated: true })
      }
    }
  } else {
    useAuthStore.getState().logout()
  }
}

export const apiClient = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' }, timeout: 30_000 })

apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

apiClient.interceptors.request.use((config) => {
  const { access: token } = readScopedCustomerTokens()
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

  if (_storeId) {
    config.headers['X-Store-Id'] = _storeId
  }
  if (_branchQuery) {
    config.headers['X-Branch'] = _branchQuery
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
        hasToken: !!readScopedCustomerTokens().access,
        vendorSlug: _vendorSlug || localStorage.getItem('vendor_slug'),
        vendorId: _vendorId || localStorage.getItem('vendor_id'),
        storeId: _storeId,
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
      const { refresh: refreshToken } = readScopedCustomerTokens()
      if (!refreshToken) {
        throw new Error('No refresh token')
      }

      // Ensure vendor + BU context is sent with refresh request
      const vendorSlug = _vendorSlug || localStorage.getItem('vendor_slug')
      const vendorId = _vendorId || localStorage.getItem('vendor_id')
      
      const refreshHeaders: Record<string, string> = {}
      if (vendorSlug) refreshHeaders['X-Vendor-Slug'] = vendorSlug
      if (vendorId) refreshHeaders['X-Vendor-Id'] = vendorId
      if (_storeId) refreshHeaders['X-Store-Id'] = _storeId
      if (_branchQuery) refreshHeaders['X-Branch'] = _branchQuery
      
      const response = await axios.post(
        `${API_URL}/store/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: refreshHeaders, timeout: 15_000 },
      )

      const { access_token, refresh_token: newRefresh } = response.data
      writeScopedCustomerTokens(access_token, newRefresh)

      // Update the Zustand persisted state with new token
      try {
        const stored = localStorage.getItem('customer-auth-storage')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.state) {
            parsed.state.accessToken = access_token
            parsed.state.isAuthenticated = true
            localStorage.setItem('customer-auth-storage', JSON.stringify(parsed))
            localStorage.setItem(authBagKey(getActiveAuthScope()), JSON.stringify(parsed))
          }
        }
      } catch {
        // non-critical: ignore
      }

      useAuthStore.setState({ accessToken: access_token, isAuthenticated: true })

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
