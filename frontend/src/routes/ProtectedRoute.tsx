import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useMe } from '@/hooks/useAuth'
import { PageLoading } from '@/components/common/Loading'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const { accessToken, isAuthenticated } = useAuthStore()
  const { isLoading, isError } = useMe()

  // No token at all
  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Loading user data
  if (isLoading) {
    return <PageLoading />
  }

  // Error fetching user (invalid token)
  if (isError) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Not authenticated after loading
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
