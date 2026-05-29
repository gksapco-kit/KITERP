import type { Block } from '../types/builder'
import { isPageFullWidthBlockType, type PageLayoutOptions } from './blockUtils'

export type { PageLayoutOptions } from './blockUtils'
export { isPageFullWidthBlockType as isFullBleedBlockType } from './blockUtils'

/** Horizontal padding shared by page content, navbar/footer inner rows, and builder preview. */
export const PAGE_CONTENT_PADDING = 'px-4 sm:px-8 lg:px-12'

export const PAGE_MAX_WIDTH_CLASS = 'max-w-[1600px]'

/** Blocks in the Banners palette category — span full viewport width; copy stays in max-width row. */
export const BANNER_BLOCK_TYPES = new Set<Block['type']>([
  'promoBanner',
  'announcementBanner',
  'gradientBanner',
  'imageBanner',
  'couponBanner',
  'flashSaleBanner',
  'splitCategoryBanner',
  'offerStripBanner',
  'trustStripBanner',
  'groceryDealBanner',
  'fashionPromoBanner',
])

/** Hero blocks — full viewport width like banners. */
export const HERO_BLOCK_TYPES = new Set<Block['type']>([
  'hero',
  'heroCta',
  'heroSplit',
  'heroBannerSlider',
  'heroBgImage',
  'heroGradient',
  'heroVideo',
])

export function isHeroSectionBlockType(type: Block['type']): boolean {
  return HERO_BLOCK_TYPES.has(type)
}

export function supportsHeroBannerLayoutOptions(type: Block['type']): boolean {
  return isBannerBlockType(type) || isHeroSectionBlockType(type)
}

export function isBannerBlockType(type: Block['type']): boolean {
  return BANNER_BLOCK_TYPES.has(type)
}

/** Inner row for full-width banners (aligned with navbar/footer content). */
export const BANNER_CONTENT_ROW_CLASS = `mx-auto w-full ${PAGE_MAX_WIDTH_CLASS} ${PAGE_CONTENT_PADDING}`

type FullBleedEdge = 'top' | 'bottom' | 'horizontal'

function canvasFullBleedHorizontal(isPreview: boolean): string {
  if (!isPreview) {
    // Editor canvas: stay within column width (negative margins caused horizontal scrollbars).
    return 'w-full max-w-full min-w-0'
  }
  return '-mx-8 w-[calc(100%+4rem)] max-w-none sm:-mx-12 sm:w-[calc(100%+6rem)] lg:-mx-16 lg:w-[calc(100%+8rem)]'
}

/** Break out of canvas padding so navbar/footer/banners span the full canvas width. */
export function canvasFullBleedClass(isPreview: boolean, edge: FullBleedEdge): string {
  const horizontal = canvasFullBleedHorizontal(isPreview)
  if (edge === 'horizontal') return horizontal

  if (!isPreview) return horizontal

  const vertical = edge === 'top' ? '-mt-6' : '-mb-6'
  return `${horizontal} ${vertical}`
}

export function fullBleedEdgeForBlock(type: Block['type'], options?: PageLayoutOptions): FullBleedEdge | null {
  if (!isPageFullWidthBlockType(type, options)) return null
  if (type === 'navbar') return 'top'
  if (type === 'footer' || type === 'footerMinimal') return 'bottom'
  return 'horizontal'
}
