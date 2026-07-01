/**
 * Official KIT ERP vendor-web color palette (see docs/kiterp-vendor-web-color-palette.png).
 * Hex values are the source of truth; HSL tuples feed CSS custom properties in globals.css.
 */
export const KIT_ERP_PALETTE = {
  primary: '#64C3A0',
  secondary: '#6F5AE8',
  accent: '#FF8A3D',
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#DC2626',
  background: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E5E7EB',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
} as const

/** HSL components (no hsl() wrapper) for Tailwind / CSS variables — used by the kit-brand theme. */
export const KIT_ERP_PALETTE_HSL = {
  primary: '158 44% 58%',
  secondary: '249 76% 63%',
  accent: '25 100% 62%',
  success: '142 76% 36%',
  warning: '38 92% 50%',
  error: '0 72% 51%',
  background: '210 40% 98%',
  card: '0 0% 100%',
  border: '220 14% 91%',
  textPrimary: '215 28% 17%',
  textSecondary: '220 9% 46%',
  /** Light purple wash — secondary button / chip backgrounds (mint theme). */
  secondaryMuted: '249 80% 95%',
  secondaryMutedForeground: '249 55% 42%',
  /** Light mint wash — row hover / subtle highlight (keeps orange for brand-accent). */
  accentMuted: '158 32% 93%',
  accentMutedForeground: '158 30% 17%',
} as const
