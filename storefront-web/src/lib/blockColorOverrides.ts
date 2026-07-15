/** Block types whose cards respond to tile_* color overrides on the live storefront. */
export const TILE_COLOR_BLOCK_TYPES = new Set([
  'features',
  'features_alternating',
  'features_icons',
  'stats',
  'counters',
  'impact_stats',
  'pricing',
  'faq',
  'testimonials',
  'testimonials_grid',
  'product_reviews',
  'services_cards',
  'services_list',
  'product_grid',
  'category_cards',
  'product.categories',
  'product.grid',
  'product.carousel',
  'product.featured',
  'menu_grid',
  'related_products',
  'team_grid',
  'team_list',
  'blog_grid',
  'blog_list',
  'blog_featured',
])

export interface BlockColorProps {
  text_color_override?: string | null
  bg_color_override?: string | null
  tile_bg?: string | null
  tile_accent?: string | null
  tile_text?: string | null
  tile_border?: string | null
}

export interface ThemeColors {
  primary_color: string
  text_color: string
  surface_color?: string
  bg_color?: string
}

export function hasTileColorOverrides(props: BlockColorProps): boolean {
  return Boolean(props.tile_bg || props.tile_accent || props.tile_text || props.tile_border)
}

export function tileColorSwatch(
  value: string | null | undefined,
  fallback: string,
): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

/** Scoped CSS for per-block text, background, and card/tile color overrides. */
export function buildBlockColorStyleCss(
  bidAttr: 'data-bid' | 'data-sf-bid',
  bid: string,
  props: BlockColorProps,
  theme: ThemeColors,
  options?: { bgOverrideAppliesToContent?: boolean },
): string {
  const selector = `[${bidAttr}="${bid}"]`
  const rules: string[] = []

  if (props.text_color_override) {
    rules.push(`
      ${selector} h1, ${selector} h2, ${selector} h3, ${selector} h4,
      ${selector} p, ${selector} li, ${selector} blockquote,
      ${selector} span.block-text {
        color: ${props.text_color_override} !important;
      }
    `)
    if (!props.tile_text) {
      rules.push(`
        ${selector} .builder-tile-card h3,
        ${selector} .builder-tile-card h4,
        ${selector} .builder-tile-card .builder-tile-card-title {
          color: ${theme.text_color} !important;
        }
      `)
    }
  }

  if (props.bg_color_override) {
    if (options?.bgOverrideAppliesToContent) {
      rules.push(`
        ${selector} .builder-block-content > * {
          background-color: ${props.bg_color_override} !important;
          background-image: none !important;
        }
      `)
    } else {
      rules.push(`${selector} { background-color: ${props.bg_color_override} !important; }`)
    }
  }

  if (hasTileColorOverrides(props)) {
    const tileBg = props.tile_bg || theme.surface_color || theme.bg_color || '#ffffff'
    const tileText = props.tile_text || theme.text_color
    const tileAccent = props.tile_accent || theme.primary_color
    const tileBorder = props.tile_border || `${theme.primary_color}33`

    rules.push(`
      ${selector} .builder-tile-card {
        ${props.tile_bg ? `background-color: ${tileBg} !important;` : ''}
        ${props.tile_text ? `color: ${tileText} !important;` : ''}
        ${props.tile_border ? `border-color: ${tileBorder} !important;` : ''}
      }
      ${selector} .builder-tile-card h3,
      ${selector} .builder-tile-card h4,
      ${selector} .builder-tile-card .builder-tile-card-title,
      ${selector} .builder-tile-card .builder-tile-overlay-title,
      ${selector} .builder-tile-overlay-title {
        ${props.tile_text ? `color: ${tileText} !important;` : ''}
      }
      ${selector} .builder-tile-card p,
      ${selector} .builder-tile-card .builder-tile-card-desc,
      ${selector} .builder-tile-card .text-gray-500,
      ${selector} .builder-tile-card .text-gray-600 {
        ${props.tile_text ? `color: ${tileText}cc !important;` : ''}
      }
      ${selector} .builder-tile-top-accent {
        ${props.tile_accent ? `border-top-color: ${tileAccent} !important;` : ''}
      }
      ${selector} .builder-tile-accent {
        ${props.tile_accent ? `color: ${tileAccent} !important;` : ''}
      }
    `)
  }

  return rules.join('\n')
}
