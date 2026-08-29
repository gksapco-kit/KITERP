/** Builder section image fit / focal point — keyed by prop field (image_url, bg_image_url). */
import type { CSSProperties } from 'react'

export type SectionImageFit = 'cover' | 'contain' | 'fill'

export function sectionImageStyleKeys(field: string) {
  if (field === 'bg_image_url') {
    return {
      fit: 'bg_image_fit',
      focalX: 'bg_image_focal_x',
      focalY: 'bg_image_focal_y',
      scale: 'bg_image_scale',
    } as const
  }
  return {
    fit: 'image_fit',
    focalX: 'image_focal_x',
    focalY: 'image_focal_y',
    scale: 'image_scale',
  } as const
}

export function readSectionImageFit(field: string, props: Record<string, unknown>): SectionImageFit {
  const { fit } = sectionImageStyleKeys(field)
  let raw = props[fit]
  if (raw == null && field === 'image_url') raw = props.bg_image_fit
  return raw === 'contain' || raw === 'fill' ? raw : 'cover'
}

export function readSectionImageFocal(field: string, props: Record<string, unknown>): { x: number; y: number } {
  const { focalX, focalY } = sectionImageStyleKeys(field)
  let x = Number(props[focalX])
  let y = Number(props[focalY])
  if (field === 'image_url') {
    if (!Number.isFinite(x)) x = Number(props.bg_image_focal_x)
    if (!Number.isFinite(y)) y = Number(props.bg_image_focal_y)
  }
  return {
    x: Number.isFinite(x) ? Math.min(100, Math.max(0, Math.round(x))) : 50,
    y: Number.isFinite(y) ? Math.min(100, Math.max(0, Math.round(y))) : 50,
  }
}

export function readSectionImageScale(field: string, props: Record<string, unknown>): number {
  const { scale } = sectionImageStyleKeys(field)
  let raw = Number(props[scale])
  if (!Number.isFinite(raw) && field === 'image_url') raw = Number(props.bg_image_scale)
  return Number.isFinite(raw) ? Math.min(400, Math.max(25, Math.round(raw))) : 100
}

export function sectionImageObjectStyle(field: string, props: Record<string, unknown>): {
  objectFit: SectionImageFit
  objectPosition: string
  transform?: string
  transformOrigin?: string
} {
  const fit = readSectionImageFit(field, props)
  const { x, y } = readSectionImageFocal(field, props)
  const scale = readSectionImageScale(field, props)
  return {
    objectFit: fit,
    objectPosition: `${x}% ${y}%`,
    ...(scale !== 100
      ? { transform: `scale(${scale / 100})`, transformOrigin: `${x}% ${y}%` }
      : {}),
  }
}

/* ── Section image decor: corners, shadow, opacity, layering, gradient overlay ── */

export type SectionImageShadow = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'inner' | 'glow'
export type SectionImageLayer = 'front' | 'back'
export type SectionImageOverlay =
  | 'none'
  | 'dark-bottom'
  | 'dark-full'
  | 'top-fade'
  | 'left-fade'
  | 'right-fade'
  | 'vignette'
  | 'spotlight'
  | 'warm'
  | 'cool'
  | 'sunset'
  | 'brand'

export const SECTION_IMAGE_SHADOW_CSS: Record<SectionImageShadow, string | undefined> = {
  none: undefined,
  sm: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
  md: '0 6px 16px rgba(0,0,0,0.16)',
  lg: '0 14px 32px rgba(0,0,0,0.22)',
  xl: '0 24px 52px rgba(0,0,0,0.30)',
  inner: 'inset 0 2px 12px rgba(0,0,0,0.35)',
  glow: '0 0 28px rgba(15,23,42,0.28), 0 8px 24px rgba(15,23,42,0.18)',
}

