import type { PublicSite } from '@/blocks/registry'
import type { NavLinkItem } from '@/kit/types'

export type CatalogOffering = 'products' | 'services' | 'both'

const PRODUCT_BLOCK_TYPES = new Set([
  'product_grid',
  'menu_grid',
  'live_stock',
  'live_quote',
  'product_detail',
  'category_cards',
  'cart_drawer',
  'related_products',
])

const SERVICE_BLOCK_TYPES = new Set([
  'services_cards',
  'services_list',
  'booking_widget',
  'booking_slot_picker',
])

const PRODUCT_PAGE_SLUGS = new Set(['products', 'product', 'menu', 'shop', 'catalog', 'store'])
const SERVICE_PAGE_SLUGS = new Set(['services', 'service', 'book', 'booking'])

export type CatalogNavCapabilities = {
  showProducts: boolean
  showServices: boolean
}

export function isVendorBlogEnabled(settings?: Record<string, unknown> | null): boolean {
  if (!settings) return true
  if (typeof settings.blog_enabled === 'boolean') return settings.blog_enabled
  const features = settings.features as Record<string, unknown> | undefined
  if (features && typeof features.blog === 'boolean') return features.blog
  return true
}

/** Rentals marketplace link on vendor storefronts (not the platform landing). Default on. */
export function isVendorRentalsEnabled(settings?: Record<string, unknown> | null): boolean {
  if (!settings) return true
  const features = settings.features as Record<string, unknown> | undefined
  if (features && typeof features.rentals === 'boolean') return features.rentals
  return true
}

export type ResolveCatalogNavCapabilitiesInput = {
  offeringType?: string | null
  sellingMode?: string | null
  settings?: Record<string, unknown> | null
  site?: PublicSite | null
  /** When set, hide catalog nav if the branch/store has no live items. */
  productCount?: number | null
  serviceCount?: number | null
}

