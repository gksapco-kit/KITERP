export type BreakpointStyleKey = 'desktop' | 'tablet' | 'mobile'

export type ResolvedBlockStyleOverrides = {
  bg_color?: string
  text_color?: string
  padding_top?: number
  padding_bottom?: number
  section_scale?: number
  font_size?: string
}

export type BlockSectionSpacing = {
  paddingTop: number
  paddingBottom: number
  sectionScale: number
}

const BREAKPOINT_KEYS = new Set<BreakpointStyleKey>(['desktop', 'tablet', 'mobile'])

const TABLET_MEDIA = '@media (max-width: 1023px)'
const MOBILE_MEDIA = '@media (max-width: 767px)'

const FONT_SIZE_TAILWIND: Record<string, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
}

/** Default section padding when block props omit padding_top / padding_bottom. */
export const DEFAULT_CONTENT_SECTION_PADDING = 64

/** Blocks that manage their own vertical rhythm (no default section padding). */
const SECTION_PADDING_SHELL_BLOCKS = new Set([
  'nav',
  'announcement_bar',
  'spacer',
  'divider',
  'footer',
  'hero',
  'hero_split',
  'hero_minimal',
  'marquee_strip',
  'cookie_consent',
])

function defaultSectionPaddingForBlock(blockType: string | undefined): number {
  if (blockType && SECTION_PADDING_SHELL_BLOCKS.has(blockType)) return 0
  return DEFAULT_CONTENT_SECTION_PADDING
}

function readSectionPaddingValue(explicit: unknown, fallback: number): number {
  if (explicit !== undefined && explicit !== null && explicit !== '') {
    const n = Number(explicit)
    return Number.isFinite(n) ? Math.max(0, n) : fallback
  }
  return fallback
}

/** Raw overrides from block entity (or legacy mistaken props copy). */
export function readRawBlockStyleOverrides(block: {
  style_overrides?: Record<string, unknown>
  props?: Record<string, unknown>
}): Record<string, unknown> {
  const top = block.style_overrides
  if (top && Object.keys(top).length > 0) return top
  const fromProps = block.props?.style_overrides
  if (fromProps && typeof fromProps === 'object' && !Array.isArray(fromProps)) {
    return fromProps as Record<string, unknown>
  }
  return {}
}

export function isBreakpointNested(raw: Record<string, unknown>): boolean {
  for (const k of BREAKPOINT_KEYS) {
    const v = raw[k]
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) return true
  }
  return false
}

function clampSectionScale(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.min(2, Math.max(0.5, n))
}

function readSpacingLayer(layer: Record<string, unknown> | undefined): Partial<{
  padding_top: number
  padding_bottom: number
  section_scale: number
}> {
  if (!layer) return {}
  const out: Partial<{ padding_top: number; padding_bottom: number; section_scale: number }> = {}
  if (typeof layer.padding_top === 'number' && Number.isFinite(layer.padding_top)) {
    out.padding_top = layer.padding_top
  }
  if (typeof layer.padding_bottom === 'number' && Number.isFinite(layer.padding_bottom)) {
    out.padding_bottom = layer.padding_bottom
  }
  if (typeof layer.section_scale === 'number' && Number.isFinite(layer.section_scale)) {
    out.section_scale = layer.section_scale
  }
  return out
}

function layerHasSpacingKeys(layer: unknown): boolean {
  if (!layer || typeof layer !== 'object' || Array.isArray(layer)) return false
  const o = layer as Record<string, unknown>
  return o.padding_top !== undefined || o.padding_bottom !== undefined || o.section_scale !== undefined
}

