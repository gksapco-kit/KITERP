import type { PublicSite } from '@/blocks/registry'
import type { NavLinkItem } from '@/kit/types'
import {
  defaultCommerceNavLinksForCapabilities,
  enrichNavLinksWithBlogLink,
  enrichNavLinksWithCatalogCapabilities,
  enrichNavLinksWithRentalsLink,
  filterNavLinksByCatalogCapabilities,
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
  /** Vendor-web /preview/draft — never invent a full default commerce nav. */
  previewShell?: boolean
  /** Website builder canvas — never invent a full default commerce nav. */
  isEditorCanvas?: boolean
  /** Vendor catalog offering: products | services | both */
  offeringType?: string | null
  settings?: Record<string, unknown> | null
  productCount?: number | null
  serviceCount?: number | null
  /** When false, hide blog nav links and /blog routes from storefront nav. */
  blogEnabled?: boolean
  /** When false, hide Rentals marketplace nav link. Default true on vendor stores. */
  rentalsEnabled?: boolean
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

/**
 * Ensure a Home link exists, but keep the builder page order.
 * Forcing Home to the front made live-store nav ignore Pages reorder.
 */
export function applyHomeNavVisibility(
  links: NavLinkItem[],
  _pathname: string,
  storePath: (p: string) => string,
): NavLinkItem[] {
  const homeHref = storePath('/')
  const seen = new Set<string>()
  const next: NavLinkItem[] = []
  for (const link of links) {
    const key = pathRelativeToStore(link.href, storePath)
    if (seen.has(key)) continue
    seen.add(key)
    next.push(isStoreHomeNavHref(link.href, storePath) ? { ...link, label: 'Home', href: homeHref } : link)
  }
  if (!seen.has('/')) {
    next.unshift({ label: 'Home', href: homeHref })
  }
  return next
}

function pagesToNavItems(pages: SitePage[], storePath: (p: string) => string, limit: number): NavLinkItem[] {
  const seen = new Set<string>()
  const items: NavLinkItem[] = []
  const sorted = [...pages].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  for (const page of sorted) {
    const url = pageToNavUrl(page)
    if (seen.has(url)) continue
    seen.add(url)
    items.push({
      label: page.title?.trim() || (page.is_homepage ? 'Home' : (page.slug || 'Page')),
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
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  for (const page of sorted) {
    const url = pageToNavUrl(page)
    if (seen.has(url)) continue
    seen.add(url)
    items.push({
      title: page.title?.trim() || (page.is_homepage ? 'Home' : (page.slug || 'Page')),
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
  const isEditorCanvas = options?.isEditorCanvas === true
  // Builder/preview must not invent a full default nav (Home/Products/Services/…),
  // but they should still add missing Products/Services from offering type so the
  // canvas matches the live storefront when the site has no Services page yet.
  const skipDefaultCommerceNav = previewShell || isEditorCanvas
  const blogEnabled = options?.blogEnabled !== false

  // If the builder site owns its pages, tie rentals *nav-link* visibility to whether a
  // rentals page exists (slug `rentals` or singular `rental`). The header CTA is resolved
  // separately (see resolveNavCtaUrl) so a mislabeled "Rentals" button still reaches /rentals.
  const featureFlagEnabled = options?.rentalsEnabled !== false
  const siteHasManagedPages = Boolean(site?.pages?.length)
  const siteHasRentalsPage = !siteHasManagedPages ||
    site.pages.some(p => {
      const slug = String(p.slug || '').toLowerCase()
      return (slug === 'rentals' || slug === 'rental') && p.is_published !== false
    })
  const rentalsEnabled = featureFlagEnabled && siteHasRentalsPage
  const showNavLinks = props.show_nav_links !== false
  if (!showNavLinks) return []

  const navLinksSource = props.nav_links_source || 'site_pages'
  const rawLinks = props.nav_links || []
  const capabilities = resolveCatalogNavCapabilities({
    offeringType: options?.offeringType,
    settings: options?.settings,
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

  if (!skipDefaultCommerceNav) {
    enriched = enrichNavLinksWithRentalsLink(enriched, storePath, rentalsEnabled)
  }
  // Blog Manager "Show on website" must match live nav in the builder canvas too,
  // so admins can see which screens will publish.
  enriched = enrichNavLinksWithBlogLink(enriched, storePath, blogEnabled)

  if (enriched.length === 0 && !skipDefaultCommerceNav) {
    enriched = defaultCommerceNavLinksForCapabilities(storePath, capabilities, blogEnabled, rentalsEnabled)
  }

  // Single-page templates (e.g. Verde) only expose Home in site pages — after hiding
  // Home on the homepage that would render an empty nav bar.
  const hasNonHomeLinks = excludeHomeNavLinks(enriched, storePath).length > 0
  const sourceLinks = skipDefaultCommerceNav
    ? (enriched.length > 0 ? enriched : [{ label: 'Home', href: storePath('/') }])
    : (hasNonHomeLinks
      ? enriched
      : defaultCommerceNavLinksForCapabilities(storePath, capabilities, blogEnabled, rentalsEnabled))

  let links = applyHomeNavVisibility(sourceLinks, pathname, storePath)
  if (links.length === 0) {
    links = applyHomeNavVisibility(
      skipDefaultCommerceNav
        ? [{ label: 'Home', href: storePath('/') }]
        : defaultCommerceNavLinksForCapabilities(storePath, capabilities, blogEnabled, rentalsEnabled),
      pathname,
      storePath,
    )
  }
  return filterNavLinksByCatalogCapabilities(links, storePath, capabilities)
}

export function resolveStorefrontHeaderNavLinks(
  site: PublicSite | null | undefined,
  storePath: (p: string) => string,
  pathname: string,
  options?: Pick<ResolveNavBlockLinksOptions, 'offeringType' | 'settings' | 'productCount' | 'serviceCount' | 'blogEnabled' | 'rentalsEnabled'>,
): NavLinkItem[] {
  const capabilities = resolveCatalogNavCapabilities({
    offeringType: options?.offeringType,
    settings: options?.settings,
    site,
    productCount: options?.productCount,
    serviceCount: options?.serviceCount,
  })
  const blogEnabled = options?.blogEnabled !== false
  const rentalsEnabled = options?.rentalsEnabled !== false
  if (!site) {
    return applyHomeNavVisibility(
      defaultCommerceNavLinksForCapabilities(storePath, capabilities, blogEnabled, rentalsEnabled),
      pathname,
      storePath,
    )
  }
  const props = pickHomeNavBlockProps(site)
  const liveItems = sitePagesToLiveNavItems(site)
  return resolveNavBlockLinks(site, storePath, pathname, props, liveItems, options)
}

/** Normalize nav CTA button copy for storefront display. */
export function resolveNavCtaLabel(raw: string | null | undefined): string | null {
  const label = raw?.trim()
  if (!label) return null
  if (/^shop\s*now$/i.test(label)) return 'Get started'
  return label
}

/** True when nav/CTA copy clearly refers to the rentals marketplace (not "My Rentals"). */
export function isRentalsNavLabel(label: string | null | undefined): boolean {
  return /^(rentals?|storage\s*racks?)$/i.test((label || '').trim())
}

/**
 * Resolve the nav CTA destination.
 * When the button is labeled Rentals but the URL was left empty / defaulted to
 * Contact (common builder misconfig), send shoppers to the rentals catalog.
 */
export function resolveNavCtaUrl(
  rawUrl: string | null | undefined,
  label?: string | null,
): string {
  const url = (rawUrl || '').trim()
  const relative = url.split('?')[0].split('#')[0].replace(/\/+$/, '') || ''
  const isEmptyOrContact = !relative || relative.toLowerCase() === '/contact' || relative.toLowerCase() === 'contact'
  if (isRentalsNavLabel(label) && isEmptyOrContact) return '/rentals'
  // Singular /rental CMS pages never mount the live catalog.
  if (relative.toLowerCase() === '/rental' || relative.toLowerCase() === 'rental') return '/rentals'
  return url || '/contact'
}

export function resolveStorefrontHeaderCta(
  site: PublicSite | null | undefined,
  storePath: (p: string) => string,
): { label: string; href: string } | undefined {
  const props = pickHomeNavBlockProps(site)
  const label = resolveNavCtaLabel(props.cta_label)
  if (!label) return undefined
  return { label, href: storePath(resolveNavCtaUrl(props.cta_url, label)) }
}

/** Canonical storefront path for comparing nav link active state (/, /about, /products, …). */
export function resolveNavActiveKey(
  hrefOrLocation: string,
  storePath: (p: string) => string,
): string {
  const relative = pathRelativeToStore(hrefOrLocation, storePath)
  const clean = relative.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
  const lower = clean.toLowerCase()
  return lower === '/home' ? '/' : clean
}

export function resolveCurrentNavActiveKey(
  location: { pathname: string; search: string },
  storePath: (p: string) => string,
  editorPage?: { slug?: string | null; isHomepage?: boolean } | null,
): string {
  if (editorPage) {
    const slug = editorPage.slug?.trim().replace(/^\/+/, '').toLowerCase()
    if (editorPage.isHomepage || !slug || slug === 'home') return '/'
    return `/${slug}`
  }
  return resolveNavActiveKey(`${location.pathname}${location.search}`, storePath)
}

export function isNavLinkActive(
  linkHref: string,
  currentKey: string,
  storePath: (p: string) => string,
): boolean {
  return resolveNavActiveKey(linkHref, storePath) === currentKey
}
