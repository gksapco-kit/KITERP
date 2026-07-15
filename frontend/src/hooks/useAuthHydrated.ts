import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'

/** Wait for zustand persist before reading accessToken — avoids /login redirect on reload. */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated())

  useEffect(() => {
    if (hydrated) return undefined
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true))
  }, [hydrated])

  return hydrated
}