/** Ensure desktop/tablet/mobile buckets exist; seed desktop from legacy flat overrides + props. */
export function ensureNestedStyleOverrides(
  block: { props?: Record<string, unknown> },
  raw: Record<string, unknown> = readRawBlockStyleOverrides(block),
): Record<BreakpointStyleKey, Record<string, unknown>> {
  if (isBreakpointNested(raw)) {
    return {
      desktop: { ...((raw.desktop as Record<string, unknown>) || {}) },
      tablet: { ...((raw.tablet as Record<string, unknown>) || {}) },
      mobile: { ...((raw.mobile as Record<string, unknown>) || {}) },
    }
  }

  const props = (block.props ?? {}) as Record<string, unknown>
  const desktop: Record<string, unknown> = { ...raw }
  if (desktop.padding_top === undefined && props.padding_top !== undefined) {
    desktop.padding_top = props.padding_top
  }
  if (desktop.padding_bottom === undefined && props.padding_bottom !== undefined) {
    desktop.padding_bottom = props.padding_bottom
  }
  if (desktop.section_scale === undefined && props.section_scale !== undefined) {
    desktop.section_scale = props.section_scale
  }
  return { desktop, tablet: {}, mobile: {} }
}

function mergeSpacingLayers(
  base: BlockSectionSpacing,
  layer: Partial<{ padding_top: number; padding_bottom: number; section_scale: number }>,
): BlockSectionSpacing {
  return {
    paddingTop: layer.padding_top ?? base.paddingTop,
    paddingBottom: layer.padding_bottom ?? base.paddingBottom,
    sectionScale: layer.section_scale !== undefined ? clampSectionScale(layer.section_scale) : base.sectionScale,
  }
}

/** Effective spacing for a breakpoint (tablet/mobile inherit unset values from larger breakpoints). */
export function resolveBlockSectionSpacing(
  block: {
    block_type?: string
    props?: Record<string, unknown>
    style_overrides?: Record<string, unknown>
  },
  breakpoint: BreakpointStyleKey = 'desktop',
): BlockSectionSpacing {
  const props = (block.props ?? {}) as Record<string, unknown>
  const raw = readRawBlockStyleOverrides(block)
  const defaultPad = defaultSectionPaddingForBlock(block.block_type)

  if (!isBreakpointNested(raw)) {
    const flat = resolveBreakpointStyleOverrides(raw, 'desktop')
    // block.props wins over flat style_overrides — avoids stale override zeros hiding
    // padding the canvas handles / Section Edit sliders just wrote to props.
    return {
      paddingTop: readSectionPaddingValue(props.padding_top ?? flat.padding_top, defaultPad),
      paddingBottom: readSectionPaddingValue(props.padding_bottom ?? flat.padding_bottom, defaultPad),
      sectionScale: clampSectionScale(props.section_scale ?? flat.section_scale ?? 1),
    }
  }

  const nested = ensureNestedStyleOverrides(block, raw)
  const desktopLayer = readSpacingLayer(nested.desktop)
  const tabletLayer = readSpacingLayer(nested.tablet)
  const mobileLayer = readSpacingLayer(nested.mobile)

  // Desktop: block.props wins over nested style_overrides (same rule as the flat path).
  const desktop: BlockSectionSpacing = {
    paddingTop: readSectionPaddingValue(
      props.padding_top ?? desktopLayer.padding_top,
      defaultPad,
    ),
    paddingBottom: readSectionPaddingValue(
      props.padding_bottom ?? desktopLayer.padding_bottom,
      defaultPad,
    ),
    sectionScale: clampSectionScale(
      props.section_scale ?? desktopLayer.section_scale ?? 1,
    ),
  }

  const tablet: BlockSectionSpacing = {
    paddingTop: tabletLayer.padding_top !== undefined
      ? readSectionPaddingValue(tabletLayer.padding_top, desktop.paddingTop)
      : desktop.paddingTop,
    paddingBottom: tabletLayer.padding_bottom !== undefined
      ? readSectionPaddingValue(tabletLayer.padding_bottom, desktop.paddingBottom)
      : desktop.paddingBottom,
    sectionScale: tabletLayer.section_scale !== undefined
      ? clampSectionScale(tabletLayer.section_scale)
      : desktop.sectionScale,
  }

  const mobile: BlockSectionSpacing = {
    paddingTop: mobileLayer.padding_top !== undefined
      ? readSectionPaddingValue(mobileLayer.padding_top, tablet.paddingTop)
      : tablet.paddingTop,
    paddingBottom: mobileLayer.padding_bottom !== undefined
      ? readSectionPaddingValue(mobileLayer.padding_bottom, tablet.paddingBottom)
      : tablet.paddingBottom,
    sectionScale: mobileLayer.section_scale !== undefined
      ? clampSectionScale(mobileLayer.section_scale)
      : tablet.sectionScale,
  }

  if (breakpoint === 'mobile') return mobile
  if (breakpoint === 'tablet') return tablet
  return desktop
}

