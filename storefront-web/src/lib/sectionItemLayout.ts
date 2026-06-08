/** Shared grid layout helpers — keep edit-panel sliders in sync with canvas blocks. */

export function sectionGridColumnClass(columns: number): string {
  const cols = Math.min(Math.max(Number(columns) || 3, 1), 6)
  const map: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  }
  return map[cols] || map[3]
}

export function sectionItemGap(props: Record<string, unknown>, fallback = 24): number {
  return Number(props.item_gap ?? fallback)
}

export function sectionItemSize(props: Record<string, unknown>, fallback = 160): number {
  return Number(props.item_size ?? fallback)
}

export function cardPaddingFromItemSize(itemSize: number): number {
  return Math.max(12, Math.round(itemSize * 0.12))
}

export function iconBoxFromItemSize(itemSize: number): number {
  return Math.max(40, Math.round(itemSize * 0.25))
}

const NAMED_FEATURE_ICONS: Record<string, string> = {
  Zap: '⚡',
  Shield: '🛡️',
  Star: '⭐',
  Clock: '⏱️',
  Heart: '❤️',
  Truck: '🚚',
  Wrench: '🛠️',
}

/** Render emoji from panel (emoji or legacy Lucide-style name). */
export function renderFeatureIcon(icon?: string, fallback = '✨'): string {
  if (!icon) return fallback
  const trimmed = icon.trim()
  if (NAMED_FEATURE_ICONS[trimmed]) return NAMED_FEATURE_ICONS[trimmed]
  // Already an emoji / short glyph from the emoji picker
  if (trimmed.length <= 8) return trimmed
  return fallback
}

export function columnsFromProps(
  props: Record<string, unknown>,
  layoutFallback?: string,
): number {
  if (props.columns != null && props.columns !== '') {
    return Math.min(Math.max(Number(props.columns) || 3, 1), 6)
  }
  const layout = String(props.layout ?? layoutFallback ?? '')
  if (layout === 'grid-4') return 4
  if (layout === 'grid-2') return 2
  return 3
}

export type ImageShape = 'square' | 'rounded' | 'circle'

export const IMAGE_SHAPE_OPTIONS: { value: ImageShape; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
]

export function imageShapeFromProps(
  props: Record<string, unknown>,
  fallback: ImageShape = 'rounded',
): ImageShape {
  const s = String(props.image_shape ?? fallback)
  if (s === 'square' || s === 'circle' || s === 'rounded') return s
  return fallback
}

/** Thumbnail / icon box in list rows and compact tiles. */
export function thumbnailShapeClass(shape: ImageShape): string {
  if (shape === 'circle') return 'rounded-full object-cover shrink-0'
  if (shape === 'square') return 'rounded-sm object-cover shrink-0'
  return 'rounded-lg object-cover shrink-0'
}

/** Icon-only placeholder box (no photo). */
export function iconBoxShapeClass(shape: ImageShape): string {
  if (shape === 'circle') return 'rounded-full'
  if (shape === 'square') return 'rounded-sm'
  return 'rounded-xl'
}

/** Full-width image header on grid cards. */
export function cardImageShapeClass(shape: ImageShape): string {
  const base = 'object-cover w-full'
  if (shape === 'circle') return `${base} rounded-full aspect-square mx-auto`
  if (shape === 'square') return `${base} rounded-sm`
  return `${base} rounded-lg`
}