export function sectionImageDecorKeys(field: string) {
  if (field === 'bg_image_url') {
    return {
      radius: 'bg_image_radius',
      shadow: 'bg_image_shadow',
      opacity: 'bg_image_opacity',
      layer: 'bg_image_layer',
      overlay: 'bg_image_overlay',
    } as const
  }
  return {
    radius: 'image_radius',
    shadow: 'image_shadow',
    opacity: 'image_opacity',
    layer: 'image_layer',
    overlay: 'image_overlay',
  } as const
}

export function readSectionImageRadius(field: string, props: Record<string, unknown>): number {
  const { radius } = sectionImageDecorKeys(field)
  const raw = Number(props[radius])
  return Number.isFinite(raw) ? Math.min(96, Math.max(0, Math.round(raw))) : 0
}

export function readSectionImageShadow(field: string, props: Record<string, unknown>): SectionImageShadow {
  const { shadow } = sectionImageDecorKeys(field)
  const raw = props[shadow]
  return raw === 'sm' || raw === 'md' || raw === 'lg' || raw === 'xl' || raw === 'inner' || raw === 'glow'
    ? raw
    : 'none'
}

export function readSectionImageOpacity(field: string, props: Record<string, unknown>): number {
  const { opacity } = sectionImageDecorKeys(field)
  const raw = Number(props[opacity])
  return Number.isFinite(raw) ? Math.min(100, Math.max(10, Math.round(raw))) : 100
}

export function readSectionImageLayer(field: string, props: Record<string, unknown>): SectionImageLayer {
  const { layer } = sectionImageDecorKeys(field)
  return props[layer] === 'back' ? 'back' : 'front'
}

export function readSectionImageOverlay(field: string, props: Record<string, unknown>): SectionImageOverlay {
  const { overlay } = sectionImageDecorKeys(field)
  const raw = props[overlay]
  const allowed: SectionImageOverlay[] = [
    'dark-bottom', 'dark-full', 'top-fade', 'left-fade', 'right-fade',
    'vignette', 'spotlight', 'warm', 'cool', 'sunset', 'brand',
  ]
  return allowed.includes(raw as SectionImageOverlay) ? (raw as SectionImageOverlay) : 'none'
}

/** Wrapper-level CSS for corners / shadow / opacity (applied to the image frame, not the <img>). */
export function sectionImageDecorStyle(field: string, props: Record<string, unknown>): CSSProperties {
  const radius = readSectionImageRadius(field, props)
  const shadow = readSectionImageShadow(field, props)
  const opacity = readSectionImageOpacity(field, props)
  const css: CSSProperties = {}
  if (radius > 0) css.borderRadius = radius
  const shadowCss = SECTION_IMAGE_SHADOW_CSS[shadow]
  if (shadowCss) css.boxShadow = shadowCss
  if (opacity !== 100) css.opacity = opacity / 100
  return css
}

/** CSS background for a gradient overlay drawn above the image (none → undefined). */
export function sectionImageOverlayCss(
  value: SectionImageOverlay,
  brandColor?: string,
): string | undefined {
  switch (value) {
    case 'dark-bottom':
      return 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0) 75%)'
    case 'dark-full':
      return 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.55))'
    case 'top-fade':
      return 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 55%)'
    case 'left-fade':
      return 'linear-gradient(to right, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 42%, rgba(0,0,0,0) 72%)'
    case 'right-fade':
      return 'linear-gradient(to left, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 42%, rgba(0,0,0,0) 72%)'
    case 'vignette':
      return 'radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)'
    case 'spotlight':
      return 'radial-gradient(ellipse 70% 85% at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)'
    case 'warm':
      return 'linear-gradient(135deg, rgba(120,53,15,0.55) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.5) 100%)'
    case 'cool':
      return 'linear-gradient(135deg, rgba(15,23,42,0.65) 0%, rgba(30,58,138,0.35) 50%, rgba(0,0,0,0.45) 100%)'
    case 'sunset':
      return 'linear-gradient(to top, rgba(124,45,18,0.75) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.15) 100%)'
    case 'brand': {
      const c = brandColor || '#0f172a'
      return `linear-gradient(135deg, ${c}cc, ${c}33)`
    }
    default:
      return undefined
  }
}

