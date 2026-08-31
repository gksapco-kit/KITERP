import type { CSSProperties } from 'react'

/** Geometric clip shapes for hero / image / video media. */
export const MEDIA_CLIP_IDS = [
  'none',
  // Slants & editorial
  'diagonal_r',
  'diagonal_l',
  'tilt',
  'steep_r',
  'steep_l',
  'skew_box',
  'banner',
  // Polygons
  'hexagon',
  'octagon',
  'pentagon',
  'diamond',
  'bevel',
  'trapezoid_top',
  'trapezoid_bottom',
  'star5',
  'star4',
  // Tops & edges
  'arch',
  'dome',
  'wave',
  'scallop',
  'notch_top',
  'notch_bottom',
  // Directional
  'chevron',
  'chevron_l',
  'arrow',
  'flag',
  'shield',
  'ticket',
  'house',
  // Soft / round
  'circle',
  'oval',
  'rounded',
  'pill',
  'squircle',
  // Organic
  'leaf',
  'blob',
  // Extra editorial
  'parallelogram_r',
  'parallelogram_l',
  'heart',
  'cut_corners',
  'rounded_arch',
] as const

export type MediaClipId = (typeof MEDIA_CLIP_IDS)[number]

export type MediaClipOption = {
  id: MediaClipId
  /** Full label for panel view */
  label: string
  /** Short label for compact toolbar grid */
  shortLabel: string
  hint?: string
}

export const MEDIA_CLIP_OPTIONS: MediaClipOption[] = [
  { id: 'none', label: 'None', shortLabel: 'None' },
  { id: 'diagonal_r', label: 'Diagonal right', shortLabel: 'Diag R', hint: 'Editorial slant (right)' },
  { id: 'diagonal_l', label: 'Diagonal left', shortLabel: 'Diag L', hint: 'Editorial slant (left)' },
  { id: 'tilt', label: 'Tilt', shortLabel: 'Tilt', hint: 'Soft angled frame' },
  { id: 'steep_r', label: 'Steep slant right', shortLabel: 'Steep R', hint: 'Strong diagonal (right)' },
  { id: 'steep_l', label: 'Steep slant left', shortLabel: 'Steep L', hint: 'Strong diagonal (left)' },
  { id: 'skew_box', label: 'Skew box', shortLabel: 'Skew', hint: 'All corners slightly offset' },
  { id: 'banner', label: 'Banner ribbon', shortLabel: 'Banner', hint: 'Angled ends like a ribbon' },
  { id: 'hexagon', label: 'Hexagon', shortLabel: 'Hex' },
  { id: 'octagon', label: 'Octagon', shortLabel: 'Oct' },
  { id: 'pentagon', label: 'Pentagon', shortLabel: 'Pent' },
  { id: 'diamond', label: 'Diamond', shortLabel: 'Diamond' },
  { id: 'bevel', label: 'Beveled frame', shortLabel: 'Bevel', hint: 'Chamfered corners' },
  { id: 'trapezoid_top', label: 'Trapezoid (wide top)', shortLabel: 'Trap T' },
  { id: 'trapezoid_bottom', label: 'Trapezoid (wide bottom)', shortLabel: 'Trap B' },
  { id: 'star5', label: '5-point star', shortLabel: 'Star' },
  { id: 'star4', label: '4-point star', shortLabel: 'Star 4' },
  { id: 'arch', label: 'Peaked arch', shortLabel: 'Arch', hint: 'Gabled top' },
  { id: 'dome', label: 'Dome arch', shortLabel: 'Dome', hint: 'Rounded top curve' },
  { id: 'wave', label: 'Wave top', shortLabel: 'Wave', hint: 'Wavy upper edge' },
  { id: 'scallop', label: 'Scallop top', shortLabel: 'Scallop', hint: 'Scalloped upper edge' },
  { id: 'notch_top', label: 'Top notch', shortLabel: 'Notch T', hint: 'Center notch on top' },
  { id: 'notch_bottom', label: 'Bottom notch', shortLabel: 'Notch B', hint: 'Center notch on bottom' },
  { id: 'chevron', label: 'Chevron right', shortLabel: 'Chev R', hint: 'Arrow-point frame (right)' },
  { id: 'chevron_l', label: 'Chevron left', shortLabel: 'Chev L', hint: 'Arrow-point frame (left)' },
  { id: 'arrow', label: 'Arrow', shortLabel: 'Arrow', hint: 'Pointed to the right' },
  { id: 'flag', label: 'Flag tail', shortLabel: 'Flag', hint: 'Swallow-tail banner' },
  { id: 'shield', label: 'Shield', shortLabel: 'Shield' },
  { id: 'ticket', label: 'Ticket', shortLabel: 'Ticket', hint: 'Notched ticket corners' },
  { id: 'house', label: 'House', shortLabel: 'House', hint: 'Roof peak frame' },
  { id: 'circle', label: 'Circle', shortLabel: 'Circle' },
  { id: 'oval', label: 'Oval', shortLabel: 'Oval' },
  { id: 'rounded', label: 'Rounded', shortLabel: 'Round', hint: 'Soft corner radius' },
  { id: 'pill', label: 'Pill', shortLabel: 'Pill', hint: 'Capsule shape' },
  { id: 'squircle', label: 'Squircle', shortLabel: 'Squircle', hint: 'Extra-rounded rectangle' },
  { id: 'leaf', label: 'Leaf', shortLabel: 'Leaf', hint: 'Organic leaf silhouette' },
  { id: 'blob', label: 'Blob', shortLabel: 'Blob', hint: 'Soft organic blob' },
  { id: 'parallelogram_r', label: 'Parallelogram right', shortLabel: 'Para R', hint: 'Slanted frame (leans right)' },
  { id: 'parallelogram_l', label: 'Parallelogram left', shortLabel: 'Para L', hint: 'Slanted frame (leans left)' },
  { id: 'heart', label: 'Heart', shortLabel: 'Heart', hint: 'Heart silhouette' },
  { id: 'cut_corners', label: 'Cut corners', shortLabel: 'Cut', hint: 'Chamfered corners on all sides' },
  { id: 'rounded_arch', label: 'Rounded arch', shortLabel: 'R Arch', hint: 'Wide rounded top, flat bottom' },
]

