import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useMe } from '@/hooks/useAuth'
import { useAuthHydrated } from '@/hooks/useAuthHydrated'
import { PageLoading } from '@/components/common/Loading'
import { isAxiosAuthError, isAxiosNetworkError } from '@/lib/errorMessages'
import { isVendorAdminEmbed } from '@/lib/adminEmbed'

const AUTH_RETRY_MS = import.meta.env.DEV ? 60_000 : 30_000

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const hydrated = useAuthHydrated()
  const { accessToken, isAuthenticated, logout } = useAuthStore()
  const me = useMe()
  const { isError, error, data: meData, isPending, isFetching, refetch } = me

  const networkFailure = isError && isAxiosNetworkError(error)
  const authFailure = isError && isAxiosAuthError(error)

  const waitingOnSession =
    Boolean(accessToken) && !isError && meData === undefined && (isPending || isFetching)

  // Slow API (builder save, cold start) — retry instead of forcing logout.
  useEffect(() => {
    if (!waitingOnSession) return undefined
    const id = setTimeout(() => {
      void refetch()
    }, AUTH_RETRY_MS)
    return () => clearTimeout(id)
  }, [waitingOnSession, refetch])

  // Temporary API/network blips — retry instead of logging out.
  useEffect(() => {
    if (!networkFailure || !accessToken) return undefined
    const interval = import.meta.env.DEV ? 3000 : 5000
    const id = window.setInterval(() => void refetch(), interval)
    return () => window.clearInterval(id)
  }, [networkFailure, accessToken, refetch])

  if (!hydrated) return <PageLoading />

  const embedQs =
    new URLSearchParams(location.search).get('embed') === '1' || isVendorAdminEmbed()
      ? '?embed=1'
      : ''
  const loginPath = `/login${embedQs}`

  if (!accessToken) return <Navigate to={loginPath} state={{ from: location }} replace />
  if (waitingOnSession || networkFailure) {
    return (
      <PageLoading />
    )
  }
  if (authFailure || isError) {
    logout()
    return <Navigate to={loginPath} state={{ from: location }} replace />
  }
  if (!isAuthenticated) return <Navigate to={loginPath} state={{ from: location }} replace />

  return <>{children}</>
}
