/**
 * Section types that may use whole-block click (block_link_url).
 * Promo / single-destination sections only — not forms, grids, or interactive widgets.
 */
export const BLOCK_LINK_ALLOWED_TYPES = new Set([
  'hero',
  'hero_split',
  'hero_minimal',
  'cta',
  'announcement_bar',
  'image_block',
  'about_split',
  'coupon_banner',
  'countdown',
  'menu_grid',
  'category_cards',
  'marquee_strip',
  /** Commerce library — category showcase */
  'product.categories',
])

export function blockTypeSupportsBlockLink(blockType: string | undefined | null): boolean {
  if (!blockType) return false
  return BLOCK_LINK_ALLOWED_TYPES.has(blockType)
}
