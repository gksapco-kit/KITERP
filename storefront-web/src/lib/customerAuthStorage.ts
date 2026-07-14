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
  const vendorId = _vendorId || (typeof localStorage !== 'undefined' ? localStorage.getItem('vendor_id') : null)
  return authScopeKey(vendorId, _storeId)
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
  return {
    access: localStorage.getItem(tokenKey('access', scope)) || localStorage.getItem('customer_access_token'),
    refresh: localStorage.getItem(tokenKey('refresh', scope)) || localStorage.getItem('customer_refresh_token'),
  }
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
