import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import {
  handleLivePreviewMessage,
  isTrustedWebsiteBuilderMessageOrigin,
} from '@/lib/livePreviewBridge'
import { getStorefrontAppOrigin } from '@/lib/storefrontPreviewUrl'
import { useVendorStore } from '@/stores/vendorStore'

const CONFIG_MESSAGE = 'kiterp:website-builder-config'
const READY_MESSAGE = 'kiterp:website-builder-ready'
const OPEN_LIVE_PREVIEW_MESSAGE = 'kiterp:open-live-preview'

/** Trailing slash — served by vite-website-builder-static (not vendor SPA fallback). */
function embedAppUrl(): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return `${base}/website-builder-app/`
}

export default function WebsiteBuilderPage() {
  const location = useLocation()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const vendorSlug = useVendorStore((s) => s.vendor?.slug)
  const branchCode = useVendorStore((s) => s.selectedStore?.code)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeError, setIframeError] = useState<string | null>(null)

  const embedSrc = useMemo(() => {
    const path = embedAppUrl()
    const params = new URLSearchParams()
    if (vendorSlug) params.set('vendorSlug', vendorSlug)
    params.set('storefrontOrigin', getStorefrontAppOrigin())
    if (branchCode?.trim()) params.set('branch', branchCode.trim())

    const parentParams = new URLSearchParams(location.search)
    const newTemplate = parentParams.get('newTemplate')
    if (newTemplate === '1') params.set('newTemplate', '1')
    const applyTemplate = parentParams.get('applyTemplate')?.trim()
    if (applyTemplate) params.set('applyTemplate', applyTemplate)
    const builtInTemplate = parentParams.get('builtInTemplate')?.trim()
    if (builtInTemplate) params.set('builtInTemplate', builtInTemplate)

    const qs = params.toString()
    return qs ? `${path}?${qs}` : path
  }, [vendorSlug, branchCode, location.search])

  const postConfig = useCallback(() => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.postMessage(
      {
        type: CONFIG_MESSAGE,
        vendorSlug: vendorSlug ?? undefined,
        storefrontOrigin: getStorefrontAppOrigin(),
        branchCode: branchCode?.trim() || undefined,
      },
      window.location.origin,
    )
  }, [vendorSlug, branchCode])

  const lastLivePreviewOpenRef = useRef<{ url: string; at: number } | null>(null)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (handleLivePreviewMessage(event)) return

      if (!isTrustedWebsiteBuilderMessageOrigin(event.origin)) return

      if (
        event.data?.type === READY_MESSAGE ||
        event.data?.type === 'kiterp:website-builder-request-config'
      ) {
        setIframeLoaded(true)
        setIframeError(null)
        postConfig()
        return
      }
      if (event.data?.type === OPEN_LIVE_PREVIEW_MESSAGE && typeof event.data.url === 'string') {
        const url = event.data.url
        const now = Date.now()
        const last = lastLivePreviewOpenRef.current
        if (last && last.url === url && now - last.at < 2000) return
        lastLivePreviewOpenRef.current = { url, at: now }
        // Do not use noopener — preview tab needs window.opener to load the draft site.
        const tab = window.open(url, '_blank', 'noreferrer')
        if (!tab) {
          window.alert(
            'Pop-up blocked. Allow pop-ups for this site, then click View Live Site again.',
          )
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [postConfig])

  useEffect(() => {
    setIframeLoaded(false)
    setIframeError(null)
  }, [embedSrc])

  useEffect(() => {
    if (iframeLoaded) postConfig()
  }, [iframeLoaded, postConfig, embedSrc])

  useEffect(() => {
    if (!iframeLoaded) return
    const url = new URL(window.location.href)
    let changed = false
    for (const key of ['newTemplate', 'applyTemplate', 'builtInTemplate']) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key)
        changed = true
      }
    }
    if (changed) {
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }, [iframeLoaded])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!iframeLoaded) {
        setIframeError(
          'Website Builder is taking too long to load. Run npm run build:website-builder from the repo root, then refresh.',
        )
      }
    }, 20_000)
    return () => window.clearTimeout(timer)
  }, [embedSrc, iframeLoaded])

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      {!iframeLoaded && !iframeError && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <Loader2 className="pointer-events-auto h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {iframeError && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background p-6 text-center">
          <p className="max-w-md text-sm text-muted-foreground">{iframeError}</p>
          <p className="max-w-lg break-all font-mono text-xs text-foreground">{embedSrc}</p>
        </div>
      )}
      <iframe
        key={embedSrc}
        ref={iframeRef}
        title="Website Builder"
        src={embedSrc}
        className="h-full w-full border-0 bg-background"
        allow="clipboard-read; clipboard-write"
        onLoad={() => {
          setIframeLoaded(true)
          setIframeError(null)
        }}
      />
    </div>
  )
}
