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
  'Instrument Serif Italic',
  'Fraunces',
  'Cormorant Garamond',
  'Libre Baskerville',
  'EB Garamond',
  'PT Serif',
  'Spectral',

  // Serif italics — accent words & editorial emphasis
  'Baskerville Italic',
  'Libre Baskerville Italic',
  'Times New Roman Italic',
  'Georgia Italic',
  'Garamond Italic',
  'Palatino Italic',

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

/** Virtual italic picker entries → CSS stack + optional Google Font to preload. */
const ITALIC_FONT_STACKS: Record<
  string,
  { stack: string; loadFamily?: string }
> = {
  'Baskerville Italic': {
    stack: 'Baskerville, "Libre Baskerville", "Times New Roman", Times, serif',
    loadFamily: 'Libre Baskerville',
  },
  'Libre Baskerville Italic': {
    stack: '"Libre Baskerville", Baskerville, Georgia, serif',
    loadFamily: 'Libre Baskerville',
  },
  'Times New Roman Italic': {
    stack: '"Times New Roman", Times, Baskerville, serif',
  },
  'Georgia Italic': {
    stack: 'Georgia, "Times New Roman", Times, serif',
  },
  'Garamond Italic': {
    stack: 'Garamond, "EB Garamond", "Cormorant Garamond", Georgia, serif',
    loadFamily: 'EB Garamond',
  },
  'Palatino Italic': {
    stack: '"Palatino Linotype", Palatino, Georgia, serif',
  },
  'Instrument Serif Italic': {
    stack: '"Instrument Serif", Georgia, serif',
    loadFamily: 'Instrument Serif',
  },
}

export type BuilderFontResolved = {
  fontFamily: string
  fontStyle?: 'italic' | 'normal'
  loadFamily?: string
}

/** Resolve a stored builder font name to CSS font-family / font-style. */
export function resolveBuilderFont(value: string | null | undefined): BuilderFontResolved | null {
  const name = normalizeFontFamily(value)
  if (!name) return null
  const italic = ITALIC_FONT_STACKS[name]
  if (italic) {
    return {
      fontFamily: italic.stack,
      fontStyle: 'italic',
      loadFamily: italic.loadFamily,
    }
  }
  return { fontFamily: name }
}

/** Map computed font-family + style to a builder picker value (incl. virtual italic names). */
export function builderFontFromComputedStyle(
  computedFamily: string | null | undefined,
  fontStyle?: string | null,
): string | null {
  const primary = primaryFontFromComputed(computedFamily)
  if (!primary) return null
  const italic = fontStyle === 'italic' || fontStyle === 'oblique'

  if (italic) {
    for (const name of BUILDER_FONT_FAMILIES) {
      if (!name.endsWith(' Italic')) continue
      const resolved = resolveBuilderFont(name)
      if (!resolved?.fontFamily) continue
      const stackPrimary = primaryFontFromComputed(resolved.fontFamily)
      if (stackPrimary && stackPrimary.toLowerCase() === primary.toLowerCase()) {
        return name
      }
    }
    const genericItalic = `${primary} Italic`
    if ((BUILDER_FONT_FAMILIES as readonly string[]).includes(genericItalic)) {
      return genericItalic
    }
  }

  return matchBuilderFontFamily(primary)
}

/** Preview styles for font picker options (includes italic faces). */
export function builderFontPreviewStyle(fontFamily: string): { fontFamily: string; fontStyle?: string } {
  const resolved = resolveBuilderFont(fontFamily)
  if (!resolved) return { fontFamily }
  return {
    fontFamily: resolved.fontFamily,
    ...(resolved.fontStyle === 'italic' ? { fontStyle: 'italic' } : {}),
  }
}

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
  const resolved = resolveBuilderFont(fontFamily)
  const name = resolved?.loadFamily ?? normalizeFontFamily(fontFamily)
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

/** Preload fonts for the family picker menu (call when the menu opens). */
export function preloadBuilderFontPickerFonts(
  fonts: readonly string[] = BUILDER_FONT_FAMILIES,
): void {
  for (const font of fonts) {
    ensureBuilderFontLoaded(font)
  }
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
