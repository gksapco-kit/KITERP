import {
  BUSINESS_IMAGE_CATEGORIES,
  imagesForCategory,
} from '@/data/businessImagePack'
import {
  normalizeGalleryCategoryId,
  resolveCategoryStockImageUrl,
  stockPoolForCategory,
} from '@/data/categoryStockImages'
import { heroUsesBackgroundImage, heroUsesSideImage } from '@/lib/heroLayoutUtils'

const BLOCK_CATEGORY_IMAGE_FALLBACK: Record<string, string> = {
  hero: 'shop',
  content: 'shop',
  social: 'beauty',
  conversion: 'shop',
  media: 'shop',
  about: 'beauty',
  contact: 'store',
  blog: 'book-store',
  portfolio: 'home-decor-store',
  ecommerce: 'store',
  erp: 'store',
  widgets: 'beauty',
  food: 'catering-service',
  structure: 'shop',
  layout: 'shop',
  advanced: 'shop',
}

const SITE_KEYWORD_CATEGORIES: { pattern: RegExp; categoryId: string }[] = [
  { pattern: /\b(beauty|salon|spa|skincare|makeup|cosmetic)\b/i, categoryId: 'beauty' },
  { pattern: /\b(electronic|computer|phone|laptop|tech|mobile)\b/i, categoryId: 'electronics' },
  { pattern: /\b(jewel|jewellery|gold|diamond)\b/i, categoryId: 'jewelry' },
  { pattern: /\b(restaurant|cafe|food|catering|dining|menu)\b/i, categoryId: 'catering-service' },
  { pattern: /\b(bar|pub|nightlife|cocktail)\b/i, categoryId: 'bar-pub' },
  { pattern: /\b(hotel|resort|hospitality|homestay)\b/i, categoryId: 'resort' },
  { pattern: /\b(furniture|home decor|interior)\b/i, categoryId: 'furniture-store' },
  { pattern: /\b(pet|veterinar|animal)\b/i, categoryId: 'pet-store' },
  { pattern: /\b(sport|fitness|gym|athletic)\b/i, categoryId: 'sports-goods-store' },
  { pattern: /\b(toy|game|children)\b/i, categoryId: 'toy-store' },
  { pattern: /\b(book|library|literary)\b/i, categoryId: 'book-store' },
  { pattern: /\b(supermarket|grocery|mart)\b/i, categoryId: 'supermarket' },
  { pattern: /\b(clinic|health|medical|hospital)\b/i, categoryId: 'medical-equipment-store' },
  { pattern: /\b(fashion|boutique|apparel|clothing)\b/i, categoryId: 'shop' },
  { pattern: /\b(retail|store|shop|commerce|ecommerce)\b/i, categoryId: 'store' },
]

const BLOCK_IMAGE_FIELDS: Record<string, string[]> = {
  hero: ['bg_image_url'],
  hero_split: ['bg_image_url', 'image_url'],
  hero_minimal: ['bg_image_url'],
  about_split: ['image_url'],
  image_block: ['image_url'],
  cta: ['bg_image_url'],
  video_embed: ['thumbnail_url'],
  contact_form: ['bg_image_url'],
  map_contact: ['bg_image_url'],
  newsletter: ['image_url'],
  stats: ['bg_image_url'],
}

const BLOCK_ARRAY_IMAGE: Record<string, { arrayKey: string; itemField: string; defaultTitle?: string }> = {
  team_grid: { arrayKey: 'members', itemField: 'avatar_url', defaultTitle: 'Team Member' },
  testimonials: { arrayKey: 'testimonials', itemField: 'avatar_url', defaultTitle: 'Customer' },
  features: { arrayKey: 'features', itemField: 'image_url', defaultTitle: 'Feature' },
  features_alternating: { arrayKey: 'features', itemField: 'image_url', defaultTitle: 'Feature' },
  services_cards: { arrayKey: 'features', itemField: 'image_url', defaultTitle: 'Service' },
  trust_logos: { arrayKey: 'logos', itemField: 'image_url', defaultTitle: 'Partner' },
  gallery_masonry: { arrayKey: 'images', itemField: 'src' },
  gallery_grid: { arrayKey: 'images', itemField: 'src' },
  image_gallery: { arrayKey: 'images', itemField: 'src' },
  portfolio_grid: { arrayKey: 'projects', itemField: 'image_url', defaultTitle: 'Project' },
  category_cards: { arrayKey: 'categories', itemField: 'image_url', defaultTitle: 'Category' },
  blog_grid: { arrayKey: 'posts', itemField: 'image_url', defaultTitle: 'Post' },
  menu_grid: { arrayKey: 'categories', itemField: 'image_url', defaultTitle: 'Category' },
}

