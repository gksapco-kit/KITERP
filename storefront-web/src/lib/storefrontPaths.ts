/**
 * Public customer site URLs live at `/{vendorSlug}/…` (not `/store/{slug}`).
 * `/store/{slug}/…` is kept as a redirect alias for old links.
 * API routes such as `/api/v1/store/auth` are unrelated and stay unchanged.
 */

/** First path segments owned by the platform — vendors cannot use these slugs. */
export const RESERVED_VENDOR_SLUGS = new Set([
  'store',
  'stores',
  'admin',
  'vendor',
  'vendors',
  'api',
  'uploads',
  'health',
  'assets',
  'static',
  'cdn',
  'www',
  'app',
  'mail',
  'docs',
  'partners',
  'careers',
  'contact',
  'lead',
  'create-business',
  'local',
  'template-browser',
  'preview',
  'sitemap',
  'robots',
  'favicon',
  'sitemap.xml',
  'robots.txt',
  'favicon.ico',
  'well-known',
  'dashboard',
  'login',
  'register',
  'account',
  'products',
  'services',
  'cart',
  'checkout',
  'blog',
  'policies',
  'hr',
  'employee',
  'rentals',
  'order',
  'orders',
  'help',
  'about',
  'pricing',
  'terms',
  'privacy',
  'support',
  'status',
  'home',
  'index',
])

export function isReservedVendorSlug(slug: string | null | undefined): boolean {
  const value = (slug || '').trim().toLowerCase()
  return !value || RESERVED_VENDOR_SLUGS.has(value)
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment).trim()
  } catch {
    return segment.trim()
  }
}

function splitPathAndSearch(path: string): { pathname: string; extra: string } {
  const raw = path.startsWith('/') ? path : `/${path}`
  const qIdx = raw.indexOf('?')
  const hashIdx = raw.indexOf('#')
  let cut = raw.length
  if (qIdx >= 0) cut = Math.min(cut, qIdx)
  if (hashIdx >= 0) cut = Math.min(cut, hashIdx)
  return {
    pathname: (raw.slice(0, cut).replace(/\/+$/, '') || '/'),
    extra: raw.slice(cut),
  }
}

/** Canonical public path for a vendor site, e.g. `/rainbow-nursery` or `/rainbow-nursery/products`. */
export function storefrontPath(vendorSlug: string, path = '/'): string {
  const slug = vendorSlug.trim()
  const { pathname, extra } = splitPathAndSearch(path)
  const base = slug ? `/${encodeURIComponent(slug)}` : ''
  const body = pathname === '/' ? (base || '/') : `${base}${pathname}`
  return `${body}${extra}`
}

export function vendorBasePaths(vendorSlug: string): string[] {
  const raw = vendorSlug.trim()
  if (!raw) return []
  const encoded = encodeURIComponent(raw)
  const bases = new Set<string>()
  for (const segment of [raw, encoded]) {
    bases.add(`/${segment}`)
    bases.add(`/store/${segment}`)
  }
  return [...bases]
}

/** Relative path under a vendor site (`/` on home). Accepts both `/{slug}` and legacy `/store/{slug}`. */
export function relativePathUnderVendor(pathname: string, vendorSlug: string): string | null {
  const path = splitPathAndSearch(pathname).pathname
  const slug = vendorSlug.trim()
  if (!slug) return null
  for (const base of vendorBasePaths(slug)) {
    const b = base.replace(/\/+$/, '') || '/'
    if (path === b) return '/'
    if (path.startsWith(`${b}/`)) {
      return path.slice(b.length).replace(/\/+$/, '') || '/'
    }
  }
  return null
}

export function isVendorSubpath(pathname: string, vendorSlug: string, subpath: string): boolean {
  const rel = relativePathUnderVendor(pathname, vendorSlug)
  if (rel == null) return false
  const want = subpath.startsWith('/') ? subpath : `/${subpath}`
  if (want === '/') return rel === '/'
  return rel === want || rel.startsWith(`${want}/`)
}

/**
 * Resolve the vendor slug from the current tab URL.
 * Supports `/{slug}/…` and legacy `/store/{slug}/…`.
 */
export function vendorSlugFromLocation(pathname?: string): string | null {
  if (typeof window === 'undefined' && !pathname) return null
  const path = pathname ?? window.location.pathname
  const parts = (path.split('?')[0] || '').split('/').filter(Boolean)
  if (!parts.length) return null
  const start = parts[0].toLowerCase() === 'store' ? 1 : 0
  const slug = decodeSegment(parts[start] || '')
  if (!slug || isReservedVendorSlug(slug)) return null
  return slug
}

/** Rewrite `/store/{slug}/…` to `/{slug}/…` (same search/hash). */
export function stripLegacyStorePrefix(pathname: string, search = '', hash = ''): string | null {
  const m = pathname.match(/^\/store\/([^/]+)(\/.*)?$/)
  if (!m?.[1]) return null
  const slug = decodeSegment(m[1])
  if (!slug || isReservedVendorSlug(slug)) return null
  const rest = m[2] || ''
  return `/${encodeURIComponent(slug)}${rest}${search}${hash}`
}
