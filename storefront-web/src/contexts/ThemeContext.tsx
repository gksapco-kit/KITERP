import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useVendor } from './VendorContext'
import {
  hexToHslChannels,
  mergeColorsFromBuilderConfig,
  mergeFontsFromBuilderConfig,
  primaryForegroundHslForHex,
} from '@/lib/themeColors'

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
  template: 'hybrid',
  colors: { primary: '#2563eb', secondary: '#1e40af', accent: '#f59e0b', background: '#f9fafb' },
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const isHrPortal = /\/hr(\/|$)/.test(pathname)
  const { vendor } = useVendor()
  const themeConfig = vendor?.theme_config

  const theme: ThemeConfig = useMemo(() => {
    const raw = (themeConfig && typeof themeConfig === 'object' ? themeConfig : {}) as Record<string, unknown>
    const builderConfig = raw.builder_config
    const fromBuilderColors = mergeColorsFromBuilderConfig(builderConfig)
    const fromBuilderFonts = mergeFontsFromBuilderConfig(builderConfig)
    const base = {
      ...DEFAULT_THEME,
      ...raw,
      colors: {
        ...DEFAULT_THEME.colors,
        ...(raw.colors as Record<string, string> | undefined),
        ...fromBuilderColors,
      },
      sections: { ...DEFAULT_THEME.sections, ...(raw.sections as Record<string, boolean> | undefined) },
    }
    return {
      ...base,
      font: fromBuilderFonts.font ?? (raw as { font?: string }).font ?? DEFAULT_THEME.font,
      font_body:
        fromBuilderFonts.font_body ??
        (raw as { font_body?: string }).font_body ??
        fromBuilderFonts.font ??
        (raw as { font?: string }).font ??
        DEFAULT_THEME.font_body,
    }
  }, [themeConfig])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--color-primary', theme.colors.primary)
    root.style.setProperty('--color-secondary', theme.colors.secondary)
    root.style.setProperty('--color-accent', theme.colors.accent)
    root.style.setProperty('--color-background', theme.colors.background)
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

    document.body.style.backgroundColor = theme.colors.background

    const fontsToLoad = [...new Set([theme.font, theme.font_body].filter(f => f && f !== 'Inter' && GOOGLE_FONTS.includes(f)))]
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

    return () => {
      document.body.style.backgroundColor = ''
    }
  }, [
    isHrPortal,
    theme.colors.primary,
    theme.colors.secondary,
    theme.colors.accent,
    theme.colors.background,
    theme.font,
    theme.font_body,
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
