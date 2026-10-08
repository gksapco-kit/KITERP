import type { PublicPage, PublicSite } from '@/blocks/registry'

/** Builder page slugs that have a dedicated legacy storefront route (e.g. /contact). */
export type BuilderStaticPageSlug = 'contact'

export function findPublishedBuilderPage(
  site: PublicSite | null | undefined,
  slug: BuilderStaticPageSlug,
): PublicPage | null {
  if (!site?.pages?.length) return null
  const page = site.pages.find(p => p.slug === slug)
  if (!page || page.is_published === false) return null
  const blocks = page.blocks?.filter(b => b.visible !== false) ?? []
  return blocks.length > 0 ? page : null
}

export function shouldRenderBuilderStaticPage(
  site: PublicSite | null | undefined,
  slug: BuilderStaticPageSlug,
): boolean {
  return findPublishedBuilderPage(site, slug) != null
}
