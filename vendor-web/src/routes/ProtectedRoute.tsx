import { useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useMe } from '@/hooks/useAuth'
import { useAuthHydrated } from '@/hooks/useAuthHydrated'
import { PageLoading } from '@/components/common/Loading'
import { isAxiosAuthError, isAxiosNetworkError } from '@/lib/errorMessages'

const AUTH_TIMEOUT_MS = import.meta.env.DEV ? 60_000 : 10_000

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const hydrated = useAuthHydrated()
  const { accessToken, isAuthenticated, logout } = useAuthStore()
  const me = useMe()
  const { isError, error, data: meData, isPending, isFetching, refetch } = me
  const [timedOut, setTimedOut] = useState(false)

  const networkFailure = isError && isAxiosNetworkError(error)
  const authFailure = isError && isAxiosAuthError(error)

  const waitingOnSession =
    Boolean(accessToken) && !isError && meData === undefined && (isPending || isFetching)

  useEffect(() => {
    if (!waitingOnSession) return undefined
    const id = setTimeout(() => {
      logout()
      setTimedOut(true)
    }, AUTH_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [waitingOnSession, logout])

  // Dev: backend uvicorn --reload briefly drops connections — retry instead of logging out.
  useEffect(() => {
    if (!import.meta.env.DEV || !networkFailure || !accessToken) return undefined
    const id = window.setInterval(() => void refetch(), 3000)
    return () => window.clearInterval(id)
  }, [networkFailure, accessToken, refetch])

  if (!hydrated) return <PageLoading />

  if (!accessToken || timedOut) return <Navigate to="/login" state={{ from: location }} replace />
  if (waitingOnSession || networkFailure) {
    return (
      <PageLoading />
    )
  }
  if (authFailure || isError) {
    logout()
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />

  return <>{children}</>
}
