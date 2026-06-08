import type { CSSProperties } from 'react'

export function hasInlineHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

/** Whether Enter should insert a new line instead of committing the field. */
export function isMultilineCanvasField(fieldKey: string): boolean {
  const leaf = fieldKey.includes('.') ? fieldKey.split('.').pop()! : fieldKey
  if (/^(subtitle|description|text|content|caption|body|bio|answer|quote|copyright|form_hint|eyebrow)/.test(leaf)) return true
  if (leaf.includes('desc') || leaf.includes('content')) return true
  if (leaf === 'headline' || leaf === 'headline_line2' || leaf === 'title') return true
  return false
}

const INLINE_EDIT_TAGS = new Set(['SPAN', 'EM', 'STRONG', 'B', 'I', 'A'])

export function isInlineEditTag(tagName: string | undefined): boolean {
  return !!tagName && INLINE_EDIT_TAGS.has(tagName.toUpperCase())
}

/** Step size for field position nudge / drag snap. */
export const FIELD_OFFSET_STEP_PX = 8
export const FIELD_OFFSET_MAX_PX = 480

/** Text box width as % of the section content column (builder resize handles). */
export const FIELD_WIDTH_MIN_PCT = 25
export const FIELD_WIDTH_MAX_PCT = 100

/** Minimum vertical space for multiline text boxes. */
export const FIELD_MIN_HEIGHT_MIN_PX = 40
export const FIELD_MIN_HEIGHT_MAX_PX = 720

/** Synthetic field key — moves the whole editable content group in a section. */
export const CONTENT_GROUP_FIELD_KEY = '__content_group__'

export function readFieldOffset(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.round(Math.max(-FIELD_OFFSET_MAX_PX, Math.min(FIELD_OFFSET_MAX_PX, value)))
}

export function readFieldWidthPct(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(FIELD_WIDTH_MIN_PCT, Math.min(FIELD_WIDTH_MAX_PCT, Math.round(value)))
}

export function readFieldMinHeight(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const n = Math.round(value)
  if (n <= 0) return null
  return Math.max(FIELD_MIN_HEIGHT_MIN_PX, Math.min(FIELD_MIN_HEIGHT_MAX_PX, n))
}

export function readFlipFlag(value: unknown): boolean {
  return value === true
}

export function readRotateDeg(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const n = Math.round(value) % 360
  return n < 0 ? n + 360 : n
}

export function buildTransformCss(flipH: boolean, flipV: boolean, rotateDeg: number): string | undefined {
  const parts: string[] = []
  if (rotateDeg !== 0) parts.push(`rotate(${rotateDeg}deg)`)
  if (flipH) parts.push('scaleX(-1)')
  if (flipV) parts.push('scaleY(-1)')
  return parts.length ? parts.join(' ') : undefined
}

export function transformStyleFromValues(
  flipH: unknown,
  flipV: unknown,
  rotateDeg: unknown,
): CSSProperties {
  const h = readFlipFlag(flipH)
  const v = readFlipFlag(flipV)
  const r = readRotateDeg(rotateDeg)
  const transform = buildTransformCss(h, v, r)
  if (!transform) return {}
  return { transform, transformOrigin: 'center center' }
}

export function transformStyleFromRecord(record: Record<string, unknown>): CSSProperties {
  return transformStyleFromValues(record.flip_h, record.flip_v, record.rotate_deg)
}

function fieldStyleEntry(
  props: Record<string, unknown>,
  fieldKey: string,
): Record<string, unknown> {
  const fieldStyles = (props._field_styles as Record<string, Record<string, unknown>> | undefined) || {}
  return fieldStyles[fieldKey] || {}
}

/** Per-field typography from builder `_field_styles` (color, size, case, align, wrap). */
export function fieldTextStyle(
  props: Record<string, unknown>,
  fieldKey: string,
  base: CSSProperties = {},
): CSSProperties {
  const fs = fieldStyleEntry(props, fieldKey)
  return {
    ...base,
    ...(typeof fs.text_color_override === 'string' ? { color: fs.text_color_override } : {}),
    ...(typeof fs.font_size_px === 'number' && fs.font_size_px > 0
      ? { fontSize: `${Math.round(fs.font_size_px)}px` }
      : {}),
    ...(typeof fs.text_transform === 'string'
      ? { textTransform: fs.text_transform as CSSProperties['textTransform'] }
      : {}),
    ...(typeof fs.font_family === 'string' && fs.font_family.trim()
      ? { fontFamily: fs.font_family.trim() }
      : {}),
    ...(fs.text_align === 'left' || fs.text_align === 'center' || fs.text_align === 'right'
      ? { textAlign: fs.text_align as CSSProperties['textAlign'] }
      : {}),
    ...(fs.text_wrap === true
      ? { whiteSpace: 'pre-wrap' as const, overflowWrap: 'break-word' as const }
      : fs.text_wrap === false
        ? { whiteSpace: 'nowrap' as const }
        : {}),
    ...(typeof fs.line_height_ratio === 'number' && fs.line_height_ratio > 0
      ? { lineHeight: fs.line_height_ratio }
      : {}),
    ...(typeof fs.paragraph_space_before_px === 'number' && fs.paragraph_space_before_px > 0
      ? { marginTop: `${Math.round(fs.paragraph_space_before_px)}px` }
      : {}),
    ...(typeof fs.paragraph_space_after_px === 'number'
      ? { marginBottom: `${Math.max(0, Math.round(fs.paragraph_space_after_px))}px` }
      : {}),
  }
}

