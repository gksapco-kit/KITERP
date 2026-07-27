import { useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '@/api/admin.api'
import { Button } from '@/components/ui/button'
import { vendorAppPublicBaseUrl } from '@/lib/appUrls'
import {
  HR_ADMIN_NAV_ITEMS,
  getHrAdminNavItem,
  hrAdminPath,
} from '@/lib/hrAdminNav'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff } from '@/lib/platformAccess'

const PLATFORM_HR_SESSION_KEY = 'kiterp-platform'

function vendorBase(): string {
  return vendorAppPublicBaseUrl()
}

function buildHandoffUrl(handoffToken: string, vendorPath: string): string {
  const params = new URLSearchParams({
    token: handoffToken,
    next: vendorPath,
    embed: '1',
  })
  return `${vendorBase()}/auth/handoff?${params.toString()}`
}

/** Full browser URL for an already-authenticated embed session (prod: /vendor/hr/...). */
function buildEmbedPageUrl(vendorPath: string): string {
  const base = vendorBase()
  const path = vendorPath.startsWith('/') ? vendorPath : `/${vendorPath}`
  if (path.includes('embed=')) return `${base}${path}`
  return `${base}${path}${path.includes('?') ? '&' : '?'}embed=1`
}

/**
 * Open a vendor HR route in the iframe without a new handoff.
 * Same-origin (kiterp.com/admin + /vendor): location.assign.
 * Cross-origin (local 3000/3001): iframe.src.
 */
function navigateIframe(iframe: HTMLIFrameElement | null, vendorPath: string) {
  if (!iframe) return
  const url = buildEmbedPageUrl(vendorPath)
  try {
    const win = iframe.contentWindow
    if (win && win.location.origin === window.location.origin) {
      const current = `${win.location.pathname}${win.location.search}`
      const targetPath = new URL(url, window.location.origin)
      const target = `${targetPath.pathname}${targetPath.search}`
      if (current !== target) {
        win.location.assign(url)
      }
      return
    }
  } catch {
    /* cross-origin — fall through */
  }
  if (iframe.src !== url) {
    iframe.src = url
  } else {
    // Force reload when React kept the same src string but content is stale.
    iframe.src = url
  }
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
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const requestSeq = useRef(0)

  useEffect(() => {
    if (!getHrAdminNavItem(section) || hrItem.native || !hrItem.vendorPath) return

    const vendorPath = hrItem.vendorPath

    // After the first handoff, switch menus by navigating the iframe URL directly
    // (no postMessage). Correct for prod /admin + /vendor on the same host.
    if (sessionReadyRef.current) {
      const nextSrc = buildEmbedPageUrl(vendorPath)
      setIframeSrc(nextSrc)
      // Defer so the iframe element exists with the latest ref after state commit.
      requestAnimationFrame(() => {
        navigateIframe(iframeRef.current, vendorPath)
      })
      setLoadingFrame(false)
      return
    }

    const seq = ++requestSeq.current
    let cancelled = false

    const run = async () => {
      setLoadingFrame(true)
      setHandoffError(null)
      try {
        const res = await adminApi.createPlatformHrDashboardHandoff()
        if (cancelled || seq !== requestSeq.current) return
        setIframeSrc(buildHandoffUrl(res.handoff_token, vendorPath))
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
              : 'Could not open Kiterp HR module'
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
      const params = new URLSearchParams({
        token: res.handoff_token,
        next: hrItem.vendorPath!,
      })
      window.open(`${vendorBase()}/auth/handoff?${params.toString()}`, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('Could not open HR in a new tab')
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-white lg:h-screen">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hrItem.label}</h1>
          <p className="mt-1 text-sm text-gray-500">KIT ERP · HR Management</p>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
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
            ref={iframeRef}
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
