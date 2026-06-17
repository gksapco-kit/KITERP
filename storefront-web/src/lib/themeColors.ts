/**
 * Theme color helpers + literal Tailwind class fragments for JIT.
 * ThemeProvider sets --color-primary, --color-secondary, --color-accent, --color-background on :root.
 */

/** Parse #RGB / #RRGGBB to 0–255 channels */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const t = hex.trim()
  const m = t.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const R = lin(r)
  const G = lin(g)
  const B = lin(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

/** Returns "H S% L%" for shadcn `hsl(var(--primary))` */
export function rgbToHslChannels(r: number, g: number, b: number): string {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      default:
        h = ((r - g) / d + 4) / 6
        break
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export function hexToHslChannels(hex: string): string | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return rgbToHslChannels(rgb.r, rgb.g, rgb.b)
}

/** Foreground on primary buttons (shadcn space-separated HSL) */
export function primaryForegroundHslForHex(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '0 0% 100%'
  return relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.55 ? '222 20% 12%' : '0 0% 100%'
}

export function textOnSolid(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#ffffff'
  return relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.55 ? '#0f172a' : '#ffffff'
}

export function contrastRatio(bgLum: number, fgLum: number): number {
  const lighter = Math.max(bgLum, fgLum)
  const darker = Math.min(bgLum, fgLum)
  return (lighter + 0.05) / (darker + 0.05)
}

function luminanceOfHex(hex: string): number | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return relativeLuminance(rgb.r, rgb.g, rgb.b)
}

const READABLE_DARK = '#0f172a'
const READABLE_LIGHT = '#f8fafc'

/** Pick the most readable text color on a given background (WCAG-oriented). */
export function readableTextOnBackground(bgHex: string, preferred?: string | null): string {
  const bgLum = luminanceOfHex(bgHex)
  if (bgLum == null) return preferred || READABLE_DARK

  const candidates = [preferred, READABLE_DARK, READABLE_LIGHT].filter(
    (c): c is string => typeof c === 'string' && Boolean(hexToRgb(c)),
  )

  let best = READABLE_DARK
  let bestRatio = 0
  for (const candidate of candidates) {
    const fgLum = luminanceOfHex(candidate)
    if (fgLum == null) continue
    const ratio = contrastRatio(bgLum, fgLum)
    if (ratio > bestRatio) {
      bestRatio = ratio
      best = candidate
    }
  }
  return best
}

/** Muted label color — still readable on the given background. */
export function mutedTextOnBackground(bgHex: string): string {
  const base = readableTextOnBackground(bgHex)
  const bgLum = luminanceOfHex(bgHex)
  const baseLum = luminanceOfHex(base)
  if (bgLum == null || baseLum == null) return '#64748b'
  // Prefer a mid-tone that keeps ≥ 3:1 on the surface
  const mutedCandidates = bgLum > 0.5
    ? ['#64748b', '#475569', '#334155', base]
    : ['#94a3b8', '#cbd5e1', base]
  let best = mutedCandidates[0]
  let bestRatio = 0
  for (const c of mutedCandidates) {
    const lum = luminanceOfHex(c)
    if (lum == null) continue
    const ratio = contrastRatio(bgLum, lum)
    if (ratio >= 3 && ratio > bestRatio) {
      bestRatio = ratio
      best = c
    }
  }
  return best
}

/** Blend two hex colors (mixPercent = amount of b, 0–100). */
export function mixHex(base: string, mix: string, mixPercent: number): string {
  const a = hexToRgb(base)
  const b = hexToRgb(mix)
  if (!a || !b) return base
  const t = Math.min(100, Math.max(0, mixPercent)) / 100
  const ch = (x: number, y: number) => Math.round(x * (1 - t) + y * t)
  const r = ch(a.r, b.r)
  const g = ch(a.g, b.g)
  const bl = ch(a.b, b.b)
  return `#${[r, g, bl].map(x => x.toString(16).padStart(2, '0')).join('')}`
}

function setHslVar(root: HTMLElement, name: string, hex: string): void {
  const hsl = hexToHslChannels(hex)
  if (hsl) root.style.setProperty(name, hsl)
}

/** Prefer secondary when primary is too light for links/prices on pale backgrounds. */
export function linkOnLight(primary: string, secondary: string): string {
  const rgb = hexToRgb(primary)
  if (!rgb) return secondary
  return relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.45 ? secondary : primary
}

function pickStyleHex(style: Record<string, unknown> | undefined, key: string): string | null {
  const v = style?.[key]
  return typeof v === 'string' && /^#[0-9A-Fa-f]{3,6}$/i.test(v) ? v : null
}

