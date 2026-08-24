import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { readScopedCustomerTokens } from '@/lib/customerAuthStorage'

/** True after zustand persist has rehydrated customer auth from localStorage. */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => {
    try {
      return useAuthStore.persist.hasHydrated()
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      if (useAuthStore.persist.hasHydrated()) {
        setHydrated(true)
        return
      }
      return useAuthStore.persist.onFinishHydration(() => setHydrated(true))
    } catch {
      setHydrated(true)
    }
  }, [])

  return hydrated
}

/**
 * Prefer this over raw `isAuthenticated` for gatekeeping redirects.
 * Avoids bounce-to-login during persist rehydrate or when tokens exist
 * but the boolean flag briefly lags.
 */
export function useIsCustomerLoggedIn(): { ready: boolean; isLoggedIn: boolean } {
  const ready = useAuthHydrated()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const accessToken = useAuthStore((s) => s.accessToken)
  const customer = useAuthStore((s) => s.customer)

  const scopedToken = ready ? !!readScopedCustomerTokens().access : false
  const isLoggedIn = !!(isAuthenticated || accessToken || customer || scopedToken)

  return { ready, isLoggedIn }
}

/** True only when a bearer token exists — not a stale cached customer profile alone. */
export function hasActiveCustomerSession(): boolean {
  const state = useAuthStore.getState()
  const { access } = readScopedCustomerTokens()
  return !!(access || (state.isAuthenticated && state.accessToken))
}

export function useHasActiveCustomerSession(): { ready: boolean; hasSession: boolean } {
  const ready = useAuthHydrated()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const accessToken = useAuthStore((s) => s.accessToken)
  const scopedToken = ready ? !!readScopedCustomerTokens().access : false
  const hasSession = !!(scopedToken || (isAuthenticated && accessToken))
  return { ready, hasSession }
}
