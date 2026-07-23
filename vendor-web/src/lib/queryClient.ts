import { MutationCache, QueryClient, type QueryKey } from '@tanstack/react-query'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { isAxiosAuthError } from '@/lib/errorMessages'
import { getAccessToken } from '@/lib/authTokenStorage'

export type AppMutationMeta = {
  /** Skip auto-refresh for non-data mutations (OTP, login, etc.) */
  skipAutoRefresh?: boolean
  /** Extra query keys to invalidate on success */
  invalidateKeys?: QueryKey[]
}

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete'])

/** Endpoints that should not trigger a global UI refresh (frequent or auth-only). */
const AUTO_REFRESH_SKIP_URL_RE = [
  /\/auth\/(?:login|refresh|handoff|change-password|2fa)/i,
  /\/auth\/(?:phone|email)\/(?:send|verify|resend|confirm)/i,
  /\/auth\/vendor-signup\/send-/i,
  /\/builder-previews(?:\/|$)/i,
  // Read-only endpoints that use POST for their request body — invalidating
  // active queries here re-triggers the same POST, causing an infinite loop.
  /\/config\/variants\/preview(?:\/|$)/i,
  /\/config\/rules\/evaluate(?:\/|$)/i,
]

let boundQueryClient: QueryClient | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

export function bindQueryClient(client: QueryClient) {
  boundQueryClient = client
}

export function getBoundQueryClient(): QueryClient | null {
  return boundQueryClient
}

export function scheduleActiveQueryRefresh(skip = false) {
  if (skip || !boundQueryClient) return
  // Never invalidate while logged out — avoids focus/mutation storms of 401s.
  if (!getAccessToken()) return
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    if (!getAccessToken()) return
    void boundQueryClient?.invalidateQueries({ refetchType: 'active' })
  }, 50)
}

function shouldSkipAxiosAutoRefresh(config: InternalAxiosRequestConfig): boolean {
  const headers = config.headers as Record<string, unknown> | undefined
  if (headers?.['X-Skip-Auto-Refresh'] === 'true' || headers?.['x-skip-auto-refresh'] === 'true') {
    return true
  }
  const method = (config.method || 'get').toLowerCase()
  if (!MUTATING_METHODS.has(method)) return true
  const url = (config.url || '').split('?')[0]
  return AUTO_REFRESH_SKIP_URL_RE.some((re) => re.test(url))
}

export function attachAutoRefreshInterceptor(client: AxiosInstance) {
  client.interceptors.response.use((response) => {
    if (response.config && !shouldSkipAxiosAutoRefresh(response.config)) {
      scheduleActiveQueryRefresh()
    }
    return response
  })
}

export function createAppQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Never retry 401/403 — refresh/redirect already ran in the axios interceptor.
        retry: (failureCount, error) => {
          if (isAxiosAuthError(error)) return false
          return failureCount < 1
        },
        // Focus refetch is handled by installAuthFocusQuerySync (refresh token first).
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
    },
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _context, mutation) => {
        const meta = (mutation.meta ?? {}) as AppMutationMeta
        if (meta.skipAutoRefresh) return

        if (meta.invalidateKeys?.length) {
          for (const key of meta.invalidateKeys) {
            void queryClient.invalidateQueries({ queryKey: key })
          }
        }

        scheduleActiveQueryRefresh()
      },
    }),
  })

  bindQueryClient(queryClient)
  return queryClient
}