function parseCatalogOffering(raw?: string | null): CatalogOffering | null {
  const value = (raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (value === 'products' || value === 'product' || value === 'products_only') return 'products'
  if (value === 'services' || value === 'service' || value === 'services_only') return 'services'
  if (value === 'both' || value === 'all' || value === 'products_and_services' || value === 'products_services') {
    return 'both'
  }
  return null
}

export function normalizeCatalogOffering(raw?: string | null): CatalogOffering {
  return parseCatalogOffering(raw) ?? 'both'
}

/** First valid offering among vendor column, store settings, and site selling mode. */
export function pickCatalogOffering(...raws: Array<string | null | undefined>): CatalogOffering | null {
  for (const raw of raws) {
    const parsed = parseCatalogOffering(raw)
    if (parsed) return parsed
  }
  return null
}

export function resolveStorefrontOfferingType(input: {
  offeringType?: string | null
  settings?: Record<string, unknown> | null
  sellingMode?: string | null
}): CatalogOffering {
  const settingsOffering = typeof input.settings?.offering_type === 'string'
    ? input.settings.offering_type
    : null
  return pickCatalogOffering(input.offeringType, settingsOffering, input.sellingMode) ?? 'both'
}

export function catalogSearchPlaceholder(offering: CatalogOffering): string {
  if (offering === 'services') return 'Search services…'
  if (offering === 'products') return 'Search products…'
  return 'Search products and services…'
}

function stripStorePath(href: string): string {
  return href.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
}

/** Map vendor-web /preview/draft?token&page|route URLs back to storefront paths (/about, /products, …). */
function parseDraftPreviewNavTarget(href: string): string | null {
  try {
    const url = new URL(href, 'http://local.invalid')
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    if (pathname !== '/preview/draft') return null
    const route = url.searchParams.get('route')?.trim()
    if (route) {
      const base = route.split('?')[0].replace(/^\/+|\/+$/g, '')
      return base ? `/${base}` : '/'
    }
    const page = url.searchParams.get('page')?.trim()
    if (page && page.toLowerCase() !== 'home') {
      return `/${page.replace(/^\/+/, '')}`
    }
    return '/'
  } catch {
    return null
  }
}

/** Logical storefront path for a nav href (works for live store URLs and draft preview query URLs). */
export function pathRelativeToStore(href: string, storePath: (p: string) => string): string {
  const previewTarget = parseDraftPreviewNavTarget(href)
  if (previewTarget) return previewTarget
  const storeRoot = stripStorePath(storePath('/'))
  const full = stripStorePath(href)
  if (full === storeRoot) return '/'
  if (full.startsWith(`${storeRoot}/`)) return full.slice(storeRoot.length) || '/'
  return full.startsWith('/') ? full : `/${full}`
}

export function inferCatalogSignalsFromSite(site?: PublicSite | null): CatalogNavCapabilities {
  let showProducts = false
  let showServices = false
  if (!site?.pages?.length) return { showProducts, showServices }

  for (const page of site.pages) {
    const slug = String(page.slug || '').trim().toLowerCase()
    const pageType = String(page.page_type || '').trim().toLowerCase()
    if (PRODUCT_PAGE_SLUGS.has(slug) || pageType === 'products') showProducts = true
    if (SERVICE_PAGE_SLUGS.has(slug) || pageType === 'services') showServices = true
    for (const block of page.blocks || []) {
      if (PRODUCT_BLOCK_TYPES.has(block.block_type)) showProducts = true
      if (SERVICE_BLOCK_TYPES.has(block.block_type)) showServices = true
    }
  }

  const style = (site.style_config || {}) as Record<string, unknown>
  const businessType = String(style.business_type || '').trim().toLowerCase()
  if (businessType === 'restaurant') showProducts = true

  return { showProducts, showServices }
}

export function resolveCatalogNavCapabilities(input: ResolveCatalogNavCapabilitiesInput): CatalogNavCapabilities {
  const style = (input.site?.style_config || {}) as Record<string, unknown>
  const offering = resolveStorefrontOfferingType({
    offeringType: input.offeringType,
    settings: input.settings,
    sellingMode: input.sellingMode ?? (style.selling_mode as string | undefined) ?? null,
  })
  const inferred = inferCatalogSignalsFromSite(input.site)

  // Offering type is the source of truth. Site pages may still suggest a catalog
  // when offering is "both", but Products Only / Services Only always wins.
  let showProducts = offering === 'products' || offering === 'both' || inferred.showProducts
  let showServices = offering === 'services' || offering === 'both' || inferred.showServices

  if (offering === 'products') showServices = false
  if (offering === 'services') showProducts = false

  if (input.productCount === 0) showProducts = false
  if (input.serviceCount === 0) showServices = false

  return { showProducts, showServices }
}

/** Drop Products/Services links that the current offering type does not allow. */
export function filterNavLinksByCatalogCapabilities(
  links: NavLinkItem[],
  storePath: (p: string) => string,
  capabilities: CatalogNavCapabilities,
): NavLinkItem[] {
  return links.filter((link) => {
    if (!capabilities.showProducts && navLinksIncludeCatalogPath([link], storePath, 'products')) {
      return false
    }
    if (!capabilities.showServices && navLinksIncludeCatalogPath([link], storePath, 'services')) {
      return false
    }
    return true
  })
}

export function navLinksIncludeCatalogPath(
  links: NavLinkItem[],
  storePath: (p: string) => string,
  kind: 'products' | 'services' | 'blog' | 'rentals',
): boolean {
  for (const link of links) {
    if (!link?.href) continue
    const rel = pathRelativeToStore(link.href, storePath).toLowerCase()
    const firstSeg = rel.replace(/^\//, '').split('/')[0] || ''
    const label = link.label || ''
    if (kind === 'blog') {
      if (rel === '/blog' || rel.startsWith('/blog/')) return true
      if (firstSeg === 'blog') return true
      if (/blog|news|articles?/i.test(label)) return true
      continue
    }
    if (kind === 'rentals') {
      if (rel === '/rentals' || rel.startsWith('/rentals/')) return true
      if (firstSeg === 'rentals' || firstSeg === 'rental') return true
      // Exact marketplace labels only — "My Rentals" is the account bookings page.
      if (/^(rentals?|storage\s*racks?)$/i.test(label.trim())) return true
      continue
    }
    if (kind === 'products') {
      if (rel === '/products' || rel.startsWith('/products/')) return true
      if (PRODUCT_PAGE_SLUGS.has(firstSeg)) return true
      if (/product|menu|shop|catalog/i.test(label)) return true
    } else {
      if (rel === '/services' || rel.startsWith('/services/')) return true
      if (SERVICE_PAGE_SLUGS.has(firstSeg)) return true
      if (/service|booking|appointment/i.test(label)) return true
    }
  }
  return false
}

export function buildCatalogNavLink(
  kind: 'products' | 'services',
  storePath: (p: string) => string,
  site?: PublicSite | null,
): NavLinkItem {
  if (kind === 'products') {
    const menuPage = site?.pages?.find(p => String(p.slug || '').toLowerCase() === 'menu')
    if (menuPage && menuPage.show_in_nav !== false) {
      return { label: menuPage.title || 'Menu', href: storePath('/menu') }
    }
    return { label: 'Products', href: storePath('/products') }
  }
  return { label: 'Services', href: storePath('/services') }
}

/** Insert missing Products/Services links based on vendor offering and site content. */
export function enrichNavLinksWithCatalogCapabilities(
  links: NavLinkItem[],
  storePath: (p: string) => string,
  capabilities: CatalogNavCapabilities,
  site?: PublicSite | null,
): NavLinkItem[] {
  const out = filterNavLinksByCatalogCapabilities(links, storePath, capabilities)
  const insertAfterHome = (item: NavLinkItem) => {
    const homeIdx = out.findIndex(l => pathRelativeToStore(l.href, storePath) === '/')
    if (homeIdx >= 0) out.splice(homeIdx + 1, 0, item)
    else out.unshift(item)
  }

  if (capabilities.showProducts && !navLinksIncludeCatalogPath(out, storePath, 'products')) {
    insertAfterHome(buildCatalogNavLink('products', storePath, site))
  }

  if (capabilities.showServices && !navLinksIncludeCatalogPath(out, storePath, 'services')) {
    const productsPresent = navLinksIncludeCatalogPath(out, storePath, 'products')
    const homeIdx = out.findIndex(l => pathRelativeToStore(l.href, storePath) === '/')
    const productLinkIdx = out.findIndex(l => navLinksIncludeCatalogPath([l], storePath, 'products'))
    const insertIdx = productsPresent && productLinkIdx >= 0
      ? productLinkIdx + 1
      : homeIdx >= 0 ? homeIdx + 1 : 0
    out.splice(Math.max(insertIdx, 0), 0, buildCatalogNavLink('services', storePath, site))
  }

  const deduped: NavLinkItem[] = []
  const seen = new Set<string>()
  for (const link of out) {
    const key = pathRelativeToStore(link.href, storePath).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(link)
  }
  return deduped
}

/** Blog posts live at `/blog` (Blog Manager) — add when missing from builder page nav. */
export function enrichNavLinksWithBlogLink(
  links: NavLinkItem[],
  storePath: (p: string) => string,
  blogEnabled = true,
): NavLinkItem[] {
  if (!blogEnabled) {
    return links.filter(l => !navLinksIncludeCatalogPath([l], storePath, 'blog'))
  }
  if (navLinksIncludeCatalogPath(links, storePath, 'blog')) return links
  const out = [...links]
  const contactIdx = out.findIndex(l => pathRelativeToStore(l.href, storePath).toLowerCase() === '/contact')
  const insertIdx = contactIdx >= 0 ? contactIdx : out.length
  out.splice(insertIdx, 0, { label: 'Blog', href: storePath('/blog') })
  return out
}

/** Canonical marketplace path: `/rentals` or `/rentals/:slug`. */
function isCanonicalRentalsHref(href: string, storePath: (p: string) => string): boolean {
  const rel = pathRelativeToStore(href, storePath).toLowerCase()
  return rel === '/rentals' || rel.startsWith('/rentals/')
}

/**
 * Any href that looks rental-related — including singular `/rental` CMS pages.
 * Singular paths must be repaired to `/rentals` (they hit the builder catch-all
 * and skip the live catalog).
 */
function isRentalsHref(href: string, storePath: (p: string) => string): boolean {
  const rel = pathRelativeToStore(href, storePath).toLowerCase()
  const firstSeg = rel.replace(/^\//, '').split('/')[0] || ''
  return isCanonicalRentalsHref(href, storePath) || firstSeg === 'rentals' || firstSeg === 'rental'
}

/** Marketplace nav labels only — must NOT match "My Rentals" (account bookings). */
function isRentalsMarketplaceLabel(label: string): boolean {
  return /^(rentals?|storage\s*racks?)$/i.test((label || '').trim())
}

/** Customer bookings page under account — never rewrite these to the public catalog. */
function isAccountRentalsHref(href: string, storePath: (p: string) => string): boolean {
  const rel = pathRelativeToStore(href, storePath).toLowerCase().split('?')[0] || ''
  return rel === '/account/rentals' || rel === '/account/my-rentals' || rel.startsWith('/account/rentals/')
}

/** Rentals marketplace at `/rentals` — vendor storefront only (via storePath). */
export function enrichNavLinksWithRentalsLink(
  links: NavLinkItem[],
  storePath: (p: string) => string,
  rentalsEnabled = true,
): NavLinkItem[] {
  if (!rentalsEnabled) {
    return links.filter((l) => {
      if (l?.href && isAccountRentalsHref(l.href, storePath)) return true
      return !navLinksIncludeCatalogPath([l], storePath, 'rentals')
    })
  }

  const rentalsHref = storePath('/rentals')
  // Repair misconfigured marketplace "Rentals" links (often /contact) and singular /rental
  // CMS slugs. Never rewrite /account/rentals (My Rentals bookings).
  const repaired = links.map((link) => {
    if (!link?.href) return link
    if (isAccountRentalsHref(link.href, storePath)) return link
    if (isCanonicalRentalsHref(link.href, storePath)) return link
    if (isRentalsHref(link.href, storePath) || isRentalsMarketplaceLabel(link.label || '')) {
      return { ...link, label: link.label?.trim() || 'Rentals', href: rentalsHref }
    }
    return link
  })

  if (navLinksIncludeCatalogPath(repaired, storePath, 'rentals')) {
    const hasCorrectHref = repaired.some(l => l?.href && isCanonicalRentalsHref(l.href, storePath))
    if (hasCorrectHref) return repaired
  }

  const out = [...repaired]
  const servicesIdx = out.findIndex(l => navLinksIncludeCatalogPath([l], storePath, 'services'))
  const productsIdx = out.findIndex(l => navLinksIncludeCatalogPath([l], storePath, 'products'))
  const blogIdx = out.findIndex(l => navLinksIncludeCatalogPath([l], storePath, 'blog'))
  const contactIdx = out.findIndex(l => pathRelativeToStore(l.href, storePath).toLowerCase() === '/contact')
  const insertIdx =
    servicesIdx >= 0 ? servicesIdx + 1
    : productsIdx >= 0 ? productsIdx + 1
    : blogIdx >= 0 ? blogIdx
    : contactIdx >= 0 ? contactIdx
    : out.length
  out.splice(insertIdx, 0, { label: 'Rentals', href: rentalsHref })
  return out
}

export function defaultCommerceNavLinksForCapabilities(
  storePath: (p: string) => string,
  capabilities: CatalogNavCapabilities,
  blogEnabled = true,
  rentalsEnabled = true,
): NavLinkItem[] {
  const links: NavLinkItem[] = [{ label: 'Home', href: storePath('/') }]
  if (capabilities.showProducts) links.push({ label: 'Products', href: storePath('/products') })
  if (capabilities.showServices) links.push({ label: 'Services', href: storePath('/services') })
  if (rentalsEnabled) links.push({ label: 'Rentals', href: storePath('/rentals') })
  if (blogEnabled) links.push({ label: 'Blog', href: storePath('/blog') })
  links.push({ label: 'Policies', href: storePath('/policies') })
  return links
}
