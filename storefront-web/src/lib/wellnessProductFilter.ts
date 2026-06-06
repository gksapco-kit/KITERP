import type { LiveItem } from '@/blocks/registry'
import {
  WELLNESS_CATEGORY_FALLBACK_IMAGES,
  WELLNESS_CATEGORY_IMAGE_BY_TITLE,
  WELLNESS_DEFAULT_CATEGORY_TITLES,
  resolveCategoryCardImage,
} from '@/lib/wellnessCategoryStyle'

const NON_WELLNESS_PATTERN =
  /\b(t[- ]?shirt|tshirt|shirt|apparel|clothing|fashion|jeans|denim|dress|saree|kurta|footwear|shoe|sneaker|electronics|phone|laptop|gadget|watch|accessory|accessories)\b/i

const WELLNESS_PATTERN =
  /\b(snack|grocery|groceries|beverage|cereal|nut|pickle|bar|chikki|seed|fruit|wellness|health|organic|food|pantry|spice|tea|coffee|juice|supplement|vitamin|herb|powder|spread|chew|wholesome|gourmet|breakfast|oil|honey|jam)\b/i

function productText(item: LiveItem): string {
  const meta = (item.meta || {}) as Record<string, unknown>
  return [
    item.title,
    item.subtitle,
    item.description,
    meta.category,
    meta.subcategory,
  ].filter(Boolean).join(' ')
}

export function isNonWellnessProduct(item: LiveItem): boolean {
  return NON_WELLNESS_PATTERN.test(productText(item))
}

export function isWellnessCatalogProduct(item: LiveItem): boolean {
  if (isNonWellnessProduct(item)) return false
  const text = productText(item).toLowerCase()
  if (WELLNESS_PATTERN.test(text)) return true
  const meta = (item.meta || {}) as Record<string, unknown>
  const cat = String(meta.category || '').toLowerCase()
  return WELLNESS_DEFAULT_CATEGORY_TITLES.some(title => {
    const key = title.toLowerCase()
    return cat.includes(key) || key.split(' ').some(word => word.length > 3 && cat.includes(word))
  })
}

export function enrichWellnessProductImage(item: LiveItem, index: number): LiveItem {
  const meta = (item.meta || {}) as Record<string, unknown>
  const categoryTitle = String(meta.category || item.title || '').trim()
  const wellnessImage = resolveCategoryCardImage(
    { title: categoryTitle, image_url: null },
    index,
  )
  const mappedByTitle = WELLNESS_CATEGORY_IMAGE_BY_TITLE[categoryTitle.toLowerCase()]
    || WELLNESS_CATEGORY_IMAGE_BY_TITLE[item.title?.toLowerCase() || '']
  const image = mappedByTitle || wellnessImage || item.image_url
  return { ...item, image_url: image }
}

export function filterWellnessCatalogProducts(items: LiveItem[]): LiveItem[] {
  return items
    .filter(isWellnessCatalogProduct)
    .map((item, i) => enrichWellnessProductImage(item, i))
}

export function wellnessCategoryShowcaseItems(limit = 6): LiveItem[] {
  return WELLNESS_DEFAULT_CATEGORY_TITLES.slice(0, limit).map((title, i) => ({
    id: `wl-showcase-${i}`,
    title,
    subtitle: 'Wellness',
    description: `Discover our ${title.toLowerCase()} — wholesome, natural, and delicious.`,
    image_url: resolveCategoryCardImage({ title, image_url: null }, i),
    price: null,
    price_formatted: null,
    url: '/products',
    meta: { is_category_showcase: true, category: title },
  }))
}

/** Products for wellness retail sites — wellness catalog only, else category showcases. */
export function resolveWellnessSiteProducts(items: LiveItem[], limit = 12): LiveItem[] {
  const wellness = filterWellnessCatalogProducts(items)
  if (wellness.length > 0) return wellness.slice(0, limit)
  return wellnessCategoryShowcaseItems(Math.min(limit, WELLNESS_DEFAULT_CATEGORY_TITLES.length))
}

type WellnessPageBlock = { block_type?: string; props?: Record<string, unknown> }

export function pageHasWellnessCategoryLayout(pageBlocks?: WellnessPageBlock[]): boolean {
  return Boolean(
    pageBlocks?.some(
      b => b.block_type === 'category_cards' && b.props?.layout === 'wellness',
    ),
  )
}

/** True when the site/page is a wellness / healthy-food retail layout (not generic ecommerce). */
export function isWellnessRetailContext(
  props: Record<string, unknown>,
  siteStyle?: Record<string, unknown>,
  pageBlocks?: WellnessPageBlock[],
): boolean {
  const imageCat = String(siteStyle?.image_category_id || props._image_category_id || '').toLowerCase()
  const fromProps = props._image_category_id === 'wellness' || props.layout === 'wellness'
  const fromSite = imageCat === 'wellness' || imageCat === 'grocery'
  const fromTemplate = siteStyle?.wb_catalog_template_id === 'storefront_grocery'
  const fromPage = pageHasWellnessCategoryLayout(pageBlocks)
  return Boolean(fromProps || fromSite || fromTemplate || fromPage)
}
