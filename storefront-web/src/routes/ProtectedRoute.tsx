import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useCustomerMe } from '@/hooks/useStore'
import { useEffectiveBranch } from '@/hooks/useEffectiveVendor'
import { PageLoading } from '@/components/common/Loading'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { storePath, vendor } = useVendor()
  const branch = useEffectiveBranch()
  const { accessToken, isAuthenticated, customer, logout } = useAuthStore()
  const { isLoading, isError } = useCustomerMe()

  const storeMismatch =
    !!customer &&
    ((vendor?.id && customer.vendor_id && customer.vendor_id !== vendor.id) ||
      (branch?.id && (customer.store_id || null) !== branch.id) ||
      (!branch?.id && !!customer.store_id))

  useEffect(() => {
    if (storeMismatch) logout()
  }, [storeMismatch, logout])

  if (storeMismatch || !accessToken) {
    return <Navigate to={storePath('/login')} state={{ from: location }} replace />
  }
  if (isLoading) return <PageLoading />
  if (isError || !isAuthenticated) return <Navigate to={storePath('/login')} state={{ from: location }} replace />

  return <>{children}</>
}
