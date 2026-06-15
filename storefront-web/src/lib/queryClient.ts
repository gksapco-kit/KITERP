import { MutationCache, QueryClient, type QueryKey } from '@tanstack/react-query'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

export type AppMutationMeta = {
  skipAutoRefresh?: boolean
  invalidateKeys?: QueryKey[]
}

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete'])

const AUTO_REFRESH_SKIP_URL_RE = [
  /\/auth\/(?:login|refresh|handoff|change-password|2fa)/i,
  /\/auth\/(?:phone|email)\/(?:send|verify|resend|confirm)/i,
  /\/auth\/vendor-signup\/send-/i,
  /\/builder-previews(?:\/|$)/i,
]

let boundQueryClient: QueryClient | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

export function bindQueryClient(client: QueryClient) {
  boundQueryClient = client
}

export function scheduleActiveQueryRefresh(skip = false) {
  if (skip || !boundQueryClient) return
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
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
        retry: 1,
        refetchOnWindowFocus: true,
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
