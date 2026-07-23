import { getAccessToken, getRefreshToken } from '@/lib/authTokenStorage'
import {
  clearAuthSessionAndRedirectToLogin,
  refreshAuthSessionDeduped,
} from '@/lib/authSession'
import { isAxiosNetworkError } from '@/lib/errorMessages'
import { getBoundQueryClient } from '@/lib/queryClient'

/** True when access JWT is missing or expires within `skewSec` seconds. */
export function isAccessTokenExpiredOrExpiring(skewSec = 60): boolean {
  const token = getAccessToken()
  if (!token) return true
  try {
    const part = token.split('.')[1]
    if (!part) return true
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded)) as { exp?: number }
    const exp = payload.exp
    if (!exp) return true
    return Date.now() / 1000 >= exp - skewSec
  } catch {
    return true
  }
}

let lastFocusSyncMs = 0
let focusSyncInFlight: Promise<void> | null = null

/**
 * On tab focus: refresh the access token first (if needed), then refetch.
 * Prevents the React Query focus storm of parallel 401s when the JWT expired.
 */
export function installAuthFocusQuerySync(): void {
  if (typeof window === 'undefined') return

  const sync = () => {
    const now = Date.now()
    if (now - lastFocusSyncMs < 1500) return
    lastFocusSyncMs = now

    if (!getAccessToken() && !getRefreshToken()) return

    if (!focusSyncInFlight) {
      focusSyncInFlight = (async () => {
        try {
          if (isAccessTokenExpiredOrExpiring()) {
            if (!getRefreshToken()) {
              clearAuthSessionAndRedirectToLogin()
              return
            }
            const refreshed = await refreshAuthSessionDeduped()
            if (!refreshed) {
              clearAuthSessionAndRedirectToLogin()
              return
            }
          }
          getBoundQueryClient()?.invalidateQueries({ refetchType: 'active' })
        } catch (err) {
          if (!isAxiosNetworkError(err)) {
            clearAuthSessionAndRedirectToLogin()
          }
        } finally {
          focusSyncInFlight = null
        }
      })()
    }
  }

  window.addEventListener('focus', sync)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync()
  })
}
