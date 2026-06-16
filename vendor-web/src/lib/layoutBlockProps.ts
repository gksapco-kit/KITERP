import type { BlockProps } from '@/types/websites'
import { resolveFooterTheme, type FooterThemeFallback } from '@/lib/footerLayoutTheme'
import { NAV_LAYOUT_SHELL_KEYS, resolveNavLayout } from '@/lib/navLayoutTheme'

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
  'data_source',
])

/** Builder styling that should survive layout preset switches. */
const STYLE_PRESERVE_PROP_KEYS = new Set([
  'block_shadow', 'padding_top', 'padding_bottom', 'text_color_override', 'bg_color_override',
  'tile_bg', 'tile_accent', 'tile_text', 'tile_border', 'font_size_px', 'text_scale', 'text_transform',
  'top_shape', 'bottom_shape', 'shape_color', 'media_clip', 'min_height', 'item_gap', 'item_size', 'image_shape',
  'content_offset_x', 'content_offset_y',
  'content_flip_h', 'content_flip_v', 'content_rotate_deg',
  'section_flip_h', 'section_flip_v', 'section_rotate_deg',
])

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
  if (blockType === 'hero_minimal') {
    next.layout = 'minimal'
  } else if (blockType === 'hero_split') {
    const layout = String(next.layout ?? 'split')
    if (layout !== 'stacked' && layout !== 'overlap') {
      next.layout = 'split'
    }
  } else if (next.layout === 'split') {
    next.layout = 'split'
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

  for (const key of STYLE_PRESERVE_PROP_KEYS) {
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
    const nav = resolveNavLayout({ ...merged, ...propsOverride }, fallback)
    for (const key of NAV_LAYOUT_SHELL_KEYS) {
      merged[key] = nav[key]
    }
    return merged as BlockProps
  }

  if (blockType === 'about_split') {
    if (propsOverride.layout === 'overlay') {
      merged.image_position = merged.image_position ?? 'left'
    }
  }

  /** Layout preset keys always win over stale values from a previous layout. */
  const LAYOUT_SHELL_PROP_KEYS = [
    'layout', 'full_page', 'show_map', 'columns', 'bg_style', 'gradient_preset', 'overlay',
    'footer_style', 'nav_style', 'nav_bg', 'nav_layout', 'nav_glass', 'nav_elevated', 'nav_compact',
    'nav_accent_border', 'nav_cta_prominent', 'show_search', 'show_cart', 'image_position', 'card_style', 'filterable', 'compact',
    'variant', 'padding_top', 'padding_bottom', 'align', 'show_calendar', 'grayscale',
    'aspect_ratio', 'show_caption', 'show_newsletter', 'cta_square', 'eyebrow_plain',
    'item_gap', 'max_width', 'show_images', 'bg_color', 'show_annual_toggle', 'card_style',
    'image_shape', 'use_icons', 'show_numbers', 'item_gap', 'footer_bg', 'footer_heading', 'footer_muted', 'footer_border',
    'color', 'show_close', 'image_width', 'show_divider',
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

  // Preset override keys always win (layout picker selection).
  Object.assign(merged, propsOverride)

  if (blockType.includes('hero') && propsOverride.bg_style === 'minimal' && !('bg_color' in propsOverride)) {
    delete merged.bg_color
  }

  return merged as BlockProps
}