/** Grouped picker sections — keeps the shape library scannable in narrow panels. */
export const MEDIA_CLIP_GROUPS: { label: string; ids: MediaClipId[] }[] = [
  {
    label: 'Standard',
    ids: ['none', 'rounded', 'circle', 'oval', 'pill', 'squircle', 'bevel'],
  },
  {
    label: 'Slants & ribbons',
    ids: ['diagonal_r', 'diagonal_l', 'tilt', 'steep_r', 'steep_l', 'skew_box', 'banner'],
  },
  {
    label: 'Polygons & stars',
    ids: ['hexagon', 'octagon', 'pentagon', 'diamond', 'trapezoid_top', 'trapezoid_bottom', 'star5', 'star4'],
  },
  {
    label: 'Arches & waves',
    ids: ['arch', 'dome', 'wave', 'scallop', 'notch_top', 'notch_bottom'],
  },
  {
    label: 'Pointers & badges',
    ids: ['chevron', 'chevron_l', 'arrow', 'flag', 'shield', 'ticket', 'house'],
  },
  {
    label: 'Organic',
    ids: ['leaf', 'blob', 'heart'],
  },
  {
    label: 'Editorial extras',
    ids: ['parallelogram_r', 'parallelogram_l', 'cut_corners', 'rounded_arch'],
  },
]

const mediaClipOptionMap = new Map(MEDIA_CLIP_OPTIONS.map(o => [o.id, o]))

export function mediaClipOptionsForIds(ids: MediaClipId[]): MediaClipOption[] {
  return ids.map(id => mediaClipOptionMap.get(id)).filter((o): o is MediaClipOption => Boolean(o))
}

