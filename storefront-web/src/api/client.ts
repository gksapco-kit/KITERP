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
import { vendorSlugFromLocation } from '@/lib/vendorScope'
import { safeLocalGet, safeLocalRemove, safeLocalSet, safeSessionGet, safeSessionRemove, safeSessionSet } from '@/lib/safeStorage'

const API_URL = getStorefrontApiBaseUrl()

// ── In-memory vendor / BU context (set by VendorContext / StorefrontBuSync) ──
// Tab-local only: sessionStorage (not localStorage). Shared localStorage was the
// main reason two live /store/:slug tabs eventually merged catalog/images.
let _vendorSlug: string | null = null
let _vendorId: string | null = null
let _branchQuery: string | null = null
let _storeId: string | null = null

const SS_VENDOR_SLUG = 'vendor_slug'
const SS_VENDOR_ID = 'vendor_id'

function ssGet(key: string): string | null {
  return safeSessionGet(key)?.trim() || null
}

function ssSet(key: string, value: string | null) {
  if (!value) safeSessionRemove(key)
  else safeSessionSet(key, value)
}

function clearLegacySharedVendorKeys() {
  safeLocalRemove('vendor_slug')
  safeLocalRemove('vendor_id')
}

export { readScopedCustomerTokens, writeScopedCustomerTokens } from '@/lib/customerAuthStorage'

/** Pin slug from the URL immediately (before vendor JSON loads) so early API calls stay on this tab's site. */
export function setVendorSlugHint(slug: string) {
  const next = slug.trim()
  if (!next) return
  _vendorSlug = next
  _vendorId = null
  ssSet(SS_VENDOR_SLUG, next)
  ssSet(SS_VENDOR_ID, null)
  clearLegacySharedVendorKeys()
}

export function setVendorContext(slug: string, id: string) {
  _vendorSlug = slug.trim()
  _vendorId = id.trim()
  ssSet(SS_VENDOR_SLUG, _vendorSlug)
  ssSet(SS_VENDOR_ID, _vendorId)
  clearLegacySharedVendorKeys()
  setAuthStorageScope(_vendorId, _storeId)
}

export function getVendorSlug(): string | null {
  return vendorSlugFromLocation() || _vendorSlug || ssGet(SS_VENDOR_SLUG)
}

function resolveVendorHeaders(): { slug: string | null; id: string | null } {
  const urlSlug = vendorSlugFromLocation()
  const memSlug = _vendorSlug || ssGet(SS_VENDOR_SLUG)
  const slug = urlSlug || memSlug
  // Only send vendor id when it belongs to this tab's slug (never another tab's leftover id).
  const idMatches =
    Boolean(_vendorId)
    && Boolean(_vendorSlug)
    && (!urlSlug || _vendorSlug === urlSlug)
  const id = idMatches ? _vendorId : (urlSlug ? null : ssGet(SS_VENDOR_ID))
  return { slug, id }
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
 * If the new BU has no saved bag yet, carry forward the previous vendor session
 * (do not force logout — that was bouncing logged-in users back to signup/login).
 */
export function setStorefrontBuContext(storeId: string | null, branch: string | null) {
  const nextStore = storeId?.trim() || null
  const nextBranch = branch?.trim() || null
  const prevScope = getActiveAuthScope()
  _storeId = nextStore
  _branchQuery = nextBranch
  setAuthStorageScope(_vendorId || ssGet(SS_VENDOR_ID), _storeId)
  const nextScope = getActiveAuthScope()

  if (prevScope === nextScope) return

  // Persist current global bag under the previous scope (if any), then load the next.
  const carriedBag = safeLocalGet('customer-auth-storage')
  if (carriedBag) safeLocalSet(authBagKey(prevScope), carriedBag)

  const prevAccess =
    safeLocalGet(`customer_access_token:${prevScope}`)
    || safeLocalGet('customer_access_token')
  const prevRefresh =
    safeLocalGet(`customer_refresh_token:${prevScope}`)
    || safeLocalGet('customer_refresh_token')

  let nextAccess = safeLocalGet(`customer_access_token:${nextScope}`)
  let nextRefresh = safeLocalGet(`customer_refresh_token:${nextScope}`)
  let nextBag = safeLocalGet(authBagKey(nextScope))

  // No BU-specific session yet — reuse the vendor-wide / previous session.
  if (!nextBag && !nextAccess && (carriedBag || prevAccess)) {
    nextBag = carriedBag || safeLocalGet(authBagKey(prevScope))
    nextAccess = prevAccess
    nextRefresh = prevRefresh
    if (nextBag) safeLocalSet(authBagKey(nextScope), nextBag)
    if (nextAccess) safeLocalSet(`customer_access_token:${nextScope}`, nextAccess)
    if (nextRefresh) safeLocalSet(`customer_refresh_token:${nextScope}`, nextRefresh)
  }

  if (nextAccess) safeLocalSet('customer_access_token', nextAccess)
  else safeLocalRemove('customer_access_token')
  if (nextRefresh) safeLocalSet('customer_refresh_token', nextRefresh)
  else safeLocalRemove('customer_refresh_token')

  if (nextBag) {
    safeLocalSet('customer-auth-storage', nextBag)
    try {
      const parsed = JSON.parse(nextBag)
      const state = parsed?.state
      useAuthStore.setState({
        customer: state?.customer ?? null,
        accessToken: state?.accessToken ?? nextAccess,
        isAuthenticated: !!(state?.isAuthenticated || nextAccess),
      })
    } catch {
      if (nextAccess) {
        useAuthStore.setState({
          accessToken: nextAccess,
          isAuthenticated: true,
        })
      }
      // Do NOT logout here — a JSON parse failure must not wipe a live session.
    }
  } else if (nextAccess) {
    useAuthStore.setState({
      accessToken: nextAccess,
      isAuthenticated: true,
    })
  }
  // Do NOT call logout() when the new scope has no bag yet; the first
  // authenticated API call will either succeed (session is fine) or return 401
  // (interceptor will then token-refresh or redirect to login). Proactively
  // logging out here is what creates the "redirect to home" loop.
}

export const apiClient = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' }, timeout: 30_000 })

apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    const headers = config.headers
    if (headers && typeof (headers as { delete?: (key: string) => void }).delete === 'function') {
      ;(headers as { delete: (key: string) => void }).delete('Content-Type')
    } else if (headers) {
      delete (headers as Record<string, unknown>)['Content-Type']
    }
  }
  return config
})

