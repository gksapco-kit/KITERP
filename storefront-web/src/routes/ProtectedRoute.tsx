import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useCustomerMe } from '@/hooks/useStore'
import { useEffectiveBranch } from '@/hooks/useEffectiveVendor'
import { PageLoading } from '@/components/common/Loading'

function sameId(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Only treat as a hard mismatch when both sides declare a store/vendor id and they differ.
 * Missing customer.store_id (stale persisted profile) must not log the user out — /auth/me is the source of truth.
 */
function isStoreScopeMismatch(
  customer: { vendor_id?: string | null; store_id?: string | null } | null,
  vendorId: string | undefined,
  branchId: string | undefined,
): boolean {
  if (!customer) return false
  if (vendorId && customer.vendor_id && !sameId(customer.vendor_id, vendorId)) return true
  if (customer.store_id && branchId && !sameId(customer.store_id, branchId)) return true
  return false
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { storePath, vendor } = useVendor()
  const branch = useEffectiveBranch()
  const { accessToken, isAuthenticated, customer, logout } = useAuthStore()
  const { isLoading, isError, isFetching, data: me } = useCustomerMe()

  const storeMismatch = isStoreScopeMismatch(customer, vendor?.id, branch?.id)

  useEffect(() => {
    if (storeMismatch) logout()
  }, [storeMismatch, logout])

  if (storeMismatch || !accessToken) {
    return <Navigate to={storePath('/login')} state={{ from: location }} replace />
  }
  // Keep showing the shell while profile loads; do not bounce on a stale query error
  // when we still have a local session (me will refetch / interceptor handles real 401s).
  if (isLoading || (isFetching && !me && !customer)) return <PageLoading />
  if (!isAuthenticated && !customer) {
    return <Navigate to={storePath('/login')} state={{ from: location }} replace />
  }
  if (isError && !customer && !me) {
    return <Navigate to={storePath('/login')} state={{ from: location }} replace />
  }

  return <>{children}</>
}
