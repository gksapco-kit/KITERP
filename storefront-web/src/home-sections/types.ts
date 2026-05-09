/** Props bag for storefront home sections (builder + live store). */
export interface SectionProps {
  [key: string]: unknown
}

export interface HomeSectionThemeColors {
  primary: string
  secondary: string
  accent: string
  background: string
}

/** Fields read by shared Hero / menu sections (subset of ThemeConfig). */
export interface HomeSectionTheme {
  colors: HomeSectionThemeColors
  font: string
  font_body: string
  hero_style: string
  hero_title: string
  hero_subtitle: string
  hero_height: 'compact' | 'medium' | 'tall'
  hero_image_url: string
  button_radius: 'sharp' | 'rounded' | 'pill'
}

export type HomeSectionVendor = {
  display_name?: string | null
  business_name?: string | null
  description?: string | null
  banner_url?: string | null
} | null
