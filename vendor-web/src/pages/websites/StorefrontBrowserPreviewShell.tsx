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
  consumePendingPreviewTabNavigate,
  peekPendingPreviewTabNavigate,
  clearPendingPreviewTabNavigate,
  peekPendingPreviewTabError,
  clearPendingPreviewTabError,
  PREVIEW_NAV_MESSAGE_TYPE,
  PREVIEW_NAV_STORAGE_KEY,
  PREVIEW_ERROR_STORAGE_KEY,
  type PreviewTabPostMessage,
} from '@/lib/draftPreviewSync'
import {
  DRAFT_BROWSER_PREVIEW_PATH,
  DRAFT_PREVIEW_PENDING_PARAM,
  alignPreviewUrlWithCurrentHost,
  getStorefrontAppOrigin,
  getVendorPreviewOrigin,
} from '@/lib/storefrontPreviewUrl'
import { isSameLoopbackOrigin } from '@/lib/loopbackHost'
import { cn } from '@/lib/utils'

/** Match builder API timeout so slow snapshots do not false-positive. */
const PENDING_PREVIEW_TIMEOUT_MS = 120_000

/** Redirect localhost/[::1] → 127.0.0.1 so cross-tab localStorage works on Windows. */
function useCanonicalLoopbackRedirect(): void {
  useEffect(() => {
    const host = window.location.hostname
    if (host !== 'localhost' && host !== '[::1]') return
    const url = new URL(window.location.href)
    url.hostname = '127.0.0.1'
    window.location.replace(url.toString())
  }, [])
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
    const path = url.pathname.replace(/\/+$/, '') || '/'
    return path === DRAFT_BROWSER_PREVIEW_PATH && Boolean(url.searchParams.get('token')?.trim())
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
  useCanonicalLoopbackRedirect()
  const [searchParams, setSearchParams] = useSearchParams()
  const legacyTarget = searchParams.get('target')?.trim() ?? ''
  const token = (searchParams.get('token')?.trim()
    || (legacyTarget ? parseTokenFromLegacyTarget(legacyTarget) : null)
    || '').trim()
  const pageSlug = searchParams.get('page')?.trim() || null
  const catalogRoute = searchParams.get('route')?.trim() || null
  const pending = searchParams.get(DRAFT_PREVIEW_PENDING_PARAM) === '1'
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
    const goToPreview = (navUrl: string) => {
      const canonical = alignPreviewUrlWithCurrentHost(navUrl)
      if (!isAllowedPreviewNavigateUrl(canonical)) return
      clearPendingPreviewTabNavigate()
      window.location.replace(canonical)
    }

    const onWindowMessage = (ev: MessageEvent<PreviewTabPostMessage>) => {
      if (ev.data?.type !== PREVIEW_NAV_MESSAGE_TYPE) return
      if (typeof ev.data.url === 'string') {
        goToPreview(ev.data.url)
        return
      }
      if (typeof ev.data.route === 'string' && token) {
        const params = new URLSearchParams(window.location.search)
        const nextRoute = ev.data.route.trim().replace(/^\/+|\/+$/g, '')
        if (!nextRoute || params.get('route') === nextRoute) return
        params.set('route', nextRoute)
        window.history.replaceState(null, '', `${DRAFT_BROWSER_PREVIEW_PATH}?${params.toString()}`)
      }
    }
    window.addEventListener('message', onWindowMessage)

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === PREVIEW_NAV_STORAGE_KEY && ev.newValue) {
        goToPreview(ev.newValue)
        return
      }
      if (ev.key === PREVIEW_ERROR_STORAGE_KEY && ev.newValue) {
        setPendingError(ev.newValue)
      }
    }
    window.addEventListener('storage', onStorage)

    const unsubscribeChannel = subscribePreviewTabNavigate(goToPreview)
    const unsubscribeError = subscribePreviewTabError(msg => setPendingError(msg))

    if (pending && !token) {
      const immediate = peekPendingPreviewTabNavigate()
      if (immediate) {
        goToPreview(immediate)
        return () => {
          window.removeEventListener('message', onWindowMessage)
          window.removeEventListener('storage', onStorage)
          unsubscribeChannel()
          unsubscribeError()
        }
      }
      const existingErr = peekPendingPreviewTabError()
      if (existingErr) setPendingError(existingErr)
      const startedAt = Date.now()
      const pollId = window.setInterval(() => {
        const nav = peekPendingPreviewTabNavigate()
        if (nav) { goToPreview(nav); return }
        const err = peekPendingPreviewTabError()
        if (err) {
          setPendingError(err)
          return
        }
        if (Date.now() - startedAt > PENDING_PREVIEW_TIMEOUT_MS) {
          setPendingError(
            'Preview is taking too long. Return to the builder tab and click "Preview in Browser" again. '
            + 'If this keeps happening, confirm the backend is running and run alembic upgrade web006.',
          )
        }
      }, 200)
      return () => {
        window.clearInterval(pollId)
        window.removeEventListener('message', onWindowMessage)
        window.removeEventListener('storage', onStorage)
        unsubscribeChannel()
        unsubscribeError()
      }
    }

    const pendingNavigate = consumePendingPreviewTabNavigate()
    if (pendingNavigate) goToPreview(pendingNavigate)

    return () => {
      window.removeEventListener('message', onWindowMessage)
      window.removeEventListener('storage', onStorage)
      unsubscribeChannel()
      unsubscribeError()
    }
  }, [pending, token])

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

  const vendorSlug = useMemo(() => resolvePreviewVendorSlug(site), [site])

  const previewOrigin = getVendorPreviewOrigin()

  if (pending && !token && !templateTarget) {
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
                clearPendingPreviewTabError()
                const nav = peekPendingPreviewTabNavigate()
                if (nav) window.location.replace(alignPreviewUrlWithCurrentHost(nav))
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              <RefreshCw className="w-4 h-4" />
              Check again
            </button>
            <button
              type="button"
              onClick={() => { clearPendingPreviewTabError(); window.close() }}
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