apiClient.interceptors.request.use((config) => {
  const { access: token } = readScopedCustomerTokens()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // SaaS: URL slug wins (tab-local). Never fall back to shared localStorage.
  const { slug: vendorSlug, id: vendorId } = resolveVendorHeaders()
  if (vendorSlug) {
    config.headers['X-Vendor-Slug'] = vendorSlug
  } else {
    console.warn('No vendor slug found for request:', config.url)
  }

  if (vendorId) {
    config.headers['X-Vendor-Id'] = vendorId
  }

  if (_storeId) {
    config.headers['X-Store-Id'] = _storeId
  }
  if (_branchQuery) {
    config.headers['X-Branch'] = _branchQuery
  }

  if (typeof config.url === 'string' && config.url.startsWith('/catalog/')) {
    const params = (config.params && typeof config.params === 'object' ? config.params : {}) as Record<string, unknown>
    if (params.branch == null && params.store_id == null) {
      // Prefer store UUID — branch codes can collide across business units.
      if (_storeId) {
        config.params = { ...params, store_id: _storeId }
      } else if (_branchQuery) {
        config.params = { ...params, branch: _branchQuery }
      }
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

/**
 * Wipe every scoped customer token key from localStorage so a forced logout
 * cannot leave the app in a half-authenticated state.  Without this, a stale
 * `customer_access_token:<scope>` key survives a zustand `logout()` and the
 * next setStorefrontBuContext call re-reads it, making the app appear signed-in.
 */
function clearAllScopedCustomerKeys() {
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && (k.startsWith('customer_access_token:') || k.startsWith('customer_refresh_token:') || k.startsWith('customer-auth-storage:'))) {
        keys.push(k)
      }
    }
    keys.forEach((k) => safeLocalRemove(k))
  } catch {
    // Storage blocked — in-memory store will be wiped by logout() below.
  }
}

function clearStaleCustomerAuth() {
  clearAllScopedCustomerKeys()
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
  const returnTo = `${pathname}${search}`
  if (!slug) {
    window.location.href = '/'
    return
  }
  // Preserve where the shopper was so login can send them back (not home).
  const fromQs = `from=${encodeURIComponent(returnTo)}`
  window.location.href = `/${encodeURIComponent(slug)}/login?${fromQs}`
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
        vendorSlug: resolveVendorHeaders().slug,
        vendorId: resolveVendorHeaders().id,
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
      const { slug: vendorSlug, id: vendorId } = resolveVendorHeaders()

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
        const stored = safeLocalGet('customer-auth-storage')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.state) {
            parsed.state.accessToken = access_token
            parsed.state.isAuthenticated = true
            safeLocalSet('customer-auth-storage', JSON.stringify(parsed))
            safeLocalSet(authBagKey(getActiveAuthScope()), JSON.stringify(parsed))
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
