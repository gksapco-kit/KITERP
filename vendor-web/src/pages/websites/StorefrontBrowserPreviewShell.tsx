import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react'
import { DraftPreviewRenderer } from '@/components/websites/DraftPreviewRenderer'
import { fetchPublicPreviewByToken, resolvePreviewVendorSlug } from '@/lib/publicSitePreview'
import { rememberDraftPreviewToken } from '@/lib/draftPreviewNavigation'
import {
  subscribeDraftPreviewUpdates,
  rememberDraftPreviewSession,
  subscribePreviewTabNavigate,
  subscribePreviewTabError,
  peekPendingPreviewTabNavigate,
  peekPendingPreviewTabError,
  clearPendingPreviewTabNavigate,
  clearPendingPreviewTabError,
  draftPreviewNavigateTargetsMatch,
  previewNavStorageKey,
  previewErrorStorageKey,
  PREVIEW_NAV_MESSAGE_TYPE,
  PREVIEW_SITE_QUERY_PARAM,
  type PreviewTabPostMessage,
} from '@/lib/draftPreviewSync'
import {
  DRAFT_PREVIEW_PENDING_PARAM,
  PREVIEW_PENDING_READY_TYPE,
  alignPreviewUrlWithCurrentHost,
  getStorefrontAppOrigin,
  getVendorPreviewOrigin,
  matchesDraftPreviewBrowserPath,
} from '@/lib/storefrontPreviewUrl'
import { isSameLoopbackOrigin } from '@/lib/loopbackHost'
import { cn } from '@/lib/utils'

/** Allow time for slow preview snapshots; must exceed createBuilderPreview timeout (120s). */
const PENDING_PREVIEW_TIMEOUT_MS = 150_000

function requestPreviewDeliveryFromOpener(siteId: string): void {
  const scope = siteId.trim()
  if (!scope) return
  try {
    window.opener?.postMessage({ type: PREVIEW_PENDING_READY_TYPE, siteId: scope }, '*')
  } catch {
    /* cross-origin or closed opener */
  }
}

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

