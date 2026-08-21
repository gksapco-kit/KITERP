/** Per vendor + business-unit customer token bags (localStorage). */

import { safeLocalGet, safeLocalRemove, safeLocalSet } from '@/lib/safeStorage'

let _vendorId: string | null = null
let _storeId: string | null = null

export function setAuthStorageScope(vendorId: string | null, storeId: string | null) {
  _vendorId = vendorId?.trim() || null
  _storeId = storeId?.trim() || null
}

export function authScopeKey(vendorId: string | null, storeId: string | null): string {
  return `${vendorId || 'unknown'}:${storeId || 'all'}`
}

function activeScope(): string {
  // Do not read shared localStorage vendor_id — that bleeds auth across live tabs.
  return authScopeKey(_vendorId, _storeId)
}

function tokenKey(kind: 'access' | 'refresh', scope: string): string {
  return `customer_${kind}_token:${scope}`
}

export function authBagKey(scope: string): string {
  return `customer-auth-storage:${scope}`
}

export function getActiveAuthScope(): string {
  return activeScope()
}

function listLocalKeys(): string[] {
  const keys: string[] = []
  try {
    if (typeof window === 'undefined') return keys
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k) keys.push(k)
    }
  } catch {
    // Storage blocked — caller falls back to in-memory / global keys.
  }
  return keys
}

/** Tokens saved under the same vendor but a different BU key (e.g. vendorId:all vs vendorId:storeId). */
export function readVendorSiblingTokens(vendorId: string): { access: string | null; refresh: string | null } {
  const id = vendorId.trim()
  if (!id) return { access: null, refresh: null }
  const accessPrefix = `customer_access_token:${id}:`
  const refreshPrefix = `customer_refresh_token:${id}:`
  let access: string | null = null
  let refresh: string | null = null
  for (const key of listLocalKeys()) {
    if (!access && key.startsWith(accessPrefix)) access = safeLocalGet(key)
    if (!refresh && key.startsWith(refreshPrefix)) refresh = safeLocalGet(key)
    if (access && refresh) break
  }
  return { access, refresh }
}

export function readScopedCustomerTokens(): { access: string | null; refresh: string | null } {
  const scope = activeScope()
  let access = safeLocalGet(tokenKey('access', scope))
  let refresh = safeLocalGet(tokenKey('refresh', scope))

  if (!access || !refresh) {
    const globalAccess = safeLocalGet('customer_access_token')
    const globalRefresh = safeLocalGet('customer_refresh_token')
    // Before vendor pin, globals are the only bag this tab can read.
    if (!_vendorId) {
      return {
        access: access || globalAccess,
        refresh: refresh || globalRefresh,
      }
    }
    // After pin, the active key is often vendorId:all while login wrote vendorId:storeId
    // (BU sync has not run yet). Missing that fallback 401s /me and wipes the session.
    const sibling = readVendorSiblingTokens(_vendorId)
    access = access || sibling.access || globalAccess
    refresh = refresh || sibling.refresh || globalRefresh
  }
  return { access, refresh }
}

export function writeScopedCustomerTokens(access: string, refresh?: string | null) {
  const scope = activeScope()
  safeLocalSet(tokenKey('access', scope), access)
  safeLocalSet('customer_access_token', access)
  if (refresh) {
    safeLocalSet(tokenKey('refresh', scope), refresh)
    safeLocalSet('customer_refresh_token', refresh)
  }
}

export function clearScopedCustomerTokens() {
  const scope = activeScope()
  safeLocalRemove(tokenKey('access', scope))
  safeLocalRemove(tokenKey('refresh', scope))
  safeLocalRemove(authBagKey(scope))
  safeLocalRemove('customer_access_token')
  safeLocalRemove('customer_refresh_token')
}
