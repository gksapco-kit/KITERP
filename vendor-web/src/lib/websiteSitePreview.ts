import { websiteApi } from '@/api/websites'
import { buildBuilderPublicSite } from '@/lib/builderPublicSite'
import { mediaUrl } from '@/lib/utils'
import type { PublicSite } from '@storefront/blocks/registry'
import type { SiteListItem, StyleConfig, WebsiteBlock, WebsiteTemplate } from '@/types/websites'
import { resolveTemplateThumbnail } from '@/lib/websiteAppliedTemplate'

const TOP_LEVEL_IMAGE_FIELDS = [
  'bg_image_url',
  'image_url',
  'cover_image_url',
  'thumbnail_url',
  'brand_logo',
  'logo_url',
  'src',
]

const ARRAY_IMAGE_FIELDS: { key: string; field: string }[] = [
  { key: 'images', field: 'src' },
  { key: 'features', field: 'image_url' },
  { key: 'categories', field: 'image_url' },
  { key: 'testimonials', field: 'avatar_url' },
  { key: 'members', field: 'avatar_url' },
  { key: 'projects', field: 'image_url' },
  { key: 'posts', field: 'image_url' },
  { key: 'logos', field: 'image_url' },
]

function pickImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? mediaUrl(trimmed) : null
}

function extractOverlayImages(props: Record<string, unknown>): string | null {
  const overlays = props.overlays
  if (!Array.isArray(overlays)) return null
  for (const item of overlays) {
    if (!item || typeof item !== 'object') continue
    const overlay = item as Record<string, unknown>
    if (overlay.type !== 'image') continue
    const url = pickImageUrl(overlay.src)
    if (url) return url
  }
  return null
}

export function extractPreviewImageFromBlocks(blocks: WebsiteBlock[]): string | null {
  const sorted = [...blocks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  for (const block of sorted) {
    const props = (block.props ?? {}) as Record<string, unknown>
    for (const field of TOP_LEVEL_IMAGE_FIELDS) {
      const url = pickImageUrl(props[field])
      if (url) return url
    }
    const overlayUrl = extractOverlayImages(props)
    if (overlayUrl) return overlayUrl
    for (const { key, field } of ARRAY_IMAGE_FIELDS) {
      const items = props[key]
      if (!Array.isArray(items)) continue
      for (const item of items) {
        const url = pickImageUrl((item as Record<string, unknown>)?.[field])
        if (url) return url
      }
    }
  }
  return null
}

export function resolveSiteStaticThumbnail(
  site: Pick<SiteListItem, 'applied_template_id' | 'favicon_url' | 'logo_url'>,
  templates: WebsiteTemplate[] = [],
): string | null {
  const templateThumb = resolveTemplateThumbnail(site.applied_template_id, templates)
  return (
    (templateThumb ? pickImageUrl(templateThumb) : null)
    ?? pickImageUrl(site.logo_url)
    ?? pickImageUrl(site.favicon_url)
  )
}

async function fetchFirstMediaThumbnail(siteId: string): Promise<string | null> {
  try {
    const media = await websiteApi.listMedia(siteId)
    for (const item of media) {
      const url = pickImageUrl(item.thumbnail_url ?? item.adjusted_url ?? item.original_url)
      if (url) return url
    }
  } catch {
    /* ignore */
  }
  return null
}

async function resolveBestStaticImage(
  site: SiteListItem,
  blocks: WebsiteBlock[],
  templates: WebsiteTemplate[] = [],
): Promise<string | null> {
  return (
    extractPreviewImageFromBlocks(blocks)
    ?? resolveSiteStaticThumbnail(site, templates)
    ?? pickImageUrl(site.logo_url)
    ?? await fetchFirstMediaThumbnail(site.id)
  )
}

export type SiteHomepageGlimpse = {
  publicSite: PublicSite
  blocks: WebsiteBlock[]
  pageId: string
  staticImage: string | null
  style: StyleConfig
}

/** Load homepage blocks and a renderable public-site snapshot for card previews. */
export async function fetchSiteHomepageGlimpse(
  siteId: string,
  templates: WebsiteTemplate[] = [],
): Promise<SiteHomepageGlimpse | null> {
  try {
    const site = await websiteApi.getSite(siteId)
    const pages = await websiteApi.listPages(siteId)
    const homepage = pages.find(p => p.is_homepage) ?? pages[0]
    if (!homepage) return null

    const blocks = await websiteApi.listBlocks(siteId, homepage.id)
    const visibleBlocks = blocks
      .filter(b => b.visible !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    if (!visibleBlocks.length) return null

    const style = (site.style_config ?? {}) as StyleConfig
    const publicSite = buildBuilderPublicSite(
      site,
      pages,
      { [homepage.id]: blocks },
      style,
    )
    const staticImage = await resolveBestStaticImage(site, blocks, templates)

    return {
      publicSite,
      blocks: visibleBlocks.slice(0, 8),
      pageId: homepage.id,
      staticImage,
      style,
    }
  } catch {
    return null
  }
}

/** Load the best preview image for a saved Website Builder site (homepage blocks first). */
export async function fetchSitePreviewThumbnail(
  siteId: string,
  templates: WebsiteTemplate[] = [],
): Promise<string | null> {
  try {
    const glimpse = await fetchSiteHomepageGlimpse(siteId, templates)
    if (glimpse?.staticImage) return glimpse.staticImage
    if (glimpse) return null

    const pages = await websiteApi.listPages(siteId)
    const homepage = pages.find(p => p.is_homepage) ?? pages[0]
    if (!homepage) return null
    const blocks = await websiteApi.listBlocks(siteId, homepage.id)
    const site = await websiteApi.getSite(siteId)
    return resolveBestStaticImage(site, blocks, templates)
  } catch {
    return null
  }
}

export function styleConfigPreviewGradient(style: StyleConfig | null | undefined): string | null {
  if (!style) return null
  const primary = style.primary_color?.trim()
  const secondary = style.secondary_color?.trim() || style.accent_color?.trim()
  if (!primary) return null
  if (secondary && secondary !== primary) {
    return `linear-gradient(135deg, ${primary}, ${secondary})`
  }
  return primary
}
