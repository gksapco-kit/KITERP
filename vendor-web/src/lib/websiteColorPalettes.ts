import type { StyleConfig } from '@/types/websites'
import { KIT_ERP_PALETTE } from '@/lib/kitErpColorPalette'

export type WebsiteColorPaletteId =
  | 'kit-mint'
  | 'kit-brand'
  | 'ocean-blue'
  | 'midnight'
  | 'coral-warm'
  | 'forest'
  | 'rose-glam'
  | 'steel-dark'
  | 'candy-pop'
  | 'custom'

export type WebsitePaletteColors = Pick<
  StyleConfig,
  'primary_color' | 'secondary_color' | 'accent_color' | 'bg_color' | 'surface_color' | 'text_color'
>

export type WebsiteColorPalette = {
  id: Exclude<WebsiteColorPaletteId, 'custom'>
  label: string
  description: string
  colors: WebsitePaletteColors
}

export const CUSTOM_WEBSITE_PALETTE_ID = 'custom' as const satisfies WebsiteColorPaletteId

export const DEFAULT_WEBSITE_COLOR_PALETTE_ID: Exclude<WebsiteColorPaletteId, 'custom'> = 'kit-mint'

export const WEBSITE_PALETTE_COLOR_FIELDS: { key: keyof WebsitePaletteColors; label: string }[] = [
  { key: 'primary_color', label: 'Primary' },
  { key: 'secondary_color', label: 'Secondary' },
  { key: 'accent_color', label: 'Accent' },
  { key: 'bg_color', label: 'Background' },
  { key: 'surface_color', label: 'Surface' },
  { key: 'text_color', label: 'Text' },
]

export const WEBSITE_COLOR_PALETTES: WebsiteColorPalette[] = [
  {
    id: 'kit-mint',
    label: 'KIT Mint',
    description: 'Brand green with warm amber accents — calm and familiar.',
    colors: {
      primary_color: '#64C3A0',
      secondary_color: '#13624A',
      accent_color: '#f59e0b',
      bg_color: '#f3fbf7',
      surface_color: '#ffffff',
      text_color: '#1e1b4b',
    },
  },
  {
    id: 'kit-brand',
    label: 'KIT Brand',
    description: 'Official KIT ERP palette — mint primary with purple & orange accents.',
    colors: {
      primary_color: KIT_ERP_PALETTE.primary,
      secondary_color: KIT_ERP_PALETTE.secondary,
      accent_color: KIT_ERP_PALETTE.accent,
      bg_color: KIT_ERP_PALETTE.background,
      surface_color: KIT_ERP_PALETTE.card,
      text_color: KIT_ERP_PALETTE.textPrimary,
    },
  },
  {
    id: 'ocean-blue',
    label: 'Ocean Blue',
    description: 'Crisp sky blues for a modern, trustworthy feel.',
    colors: {
      primary_color: '#0ea5e9',
      secondary_color: '#0369a1',
      accent_color: '#06b6d4',
      bg_color: '#f0f9ff',
      surface_color: '#ffffff',
      text_color: '#0c4a6e',
    },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep indigo on dark surfaces — bold and polished.',
    colors: {
      primary_color: '#6366f1',
      secondary_color: '#4338ca',
      accent_color: '#a78bfa',
      bg_color: '#0f172a',
      surface_color: '#1e293b',
      text_color: '#f1f5f9',
    },
  },
  {
    id: 'coral-warm',
    label: 'Coral Warm',
    description: 'Energetic orange tones for a friendly, inviting site.',
    colors: {
      primary_color: '#f97316',
      secondary_color: '#ea580c',
      accent_color: '#fbbf24',
      bg_color: '#fff7ed',
      surface_color: '#ffffff',
      text_color: '#431407',
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Natural greens with fresh, organic contrast.',
    colors: {
      primary_color: '#10b981',
      secondary_color: '#065f46',
      accent_color: '#34d399',
      bg_color: '#f0fdf4',
      surface_color: '#ffffff',
      text_color: '#064e3b',
    },
  },
  {
    id: 'rose-glam',
    label: 'Rose Glam',
    description: 'Soft rose accents with a premium boutique tone.',
    colors: {
      primary_color: '#e11d48',
      secondary_color: '#9f1239',
      accent_color: '#fb7185',
      bg_color: '#fff1f2',
      surface_color: '#ffffff',
      text_color: '#4c0519',
    },
  },
  {
    id: 'steel-dark',
    label: 'Steel Dark',
    description: 'Understated slate on dark backgrounds — minimal distraction.',
    colors: {
      primary_color: '#64748b',
      secondary_color: '#334155',
      accent_color: '#38bdf8',
      bg_color: '#1e293b',
      surface_color: '#334155',
      text_color: '#f8fafc',
    },
  },
  {
    id: 'candy-pop',
    label: 'Candy Pop',
    description: 'Vibrant fuchsia with playful energy.',
    colors: {
      primary_color: '#d946ef',
      secondary_color: '#a21caf',
      accent_color: '#f59e0b',
      bg_color: '#fdf4ff',
      surface_color: '#ffffff',
      text_color: '#4a044e',
    },
  },
]

export const DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS: WebsitePaletteColors = {
  ...WEBSITE_COLOR_PALETTES[0].colors,
}

/** Builder style panel presets — same palettes, `{ label, colors }` shape. */
export const SITE_THEME_PRESETS = WEBSITE_COLOR_PALETTES.map(({ label, colors }) => ({
  label,
  colors,
}))

export function getWebsiteColorPalette(
  id: Exclude<WebsiteColorPaletteId, 'custom'>,
): WebsiteColorPalette {
  return WEBSITE_COLOR_PALETTES.find(p => p.id === id) ?? WEBSITE_COLOR_PALETTES[0]
}

export function getWebsiteColorPaletteLabel(id: WebsiteColorPaletteId): string {
  if (id === CUSTOM_WEBSITE_PALETTE_ID) return 'Custom palette'
  return getWebsiteColorPalette(id).label
}

export function resolveWebsitePaletteColors(
  id: WebsiteColorPaletteId,
  customColors?: WebsitePaletteColors,
): WebsitePaletteColors {
  if (id === CUSTOM_WEBSITE_PALETTE_ID) {
    return customColors ?? DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS
  }
  return getWebsiteColorPalette(id).colors
}

const PALETTE_MATCH_KEYS: (keyof WebsitePaletteColors)[] = [
  'primary_color',
  'secondary_color',
  'accent_color',
  'bg_color',
  'surface_color',
  'text_color',
]

function normalizePaletteHex(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

/** Returns a preset id when all six palette colors match; otherwise null (custom). */
export function matchWebsiteColorPaletteId(
  style: Partial<WebsitePaletteColors>,
): Exclude<WebsiteColorPaletteId, 'custom'> | null {
  for (const palette of WEBSITE_COLOR_PALETTES) {
    const matches = PALETTE_MATCH_KEYS.every(
      key => normalizePaletteHex(style[key]) === normalizePaletteHex(palette.colors[key]),
    )
    if (matches) return palette.id
  }
  return null
}

export function getWebsitePaletteLabelFromColors(style: Partial<WebsitePaletteColors>): string {
  const id = matchWebsiteColorPaletteId(style)
  if (id) return getWebsiteColorPalette(id).label
  return 'Custom palette'
}
