/** Catalog route segment for vendor-web /preview/draft?route=… (mirrors vendor-web catalogStorePaths). */

export const DRAFT_EMBED_PREVIEW_NAV_TYPE = 'kiterp-preview-navigate'

const DRAFT_EMBED_PREVIEW_TOKEN_KEY = 'kiterp:draft-embed-preview-token'

export function rememberDraftEmbedPreviewToken(token: string): void {
  const t = token.trim()
  if (!t) return
  try {
    sessionStorage.setItem(DRAFT_EMBED_PREVIEW_TOKEN_KEY, t)
  } catch {
    /* private mode */
  }
}

export function recallDraftEmbedPreviewToken(): string {
  try {
    return sessionStorage.getItem(DRAFT_EMBED_PREVIEW_TOKEN_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export type DraftEmbedPreviewNavMessage = {
  type: typeof DRAFT_EMBED_PREVIEW_NAV_TYPE
  route?: string
}

function parseCatalogStorePath(rawPath: string): { kind: string; slug?: string } | null {
  const pathname = (rawPath || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
  const m = pathname.match(/^\/(products|services|categories)(?:\/([^/]+))?(?:\/(book))?$/i)
  if (!m) return null
  const kind = m[1].toLowerCase()
  const slug = m[2]?.trim()
  const sub = m[3]?.toLowerCase()
  if (sub === 'book') {
    if (kind !== 'services' || !slug) return null
    return { kind, slug: `${slug}/book` }
  }
  return slug ? { kind, slug } : { kind }
}

import { draftCatalogPathToEmbedRoute } from '@/lib/draftCatalogEmbed'

/** Map a storefront path under /store/:slug to a ?route= embed segment. */
export function storefrontPathToDraftEmbedRoute(pathname: string, vendorSlug: string): string | null {
  const fromDraftCatalog = draftCatalogPathToEmbedRoute(pathname.split('?')[0], vendorSlug)
  if (fromDraftCatalog) return fromDraftCatalog

  const prefix = `/store/${vendorSlug}`
  let rest = pathname
  if (rest.startsWith(prefix)) {
    rest = rest.slice(prefix.length).replace(/\/+$/, '') || '/'
  }
  rest = rest.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'

  if (rest.startsWith('/draft-catalog/')) {
    const afterToken = rest.replace(/^\/draft-catalog\/[^/]+\/?/, '')
    return afterToken || 'products'
  }

  if (rest === '/cart') return 'cart'
  if (rest === '/checkout') return 'checkout'
  if (rest === '/login') return 'login'
  if (rest === '/register') return 'register'
  if (rest.startsWith('/account')) return rest.slice(1)

  const orderMatch = rest.match(/^\/order\/([^/]+)\/(confirmation|status)$/)
  if (orderMatch) return `order/${orderMatch[1]}/${orderMatch[2]}`

  const catalog = parseCatalogStorePath(rest)
  if (catalog) {
    return catalog.slug ? `${catalog.kind}/${catalog.slug}` : catalog.kind
  }

  if (rest === '/products' || rest === '/services' || rest === '/categories') {
    return rest.slice(1)
  }

  return null
}

/** Tell the vendor-web preview tab to sync its address bar (?route=) with iframe navigation. */
export function notifyDraftPreviewParentRoute(route: string): void {
  const trimmed = route.trim().replace(/^\/+|\/+$/g, '')
  if (!trimmed || typeof window === 'undefined' || window.parent === window) return
  try {
    window.parent.postMessage(
      { type: DRAFT_EMBED_PREVIEW_NAV_TYPE, route: trimmed },
      window.location.origin,
    )
  } catch {
    /* cross-origin or closed parent */
  }
}
