import type { CSSProperties } from 'react'
import { readNavHeaderBarSize } from '@/lib/navBlockLayout'

export type NavBrandLayout = 'horizontal' | 'vertical'
/** @deprecated Prefer numeric `logo_size` px. Kept for reading legacy sites. */
export type NavLogoSize = 'sm' | 'md' | 'lg' | 'xl'
export type NavBrandNameSize = 'sm' | 'md' | 'lg' | 'xl'
export type NavLogoShape = 'original' | 'rounded' | 'square' | 'circle' | 'squircle' | 'sharp'
export type NavLogoFit = 'contain' | 'cover'

export const NAV_BRAND_LAYOUT_OPTIONS: { value: NavBrandLayout; label: string }[] = [
  { value: 'horizontal', label: 'Side by side' },
  { value: 'vertical', label: 'Stacked' },
]

/** Logo height slider range (px). Independent of header bar height. */
export const NAV_LOGO_HEIGHT_RANGE = {
  min: 0,
  max: 150,
  step: 2,
  default: 52,
} as const

/** Compact nav uses ~85% of the configured logo height. */
const COMPACT_LOGO_SCALE = 0.85

/** Legacy S–XL tokens → normal-tier height (px). */
const LEGACY_LOGO_HEIGHT_PX: Record<NavLogoSize, number> = {
  sm: 36,
  md: 44,
  lg: 52,
  xl: 64,
}

export const NAV_BRAND_NAME_SIZE_OPTIONS: { value: NavBrandNameSize; label: string }[] = [
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' },
]

export const NAV_LOGO_SHAPE_OPTIONS: { value: NavLogoShape; label: string }[] = [
  { value: 'original', label: 'Auto' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'square', label: 'Square' },
  { value: 'circle', label: 'Circle' },
  { value: 'squircle', label: 'Squircle' },
  { value: 'sharp', label: 'Sharp' },
]

export const NAV_LOGO_FIT_OPTIONS: { value: NavLogoFit; label: string }[] = [
  { value: 'contain', label: 'Fit' },
  { value: 'cover', label: 'Cover' },
]

/**
 * Brand wordmark type scale — sized to sit beside the logo mark without looking
 * undersized relative to nav links / CTA.
 */
const BRAND_TEXT_CLASS: Record<NavBrandNameSize, { normal: string; compact: string }> = {
  sm: { normal: 'text-sm', compact: 'text-xs' },
  md: { normal: 'text-lg', compact: 'text-base' },
  lg: { normal: 'text-xl', compact: 'text-lg' },
  xl: { normal: 'text-2xl', compact: 'text-xl' },
}

/** Stable header bar chrome — not tied to logo size. */
const NAV_ROW_PADDING_CLASS = {
  normal: 'py-2.5',
  compact: 'py-1.5',
} as const

const NAV_ROW_MIN_HEIGHT_DEFAULT_PX = {
  normal: 64,
  compact: 52,
} as const

function readEnum<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback
}

function clampLogoHeightPx(n: number): number {
  return Math.min(
    NAV_LOGO_HEIGHT_RANGE.max,
    Math.max(NAV_LOGO_HEIGHT_RANGE.min, Math.round(n)),
  )
}

export function readNavBrandLayout(props: Record<string, unknown>): NavBrandLayout {
  return readEnum(props.brand_layout, ['horizontal', 'vertical'] as const, 'horizontal')
}

/**
 * Logo mark height in px.
 * Accepts numeric `logo_size` (new) or legacy `'sm'|'md'|'lg'|'xl'`.
 */
export function readNavLogoHeightPx(
  props: Record<string, unknown>,
  isCompact = false,
): number {
  const raw = props.logo_size
  let height = NAV_LOGO_HEIGHT_RANGE.default

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    height = clampLogoHeightPx(raw)
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      height = clampLogoHeightPx(Number(trimmed))
    } else if (trimmed in LEGACY_LOGO_HEIGHT_PX) {
      height = LEGACY_LOGO_HEIGHT_PX[trimmed as NavLogoSize]
    }
  }

  if (isCompact) {
    return clampLogoHeightPx(Math.round(height * COMPACT_LOGO_SCALE))
  }
  return height
}

/** Max width for Auto (original) logos — scales with mark height. */
function logoMaxWidthForHeight(height: number): number {
  return Math.round(Math.min(420, Math.max(120, height * 5)))
}

function brandMaxWidthClassForHeight(height: number): string {
  if (height <= 36) return 'max-w-[min(100%,180px)] sm:max-w-[min(100%,220px)]'
  if (height <= 48) return 'max-w-[min(100%,220px)] sm:max-w-[min(100%,300px)]'
  if (height <= 64) return 'max-w-[min(100%,260px)] sm:max-w-[min(100%,360px)]'
  return 'max-w-[min(100%,300px)] sm:max-w-[min(100%,420px)]'
}

export function readNavBrandNameSize(props: Record<string, unknown>): NavBrandNameSize {
  return readEnum(props.brand_name_size, ['sm', 'md', 'lg', 'xl'] as const, 'md')
}

export function readNavLogoShape(props: Record<string, unknown>): NavLogoShape {
  return readEnum(
    props.logo_shape,
    ['original', 'rounded', 'square', 'circle', 'squircle', 'sharp'] as const,
    'original',
  )
}

