import { cn } from '@/lib/utils'

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

/**
 * Unified shape vocabulary — shared with the "Media clip frames" library
 * (see `mediaClip.ts`). Soft shapes render with `border-radius` (so per-card
 * shadows / rings survive); geometric & organic shapes render with `clip-path`.
 */
export type ImageShape =
  // border-radius shapes (shadow-friendly)
  | 'square'
  | 'rounded'
  | 'soft'
  | 'circle'
  | 'pill'
  | 'squircle'
  | 'arch'
  | 'arch_down'
  | 'leaf'
  | 'blob'
  // clip-path shapes (geometric / editorial)
  | 'oval'
  | 'diamond'
  | 'hexagon'
  | 'octagon'
  | 'pentagon'
  | 'bevel'
  | 'star5'
  | 'shield'
  | 'ticket'
  | 'house'
  | 'chevron'
  | 'wave'
  | 'dome'
  | 'trapezoid'

export const IMAGE_SHAPE_OPTIONS: { value: ImageShape; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'soft', label: 'Soft' },
  { value: 'circle', label: 'Circle' },
  { value: 'pill', label: 'Pill' },
  { value: 'squircle', label: 'Squircle' },
  { value: 'arch', label: 'Arch' },
  { value: 'arch_down', label: 'Arch Down' },
  { value: 'leaf', label: 'Leaf' },
  { value: 'blob', label: 'Blob' },
  { value: 'oval', label: 'Oval' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'hexagon', label: 'Hexagon' },
  { value: 'octagon', label: 'Octagon' },
  { value: 'pentagon', label: 'Pentagon' },
  { value: 'bevel', label: 'Bevel' },
  { value: 'star5', label: 'Star' },
  { value: 'shield', label: 'Shield' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'house', label: 'House' },
  { value: 'chevron', label: 'Chevron' },
  { value: 'wave', label: 'Wave' },
  { value: 'dome', label: 'Dome' },
  { value: 'trapezoid', label: 'Trapezoid' },
]

/**
 * Single source of truth: shape → CSS class. Border-radius classes are used where
 * possible (they keep shadows/rings); the `[clip-path:…]` entries are the
 * Tailwind-literal mirror of `MEDIA_CLIP_CSS` in `mediaClip.ts` (same geometry,
 * written as static class strings so Tailwind's JIT can generate them). Because
 * every tile helper below routes through this map, all blocks support the full
 * library with no per-block changes.
 */
const SHAPE_CLASS: Record<ImageShape, string> = {
  square: 'rounded-none',
  rounded: 'rounded-lg',
  soft: 'rounded-3xl',
  circle: 'rounded-full',
  pill: 'rounded-[999px]',
  squircle: 'rounded-[35%]',
  arch: 'rounded-t-[999px]',
  arch_down: 'rounded-b-[999px]',
  leaf: 'rounded-tl-[60%] rounded-br-[60%]',
  blob: 'rounded-[42%_58%_63%_37%/45%_45%_55%_55%]',
  oval: '[clip-path:ellipse(46%_50%_at_50%_50%)]',
  diamond: '[clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]',
  hexagon: '[clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]',
  octagon: '[clip-path:polygon(30%_0%,70%_0%,100%_30%,100%_70%,70%_100%,30%_100%,0%_70%,0%_30%)]',
  pentagon: '[clip-path:polygon(50%_0%,100%_38%,82%_100%,18%_100%,0%_38%)]',
  bevel: '[clip-path:polygon(8%_0%,92%_0%,100%_8%,100%_92%,92%_100%,8%_100%,0%_92%,0%_8%)]',
  star5: '[clip-path:polygon(50%_0%,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)]',
  shield: '[clip-path:polygon(0%_0%,100%_0%,100%_72%,50%_100%,0%_72%)]',
  ticket: '[clip-path:polygon(0%_8%,8%_0%,92%_0%,100%_8%,100%_92%,92%_100%,8%_100%,0%_92%)]',
  house: '[clip-path:polygon(0%_40%,50%_0%,100%_40%,100%_100%,0%_100%)]',
  chevron: '[clip-path:polygon(0%_0%,88%_0%,100%_50%,88%_100%,0%_100%,12%_50%)]',
  wave: '[clip-path:polygon(0%_14%,8%_6%,16%_14%,24%_6%,32%_14%,40%_6%,48%_14%,56%_6%,64%_14%,72%_6%,80%_14%,88%_6%,96%_14%,100%_10%,100%_100%,0%_100%)]',
  dome: '[clip-path:polygon(0%_18%,0%_100%,100%_100%,100%_18%,88%_8%,75%_2%,50%_0%,25%_2%,12%_8%)]',
  trapezoid: '[clip-path:polygon(12%_0%,88%_0%,100%_100%,0%_100%)]',
}

const IMAGE_SHAPES = new Set<ImageShape>(IMAGE_SHAPE_OPTIONS.map(o => o.value))

export function imageShapeFromProps(
  props: Record<string, unknown>,
  fallback: ImageShape = 'rounded',
): ImageShape {
  const s = String(props.image_shape ?? fallback) as ImageShape
  return IMAGE_SHAPES.has(s) ? s : fallback
}

/** Shape → CSS class (border-radius or clip-path). */
export function imageShapeRadiusClass(shape: ImageShape): string {
  return SHAPE_CLASS[shape] ?? SHAPE_CLASS.rounded
}

/** True when a shape is rendered via clip-path (geometric) rather than border-radius. */
export function imageShapeIsClip(shape: ImageShape): boolean {
  return SHAPE_CLASS[shape]?.startsWith('[clip-path') ?? false
}

/** Thumbnail / icon box in list rows and compact tiles. */
export function thumbnailShapeClass(shape: ImageShape): string {
  return cn(imageShapeRadiusClass(shape), 'object-cover shrink-0')
}

/** Icon-only placeholder box (no photo). */
export function iconBoxShapeClass(shape: ImageShape): string {
  return imageShapeRadiusClass(shape)
}

/** Full-width image header on grid cards. */
export function cardImageShapeClass(shape: ImageShape): string {
  const base = 'object-cover w-full'
  if (shape === 'circle') return `${base} rounded-full aspect-square mx-auto`
  return cn(base, imageShapeRadiusClass(shape))
}

/** Clip wrapper for catalog / gallery tile photos. */
export function catalogTileImageWrapperClass(shape: ImageShape): string {
  return cn(imageShapeRadiusClass(shape), 'overflow-hidden')
}

/** Img class inside a shaped tile wrapper (gallery, product grid, categories). */
export function catalogTileImageClass(shape: ImageShape): string {
  return cn(
    'object-cover transition-transform duration-300',
    shape === 'circle' ? 'rounded-full' : '',
  )
}
