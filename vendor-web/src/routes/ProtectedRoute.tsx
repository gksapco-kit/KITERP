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
  const { isLoading, isError, fetchStatus } = useMe()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!isLoading || fetchStatus === 'idle') return
    const id = setTimeout(() => {
      logout()
      setTimedOut(true)
    }, AUTH_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [isLoading, fetchStatus, logout])

  if (!accessToken || timedOut) return <Navigate to="/login" state={{ from: location }} replace />
  if (isLoading && fetchStatus !== 'idle') return <PageLoading />
  if (isError || !isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />

  return <>{children}</>
}
