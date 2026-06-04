/** True when the dashboard is opened on a loopback host (vite dev, vite preview, etc.). */
function isLoopbackDashboardHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

/**
 * Windows + Docker: `localhost` often resolves to IPv6 (::1) while published ports
 * only answer on 127.0.0.1 — use the numeric loopback for dev URLs.
 */
export function normalizeLoopbackHostname(hostname: string): string {
  if (hostname === 'localhost' || hostname === '[::1]') return '127.0.0.1'
  return hostname
}

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

/** Origin for preview URLs — always vendor-web (port 3001 in local dev). */
export function getVendorPreviewOrigin(): string {
  if (shouldUseLocalStorefrontUrls()) {
    return 'http://localhost:3001'
  }
  if (typeof window === 'undefined') return 'http://localhost:3001'
  const { protocol, port } = window.location
  const host = window.location.hostname === '127.0.0.1' ? 'localhost' : window.location.hostname
  return `${protocol}//${host}${port ? `:${port}` : ''}`
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
const PREVIEW_WINDOW_NAME = 'kiterp-draft-preview'

let previewWindowRef: Window | null = null

/** Open preview in one browser tab; never navigate the builder tab away. */
export function openDraftPreviewInBrowser(previewShellUrl: string): boolean {
  try {
    if (previewWindowRef && !previewWindowRef.closed) {
      previewWindowRef.location.href = previewShellUrl
      previewWindowRef.focus()
      return true
    }

    // Named window (no noopener) so we get a Window reference and reuse the same tab.
    const tab = window.open(previewShellUrl, PREVIEW_WINDOW_NAME)
    if (tab) {
      previewWindowRef = tab
      tab.focus()
      return true
    }

    // Pop-up blocked — single fallback only. Do not chain extra window.open calls:
    // noopener makes window.open return null even when a tab opened, which caused 3 tabs.
    const link = document.createElement('a')
    link.href = previewShellUrl
    link.target = PREVIEW_WINDOW_NAME
    link.rel = 'noopener noreferrer'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
    return true
  } catch {
    return false
  }
}

/** Crisp labels on dense builder toolbars (avoids muddy 12px extrabold on Windows). */
export const BUILDER_CRISP_LABEL =
  'text-[13px] font-semibold leading-none tracking-[0.01em] antialiased subpixel-antialiased shrink-0 whitespace-nowrap'

/** Preview-in-browser control (builder toolbar + template gallery). */
export const STOREFRONT_PREVIEW_IN_BROWSER_BTN_CLASS =
  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${BUILDER_CRISP_LABEL} text-primary bg-accent/95 border-primary/40 hover:bg-primary/10`

/** @deprecated use STOREFRONT_PREVIEW_IN_BROWSER_BTN_CLASS */
export const STOREFRONT_OPEN_IN_BROWSER_BTN_CLASS = STOREFRONT_PREVIEW_IN_BROWSER_BTN_CLASS
