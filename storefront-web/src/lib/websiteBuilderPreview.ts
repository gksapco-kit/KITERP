/** Path segments reserved by the storefront shell — not builder CMS page slugs. */
export const STORE_SHELL_SEGMENTS = new Set([
  'login',
  'register',
  'forgot-password',
  'products',
  'services',
  'cart',
  'checkout',
  'account',
  'blog',
  'policies',
  'table',
  'reserve',
  'preview',
  'hr',
  'employee',
])

export const PREVIEW_PAGE_QUERY = 'previewPage'

export function resolveWebsiteBuilderPageSlug(
  pathname: string,
  options: {
    vendorSlug?: string
    liveRouteSlug?: string
    previewPageFromQuery?: string | null
  } = {},
): string {
  const fromQuery = options.previewPageFromQuery?.trim()
  if (fromQuery) return fromQuery

  const liveRouteSlug = options.liveRouteSlug?.trim()
  if (liveRouteSlug) return decodeURIComponent(liveRouteSlug).trim() || 'home'

  const vendorSlug = options.vendorSlug?.trim()
  if (!vendorSlug) return 'home'

  const prefix = `/store/${vendorSlug}`
  if (!pathname.startsWith(prefix)) return 'home'

  const rest = pathname.slice(prefix.length).replace(/^\//, '').split('/').filter(Boolean)[0]
  if (!rest) return 'home'
  if (STORE_SHELL_SEGMENTS.has(rest)) return 'home'
  return decodeURIComponent(rest)
}