/** Flatten breakpoint-nested overrides; desktop is the default in the builder panel. */
export function resolveBreakpointStyleOverrides(
  raw: Record<string, unknown> | null | undefined,
  breakpoint: BreakpointStyleKey = 'desktop',
): ResolvedBlockStyleOverrides {
  if (!raw || !Object.keys(raw).length) return {}
  const source = isBreakpointNested(raw)
    ? (raw[breakpoint] as Record<string, unknown> | undefined) || {}
    : raw
  const out: ResolvedBlockStyleOverrides = {}
  if (typeof source.bg_color === 'string' && source.bg_color) out.bg_color = source.bg_color
  if (typeof source.text_color === 'string' && source.text_color) out.text_color = source.text_color
  if (typeof source.font_size === 'string' && source.font_size) out.font_size = source.font_size
  if (typeof source.padding_top === 'number' && Number.isFinite(source.padding_top)) {
    out.padding_top = source.padding_top
  }
  if (typeof source.padding_bottom === 'number' && Number.isFinite(source.padding_bottom)) {
    out.padding_bottom = source.padding_bottom
  }
  if (typeof source.section_scale === 'number' && Number.isFinite(source.section_scale)) {
    out.section_scale = source.section_scale
  }
  return out
}

export function blockStyleFontSizeClass(fontSize: string | undefined): string | undefined {
  if (!fontSize || fontSize === 'base') return undefined
  return FONT_SIZE_TAILWIND[fontSize]
}

export function mergeBlockSectionStyles(
  props: Record<string, unknown>,
  overrides: ResolvedBlockStyleOverrides,
): {
  paddingTop: number
  paddingBottom: number
  backgroundColor?: string
  color?: string
  fontSizeClass?: string
} {
  const paddingTop = Number(
    overrides.padding_top ?? props.padding_top ?? 0,
  )
  const paddingBottom = Number(
    overrides.padding_bottom ?? props.padding_bottom ?? 0,
  )
  const bgFromProps = props.bg_color_override as string | undefined
  const textFromProps = props.text_color_override as string | undefined
  return {
    paddingTop: Number.isFinite(paddingTop) ? paddingTop : 0,
    paddingBottom: Number.isFinite(paddingBottom) ? paddingBottom : 0,
    backgroundColor: overrides.bg_color || bgFromProps,
    color: overrides.text_color || textFromProps,
    fontSizeClass: blockStyleFontSizeClass(overrides.font_size),
  }
}

/** Effective section padding — matches BlockRenderer (props + style_overrides). */
export function resolveBlockSectionPadding(
  block: { props?: Record<string, unknown>; style_overrides?: Record<string, unknown> },
  breakpoint: BreakpointStyleKey = 'desktop',
): { paddingTop: number; paddingBottom: number } {
  const { paddingTop, paddingBottom } = resolveBlockSectionSpacing(block, breakpoint)
  return { paddingTop, paddingBottom }
}

