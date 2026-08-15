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
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
  7: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7',
  8: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8',
  9: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9',
  10: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10',
  11: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11',
  12: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12',
}

/** Fixed column count — Tailwind media queries follow the browser, not the canvas. */
export const CATALOG_GRID_EXACT_COL_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
  9: 'grid-cols-9',
  10: 'grid-cols-10',
  11: 'grid-cols-11',
  12: 'grid-cols-12',
}

export function catalogGridResponsiveColClass(columns: number): string {
  if (columns <= 1) return 'grid-cols-1'
  if (columns <= 2) return CATALOG_GRID_COL_CLASS[2]
  return CATALOG_GRID_COL_CLASS[columns] || CATALOG_GRID_COL_CLASS[4]
}

/**
 * Column classes for the builder device preview. Live sites keep the full
 * responsive string; the editor must pick a fixed class because Tailwind
 * breakpoints follow the browser window, not the canvas width.
 */
export function catalogGridColClassForBreakpoint(
  columns: number,
  breakpoint: 'desktop' | 'tablet' | 'mobile' = 'desktop',
): string {
  const n = Math.min(Math.max(Math.round(columns) || 1, 1), MAX_CATALOG_GRID_COLUMNS)
  if (breakpoint === 'desktop') return CATALOG_GRID_EXACT_COL_CLASS[n] || CATALOG_GRID_EXACT_COL_CLASS[4]

  // Match the base / sm–md band of CATALOG_GRID_COL_CLASS (no lg/xl).
  if (breakpoint === 'mobile') {
    if (n <= 3) return 'grid-cols-1'
    return 'grid-cols-2'
  }

  // Tablet ≈ sm/md applied, lg+ not.
  if (n <= 1) return 'grid-cols-1'
  if (n === 2) return 'grid-cols-2'
  if (n === 3) return 'grid-cols-2'
  if (n <= 5) return 'grid-cols-3'
  if (n === 6) return 'grid-cols-4'
  return 'grid-cols-4'
}

export type CatalogImageAspect = 'auto' | 'square' | 'tall' | 'portrait' | 'wide' | 'landscape' | 'full'
export type CatalogImageObjectFit = 'cover' | 'contain' | 'fill' | 'scale-down' | 'none'
export type CatalogImageObjectPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export const CATALOG_IMAGE_ASPECT_OPTIONS: { value: CatalogImageAspect; label: string }[] = [
  { value: 'auto', label: 'Custom height' },
  { value: 'full', label: 'Full image' },
  { value: 'square', label: 'Square 1:1' },
  { value: 'tall', label: 'Tall 3:4' },
  { value: 'portrait', label: 'Portrait 2:3' },
  { value: 'wide', label: 'Wide 4:3' },
  { value: 'landscape', label: 'Cinema 16:9' },
]

export const CATALOG_IMAGE_OBJECT_FIT_OPTIONS: { value: CatalogImageObjectFit; label: string; hint: string }[] = [
  { value: 'cover', label: 'Cover', hint: 'Fills the tile. Use crop position and zoom to choose which part shows.' },
  { value: 'contain', label: 'Contain', hint: 'Shows the full photo. Empty space may appear around it.' },
  { value: 'fill', label: 'Stretch', hint: 'Stretches to fill the tile. The photo may look distorted.' },
  { value: 'scale-down', label: 'Scale down', hint: 'Like Contain, but never enlarges a small photo.' },
  { value: 'none', label: 'Original', hint: 'Keeps the photo at its natural size inside the tile.' },
]

export const CATALOG_IMAGE_POSITION_OPTIONS: { value: CatalogImageObjectPosition; label: string }[] = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top', label: 'Top' },
  { value: 'top-right', label: 'Top right' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'bottom-right', label: 'Bottom right' },
]

export const CATALOG_IMAGE_POSITION_PAD: CatalogImageObjectPosition[][] = [
  ['top-left', 'top', 'top-right'],
  ['left', 'center', 'right'],
  ['bottom-left', 'bottom', 'bottom-right'],
]

