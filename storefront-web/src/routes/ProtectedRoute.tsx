import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useCustomerMe } from '@/hooks/useStore'
import { useEffectiveBranch } from '@/hooks/useEffectiveVendor'
import { useBranch } from '@/contexts/BranchContext'
import { useIsCustomerLoggedIn } from '@/hooks/useAuthHydrated'
import { PageLoading } from '@/components/common/Loading'

function sameId(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Hard mismatch only when BOTH sides declare an id and they differ.
 * A missing customer.store_id or branch.id is never a mismatch — the API is
 * the source of truth and will 401 on a real violation.
 */
function isStoreScopeMismatch(
  customer: { vendor_id?: string | null; store_id?: string | null } | null,
  vendorId: string | undefined,
  branchId: string | undefined,
): boolean {
  if (!customer) return false
  if (vendorId && customer.vendor_id && !sameId(customer.vendor_id, vendorId)) return true
  // Only check branch when the customer was created under a specific BU.
  if (customer.store_id && branchId && !sameId(customer.store_id, branchId)) return true
  return false
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { storePath, vendor } = useVendor()
  const branch = useEffectiveBranch()
  const { loading: branchLoading } = useBranch()
  const { ready: authReady, isLoggedIn } = useIsCustomerLoggedIn()
  const { isAuthenticated, customer, logout } = useAuthStore()
  const { isLoading: meLoading, isError: meIsError, isFetching: meFetching, data: me } = useCustomerMe()

  const returnTo = `${location.pathname}${location.search}`

  // Never fire the mismatch check while branches are still resolving — the branch
  // id flips from null → value on first load, which would eject a valid user.
  const storeMismatch = !branchLoading && isStoreScopeMismatch(customer, vendor?.id, branch?.id)

  useEffect(() => {
    if (storeMismatch) logout()
  }, [storeMismatch, logout])

  // Wait for persist rehydration AND branch resolution before deciding anything.
  if (!authReady || branchLoading) return <PageLoading />

  // Definitive mismatch (wrong vendor) — send to login with return URL.
  if (storeMismatch) {
    return <Navigate to={storePath('/login')} state={{ from: returnTo }} replace />
  }

  // No token at all → not signed in.
  if (!isLoggedIn) {
    return <Navigate to={storePath('/login')} state={{ from: returnTo }} replace />
  }

  // Profile is still loading (first mount) — keep the shell visible.
  if (meLoading || (meFetching && !me && !customer)) return <PageLoading />

  // Profile fetch failed and we have no cached customer either.
  if (meIsError && !customer && !me) {
    return <Navigate to={storePath('/login')} state={{ from: returnTo }} replace />
  }

  return <>{children}</>
}
