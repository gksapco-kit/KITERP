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

const LOGO_HEIGHT_PX: Record<NavLogoSize, { normal: number; compact: number }> = {
  sm: { normal: 24, compact: 20 },
  md: { normal: 32, compact: 24 },
  lg: { normal: 40, compact: 32 },
  xl: { normal: 48, compact: 40 },
}

const LOGO_MAX_WIDTH_PX: Record<NavLogoSize, { normal: number; compact: number }> = {
  sm: { normal: 80, compact: 64 },
  md: { normal: 120, compact: 100 },
  lg: { normal: 160, compact: 120 },
  xl: { normal: 200, compact: 160 },
}

const BRAND_TEXT_CLASS: Record<NavBrandNameSize, { normal: string; compact: string }> = {
  sm: { normal: 'text-xs', compact: 'text-[11px]' },
  md: { normal: 'text-base', compact: 'text-sm' },
  lg: { normal: 'text-lg', compact: 'text-base' },
  xl: { normal: 'text-xl', compact: 'text-lg' },
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

export function resolveNavBrandTextClass(
  props: Record<string, unknown>,
  isCompact: boolean,
): string {
  const size = readNavBrandNameSize(props)
  const tier = isCompact ? 'compact' : 'normal'
  return `font-bold truncate ${BRAND_TEXT_CLASS[size][tier]}`
}

export function resolveNavLogoPresentation(
  props: Record<string, unknown>,
  isCompact: boolean,
): { className: string; style: CSSProperties } {
  const size = readNavLogoSize(props)
  const shape = readNavLogoShape(props)
  const fit = readNavLogoFit(props)
  const tier = isCompact ? 'compact' : 'normal'
  const height = LOGO_HEIGHT_PX[size][tier]
  const maxWidth = LOGO_MAX_WIDTH_PX[size][tier]

  const style: CSSProperties = {
    objectFit: fit,
  }

  const classNames = ['shrink-0']

  if (shape === 'original') {
    classNames.push('w-auto object-contain')
    style.height = height
    style.maxWidth = maxWidth
  } else {
    classNames.push('object-cover')
    style.height = height
    style.width = height
    style.maxWidth = height
    style.minWidth = height

    switch (shape) {
      case 'circle':
        style.borderRadius = '50%'
        break
      case 'squircle':
        style.borderRadius = '28%'
        break
      case 'square':
        style.borderRadius = 4
        break
      case 'sharp':
        style.borderRadius = 0
        break
      case 'rounded':
      default:
        style.borderRadius = 8
        break
    }
  }

  return { className: classNames.join(' '), style }
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