export function isInlinePositionField(fieldKey: string): boolean {
  const leaf = fieldKey.includes('.') ? fieldKey.split('.').pop()! : fieldKey
  return leaf === 'cta_primary' || leaf === 'cta_secondary' || leaf === 'cta_label' || leaf === 'cta'
}

/** Flex wrapper for vertical alignment and/or free position offset within the section. */
export function fieldLayoutWrapperStyle(
  props: Record<string, unknown>,
  fieldKey: string,
  extra?: CSSProperties,
  opts?: { inline?: boolean },
): CSSProperties | undefined {
  const fs = fieldStyleEntry(props, fieldKey)
  const hasVertical = fs.vertical_align === 'top' || fs.vertical_align === 'middle' || fs.vertical_align === 'bottom'
  const offsetX = readFieldOffset(fs.field_offset_x)
  const offsetY = readFieldOffset(fs.field_offset_y)
  const hasOffset = offsetX !== 0 || offsetY !== 0
  const transformStyle = transformStyleFromRecord(fs)
  const hasTransform = Boolean(transformStyle.transform)
  const inline = opts?.inline ?? isInlinePositionField(fieldKey)
  const widthPct = readFieldWidthPct(fs.field_width_pct)
  const boxMinHeight = readFieldMinHeight(fs.field_min_height)
  const verticalMinHeight =
    typeof fs.field_min_height === 'number' && fs.field_min_height > 0 ? fs.field_min_height : 80

  if (!hasVertical && !hasOffset && !hasTransform && !extra && widthPct == null && boxMinHeight == null) {
    return undefined
  }

  return {
    position: 'relative',
    ...(inline
      ? { display: 'inline-flex', maxWidth: '100%' }
      : widthPct != null
        ? { width: `${widthPct}%`, maxWidth: `${widthPct}%` }
        : hasVertical
          ? { width: '100%' }
          : { width: 'fit-content', maxWidth: '100%' }),
    ...(hasOffset ? { left: offsetX, top: offsetY } : {}),
    ...transformStyle,
    ...(boxMinHeight != null ? { minHeight: boxMinHeight } : {}),
    ...(hasVertical
      ? {
          display: 'flex',
          flexDirection: 'column',
          justifyContent:
            fs.vertical_align === 'top'
              ? 'flex-start'
              : fs.vertical_align === 'bottom'
                ? 'flex-end'
                : 'center',
          minHeight: boxMinHeight ?? verticalMinHeight,
        }
      : {}),
    ...extra,
  }
}

/** Offset for an entire content cluster (headline + body + CTAs) within a section. */
export function contentGroupWrapperStyle(
  props: Record<string, unknown>,
  extra?: CSSProperties,
): CSSProperties | undefined {
  const offsetX = readFieldOffset(props.content_offset_x)
  const offsetY = readFieldOffset(props.content_offset_y)
  const hasOffset = offsetX !== 0 || offsetY !== 0
  const transformStyle = transformStyleFromValues(
    props.content_flip_h,
    props.content_flip_v,
    props.content_rotate_deg,
  )
  const hasTransform = Boolean(transformStyle.transform)
  if (!hasOffset && !hasTransform && !extra) return undefined
  return {
    position: 'relative',
    ...(hasOffset ? { left: offsetX, top: offsetY } : {}),
    ...transformStyle,
    ...extra,
  }
}

/** Whole-section flip / rotate from block props. */
export function sectionTransformStyle(props: Record<string, unknown>): CSSProperties {
  return transformStyleFromValues(
    props.section_flip_h,
    props.section_flip_v,
    props.section_rotate_deg,
  )
}

