import { createContext, useContext, type ReactNode } from 'react'
import type { LiveItem, LiveResource } from '@/blocks/registry'

export type LiveDataFetcher = (
  siteId: string,
  resource: LiveResource,
  limit: number,
  params?: Record<string, unknown>,
) => Promise<LiveItem[]>

const LiveDataFetchContext = createContext<LiveDataFetcher | null>(null)

export function LiveDataFetchProvider({
  fetcher,
  children,
}: {
  fetcher: LiveDataFetcher
  children: ReactNode
}) {
  return (
    <LiveDataFetchContext.Provider value={fetcher}>
      {children}
    </LiveDataFetchContext.Provider>
  )
}

export function useLiveDataFetch() {
  return useContext(LiveDataFetchContext)
}
