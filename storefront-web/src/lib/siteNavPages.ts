import type { PublicSite } from '@/blocks/registry'
import type { NavLinkItem } from '@/kit/types'

type SitePage = NonNullable<PublicSite['pages']>[number]

function pageToNavUrl(page: SitePage): string {
  let url = page.is_homepage ? '/' : `/${String(page.slug || '').replace(/^\/+|\/+$/g, '')}`
  if (url === '/home') url = '/'
  return url
}

function pagesToNavItems(pages: SitePage[], storePath: (p: string) => string, limit: number): NavLinkItem[] {
  const seen = new Set<string>()
  const items: NavLinkItem[] = []
  const sorted = [...pages].sort((a, b) => {
    if (a.is_homepage !== b.is_homepage) return a.is_homepage ? -1 : 1
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
  for (const page of sorted) {
    const url = pageToNavUrl(page)
    if (seen.has(url)) continue
    seen.add(url)
    items.push({
      label: page.is_homepage ? 'Home' : (page.title || page.slug || 'Page'),
      href: storePath(url),
    })
    if (items.length >= limit) break
  }
  return items
}

/** Build header nav links from embedded site pages (builder canvas + draft preview). */
export function sitePagesToNavLinks(
  site: PublicSite,
  storePath: (p: string) => string,
  limit = 20,
): NavLinkItem[] {
  const pages = site.pages || []
  if (!pages.length) return []

  const visible = pages.filter(p => p.show_in_nav !== false && p.is_published !== false)
  const source = visible.length > 0 ? visible : pages
  const items = pagesToNavItems(source, storePath, limit)
  if (items.length > 0) return items

  return pagesToNavItems(pages, storePath, limit)
}
