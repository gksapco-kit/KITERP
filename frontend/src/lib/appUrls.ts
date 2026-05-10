/**
 * Vendor business dashboard (vendor-web). Local dev defaults to port 3001.
 * Set `VITE_VENDOR_URL` in production, e.g. https://vendor.example.com
 */
export const vendorAppBaseUrl = (import.meta.env.VITE_VENDOR_URL || 'http://localhost:3001').replace(/\/$/, '')

/** Opens vendor-web login with tenant slug so login resolves to this business. */
export function vendorDashboardLoginUrl(vendorSlug: string): string {
  const slug = vendorSlug.trim()
  const params = new URLSearchParams({ vendor: slug })
  return `${vendorAppBaseUrl}/login?${params.toString()}`
}
