import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useVendor } from './VendorContext'
import { useBranch } from './BranchContext'
import { useBuilderSite } from './BuilderSiteContext'
import { mergeSiteStyleIntoTheme } from '@/lib/mergeSiteStyleIntoTheme'
import {
  applyBuilderPaletteCssVars,
  hexToHslChannels,
  primaryForegroundHslForHex,
} from '@/lib/themeColors'
import { normalizeStorefrontThemeConfig } from '@/lib/storefrontThemeConfig'
import { resolveAssignedStorefrontTemplateId } from '@/lib/storefrontTemplateAssignment'
import type { StoreLocation } from '@/api/store'

export interface ThemeConfig {
  template: string
  colors: { primary: string; secondary: string; accent: string; background: string }
  font: string
  font_body: string
  hero_style: string
  hero_title: string
  hero_subtitle: string
  hero_height: 'compact' | 'medium' | 'tall'
  hero_image_url: string
  product_layout: string
  product_detail_template: string
  card_style: 'default' | 'modern' | 'minimal'
  button_radius: 'sharp' | 'rounded' | 'pill'
  header_style: 'classic' | 'minimal' | 'centered' | 'transparent'
  sticky_header: boolean
  show_search: boolean
  footer_style: 'simple' | 'standard' | 'full'
  sections: Record<string, boolean>
  custom_announcement: string
}

const DEFAULT_THEME: ThemeConfig = {
  template: 'light',
  colors: { primary: '#64C3A0', secondary: '#13624A', accent: '#0891b2', background: '#f9fafb' },
  font: 'Inter',
  font_body: 'Inter',
  hero_style: 'gradient',
  hero_title: '',
  hero_subtitle: '',
  hero_height: 'medium',
  hero_image_url: '',
  product_layout: 'grid-4',
  product_detail_template: 'classic',
  card_style: 'default',
  button_radius: 'rounded',
  header_style: 'classic',
  sticky_header: true,
  show_search: true,
  footer_style: 'standard',
  sections: { hero: true, trust_badges: true, featured_products: true, featured_services: true, offers_banner: true, testimonials: false, cta: true },
  custom_announcement: '',
}

const ThemeContext = createContext<ThemeConfig>(DEFAULT_THEME)

const GOOGLE_FONTS = ['Inter', 'Poppins', 'DM Sans', 'Space Grotesk', 'Playfair Display', 'Roboto']

/** KITERP kit green — used in Employee HR portal instead of per-store business front blue */
export const KIT_BRAND_PRIMARY = '#64C3A0'

/** Same merge the live storefront uses: vendor theme_config + website style_config. */
export function resolveStorefrontTheme(input: {
  themeConfig?: unknown
  vendorSettings?: unknown
  branches?: StoreLocation[]
  branchCode?: string | null
  siteStyle?: Record<string, unknown>
}): ThemeConfig {
  const raw = normalizeStorefrontThemeConfig(
    input.themeConfig && typeof input.themeConfig === 'object'
      ? (input.themeConfig as Record<string, unknown>)
      : {},
  )
  const assignedTemplateId = resolveAssignedStorefrontTemplateId(
    input.vendorSettings as Record<string, unknown> | undefined,
    input.branches ?? [],
    input.branchCode ?? null,
  )
  const assignedTemplate =
    assignedTemplateId === 'dark' || assignedTemplateId === 'light'
      ? assignedTemplateId
      : assignedTemplateId === 'atelier' || assignedTemplateId === 'verde' || assignedTemplateId === 'solace'
        ? assignedTemplateId
        : null
  const base = {
    ...DEFAULT_THEME,
    ...raw,
    colors: {
      ...DEFAULT_THEME.colors,
      ...(raw.colors as Record<string, string> | undefined),
    },
    sections: { ...DEFAULT_THEME.sections, ...(raw.sections as Record<string, boolean> | undefined) },
  }
  const withVendor = {
    ...base,
    template: assignedTemplate ?? ((raw.template as string) === 'dark' ? 'dark' : 'light'),
    font: (raw as { font?: string }).font ?? DEFAULT_THEME.font,
    font_body:
      (raw as { font_body?: string }).font_body ??
      (raw as { font?: string }).font ??
      DEFAULT_THEME.font_body,
  }
  return mergeSiteStyleIntoTheme(withVendor, input.siteStyle)
}

