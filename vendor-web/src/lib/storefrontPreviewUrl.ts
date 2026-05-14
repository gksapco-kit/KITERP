/** True when the dashboard is opened on a loopback host (vite dev, vite preview, etc.). */
function isLoopbackDashboardHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

/**
 * Use path-based storefront URLs on port 3002 (separate Vite app), not production subdomains.
 * `import.meta.env.DEV` is false for `vite preview` and production builds — loopback check still routes locally.
 */
export function shouldUseLocalStorefrontUrls(): boolean {
  return import.meta.env.DEV || isLoopbackDashboardHost()
}

/**
 * Base URL of the storefront SPA (no trailing slash).
 * Matches "Open in browser" in WebsiteTemplatePreviewModal:
 * - VITE_STOREFRONT_URL when set
 * - dev: same host, port 3002
 * - prod: current origin (same deployment as vendor app)
 */
export function getStorefrontAppOrigin(): string {
  const fromEnv = (import.meta.env.VITE_STOREFRONT_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (shouldUseLocalStorefrontUrls()) {
    return `${window.location.protocol}//${window.location.hostname}:3002`
  }
  return window.location.origin.replace(/\/$/, '')
}

/**
 * Public customer store URL for this vendor (no query string, no trailing slash).
 * Used for "open store" / branch links from vendor-web.
 * - VITE_STOREFRONT_URL: `{env}/store/{slug}`
 * - local dashboard (dev / preview on localhost): `{protocol}//{host}:3002/store/{slug}`
 * - prod without env: `https://{slug}.kiterp.com` (subdomain deployment)
 */
export function getCustomerStorefrontBaseUrl(vendorSlug: string): string {
  const slug = vendorSlug.trim()
  const fromEnv = (import.meta.env.VITE_STOREFRONT_URL as string | undefined)?.trim()
  if (fromEnv) return `${fromEnv.replace(/\/$/, '')}/store/${encodeURIComponent(slug)}`
  if (shouldUseLocalStorefrontUrls()) {
    return `${window.location.protocol}//${window.location.hostname}:3002/store/${encodeURIComponent(slug)}`
  }
  return `https://${slug}.kiterp.com`
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

/** Shared with WebsiteTemplatePreviewModal "Open in browser" link. */
export const STOREFRONT_OPEN_IN_BROWSER_BTN_CLASS =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold text-primary bg-accent border border-primary/30 hover:bg-primary/15 transition-colors'
