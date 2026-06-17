import type { PublicSite } from '@/blocks/registry'
import type { NavLinkItem } from '@/kit/types'
import {
  defaultCommerceNavLinksForCapabilities,
  enrichNavLinksWithCatalogCapabilities,
  pathRelativeToStore,
  resolveCatalogNavCapabilities,
} from '@/lib/catalogNavCapabilities'

type SitePage = NonNullable<PublicSite['pages']>[number]

export type NavBlockNavProps = {
  show_nav_links?: boolean
  nav_links_source?: string
  nav_links?: Array<{ label: string; url: string }>
  cta_label?: string | null
  cta_url?: string | null
}

export type ResolveNavBlockLinksOptions = {
  /** Vendor-web /preview/draft — never invent default commerce links. */
  previewShell?: boolean
  /** Vendor catalog offering: products | services | both */
  offeringType?: string | null
  productCount?: number | null
  serviceCount?: number | null
}

export type SitePageNavItem = { title: string; url?: string }

function pageToNavUrl(page: SitePage): string {
  let url = page.is_homepage ? '/' : `/${String(page.slug || '').replace(/^\/+|\/+$/g, '')}`
  if (url === '/home') url = '/'
  return url
}

function stripPath(s: string): string {
  return s.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
}

export function isStoreHomeNavHref(href: string, storePath: (p: string) => string): boolean {
  return pathRelativeToStore(href, storePath) === '/'
}

export function isStoreHomePath(pathname: string, storePath: (p: string) => string): boolean {
  return stripPath(pathname) === stripPath(storePath('/'))
}

export function excludeHomeNavLinks(
  links: NavLinkItem[],
  storePath: (p: string) => string,
): NavLinkItem[] {
  return links.filter(l => !isStoreHomeNavHref(l.href, storePath))
}

