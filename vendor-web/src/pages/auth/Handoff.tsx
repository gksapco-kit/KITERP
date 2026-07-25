import { useEffect, useRef } from 'react'
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
import { setVendorAdminEmbed } from '@/lib/adminEmbed'

/** Allow only same-app relative paths (e.g. /hr/employees). Blocks protocol-relative and external URLs. */
function safeHandoffNextPath(raw: string | null): string {
  const next = (raw || '').trim()
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('://')) return '/'
  if (next.includes('\\') || next.includes('\0')) return '/'
  return next
}

/** Survive React Strict Mode remounts so one-time handoff tokens are only redeemed once. */
const redeemInFlight = new Map<string, Promise<void>>()

export default function VendorHandoff() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const mountedRef = useRef(true)

  const token = searchParams.get('token')?.trim() ?? ''
  const nextPath = safeHandoffNextPath(searchParams.get('next'))
  const embed = searchParams.get('embed') === '1'

  useEffect(() => {
    mountedRef.current = true

    if (!token) {
      toast.error('Missing secure handoff token — open the vendor app from the admin portal again.')
      navigate('/login', { replace: true })
      return
    }

    let existing = redeemInFlight.get(token)
    if (!existing) {
      existing = (async () => {
        useAuthStore.getState().logout()
        useVendorStore.getState().clearVendor()
        qc.removeQueries({ queryKey: vendorKeys.all })
        qc.removeQueries({ queryKey: authKeys.me() })

        const res = await authApi.redeemVendorHandoff(token)
        const { vendor, ...tok } = res
        useAuthStore.getState().setTokens(tok)
        useVendorStore.getState().setVendor(vendor)
        setVendorAdminEmbed(embed)

        void qc.invalidateQueries({ queryKey: authKeys.me() })
        void qc.invalidateQueries({ queryKey: vendorKeys.me() })
      })().finally(() => {
        // Keep map entry briefly so Strict Mode remount reuses success instead of re-redeeming.
        window.setTimeout(() => redeemInFlight.delete(token), 15_000)
      })
      redeemInFlight.set(token, existing)
    }

    void existing
      .then(() => {
        if (!mountedRef.current) return
        if (!embed) {
          toast.success('Signed in — managing this business with your platform account.')
        }
        const dest =
          embed && !nextPath.includes('embed=')
            ? `${nextPath}${nextPath.includes('?') ? '&' : '?'}embed=1`
            : nextPath
        navigate(dest, { replace: true })
      })
      .catch((err) => {
        if (!mountedRef.current) return
        redeemInFlight.delete(token)
        toast.error(extractApiError(err, 'Handoff failed — try again from the admin portal'))
        navigate(embed ? '/login?embed=1' : '/login', { replace: true })
      })

    return () => {
      mountedRef.current = false
    }
  }, [token, nextPath, embed, navigate, qc])

  return <PageLoading />
}
