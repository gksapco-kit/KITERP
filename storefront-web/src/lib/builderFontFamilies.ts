/**
 * Google / web fonts available in the website builder typography controls.
 * Includes every family used in website templates, business presets, home sections,
 * and storefront theme defaults (e.g. Instrument Serif for accent italic words).
 */
export const BUILDER_FONT_FAMILIES = [
  // Sans — body & UI (templates, presets, ThemeContext)
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Nunito',
  'Nunito Sans',
  'Source Sans Pro',
  'DM Sans',
  'Plus Jakarta Sans',
  'Manrope',
  'Outfit',
  'Poppins',
  'Montserrat',
  'Raleway',
  'Rubik',
  'Work Sans',
  'Quicksand',
  'Space Grotesk',
  'Sora',
  'Syne',

  // Serif — headings & editorial (Atelier, Pantry, restaurant, retail templates)
  'DM Serif Display',
  'Playfair Display',
  'Merriweather',
  'Lora',
  'Crimson Text',
  'Instrument Serif',
  'Fraunces',
  'Cormorant Garamond',
  'Libre Baskerville',
  'EB Garamond',
  'PT Serif',
  'Spectral',

  // Display / script accents
  'Caveat',
  'Bebas Neue',

  // System fallbacks
  'Georgia',
  'Times New Roman',
  'Arial',
  'Helvetica',
] as const

export type BuilderFontFamily = (typeof BUILDER_FONT_FAMILIES)[number]

const SYSTEM_FONTS = new Set(['Georgia', 'Times New Roman', 'Arial', 'Helvetica'])

/** Google Fonts CSS2 family specs (italics / optical size where templates need them). */
const GOOGLE_FONT_SPECS: Record<string, string> = {
  'Instrument Serif': 'Instrument+Serif:ital@0;1',
  'Fraunces':
    'Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,800;1,9..144,400',
  'Playfair Display': 'Playfair+Display:ital,wght@0,400;0,600;1,400;1,600',
  'DM Serif Display': 'DM+Serif+Display:ital@0;1',
  'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600',
  'Crimson Text': 'Crimson+Text:ital,wght@0,400;0,600;1,400',
  'Lora': 'Lora:ital,wght@0,400;0,600;1,400',
  'Merriweather': 'Merriweather:ital,wght@0,400;0,700;1,400',
  'Libre Baskerville': 'Libre+Baskerville:ital,wght@0,400;0,700;1,400',
  'EB Garamond': 'EB+Garamond:ital,wght@0,400;0,600;1,400',
  'PT Serif': 'PT+Serif:ital,wght@0,400;0,700;1,400',
  'Spectral': 'Spectral:ital,wght@0,400;0,600;1,400',
  'Caveat': 'Caveat:wght@400;600;700',
  'Bebas Neue': 'Bebas+Neue',
}

function googleFontStylesheetHref(fontFamily: string): string {
  const spec = GOOGLE_FONT_SPECS[fontFamily]
  if (spec) {
    return `https://fonts.googleapis.com/css2?family=${spec}&display=swap`
  }
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600;700&display=swap`
}

/** Load a Google Font stylesheet for canvas / builder preview. No-op for system fonts. */
export function ensureBuilderFontLoaded(fontFamily: string | null | undefined): void {
  const name = fontFamily?.trim()
  if (!name || SYSTEM_FONTS.has(name)) return
  if (typeof document === 'undefined') return

  const id = `builder-gfont-${name.replace(/\s+/g, '-')}`
  if (document.getElementById(id)) return

  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = googleFontStylesheetHref(name)
  document.head.appendChild(link)
}

export function normalizeFontFamily(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

/** Match a computed or stored font name to a builder list entry (or return the raw name). */
export function matchBuilderFontFamily(raw: string | null | undefined): string | null {
  const name = primaryFontFromComputed(raw) ?? normalizeFontFamily(raw)
  if (!name) return null
  const exact = BUILDER_FONT_FAMILIES.find(f => f === name)
  if (exact) return exact
  const lower = name.toLowerCase()
  const ci = BUILDER_FONT_FAMILIES.find(f => f.toLowerCase() === lower)
  return ci ?? name
}

/** First family name from a computed font-family stack. */
export function primaryFontFromComputed(computed: string | null | undefined): string | null {
  if (!computed) return null
  const first = computed.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '')
  return first || null
}
