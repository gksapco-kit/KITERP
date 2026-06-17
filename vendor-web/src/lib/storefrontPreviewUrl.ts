import {
  broadcastPreviewTabNavigate,
  PREVIEW_NAV_MESSAGE_TYPE,
} from '@/lib/draftPreviewSync'
import { normalizeLoopbackHostname } from '@/lib/loopbackHost'

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

/** Public draft preview on vendor-web (port 3001) — no storefront iframe. */
export const DRAFT_BROWSER_PREVIEW_PATH = '/preview/draft'

/** Query flag while the builder awaits the preview API (same-origin loading shell). */
export const DRAFT_PREVIEW_PENDING_PARAM = 'pending'

/**
 * Origin for preview tabs opened from this browser session.
 * Must match the builder tab hostname (localhost vs 127.0.0.1) so opener refs,
 * postMessage, and localStorage signaling stay on one origin.
 */
export function getVendorPreviewOrigin(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3001'
  const { protocol, hostname, port } = window.location
  const portSuffix = port ? `:${port}` : ''
  return `${protocol}//${hostname}${portSuffix}`
}

/** Rewrite preview URLs to the active vendor-web origin (host + port). */
export function alignPreviewUrlWithCurrentHost(previewShellUrl: string): string {
  if (typeof window === 'undefined') return previewShellUrl
  try {
    const url = new URL(previewShellUrl)
    url.protocol = window.location.protocol
    url.hostname = window.location.hostname
    if (window.location.port) url.port = window.location.port
    else url.port = ''
    return url.toString()
  } catch {
    return previewShellUrl
  }
}

/** Draft preview URL on vendor-web only: /preview/draft?token=…&page=… */
export function buildVendorDraftPreviewUrl(previewToken: string, pageSlug?: string | null): string {
  const url = new URL(DRAFT_BROWSER_PREVIEW_PATH, getVendorPreviewOrigin())
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
  const shell = new URL(DRAFT_BROWSER_PREVIEW_PATH, getVendorPreviewOrigin())
  shell.searchParams.set('target', storefrontPreviewUrl)
  return shell.toString()
}

/** Reused preview tab name — repeat clicks navigate the same tab instead of opening new ones. */
export const PREVIEW_WINDOW_NAME = 'kiterp-draft-preview'

let previewWindowRef: Window | null = null

function buildVendorDraftPreviewPendingUrl(): string {
  const url = new URL(DRAFT_BROWSER_PREVIEW_PATH, getVendorPreviewOrigin())
  url.searchParams.set(DRAFT_PREVIEW_PENDING_PARAM, '1')
  return url.toString()
}

/**
 * Call synchronously from a click handler (before any `await`).
 * Opens a same-origin loading shell the builder can target after the preview API returns.
 */
export function prepareDraftPreviewTab(): Window | null {
  const pendingUrl = buildVendorDraftPreviewPendingUrl()
  try {
    if (previewWindowRef && !previewWindowRef.closed) {
      try {
        previewWindowRef.location.replace(pendingUrl)
        previewWindowRef.focus()
        return previewWindowRef
      } catch {
        previewWindowRef = null
      }
    }
    const tab = window.open(pendingUrl, PREVIEW_WINDOW_NAME)
    if (tab) {
      previewWindowRef = tab
      tab.focus()
    }
    return tab
  } catch {
    return null
  }
}

/** Navigate the prepared preview tab (safe to call after async work). */
export function navigateDraftPreviewTab(previewShellUrl: string): boolean {
  const url = alignPreviewUrlWithCurrentHost(previewShellUrl)
  let delivered = false
  try {
    // Cross-tab fallback: localStorage + BroadcastChannel (works when opener ref is blocked).
    broadcastPreviewTabNavigate(url)

    if (previewWindowRef && !previewWindowRef.closed) {
      try {
        const targetOrigin = new URL(url).origin
        previewWindowRef.postMessage({ type: PREVIEW_NAV_MESSAGE_TYPE, url }, targetOrigin)
        previewWindowRef.location.replace(url)
        previewWindowRef.focus()
        delivered = true
      } catch {
        // Keep previewWindowRef — pending tab may still pick up localStorage / postMessage.
      }
    }

    // Only open a new tab when no prepared tab exists (avoids pending + token duplicate tabs).
    if (!delivered && !previewWindowRef) {
      try {
        const tab = window.open(url, PREVIEW_WINDOW_NAME)
        if (tab) {
          previewWindowRef = tab
          tab.focus()
          delivered = true
        }
      } catch {
        /* popup blocked */
      }
    }

    return delivered
  } catch {
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