/** Stack image overlay gradient on top of a photo (for full-bleed backgrounds). */
export function sectionImageBackgroundLayers(
  field: string,
  props: Record<string, unknown>,
  imageUrl: string,
  brandColor?: string,
  defaultOverlay: SectionImageOverlay = 'none',
): {
  backgroundImage: string
  backgroundSize: string
  backgroundPosition: string
  backgroundRepeat: 'no-repeat'
} {
  const { overlay: overlayPropKey } = sectionImageDecorKeys(field)
  const overlayKey = props[overlayPropKey]
  const effectiveOverlay: SectionImageOverlay = overlayKey == null
    ? defaultOverlay
    : readSectionImageOverlay(field, props)
  const overlay = sectionImageOverlayCss(effectiveOverlay, brandColor)
  const imageLayer = `url(${imageUrl})`
  const imageSize = sectionImageBackgroundSize(field, props)
  const imagePosition = sectionImageBackgroundPosition(field, props)
  return {
    backgroundImage: overlay ? `${overlay}, ${imageLayer}` : imageLayer,
    backgroundPosition: overlay ? `center, ${imagePosition}` : imagePosition,
    backgroundSize: overlay ? `auto, ${imageSize}` : imageSize,
    backgroundRepeat: 'no-repeat',
  }
}

export function sectionImageBackgroundPosition(field: string, props: Record<string, unknown>): string {
  const { x, y } = readSectionImageFocal(field, props)
  return `${x}% ${y}%`
}

export function sectionImageBackgroundSize(field: string, props: Record<string, unknown>): string {
  const fit = readSectionImageFit(field, props)
  if (fit === 'contain') return 'contain'
  if (fit === 'fill') return '100% 100%'
  const scale = readSectionImageScale(field, props)
  return scale !== 100 ? `${scale}%` : 'cover'
}

/** Per-item image style keys stored on array entries (categories[i], images[i], …). */
export const ARRAY_ITEM_IMAGE_STYLE_KEYS = {
  fit: 'image_fit',
  focalX: 'image_focal_x',
  focalY: 'image_focal_y',
  scale: 'image_scale',
} as const

export function arrayItemHasOwnImageStyle(item: Record<string, unknown>): boolean {
  return (
    item.image_fit != null
    || item.image_focal_x != null
    || item.image_focal_y != null
    || item.image_scale != null
  )
}

/** Read fit / focal / zoom for one array slot — item overrides, else section-level defaults. */
export function readArrayItemImageStyleProps(
  item: Record<string, unknown>,
  blockProps: Record<string, unknown>,
  sectionField: string,
): Record<string, unknown> {
  if (arrayItemHasOwnImageStyle(item)) return item
  const keys = sectionImageStyleKeys(sectionField)
  return {
    ...item,
    image_fit: blockProps[keys.fit],
    image_focal_x: blockProps[keys.focalX],
    image_focal_y: blockProps[keys.focalY],
    image_scale: blockProps[keys.scale],
  }
}

/**
 * Sparse inline <img> style for one array-item image so the LIVE storefront matches the
 * builder canvas. Only emits a property the owner actually customised (item-level, or the
 * section-level default it inherits), so it never clobbers a block's own classes (e.g.
 * logos default to `object-contain`). Shadow / gradient overlay / layering stay
 * section-level — per-card frames clip them — so they are intentionally excluded.
 */