/** Always show Home as the first nav link (deduped if already present elsewhere). */
export function applyHomeNavVisibility(
  links: NavLinkItem[],
  _pathname: string,
  storePath: (p: string) => string,
): NavLinkItem[] {
  const rest = excludeHomeNavLinks(links, storePath)
  return [{ label: 'Home', href: storePath('/') }, ...rest]
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

/** Live nav items derived from embedded site pages (same shape NavBlock expects). */
export function sitePagesToLiveNavItems(site: PublicSite, limit = 20): SitePageNavItem[] {
  const pages = site.pages || []
  if (!pages.length) return []
  const seen = new Set<string>()
  const items: SitePageNavItem[] = []
  const sorted = [...pages]
    .filter(p => p.show_in_nav !== false && p.is_published !== false)
    .sort((a, b) => {
      if (a.is_homepage !== b.is_homepage) return a.is_homepage ? -1 : 1
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })
  for (const page of sorted) {
    const url = pageToNavUrl(page)
    if (seen.has(url)) continue
    seen.add(url)
    items.push({
      title: page.is_homepage ? 'Home' : (page.title || page.slug || 'Page'),
      url,
    })
    if (items.length >= limit) break
  }
  return items
}

export function pickHomeNavBlockProps(site: PublicSite | null | undefined): NavBlockNavProps {
  if (!site?.pages?.length) return {}
  const homePage = site.pages.find(p => p.is_homepage) || site.pages[0]
  const navBlock = homePage?.blocks?.find(b => b.block_type === 'nav')
  return (navBlock?.props || {}) as NavBlockNavProps
}

export function defaultStoreCommerceNavLinks(storePath: (p: string) => string): NavLinkItem[] {
  return defaultCommerceNavLinksForCapabilities(
    storePath,
    resolveCatalogNavCapabilities({ offeringType: 'both' }),
  )
}

/** Shared nav link resolution for NavBlock and StoreLayout header. */
export function resolveNavBlockLinks(
  site: PublicSite,
  storePath: (p: string) => string,
  pathname: string,
  props: NavBlockNavProps,
  liveItems: SitePageNavItem[] = [],
  options?: ResolveNavBlockLinksOptions,
): NavLinkItem[] {
  const previewShell = options?.previewShell === true
  const showNavLinks = props.show_nav_links !== false
  if (!showNavLinks) return []

  const navLinksSource = props.nav_links_source || 'site_pages'
  const rawLinks = props.nav_links || []
  const capabilities = resolveCatalogNavCapabilities({
    offeringType: options?.offeringType,
    site,
    productCount: options?.productCount,
    serviceCount: options?.serviceCount,
  })
  let pageLinks: NavLinkItem[] = []

  if (navLinksSource === 'manual') {
    pageLinks = rawLinks.map(l => ({ label: l.label, href: storePath(l.url) }))
  } else if (navLinksSource === 'site_pages') {
    pageLinks = sitePagesToNavLinks(site, storePath, 20)
    if (pageLinks.length === 0 && liveItems.length > 0) {
      pageLinks = liveItems.map(item => ({ label: item.title, href: storePath(item.url || '/') }))
    }
  } else if (liveItems.length > 0) {
    pageLinks = liveItems.map(item => ({ label: item.title, href: storePath(item.url || '/') }))
  } else if (rawLinks.length > 0) {
    pageLinks = rawLinks.map(l => ({ label: l.label, href: storePath(l.url) }))
  }

  const deduped: NavLinkItem[] = []
  const seen = new Set<string>()
  for (const link of pageLinks) {
    if (seen.has(link.href)) continue
    seen.add(link.href)
    deduped.push(link)
  }

  const autoCatalogNav = navLinksSource !== 'manual'
  let enriched = autoCatalogNav
    ? enrichNavLinksWithCatalogCapabilities(deduped, storePath, capabilities, site)
    : deduped

  if (enriched.length === 0 && !previewShell) {
    enriched = defaultCommerceNavLinksForCapabilities(storePath, capabilities)
  }

  // Single-page templates (e.g. Verde) only expose Home in site pages — after hiding
  // Home on the homepage that would render an empty nav bar.
  const hasNonHomeLinks = excludeHomeNavLinks(enriched, storePath).length > 0
  const sourceLinks = previewShell
    ? (enriched.length > 0 ? enriched : [{ label: 'Home', href: storePath('/') }])
    : (hasNonHomeLinks
      ? enriched
      : defaultCommerceNavLinksForCapabilities(storePath, capabilities))

  let links = applyHomeNavVisibility(sourceLinks, pathname, storePath)
  if (links.length === 0) {
    links = applyHomeNavVisibility(
      previewShell
        ? [{ label: 'Home', href: storePath('/') }]
        : defaultCommerceNavLinksForCapabilities(storePath, capabilities),
      pathname,
      storePath,
    )
  }
  return links
}

export function resolveStorefrontHeaderNavLinks(
  site: PublicSite | null | undefined,
  storePath: (p: string) => string,
  pathname: string,
  options?: Pick<ResolveNavBlockLinksOptions, 'offeringType' | 'productCount' | 'serviceCount'>,
): NavLinkItem[] {
  const capabilities = resolveCatalogNavCapabilities({
    offeringType: options?.offeringType,
    site,
    productCount: options?.productCount,
    serviceCount: options?.serviceCount,
  })
  if (!site) {
    return applyHomeNavVisibility(
      defaultCommerceNavLinksForCapabilities(storePath, capabilities),
      pathname,
      storePath,
    )
  }
  const props = pickHomeNavBlockProps(site)
  const liveItems = sitePagesToLiveNavItems(site)
  return resolveNavBlockLinks(site, storePath, pathname, props, liveItems, options)
}

export function resolveStorefrontHeaderCta(
  site: PublicSite | null | undefined,
  storePath: (p: string) => string,
): { label: string; href: string } | undefined {
  const props = pickHomeNavBlockProps(site)
  const label = props.cta_label?.trim()
  if (!label) return undefined
  return { label, href: storePath(props.cta_url || '/contact') }
}