/** Inject per-field styles so Tailwind classes (e.g. text-center) do not override builder typography. */
export function buildFieldStylesCss(
  bidAttr: 'data-bid' | 'data-sf-bid',
  bid: string,
  props: Record<string, unknown>,
): string {
  const fieldStyles = (props._field_styles as Record<string, Record<string, unknown>>) || {}
  const fieldCss = Object.entries(fieldStyles)
    .map(([key, fs]) => {
      const selectorKey = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      const textRules: string[] = []
      const layoutRules: string[] = []

      if (typeof fs.text_color_override === 'string') {
        textRules.push(`color: ${fs.text_color_override} !important`)
      }
      if (typeof fs.font_size_px === 'number' && fs.font_size_px > 0) {
        textRules.push(`font-size: ${Math.round(fs.font_size_px)}px !important`)
      }
      if (typeof fs.text_transform === 'string') {
        textRules.push(`text-transform: ${fs.text_transform} !important`)
      }
      if (typeof fs.font_family === 'string' && fs.font_family.trim()) {
        textRules.push(`font-family: ${JSON.stringify(fs.font_family.trim())} !important`)
      }
      if (fs.text_align === 'left' || fs.text_align === 'center' || fs.text_align === 'right') {
        textRules.push(`text-align: ${fs.text_align} !important`)
      }
      if (fs.text_wrap === true) {
        textRules.push('white-space: pre-wrap !important', 'overflow-wrap: break-word !important')
      } else if (fs.text_wrap === false) {
        textRules.push('white-space: nowrap !important')
      }
      if (typeof fs.line_height_ratio === 'number' && fs.line_height_ratio > 0) {
        textRules.push(`line-height: ${fs.line_height_ratio} !important`)
      }
      if (typeof fs.paragraph_space_before_px === 'number' && fs.paragraph_space_before_px > 0) {
        textRules.push(`margin-top: ${Math.round(fs.paragraph_space_before_px)}px !important`)
      }
      if (typeof fs.paragraph_space_after_px === 'number') {
        textRules.push(`margin-bottom: ${Math.max(0, Math.round(fs.paragraph_space_after_px))}px !important`)
      }

      const widthPct = readFieldWidthPct(fs.field_width_pct)
      if (widthPct != null) {
        layoutRules.push(
          `width: ${widthPct}% !important`,
          `max-width: ${widthPct}% !important`,
        )
        textRules.push('max-width: 100% !important', 'width: 100% !important')
      }

      const boxMinHeight = readFieldMinHeight(fs.field_min_height)
      if (boxMinHeight != null) {
        layoutRules.push(`min-height: ${boxMinHeight}px !important`)
      }

      const offsetX = readFieldOffset(fs.field_offset_x)
      const offsetY = readFieldOffset(fs.field_offset_y)
      if (offsetX !== 0 || offsetY !== 0) {
        const inline = isInlinePositionField(key)
        layoutRules.push('position: relative !important')
        if (inline) {
          layoutRules.push('display: inline-flex !important', 'max-width: 100% !important')
        } else {
          layoutRules.push('width: 100% !important')
        }
        if (offsetX !== 0) layoutRules.push(`left: ${offsetX}px !important`)
        if (offsetY !== 0) layoutRules.push(`top: ${offsetY}px !important`)
      }

      const flipH = readFlipFlag(fs.flip_h)
      const flipV = readFlipFlag(fs.flip_v)
      const rotateDeg = readRotateDeg(fs.rotate_deg)
      const transform = buildTransformCss(flipH, flipV, rotateDeg)
      if (transform) {
        layoutRules.push('position: relative !important')
        if (isInlinePositionField(key)) {
          layoutRules.push('display: inline-flex !important', 'max-width: 100% !important')
        }
        layoutRules.push(`transform: ${transform} !important`, 'transform-origin: center center !important')
      }

      if (fs.vertical_align === 'top' || fs.vertical_align === 'middle' || fs.vertical_align === 'bottom') {
        const jc =
          fs.vertical_align === 'top'
            ? 'flex-start'
            : fs.vertical_align === 'bottom'
              ? 'flex-end'
              : 'center'
        const minH = readFieldMinHeight(fs.field_min_height) ?? 80
        layoutRules.push(
          'display: flex !important',
          'flex-direction: column !important',
          `justify-content: ${jc} !important`,
          `min-height: ${minH}px !important`,
          'width: 100% !important',
        )
      }

      let css = ''
      if (textRules.length) {
        css += `[${bidAttr}="${bid}"] [data-text-key="${selectorKey}"] { ${textRules.join('; ')}; }\n`
      }
      if (layoutRules.length) {
        css += `[${bidAttr}="${bid}"] [data-field-layout="${selectorKey}"] { ${layoutRules.join('; ')}; }\n`
      }
      return css
    })
    .join('')

  const groupKey = CONTENT_GROUP_FIELD_KEY.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const groupRules: string[] = []
  const gOffsetX = readFieldOffset(props.content_offset_x)
  const gOffsetY = readFieldOffset(props.content_offset_y)
  if (gOffsetX !== 0 || gOffsetY !== 0) {
    groupRules.push('position: relative !important')
    if (gOffsetX !== 0) groupRules.push(`left: ${gOffsetX}px !important`)
    if (gOffsetY !== 0) groupRules.push(`top: ${gOffsetY}px !important`)
  }
  const gTransform = buildTransformCss(
    readFlipFlag(props.content_flip_h),
    readFlipFlag(props.content_flip_v),
    readRotateDeg(props.content_rotate_deg),
  )
  if (gTransform) {
    groupRules.push(`transform: ${gTransform} !important`, 'transform-origin: center center !important')
  }
  if (groupRules.length) {
    return `${fieldCss}[${bidAttr}="${bid}"] [data-field-layout="${groupKey}"] { ${groupRules.join('; ')}; }\n`
  }
  return fieldCss
}
