import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authApi } from '@/api/auth'
import { authKeys } from '@/hooks/useAuth'
import { vendorKeys } from '@/hooks/useVendor'
import { useAuthStore } from '@/stores/authStore'
import { useVendorStore } from '@/stores/vendorStore'
import { PageLoading } from '@/components/common/Loading'
import { extractApiError } from '@/lib/errorMessages'

export default function VendorHandoff() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setTokens, logout } = useAuthStore()
  const setVendor = useVendorStore((s) => s.setVendor)

  const token = searchParams.get('token')?.trim() ?? ''

  useEffect(() => {
    if (!token) {
      toast.error('Missing secure handoff token — open the vendor app from the admin portal again.')
      navigate('/login', { replace: true })
      return
    }

    let cancelled = false
    void (async () => {
      try {
        logout()
        useVendorStore.getState().clearVendor()
        qc.removeQueries({ queryKey: vendorKeys.all })
        qc.removeQueries({ queryKey: authKeys.me() })
        const res = await authApi.redeemVendorHandoff(token)
        if (cancelled) return
        const { vendor, ...tok } = res
        setTokens(tok)
        setVendor(vendor)
        void qc.invalidateQueries({ queryKey: authKeys.me() })
        void qc.invalidateQueries({ queryKey: vendorKeys.me() })
        toast.success('Signed in — managing this business with your platform account.')
        navigate('/', { replace: true })
      } catch (err) {
        if (!cancelled) {
          toast.error(extractApiError(err, 'Handoff failed — try again from the admin portal'))
          navigate('/login', { replace: true })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, navigate, qc, setTokens, setVendor, logout])

  return <PageLoading />
}