/** clip-path values — tuned for photos & 16:9 video. */
export const MEDIA_CLIP_CSS: Record<Exclude<MediaClipId, 'none'>, string> = {
  diagonal_r: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
  diagonal_l: 'polygon(0% 0%, 94% 0%, 100% 100%, 6% 100%)',
  tilt: 'polygon(0% 6%, 100% 0%, 100% 94%, 0% 100%)',
  steep_r: 'polygon(14% 0%, 100% 0%, 86% 100%, 0% 100%)',
  steep_l: 'polygon(0% 0%, 86% 0%, 100% 100%, 14% 100%)',
  skew_box: 'polygon(2% 8%, 98% 2%, 98% 92%, 2% 98%)',
  banner: 'polygon(4% 0%, 96% 0%, 100% 50%, 96% 100%, 4% 100%, 0% 50%)',
  hexagon: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  octagon: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
  pentagon: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
  diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  bevel: 'polygon(8% 0%, 92% 0%, 100% 8%, 100% 92%, 92% 100%, 8% 100%, 0% 92%, 0% 8%)',
  trapezoid_top: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)',
  trapezoid_bottom: 'polygon(0% 0%, 100% 0%, 88% 100%, 12% 100%)',
  star5: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  star4: 'polygon(50% 0%, 62% 38%, 100% 38%, 68% 62%, 82% 100%, 50% 76%, 18% 100%, 32% 62%, 0% 38%, 38% 38%)',
  arch: 'polygon(0% 12%, 0% 100%, 100% 100%, 100% 12%, 50% 0%)',
  dome: 'polygon(0% 18%, 0% 100%, 100% 100%, 100% 18%, 88% 8%, 75% 2%, 50% 0%, 25% 2%, 12% 8%)',
  wave: 'polygon(0% 14%, 8% 6%, 16% 14%, 24% 6%, 32% 14%, 40% 6%, 48% 14%, 56% 6%, 64% 14%, 72% 6%, 80% 14%, 88% 6%, 96% 14%, 100% 10%, 100% 100%, 0% 100%)',
  scallop: 'polygon(0% 16%, 6% 8%, 12% 16%, 18% 8%, 24% 16%, 30% 8%, 36% 16%, 42% 8%, 48% 16%, 54% 8%, 60% 16%, 66% 8%, 72% 16%, 78% 8%, 84% 16%, 90% 8%, 96% 16%, 100% 10%, 100% 100%, 0% 100%)',
  notch_top: 'polygon(0% 0%, 42% 0%, 50% 10%, 58% 0%, 100% 0%, 100% 100%, 0% 100%)',
  notch_bottom: 'polygon(0% 0%, 100% 0%, 100% 100%, 58% 100%, 50% 90%, 42% 100%, 0% 100%)',
  chevron: 'polygon(0% 0%, 88% 0%, 100% 50%, 88% 100%, 0% 100%, 12% 50%)',
  chevron_l: 'polygon(12% 0%, 100% 0%, 100% 100%, 12% 100%, 0% 50%)',
  arrow: 'polygon(0% 20%, 68% 20%, 68% 0%, 100% 50%, 68% 100%, 68% 80%, 0% 80%)',
  flag: 'polygon(0% 0%, 78% 0%, 100% 50%, 78% 100%, 0% 100%)',
  shield: 'polygon(0% 0%, 100% 0%, 100% 72%, 50% 100%, 0% 72%)',
  ticket: 'polygon(0% 8%, 8% 0%, 92% 0%, 100% 8%, 100% 92%, 92% 100%, 8% 100%, 0% 92%)',
  house: 'polygon(0% 40%, 50% 0%, 100% 40%, 100% 100%, 0% 100%)',
  // closest-side = a true circle on any box; 50% is relative to the diagonal and looks like an arch on 4:5 photos.
  circle: 'circle(closest-side at 50% 50%)',
  oval: 'ellipse(46% 50% at 50% 50%)',
  rounded: 'inset(0 round 10%)',
  pill: 'inset(0 round 999px)',
  squircle: 'inset(0 round 22%)',
  leaf: 'polygon(50% 0%, 78% 12%, 96% 38%, 88% 68%, 62% 96%, 50% 100%, 38% 96%, 12% 68%, 4% 38%, 22% 12%)',
  blob: 'polygon(18% 0%, 58% 4%, 96% 22%, 100% 58%, 82% 92%, 48% 100%, 12% 88%, 0% 52%, 6% 18%)',
  parallelogram_r: 'polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)',
  parallelogram_l: 'polygon(0% 0%, 90% 0%, 100% 100%, 10% 100%)',
  heart: 'polygon(50% 18%, 62% 6%, 78% 6%, 90% 18%, 90% 34%, 50% 78%, 10% 34%, 10% 18%, 22% 6%, 38% 6%)',
  cut_corners: 'polygon(10% 0%, 90% 0%, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0% 90%, 0% 10%)',
  rounded_arch: 'inset(0 round 50% 50% 0 0)',
}

/** @deprecated Use MEDIA_CLIP_CSS */
export const MEDIA_CLIP_PATHS = MEDIA_CLIP_CSS

export function normalizeMediaClip(value: unknown): MediaClipId {
  if (typeof value !== 'string') return 'none'
  const id = value.trim() as MediaClipId
  return MEDIA_CLIP_IDS.includes(id) ? id : 'none'
}

export function hasMediaClip(value: unknown): boolean {
  return normalizeMediaClip(value) !== 'none'
}

export function mediaClipStyle(value: unknown): CSSProperties {
  const id = normalizeMediaClip(value)
  if (id === 'none') return {}
  const clip = MEDIA_CLIP_CSS[id]
  return {
    clipPath: clip,
    WebkitClipPath: clip,
    ...(id === 'circle' ? { borderRadius: '50%' } : {}),
  }
}

/** Circle clip needs a square box or it reads as an arch / capsule. */
export function mediaClipNeedsSquareBox(value: unknown): boolean {
  return normalizeMediaClip(value) === 'circle'
}

/** @deprecated Use {@link sectionSupportsMediaClip} — all sections support clip props. */
export function blockSupportsMediaClip(_blockType?: string): boolean {
  return true
}

/** @deprecated All sections support media clip; kept for legacy imports. */
export const MEDIA_CLIP_BLOCK_TYPES: ReadonlySet<string> = new Set(['*'])
