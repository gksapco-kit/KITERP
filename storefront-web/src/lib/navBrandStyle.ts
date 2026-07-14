import type { CSSProperties } from 'react'

export type NavBrandLayout = 'horizontal' | 'vertical'
export type NavLogoSize = 'sm' | 'md' | 'lg' | 'xl'
export type NavBrandNameSize = 'sm' | 'md' | 'lg' | 'xl'
export type NavLogoShape = 'original' | 'rounded' | 'square' | 'circle' | 'squircle' | 'sharp'
export type NavLogoFit = 'contain' | 'cover'

export const NAV_BRAND_LAYOUT_OPTIONS: { value: NavBrandLayout; label: string }[] = [
  { value: 'horizontal', label: 'Side by side' },
  { value: 'vertical', label: 'Stacked' },
]

export const NAV_LOGO_SIZE_OPTIONS: { value: NavLogoSize; label: string }[] = [
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' },
]

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
 * Logo mark height in px. Tuned for common header bars (~48–72px total):
 * S ≈ 48px bar, M ≈ 56px, L ≈ 64px, XL ≈ 72px (with matching row padding).
 */
const LOGO_HEIGHT_PX: Record<NavLogoSize, { normal: number; compact: number }> = {
  sm: { normal: 28, compact: 24 },
  md: { normal: 36, compact: 30 },
  lg: { normal: 44, compact: 36 },
  xl: { normal: 56, compact: 44 },
}

/** Max width for Auto (original) logos so wordmarks can scale with height. */
const LOGO_MAX_WIDTH_PX: Record<NavLogoSize, { normal: number; compact: number }> = {
  sm: { normal: 120, compact: 96 },
  md: { normal: 168, compact: 132 },
  lg: { normal: 220, compact: 176 },
  xl: { normal: 300, compact: 240 },
}

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

/** Brand link max-width tracks logo size so XL marks are not capped small. */
const BRAND_MAX_WIDTH_CLASS: Record<NavLogoSize, string> = {
  sm: 'max-w-[min(100%,160px)] sm:max-w-[min(100%,200px)]',
  md: 'max-w-[min(100%,200px)] sm:max-w-[min(100%,260px)]',
  lg: 'max-w-[min(100%,240px)] sm:max-w-[min(100%,320px)]',
  xl: 'max-w-[min(100%,280px)] sm:max-w-[min(100%,380px)]',
}

/**
 * Vertical padding for the nav row. Keeps total bar height near standard
 * browser/app chrome while logo size remains the visual dominant.
 */
const NAV_ROW_PADDING_CLASS: Record<NavLogoSize, { normal: string; compact: string }> = {
  sm: { normal: 'py-2', compact: 'py-1.5' },
  md: { normal: 'py-2', compact: 'py-1.5' },
  lg: { normal: 'py-2.5', compact: 'py-1.5' },
  xl: { normal: 'py-2.5', compact: 'py-2' },
}

const NAV_ROW_MIN_HEIGHT_PX: Record<NavLogoSize, { normal: number; compact: number }> = {
  sm: { normal: 48, compact: 40 },
  md: { normal: 56, compact: 48 },
  lg: { normal: 64, compact: 52 },
  xl: { normal: 72, compact: 60 },
}

function readEnum<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback
}

export function readNavBrandLayout(props: Record<string, unknown>): NavBrandLayout {
  return readEnum(props.brand_layout, ['horizontal', 'vertical'] as const, 'horizontal')
}

export function readNavLogoSize(props: Record<string, unknown>): NavLogoSize {
  return readEnum(props.logo_size, ['sm', 'md', 'lg', 'xl'] as const, 'md')
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
  const size = readNavLogoSize(props)
  return `${resolveNavBrandContainerClass(layout, alignCenter)} min-w-0 ${BRAND_MAX_WIDTH_CLASS[size]}`
}

export function resolveNavBrandTextClass(
  props: Record<string, unknown>,
  isCompact: boolean,
): string {
  const size = readNavBrandNameSize(props)
  const tier = isCompact ? 'compact' : 'normal'
  return `font-bold truncate leading-none ${BRAND_TEXT_CLASS[size][tier]}`
}

export function resolveNavBarRowClass(
  props: Record<string, unknown>,
  isCompact: boolean,
): string {
  const size = readNavLogoSize(props)
  const tier = isCompact ? 'compact' : 'normal'
  return NAV_ROW_PADDING_CLASS[size][tier]
}

export function resolveNavBarMinHeightPx(
  props: Record<string, unknown>,
  isCompact: boolean,
): number {
  const size = readNavLogoSize(props)
  const tier = isCompact ? 'compact' : 'normal'
  return NAV_ROW_MIN_HEIGHT_PX[size][tier]
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
      return 8
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
  const size = readNavLogoSize(props)
  const shape = readNavLogoShape(props)
  const fit = readNavLogoFit(props)
  const tier = isCompact ? 'compact' : 'normal'
  const height = LOGO_HEIGHT_PX[size][tier]
  const maxWidth = LOGO_MAX_WIDTH_PX[size][tier]
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
  const logoSize = readNavLogoSize(props)
  const shape = readNavLogoShape(props)
  const nameSize = readNavBrandNameSize(props)
  const parts = [
    layout === 'vertical' ? 'Stacked' : 'Row',
    `logo ${logoSize.toUpperCase()}`,
    shape !== 'original' ? shape : null,
    `name ${nameSize.toUpperCase()}`,
  ].filter(Boolean)
  return parts.join(' · ')
}
