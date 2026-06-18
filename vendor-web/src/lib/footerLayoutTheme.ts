import type { BlockProps } from '@/types/websites'

export type FooterLayoutMode = 'columns' | 'minimal' | 'dark' | 'brand' | 'compact' | 'mega' | 'simple'

export interface FooterThemeFallback {
  text_color: string
  bg_color: string
  surface_color: string
  primary_color: string
}

export interface ResolvedFooterTheme {
  footerBg: string
  footerTitleColor: string
  footerLinkColor: string
  footerBorder: string
  layoutMode: FooterLayoutMode
  columnCount: number
  centered: boolean
  compact: boolean
  showNewsletter: boolean
  showSocial: boolean
}

const STYLE_DEFAULTS: Record<
  FooterLayoutMode,
  (fb: FooterThemeFallback) => Omit<ResolvedFooterTheme, 'layoutMode'>
> = {
  columns: (fb) => ({
    footerBg: fb.bg_color || fb.surface_color || '#ffffff',
    footerTitleColor: fb.text_color,
    footerLinkColor: fb.text_color,
    footerBorder: 'rgba(15, 23, 42, 0.12)',
    columnCount: 4,
    centered: false,
    compact: false,
    showNewsletter: false,
    showSocial: true,
  }),
  dark: () => ({
    footerBg: '#0f172a',
    footerTitleColor: '#f8fafc',
    footerLinkColor: '#94a3b8',
    footerBorder: '#334155',
    columnCount: 4,
    centered: false,
    compact: false,
    showNewsletter: false,
    showSocial: true,
  }),
  minimal: (fb) => ({
    footerBg: fb.surface_color || fb.bg_color || '#f8fafc',
    footerTitleColor: fb.text_color,
    footerLinkColor: '#64748b',
    footerBorder: '#e2e8f0',
    columnCount: 1,
    centered: true,
    compact: false,
    showNewsletter: false,
    showSocial: false,
  }),
  brand: (fb) => ({
    footerBg: fb.primary_color || '#13624A',
    footerTitleColor: '#ffffff',
    footerLinkColor: 'rgba(255,255,255,0.88)',
    footerBorder: 'rgba(255,255,255,0.22)',
    columnCount: 3,
    centered: false,
    compact: false,
    showNewsletter: false,
    showSocial: true,
  }),
  compact: (fb) => ({
    footerBg: fb.bg_color || '#ffffff',
    footerTitleColor: fb.text_color,
    footerLinkColor: '#64748b',
    footerBorder: '#e2e8f0',
    columnCount: 2,
    centered: false,
    compact: true,
    showNewsletter: false,
    showSocial: true,
  }),
  mega: (fb) => ({
    footerBg: fb.bg_color || '#ffffff',
    footerTitleColor: fb.text_color,
    footerLinkColor: fb.text_color,
    footerBorder: '#e2e8f0',
    columnCount: 4,
    centered: false,
    compact: false,
    showNewsletter: true,
    showSocial: true,
  }),
  simple: (fb) => ({
    footerBg: fb.bg_color || '#ffffff',
    footerTitleColor: fb.text_color,
    footerLinkColor: '#64748b',
    footerBorder: '#e2e8f0',
    columnCount: 0,
    centered: true,
    compact: true,
    showNewsletter: false,
    showSocial: false,
  }),
}

export function resolveFooterTheme(
  props: Record<string, unknown>,
  fallback: FooterThemeFallback,
): ResolvedFooterTheme {
  const raw = String(props.footer_style ?? 'columns') as FooterLayoutMode
  const layoutMode = STYLE_DEFAULTS[raw] ? raw : 'columns'
  const base = STYLE_DEFAULTS[layoutMode](fallback)

  return {
    layoutMode,
    footerBg: String(props.footer_bg ?? '').trim() || base.footerBg,
    footerTitleColor: String(props.footer_heading ?? '').trim() || base.footerTitleColor,
    footerLinkColor: String(props.footer_muted ?? '').trim() || base.footerLinkColor,
    footerBorder: String(props.footer_border ?? '').trim() || base.footerBorder,
    columnCount: Number(props.columns) > 0 ? Number(props.columns) : base.columnCount,
    centered: base.centered,
    compact: base.compact,
    showNewsletter: 'show_newsletter' in props ? props.show_newsletter === true : base.showNewsletter,
    showSocial: 'show_social' in props ? props.show_social !== false : base.showSocial,
  }
}

/** Canonical layout merge — see layoutBlockProps.ts */
export { mergeLayoutBlockProps } from '@/lib/layoutBlockProps'

/** Preset prop bundles for the section layout picker. */
export const FOOTER_LAYOUT_PRESETS = [
  {
    label: '4-Column Links',
    desc: 'Company, product, resources, and legal columns',
    props: {
      footer_style: 'columns',
      columns: 4,
      show_social: true,
      footer_bg: '#ffffff',
      footer_heading: '#111827',
      footer_muted: '#374151',
      footer_border: 'rgba(15, 23, 42, 0.12)',
    },
  },
  {
    label: 'Minimal Centered',
    desc: 'Logo, links, and copyright centered',
    props: {
      footer_style: 'minimal',
      columns: 1,
      show_social: false,
      footer_bg: '#f8fafc',
      footer_heading: '#111827',
      footer_muted: '#64748b',
      footer_border: '#e2e8f0',
    },
  },
  {
    label: 'Dark Premium',
    desc: 'Dark background with light link columns',
    props: {
      footer_style: 'dark',
      columns: 4,
      show_social: true,
      footer_bg: '#0f172a',
      footer_heading: '#f8fafc',
      footer_muted: '#94a3b8',
      footer_border: '#334155',
    },
  },
  {
    label: 'Brand Accent',
    desc: 'Primary brand color footer bar',
    props: {
      footer_style: 'brand',
      columns: 3,
      show_social: true,
      footer_heading: '#ffffff',
      footer_muted: 'rgba(255,255,255,0.88)',
      footer_border: 'rgba(255,255,255,0.22)',
    },
  },
  {
    label: 'Compact 2-Column',
    desc: 'Smaller footer with two link groups',
    props: {
      footer_style: 'compact',
      columns: 2,
      show_social: true,
      footer_bg: '#ffffff',
      footer_heading: '#111827',
      footer_muted: '#64748b',
      footer_border: '#e2e8f0',
    },
  },
  {
    label: 'Mega + Newsletter',
    desc: 'Four columns plus email signup row',
    props: {
      footer_style: 'mega',
      columns: 4,
      show_newsletter: true,
      show_social: true,
      footer_bg: '#ffffff',
      footer_heading: '#111827',
      footer_muted: '#374151',
      footer_border: '#e2e8f0',
    },
  },
  {
    label: 'Simple Link Row',
    desc: 'Single centered row of links and copyright',
    props: {
      footer_style: 'simple',
      columns: 0,
      show_social: false,
      footer_bg: '#ffffff',
      footer_heading: '#111827',
      footer_muted: '#64748b',
      footer_border: '#e2e8f0',
    },
  },
] as const
