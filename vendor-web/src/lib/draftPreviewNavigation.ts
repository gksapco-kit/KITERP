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

/** In-preview navigation: always stay on vendor-web /preview/draft with token + optional page slug. */
export function buildDraftPreviewStorePath(previewToken: string, rawPath: string): string {
  const token = previewToken.trim() || recallDraftPreviewToken()
  if (!token) return DRAFT_BROWSER_PREVIEW_PATH

  const clean = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const qIdx = clean.indexOf('?')
  const pathname = (qIdx >= 0 ? clean.slice(0, qIdx) : clean).replace(/\/+$/, '') || '/'
  const queryString = qIdx >= 0 ? clean.slice(qIdx + 1) : ''

  const embedRoute = parseStorefrontEmbedRoute(clean)
  if (embedRoute) {
    const params = new URLSearchParams()
    params.set('token', token)
    params.set('route', embedRoute.split('?')[0])
    const embedQs = embedRoute.includes('?') ? embedRoute.slice(embedRoute.indexOf('?') + 1) : ''
    if (embedQs) {
      new URLSearchParams(embedQs).forEach((value, key) => {
        params.set(key, value)
      })
    }
    if (queryString) {
      new URLSearchParams(queryString).forEach((value, key) => {
        if (!params.has(key)) params.set(key, value)
      })
    }
    return `${DRAFT_BROWSER_PREVIEW_PATH}?${params.toString()}`
  }

  const params = new URLSearchParams()
  params.set('token', token)

  const catalog = parseCatalogStorePath(pathname)
  if (catalog) {
    params.set('route', catalog.slug ? `${catalog.kind}/${catalog.slug}` : catalog.kind)
    if (queryString) {
      new URLSearchParams(queryString).forEach((value, key) => {
        params.set(key, value)
      })
    }
    return `${DRAFT_BROWSER_PREVIEW_PATH}?${params.toString()}`
  }

  if (pathname !== '/') {
    const pageSlug = pathname.replace(/^\/+/, '')
    if (pageSlug && pageSlug.toLowerCase() !== 'home') {
      params.set('page', pageSlug)
    }
  }

  if (queryString) {
    new URLSearchParams(queryString).forEach((value, key) => {
      params.set(key, value)
    })
  }

  return `${DRAFT_BROWSER_PREVIEW_PATH}?${params.toString()}`
}