/** Push builder palette onto :root for catalog pages (cards vs page background). */
export function applyBuilderPaletteCssVars(
  colors: { primary: string; secondary: string; accent: string; background: string },
  siteStyle: Record<string, unknown> | undefined,
  template: string,
): void {
  const root = document.documentElement
  const surface = pickStyleHex(siteStyle, 'surface_color') || '#ffffff'
  const builderText = pickStyleHex(siteStyle, 'text_color') || colors.secondary
  const bgRgb = hexToRgb(colors.background)
  const bgIsDark = bgRgb ? relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b) < 0.42 : template === 'dark'

  const textOnSurface = readableTextOnBackground(surface, builderText)
  const textOnBg = readableTextOnBackground(colors.background, bgIsDark ? READABLE_LIGHT : builderText)
  const mutedOnSurface = mutedTextOnBackground(surface)
  const mutedOnBg = mutedTextOnBackground(colors.background)
  const onPrimary = textOnSolid(colors.primary)
  const accentOnSurface = (() => {
    const lum = luminanceOfHex(colors.accent)
    const surfLum = luminanceOfHex(surface)
    if (lum != null && surfLum != null && contrastRatio(surfLum, lum) >= 4.5) return colors.accent
    return textOnSurface
  })()
  const secondaryOnSurface = (() => {
    const lum = luminanceOfHex(colors.secondary)
    const surfLum = luminanceOfHex(surface)
    if (lum != null && surfLum != null && contrastRatio(surfLum, lum) >= 4.5) return colors.secondary
    return textOnSurface
  })()

  const mutedSurface = mixHex(surface, colors.primary, 10)
  const borderColor = mixHex(surface, colors.primary, 18)
  const inputColor = mixHex(surface, colors.primary, 22)
  const secondarySurface = mixHex(surface, colors.secondary, 12)
  const accentSurface = mixHex(surface, colors.accent, 14)

  root.style.setProperty('--color-primary', colors.primary)
  root.style.setProperty('--color-secondary', colors.secondary)
  root.style.setProperty('--color-accent', colors.accent)
  root.style.setProperty('--color-background', colors.background)
  root.style.setProperty('--color-surface', surface)
  root.style.setProperty('--color-text', textOnSurface)
  root.style.setProperty('--color-text-on-bg', textOnBg)
  root.style.setProperty('--color-text-muted', mutedOnSurface)
  root.style.setProperty('--color-text-muted-on-bg', mutedOnBg)
  root.style.setProperty('--color-on-primary', onPrimary)
  root.style.setProperty('--color-accent-text', accentOnSurface)
  root.style.setProperty('--color-secondary-text', secondaryOnSurface)
  root.style.setProperty('--color-on-surface', textOnSurface)

  // shadcn / Tailwind semantic tokens — always pair bg + foreground for contrast
  setHslVar(root, '--background', surface)
  setHslVar(root, '--foreground', textOnSurface)
  setHslVar(root, '--card', surface)
  setHslVar(root, '--card-foreground', textOnSurface)
  setHslVar(root, '--popover', surface)
  setHslVar(root, '--popover-foreground', textOnSurface)
  setHslVar(root, '--primary', colors.primary)
  setHslVar(root, '--primary-foreground', onPrimary)
  setHslVar(root, '--secondary', secondarySurface)
  setHslVar(root, '--secondary-foreground', readableTextOnBackground(secondarySurface, textOnSurface))
  setHslVar(root, '--muted', mutedSurface)
  setHslVar(root, '--muted-foreground', readableTextOnBackground(mutedSurface, mutedOnSurface))
  setHslVar(root, '--accent', accentSurface)
  setHslVar(root, '--accent-foreground', readableTextOnBackground(accentSurface, textOnSurface))
  setHslVar(root, '--border', borderColor)
  setHslVar(root, '--input', inputColor)
  setHslVar(root, '--ring', colors.primary)
}

/**
 * Literal Tailwind classes (picked up by JIT) using CSS vars from ThemeProvider.
 */