export function readNavLogoFit(props: Record<string, unknown>): NavLogoFit {
  return readEnum(props.logo_fit, ['contain', 'cover'] as const, 'contain')
}

export function readNavBrandGap(props: Record<string, unknown>): number {
  const raw = Number(props.brand_gap)
  return Number.isFinite(raw) ? Math.min(32, Math.max(0, Math.round(raw))) : 8
}

export function resolveNavBrandContainerClass(
  layout: NavBrandLayout,
  alignCenter = false,
): string {
  if (layout === 'vertical') {
    return alignCenter
      ? 'inline-flex flex-col items-center min-w-0 shrink-0'
      : 'inline-flex flex-col items-start min-w-0 shrink-0'
  }
  return 'inline-flex flex-row items-center min-w-0 shrink-0'
}

export function resolveNavBrandLinkClass(
  props: Record<string, unknown>,
  layout: NavBrandLayout,
  alignCenter = false,
): string {
  const height = readNavLogoHeightPx(props, false)
  return `${resolveNavBrandContainerClass(layout, alignCenter)} min-w-0 ${brandMaxWidthClassForHeight(height)}`
}

export function resolveNavBrandTextClass(
  props: Record<string, unknown>,
  isCompact: boolean,
): string {
  const size = readNavBrandNameSize(props)
  const tier = isCompact ? 'compact' : 'normal'
  return `font-bold truncate leading-none ${BRAND_TEXT_CLASS[size][tier]}`
}

/** Header row padding — fixed; does not follow logo size. */
export function resolveNavBarRowClass(
  _props: Record<string, unknown>,
  isCompact: boolean,
): string {
  return isCompact ? NAV_ROW_PADDING_CLASS.compact : NAV_ROW_PADDING_CLASS.normal
}

/**
 * Header bar min-height. Uses explicit `header_bar_size` when set;
 * otherwise a stable default. Never tracks logo size.
 */
export function resolveNavBarMinHeightPx(
  props: Record<string, unknown>,
  isCompact: boolean,
): number {
  const explicit = readNavHeaderBarSize(props)
  if (explicit != null) return explicit
  return isCompact ? NAV_ROW_MIN_HEIGHT_DEFAULT_PX.compact : NAV_ROW_MIN_HEIGHT_DEFAULT_PX.normal
}

function shapeBorderRadius(shape: NavLogoShape): string | number | undefined {
  switch (shape) {
    case 'circle':
      return '50%'
    case 'squircle':
      return '28%'
    case 'square':
      return 4
    case 'sharp':
      return 0
    case 'rounded':
      return 8
    case 'original':
    default:
      // Preserve uploaded artwork; many logos already include their own padding/corners.
      return 0
  }
}

export interface NavLogoPresentation {
  /** Outer frame — owns width/height so builder wrappers size correctly. */
  frameClassName: string
  frameStyle: CSSProperties
  /** Inner <img> fill styles. */
  imgClassName: string
  imgStyle: CSSProperties
}

/**
 * Logo sizing/shaping for the nav brand mark.
 * Dimensions apply to a frame wrapper; the image fills that frame so builder
 * `h-full w-full` wrappers and live `<img>` tags stay visually consistent.
 */
export function resolveNavLogoPresentation(
  props: Record<string, unknown>,
  isCompact: boolean,
): NavLogoPresentation {
  const shape = readNavLogoShape(props)
  const fit = readNavLogoFit(props)
  const height = readNavLogoHeightPx(props, isCompact)
  const maxWidth = logoMaxWidthForHeight(height)
  const radius = shapeBorderRadius(shape)

  if (shape === 'original') {
    return {
      frameClassName: 'relative inline-flex shrink-0 items-center justify-center overflow-hidden',
      frameStyle: {
        height,
        maxWidth,
        // Prefer intrinsic image width; fall back to square so empty editor
        // slots still show a usable “Add photo” target.
        width: 'auto',
        minWidth: height,
        borderRadius: radius,
      },
      imgClassName: 'block h-full w-auto max-w-full object-contain',
      imgStyle: {
        height,
        maxWidth,
        width: 'auto',
        objectFit: 'contain',
        borderRadius: radius,
      },
    }
  }

  return {
    frameClassName: 'relative inline-flex shrink-0 items-center justify-center overflow-hidden',
    frameStyle: {
      height,
      width: height,
      maxWidth: height,
      minWidth: height,
      borderRadius: radius,
    },
    imgClassName: 'block h-full w-full',
    imgStyle: {
      height,
      width: height,
      maxWidth: height,
      minWidth: height,
      objectFit: fit,
      borderRadius: radius,
    },
  }
}

export function navBrandDisplayPreview(props: Record<string, unknown>): string {
  const layout = readNavBrandLayout(props)
  const logoH = readNavLogoHeightPx(props, false)
  const shape = readNavLogoShape(props)
  const nameSize = readNavBrandNameSize(props)
  const parts = [
    layout === 'vertical' ? 'Stacked' : 'Row',
    `logo ${logoH}px`,
    shape !== 'original' ? shape : null,
    `name ${nameSize.toUpperCase()}`,
  ].filter(Boolean)
  return parts.join(' · ')
}
