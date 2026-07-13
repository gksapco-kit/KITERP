import type { PublicSite } from '@storefront/blocks/registry'
import type { StyleConfig, WebsiteBlock, WebsitePage, WebsiteSite } from '@/types/websites'

/** Public-site JSON shape used by BlockRenderer / SingleBlock in the builder canvas. */
export function buildBuilderPublicSite(
  site: WebsiteSite,
  localPages: WebsitePage[],
  localBlocks: Record<string, WebsiteBlock[]>,
  localStyle: StyleConfig,
  vendorSlug?: string | null,
): PublicSite {
  const pagesSorted = [...localPages].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const pages = pagesSorted.map(page => {
    const blocksRaw = (localBlocks[page.id] ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const blocks = blocksRaw.map(b => ({
      id: b.id,
      page_id: b.page_id || page.id,
      block_type: b.block_type,
      label: b.label,
      props: b.props ?? {},
      style_overrides: b.style_overrides ?? {},
      visible: b.visible !== false,
      visible_on_mobile: b.visible_on_mobile !== false,
      visible_on_tablet: b.visible_on_tablet !== false,
      visible_on_desktop: b.visible_on_desktop !== false,
      animation: b.animation ?? null,
      animation_delay: b.animation_delay ?? 0,
      sort_order: b.sort_order ?? 0,
      visible_branches: ((b.props ?? {}) as { _visible_branches?: string[] })._visible_branches ?? [],
    }))
    return {
      id: page.id,
      site_id: page.site_id || site.id,
      title: page.title,
      slug: page.slug,
      page_type: page.page_type,
      seo_title: page.seo_title,
      seo_description: page.seo_description,
      og_image_url: page.og_image_url,
      focus_keyword: page.focus_keyword ?? null,
      seo_keywords: page.seo_keywords ?? null,
      noindex: Boolean(page.noindex),
      og_title: page.og_title ?? null,
      og_description: page.og_description ?? null,
      canonical_url: page.canonical_url ?? null,
      schema_type: page.schema_type || 'auto',
      layout: page.layout ?? 'full',
      sort_order: page.sort_order ?? 0,
      is_published: true,
      is_homepage: !!page.is_homepage,
      show_in_nav: page.show_in_nav !== false,
      blocks,
    }
  })
  const catalogSlug = vendorSlug?.trim() || null
  return {
    id: site.id,
    vendor_id: site.vendor_id,
    vendor_slug: catalogSlug,
    name: site.name,
    subdomain: site.subdomain,
    custom_domain: site.custom_domain,
    description: site.description,
    favicon_url: site.favicon_url,
    logo_url: site.logo_url,
    style_config: localStyle,
    seo_title: site.seo_title,
    seo_description: site.seo_description,
    seo_keywords: site.seo_keywords,
    og_image_url: site.og_image_url,
    is_published: true,
    status: site.status,
    google_analytics_id: site.google_analytics_id,
    meta_pixel_id: site.meta_pixel_id,
    custom_head_code: site.custom_head_code,
    custom_body_code: site.custom_body_code,
    language: site.language,
    languages_enabled: site.languages_enabled ?? ['en'],
    currency: site.currency,
    currencies_enabled: site.currencies_enabled ?? [site.currency],
    currency_symbol: site.currency_symbol,
    currency_position: site.currency_position,
    location: site.location,
    timezone: site.timezone,
    pages,
    updated_at: new Date().toISOString(),
  } as PublicSite
}
