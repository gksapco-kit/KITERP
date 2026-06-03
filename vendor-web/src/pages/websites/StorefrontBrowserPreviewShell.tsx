import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { DraftPreviewRenderer } from '@/components/websites/DraftPreviewRenderer'
import { fetchPublicPreviewByToken } from '@/lib/publicSitePreview'
import { rememberDraftPreviewToken } from '@/lib/draftPreviewNavigation'
import { subscribeDraftPreviewUpdates, rememberDraftPreviewSession } from '@/lib/draftPreviewSync'
import { getStorefrontAppOrigin, getVendorPreviewOrigin } from '@/lib/storefrontPreviewUrl'
import { isSameLoopbackOrigin } from '@/lib/loopbackHost'
import { cn } from '@/lib/utils'

function isAllowedTemplateTarget(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    if (!isSameLoopbackOrigin(url.origin, getStorefrontAppOrigin())) return false
    return url.pathname.startsWith('/template-browser/')
  } catch {
    return false
  }
}

function parseTokenFromLegacyTarget(target: string): string | null {
  try {
    const m = new URL(target).pathname.match(/\/preview\/([^/]+)/)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

export default function StorefrontBrowserPreviewShell() {
  const [searchParams] = useSearchParams()
  const legacyTarget = searchParams.get('target')?.trim() ?? ''
  const token = (searchParams.get('token')?.trim()
    || (legacyTarget ? parseTokenFromLegacyTarget(legacyTarget) : null)
    || '').trim()
  const pageSlug = searchParams.get('page')?.trim() || null
  const templateTarget = legacyTarget && isAllowedTemplateTarget(legacyTarget) ? legacyTarget : null

  const [site, setSite] = useState<Awaited<ReturnType<typeof fetchPublicPreviewByToken>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  const loadPreview = useCallback((previewToken: string, opts?: { quiet?: boolean }) => {
    if (!previewToken) return Promise.resolve()
    if (!opts?.quiet) {
      setLoading(true)
      setError(null)
    }
    return fetchPublicPreviewByToken(previewToken)
      .then(data => {
        setSite(data)
        setLastSyncedAt(new Date())
        if (data?.id) rememberDraftPreviewSession(String(data.id), previewToken)
      })
      .catch(err => {
        setSite(null)
        setError(err instanceof Error ? err.message : 'Could not load preview')
      })
      .finally(() => {
        if (!opts?.quiet) setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (token) rememberDraftPreviewToken(token)
  }, [token])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError(templateTarget ? null : 'Missing preview token')
      return
    }
    let cancelled = false
    void loadPreview(token).finally(() => {
      if (cancelled) return
    })
    return () => { cancelled = true }
  }, [token, templateTarget, loadPreview])

  useEffect(() => {
    if (!token) return
    return subscribeDraftPreviewUpdates(msg => {
      if (msg.token !== token) return
      void loadPreview(token, { quiet: true })
    })
  }, [token, loadPreview])

  const vendorSlug = useMemo(
    () => (site?.subdomain?.trim() || 'preview'),
    [site?.subdomain],
  )

  const previewOrigin = getVendorPreviewOrigin()

  if (!token && !templateTarget) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white p-6">
        <AlertTriangle className="w-10 h-10 text-amber-400 mb-4" />
        <h1 className="text-lg font-semibold mb-2">Preview link is invalid</h1>
        <p className="text-sm text-gray-400 mb-6 text-center max-w-md">
          Open Preview in Browser from the website builder again.
        </p>
        <button
          type="button"
          onClick={() => { window.close() }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-gray-900 px-3 py-2 text-white z-10">
        <span className="text-xs font-bold uppercase tracking-wide text-emerald-400 shrink-0">
          Draft preview
        </span>
        <span className="hidden sm:inline text-[11px] text-gray-400 truncate">
          {previewOrigin} · vendor-web
        </span>
        {site?.name && (
          <span className="hidden md:inline text-[11px] text-gray-500 truncate max-w-[200px]">
            {site.name}
          </span>
        )}
        {lastSyncedAt && (
          <span className="hidden lg:inline text-[10px] text-emerald-500/80">
            Updated {lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => { window.close() }}
            className="inline-flex items-center gap-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
            title="Close preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {token && loading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-600">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading draft preview…</p>
        </div>
      )}

      {token && !loading && error && (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
          <p className="font-medium text-gray-900">{error}</p>
          <p className="text-sm text-gray-500 mt-2 max-w-md">
            Save your site in the builder and click Preview in Browser again.
          </p>
        </div>
      )}

      {token && !loading && !error && site && (
        <div className={cn('flex-1 min-h-0 overflow-y-auto overflow-x-hidden')}>
          <DraftPreviewRenderer
            site={site}
            pageSlug={pageSlug}
            vendorSlug={vendorSlug}
            previewToken={token}
          />
        </div>
      )}

      {!token && templateTarget && (
        <iframe
          src={templateTarget}
          title="Template preview"
          className="flex-1 w-full border-0 bg-white"
        />
      )}
    </div>
  )
}
