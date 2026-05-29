import type { CSSProperties } from 'react'

export type BrandImagePosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top left'
  | 'top right'
  | 'bottom left'
  | 'bottom right'

export const BRAND_IMAGE_POSITION_OPTIONS: { value: BrandImagePosition; label: string }[] = [
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top left', label: 'Top left' },
  { value: 'top right', label: 'Top right' },
  { value: 'bottom left', label: 'Bottom left' },
  { value: 'bottom right', label: 'Bottom right' },
]

export type BrandImageFit = 'contain' | 'cover'

export const BRAND_IMAGE_FIT_OPTIONS: { value: BrandImageFit; label: string }[] = [
  { value: 'contain', label: 'Fit inside tile (no overflow)' },
  { value: 'cover', label: 'Fill tile (crop edges)' },
]

export const DEFAULT_BRAND_IMAGE_FIT: BrandImageFit = 'contain'
export const DEFAULT_BRAND_IMAGE_ZOOM = 100
export const MIN_BRAND_IMAGE_ZOOM = 50
export const MAX_BRAND_IMAGE_ZOOM = 200

export function normalizeBrandImagePosition(value?: string): BrandImagePosition {
  const found = BRAND_IMAGE_POSITION_OPTIONS.find((o) => o.value === value)
  return found?.value ?? 'center'
}

export function normalizeBrandImageFit(value?: string): BrandImageFit {
  return value === 'cover' ? 'cover' : 'contain'
}

export function clampBrandImageZoom(zoom?: number): number {
  const n = Number(zoom)
  if (!Number.isFinite(n)) return DEFAULT_BRAND_IMAGE_ZOOM
  return Math.min(MAX_BRAND_IMAGE_ZOOM, Math.max(MIN_BRAND_IMAGE_ZOOM, Math.round(n)))
}

export function brandImageInlineStyle(position?: string, zoom?: number, fit?: string): CSSProperties {
  const z = clampBrandImageZoom(zoom) / 100
  const pos = normalizeBrandImagePosition(position)
  const mode = normalizeBrandImageFit(fit)

  if (mode === 'contain') {
    return {
      objectPosition: 'center',
      transform: z === 1 ? undefined : `scale(${z})`,
      transformOrigin: 'center center',
    }
  }

  return {
    objectPosition: pos,
    transform: z === 1 ? undefined : `scale(${z})`,
    transformOrigin: pos,
  }
}
