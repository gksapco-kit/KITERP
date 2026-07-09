import {
  broadcastPreviewTabNavigate,
  draftPreviewNavigateTargetsMatch,
  PREVIEW_NAV_MESSAGE_TYPE,
} from '@/lib/draftPreviewSync'
import { isSameLoopbackOrigin, normalizeLoopbackHostname, normalizeLoopbackOrigin } from '@/lib/loopbackHost'

/** True when the dashboard is opened on a loopback host (vite dev, vite preview, etc.). */
function isLoopbackDashboardHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

/** Re-export for callers that already import from this module. */
export { normalizeLoopbackHostname }

/** Current vendor panel origin with loopback hostname normalized (port 3001 in local dev). */
export function getVendorPanelOrigin(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3001'
  const host = normalizeLoopbackHostname(window.location.hostname)
  const port = window.location.port
  const portSuffix = port ? `:${port}` : ''
  return `${window.location.protocol}//${host}${portSuffix}`
}

export function shouldUseLocalStorefrontUrls(): boolean {
  return import.meta.env.DEV || isLoopbackDashboardHost()
}

/**
 * Base URL of the business front SPA (no trailing slash).
 * - VITE_STOREFRONT_URL when set
 * - dev: same host, port 3002
 * - prod: current origin
 */
export function getStorefrontAppOrigin(): string {
  const fromEnv = (import.meta.env.VITE_STOREFRONT_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (shouldUseLocalStorefrontUrls()) {
    const host = typeof window !== 'undefined'
      ? normalizeLoopbackHostname(window.location.hostname)
      : '127.0.0.1'
    return `${typeof window !== 'undefined' ? window.location.protocol : 'http:'}//${host}:3002`
  }
  return window.location.origin.replace(/\/$/, '')
}

/**
 * Public customer store URL for this vendor (no trailing slash).
 * - VITE_STOREFRONT_URL: `{env}/store/{slug}`
 * - local dev/preview on localhost: `{protocol}//{host}:3002/store/{slug}`
 * - prod without env: `https://{slug}.kiterp.com`
 */
export function getCustomerStorefrontBaseUrl(vendorSlug: string): string {
  const slug = vendorSlug.trim()
  const fromEnv = (import.meta.env.VITE_STOREFRONT_URL as string | undefined)?.trim()
  if (fromEnv) return `${fromEnv.replace(/\/$/, '')}/store/${encodeURIComponent(slug)}`
  if (shouldUseLocalStorefrontUrls()) {
    const host = normalizeLoopbackHostname(window.location.hostname)
    return `${window.location.protocol}//${host}:3002/store/${encodeURIComponent(slug)}`
  }
  return `https://${slug}.kiterp.com`
}

/** Router-relative draft preview path (basename applied by React Router in prod). */
export const DRAFT_BROWSER_PREVIEW_PATH = '/preview/draft'

/**
 * Full browser pathname for draft preview, including Vite base (e.g. `/vendor/preview/draft` in prod).
 * Use for window.open, URL(), and window.location.pathname checks — not for React Router `Link to`.
 */
export function getDraftBrowserPreviewAbsolutePath(): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  if (!base || base === '/') return DRAFT_BROWSER_PREVIEW_PATH
  return `${base}${DRAFT_BROWSER_PREVIEW_PATH}`
}

/** True when `pathname` is the vendor-web draft preview shell (includes /vendor base in prod). */
export function matchesDraftPreviewBrowserPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  const draft = getDraftBrowserPreviewAbsolutePath().replace(/\/+$/, '') || '/'
  return path === draft || path.startsWith(`${draft}/`)
}

/** Query flag while the builder awaits the preview API (same-origin loading shell). */
export const DRAFT_PREVIEW_PENDING_PARAM = 'pending'

/**
 * Origin for preview tabs opened from this browser session.
 * Always canonicalize loopback (127.0.0.1) so builder + preview share one origin.
 */
export function getVendorPreviewOrigin(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3001'
  const { protocol, port } = window.location
  const hostname = normalizeLoopbackHostname(window.location.hostname)
  const portSuffix = port ? `:${port}` : ''
  return `${protocol}//${hostname}${portSuffix}`
}

/** Rewrite preview URLs to the canonical vendor-web origin (loopback → 127.0.0.1). */
export function alignPreviewUrlWithCurrentHost(previewShellUrl: string): string {
  if (typeof window === 'undefined') return previewShellUrl
  try {
    const url = new URL(previewShellUrl)
    url.protocol = window.location.protocol
    url.hostname = normalizeLoopbackHostname(window.location.hostname)
    if (window.location.port) url.port = window.location.port
    else url.port = ''
    return url.toString()
  } catch {
    return previewShellUrl
  }
}

/** Draft preview URL on vendor-web only: /preview/draft?token=…&page=… */
export function buildVendorDraftPreviewUrl(previewToken: string, pageSlug?: string | null): string {
  const url = new URL(getDraftBrowserPreviewAbsolutePath(), getVendorPreviewOrigin())
  url.searchParams.set('token', previewToken)
  const slug = pageSlug?.trim()
  if (slug && slug.length > 0 && slug.toLowerCase() !== 'home') {
    url.searchParams.set('page', slug)
  }
  return url.toString()
}

