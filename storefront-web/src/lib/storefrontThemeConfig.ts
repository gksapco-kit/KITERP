/** Client-side mirror of backend storefront_theme_config (legacy preset migration). */

const PRESET_LIGHT = {
  template: 'light',
  colors: {
    primary: '#64C3A0',
    secondary: '#13624A',
    accent: '#0891b2',
    background: '#f9fafb',
  },
  font: 'Inter',
  hero_style: 'gradient',
  product_layout: 'grid-4',
  sections: {
    hero: true,
    trust_badges: true,
    featured_products: true,
    featured_services: true,
    offers_banner: true,
    testimonials: false,
    cta: true,
  },
} as const

const PRESET_DARK = {
  template: 'dark',
  colors: {
    primary: '#64C3A0',
    secondary: '#1e293b',
    accent: '#38bdf8',
    background: '#0f172a',
  },
  font: 'Inter',
  hero_style: 'dark',
  product_layout: 'grid-4',
  sections: {
    hero: true,
    trust_badges: true,
    featured_products: true,
    featured_services: true,
    offers_banner: true,
    testimonials: false,
    cta: true,
  },
} as const

const LEGACY_TEMPLATE_IDS = new Set([
  'retail', 'service', 'hybrid', 'restaurant', 'electronics', 'fashion',
  'clinic', 'grocery', 'jewellery', 'laundry', 'medicine', 'food',
])

const VALID_TEMPLATE_IDS = new Set(['light', 'dark'])

const LEGACY_PRIMARY_COLORS = new Set([
  '#2563eb', '#0891b2', '#dc2626', '#1d4ed8', '#be185d', '#0d9488',
  '#16a34a', '#92400e', '#059669', '#ea580c', '#1e40af', '#155e75',
  '#991b1b', '#1e3a5f',
])

function usesLegacyPalette(raw: Record<string, unknown>): boolean {
  const tid = String(raw.template ?? '').trim()
  if (LEGACY_TEMPLATE_IDS.has(tid) || (tid && !VALID_TEMPLATE_IDS.has(tid))) return true
  const colors = raw.colors as Record<string, string> | undefined
  const primary = String(colors?.primary ?? '').trim().toLowerCase()
  return LEGACY_PRIMARY_COLORS.has(primary)
}

export function normalizeStorefrontThemeConfig(
  config: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const raw = config && typeof config === 'object' ? config : {}

  if (usesLegacyPalette(raw)) {
    return {
      ...raw,
      ...PRESET_LIGHT,
      colors: { ...PRESET_LIGHT.colors },
      sections: { ...PRESET_LIGHT.sections },
    }
  }

  const tid = String(raw.template ?? '').trim()

  if (tid === 'dark') {
    return {
      ...raw,
      template: 'dark',
      colors: {
        ...PRESET_DARK.colors,
        ...(raw.colors as Record<string, string> | undefined),
      },
      sections: {
        ...PRESET_DARK.sections,
        ...(raw.sections as Record<string, boolean> | undefined),
      },
      font: (raw.font as string | undefined) ?? PRESET_DARK.font,
      hero_style: (raw.hero_style as string | undefined) ?? PRESET_DARK.hero_style,
      product_layout: (raw.product_layout as string | undefined) ?? PRESET_DARK.product_layout,
    }
  }

  return {
    ...raw,
    template: 'light',
    colors: {
      ...PRESET_LIGHT.colors,
      ...(raw.colors as Record<string, string> | undefined),
    },
    sections: {
      ...PRESET_LIGHT.sections,
      ...(raw.sections as Record<string, boolean> | undefined),
    },
    font: (raw.font as string | undefined) ?? PRESET_LIGHT.font,
    hero_style: (raw.hero_style as string | undefined) ?? PRESET_LIGHT.hero_style,
    product_layout: (raw.product_layout as string | undefined) ?? PRESET_LIGHT.product_layout,
  }
}