export function inferImageCategoryFromSite(site?: { name?: string | null; description?: string | null }): string {
  const text = `${site?.name ?? ''} ${site?.description ?? ''}`.trim()
  if (text) {
    for (const { pattern, categoryId } of SITE_KEYWORD_CATEGORIES) {
      if (pattern.test(text)) return categoryId
    }
  }
  return 'shop'
}

export function suggestImageCategoryForBlock(
  blockCatalogCategory: string,
  site?: { name?: string | null; description?: string | null; style_config?: Record<string, unknown> | null },
): string {
  const styleCat = (site?.style_config as { image_category_id?: string } | undefined)?.image_category_id
  if (styleCat) return normalizeGalleryCategoryId(styleCat)
  const fromSite = inferImageCategoryFromSite(site)
  if (fromSite !== 'shop') return fromSite
  return BLOCK_CATEGORY_IMAGE_FALLBACK[blockCatalogCategory] ?? 'shop'
}

export function pickGalleryImageUrls(categoryId: string, count: number, startIndex = 0): string[] {
  const normalized = normalizeGalleryCategoryId(categoryId)
  const catalog = imagesForCategory(normalized)
  const stock = stockPoolForCategory(normalized)
  if (catalog.length > 0) {
    return Array.from({ length: count }, (_, i) => catalog[(startIndex + i) % catalog.length]?.url ?? '')
  }
  if (stock.length > 0) {
    return Array.from({ length: count }, (_, i) => stock[(startIndex + i) % stock.length] ?? '')
  }
  return Array.from({ length: count }, (_, i) => resolveCategoryStockImageUrl('shop', (startIndex + i) % 4 + 1))
}

export function blockSupportsGalleryCategory(blockType: string): boolean {
  if (blockType.includes('hero')) return true
  if (BLOCK_IMAGE_FIELDS[blockType]?.length) return true
  if (BLOCK_ARRAY_IMAGE[blockType]) return true
  if (blockType === 'category_cards') return true
  if (blockType.includes('gallery') || blockType.includes('portfolio')) return true
  if (blockType === 'about_split' || blockType === 'features_alternating') return true
  if (blockType === 'newsletter') return true
  if (blockType === 'stats' || blockType === 'cta') return true
  return false
}

export function blockUsesGalleryImages(blockType: string, _props?: Record<string, unknown>): boolean {
  return blockSupportsGalleryCategory(blockType)
}

/**
 * True only for images this builder auto-applies (the local pack under
 * `/business-images/…` or the Unsplash stock fallbacks). User uploads and any
 * manually-entered URL return false so a layout/style switch never clobbers them.
 */
export function isAutoCategoryImageUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url) return false
  return url.startsWith('/business-images/') || url.includes('images.unsplash.com')
}