/** Same origin rules as template gallery; path matches storefront draft preview route. */
export function buildBuilderDraftPreviewUrl(
  vendorSlug: string,
  previewToken: string,
  activePageSlug?: string | null,
): string {
  const origin = getStorefrontAppOrigin()
  const slug = activePageSlug?.trim()
  const suffix =
    slug && slug.length > 0 && slug.toLowerCase() !== 'home'
      ? `/${slug.replace(/^\/+/, '')}`
      : ''
  return `${origin}/store/${encodeURIComponent(vendorSlug)}/preview/${encodeURIComponent(previewToken)}${suffix}`
}

/**
 * Template gallery: wrap business-front template URL in vendor preview shell (iframe).
 * Builder draft preview uses buildVendorDraftPreviewUrl instead.
 */
export function wrapStorefrontPreviewForVendorBrowser(storefrontPreviewUrl: string): string {
  if (typeof window === 'undefined') return storefrontPreviewUrl
  if (!shouldUseLocalStorefrontUrls()) return storefrontPreviewUrl
  const shell = new URL(getDraftBrowserPreviewAbsolutePath(), getVendorPreviewOrigin())
  shell.searchParams.set('target', storefrontPreviewUrl)
  return shell.toString()
}

/** Reused preview tab name — repeat clicks navigate the same tab instead of opening new ones. */
export const PREVIEW_WINDOW_NAME = 'kiterp-draft-preview'

/** Pending shell asks the builder tab to re-deliver the preview URL (handles load race). */
export const PREVIEW_PENDING_READY_TYPE = 'kiterp-preview-pending-ready'

let previewWindowRef: Window | null = null
/** Set when prepareDraftPreviewTab runs; navigate must not open a second tab in that case. */
let previewPrepareActive = false
/** Last URL handed to navigateDraftPreviewTab — retried when the pending tab finishes loading. */
let lastPreviewNavigateUrl: string | null = null
let previewDeliveryRetryIntervalId: ReturnType<typeof setInterval> | null = null

function stopPreviewDeliveryRetries(): void {
  if (previewDeliveryRetryIntervalId != null) {
    window.clearInterval(previewDeliveryRetryIntervalId)
    previewDeliveryRetryIntervalId = null
  }
}

function previewTabShowsUrl(tab: Window, url: string): boolean {
  try {
    return draftPreviewNavigateTargetsMatch(tab.location.href, url)
  } catch {
    return false
  }
}

function rememberLastPreviewNavigateUrl(url: string): void {
  lastPreviewNavigateUrl = url
}

function deliverPreviewNavigateUrl(url: string): void {
  const target = alignPreviewUrlWithCurrentHost(url)
  broadcastPreviewTabNavigate(target)
  reacquirePreviewWindowRef()
  if (previewWindowRef && !previewWindowRef.closed) {
    try {
      const targetOrigin = new URL(target).origin
      if (isSameLoopbackOrigin(window.location.origin, targetOrigin)) {
        if (previewTabShowsUrl(previewWindowRef, target)) {
          stopPreviewDeliveryRetries()
          postMessageToPreviewTabLoopback(target)
          return
        }
        previewWindowRef.location.replace(target)
        previewWindowRef.focus()
      }
    } catch {
      /* localStorage poll + postMessage remain the fallback */
    }
    postMessageToPreviewTabLoopback(target)
  }
}

function retryLastPreviewNavigateDelivery(): void {
  if (!lastPreviewNavigateUrl) return
  deliverPreviewNavigateUrl(lastPreviewNavigateUrl)
}

/** Pending tab may mount after the first handoff — retry only until the tab arrives. */
function schedulePreviewDeliveryRetries(url: string, durationMs = 12_000): void {
  stopPreviewDeliveryRetries()
  const target = alignPreviewUrlWithCurrentHost(url)
  deliverPreviewNavigateUrl(target)
  const startedAt = Date.now()
  previewDeliveryRetryIntervalId = window.setInterval(() => {
    if (Date.now() - startedAt > durationMs) {
      stopPreviewDeliveryRetries()
      return
    }
    if (previewWindowRef && !previewWindowRef.closed && previewTabShowsUrl(previewWindowRef, target)) {
      stopPreviewDeliveryRetries()
      return
    }
    deliverPreviewNavigateUrl(target)
  }, 750)
}

/** Listen for the pending preview tab signalling it is ready to receive the token URL. */
export function initPreviewTabOpenerBridge(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('message', (ev: MessageEvent<{ type?: string }>) => {
    if (ev.data?.type !== PREVIEW_PENDING_READY_TYPE) return
    retryLastPreviewNavigateDelivery()
  })
}

function closePreviewWindowRef(): void {
  if (!previewWindowRef || previewWindowRef.closed) {
    previewWindowRef = null
    return
  }
  try {
    previewWindowRef.close()
  } catch {
    /* cross-origin or already gone */
  }
  previewWindowRef = null
}