export const CATALOG_IMAGE_ASPECT_CLASS: Record<CatalogImageAspect, string | null> = {
  auto: null,
  full: null,
  square: 'aspect-square',
  tall: 'aspect-[3/4]',
  portrait: 'aspect-[2/3]',
  wide: 'aspect-[4/3]',
  landscape: 'aspect-[16/9]',
}

export interface CatalogCardLayout {
  columns: number
  itemGap: number
  imageHeightPct: number
  /** Image frame width as % of the card (40–100). */
  imageWidthPct: number
  cardPadding: number
  cardStyle: string
  isCompactCard: boolean
  isMinimalCard: boolean
  cardRadius: string
  cardBorderRadius: number | null
  imageAspect: CatalogImageAspect
  imageObjectFit: CatalogImageObjectFit
  imageObjectPosition: CatalogImageObjectPosition
  /** Tile photo zoom (50–200). Independent of section `image_scale`. */
  imageZoom: number
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
  imageStyle?: CSSProperties
  /** When true, the image is in-flow (natural height) — not absolutely positioned. */
  intrinsic?: boolean
}

export function catalogImageObjectPositionClass(position?: string | null): string {
  switch (position) {
    case 'top':
      return 'object-top'
    case 'bottom':
      return 'object-bottom'
    case 'left':
      return 'object-left'
    case 'right':
      return 'object-right'
    case 'top-left':
      return 'object-left-top'
    case 'top-right':
      return 'object-right-top'
    case 'bottom-left':
      return 'object-left-bottom'
    case 'bottom-right':
      return 'object-right-bottom'
    default:
      return 'object-center'
  }
}

export function catalogImageTransformOrigin(position?: string | null): string {
  switch (position) {
    case 'top':
      return '50% 0%'
    case 'bottom':
      return '50% 100%'
    case 'left':
      return '0% 50%'
    case 'right':
      return '100% 50%'
    case 'top-left':
      return '0% 0%'
    case 'top-right':
      return '100% 0%'
    case 'bottom-left':
      return '0% 100%'
    case 'bottom-right':
      return '100% 100%'
    default:
      return '50% 50%'
  }
}

export function catalogImageObjectFitClass(
  fit?: string | null,
  position?: string | null,
): string {
  const pos = catalogImageObjectPositionClass(position)
  const pad = fit === 'fill' || fit === 'none' ? '' : 'p-1'
  // Catalog tiles never crop pack-shot text. Cover is treated as contain.
  const fitClass =
    fit === 'fill'
      ? 'object-fill'
      : fit === 'scale-down'
        ? 'object-scale-down'
        : fit === 'none'
          ? 'object-none'
          : 'object-contain'
  return cn(fitClass, pos, pad)
}

export function parseCatalogImageAspect(raw: unknown): CatalogImageAspect {
  const value = String(raw ?? 'auto') as CatalogImageAspect
  return value in CATALOG_IMAGE_ASPECT_CLASS ? value : 'auto'
}

export function parseCatalogImageObjectFit(raw: unknown): CatalogImageObjectFit {
  if (raw === 'cover' || raw === 'fill' || raw === 'scale-down' || raw === 'none') return raw
  return 'contain'
}

export function parseCatalogImageObjectPosition(raw: unknown): CatalogImageObjectPosition {
  const value = String(raw ?? 'center')
  return CATALOG_IMAGE_POSITION_OPTIONS.some(opt => opt.value === value)
    ? (value as CatalogImageObjectPosition)
    : 'center'
}

export function parseCatalogImageZoom(raw: unknown): number {
  return clampNumber(raw, 100, 50, 200)
}

export function parseCardBorderRadius(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.min(Math.max(Math.round(n), 0), 32)
}

function catalogImageWidthStyle(imageWidthPct: number): CSSProperties | undefined {
  const pct = clampNumber(imageWidthPct, 100, 40, 100)
  if (pct >= 100) return undefined
  return {
    width: `${pct}%`,
    maxWidth: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
  }
}

