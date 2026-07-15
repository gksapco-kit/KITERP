/**
 * Vendor business dashboard (vendor-web). Local dev defaults to port 3001.
 * Set `VITE_VENDOR_URL` in production, e.g. https://vendor.example.com
 */
export const vendorAppBaseUrl = (import.meta.env.VITE_VENDOR_URL || 'http://localhost:3001').replace(/\/$/, '')

/** True when the admin UI is on a loopback host (vite dev, preview, etc.). */
function isLoopbackAdminHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

/** Prefer 127.0.0.1 so vendor-web does not redirect localhost → 127.0.0.1 in a loop. */
function canonicalizeLoopbackHostname(hostname: string): string {
  if (hostname === 'localhost' || hostname === '[::1]') return '127.0.0.1'
  return hostname
}

function rewriteLoopbackOrigin(origin: string): string {
  try {
    const u = new URL(origin)
    u.hostname = canonicalizeLoopbackHostname(u.hostname)
    return u.origin
  } catch {
    return origin
  }
}

/**
 * Path-based storefront on port 3002 in local dev; production uses
 * `VITE_STOREFRONT_URL` + `/store/{slug}` (aligned with vendor-web `storefrontPreviewUrl.ts`).
 */
export function shouldUseLocalStorefrontUrls(): boolean {
  return import.meta.env.DEV || isLoopbackAdminHost()
}

const storefrontPublicBaseDomain = (import.meta.env.VITE_BASE_DOMAIN || 'kiterp.com')
  .replace(/^\.+/, '')
  .replace(/\/+$/, '')

/**
 * Public customer store URL for this vendor (no trailing slash).
 * - `VITE_STOREFRONT_URL`: `{env}/store/{slug}`
 * - local: `{protocol}//{host}:3002/store/{slug}`
 * - prod without env: same host as admin (`/store/{slug}`) — path-based gateway
 * - last resort: `https://{slug}.{VITE_BASE_DOMAIN}` (wildcard DNS only)
 */
export function getCustomerStorefrontBaseUrl(vendorSlug: string): string {
  const slug = vendorSlug.trim()
  const fromEnv = (import.meta.env.VITE_STOREFRONT_URL as string | undefined)?.trim()
  if (fromEnv) {
    return `${fromEnv.replace(/\/$/, '')}/store/${encodeURIComponent(slug)}`
  }
  if (typeof window !== 'undefined' && shouldUseLocalStorefrontUrls()) {
    const host = canonicalizeLoopbackHostname(window.location.hostname)
    return `${window.location.protocol}//${host}:3002/store/${encodeURIComponent(slug)}`
  }
  // Prod gateway serves admin at /admin and storefront at / on the same host.
  // Prefer path-based URLs over slug subdomains (those often have no DNS → NXDOMAIN).
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, '')}/store/${encodeURIComponent(slug)}`
  }
  return `https://${encodeURIComponent(slug)}.${storefrontPublicBaseDomain}`
}

/** Opens vendor-web login with tenant slug so login resolves to this business. */
export function vendorDashboardLoginUrl(vendorSlug: string): string {
  const slug = vendorSlug.trim()
  const params = new URLSearchParams({ vendor: slug })
  return `${rewriteLoopbackOrigin(vendorAppBaseUrl)}/login?${params.toString()}`
}

/**
 * Admin template preview URL.
 * Prefer storefront `/store/:slug/preview/:token` (stable, no vendor pending-nav sync).
 * Fall back to vendor-web draft shell on 127.0.0.1.
 */
export function buildAdminDraftPreviewUrl(
  previewToken: string,
  pageSlug?: string | null,
  vendorSlug?: string | null,
): string {
  const token = previewToken.trim()
  const slug = vendorSlug?.trim()
  const page = pageSlug?.trim()
  const pageSuffix =
    page && page.length > 0 && page.toLowerCase() !== 'home'
      ? `/${encodeURIComponent(page.replace(/^\/+/, ''))}`
      : ''

  if (slug) {
    const storeBase = getCustomerStorefrontBaseUrl(slug)
    return `${storeBase}/preview/${encodeURIComponent(token)}${pageSuffix}`
  }

  const vendorOrigin = rewriteLoopbackOrigin(vendorAppBaseUrl)
  const url = new URL(`${vendorOrigin}/preview/draft`)
  url.searchParams.set('token', token)
  if (pageSuffix) {
    url.searchParams.set('page', page!.replace(/^\/+/, ''))
  }
  return url.toString()
}
