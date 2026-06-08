/** Typography keys copied/applied by the format painter (Word-style). */
export const FORMAT_PAINT_STYLE_KEYS = [
  'font_size_px',
  'text_scale',
  'text_color_override',
  'font_family',
  'text_transform',
  'text_align',
  'vertical_align',
  'text_wrap',
  'line_height_ratio',
  'paragraph_space_before_px',
  'paragraph_space_after_px',
  'field_offset_x',
  'field_offset_y',
  'flip_h',
  'flip_v',
  'rotate_deg',
] as const

export type FormatPaintStyleKey = (typeof FORMAT_PAINT_STYLE_KEYS)[number]
export type FormatPaintStyle = Partial<Record<FormatPaintStyleKey, unknown>>

const CONTENT_GROUP_KEY = '__content_group__'

export function extractFormatPaintStyle(source: Record<string, unknown>): FormatPaintStyle {
  const out: FormatPaintStyle = {}
  for (const key of FORMAT_PAINT_STYLE_KEYS) {
    const val = source[key]
    if (val === undefined || val === null || val === '') continue
    if (typeof val === 'number' && val === 0 && (key === 'field_offset_x' || key === 'field_offset_y')) continue
    out[key] = val
  }
  return out
}

export function hasFormatPaintStyle(style: FormatPaintStyle): boolean {
  return Object.keys(style).length > 0
}

/** Merge block props with per-field `_field_styles` entry. */
export function mergeFieldTypographyRecord(
  blockProps: Record<string, unknown>,
  fieldKey: string | null | undefined,
): Record<string, unknown> {
  if (!fieldKey || fieldKey === CONTENT_GROUP_KEY) {
    return mapContentGroupToFormatRecord(blockProps)
  }
  const fieldStyles = (blockProps._field_styles as Record<string, Record<string, unknown>>) || {}
  return { ...blockProps, ...(fieldStyles[fieldKey] || {}) }
}

function mapContentGroupToFormatRecord(blockProps: Record<string, unknown>): Record<string, unknown> {
  return {
    field_offset_x: blockProps.content_offset_x,
    field_offset_y: blockProps.content_offset_y,
    flip_h: blockProps.content_flip_h,
    flip_v: blockProps.content_flip_v,
    rotate_deg: blockProps.content_rotate_deg,
  }
}

function mapFormatStyleToContentGroupPatch(style: FormatPaintStyle): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (style.field_offset_x !== undefined) patch.content_offset_x = style.field_offset_x
  if (style.field_offset_y !== undefined) patch.content_offset_y = style.field_offset_y
  if (style.flip_h !== undefined) patch.content_flip_h = style.flip_h
  if (style.flip_v !== undefined) patch.content_flip_v = style.flip_v
  if (style.rotate_deg !== undefined) patch.content_rotate_deg = style.rotate_deg
  return patch
}

/** Read partial-word / selection formatting from a live DOM range. */
export function extractFormatPaintStyleFromRange(range: Range): FormatPaintStyle {
  const out: FormatPaintStyle = {}
  let node: Node | null = range.startContainer
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
  while (node && node instanceof HTMLElement) {
    const cs = window.getComputedStyle(node)
    if (!out.font_size_px) {
      const px = parseFloat(cs.fontSize)
      if (Number.isFinite(px) && px > 0) out.font_size_px = Math.round(px)
    }
    if (!out.text_color_override) {
      const color = cs.color
      if (color && color !== 'rgba(0, 0, 0, 0)') out.text_color_override = color
    }
    if (!out.text_transform && cs.textTransform && cs.textTransform !== 'none') {
      out.text_transform = cs.textTransform
    }
    if (!out.font_family) {
      const ff = cs.fontFamily
      if (ff) {
        const primary = ff.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '')
        if (primary) out.font_family = primary
      }
    }
    if (node.getAttribute('data-inline-style') === 'true') break
    node = node.parentElement
  }
  return out
}

export function resolveFormatPaintStyle(input: {
  blockProps: Record<string, unknown>
  fieldKey?: string | null
  selectionRange?: Range | null
  computed?: FormatPaintStyle | null
}): FormatPaintStyle {
  if (input.selectionRange && !input.selectionRange.collapsed) {
    const fromSelection = extractFormatPaintStyleFromRange(input.selectionRange)
    if (hasFormatPaintStyle(fromSelection)) return fromSelection
  }

  const merged = mergeFieldTypographyRecord(input.blockProps, input.fieldKey)
  let style = extractFormatPaintStyle(merged)
  if (hasFormatPaintStyle(style)) return style

  if (input.computed && hasFormatPaintStyle(input.computed)) {
    style = { ...style, ...input.computed }
    return extractFormatPaintStyle({ ...merged, ...style })
  }

  return style
}

export function buildFormatPaintPropsPatch(
  blockProps: Record<string, unknown>,
  fieldKey: string | null,
  style: FormatPaintStyle,
): Record<string, unknown> {
  if (!hasFormatPaintStyle(style)) return {}

  if (fieldKey === CONTENT_GROUP_KEY) {
    return mapFormatStyleToContentGroupPatch(style)
  }

  if (fieldKey) {
    const fieldStyles = (blockProps._field_styles as Record<string, Record<string, unknown>>) || {}
    const layoutOnly = extractFormatPaintStyle(style)
    return {
      _field_styles: {
        ...fieldStyles,
        [fieldKey]: {
          ...(fieldStyles[fieldKey] || {}),
          ...layoutOnly,
        },
      },
    }
  }

  return { ...style }
}

export function formatPaintStyleSummary(style: FormatPaintStyle): string {
  const parts: string[] = []
  if (typeof style.font_size_px === 'number' && style.font_size_px > 0) {
    parts.push(`${Math.round(style.font_size_px)}px`)
  } else if (typeof style.text_scale === 'number' && style.text_scale !== 1) {
    parts.push(`${style.text_scale}×`)
  }
  if (typeof style.text_color_override === 'string') parts.push('color')
  if (typeof style.font_family === 'string') parts.push(String(style.font_family))
  if (style.text_align === 'left' || style.text_align === 'center' || style.text_align === 'right') {
    parts.push(String(style.text_align))
  }
  if (typeof style.text_transform === 'string') parts.push(String(style.text_transform))
  if (style.vertical_align === 'top' || style.vertical_align === 'middle' || style.vertical_align === 'bottom') {
    parts.push(`v-${style.vertical_align}`)
  }
  if (style.text_wrap === true) parts.push('wrap')
  if (style.text_wrap === false) parts.push('no-wrap')
  if (typeof style.line_height_ratio === 'number' && style.line_height_ratio > 0) {
    parts.push(`lh ${style.line_height_ratio}`)
  }
  return parts.length ? parts.join(' · ') : 'formatting'
}
