import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'

/** Near-live poll so Contact Us submissions update the badge/list quickly. */
export const CONTACT_QUERY_POLL_MS = 3_000

export const contactQueryKeys = {
  all: ['vendor-contact-queries'] as const,
  list: (status?: string) => [...contactQueryKeys.all, status ?? ''] as const,
  newCount: () => [...contactQueryKeys.all, 'new-count'] as const,
}

/** Count of storefront Contact Us queries still in `new` status (for nav badge). */
export function useNewContactQueryCount(enabled = true) {
  return useQuery({
    queryKey: contactQueryKeys.newCount(),
    queryFn: async () => {
      const res = await apiClient.get('/vendors/me/contact-queries', {
        params: { status: 'new', size: 1 },
      })
      return (res.data as { total: number }).total ?? 0
    },
    enabled,
    staleTime: 0,
    refetchInterval: CONTACT_QUERY_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  })
}