export function applyCategoryImagesToBlockProps(
  blockType: string,
  props: Record<string, unknown>,
  categoryId: string,
  opts?: { forceRefresh?: boolean },
): Record<string, unknown> {
  const forceRefresh = opts?.forceRefresh ?? false
  const urls = pickGalleryImageUrls(categoryId, 16)
  if (urls.length === 0) return props

  const next = { ...props }
  let idx = 0
  const nextUrl = () => urls[idx++ % urls.length]

  // Refresh empty slots, and on forceRefresh swap previously auto-applied images —
  // but always keep a user's own uploaded/entered image.
  const shouldFill = (field: string) => {
    const current = next[field]
    if (!current) return true
    return forceRefresh && isAutoCategoryImageUrl(current)
  }

  if (blockType.includes('hero')) {
    const needsBg = heroUsesBackgroundImage(blockType, next)
    const needsSide = heroUsesSideImage(blockType, next)
    if (needsBg) {
      if (shouldFill('bg_image_url')) next.bg_image_url = nextUrl()
    } else if (forceRefresh) {
      delete next.bg_image_url
    }
    if (needsSide) {
      if (shouldFill('image_url')) next.image_url = nextUrl()
    } else if (forceRefresh) {
      delete next.image_url
    }
  }

  const topFields = BLOCK_IMAGE_FIELDS[blockType]
  if (topFields) {
    for (const field of topFields) {
      if (shouldFill(field)) next[field] = nextUrl()
    }
  }

  const arrayCfg = BLOCK_ARRAY_IMAGE[blockType]
  if (arrayCfg) {
    const existing = Array.isArray(next[arrayCfg.arrayKey]) ? [...(next[arrayCfg.arrayKey] as Record<string, unknown>[])] : []
    const targetCount =
      blockType.includes('gallery') ? 8
        : blockType === 'portfolio_grid' ? 6
          : blockType === 'blog_grid' ? 3
            : blockType === 'category_cards' ? 4
              : Math.max(existing.length, 3)

    const fillAllImages = forceRefresh
      || (blockType === 'features' && next.show_images === true)
      || blockType.includes('gallery')
      || blockType === 'portfolio_grid'

    const items: Record<string, unknown>[] = []
    for (let i = 0; i < targetCount; i++) {
      const base = existing[i] ? { ...existing[i] } : {}
      const current = base[arrayCfg.itemField]
      // Keep the user's own image; only fill empties or refresh prior auto images.
      const keepUserImage = !!current && !isAutoCategoryImageUrl(current)
      if (!current || (fillAllImages && !keepUserImage)) {
        base[arrayCfg.itemField] = nextUrl()
      }
      if (arrayCfg.itemField === 'src' && !base.alt) base.alt = 'Gallery image'
      if (arrayCfg.defaultTitle && !base.title && arrayCfg.itemField !== 'avatar_url') {
        base.title = arrayCfg.defaultTitle
      }
      if (arrayCfg.itemField === 'avatar_url' && !base.name) base.name = arrayCfg.defaultTitle ?? 'Person'
      if (blockType === 'blog_grid' && !base.excerpt) base.excerpt = 'Short preview of the post content.'
      if (blockType === 'blog_grid' && !base.date) base.date = new Date().toDateString()
      items.push(base)
    }
    next[arrayCfg.arrayKey] = items
  }

  if (blockType === 'category_cards') {
    const existing = Array.isArray(next.categories) ? (next.categories as Record<string, unknown>[]) : []
    if (existing.length === 0) {
      next.categories = Array.from({ length: 4 }, (_, i) => ({
        title: `Category ${i + 1}`,
        image_url: urls[i % urls.length],
      }))
    } else {
      next.categories = existing.map((cat, i) => {
        const keepUserImage = !!cat.image_url && !isAutoCategoryImageUrl(cat.image_url)
        return {
          ...cat,
          image_url: keepUserImage
            ? cat.image_url
            : forceRefresh
              ? urls[i % urls.length]
              : (cat.image_url || urls[i % urls.length]),
        }
      })
    }
  }

  return next
}

export function listImageCategoryOptions() {
  return BUSINESS_IMAGE_CATEGORIES
}

/** Blocks that should use category gallery images instead of auto live-data binding. */
export const CATEGORY_LAYOUT_BLOCK_TYPES = new Set([
  'hero', 'hero_split', 'hero_minimal',
  'gallery_masonry', 'gallery_grid', 'image_gallery',
  'portfolio_grid', 'features', 'features_alternating',
  'team_grid', 'testimonials', 'services_cards',
  'category_cards', 'about_split', 'cta', 'stats', 'newsletter',
  'image_block', 'video_embed', 'trust_logos', 'partner_logos',
  'contact_form', 'map_contact',
])

export function blockHasFilledCategoryImages(blockType: string, props: Record<string, unknown>): boolean {
  const topFields = BLOCK_IMAGE_FIELDS[blockType]
  if (topFields?.some(f => props[f])) return true
  const arrayCfg = BLOCK_ARRAY_IMAGE[blockType]
  if (arrayCfg) {
    const arr = props[arrayCfg.arrayKey] as Record<string, unknown>[] | undefined
    if (Array.isArray(arr) && arr.some(item => item?.[arrayCfg.itemField])) return true
  }
  if (blockType.includes('hero') && props.bg_image_url) return true
  return false
}

/** After layout picker apply: prefer static category images over auto live media binding. */
export function finalizeCategoryLayoutProps(
  blockType: string,
  props: Record<string, unknown>,
): Record<string, unknown> {
  if (!CATEGORY_LAYOUT_BLOCK_TYPES.has(blockType) && !blockType.includes('hero')) {
    return props
  }
  if (!blockHasFilledCategoryImages(blockType, props)) {
    return props
  }
  const next = { ...props }
  const ds = next.data_source as { type?: string } | undefined
  // Only disconnect live media — keep profile/products/services bindings intact.
  if (!ds?.type || ds.type === 'media') {
    delete next.data_source
  }
  return next
}
