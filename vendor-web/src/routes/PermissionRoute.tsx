import { Navigate } from 'react-router-dom'
import { useHasPermission, useIsVendorAdmin } from '@/hooks/usePermissions'

interface Props {
  permission: string
  children: React.ReactNode
}

/**
 * Redirects to "/" when the current vendor user does not have the required
 * permission. Owner and admin users bypass the check.
 */
export default function PermissionRoute({ permission, children }: Props) {
  const isAdmin = useIsVendorAdmin()
  const hasPermission = useHasPermission(permission)
  if (!isAdmin && !hasPermission) return <Navigate to="/" replace />
  return <>{children}</>
}