export function patchBreakpointSectionSpacing(
  block: { props?: Record<string, unknown>; style_overrides?: Record<string, unknown> },
  breakpoint: BreakpointStyleKey,
  patch: { padding_top?: number; padding_bottom?: number; section_scale?: number },
): { style_overrides: Record<string, unknown>; props?: Record<string, unknown> } {
  const nested = ensureNestedStyleOverrides(block)
  const nextLayer = { ...(nested[breakpoint] || {}), ...patch }
  const style_overrides: Record<string, unknown> = {
    ...nested,
    [breakpoint]: nextLayer,
  }

  const propsPatch: Record<string, unknown> = {}
  if (breakpoint === 'desktop') {
    if (patch.padding_top !== undefined) propsPatch.padding_top = patch.padding_top
    if (patch.padding_bottom !== undefined) propsPatch.padding_bottom = patch.padding_bottom
    if (patch.section_scale !== undefined) propsPatch.section_scale = patch.section_scale
  }

  return {
    style_overrides,
    ...(Object.keys(propsPatch).length ? { props: propsPatch } : {}),
  }
}

function spacingCssBlock(
  selector: string,
  zoomSelector: string,
  spacing: BlockSectionSpacing,
): string {
  let css = `${selector}{`
  if (spacing.paddingTop > 0) css += `padding-top:${spacing.paddingTop}px;`
  if (spacing.paddingBottom > 0) css += `padding-bottom:${spacing.paddingBottom}px;`
  css += '}'
  if (spacing.sectionScale !== 1) {
    css += `${zoomSelector}{zoom:${spacing.sectionScale};}`
  }
  return css
}

function spacingDiffers(a: BlockSectionSpacing, b: BlockSectionSpacing): boolean {
  return a.paddingTop !== b.paddingTop
    || a.paddingBottom !== b.paddingBottom
    || a.sectionScale !== b.sectionScale
}

/** Live-site CSS for per-breakpoint section padding + scale (empty when only desktop defaults apply). */
export function buildResponsiveSectionSpacingCss(
  sfBid: string,
  block: { props?: Record<string, unknown>; style_overrides?: Record<string, unknown> },
): string {
  const raw = readRawBlockStyleOverrides(block)
  if (!isBreakpointNested(raw)) return ''
  if (!layerHasSpacingKeys(raw.tablet) && !layerHasSpacingKeys(raw.mobile)) return ''

  const desktop = resolveBlockSectionSpacing(block, 'desktop')
  const tablet = resolveBlockSectionSpacing(block, 'tablet')
  const mobile = resolveBlockSectionSpacing(block, 'mobile')

  const selector = `[data-sf-bid="${sfBid}"]`
  const zoomSelector = `[data-sf-bid="${sfBid}"] .builder-block-zoom-wrap`

  let css = spacingCssBlock(selector, zoomSelector, desktop)
  if (spacingDiffers(tablet, desktop)) {
    css += `${TABLET_MEDIA}{${spacingCssBlock(selector, zoomSelector, tablet)}}`
  }
  if (spacingDiffers(mobile, tablet)) {
    css += `${MOBILE_MEDIA}{${spacingCssBlock(selector, zoomSelector, mobile)}}`
  }
  return css
}

function stripSpacingKeys(layer: Record<string, unknown>): Record<string, unknown> {
  const next = { ...layer }
  delete next.padding_top
  delete next.padding_bottom
  delete next.section_scale
  return next
}

/**
 * Remove padding from style_overrides so canvas / panel edits to block.props.padding_*
 * are not overridden by stale breakpoint padding (avoids "0px handle, 64px gap" bugs).
 */
export function stripSectionPaddingFromStyleOverrides(
  raw: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!raw || !Object.keys(raw).length) return {}
  if (isBreakpointNested(raw)) {
    const next: Record<string, unknown> = { ...raw }
    for (const bp of BREAKPOINT_KEYS) {
      const layer = raw[bp]
      if (layer && typeof layer === 'object' && !Array.isArray(layer)) {
        next[bp] = stripSpacingKeys(layer as Record<string, unknown>)
      }
    }
    return next
  }
  return stripSpacingKeys(raw)
}
