import { DRAFT_BROWSER_PREVIEW_PATH } from '@/lib/storefrontPreviewUrl'
import { parseCatalogStorePath, parseStorefrontEmbedRoute } from '@/lib/catalogStorePaths'

const PREVIEW_SESSION_TOKEN_KEY = 'kiterp:draft-preview-token'

export function rememberDraftPreviewToken(token: string): void {
  const t = token.trim()
  if (!t) return
  try {
    sessionStorage.setItem(PREVIEW_SESSION_TOKEN_KEY, t)
  } catch {
    /* private mode */
  }
}

export function recallDraftPreviewToken(): string {
  try {
    return sessionStorage.getItem(PREVIEW_SESSION_TOKEN_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

/** Builder website page only — never maps /products to a catalog iframe route. */
export function buildDraftPreviewPageUrl(previewToken: string, pageSlug?: string | null): string {
  const token = previewToken.trim() || recallDraftPreviewToken()
  const params = new URLSearchParams()
  if (token) params.set('token', token)
  const slug = pageSlug?.trim().replace(/^\/+/, '')
  if (slug && slug.toLowerCase() !== 'home') {
    params.set('page', slug)
  }
  const qs = params.toString()
  return qs ? `${DRAFT_BROWSER_PREVIEW_PATH}?${qs}` : DRAFT_BROWSER_PREVIEW_PATH
}

function appendQueryParams(params: URLSearchParams, queryString: string, skipExisting = false): void {
  if (!queryString) return
  new URLSearchParams(queryString).forEach((value, key) => {
    if (!skipExisting || !params.has(key)) params.set(key, value)
  })
}

/** True when the path should open the storefront catalog iframe (not a builder page). */
function isDraftPreviewCatalogPath(pathname: string): boolean {
  if (pathname === '/cart' || pathname === '/checkout' || pathname === '/login' || pathname === '/register') return true
  if (pathname.startsWith('/account')) return true
  if (/^\/order\/[^/]+\/(confirmation|status)$/.test(pathname)) return true
  const catalog = parseCatalogStorePath(pathname)
  if (!catalog) return false
  // /products/item-slug — catalog detail; bare /products is also the catalog list in preview.
  return Boolean(catalog.slug) || pathname === '/products' || pathname === '/services' || pathname === '/categories'
}

/** Strip /store/:vendorSlug or /:vendorSlug prefix when a link targets the live storefront path. */
function stripLiveStorePrefix(pathname: string): string {
  const store = pathname.match(/^\/store\/[^/]+(\/.*|$)/)
  if (store) {
    const rest = store[1]
    return rest && rest !== '/' ? rest.replace(/\/+$/, '') || '/' : '/'
  }
  const vendorPrefixed = pathname.match(
    /^\/[^/]+(\/(?:products|services|categories|blog|cart|checkout|login|register|account|contact|rentals|rental|order|preview|draft-catalog)(?:\/.*)?)?$/,
  )
  if (vendorPrefixed?.[1]) {
    return vendorPrefixed[1].replace(/\/+$/, '') || '/'
  }
  return pathname
}

/** In-preview navigation: stay on vendor-web /preview/draft with token + page or catalog route. */
export function buildDraftPreviewStorePath(previewToken: string, rawPath: string): string {
  const token = previewToken.trim() || recallDraftPreviewToken()
  if (!token) return DRAFT_BROWSER_PREVIEW_PATH

  const clean = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const qIdx = clean.indexOf('?')
  const pathnameRaw = (qIdx >= 0 ? clean.slice(0, qIdx) : clean).replace(/\/+$/, '') || '/'
  const pathname = stripLiveStorePrefix(pathnameRaw)
  const queryString = qIdx >= 0 ? clean.slice(qIdx + 1) : ''

  const pathForEmbed = pathname === pathnameRaw
    ? clean
    : `${pathname}${queryString ? `?${queryString}` : ''}`

  if (isDraftPreviewCatalogPath(pathname)) {
    const embedRoute = parseStorefrontEmbedRoute(pathForEmbed)
    if (embedRoute) {
      const params = new URLSearchParams()
      params.set('token', token)
      params.set('route', embedRoute.split('?')[0])
      const embedQs = embedRoute.includes('?') ? embedRoute.slice(embedRoute.indexOf('?') + 1) : ''
      appendQueryParams(params, embedQs)
      appendQueryParams(params, queryString, true)
      return `${DRAFT_BROWSER_PREVIEW_PATH}?${params.toString()}`
    }
  }

  if (pathname === '/') {
    const params = new URLSearchParams()
    params.set('token', token)
    appendQueryParams(params, queryString)
    return `${DRAFT_BROWSER_PREVIEW_PATH}?${params.toString()}`
  }

  const pageSlug = pathname.replace(/^\/+/, '')
  const params = new URLSearchParams()
  params.set('token', token)
  if (pageSlug && pageSlug.toLowerCase() !== 'home') {
    params.set('page', pageSlug)
  }
  appendQueryParams(params, queryString)
  return `${DRAFT_BROWSER_PREVIEW_PATH}?${params.toString()}`
}
