export const SEO_TITLE_MAX = 60
export const SEO_DESCRIPTION_MAX = 160
export const SEO_FOCUS_KEYWORD_MAX = 80
export const SEO_KEYWORDS_MAX = 500
export const SEO_CANONICAL_MAX = 500

export function clampSeoTitle(value: string): string {
  return value.slice(0, SEO_TITLE_MAX)
}

export function clampSeoDescription(value: string): string {
  return value.slice(0, SEO_DESCRIPTION_MAX)
}

export function clampFocusKeyword(value: string): string {
  return value.slice(0, SEO_FOCUS_KEYWORD_MAX)
}

export function clampSeoKeywords(value: string): string {
  return value.slice(0, SEO_KEYWORDS_MAX)
}

export function clampCanonicalUrl(value: string): string {
  return value.slice(0, SEO_CANONICAL_MAX)
}