export function arrayItemImageRenderStyle(
  item: Record<string, unknown>,
  blockProps: Record<string, unknown>,
  sectionField = 'image_url',
): CSSProperties {
  const css: CSSProperties = {}
  const sectionKeys = sectionImageStyleKeys(sectionField)

  const fitRaw = item.image_fit ?? blockProps[sectionKeys.fit]
  if (fitRaw === 'cover' || fitRaw === 'contain' || fitRaw === 'fill') css.objectFit = fitRaw

  const hasFocalX = item.image_focal_x != null || blockProps[sectionKeys.focalX] != null
  const hasFocalY = item.image_focal_y != null || blockProps[sectionKeys.focalY] != null
  const hasScale = item.image_scale != null || blockProps[sectionKeys.scale] != null
  if (hasFocalX || hasFocalY || hasScale) {
    const { x, y } = readSectionImageFocal('image_url', readArrayItemImageStyleProps(item, blockProps, sectionField))
    css.objectPosition = `${x}% ${y}%`
    const scale = readSectionImageScale('image_url', readArrayItemImageStyleProps(item, blockProps, sectionField))
    if (scale !== 100) {
      css.transform = `scale(${scale / 100})`
      css.transformOrigin = `${x}% ${y}%`
    }
  }

  if (item.image_radius != null) {
    const radius = readSectionImageRadius('image_url', item)
    if (radius > 0) css.borderRadius = radius
  }
  if (item.image_opacity != null) {
    const opacity = readSectionImageOpacity('image_url', item)
    if (opacity !== 100) css.opacity = opacity / 100
  }
  const shadow = readSectionImageShadow('image_url', item)
  const shadowCss = SECTION_IMAGE_SHADOW_CSS[shadow]
  if (shadowCss) css.boxShadow = shadowCss
  return css
}

/**
 * Corners + shadow for the wrapper FRAME of a per-card image. A frame keeps its
 * `overflow-hidden` (to clip zoom) yet still paints its own drop shadow, so this is where
 * a per-card shadow must live to actually be visible.
 */
export function arrayItemImageFrameStyle(item: Record<string, unknown>): CSSProperties {
  const css: CSSProperties = {}
  if (item.image_radius != null) {
    const radius = readSectionImageRadius('image_url', item)
    if (radius > 0) css.borderRadius = radius
  }
  const shadow = readSectionImageShadow('image_url', item)
  const shadowCss = SECTION_IMAGE_SHADOW_CSS[shadow]
  if (shadowCss) css.boxShadow = shadowCss
  return css
}

export function readArrayItemFromBlockProps(
  blockProps: Record<string, unknown>,
  arrayKey: string,
  index: number,
): Record<string, unknown> {
  const arr = blockProps[arrayKey]
  if (!Array.isArray(arr) || index < 0 || index >= arr.length) return {}
  const item = arr[index]
  return item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
}

export function patchArrayItemImageStyle(
  blockProps: Record<string, unknown>,
  arrayKey: string,
  index: number,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const arr = [...((blockProps[arrayKey] as unknown[]) || [])]
  while (arr.length <= index) arr.push({})
  const prev = arr[index] && typeof arr[index] === 'object'
    ? (arr[index] as Record<string, unknown>)
    : {}
  arr[index] = { ...prev, ...patch }
  return { [arrayKey]: arr }
}

export type ArrayImageSlotRef = { arrayKey: string; index: number; itemField: string }

/** Apply zoom / pan / fit patch to several array slots in one update. */
export function patchMultipleArrayItemImageStyles(
  blockProps: Record<string, unknown>,
  slots: ArrayImageSlotRef[],
  patch: Record<string, unknown>,
): Record<string, unknown> {
  if (!slots.length) return {}
  const arrayKey = slots[0].arrayKey
  const arr = [...((blockProps[arrayKey] as unknown[]) || [])]
  for (const slot of slots) {
    while (arr.length <= slot.index) arr.push({})
    const prev = arr[slot.index] && typeof arr[slot.index] === 'object'
      ? (arr[slot.index] as Record<string, unknown>)
      : {}
    arr[slot.index] = { ...prev, ...patch }
  }
  return { [arrayKey]: arr }
}
