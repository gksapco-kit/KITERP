import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import {
  PREVIEW_PAGE_QUERY,
  resolveWebsiteBuilderPageSlug,
} from '@/lib/websiteBuilderPreview'

const LIVE_PREVIEW_REQUEST_MESSAGE = 'kiterp:live-preview-request'
const LIVE_PREVIEW_RESPONSE_MESSAGE = 'kiterp:live-preview-response'
const INJECT_LIVE_PREVIEW_MESSAGE = 'kiterp:inject-live-preview'

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function vendorAdminOrigin(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (isLoopbackHost(hostname)) {
      return `${protocol}//${hostname}:3001`
    }
  }
  const fromEnv = (import.meta.env.VITE_VENDOR_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return 'http://127.0.0.1:3001'
}

export { resolveWebsiteBuilderPageSlug } from '@/lib/websiteBuilderPreview'

type PreviewPayload = {
  siteName: string
  siteConfig: Record<string, unknown>
  pages: unknown[]
  catalog: { products: unknown[]; services: unknown[] }
}

function requestDraftFromVendor(opener: Window, previewKey: string): void {
  opener.postMessage({ type: LIVE_PREVIEW_REQUEST_MESSAGE, key: previewKey }, '*')
}

/**
 * Draft live preview on :3002 — embeds builder live site on :3001.
 * Draft is sent via window.opener (vendor tab) and/or vendor localStorage inside the iframe.
 */
export default function WebsiteBuilderLivePreview() {
  const { vendorSlug, pageSlug: liveRouteSlug } = useParams<{
    vendorSlug?: string
    pageSlug?: string
  }>()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const previewKey = searchParams.get('previewKey')?.trim()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const iframeLoadedRef = useRef(false)

  const [payload, setPayload] = useState<PreviewPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [iframeLoaded, setIframeLoaded] = useState(false)

  const pageSlug = useMemo(
    () =>
      resolveWebsiteBuilderPageSlug(location.pathname, {
        vendorSlug,
        liveRouteSlug,
        previewPageFromQuery: searchParams.get(PREVIEW_PAGE_QUERY),
      }),
    [location.pathname, vendorSlug, liveRouteSlug, searchParams],
  )

  const iframeSrc = useMemo(() => {
    const slug = pageSlug.trim() || 'home'
    const base = vendorAdminOrigin()
    const url = new URL(`${base}/website-builder-app/site/${encodeURIComponent(slug)}`)
    if (previewKey) url.searchParams.set('previewKey', previewKey)
    return url.toString()
  }, [pageSlug, previewKey])

  const injectIntoIframe = useCallback((data: PreviewPayload) => {
    const win = iframeRef.current?.contentWindow
    if (!win) return false
    win.postMessage({ type: INJECT_LIVE_PREVIEW_MESSAGE, payload: data }, vendorAdminOrigin())
    return true
  }, [])

  useEffect(() => {
    if (!previewKey) {
      setLoadError('Missing preview key. Open live preview again from Website Builder.')
      return
    }

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== LIVE_PREVIEW_RESPONSE_MESSAGE) return
      if (event.data.key !== previewKey) return
      if (!event.data.payload) return
      setPayload(event.data.payload as PreviewPayload)
      setLoadError(null)
    }

    window.addEventListener('message', onMessage)

    const tryRequestFromOpener = () => {
      const opener = window.opener
      if (opener && !opener.closed) {
        requestDraftFromVendor(opener, previewKey)
        return true
      }
      return false
    }

    tryRequestFromOpener()
    const retryTimer = window.setInterval(() => {
      if (tryRequestFromOpener()) window.clearInterval(retryTimer)
    }, 250)
    window.setTimeout(() => window.clearInterval(retryTimer), 3000)

    const timeout = window.setTimeout(() => {
      if (iframeLoadedRef.current) return
      setLoadError(
        (prev) =>
          prev ??
          'Preview timed out. Keep the Website Builder tab open on port 3001, allow pop-ups, then click View Live Site again.',
      )
    }, 20_000)

    return () => {
      window.removeEventListener('message', onMessage)
      window.clearInterval(retryTimer)
      window.clearTimeout(timeout)
    }
  }, [previewKey])

  useEffect(() => {
    if (!payload || !iframeLoaded) return
    injectIntoIframe(payload)
    const retry = window.setInterval(() => {
      if (injectIntoIframe(payload)) window.clearInterval(retry)
    }, 200)
    window.setTimeout(() => window.clearInterval(retry), 5000)
    return () => window.clearInterval(retry)
  }, [payload, iframeLoaded, injectIntoIframe])

  if (!previewKey) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 p-6 text-center">
        <p className="max-w-md text-sm text-gray-600">
          Missing preview key. Use View Live Site from Website Builder (port 3001).
        </p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] bg-white">
      {!iframeLoaded && !loadError && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-gray-50/90 text-sm text-gray-500">
          Loading your website template…
        </div>
      )}
      {loadError && (
        <div className="absolute inset-x-0 top-0 z-20 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
          {loadError}
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Website live preview"
        src={iframeSrc}
        className="h-full w-full border-0"
        allow="clipboard-read; clipboard-write"
        onLoad={() => {
          iframeLoadedRef.current = true
          setIframeLoaded(true)
          setLoadError(null)
          if (payload) injectIntoIframe(payload)
        }}
      />
    </div>
  )
}
