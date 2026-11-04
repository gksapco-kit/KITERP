import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'

/** Wait for zustand persist before reading accessToken — avoids /login redirect on HMR reload. */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated())

  useEffect(() => {
    if (hydrated) return undefined
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true))
    if (useAuthStore.persist.hasHydrated()) setHydrated(true)
    // Failsafe: never block the app if persist hydration never fires (corrupt storage, etc.).
    const failSafe = window.setTimeout(() => setHydrated(true), 2500)
    return () => {
      unsub()
      window.clearTimeout(failSafe)
    }
  }, [hydrated])

  return hydrated
}
