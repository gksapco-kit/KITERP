import { useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '@/api/admin.api'
import { Button } from '@/components/ui/button'
import { vendorAppBaseUrl } from '@/lib/appUrls'
import {
  ADMIN_EMBED_HIDE_CAREERS,
  ADMIN_EMBED_SHOW_CAREERS,
} from '@/lib/adminEmbedAuth'
import {
  HR_ADMIN_NAV_ITEMS,
  getHrAdminNavItem,
  hrAdminPath,
} from '@/lib/hrAdminNav'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff } from '@/lib/platformAccess'
import CareerApplications from '@/pages/dashboard/CareerApplications'

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

function allowedEmbedOrigin(eventOrigin: string): boolean {
  if (eventOrigin === window.location.origin) return true
  try {
    return eventOrigin === new URL(vendorAppBaseUrl).origin
  } catch {
    return false
  }
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
  const [showCareersInbox, setShowCareersInbox] = useState(false)
  const sessionReadyRef = useRef(false)
  const requestSeq = useRef(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!allowedEmbedOrigin(event.origin) && event.origin !== window.location.origin) return
      const data = event.data as { type?: string; tab?: string } | null
      const type = data?.type
      if (type === ADMIN_EMBED_SHOW_CAREERS) setShowCareersInbox(true)
      if (type === ADMIN_EMBED_HIDE_CAREERS) setShowCareersInbox(false)
      if (type === 'kiterp:hr:open-pipeline') {
        setShowCareersInbox(false)
        const frame = iframeRef.current?.contentWindow
        if (frame) {
          try {
            frame.postMessage(event.data, new URL(vendorAppBaseUrl).origin)
          } catch {
            frame.postMessage(event.data, '*')
          }
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    // Leaving Recruitment (or remounting) must close the Careers overlay.
    setShowCareersInbox(false)
  }, [section, frameEpoch])

  useEffect(() => {
    if (!getHrAdminNavItem(section) || hrItem.native || !hrItem.vendorPath) return

    const seq = ++requestSeq.current
    let cancelled = false

    const run = async () => {
      setLoadingFrame(true)
      setHandoffError(null)
      setIframeSrc(null)
      try {
        // Always SSO via handoff — never open vendor-web routes bare (that shows Sign in).
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
    setShowCareersInbox(false)
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

  const switchRecruitmentTab = (next: 'jobs' | 'interviews') => {
    setShowCareersInbox(false)
    const frame = iframeRef.current?.contentWindow
    if (!frame) return
    try {
      frame.postMessage({ type: 'kiterp:hr:set-tab', tab: next }, new URL(vendorAppBaseUrl).origin)
    } catch {
      frame.postMessage({ type: 'kiterp:hr:set-tab', tab: next }, '*')
    }
  }

  const careersOverlay =
    showCareersInbox && section === 'recruitment' ? (
      <div className="absolute inset-0 z-20 flex flex-col bg-white">
        <div className="flex shrink-0 gap-1 border-b border-gray-200 px-4 pt-3 sm:px-6">
          <button
            type="button"
            onClick={() => switchRecruitmentTab('jobs')}
            className="-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            Jobs
          </button>
          <button
            type="button"
            className="-mb-px border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary"
          >
            Careers
          </button>
          <button
            type="button"
            onClick={() => switchRecruitmentTab('interviews')}
            className="-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            Interviews
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          <CareerApplications embedded />
        </div>
      </div>
    ) : null

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
            ref={iframeRef}
            key={`${PLATFORM_HR_SESSION_KEY}:${frameEpoch}`}
            title={`HR · ${hrItem.label}`}
            src={iframeSrc}
            className="h-full w-full border-0"
            allow="clipboard-read; clipboard-write"
          />
        ) : null}

        {careersOverlay}
      </div>
    </div>
  )
}
