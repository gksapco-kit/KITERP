import {
  builderFontFromComputedStyle,
  ensureBuilderFontLoaded,
  resolveBuilderFont,
} from '@storefront/lib/builderFontFamilies'

/** Typography keys copied/applied by the format painter (Word-style). */
export const FORMAT_PAINT_STYLE_KEYS = [
  'font_size_px',
  'text_scale',
  'text_color_override',
  'field_bg_color',
  'field_border_color',
  'font_family',
  'font_style',
  'font_weight',
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

/** Read live computed typography from a DOM element (inline span or field root). */
export function extractFormatPaintStyleFromElement(el: HTMLElement): FormatPaintStyle {
  const cs = window.getComputedStyle(el)
  const out: FormatPaintStyle = {}
  const px = parseFloat(cs.fontSize)
  if (Number.isFinite(px) && px > 0) out.font_size_px = Math.round(px)
  const color = cs.color
  if (color && color !== 'rgba(0, 0, 0, 0)') out.text_color_override = color
  if (cs.textTransform && cs.textTransform !== 'none') out.text_transform = cs.textTransform
  const fontName = builderFontFromComputedStyle(cs.fontFamily, cs.fontStyle)
  if (fontName) {
    out.font_family = fontName
    const resolved = resolveBuilderFont(fontName)
    if (
      (cs.fontStyle === 'italic' || cs.fontStyle === 'oblique')
      && !resolved?.fontStyle
      && !String(fontName).endsWith(' Italic')
    ) {
      out.font_style = 'italic'
    }
  }
  const fw = cs.fontWeight
  const fwNum = parseInt(fw, 10)
  if (fw === 'bold' || fw === 'bolder' || (Number.isFinite(fwNum) && fwNum >= 600)) {
    out.font_weight = 'bold'
  }
  const ta = cs.textAlign
  if (ta === 'left' || ta === 'center' || ta === 'right' || ta === 'justify' || ta === 'start' || ta === 'end') {
    out.text_align = ta === 'start' ? 'left' : ta === 'end' ? 'right' : ta
  }
  const lh = parseFloat(cs.lineHeight)
  const fs = parseFloat(cs.fontSize)
  if (Number.isFinite(lh) && Number.isFinite(fs) && fs > 0 && lh > 0) {
    const ratio = Math.round((lh / fs) * 100) / 100
    if (ratio > 0 && Math.abs(ratio - 1) > 0.05) out.line_height_ratio = ratio
  }
  if (cs.whiteSpace === 'nowrap') out.text_wrap = false
  else if (cs.whiteSpace === 'pre-wrap') out.text_wrap = true
  return out
}

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

const SECTION_TYPOGRAPHY_FALLBACK_KEYS: FormatPaintStyleKey[] = [
  'font_size_px',
  'text_scale',
  'text_color_override',
  'font_family',
  'font_style',
  'font_weight',
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
]

/** Merge per-field `_field_styles` with section-level typography fallbacks (not whole block props). */
export function mergeFieldTypographyRecord(
  blockProps: Record<string, unknown>,
  fieldKey: string | null | undefined,
): Record<string, unknown> {
  if (!fieldKey || fieldKey === CONTENT_GROUP_KEY) {
    return mapContentGroupToFormatRecord(blockProps)
  }
  const fieldStyles = (blockProps._field_styles as Record<string, Record<string, unknown>>) || {}
  const fieldEntry = fieldStyles[fieldKey] || {}
  const sectionFallback: Record<string, unknown> = {}
  for (const key of SECTION_TYPOGRAPHY_FALLBACK_KEYS) {
    if (fieldEntry[key] != null && fieldEntry[key] !== '') continue
    const v = blockProps[key]
    if (v != null && v !== '') sectionFallback[key] = v
  }
  return { ...sectionFallback, ...fieldEntry }
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
  let node: Node | null = range.startContainer
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
  let target: HTMLElement | null = null
  while (node && node instanceof HTMLElement) {
    if (node.getAttribute('data-inline-style') === 'true') {
      target = node
      break
    }
    node = node.parentElement
  }
  if (!target) {
    const leaf = range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : range.startContainer instanceof HTMLElement
        ? range.startContainer
        : null
    if (leaf instanceof HTMLElement) target = leaf
  }
  return target ? extractFormatPaintStyleFromElement(target) : {}
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

  if (input.computed && hasFormatPaintStyle(input.computed)) {
    const computed = extractFormatPaintStyle(input.computed)
    for (const key of FORMAT_PAINT_STYLE_KEYS) {
      if ((style[key] == null || style[key] === '') && computed[key] != null && computed[key] !== '') {
        style[key] = computed[key]
      }
    }
  }

  return style
}

export function buildFormatPaintPropsPatch(
  blockProps: Record<string, unknown>,
  fieldKey: string | null,
  style: FormatPaintStyle,
): Record<string, unknown> {
  if (!hasFormatPaintStyle(style)) return {}

  if (typeof style.font_family === 'string') {
    ensureBuilderFontLoaded(style.font_family)
  }

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
  if (style.font_weight === 'bold') parts.push('bold')
  if (style.font_style === 'italic') parts.push('italic')
  if (style.text_align === 'left' || style.text_align === 'center' || style.text_align === 'right' || style.text_align === 'justify') {
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