function isAllowedPreviewNavigateUrl(raw: string): boolean {
  try {
    const url = new URL(alignPreviewUrlWithCurrentHost(raw))
    if (!isSameLoopbackOrigin(url.origin, window.location.origin) && url.origin !== window.location.origin) {
      return false
    }
    return matchesDraftPreviewBrowserPath(url.pathname) && Boolean(url.searchParams.get('token')?.trim())
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
  const [searchParams, setSearchParams] = useSearchParams()
  const legacyTarget = searchParams.get('target')?.trim() ?? ''
  const token = (searchParams.get('token')?.trim()
    || (legacyTarget ? parseTokenFromLegacyTarget(legacyTarget) : null)
    || '').trim()
  const pageSlug = searchParams.get('page')?.trim() || null
  const catalogRoute = searchParams.get('route')?.trim() || null
  const pending = searchParams.get(DRAFT_PREVIEW_PENDING_PARAM) === '1'
  /** Isolates this shell so navigate/error from other site builders cannot retarget it. */
  const previewSiteId = searchParams.get(PREVIEW_SITE_QUERY_PARAM)?.trim() ?? ''
  const templateTarget = legacyTarget && isAllowedTemplateTarget(legacyTarget) ? legacyTarget : null

  const openBuilderForPage = useCallback((nextPageSlug: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('route')
      const slug = nextPageSlug?.trim().replace(/^\/+/, '')
      if (slug && slug.toLowerCase() !== 'home') next.set('page', slug)
      else next.delete('page')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const [site, setSite] = useState<Awaited<ReturnType<typeof fetchPublicPreviewByToken>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [pendingError, setPendingError] = useState<string | null>(null)
  const [pendingRetryKey, setPendingRetryKey] = useState(0)

  const loadPreview = useCallback((previewToken: string, opts?: { quiet?: boolean }) => {
    if (!previewToken) return Promise.resolve()
    if (!opts?.quiet) {
      setLoading(true)
      setError(null)
    }
    return fetchPublicPreviewByToken(previewToken, { siteId: previewSiteId || undefined })
      .then(data => {
        // Ignore stale responses if this shell was retargeted mid-flight (multi-tab).
        if (previewSiteId && data?.id && String(data.id) !== previewSiteId) {
          return
        }
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
  }, [previewSiteId])

  useEffect(() => {
    if (token) rememberDraftPreviewToken(token)
  }, [token])

  useEffect(() => {
    if (!pending || token || !previewSiteId) return
    const ask = () => requestPreviewDeliveryFromOpener(previewSiteId)
    ask()
    const retryId = window.setInterval(ask, 2000)
    return () => window.clearInterval(retryId)
  }, [pending, token, previewSiteId])

  useEffect(() => {
    // Without siteId we cannot safely listen — unscoped handoffs used to retarget every open preview.
    if (!previewSiteId) return

    const goToPreview = (navUrl: string) => {
      const canonical = alignPreviewUrlWithCurrentHost(navUrl)
      if (!isAllowedPreviewNavigateUrl(canonical)) return
      clearPendingPreviewTabNavigate(previewSiteId)
      if (draftPreviewNavigateTargetsMatch(window.location.href, canonical)) {
        return
      }
      window.location.replace(canonical)
    }

    const onWindowMessage = (ev: MessageEvent<PreviewTabPostMessage>) => {
      if (ev.data?.type !== PREVIEW_NAV_MESSAGE_TYPE) return
      const msgSiteId = ev.data.siteId?.trim()
      if (msgSiteId && msgSiteId !== previewSiteId) return
      if (typeof ev.data.url === 'string') {
        goToPreview(ev.data.url)
        return
      }
      if (typeof ev.data.route === 'string' && token) {
        const nextRoute = ev.data.route.trim().replace(/^\/+|\/+$/g, '')
        if (!nextRoute) {
          setSearchParams(prev => {
            if (!prev.has('route')) return prev
            const next = new URLSearchParams(prev)
            next.delete('route')
            return next
          }, { replace: true })
          return
        }
        setSearchParams(prev => {
          if (prev.get('route') === nextRoute) return prev
          const next = new URLSearchParams(prev)
          next.set('route', nextRoute)
          return next
        }, { replace: true })
      }
    }
    window.addEventListener('message', onWindowMessage)

    const navKey = previewNavStorageKey(previewSiteId)
    const errKey = previewErrorStorageKey(previewSiteId)
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === navKey && ev.newValue) {
        goToPreview(ev.newValue)
        return
      }
      if (ev.key === errKey && ev.newValue) {
        setPendingError(ev.newValue)
      }
    }
    window.addEventListener('storage', onStorage)

    const unsubscribeChannel = subscribePreviewTabNavigate(goToPreview, previewSiteId)
    const unsubscribeError = subscribePreviewTabError(msg => setPendingError(msg), previewSiteId)

    if (pending && !token) {
      const immediate = peekPendingPreviewTabNavigate(previewSiteId)
      if (immediate) {
        goToPreview(immediate)
        return () => {
          window.removeEventListener('message', onWindowMessage)
          window.removeEventListener('storage', onStorage)
          unsubscribeChannel()
          unsubscribeError()
        }
      }
      const existingErr = peekPendingPreviewTabError(previewSiteId)
      if (existingErr) setPendingError(existingErr)
      const startedAt = Date.now()
      let timedOut = false
      const pollId = window.setInterval(() => {
        const nav = peekPendingPreviewTabNavigate(previewSiteId)
        if (nav) { goToPreview(nav); return }
        const err = peekPendingPreviewTabError(previewSiteId)
        if (err) {
          setPendingError(err)
          return
        }
        if (!timedOut && Date.now() - startedAt > PENDING_PREVIEW_TIMEOUT_MS) {
          timedOut = true
          setPendingError(
            'Preview is taking too long. Keep the builder tab open, then click "Check again" or re-open Preview in Browser from the builder. '
            + 'If this keeps happening, confirm the API is running on http://127.0.0.1:8000.',
          )
        }
      }, 100)
      return () => {
        window.clearInterval(pollId)
        window.removeEventListener('message', onWindowMessage)
        window.removeEventListener('storage', onStorage)
        unsubscribeChannel()
        unsubscribeError()
      }
    }

    // Already have a token (e.g. admin opened a full preview URL): ignore stale
    // pending-nav localStorage from a previous builder session — that caused
    // localhost ↔ 127.0.0.1 reload loops when hosts/tokens mismatched.
    if (token) {
      clearPendingPreviewTabNavigate(previewSiteId)
    }

    return () => {
      window.removeEventListener('message', onWindowMessage)
      window.removeEventListener('storage', onStorage)
      unsubscribeChannel()
      unsubscribeError()
    }
  }, [pending, token, previewSiteId, setSearchParams, pendingRetryKey])

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
      if (previewSiteId && msg.siteId && msg.siteId !== previewSiteId) return
      void loadPreview(token, { quiet: true })
    })
  }, [token, previewSiteId, loadPreview])

  const vendorSlug = useMemo(() => resolvePreviewVendorSlug(site), [site])

  const previewOrigin = getVendorPreviewOrigin()

  if (pending && !token && !templateTarget) {
    if (!previewSiteId) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white p-6">
          <AlertTriangle className="w-10 h-10 text-amber-400 mb-4" />
          <h1 className="text-lg font-semibold mb-2">Preview link is invalid</h1>
          <p className="text-sm text-gray-400 mb-6 text-center max-w-md">
            Open Preview in Browser from the Business Website Builder again.
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
    if (pendingError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white p-6">
          <AlertTriangle className="w-10 h-10 text-amber-400 mb-4" />
          <h1 className="text-lg font-semibold mb-2">Preview could not be prepared</h1>
          <p className="text-sm text-gray-400 text-center max-w-md mb-6">{pendingError}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setPendingError(null)
                clearPendingPreviewTabError(previewSiteId)
                requestPreviewDeliveryFromOpener(previewSiteId)
                const nav = peekPendingPreviewTabNavigate(previewSiteId)
                if (nav) {
                  window.location.replace(alignPreviewUrlWithCurrentHost(nav))
                  return
                }
                // Restart the pending poll window and ask the builder tab to re-deliver.
                setPendingRetryKey(k => k + 1)
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              <RefreshCw className="w-4 h-4" />
              Check again
            </button>
            <button
              type="button"
              onClick={() => { clearPendingPreviewTabError(previewSiteId); window.close() }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Close this tab
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white p-6">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-400 mb-4" />
        <h1 className="text-lg font-semibold mb-2">Preparing draft preview…</h1>
        <p className="text-sm text-gray-400 text-center max-w-md">
          This tab will load your site as soon as the builder finishes saving the preview snapshot.
        </p>
      </div>
    )
  }

  if (!token && !templateTarget) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white p-6">
        <AlertTriangle className="w-10 h-10 text-amber-400 mb-4" />
        <h1 className="text-lg font-semibold mb-2">Preview link is invalid</h1>
        <p className="text-sm text-gray-400 mb-6 text-center max-w-md">
          Open Preview in Browser from the Business Website Builder again.
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
      <header className="flex shrink-0 items-center gap-3 border-b border-amber-100 bg-amber-50 px-3 py-2 text-amber-950 z-10">
        <span className="text-xs font-bold uppercase tracking-wide text-amber-800 shrink-0">
          Preview — not live yet
        </span>
        {site?.name && (
          <span className="text-[11px] text-amber-900/70 truncate max-w-[240px]">
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
            className="inline-flex items-center gap-1 rounded-lg p-1.5 text-amber-800/60 hover:bg-amber-100 hover:text-amber-950"
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
            catalogRoute={catalogRoute}
            vendorSlug={vendorSlug}
            previewToken={token}
            onOpenBuilderPage={openBuilderForPage}
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
