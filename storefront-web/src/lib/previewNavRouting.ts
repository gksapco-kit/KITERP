import type { PublicSite } from '@/blocks/registry'
import { pathRelativeToStore } from '@/lib/catalogNavCapabilities'

export type BuilderPageNavRef = {
  id: string
  slug: string
  is_homepage?: boolean
}

function normalizeNavPathname(rawPath: string): string {
  const pathOnly = (rawPath || '/').split('?')[0].split('#')[0]
  return (pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`).replace(/\/+$/, '') || '/'
}

export function isDraftPreviewShellHref(pathname: string): boolean {
  return (pathname.replace(/\/+$/, '') || '/') === '/preview/draft'
}

/** Map preview shell hrefs and store paths to a logical storefront path (/about, /products, …). */
export function resolveStoreNavPathFromHref(
  rawPath: string,
  storePath: (p: string) => string,
): string {
  return pathRelativeToStore(rawPath, storePath)
}

export function sitePageSlugSet(site: PublicSite | null | undefined): ReadonlySet<string> {
  return new Set(
    (site?.pages || [])
      .map(p => p.slug?.trim().toLowerCase())
      .filter((s): s is string => Boolean(s)),
  )
}

export function builderPageSlugFromNavPath(pathname: string): string | null {
  const clean = normalizeNavPathname(pathname)
  if (clean === '/' || clean === '/home') return null
  return clean.replace(/^\/+/, '') || null
}

/** True for cart, checkout, catalog list/detail paths, etc. */
export function isCatalogShellNavPath(pathname: string): boolean {
  const clean = normalizeNavPathname(pathname)
  if (clean === '/cart' || clean === '/checkout' || clean === '/login' || clean === '/register') return true
  if (clean.startsWith('/account')) return true
  if (/^\/order\/[^/]+\/(confirmation|status)$/.test(clean)) return true
  if (clean === '/products' || clean === '/services' || clean === '/categories') return true
  return /^\/(products|services|categories)\/[^/]+/.test(clean)
}

export function findBuilderPageForNavPath(
  rawPath: string,
  pages: BuilderPageNavRef[],
): BuilderPageNavRef | null {
  const clean = normalizeNavPathname(rawPath)
  const slug = clean === '/' ? '' : clean.replace(/^\/+/, '').toLowerCase()
  return pages.find(p => {
    const pageSlug = p.slug.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()
    return (
      (p.is_homepage && (clean === '/' || slug === '' || slug === 'home')) ||
      pageSlug === slug
    )
  }) ?? null
}

/**
 * In draft preview / builder canvas: open catalog embed only when the path is not
 * a builder page slug (e.g. /services page vs /services/item-slug).
 */
export function shouldOpenCatalogPreviewForNavPath(
  rawPath: string,
  sitePageSlugs?: ReadonlySet<string>,
  pages?: BuilderPageNavRef[],
): boolean {
  const clean = normalizeNavPathname(rawPath)
  if (!isCatalogShellNavPath(clean)) return false
  if (pages?.length) {
    const match = findBuilderPageForNavPath(clean, pages)
    if (match && !clean.match(/^\/(products|services|categories)\/[^/]+/)) {
      return false
    }
  }
  const seg = clean.replace(/^\/+/, '').toLowerCase()
  if (
    (clean === '/products' || clean === '/services' || clean === '/categories') &&
    sitePageSlugs?.has(seg)
  ) {
    return false
  }
  return true
}
