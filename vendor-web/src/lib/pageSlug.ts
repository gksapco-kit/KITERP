import type { WebsitePage } from '@/types/websites'

/** Lowercase URL segment: letters, numbers, hyphens only. */
export function normalizePageSlug(raw: string): string {
  const stripped = raw.trim().toLowerCase().replace(/^\/+|\/+$/g, '')
  const slug = stripped
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return (slug.slice(0, 200) || 'page')
}

export function uniquePageSlug(
  base: string,
  pages: WebsitePage[],
  excludePageId?: string,
): string {
  const slugBase = normalizePageSlug(base)
  const taken = new Set(
    pages.filter(p => p.id !== excludePageId).map(p => p.slug.toLowerCase()),
  )
  if (!taken.has(slugBase)) return slugBase
  let n = 2
  while (taken.has(`${slugBase}-${n}`)) n += 1
  return `${slugBase}-${n}`
}

export function pageSlugTaken(
  slug: string,
  pages: WebsitePage[],
  excludePageId?: string,
): boolean {
  const norm = normalizePageSlug(slug)
  return pages.some(p => p.id !== excludePageId && p.slug.toLowerCase() === norm)
}
