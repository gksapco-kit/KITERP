import { useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useMe } from '@/hooks/useAuth'
import { PageLoading } from '@/components/common/Loading'

// Hard timeout: if /auth/me hasn't resolved after 10s, treat as unauthenticated
const AUTH_TIMEOUT_MS = 10_000

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { accessToken, isAuthenticated, logout } = useAuthStore()
  const me = useMe()
  const { isError, data: meData, isPending, isFetching } = me
  const [timedOut, setTimedOut] = useState(false)

  /** Wait only until the first /auth/me result — avoids relying on `isLoading` semantics across RQ versions. */
  const waitingOnSession =
    Boolean(accessToken) && !isError && meData === undefined && (isPending || isFetching)

  useEffect(() => {
    if (!waitingOnSession) return
    const id = setTimeout(() => {
      logout()
      setTimedOut(true)
    }, AUTH_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [waitingOnSession, logout])

  if (!accessToken || timedOut) return <Navigate to="/login" state={{ from: location }} replace />
  if (waitingOnSession) return <PageLoading />
  if (isError || !isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />

  return <>{children}</>
}
