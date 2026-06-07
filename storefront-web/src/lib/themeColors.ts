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

/**
 * Literal Tailwind classes (picked up by JIT) using CSS vars from ThemeProvider.
 */
export const themeUi = {
  linkHover: 'hover:text-[color:var(--color-primary)] transition-colors',
  textPrimary: 'text-[color:var(--color-primary)]',
  iconPrimary: 'text-[color:var(--color-primary)]',
  pillPrimary:
    'bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] text-[color:var(--color-primary)]',
  pillPrimaryHoverChip: 'hover:bg-[color-mix(in_srgb,var(--color-primary)_22%,white)]',
  pillSecondary:
    'bg-[color-mix(in_srgb,var(--color-secondary)_12%,white)] text-[color:var(--color-secondary)]',
  pillSecondaryHoverChip: 'hover:bg-[color-mix(in_srgb,var(--color-secondary)_22%,white)]',
  pillAccent:
    'bg-[color-mix(in_srgb,var(--color-accent)_14%,white)] text-[color:var(--color-accent)]',
  pillAccentBold: 'font-bold text-[color:var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_14%,white)]',
  borderPrimarySoft: 'border-[color-mix(in_srgb,var(--color-primary)_22%,white)]',
  borderPrimaryMuted: 'border-[color-mix(in_srgb,var(--color-primary)_14%,white)]',
  gradientHero:
    'bg-gradient-to-r from-[color-mix(in_srgb,var(--color-primary)_12%,white)] to-[color-mix(in_srgb,var(--color-secondary)_12%,white)]',
  gradientHeroBr:
    'bg-gradient-to-br from-[color-mix(in_srgb,var(--color-primary)_12%,white)] via-[color-mix(in_srgb,var(--color-secondary)_10%,white)] to-[color-mix(in_srgb,var(--color-primary)_8%,white)]',
  gradientDayOpen:
    'bg-gradient-to-b from-[color-mix(in_srgb,var(--color-primary)_14%,white)] to-[color-mix(in_srgb,var(--color-primary)_8%,white)] border-[color-mix(in_srgb,var(--color-primary)_28%,white)] text-[color:var(--color-primary)]',
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-primary)_38%,transparent)]',
  focusRingInput:
    'focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] focus:border-[color:var(--color-primary)]',
  btnSolid: 'bg-[color:var(--color-primary)] hover:brightness-[0.93] text-white',
  shadowPrimarySoft: 'shadow-sm shadow-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]',
  planSelected:
    'border-[color:var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_10%,white)] shadow-sm',
  planHover: 'hover:border-[color-mix(in_srgb,var(--color-primary)_35%,white)]',
  textOnPrimaryMuted: 'text-[color-mix(in_srgb,var(--color-primary)_65%,#1e293b)]',
  textPrimaryStrong: 'text-[color:var(--color-primary)]',
  textSecondaryTone: 'text-[color-mix(in_srgb,var(--color-primary)_45%,#64748b)]',
  iconPlaceholder: 'text-[color-mix(in_srgb,var(--color-primary)_35%,white)]',
  mutedLine: 'border-[color-mix(in_srgb,var(--color-primary)_22%,transparent)]',
  bgSoftPanel: 'bg-[color-mix(in_srgb,var(--color-primary)_10%,white)]',
  bgSoftPanelBorder: 'border-[color-mix(in_srgb,var(--color-primary)_16%,white)]',
  bgBlueishPanel: 'bg-[color-mix(in_srgb,var(--color-primary)_11%,white)]',
  pillDuration:
    'text-xs font-semibold text-[color:var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] border border-[color-mix(in_srgb,var(--color-primary)_28%,white)]',
  dayChip: 'text-[11px] font-semibold bg-[color-mix(in_srgb,var(--color-primary)_16%,white)] text-[color:var(--color-primary)]',
  accentRadio: 'accent-[color:var(--color-primary)]',
  groupHoverTitle: 'group-hover:text-[color:var(--color-primary)]',
  toggleActive: 'bg-white text-[color:var(--color-primary)] shadow-sm',
} as const
