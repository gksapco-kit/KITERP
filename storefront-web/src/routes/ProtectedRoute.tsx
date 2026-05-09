import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useCustomerMe } from '@/hooks/useStore'
import { PageLoading } from '@/components/common/Loading'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { storePath } = useVendor()
  const { accessToken, isAuthenticated } = useAuthStore()
  const { isLoading, isError } = useCustomerMe()

  if (!accessToken) return <Navigate to={storePath('/login')} state={{ from: location }} replace />
  if (isLoading) return <PageLoading />
  if (isError || !isAuthenticated) return <Navigate to={storePath('/login')} state={{ from: location }} replace />

  return <>{children}</>
}
