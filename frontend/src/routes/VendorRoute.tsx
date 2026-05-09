import { Navigate } from 'react-router-dom'
import { useMyVendor } from '@/hooks/useVendor'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff } from '@/lib/platformAccess'
import { PageLoading } from '@/components/common/Loading'

interface VendorRouteProps {
  children: React.ReactNode
}

export default function VendorRoute({ children }: VendorRouteProps) {
  const { user } = useAuthStore()
  const { data: vendor, isLoading, isError } = useMyVendor()

  // Platform staff (superuser or support) bypass vendor check — admin app on :3000
  if (isPlatformStaff(user)) {
    return <>{children}</>
  }

  // Loading vendor data
  if (isLoading) {
    return <PageLoading />
  }

  // No vendor found - redirect to onboarding
  if (isError || !vendor) {
    return <Navigate to="/onboarding" replace />
  }

  // Vendor not approved yet - allow access but could show limited view
  if (vendor.status !== 'approved') {
    // Allow access
  }

  return <>{children}</>
}
