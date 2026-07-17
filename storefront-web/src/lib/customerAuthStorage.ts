/** Per vendor + business-unit customer token bags (localStorage). */

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

export function readScopedCustomerTokens(): { access: string | null; refresh: string | null } {
  const scope = activeScope()
  const access = localStorage.getItem(tokenKey('access', scope))
  const refresh = localStorage.getItem(tokenKey('refresh', scope))
  // Legacy global tokens only when this tab has no vendor scope yet.
  if (!_vendorId) {
    return {
      access: access || localStorage.getItem('customer_access_token'),
      refresh: refresh || localStorage.getItem('customer_refresh_token'),
    }
  }
  return { access, refresh }
}

export function writeScopedCustomerTokens(access: string, refresh?: string | null) {
  const scope = activeScope()
  localStorage.setItem(tokenKey('access', scope), access)
  localStorage.setItem('customer_access_token', access)
  if (refresh) {
    localStorage.setItem(tokenKey('refresh', scope), refresh)
    localStorage.setItem('customer_refresh_token', refresh)
  }
}

export function clearScopedCustomerTokens() {
  const scope = activeScope()
  localStorage.removeItem(tokenKey('access', scope))
  localStorage.removeItem(tokenKey('refresh', scope))
  localStorage.removeItem(authBagKey(scope))
  localStorage.removeItem('customer_access_token')
  localStorage.removeItem('customer_refresh_token')
}
