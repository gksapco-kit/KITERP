import { DRAFT_BROWSER_PREVIEW_PATH } from '@/lib/storefrontPreviewUrl'

const PREVIEW_SESSION_TOKEN_KEY = 'kiterp:draft-preview-token'

/** Paths that would hit vendor auth/commerce routes — keep user on draft preview instead. */
const BLOCKED_PREVIEW_PATHS = ['/login', '/register', '/cart', '/checkout']

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

  if (
    BLOCKED_PREVIEW_PATHS.includes(pathname)
    || pathname.startsWith('/account')
  ) {
    return `${DRAFT_BROWSER_PREVIEW_PATH}?token=${encodeURIComponent(token)}`
  }

  const params = new URLSearchParams()
  params.set('token', token)

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
