import { useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '@/api/admin.api'
import { Button } from '@/components/ui/button'
import { vendorAppBaseUrl } from '@/lib/appUrls'
import {
  HR_ADMIN_NAV_ITEMS,
  getHrAdminNavItem,
  hrAdminPath,
} from '@/lib/hrAdminNav'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff } from '@/lib/platformAccess'

const PLATFORM_HR_SESSION_KEY = 'kiterp-platform'

function vendorAppOrigin(): string {
  let base = vendorAppBaseUrl.replace(/\/$/, '')
  try {
    const u = new URL(base)
    if (u.hostname === 'localhost' || u.hostname === '[::1]') {
      u.hostname = '127.0.0.1'
      base = u.origin
    }
  } catch {
    /* keep base */
  }
  return base
}

function buildHandoffUrl(handoffToken: string, vendorPath: string, embed: boolean): string {
  const params = new URLSearchParams({
    token: handoffToken,
    next: vendorPath,
  })
  if (embed) params.set('embed', '1')
  return `${vendorAppOrigin()}/auth/handoff?${params.toString()}`
}

export default function HrManagement() {
  const { user } = useAuthStore()
  const allowed = isPlatformStaff(user)
  const { section } = useParams<{ section?: string }>()
  const hrItem = getHrAdminNavItem(section) ?? HR_ADMIN_NAV_ITEMS[0]

  const [iframeSrc, setIframeSrc] = useState<string | null>(null)
  const [loadingFrame, setLoadingFrame] = useState(false)
  const [handoffError, setHandoffError] = useState<string | null>(null)
  const [frameEpoch, setFrameEpoch] = useState(0)
  const sessionReadyRef = useRef(false)
  const requestSeq = useRef(0)

  useEffect(() => {
    if (!getHrAdminNavItem(section) || hrItem.native || !hrItem.vendorPath) return

    const seq = ++requestSeq.current
    let cancelled = false
    const targetPath = `${vendorAppOrigin()}${hrItem.vendorPath}`
    const embedTarget = `${targetPath}${targetPath.includes('?') ? '&' : '?'}embed=1`

    // Already signed into KIT ERP platform HR — change route only.
    if (sessionReadyRef.current) {
      setIframeSrc(embedTarget)
      setLoadingFrame(false)
      return
    }

    const run = async () => {
      setLoadingFrame(true)
      setHandoffError(null)
      try {
        const res = await adminApi.createPlatformHrDashboardHandoff()
        if (cancelled || seq !== requestSeq.current) return
        setIframeSrc(buildHandoffUrl(res.handoff_token, hrItem.vendorPath!, true))
        sessionReadyRef.current = true
      } catch (err) {
        if (cancelled || seq !== requestSeq.current) return
        setIframeSrc(null)
        sessionReadyRef.current = false
        const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
        const msg =
          typeof detail === 'string'
            ? detail
            : detail != null
              ? JSON.stringify(detail)
              : 'Could not open KIT ERP HR module'
        setHandoffError(msg)
        toast.error(msg)
      } finally {
        if (!cancelled && seq === requestSeq.current) setLoadingFrame(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [hrItem.vendorPath, hrItem.native, section, frameEpoch])

  if (!allowed) {
    return <Navigate to="/dashboard" replace />
  }

  if (!section) {
    return <Navigate to={hrAdminPath('employees')} replace />
  }

  if (!getHrAdminNavItem(section)) {
    return <Navigate to={hrAdminPath('employees')} replace />
  }

  if (hrItem.native) {
    return <Navigate to={hrAdminPath(hrItem.slug)} replace />
  }

  const reloadFrame = () => {
    sessionReadyRef.current = false
    setIframeSrc(null)
    setHandoffError(null)
    setFrameEpoch((k) => k + 1)
  }

  const openExternal = async () => {
    try {
      const res = await adminApi.createPlatformHrDashboardHandoff()
      window.open(
        buildHandoffUrl(res.handoff_token, hrItem.vendorPath!, false),
        '_blank',
        'noopener,noreferrer',
      )
    } catch {
      toast.error('Could not open HR in a new tab')
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-gray-50 lg:h-screen">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">KIT ERP</p>
          <p className="truncate text-xs text-gray-500">Super Admin · HR Management</p>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loadingFrame}
            onClick={reloadFrame}
            title="Reload HR module"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void openExternal()}
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        {loadingFrame ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <div className="flex flex-col items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p>Loading {hrItem.label}…</p>
            </div>
          </div>
        ) : null}

        {!loadingFrame && handoffError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-gray-600">
            <p className="font-medium text-gray-900">Could not open {hrItem.label}</p>
            <p className="max-w-md">{handoffError}</p>
            <Button type="button" size="sm" variant="outline" onClick={reloadFrame}>
              Retry
            </Button>
          </div>
        ) : null}

        {iframeSrc ? (
          <iframe
            key={`${PLATFORM_HR_SESSION_KEY}:${frameEpoch}`}
            title={`HR · ${hrItem.label}`}
            src={iframeSrc}
            className="h-full w-full border-0"
            allow="clipboard-read; clipboard-write"
          />
        ) : null}
      </div>
    </div>
  )
}
