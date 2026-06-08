import type { StyleConfig } from '@/blocks/registry'

export interface NavBlockShell {
  navStyle: string
  navBg: string
  isCentered: boolean
  isGlass: boolean
  isElevated: boolean
  isCompact: boolean
  isAccentBorder: boolean
  isTransparentCta: boolean
  navIsDark: boolean
  navTextCol: string
  navBrandCol: string
  navBorderBottom: string
}

function navBgIsDark(hex: string): boolean {
  if (hex === 'transparent') return false
  const h = hex.replace('#', '')
  if (h.length < 6) return false
  const r = parseInt(h.substring(0, 2), 16) || 255
  const g = parseInt(h.substring(2, 4), 16) || 255
  const b = parseInt(h.substring(4, 6), 16) || 255
  return r + g + b < 382
}

/** Resolve nav bar chrome from block props (matches builder layout presets). */
export function resolveNavBlockShell(
  props: Record<string, unknown>,
  style: StyleConfig,
): NavBlockShell {
  const primary = style.primary_color || '#64C3A0'
  const navStyle = String(props.nav_style ?? style.nav_style ?? 'white')
  const navLayout = String(props.nav_layout ?? 'default')
  const isCentered = navLayout === 'centered' || navStyle === 'centered' || navStyle === 'dark_centered'
  const isGlass = props.nav_glass === true || navStyle === 'glass'
  const isElevated = props.nav_elevated === true || navStyle === 'elevated'
  const isCompact = props.nav_compact === true || navStyle === 'compact'
  const isAccentBorder = props.nav_accent_border === true || navStyle === 'accent_border'
  const isTransparentCta = props.nav_cta_prominent === true || navStyle === 'transparent_cta'

  const navBg = navStyle === 'transparent' || navStyle === 'transparent_cta'
    ? 'transparent'
    : String(props.nav_bg ?? '').trim()
      || String(style.nav_bg ?? '').trim()
      || (navStyle === 'dark' || navStyle === 'dark_centered'
        ? '#0f172a'
        : navStyle === 'brand'
          ? primary
          : '#ffffff')

  const navIsDark = navStyle === 'dark' || navStyle === 'brand' || navStyle === 'dark_centered'
    || navBgIsDark(navBg)

  const navTextCol = navIsDark ? 'rgba(255,255,255,0.85)' : '#4B5563'
  const navBrandCol = navIsDark ? '#ffffff' : primary
  const navBorderBottom = navStyle === 'transparent' || navStyle === 'transparent_cta'
    ? 'none'
    : isAccentBorder
      ? `3px solid ${primary}`
      : `1px solid ${navIsDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}`

  return {
    navStyle,
    navBg,
    isCentered,
    isGlass,
    isElevated,
    isCompact,
    isAccentBorder,
    isTransparentCta,
    navIsDark,
    navTextCol,
    navBrandCol,
    navBorderBottom,
  }
}

export interface SectionSurfaceStyle {
  background: string
  color: string
  isDark: boolean
}

/** Shared section background from layout presets (stats, features, cta, etc.). */
export function resolveSectionSurface(
  props: Record<string, unknown>,
  style: StyleConfig,
): SectionSurfaceStyle {
  const bgStyle = String(props.bg_style ?? 'light')
  const primary = style.primary_color || '#64C3A0'
  const secondary = style.secondary_color || primary
  const gradientFrom = props.gradient_from as string | undefined
  const gradientTo = props.gradient_to as string | undefined
  const gradientDir = String(props.gradient_dir ?? '135deg')
  const gradientPreset = props.gradient_preset as string | undefined
  const bgColor = (props.bg_color as string) || undefined

  if (bgStyle === 'dark') {
    return { background: bgColor || '#0f172a', color: '#f8fafc', isDark: true }
  }
  if (bgStyle === 'brand') {
    return { background: primary, color: '#ffffff', isDark: true }
  }
  if (bgStyle === 'gradient') {
    const grad = gradientPreset
      || (gradientFrom && gradientTo
        ? `linear-gradient(${gradientDir}, ${gradientFrom}, ${gradientTo})`
        : `linear-gradient(135deg, ${primary}, ${secondary})`)
    return { background: grad, color: '#ffffff', isDark: true }
  }
  if (bgStyle === 'image' && props.bg_image_url) {
    return { background: bgColor || style.bg_color || '#ffffff', color: style.text_color || '#111827', isDark: false }
  }
  return {
    background: bgColor || style.bg_color || style.surface_color || '#ffffff',
    color: style.text_color || '#111827',
    isDark: false,
  }
}
