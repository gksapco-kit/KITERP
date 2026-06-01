import type { BlockProps } from '@/types/websites'
import { resolveFooterTheme, type FooterThemeFallback } from '@/lib/footerLayoutTheme'

/** User-editable content preserved when switching layouts. */
const CONTENT_PROP_KEYS = new Set([
  'headline', 'subtitle', 'headline_line2', 'title', 'description', 'eyebrow', 'content', 'tagline',
  'copyright', 'brand', 'brand_logo', 'nav_links', 'cta_label', 'cta_primary', 'cta_secondary',
  'cta_url', 'cta_primary_url', 'cta_secondary_url', 'email', 'phone', 'address',
  'features', 'testimonials', 'members', 'plans', 'faqs', 'stats', 'footer_columns',
  'social_links', 'form_fields', 'items', 'categories', 'posts', 'projects',
  'logos', '_field_styles', 'video_url', 'form_hint', 'submit_label',
  'show_legal', 'show_credit_card_note', 'service_name', 'target_date', 'html', 'text',
  'plans', 'messages', 'links', 'menu_categories', 'products', 'hidden_kpi_ids',
])

function resolveNavTheme(props: Record<string, unknown>, fallback: FooterThemeFallback) {
  const style = String(props.nav_style ?? 'white')
  if (style === 'dark') {
    return { nav_style: 'dark', nav_bg: '#0f172a' }
  }
  if (style === 'transparent') {
    return { nav_style: 'transparent', nav_bg: 'transparent' }
  }
  if (style === 'brand') {
    return { nav_style: 'brand', nav_bg: fallback.primary_color || '#64C3A0' }
  }
  return { nav_style: 'white', nav_bg: '#ffffff' }
}

function normalizeFeaturesLayout(props: Record<string, unknown>): Record<string, unknown> {
  const layout = String(props.layout ?? '')
  const next = { ...props }
  if (layout === 'grid-2' || layout === 'grid-3' || layout === 'grid-4') {
    next.columns = Number(layout.split('-')[1]) || next.columns || 3
  } else if (layout === 'list') {
    next.columns = 1
  }
  return next
}

function normalizeHeroLayout(props: Record<string, unknown>, blockType: string): Record<string, unknown> {
  const next = { ...props }
  if (blockType === 'hero_split' || next.layout === 'split') {
    next.layout = 'split'
  }
  if (blockType === 'hero_minimal') {
    next.layout = 'minimal'
  }
  if (next.bg_style === 'solid' && !next.bg_color) {
    next.bg_color = '#0f172a'
  }
  return next
}

/**
 * Build props for a layout switch: preset style wins, user content is preserved.
 */
export function mergeLayoutBlockProps(
  blockType: string,
  defaultProps: BlockProps,
  existingProps: BlockProps | undefined,
  propsOverride: Partial<BlockProps>,
  fallback: FooterThemeFallback,
): BlockProps {
  const layoutShell = { ...defaultProps, ...propsOverride } as Record<string, unknown>
  const existing = (existingProps || {}) as Record<string, unknown>
  const merged: Record<string, unknown> = { ...layoutShell }

  for (const key of CONTENT_PROP_KEYS) {
    const val = existing[key]
    if (val !== undefined && val !== null && val !== '') {
      merged[key] = val
    }
  }

  if (blockType.includes('hero')) {
    Object.assign(merged, normalizeHeroLayout(merged, blockType))
  }

  if (blockType === 'features' || blockType === 'services_cards' || blockType === 'services_list') {
    Object.assign(merged, normalizeFeaturesLayout(merged))
  }

  if (blockType === 'footer') {
    for (const key of ['footer_style', 'footer_bg', 'footer_heading', 'footer_muted', 'footer_border', 'columns', 'show_newsletter'] as const) {
      if (key in layoutShell) merged[key] = layoutShell[key]
    }
    const theme = resolveFooterTheme({ ...layoutShell, ...propsOverride }, fallback)
    return {
      ...merged,
      footer_style: theme.layoutMode,
      footer_bg: theme.footerBg,
      footer_heading: theme.footerTitleColor,
      footer_muted: theme.footerLinkColor,
      footer_border: theme.footerBorder,
      columns: theme.columnCount,
      show_newsletter: theme.showNewsletter,
    } as BlockProps
  }

  if (blockType === 'nav') {
    const nav = resolveNavTheme({ ...merged, ...propsOverride }, fallback)
    return { ...merged, ...nav } as BlockProps
  }

  if (blockType === 'about_split') {
    if (propsOverride.layout === 'overlay') {
      merged.image_position = merged.image_position ?? 'left'
    }
  }

  /** Layout preset keys always win over stale values from a previous layout. */
  const LAYOUT_SHELL_PROP_KEYS = [
    'layout', 'full_page', 'show_map', 'columns', 'bg_style', 'gradient_preset', 'overlay',
    'footer_style', 'nav_style', 'image_position', 'card_style', 'filterable', 'compact',
    'variant', 'padding_top', 'padding_bottom', 'align', 'show_calendar', 'grayscale',
    'aspect_ratio', 'show_caption', 'show_newsletter', 'cta_square', 'eyebrow_plain',
    'item_gap', 'max_width', 'show_images', 'bg_color', 'show_annual_toggle', 'card_style',
    'image_shape', 'footer_bg', 'footer_heading', 'footer_muted', 'footer_border',
    'color', 'show_close',
  ] as const
  for (const key of LAYOUT_SHELL_PROP_KEYS) {
    if (key in layoutShell) merged[key] = layoutShell[key]
  }

  if (blockType.includes('gallery') || blockType === 'portfolio_grid') {
    const layout = String(merged.layout ?? 'grid')
    if (layout === 'masonry') {
      merged.columns = merged.columns ?? 3
    } else if (layout === 'featured') {
      merged.columns = merged.columns ?? 3
    } else if (layout === 'grid' && !merged.columns) {
      merged.columns = 4
    }
  }

  return merged as BlockProps
}
