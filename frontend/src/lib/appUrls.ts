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

/**
 * Path-based storefront on port 3002 in local dev; production uses subdomains unless
 * `VITE_STOREFRONT_URL` is set (aligned with vendor-web `storefrontPreviewUrl.ts`).
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
 * - else: `https://{slug}.{VITE_BASE_DOMAIN}`
 */
export function getCustomerStorefrontBaseUrl(vendorSlug: string): string {
  const slug = vendorSlug.trim()
  const fromEnv = (import.meta.env.VITE_STOREFRONT_URL as string | undefined)?.trim()
  if (fromEnv) {
    return `${fromEnv.replace(/\/$/, '')}/store/${encodeURIComponent(slug)}`
  }
  if (typeof window !== 'undefined' && shouldUseLocalStorefrontUrls()) {
    return `${window.location.protocol}//${window.location.hostname}:3002/store/${encodeURIComponent(slug)}`
  }
  return `https://${encodeURIComponent(slug)}.${storefrontPublicBaseDomain}`
}

/** Opens vendor-web login with tenant slug so login resolves to this business. */
export function vendorDashboardLoginUrl(vendorSlug: string): string {
  const slug = vendorSlug.trim()
  const params = new URLSearchParams({ vendor: slug })
  return `${vendorAppBaseUrl}/login?${params.toString()}`
}
