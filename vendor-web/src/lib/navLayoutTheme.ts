import type { FooterThemeFallback } from '@/lib/footerLayoutTheme'

export type NavLayoutStyle =
  | 'white'
  | 'dark'
  | 'transparent'
  | 'brand'
  | 'centered'
  | 'glass'
  | 'elevated'
  | 'compact'
  | 'accent_border'
  | 'shop'
  | 'dark_centered'
  | 'transparent_cta'

export type NavLayoutPreset = {
  label: string
  desc: string
  props: { nav_style: NavLayoutStyle }
}

export const NAV_LAYOUT_PRESETS: NavLayoutPreset[] = [
  { label: 'White Solid', desc: 'Classic white bar', props: { nav_style: 'white' } },
  { label: 'Dark Bar', desc: 'Dark navigation', props: { nav_style: 'dark' } },
  { label: 'Transparent', desc: 'Overlay on hero', props: { nav_style: 'transparent' } },
  { label: 'Brand Accent', desc: 'Primary color bar', props: { nav_style: 'brand' } },
  { label: 'Centered Logo', desc: 'Logo centered, links below', props: { nav_style: 'centered' } },
  { label: 'Glass Blur', desc: 'Frosted glass effect', props: { nav_style: 'glass' } },
  { label: 'Elevated Shadow', desc: 'Floating bar with shadow', props: { nav_style: 'elevated' } },
  { label: 'Compact Minimal', desc: 'Slim height', props: { nav_style: 'compact' } },
  { label: 'Accent Border', desc: 'Brand underline', props: { nav_style: 'accent_border' } },
  { label: 'Shop Icons', desc: 'Search + cart + CTA', props: { nav_style: 'shop' } },
  { label: 'Dark Centered', desc: 'Dark + centered logo', props: { nav_style: 'dark_centered' } },
  { label: 'Transparent CTA', desc: 'Overlay nav in the navigation bar', props: { nav_style: 'transparent_cta' } },
]

/** Layout shell keys reset when switching nav presets. */
export const NAV_LAYOUT_SHELL_KEYS = [
  'nav_style',
  'nav_bg',
  'nav_layout',
  'nav_glass',
  'nav_elevated',
  'nav_compact',
  'nav_accent_border',
  'nav_cta_prominent',
  'show_search',
  'show_cart',
] as const

export function resolveNavLayout(
  props: Record<string, unknown>,
  fallback: FooterThemeFallback,
): Record<string, unknown> {
  const style = String(props.nav_style ?? 'white') as NavLayoutStyle
  const primary = fallback.primary_color || '#64C3A0'

  const base: Record<string, unknown> = {
    nav_style: style,
    nav_layout: 'default',
    nav_glass: false,
    nav_elevated: false,
    nav_compact: false,
    nav_accent_border: false,
    nav_cta_prominent: false,
    show_search: false,
    show_cart: false,
    nav_bg: '#ffffff',
  }

  switch (style) {
    case 'dark':
      return { ...base, nav_bg: '#0f172a' }
    case 'transparent':
      return { ...base, nav_bg: 'transparent' }
    case 'brand':
      return { ...base, nav_bg: primary }
    case 'centered':
      return { ...base, nav_layout: 'centered', nav_bg: '#ffffff' }
    case 'glass':
      return { ...base, nav_glass: true, nav_bg: 'rgba(255,255,255,0.75)' }
    case 'elevated':
      return { ...base, nav_elevated: true, nav_bg: '#ffffff' }
    case 'compact':
      return { ...base, nav_compact: true, nav_bg: '#ffffff' }
    case 'accent_border':
      return { ...base, nav_accent_border: true, nav_bg: '#ffffff' }
    case 'shop':
      return { ...base, show_search: true, show_cart: true, nav_bg: '#ffffff' }
    case 'dark_centered':
      return { ...base, nav_layout: 'centered', nav_bg: '#0f172a' }
    case 'transparent_cta':
      return { ...base, nav_bg: 'transparent', nav_cta_prominent: true }
    default:
      return base
  }
}

export function navLayoutIsDark(style: string, navBg: string): boolean {
  if (style === 'dark' || style === 'brand' || style === 'dark_centered') return true
  if (navBg === 'transparent') return false
  const hex = navBg.replace('#', '')
  if (hex.length < 6) return false
  const r = parseInt(hex.substring(0, 2), 16) || 255
  const g = parseInt(hex.substring(2, 4), 16) || 255
  const b = parseInt(hex.substring(4, 6), 16) || 255
  return r + g + b < 382
}
