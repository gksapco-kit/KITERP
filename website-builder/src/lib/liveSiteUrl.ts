import { getEmbedBranchCode, getEmbedVendorSlug, getStorefrontOrigin } from './embedConfig'

const BUILDER_BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || ''

/** Internal builder live preview on vendor host (:3001 embed). */
export function getBuilderLivePreviewUrl(pageSlug?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : 'http://127.0.0.1:3001'
  const base = `${origin}${BUILDER_BASE}/site`.replace(/([^:]\/)\/+/g, '$1')
  const slug = pageSlug?.trim() || 'home'
  return `${base}/${encodeURIComponent(slug)}`
}

/**
 * View Live Site — customer store on business front (:3002).
 * Draft preview: always `/store/{vendor}?previewKey=…&previewPage=…` so slugs like
 * `services` do not hit the catalog `/store/{vendor}/services` route.
 * Published (no previewKey): `/store/{vendor}` or `/store/{vendor}/{pageSlug}`.
 */
export function getLiveSiteUrl(pageSlug?: string, previewKey?: string): string {
  const storefront = getStorefrontOrigin().replace(/\/$/, '')
  const vendorSlug = getEmbedVendorSlug()?.trim()
  const slug = pageSlug?.trim() || 'home'
  const branch = getEmbedBranchCode()?.trim()
  const key = previewKey?.trim()

  if (!vendorSlug) {
    const fallback = new URL(`${storefront}/live/${encodeURIComponent(slug)}`)
    if (key) fallback.searchParams.set('previewKey', key)
    return fallback.toString()
  }

  const url = new URL(`/store/${encodeURIComponent(vendorSlug)}`, `${storefront}/`)

  if (key) {
    url.searchParams.set('previewKey', key)
    url.searchParams.set('previewPage', slug)
  } else if (slug !== 'home') {
    url.pathname = `${url.pathname}/${encodeURIComponent(slug)}`.replace(/\/+/g, '/')
  }

  if (branch) url.searchParams.set('branch', branch)
  return url.toString()
}
