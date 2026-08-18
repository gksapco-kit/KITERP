/**
 * Draft catalog preview — path-based embed under /:slug/draft-catalog/:token/...
 * (legacy /store/:slug/draft-catalog/:token/... still parses).
 * Catalog shell only (products, cart, checkout, …). Never loads live template home or builder pages.
 */

import { rememberDraftEmbedPreviewToken } from '@/lib/draftEmbedPreview'
import { isReservedVendorSlug, storefrontPath } from '@/lib/storefrontPaths'

const DRAFT_CATALOG_PATH_RE = /^(?:\/store)?\/([^/]+)\/draft-catalog\/([^/]+)(?:\/(.*))?$/

export function parseDraftCatalogEmbedPath(pathname: string): {
  vendorSlug: string
  previewToken: string
  routeSegment: string
} | null {
  const m = pathname.match(DRAFT_CATALOG_PATH_RE)
  if (!m) return null
  const vendorSlug = m[1]?.trim()
  const previewToken = m[2]?.trim()
  if (!vendorSlug || !previewToken || isReservedVendorSlug(vendorSlug)) return null
  const routeSegment = (m[3] || '').replace(/\/+$/, '')
  return { vendorSlug, previewToken, routeSegment }
}

export function isDraftCatalogEmbedPath(pathname: string): boolean {
  return DRAFT_CATALOG_PATH_RE.test(pathname.split('?')[0])
}

/** Build an in-store path for catalog preview navigation (no origin). */
export function buildDraftCatalogEmbedStorePath(
  vendorSlug: string,
  previewToken: string,
  catalogRoute: string,
): string {
  const slug = vendorSlug.trim()
  const token = previewToken.trim()
  const path = catalogRoute.replace(/^\/+|\/+$/g, '')
  const qIdx = path.indexOf('?')
  const routePath = qIdx >= 0 ? path.slice(0, qIdx) : path
  const routeQs = qIdx >= 0 ? path.slice(qIdx + 1) : ''
  const base = `${storefrontPath(slug, `/draft-catalog/${encodeURIComponent(token)}/${routePath}`)}`
  if (!routeQs) return base
  const params = new URLSearchParams(routeQs)
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

/** Map storefront path to ?route= segment for vendor-web parent sync. */
export function draftCatalogPathToEmbedRoute(pathname: string, vendorSlug: string): string | null {
  const parsed = parseDraftCatalogEmbedPath(pathname)
  if (!parsed || parsed.vendorSlug !== vendorSlug) return null
  return parsed.routeSegment || 'products'
}

export function rememberDraftCatalogPreviewTokenFromPath(pathname: string): void {
  const parsed = parseDraftCatalogEmbedPath(pathname.split('?')[0])
  if (parsed?.previewToken) rememberDraftEmbedPreviewToken(parsed.previewToken)
}
