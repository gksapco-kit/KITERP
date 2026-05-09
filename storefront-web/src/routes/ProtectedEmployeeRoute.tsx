import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useCustomerMe } from '@/hooks/useStore'
import { PageLoading } from '@/components/common/Loading'
import { ShieldX } from 'lucide-react'

export default function ProtectedEmployeeRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { storePath } = useVendor()
  const { accessToken, isAuthenticated, customer } = useAuthStore()
  const { isLoading, isError } = useCustomerMe()

  if (!accessToken) {
    return <Navigate to={storePath('/login')} state={{ from: location }} replace />
  }

  if (isLoading) return <PageLoading />

  if (isError || !isAuthenticated) {
    return <Navigate to={storePath('/login')} state={{ from: location }} replace />
  }

  if (!(customer as any)?.is_employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <ShieldX className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Employee Access Only</h2>
        <p className="text-gray-500 max-w-sm">
          This section is restricted to employees. If you believe this is an error, please contact your manager or HR.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
