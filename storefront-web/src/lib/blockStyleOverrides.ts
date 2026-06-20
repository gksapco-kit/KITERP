export type BreakpointStyleKey = 'desktop' | 'tablet' | 'mobile'

export type ResolvedBlockStyleOverrides = {
  bg_color?: string
  text_color?: string
  padding_top?: number
  padding_bottom?: number
  font_size?: string
}

const BREAKPOINT_KEYS = new Set<BreakpointStyleKey>(['desktop', 'tablet', 'mobile'])

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

function isBreakpointNested(raw: Record<string, unknown>): boolean {
  for (const k of BREAKPOINT_KEYS) {
    const v = raw[k]
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) return true
  }
  return false
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
  const props = (block.props ?? {}) as Record<string, unknown>
  const overrides = resolveBreakpointStyleOverrides(readRawBlockStyleOverrides(block), breakpoint)
  const { paddingTop, paddingBottom } = mergeBlockSectionStyles(props, overrides)
  return { paddingTop, paddingBottom }
}

function stripPaddingKeys(layer: Record<string, unknown>): Record<string, unknown> {
  const next = { ...layer }
  delete next.padding_top
  delete next.padding_bottom
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
        next[bp] = stripPaddingKeys(layer as Record<string, unknown>)
      }
    }
    return next
  }
  return stripPaddingKeys(raw)
}
