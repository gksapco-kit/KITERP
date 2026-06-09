/**
 * Cross-app URLs. Set in `.env` for staging/production, e.g.
 *   VITE_VENDOR_URL=https://vendor.example.com
 *   VITE_ADMIN_URL=https://admin.example.com
 */
export const vendorAppUrl = import.meta.env.VITE_VENDOR_URL || 'http://localhost:3001'
export const adminAppUrl = import.meta.env.VITE_ADMIN_URL || 'http://localhost:3000'

/** After signup on the business front, open vendor welcome with tokens + display context. */
export function buildVendorWelcomeUrl(params: {
  access_token: string
  refresh_token?: string
  vendor_slug?: string
  business_name?: string
  full_name?: string
  business_category?: string
}): string {
  const base = vendorAppUrl.replace(/\/$/, '')
  const url = new URL(`${base}/welcome`)
  url.searchParams.set('token', params.access_token)
  if (params.refresh_token) url.searchParams.set('refresh', params.refresh_token)
  if (params.vendor_slug) url.searchParams.set('vendorSlug', params.vendor_slug)
  if (params.business_name) url.searchParams.set('businessName', params.business_name)
  if (params.full_name) url.searchParams.set('fullName', params.full_name)
  if (params.business_category) url.searchParams.set('businessCategory', params.business_category)
  return url.toString()
}
