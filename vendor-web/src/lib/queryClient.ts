import { MutationCache, QueryClient, type QueryKey } from '@tanstack/react-query'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { isAxiosAuthError, extractApiError } from '@/lib/errorMessages'
import { getAccessToken } from '@/lib/authTokenStorage'
import { toast } from 'sonner'

export type AppMutationMeta = {
  /** Skip auto-refresh for non-data mutations (OTP, login, etc.) */
  skipAutoRefresh?: boolean
  /** Extra query keys to invalidate on success */
  invalidateKeys?: QueryKey[]
  /**
   * Label for the global fallback error toast.
   * Set to false to suppress the global toast (when the mutation has its own onError).
   * Defaults to 'Action failed' when omitted.
   */
  errorContext?: string | false
}

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete'])

/** Endpoints that should not trigger a UI refresh (frequent, auth-only, or local chrome). */
const AUTO_REFRESH_SKIP_URL_RE = [
  /\/auth\/(?:login|refresh|handoff|change-password|2fa)/i,
  /\/auth\/(?:phone|email)\/(?:send|verify|resend|confirm)/i,
  /\/auth\/vendor-signup\/send-/i,
  /\/builder-previews(?:\/|$)/i,
  // Read-only endpoints that use POST for their request body — invalidating
  // active queries here re-triggers the same POST, causing an infinite loop.
  /\/config\/variants\/preview(?:\/|$)/i,
  /\/config\/rules\/evaluate(?:\/|$)/i,
  // Sidebar layout is already applied locally; refreshing every list makes each click wait.
  /\/sidebar-apps(?:\/|$)/i,
]

const HINT_SKIP = new Set([
  'status', 'activate', 'deactivate', 'approve', 'reject', 'export', 'import',
  'pdf', 'print', 'search', 'preview', 'send', 'cancel', 'close', 'open',
])

function resourceHints(url: string): string[] {
  const path = url.split('?')[0]
  const parts = path.split('/').filter(Boolean)
  const meAt = parts.findIndex((part) => part === 'me')
  const rest = meAt >= 0 ? parts.slice(meAt + 1) : parts.slice(-2)
  const hints = new Set<string>()
  for (const raw of rest) {
    if (!raw || raw.length < 3) continue
    if (/^[0-9a-f-]{16,}$/i.test(raw)) continue
    const token = raw.toLowerCase()
    if (HINT_SKIP.has(token)) continue
    hints.add(token)
    if (token.endsWith('ies') && token.length > 4) hints.add(`${token.slice(0, -3)}y`)
    else if (token.endsWith('s') && token.length > 4) hints.add(token.slice(0, -1))
  }
  return [...hints]
}

function queryKeyStrings(queryKey: readonly unknown[]): string[] {
  const out: string[] = []
  for (const part of queryKey) {
    if (typeof part === 'string') out.push(part.toLowerCase())
    else if (Array.isArray(part)) {
      for (const inner of part) {
        if (typeof inner === 'string') out.push(inner.toLowerCase())
      }
    }
  }
  return out
}

function keyMatchesHint(part: string, hint: string): boolean {
  return part === hint || part.startsWith(`${hint}-`) || part.startsWith(`${hint}_`) || part.startsWith(hint)
}

let boundQueryClient: QueryClient | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

export function bindQueryClient(client: QueryClient) {
  boundQueryClient = client
}

export function getBoundQueryClient(): QueryClient | null {
  return boundQueryClient
}

/**
 * Refresh only the lists related to the write that just finished.
 * A full active-query refetch made every vendor action wait on badges, reports, and unrelated pages.
 */
export function scheduleActiveQueryRefresh(skip = false, url?: string) {
  if (skip || !url || !boundQueryClient) return
  if (!getAccessToken()) return
  const hints = resourceHints(url)
  if (hints.length === 0) return
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    if (!getAccessToken()) return
    void boundQueryClient?.invalidateQueries({
      refetchType: 'active',
      predicate: (query) => {
        const parts = queryKeyStrings(query.queryKey)
        return hints.some((hint) => parts.some((part) => keyMatchesHint(part, hint)))
      },
    })
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
      scheduleActiveQueryRefresh(false, response.config.url)
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
        // The axios interceptor refreshes the resource that was written.
        // Do not refetch every mounted query here — that is what made actions feel stuck.
      },
      onError: (error, _variables, _context, mutation) => {
        // Skip when the mutation already handles its own error (has an onError callback).
        if (mutation.options.onError) return
        const meta = (mutation.meta ?? {}) as AppMutationMeta
        if (meta.errorContext === false) return
        // Never toast auth errors — the axios interceptor handles redirect/refresh.
        if (isAxiosAuthError(error)) return
        toast.error(extractApiError(error, meta.errorContext ?? 'Action failed'))
      },
    }),
  })

  bindQueryClient(queryClient)
  return queryClient
}
