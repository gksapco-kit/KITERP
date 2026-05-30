/** True when the dashboard is opened on a loopback host (vite dev, vite preview, etc.). */
function isLoopbackDashboardHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
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
    return `${window.location.protocol}//${window.location.hostname}:3002`
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

/** Crisp labels on dense builder toolbars (avoids muddy 12px extrabold on Windows). */
export const BUILDER_CRISP_LABEL =
  'text-[13px] font-semibold leading-none tracking-[0.01em] antialiased subpixel-antialiased shrink-0 whitespace-nowrap'

/** Preview-in-browser control (builder toolbar + template gallery). */
export const STOREFRONT_PREVIEW_IN_BROWSER_BTN_CLASS =
  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${BUILDER_CRISP_LABEL} text-primary bg-accent/95 border-primary/40 hover:bg-primary/10`

/** @deprecated use STOREFRONT_PREVIEW_IN_BROWSER_BTN_CLASS */
export const STOREFRONT_OPEN_IN_BROWSER_BTN_CLASS = STOREFRONT_PREVIEW_IN_BROWSER_BTN_CLASS
