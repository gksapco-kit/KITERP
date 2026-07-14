import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { resolveApiBaseUrl } from '@/lib/apiBase'
import { isAxiosNetworkError } from '@/lib/errorMessages'
import { getRefreshToken } from '@/lib/authTokenStorage'

/** Endpoints where 401 means bad credentials — never attempt token refresh. */
const SKIP_TOKEN_REFRESH_RE =
  /\/auth\/(?:login|refresh|vendor-handoff|register|forgot|reset|vendor-signup|password-reset)(?:\/|$|\?)/i

export function shouldSkipTokenRefresh(url: string | undefined): boolean {
  if (!url) return false
  return SKIP_TOKEN_REFRESH_RE.test(url.split('?')[0])
}

let refreshPromise: Promise<boolean> | null = null

/** Refresh access (and rotated refresh) token; dedupes concurrent callers. */
export async function refreshAuthSession(): Promise<boolean> {
  const refreshToken = getRefreshToken()
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
  const onAuthPage = /\/(login|register|forgot-password|auth\/handoff)/.test(window.location.pathname)
  useAuthStore.getState().logout()
  if (!onAuthPage) {
    window.location.href = '/login'
  }
}
