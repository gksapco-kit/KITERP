/** Shared grid + card sizing for product/service catalog blocks. */

import type { CSSProperties } from 'react'
import { parseCatalogAddButtonStyle, type CatalogAddButtonStyle } from '@/lib/catalogAddButtonStyle'
import { cn } from '@/lib/utils'

export const MIN_CATALOG_GRID_COLUMNS = 1
export const MAX_CATALOG_GRID_COLUMNS = 12

export function clampNumber(raw: unknown, fallback: number, min: number, max: number): number {
  return Math.min(Math.max(Number(raw ?? fallback) || fallback, min), max)
}

export function clampCatalogColumns(
  raw: unknown,
  fallback = 4,
  blockType = 'product_grid',
  minOverride?: number,
): number {
  const min = minOverride ?? (blockType === 'menu_grid' ? 1 : 2)
  return Math.min(
    Math.max(Number(raw ?? fallback) || fallback, min),
    MAX_CATALOG_GRID_COLUMNS,
  )
}

export const CATALOG_GRID_COL_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  7: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7',
  8: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8',
  9: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9',
  10: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10',
  11: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-11',
  12: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12',
}

export function catalogGridResponsiveColClass(columns: number): string {
  if (columns <= 1) return 'grid-cols-1'
  if (columns <= 2) return CATALOG_GRID_COL_CLASS[2]
  return CATALOG_GRID_COL_CLASS[columns] || CATALOG_GRID_COL_CLASS[4]
}

export type CatalogImageAspect = 'auto' | 'square' | 'tall' | 'wide'
export type CatalogImageObjectFit = 'cover' | 'contain'

export const CATALOG_IMAGE_ASPECT_OPTIONS: { value: CatalogImageAspect; label: string }[] = [
  { value: 'auto', label: 'Custom height' },
  { value: 'square', label: 'Square' },
  { value: 'tall', label: 'Tall 3:4' },
  { value: 'wide', label: 'Wide 4:3' },
]

export const CATALOG_IMAGE_OBJECT_FIT_OPTIONS: { value: CatalogImageObjectFit; label: string }[] = [
  { value: 'cover', label: 'Cover' },
  { value: 'contain', label: 'Contain' },
]

export const CATALOG_IMAGE_ASPECT_CLASS: Record<CatalogImageAspect, string | null> = {
  auto: null,
  square: 'aspect-square',
  tall: 'aspect-[3/4]',
  wide: 'aspect-[4/3]',
}

export interface CatalogCardLayout {
  columns: number
  itemGap: number
  imageHeightPct: number
  cardPadding: number
  cardStyle: string
  isCompactCard: boolean
  isMinimalCard: boolean
  cardRadius: string
  cardBorderRadius: number | null
  imageAspect: CatalogImageAspect
  imageObjectFit: CatalogImageObjectFit
  showBadges: boolean
  showStock: boolean
  showAddButton: boolean
  showBookLink: boolean
  addButtonStyle: CatalogAddButtonStyle
}

export interface CatalogImageShell {
  wrapperClassName: string
  wrapperStyle?: CSSProperties
  imageClassName: string
}

export function catalogImageObjectFitClass(fit?: string | null): string {
  return fit === 'contain' ? 'object-contain' : 'object-cover'
}

export function parseCatalogImageAspect(raw: unknown): CatalogImageAspect {
  const value = String(raw ?? 'auto') as CatalogImageAspect
  return value in CATALOG_IMAGE_ASPECT_CLASS ? value : 'auto'
}

export function parseCatalogImageObjectFit(raw: unknown): CatalogImageObjectFit {
  return raw === 'contain' ? 'contain' : 'cover'
}

export function parseCardBorderRadius(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.min(Math.max(Math.round(n), 0), 32)
}

export function buildCatalogImageShell(options: {
  imageHeightPct: number
  imageAspect: CatalogImageAspect
  imageObjectFit: CatalogImageObjectFit
  productTileWrap: string
  isCircle: boolean
  hoverScale?: boolean
  bgClass?: string
}): CatalogImageShell {
  const objectFit = catalogImageObjectFitClass(options.imageObjectFit)
  const hover =
    options.hoverScale !== false
      ? 'group-hover:scale-105 transition-transform duration-300'
      : ''
  const imageClassName = cn('absolute inset-0 w-full h-full', objectFit, hover)
  const bg = options.bgClass ?? 'bg-gray-50'

  if (options.isCircle) {
    return {
      wrapperClassName: cn(
        'relative w-full overflow-hidden',
        bg,
        options.productTileWrap,
        'aspect-square max-w-[min(100%,240px)] mx-auto',
      ),
      imageClassName,
    }
  }

  const aspectClass = CATALOG_IMAGE_ASPECT_CLASS[options.imageAspect]
  if (aspectClass) {
    return {
      wrapperClassName: cn('relative w-full overflow-hidden', bg, options.productTileWrap, aspectClass),
      imageClassName,
    }
  }

  return {
    wrapperClassName: cn('relative w-full overflow-hidden', bg, options.productTileWrap),
    wrapperStyle: { paddingBottom: `${options.imageHeightPct}%` },
    imageClassName,
  }
}

export function resolveCardRadiusPresentation(
  cardBorderRadius: number | null,
  cardRadiusClass: string,
): { className: string; style?: CSSProperties } {
  if (cardBorderRadius != null) {
    return {
      className: 'overflow-hidden',
      style: { borderRadius: `${cardBorderRadius}px` },
    }
  }
  return { className: cardRadiusClass }
}

export function readCatalogCardLayout(
  props: Record<string, unknown>,
  blockType = 'product_grid',
  options?: { defaultColumns?: number },
): CatalogCardLayout {
  const defaultColumns = options?.defaultColumns ?? (blockType === 'menu_grid' ? 2 : 4)
  const cardStyle = String(props.card_style ?? 'default')
  const isCompactCard = cardStyle === 'compact' || props.compact === true
  const isMinimalCard = cardStyle === 'minimal'

  return {
    columns: clampCatalogColumns(props.columns, defaultColumns, blockType),
    itemGap: clampNumber(props.item_gap, 24, 0, 80),
    imageHeightPct: clampNumber(
      props.image_height_pct,
      isMinimalCard ? 72 : isCompactCard ? 88 : 100,
      40,
      100,
    ),
    cardPadding: clampNumber(
      props.card_padding,
      isMinimalCard ? 8 : isCompactCard ? 10 : 16,
      4,
      32,
    ),
    cardStyle,
    isCompactCard,
    isMinimalCard,
    cardRadius: isMinimalCard ? 'rounded-lg' : isCompactCard ? 'rounded-xl' : 'rounded-2xl',
    cardBorderRadius: parseCardBorderRadius(props.card_border_radius),
    imageAspect: parseCatalogImageAspect(props.image_aspect),
    imageObjectFit: parseCatalogImageObjectFit(props.image_object_fit),
    showBadges: props.show_badges !== false,
    showStock: props.show_stock !== false && !isMinimalCard,
    showAddButton: props.show_add_button !== false,
    showBookLink: props.show_book_link !== false && props.show_add_button !== false,
    addButtonStyle: parseCatalogAddButtonStyle(props.add_button_style),
  }
}
