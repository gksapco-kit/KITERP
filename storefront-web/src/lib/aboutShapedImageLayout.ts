import { MEDIA_CLIP_CSS, normalizeMediaClip } from '@/lib/mediaClip'

/** Shared shape + size for Our Story `layout: shaped` (canvas, preview, published). */
export type AboutShapedImageSpec = {
  clipId: 'oval' | 'squircle' | 'circle' | 'rounded' | 'pill'
  /** CSS aspect-ratio value e.g. "4 / 3" — used inline so width+height can override */
  aspectRatio: string
  previewAspectClass: string
  previewWidthClass: string
  clipPath: string
}

const OVAL: AboutShapedImageSpec = {
  clipId: 'oval',
  aspectRatio: '2.15 / 1',
  previewAspectClass: 'aspect-[2.15/1]',
  previewWidthClass: 'w-[88%]',
  clipPath: MEDIA_CLIP_CSS.oval,
}

const SQUIRCLE: AboutShapedImageSpec = {
  clipId: 'squircle',
  aspectRatio: '4 / 3',
  previewAspectClass: 'aspect-[4/3]',
  previewWidthClass: 'w-[82%]',
  clipPath: MEDIA_CLIP_CSS.squircle,
}

/**
 * Capsule / stadium frame — wide landscape with pill clip.
 */
const CAPSULE: AboutShapedImageSpec = {
  clipId: 'pill',
  aspectRatio: '4 / 3',
  previewAspectClass: 'aspect-[4/3]',
  previewWidthClass: 'w-[82%]',
  clipPath: MEDIA_CLIP_CSS.pill,
}

const CIRCLE: AboutShapedImageSpec = {
  clipId: 'circle',
  aspectRatio: '1 / 1',
  previewAspectClass: 'aspect-square',
  previewWidthClass: 'w-[62%]',
  clipPath: MEDIA_CLIP_CSS.circle,
}

const ROUNDED: AboutShapedImageSpec = {
  clipId: 'rounded',
  aspectRatio: '3 / 2',
  previewAspectClass: 'aspect-[3/2]',
  previewWidthClass: 'w-[85%]',
  clipPath: MEDIA_CLIP_CSS.rounded,
}

/** Resolve clip + dimensions for a shaped about image. Defaults to squircle. */
export function resolveAboutShapedImageLayout(mediaClip: unknown): AboutShapedImageSpec {
  const id = normalizeMediaClip(mediaClip)
  if (id === 'oval') return OVAL
  if (id === 'circle') return CIRCLE
  if (id === 'rounded') return ROUNDED
  if (id === 'squircle') return SQUIRCLE
  if (id === 'pill') return CAPSULE
  return SQUIRCLE
}

/** Default props for shaped about presets — keeps picker + canvas in sync. */
export const ABOUT_SHAPED_IMAGE_PRESETS = {
  oval: {
    layout: 'shaped' as const,
    media_clip: 'oval' as const,
    align: 'center' as const,
    variant: 'centered' as const,
    bg_style: 'light' as const,
  },
  squircle: {
    layout: 'shaped' as const,
    media_clip: 'squircle' as const,
    align: 'center' as const,
    variant: 'centered' as const,
    bg_style: 'light' as const,
    image_shadow: 'lg' as const,
  },
  capsule: {
    layout: 'shaped' as const,
    media_clip: 'pill' as const,
    align: 'center' as const,
    variant: 'centered' as const,
    bg_style: 'light' as const,
    image_shadow: 'lg' as const,
  },
}