function postMessageToPreviewTab(url: string, targetOrigin: string): boolean {
  if (!previewWindowRef || previewWindowRef.closed) return false
  try {
    previewWindowRef.postMessage({ type: PREVIEW_NAV_MESSAGE_TYPE, url }, targetOrigin)
    previewWindowRef.focus()
    return true
  } catch {
    previewWindowRef = null
    return false
  }
}

function postMessageToPreviewTabLoopback(url: string): boolean {
  if (!previewWindowRef || previewWindowRef.closed) return false
  const targetOrigin = new URL(url).origin
  if (postMessageToPreviewTab(url, targetOrigin)) return true
  if (typeof window !== 'undefined' && isSameLoopbackOrigin(window.location.origin, targetOrigin)) {
    return postMessageToPreviewTab(url, normalizeLoopbackOrigin(window.location.origin))
      || postMessageToPreviewTab(url, '*')
  }
  return false
}

function buildVendorDraftPreviewPendingUrl(): string {
  const url = new URL(getDraftBrowserPreviewAbsolutePath(), getVendorPreviewOrigin())
  url.searchParams.set(DRAFT_PREVIEW_PENDING_PARAM, '1')
  return url.toString()
}

/**
 * Call synchronously from a click handler (before any `await`).
 * Opens a same-origin loading shell the builder can target after the preview API returns.
 */
export function prepareDraftPreviewTab(): Window | null {
  const pendingUrl = buildVendorDraftPreviewPendingUrl()
  previewPrepareActive = true
  try {
    if (previewWindowRef && !previewWindowRef.closed) {
      const targetOrigin = new URL(pendingUrl).origin
      try {
        if (isSameLoopbackOrigin(window.location.origin, targetOrigin)) {
          previewWindowRef.location.replace(pendingUrl)
        } else if (!postMessageToPreviewTabLoopback(pendingUrl)) {
          closePreviewWindowRef()
        } else {
          previewWindowRef.focus()
          return previewWindowRef
        }
        if (previewWindowRef && !previewWindowRef.closed) {
          previewWindowRef.focus()
          return previewWindowRef
        }
      } catch {
        closePreviewWindowRef()
      }
    }
    const tab = window.open(pendingUrl, PREVIEW_WINDOW_NAME)
    if (tab) {
      previewWindowRef = tab
      tab.focus()
    }
    return tab
  } catch {
    previewPrepareActive = false
    return null
  }
}

function reacquirePreviewWindowRef(): void {
  if (previewWindowRef && !previewWindowRef.closed) return
  // Do not window.open('', PREVIEW_WINDOW_NAME) — on some browsers that navigates the
  // existing preview tab to about:blank and breaks the pending shell.
}

/** Navigate the prepared preview tab (safe to call after async work). */
export function navigateDraftPreviewTab(previewShellUrl: string): boolean {
  const url = alignPreviewUrlWithCurrentHost(previewShellUrl)
  rememberLastPreviewNavigateUrl(url)
  reacquirePreviewWindowRef()
  let locationNavigated = false
  try {
    const targetOrigin = new URL(url).origin

    // Always persist for the pending tab to poll — never clear from the builder side.
    deliverPreviewNavigateUrl(url)
    if (previewWindowRef && !previewWindowRef.closed && isSameLoopbackOrigin(window.location.origin, targetOrigin)) {
      locationNavigated = true
    }
    schedulePreviewDeliveryRetries(url)

    // Only open a new tab when prepare did not run and we have no live preview window.
    if (!locationNavigated && !previewPrepareActive && (!previewWindowRef || previewWindowRef.closed)) {
      try {
        const tab = window.open(url, PREVIEW_WINDOW_NAME)
        if (tab) {
          previewWindowRef = tab
          tab.focus()
          locationNavigated = true
        }
      } catch {
        /* popup blocked */
      }
    }

    const delivered = locationNavigated || previewPrepareActive
    previewPrepareActive = false
    return delivered
  } catch {
    previewPrepareActive = false
    return false
  }
}

/** Open preview in one browser tab (sync callers only — no preceding `await`). */
export function openDraftPreviewInBrowser(previewShellUrl: string): boolean {
  return navigateDraftPreviewTab(previewShellUrl)
}

/** Crisp labels on dense builder toolbars (avoids muddy 12px extrabold on Windows). */
export const BUILDER_CRISP_LABEL =
  'text-[13px] font-semibold leading-none tracking-[0.01em] antialiased subpixel-antialiased shrink-0 whitespace-nowrap'

/** Preview-in-browser control (builder toolbar + template gallery). */
export const STOREFRONT_PREVIEW_IN_BROWSER_BTN_CLASS =
  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${BUILDER_CRISP_LABEL} text-primary bg-accent/95 border-primary/40 hover:bg-primary/10`

/** @deprecated use STOREFRONT_PREVIEW_IN_BROWSER_BTN_CLASS */
export const STOREFRONT_OPEN_IN_BROWSER_BTN_CLASS = STOREFRONT_PREVIEW_IN_BROWSER_BTN_CLASS
