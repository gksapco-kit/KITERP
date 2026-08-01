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
  site?: PublicSite | null
  /** When set, hide catalog nav if the branch/store has no live items. */
  productCount?: number | null
  serviceCount?: number | null
}

export function normalizeCatalogOffering(raw?: string | null): CatalogOffering {
  const value = (raw || '').trim().toLowerCase()
  if (value === 'products' || value === 'services' || value === 'both') return value
  return 'both'
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
  const offering = normalizeCatalogOffering(
    input.offeringType ?? (style.selling_mode as string | undefined) ?? null,
  )
  const inferred = inferCatalogSignalsFromSite(input.site)

  let showProducts = offering === 'products' || offering === 'both' || inferred.showProducts
  let showServices = offering === 'services' || offering === 'both' || inferred.showServices

  if (offering === 'products') showServices = false
  if (offering === 'services') showProducts = false

  if (input.productCount === 0) showProducts = false
  if (input.serviceCount === 0) showServices = false

  return { showProducts, showServices }
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
      if (/rentals?|storage\s*rack/i.test(label)) return true
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
  const out = [...links]
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

/** Rentals marketplace at `/rentals` — vendor storefront only (via storePath). */
export function enrichNavLinksWithRentalsLink(
  links: NavLinkItem[],
  storePath: (p: string) => string,
  rentalsEnabled = true,
): NavLinkItem[] {
  if (!rentalsEnabled) {
    return links.filter(l => !navLinksIncludeCatalogPath([l], storePath, 'rentals'))
  }
  if (navLinksIncludeCatalogPath(links, storePath, 'rentals')) return links
  const out = [...links]
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
  out.splice(insertIdx, 0, { label: 'Rentals', href: storePath('/rentals') })
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