export const themeUi = {
  linkHover: 'hover:text-[color:var(--color-primary)] transition-colors',
  linkOnPage: 'text-[color:var(--color-text-on-bg)] hover:opacity-80 transition-opacity',
  pageText: 'text-[color:var(--color-text-on-bg)]',
  pageTextMuted: 'text-[color:var(--color-text-muted-on-bg)]',
  breadcrumbNav: 'text-sm flex items-center gap-1 text-[color:var(--color-text-muted-on-bg)]',
  breadcrumbCurrent: 'font-medium text-[color:var(--color-text-on-bg)]',
  catalogSurface: 'bg-[color:var(--color-surface)] text-[color:var(--color-on-surface)]',
  catalogGridCard:
    'group rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-lg bg-[color:var(--color-surface)] text-[color:var(--color-on-surface)] border-[color-mix(in_srgb,var(--color-primary)_18%,var(--color-surface))]',
  titleOnSurface: 'text-[color:var(--color-on-surface)]',
  priceOnSurface: 'font-bold text-[color:var(--color-on-surface)]',
  mutedOnSurface: 'text-[color:var(--color-text-muted)]',
  textPrimary: 'text-[color:var(--color-text)]',
  iconPrimary: 'text-[color:var(--color-primary)]',
  iconOnPage: 'text-[color:var(--color-text-on-bg)]',
  cardSurface: 'bg-[color:var(--color-surface)]',
  cardBorder: 'border-[color-mix(in_srgb,var(--color-primary)_18%,var(--color-surface))]',
  cardShadow: 'shadow-sm shadow-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]',
  pillPrimary:
    'bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-surface))] text-[color:var(--color-text)]',
  pillPrimaryHoverChip: 'hover:bg-[color-mix(in_srgb,var(--color-primary)_22%,var(--color-surface))]',
  pillSecondary:
    'bg-[color-mix(in_srgb,var(--color-secondary)_12%,var(--color-surface))] text-[color:var(--color-secondary-text)]',
  pillSecondaryHoverChip: 'hover:bg-[color-mix(in_srgb,var(--color-secondary)_22%,var(--color-surface))]',
  pillAccent:
    'bg-[color-mix(in_srgb,var(--color-accent)_14%,var(--color-surface))] text-[color:var(--color-accent-text)]',
  pillAccentBold: 'font-bold text-[color:var(--color-accent-text)] bg-[color-mix(in_srgb,var(--color-accent)_14%,var(--color-surface))]',
  borderPrimarySoft: 'border-[color-mix(in_srgb,var(--color-primary)_22%,var(--color-surface))]',
  borderPrimaryMuted: 'border-[color-mix(in_srgb,var(--color-primary)_14%,var(--color-surface))]',
  gradientHero:
    'bg-gradient-to-r from-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-surface))] to-[color-mix(in_srgb,var(--color-secondary)_12%,var(--color-surface))]',
  gradientHeroBr:
    'bg-gradient-to-br from-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-surface))] via-[color-mix(in_srgb,var(--color-secondary)_10%,var(--color-surface))] to-[color-mix(in_srgb,var(--color-primary)_8%,var(--color-surface))]',
  gradientDayOpen:
    'bg-gradient-to-b from-[color-mix(in_srgb,var(--color-primary)_16%,var(--color-surface))] to-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface))] border-[color-mix(in_srgb,var(--color-primary)_28%,var(--color-surface))] text-[color:var(--color-text)]',
  dayClosed:
    'bg-[color-mix(in_srgb,var(--color-secondary)_6%,var(--color-surface))] border-2 border-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-surface))] text-[color:var(--color-text-muted)]',
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-primary)_38%,transparent)]',
  focusRingInput:
    'focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] focus:border-[color:var(--color-primary)]',
  btnSolid: 'bg-[color:var(--color-primary)] hover:brightness-[0.93] text-[color:var(--color-on-primary)]',
  btnOutline:
    'border border-[color-mix(in_srgb,var(--color-primary)_22%,var(--color-surface))] bg-[color:var(--color-surface)] text-[color:var(--color-on-surface)] hover:bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--color-surface))]',
  btnOutlineActive:
    'bg-[color:var(--color-primary)] text-[color:var(--color-on-primary)] border-[color:var(--color-primary)] hover:brightness-[0.93]',
  btnGhost: 'text-[color:var(--color-on-surface)] hover:bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--color-surface))]',
  paginationBtn:
    'border border-[color-mix(in_srgb,var(--color-primary)_22%,var(--color-surface))] bg-[color:var(--color-surface)] text-[color:var(--color-on-surface)] hover:bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--color-surface))] disabled:opacity-50',
  paginationBtnActive:
    'bg-[color:var(--color-primary)] text-[color:var(--color-on-primary)] border-[color:var(--color-primary)] hover:brightness-[0.93]',
  shadowPrimarySoft: 'shadow-sm shadow-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]',
  planSelected:
    'border-[color:var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface))] shadow-sm',
  planHover: 'hover:border-[color-mix(in_srgb,var(--color-primary)_35%,var(--color-surface))]',
  textOnPrimaryMuted: 'text-[color-mix(in_srgb,var(--color-text)_75%,#64748b)]',
  textPrimaryStrong: 'text-[color:var(--color-text)]',
  textSecondaryTone: 'text-[color:var(--color-text-muted)]',
  iconPlaceholder: 'text-[color-mix(in_srgb,var(--color-secondary)_55%,#64748b)]',
  mutedLine: 'border-[color-mix(in_srgb,var(--color-primary)_22%,transparent)]',
  bgSoftPanel: 'bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface))]',
  bgSoftPanelBorder: 'border-[color-mix(in_srgb,var(--color-primary)_16%,var(--color-surface))]',
  bgBlueishPanel: 'bg-[color-mix(in_srgb,var(--color-primary)_11%,var(--color-surface))]',
  pillDuration:
    'text-xs font-semibold text-[color:var(--color-text)] bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-surface))] border border-[color-mix(in_srgb,var(--color-primary)_28%,var(--color-surface))]',
  dayChip: 'text-[11px] font-semibold bg-[color-mix(in_srgb,var(--color-primary)_16%,var(--color-surface))] text-[color:var(--color-text)]',
  accentRadio: 'accent-[color:var(--color-primary)]',
  groupHoverTitle: 'group-hover:text-[color:var(--color-primary)]',
  toggleActive: 'bg-[color:var(--color-surface)] text-[color:var(--color-text)] shadow-sm',
  trustIcon: 'text-[color:var(--color-primary)]',
  trustIconAccent: 'text-[color:var(--color-accent)]',
  inputSurface: 'bg-[color:var(--color-surface)] border-[color-mix(in_srgb,var(--color-primary)_16%,var(--color-surface))]',
} as const
