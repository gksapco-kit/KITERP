import { getDraftBrowserPreviewAbsolutePath, getStorefrontAppOrigin, getVendorPreviewOrigin } from '@/lib/storefrontPreviewUrl'

export type CatalogRouteKind = 'products' | 'services' | 'categories'

export interface ParsedCatalogPath {
  kind: CatalogRouteKind
  slug?: string
}

/** Parse storefront catalog paths like /products/cosmotics (not website builder page slugs). */
export function parseCatalogStorePath(rawPath: string): ParsedCatalogPath | null {
  const clean = (rawPath || '/').split('?')[0].split('#')[0]
  const pathname = (clean.startsWith('/') ? clean : `/${clean}`).replace(/\/+$/, '') || '/'
  const m = pathname.match(/^\/(products|services|categories)(?:\/([^/]+))?(?:\/(book))?$/i)
  if (!m) return null
  const kind = m[1].toLowerCase() as CatalogRouteKind
  const slug = m[2]?.trim()
  const sub = m[3]?.toLowerCase()
  if (sub === 'book') {
    if (kind !== 'services' || !slug) return null
    return { kind, slug: `${slug}/book` }
  }
  return slug ? { kind, slug } : { kind }
}

/**
 * Map storefront paths (cart, login, product list, …) to embed segments under /store/:slug/.
 * Returns null for website builder page slugs like /about.
 */
export function parseStorefrontEmbedRoute(rawPath: string): string | null {
  const clean = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const qIdx = clean.indexOf('?')
  const pathname = (qIdx >= 0 ? clean.slice(0, qIdx) : clean).replace(/\/+$/, '') || '/'
  const queryString = qIdx >= 0 ? clean.slice(qIdx + 1) : ''
  const qs = queryString ? `?${queryString}` : ''

  if (pathname === '/cart') return `cart${qs}`
  if (pathname === '/checkout') return `checkout${qs}`
  if (pathname === '/login') return `login${qs}`
  if (pathname === '/register') return `register${qs}`
  if (pathname.startsWith('/account')) return `${pathname.slice(1)}${qs}`

  const orderMatch = pathname.match(/^\/order\/([^/]+)\/(confirmation|status)$/)
  if (orderMatch) return `order/${orderMatch[1]}/${orderMatch[2]}${qs}`

  const catalog = parseCatalogStorePath(pathname)
  if (catalog) {
    const base = catalog.slug ? `${catalog.kind}/${catalog.slug}` : catalog.kind
    return `${base}${qs}`
  }

  if (pathname === '/products' || pathname === '/services' || pathname === '/categories') {
    return `${pathname.slice(1)}${qs}`
  }

  return null
}

/** `products/cosmotics` or `services/foo/book` or `cart` from a ?route= query value. */
export function parseCatalogRouteParam(route: string): ParsedCatalogPath | null {
  const trimmed = route.trim().replace(/^\/+|\/+$/g, '')
  if (!trimmed) return null
  if (trimmed === 'cart' || trimmed.startsWith('cart?')) return { kind: 'products' }
  if (trimmed === 'login' || trimmed.startsWith('login?')) return { kind: 'products' }
  if (trimmed.startsWith('account')) return { kind: 'products' }
  return parseCatalogStorePath(`/${trimmed.split('?')[0]}`)
}

/** Stay on vendor-web draft preview (port 3001) for catalog links. */
export function buildDraftPreviewCatalogUrl(
  previewToken: string,
  rawPath: string,
  pageSlug?: string | null,
): string | null {
  const token = previewToken.trim()
  if (!token) return null
  const embedRoute = parseStorefrontEmbedRoute(rawPath)
  if (!embedRoute) return null
  const url = new URL(getDraftBrowserPreviewAbsolutePath(), getVendorPreviewOrigin())
  url.searchParams.set('token', token)
  url.searchParams.set('route', embedRoute.split('?')[0])
  const embedQs = embedRoute.includes('?') ? embedRoute.slice(embedRoute.indexOf('?') + 1) : ''
  if (embedQs) {
    new URLSearchParams(embedQs).forEach((value, key) => {
      url.searchParams.set(key, value)
    })
  }
  const page = pageSlug?.trim()
  if (page && page.toLowerCase() !== 'home') {
    url.searchParams.set('page', page.replace(/^\/+/, ''))
  }
  return url.toString()
}

/**
 * Storefront URL embedded inside the 3001 preview iframe (not the browser address bar).
 * Uses /draft-catalog/:token/… so live template home and builder pages never load.
 */
export function buildStorefrontCatalogEmbedUrl(
  vendorSlug: string,
  catalogRoute: string,
  previewToken?: string | null,
): string {
  const slug = vendorSlug.trim()
  const token = previewToken?.trim()
  if (!token) {
    throw new Error('buildStorefrontCatalogEmbedUrl requires previewToken')
  }
  const path = catalogRoute.replace(/^\/+|\/+$/g, '')
  const qIdx = path.indexOf('?')
  const routePath = qIdx >= 0 ? path.slice(0, qIdx) : path
  const routeQs = qIdx >= 0 ? path.slice(qIdx + 1) : ''
  const base = `${getStorefrontAppOrigin()}/store/${encodeURIComponent(slug)}/draft-catalog/${encodeURIComponent(token)}/${routePath}`
  if (!routeQs) return base
  const params = new URLSearchParams(routeQs)
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}
