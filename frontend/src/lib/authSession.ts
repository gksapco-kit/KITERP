import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { resolveApiBaseUrl } from '@/lib/apiBase'
import { isAxiosNetworkError } from '@/lib/errorMessages'

/** Endpoints where 401 means bad credentials — never attempt token refresh. */
const SKIP_TOKEN_REFRESH_RE =
  /\/auth\/(?:login|refresh|register|forgot|reset)(?:[-/]|$|\?)/i

export function shouldSkipTokenRefresh(url: string | undefined): boolean {
  if (!url) return false
  return SKIP_TOKEN_REFRESH_RE.test(url.split('?')[0])
}

let refreshPromise: Promise<boolean> | null = null

/** Refresh access (and rotated refresh) token; dedupes concurrent callers. */
export async function refreshAuthSession(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return false

  try {
    const response = await axios.post(
      `${resolveApiBaseUrl()}/auth/refresh`,
      { refresh_token: refreshToken },
      { timeout: 15_000 },
    )
    const { access_token, refresh_token: nextRefresh } = response.data ?? {}
    if (!access_token) return false

    useAuthStore.getState().setTokens({
      access_token,
      refresh_token: nextRefresh || refreshToken,
      token_type: 'bearer',
    })
    return true
  } catch (err) {
    if (isAxiosNetworkError(err)) throw err
    return false
  }
}

export function refreshAuthSessionDeduped(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAuthSession().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export function clearAuthSessionAndRedirectToLogin(): void {
  const onAuthPage = /\/(login|register|forgot-password)/.test(window.location.pathname)
  useAuthStore.getState().logout()
  if (!onAuthPage) {
    window.location.href = '/login'
  }
}

/**
 * Keep the session alive while the admin tab is open.
 * Access tokens expire in ~30m; refresh before that so idle use never forces logout.
 */
export function startSessionKeepAlive(): () => void {
  const INTERVAL_MS = 20 * 60 * 1000

  const tick = () => {
    if (!localStorage.getItem('refresh_token')) return
    void refreshAuthSessionDeduped().catch(() => {
      /* network blip — retry on next interval */
    })
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') tick()
  }

  const id = window.setInterval(tick, INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisible)
  tick()

  return () => {
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
