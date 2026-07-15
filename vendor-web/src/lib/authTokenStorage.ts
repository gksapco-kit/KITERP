/**
 * Tab-scoped auth token storage.
 * sessionStorage is not shared with a freshly opened tab, so users must log in again.
 * (Reload / duplicate-tab keeps the session in that browsing context.)
 */

const ACCESS_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'
const ZUSTAND_KEY = 'vendor-auth-storage'

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY)
}

export function setAuthTokens(accessToken: string, refreshToken: string): void {
  sessionStorage.setItem(ACCESS_KEY, accessToken)
  sessionStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearAuthTokens(): void {
  sessionStorage.removeItem(ACCESS_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
  // Only drop vendor zustand persist. Do NOT remove bare access_token /
  // refresh_token from localStorage — admin (frontend) uses those same keys
  // on the shared kiterp.com origin, and clearing them logs admin out.
  try {
    localStorage.removeItem(ZUSTAND_KEY)
  } catch {
    /* ignore quota / private mode */
  }
}

/** One-time cleanup of pre-sessionStorage vendor zustand persist. */
export function clearLegacyAuthLocalStorage(): void {
  try {
    // vendor-auth-storage only. Bare access_token/refresh_token in localStorage
    // belong to the admin app on the same origin — leave them alone.
    localStorage.removeItem(ZUSTAND_KEY)
  } catch {
    /* ignore */
  }
}