export function buildCatalogImageShell(options: {
  imageHeightPct: number
  imageWidthPct?: number
  imageAspect: CatalogImageAspect
  imageObjectFit: CatalogImageObjectFit
  imageObjectPosition?: CatalogImageObjectPosition
  imageZoom?: number
  productTileWrap: string
  isCircle: boolean
  hoverScale?: boolean
  bgClass?: string
}): CatalogImageShell {
  const objectFit = catalogImageObjectFitClass(options.imageObjectFit, options.imageObjectPosition)
  const zoom = parseCatalogImageZoom(options.imageZoom)
  const hover = zoom !== 100 ? 'transition-transform duration-300' : ''
  const imageStyle: CSSProperties | undefined = {
    backgroundColor: '#ffffff',
    ...(zoom !== 100
      ? {
          transform: `scale(${zoom / 100})`,
          transformOrigin: catalogImageTransformOrigin(options.imageObjectPosition),
        }
      : {}),
  }
  const bg = options.bgClass ?? 'bg-white'
  const widthStyle = catalogImageWidthStyle(options.imageWidthPct ?? 100)

  if (options.isCircle) {
    return {
      wrapperClassName: cn(
        'relative w-full overflow-hidden',
        bg,
        options.productTileWrap,
        'aspect-square max-w-[min(100%,240px)] mx-auto',
      ),
      wrapperStyle: widthStyle,
      imageClassName: cn('absolute inset-0 w-full h-full', objectFit, hover),
      imageStyle,
    }
  }

  // Full image: natural aspect — no crop, frame height follows the asset.
  if (options.imageAspect === 'full') {
    return {
      wrapperClassName: cn('relative w-full overflow-hidden', bg, options.productTileWrap),
      wrapperStyle: widthStyle,
      imageClassName: cn('relative block h-auto w-full', hover),
      imageStyle,
      intrinsic: true,
    }
  }

  const aspectClass = CATALOG_IMAGE_ASPECT_CLASS[options.imageAspect]
  const imageClassName = cn('absolute inset-0 w-full h-full', objectFit, hover)
  if (aspectClass) {
    return {
      wrapperClassName: cn('relative w-full overflow-hidden', bg, options.productTileWrap, aspectClass),
      wrapperStyle: widthStyle,
      imageClassName,
      imageStyle,
    }
  }

  // Default catalog tiles: square frame; cover fills the card with no letterbox.
  if (options.imageHeightPct >= 95) {
    return {
      wrapperClassName: cn('relative w-full overflow-hidden aspect-square', bg, options.productTileWrap),
      wrapperStyle: widthStyle,
      imageClassName,
      imageStyle,
    }
  }

  return {
    wrapperClassName: cn('relative w-full overflow-hidden', bg, options.productTileWrap),
    wrapperStyle: { ...widthStyle, paddingBottom: `${options.imageHeightPct}%` },
    imageClassName,
    imageStyle,
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
    itemGap: clampNumber(props.item_gap, 12, 0, 80),
    imageHeightPct: clampNumber(
      props.image_height_pct,
      isMinimalCard ? 72 : isCompactCard ? 88 : 100,
      40,
      100,
    ),
    imageWidthPct: clampNumber(props.image_width_pct, 100, 40, 100),
    cardPadding: clampNumber(
      props.card_padding,
      isMinimalCard ? 6 : isCompactCard ? 8 : 10,
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
    imageObjectPosition: parseCatalogImageObjectPosition(props.image_object_position),
    imageZoom: parseCatalogImageZoom(props.image_zoom),
    showBadges: props.show_badges !== false,
    showStock: props.show_stock !== false && !isMinimalCard,
    showAddButton: props.show_add_button !== false,
    showBookLink: props.show_book_link !== false && props.show_add_button !== false,
    addButtonStyle: parseCatalogAddButtonStyle(props.add_button_style),
  }
}
