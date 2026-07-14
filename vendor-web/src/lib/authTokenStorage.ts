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
  // Drop legacy localStorage session so old installs do not auto-login across tabs.
  try {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(ZUSTAND_KEY)
  } catch {
    /* ignore quota / private mode */
  }
}

/** One-time cleanup of pre-sessionStorage auth persistence. */
export function clearLegacyAuthLocalStorage(): void {
  try {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(ZUSTAND_KEY)
  } catch {
    /* ignore */
  }
}
