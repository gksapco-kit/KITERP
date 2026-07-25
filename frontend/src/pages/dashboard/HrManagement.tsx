import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ExternalLink, Loader2, RefreshCw, Store } from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '@/api/admin.api'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useAdminVendors } from '@/hooks/useAdmin'
import { vendorAppBaseUrl } from '@/lib/appUrls'
import {
  HR_ADMIN_NAV_ITEMS,
  getHrAdminNavItem,
  hrAdminPath,
} from '@/lib/hrAdminNav'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff } from '@/lib/platformAccess'

const HR_VENDOR_STORAGE_KEY = 'kiterp.admin.hrVendorId'

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

function readStoredVendorId(): string {
  try {
    return localStorage.getItem(HR_VENDOR_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function storeVendorId(id: string) {
  try {
    if (id) localStorage.setItem(HR_VENDOR_STORAGE_KEY, id)
    else localStorage.removeItem(HR_VENDOR_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export default function HrManagement() {
  const { user } = useAuthStore()
  const allowed = isPlatformStaff(user)
  const { section } = useParams<{ section?: string }>()
  const hrItem = getHrAdminNavItem(section) ?? HR_ADMIN_NAV_ITEMS[0]

  const [selectedVendorId, setSelectedVendorId] = useState(readStoredVendorId)
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)
  const [loadingFrame, setLoadingFrame] = useState(false)
  const [frameEpoch, setFrameEpoch] = useState(0)
  const sessionVendorIdRef = useRef<string | null>(null)
  const requestSeq = useRef(0)

  const { data, isLoading } = useAdminVendors({
    page: 1,
    size: 100,
    status: 'approved',
  })

  const vendors = data?.items ?? []

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === selectedVendorId) ?? null,
    [vendors, selectedVendorId],
  )

  const vendorOptions = useMemo(
    () =>
      vendors.length
        ? vendors.map((v) => ({
            value: v.id,
            label: v.slug ? `${v.display_name} (${v.slug})` : v.display_name,
          }))
        : [{ value: '', label: 'No approved accounts' }],
    [vendors],
  )

  useEffect(() => {
    if (!vendors.length) return
    if (selectedVendorId && vendors.some((v) => v.id === selectedVendorId)) return
    const next = vendors[0].id
    setSelectedVendorId(next)
    storeVendorId(next)
  }, [vendors, selectedVendorId])

  useEffect(() => {
    if (!selectedVendorId || !getHrAdminNavItem(section)) return

    const seq = ++requestSeq.current
    let cancelled = false
    const targetPath = `${vendorAppOrigin()}${hrItem.vendorPath}`
    const embedTarget = `${targetPath}${targetPath.includes('?') ? '&' : '?'}embed=1`

    // Already signed into this business account in the iframe — change HR route only.
    if (sessionVendorIdRef.current === selectedVendorId) {
      setIframeSrc(embedTarget)
      setLoadingFrame(false)
      return
    }

    const run = async () => {
      setLoadingFrame(true)
      try {
        const res = await adminApi.createVendorDashboardHandoff(selectedVendorId)
        if (cancelled || seq !== requestSeq.current) return
        setIframeSrc(buildHandoffUrl(res.handoff_token, hrItem.vendorPath, true))
        sessionVendorIdRef.current = selectedVendorId
      } catch (err) {
        if (cancelled || seq !== requestSeq.current) return
        setIframeSrc(null)
        sessionVendorIdRef.current = null
        const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
        const msg =
          typeof detail === 'string'
            ? detail
            : detail != null
              ? JSON.stringify(detail)
              : 'Could not open HR module for this business account'
        toast.error(msg)
      } finally {
        if (!cancelled && seq === requestSeq.current) setLoadingFrame(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [selectedVendorId, hrItem.vendorPath, section, frameEpoch])

  if (!allowed) {
    return <Navigate to="/dashboard" replace />
  }

  if (!section) {
    return <Navigate to={hrAdminPath('employees')} replace />
  }

  if (!getHrAdminNavItem(section)) {
    return <Navigate to={hrAdminPath('employees')} replace />
  }

  const onVendorChange = (id: string) => {
    setSelectedVendorId(id)
    storeVendorId(id)
    sessionVendorIdRef.current = null
    setIframeSrc(null)
  }

  const openExternal = async () => {
    if (!selectedVendorId) return
    try {
      const res = await adminApi.createVendorDashboardHandoff(selectedVendorId)
      window.open(
        buildHandoffUrl(res.handoff_token, hrItem.vendorPath, false),
        '_blank',
        'noopener,noreferrer',
      )
    } catch {
      toast.error('Could not open HR in a new tab')
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-gray-50 lg:h-screen">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 text-sm text-gray-600">
          <Store className="h-4 w-4 shrink-0 text-primary" />
          <span className="hidden sm:inline shrink-0 font-medium text-gray-900">Business account</span>
        </div>

        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        ) : (
          <Select
            value={selectedVendorId}
            onChange={onVendorChange}
            className="h-9 max-w-xs min-w-[12rem] flex-1 sm:flex-none"
            disabled={!vendors.length}
            placeholder="Select business account"
            aria-label="Business account for HR"
            options={vendorOptions}
          />
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {selectedVendor ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to={`/dashboard/vendors/${selectedVendor.id}`}>Account</Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!selectedVendorId || loadingFrame}
            onClick={() => {
              sessionVendorIdRef.current = null
              setIframeSrc(null)
              setFrameEpoch((k) => k + 1)
            }}
            title="Reload HR module"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!selectedVendorId}
            onClick={() => void openExternal()}
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        {loadingFrame || (!iframeSrc && !!selectedVendorId) ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <div className="flex flex-col items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p>Loading {hrItem.label}…</p>
            </div>
          </div>
        ) : null}

        {!selectedVendorId && !isLoading ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gray-500">
            Select a business account to use HR Management.
          </div>
        ) : null}

        {iframeSrc ? (
          <iframe
            key={`${selectedVendorId}:${frameEpoch}`}
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
