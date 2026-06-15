import { Navigate } from 'react-router-dom'
import { useIsVendorAdmin } from '@/hooks/usePermissions'

export default function VendorAdminRoute({ children }: { children: React.ReactNode }) {
  const isVendorAdmin = useIsVendorAdmin()
  if (!isVendorAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}
