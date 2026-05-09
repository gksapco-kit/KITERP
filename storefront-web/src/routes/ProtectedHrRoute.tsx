import { useLayoutEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useVendor } from '@/contexts/VendorContext'
import { useHrAuthStore } from '@/stores/hrAuthStore'
import hrApiClient from '@/api/hrClient'
import { PageLoading } from '@/components/common/Loading'

async function fetchHrMe() {
  const res = await hrApiClient.get('/store/hr/me')
  return res.data as { full_name?: string | null; employee_id?: string | null }
}

export default function ProtectedHrRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { storePath } = useVendor()
  const accessToken = useHrAuthStore((s) => s.accessToken)

  useLayoutEffect(() => {
    if (accessToken) {
      localStorage.setItem('employee_access_token', accessToken)
    }
  }, [accessToken])

  const { isLoading, isError } = useQuery({
    queryKey: ['hr-me', accessToken],
    queryFn: fetchHrMe,
    enabled: !!accessToken,
    retry: false,
    staleTime: 60_000,
  })

  if (!accessToken) {
    return <Navigate to={storePath('/hr/login')} state={{ from: location }} replace />
  }

  if (isLoading) return <PageLoading />

  if (isError) {
    return <Navigate to={storePath('/hr/login')} state={{ from: location }} replace />
  }

  return <>{children}</>
}