/** Brand colors/fonts for catalog UI — works in the live storefront and the builder canvas. */
export function useResolvedStorefrontTheme(): ThemeConfig {
  const { vendor } = useVendor()
  const { branchCode, branches } = useBranch()
  const { builderSite } = useBuilderSite()
  const siteStyle = builderSite?.style_config as Record<string, unknown> | undefined
  return useMemo(
    () =>
      resolveStorefrontTheme({
        themeConfig: vendor?.theme_config,
        vendorSettings: vendor?.settings,
        branches,
        branchCode,
        siteStyle,
      }),
    [vendor?.theme_config, vendor?.settings, branches, branchCode, siteStyle],
  )
}

function loadThemeFonts(font: string, fontBody: string) {
  const fontsToLoad = [...new Set([font, fontBody].filter(f => f && f !== 'Inter' && GOOGLE_FONTS.includes(f)))]
  for (const f of fontsToLoad) {
    const id = `gfont-${f.replace(/\s+/g, '-')}`
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f)}:wght@400;500;600;700&display=swap`
      document.head.appendChild(link)
    }
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const isHrPortal = /\/hr(\/|$)/.test(pathname)
  const { builderSite } = useBuilderSite()
  const siteStyle = builderSite?.style_config as Record<string, unknown> | undefined
  const theme = useResolvedStorefrontTheme()

  useEffect(() => {
    applyBuilderPaletteCssVars(theme.colors, siteStyle, theme.template)

    const root = document.documentElement
    root.style.setProperty('--font-store', theme.font)
    root.style.setProperty('--font-body', theme.font_body || theme.font)

    const brandPrimary = isHrPortal ? KIT_BRAND_PRIMARY : theme.colors.primary
    const primaryHsl = hexToHslChannels(brandPrimary)
    if (primaryHsl) {
      const fg = primaryForegroundHslForHex(brandPrimary)
      root.style.setProperty('--primary', primaryHsl)
      root.style.setProperty('--primary-foreground', fg)
      root.style.setProperty('--ring', primaryHsl)
      root.style.setProperty('--sidebar-primary', primaryHsl)
      root.style.setProperty('--sidebar-primary-foreground', fg)
      root.style.setProperty('--sidebar-ring', primaryHsl)
    }

    const textOnBg = getComputedStyle(root).getPropertyValue('--color-text-on-bg').trim() || theme.colors.secondary
    document.body.style.backgroundColor = theme.colors.background
    document.body.style.color = textOnBg
    document.body.style.fontFamily = `"${theme.font_body || theme.font}", Inter, system-ui, sans-serif`
    loadThemeFonts(theme.font, theme.font_body)

    return () => {
      document.body.style.backgroundColor = ''
      document.body.style.color = ''
      document.body.style.fontFamily = ''
    }
  }, [
    isHrPortal,
    theme.template,
    theme.colors.primary,
    theme.colors.secondary,
    theme.colors.accent,
    theme.colors.background,
    theme.font,
    theme.font_body,
    siteStyle,
  ])

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

/**
 * Applies the live storefront palette on a wrapper (not document.root) so the
 * website builder canvas matches customer-facing colors without restyling vendor-web chrome.
 */
export function BuilderCanvasThemeScope({ children }: { children: ReactNode }) {
  const theme = useResolvedStorefrontTheme()
  const { builderSite } = useBuilderSite()
  const siteStyle = builderSite?.style_config as Record<string, unknown> | undefined
  const scopeRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = scopeRef.current
    if (!el) return
    applyBuilderPaletteCssVars(theme.colors, siteStyle, theme.template, el)
    const primaryHsl = hexToHslChannels(theme.colors.primary)
    if (primaryHsl) {
      const fg = primaryForegroundHslForHex(theme.colors.primary)
      el.style.setProperty('--primary', primaryHsl)
      el.style.setProperty('--primary-foreground', fg)
      el.style.setProperty('--ring', primaryHsl)
    }
    el.style.setProperty('--font-store', theme.font)
    el.style.setProperty('--font-body', theme.font_body || theme.font)
    el.style.fontFamily = `"${theme.font_body || theme.font}", Inter, system-ui, sans-serif`
    loadThemeFonts(theme.font, theme.font_body)
  }, [
    theme.template,
    theme.colors.primary,
    theme.colors.secondary,
    theme.colors.accent,
    theme.colors.background,
    theme.font,
    theme.font_body,
    siteStyle,
  ])

  return (
    <ThemeContext.Provider value={theme}>
      <div ref={scopeRef} data-storefront-theme-scope="" style={{ height: '100%' }}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
