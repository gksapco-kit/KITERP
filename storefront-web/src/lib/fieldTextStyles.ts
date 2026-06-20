import type { CSSProperties } from 'react'
import { resolveBuilderFont } from '@/lib/builderFontFamilies'

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

/**
 * Text box width as % of its parent content column (builder resize handles).
 * The max exceeds 100% so a box can be dragged wider than its (often narrow,
 * centered) column out to the section's content edge. The actual upper bound is
 * the section width, enforced in pixels while dragging; this ceiling just caps
 * the stored value for unusually narrow columns inside very wide sections.
 */
export const FIELD_WIDTH_MIN_PCT = 25
export const FIELD_WIDTH_MAX_PCT = 1000

/** Minimum vertical space for multiline text boxes (saved values only). */
export const FIELD_MIN_HEIGHT_MIN_PX = 40
export const FIELD_MIN_HEIGHT_MAX_PX = 720

/** Tolerance when snapping resize back to auto-sized content. */
export const FIELD_RESIZE_SNAP_PX = 4

/** Synthetic field key — moves the whole editable content group in a section. */
export const CONTENT_GROUP_FIELD_KEY = '__content_group__'

/** Natural content height inside a positionable field wrapper (ignores wrapper min-height). */
export function measureFieldContentHeight(wrapper: HTMLElement): number {
  const content = wrapper.querySelector('[data-text-key], [data-builder-cta-shell]') as HTMLElement | null
  if (content) {
    return Math.max(1, Math.ceil(content.getBoundingClientRect().height))
  }
  return Math.max(1, Math.ceil(wrapper.scrollHeight))
}

/** Natural content width inside a positionable field wrapper. */
export function measureFieldContentWidth(wrapper: HTMLElement): number {
  const content = wrapper.querySelector('[data-text-key], [data-builder-cta-shell]') as HTMLElement | null
  if (content) {
    return Math.max(1, Math.ceil(content.scrollWidth))
  }
  return Math.max(1, Math.ceil(wrapper.scrollWidth))
}

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

/** True when the field has an explicit resized box width (not auto / fit-content). */
export function fieldHasConstrainedBoxWidth(fs: Record<string, unknown>): boolean {
  return readFieldWidthPct(fs.field_width_pct) != null
}

/** Typography/layout rules so text stays inside a resized box (unless nowrap is explicit). */
export function fieldConstrainedTextLayoutStyle(fs: Record<string, unknown>): CSSProperties {
  if (!fieldHasConstrainedBoxWidth(fs) || fs.text_wrap === false) return {}
  return {
    display: 'block',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    ...(fs.text_wrap === true || fs.text_wrap == null
      ? { whiteSpace: 'pre-wrap' as const }
      : {}),
  }
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

export function fieldStyleEntry(
  props: Record<string, unknown>,
  fieldKey: string,
): Record<string, unknown> {
  const fieldStyles = (props._field_styles as Record<string, Record<string, unknown>> | undefined) || {}
  return fieldStyles[fieldKey] || {}
}

/** Tailwind text-size utilities that fight builder `_field_styles.font_size_px`. */
const TAILWIND_FONT_SIZE_CLASS =
  /\b(?:(?:sm|md|lg|xl|2xl):)?text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g

export function stripTailwindFontSizeClasses(className?: string): string {
  if (!className) return ''
  return className.replace(TAILWIND_FONT_SIZE_CLASS, '').replace(/\s+/g, ' ').trim()
}

export function fieldHasCustomFontSize(
  props: Record<string, unknown> | undefined,
  fieldKey: string,
): boolean {
  if (!props) return false
  const px = fieldStyleEntry(props, fieldKey).font_size_px
  return typeof px === 'number' && px > 0
}

export function mergeFieldTypographyClassName(
  className: string | undefined,
  props: Record<string, unknown> | undefined,
  fieldKey: string,
): string {
  if (!fieldHasCustomFontSize(props, fieldKey)) return className ?? ''
  return stripTailwindFontSizeClasses(className)
}

/** Per-field typography from builder `_field_styles` (color, size, case, align, wrap). */
export function fieldTextStyle(
  props: Record<string, unknown>,
  fieldKey: string,
  base: CSSProperties = {},
): CSSProperties {
  const fs = fieldStyleEntry(props, fieldKey)
  const wrapStyle =
    fs.text_wrap === true
      ? { whiteSpace: 'pre-wrap' as const, overflowWrap: 'break-word' as const }
      : fs.text_wrap === false
        ? { whiteSpace: 'nowrap' as const }
        : fieldHasConstrainedBoxWidth(fs)
          ? { whiteSpace: 'pre-wrap' as const, overflowWrap: 'break-word' as const, wordBreak: 'break-word' as const }
          : {}
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
      ? (() => {
          const resolved = resolveBuilderFont(fs.font_family)
          if (!resolved) return {}
          let fontStyle = (resolved.fontStyle ?? 'normal') as CSSProperties['fontStyle']
          if (fs.font_style === 'italic' && !resolved.fontStyle) fontStyle = 'italic'
          if (fs.font_style === 'normal') fontStyle = 'normal'
          return {
            fontFamily: resolved.fontFamily,
            fontStyle,
          }
        })()
      : {}),
    ...(fs.text_align === 'left' || fs.text_align === 'center' || fs.text_align === 'right'
      ? { textAlign: fs.text_align as CSSProperties['textAlign'] }
      : {}),
    ...wrapStyle,
    ...(typeof fs.line_height_ratio === 'number' && fs.line_height_ratio > 0
      ? { lineHeight: fs.line_height_ratio }
      : {}),
    ...(typeof fs.paragraph_space_before_px === 'number' && fs.paragraph_space_before_px > 0
      ? { marginTop: `${Math.round(fs.paragraph_space_before_px)}px` }
      : {}),
    ...(typeof fs.paragraph_space_after_px === 'number'
      ? { marginBottom: `${Math.max(0, Math.round(fs.paragraph_space_after_px))}px` }
      : {}),
    ...fieldConstrainedTextLayoutStyle(fs),
  }
}

export function isInlinePositionField(fieldKey: string): boolean {
  const leaf = fieldKey.includes('.') ? fieldKey.split('.').pop()! : fieldKey
  return leaf === 'cta_primary' || leaf === 'cta_secondary' || leaf === 'cta_label' || leaf === 'cta'
}

/** CTA / button shell colors from `_field_styles` layered on theme defaults. */
export function fieldCtaShellStyle(
  props: Record<string, unknown>,
  fieldKey: string,
  base: CSSProperties = {},
): CSSProperties {
  const fs = fieldStyleEntry(props, fieldKey)
  return {
    ...base,
    ...(typeof fs.field_bg_color === 'string' && fs.field_bg_color
      ? { backgroundColor: fs.field_bg_color }
      : {}),
    ...(typeof fs.field_border_color === 'string' && fs.field_border_color
      ? { borderColor: fs.field_border_color }
      : {}),
  }
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
    boxSizing: 'border-box',
    ...(widthPct != null || boxMinHeight != null ? { minWidth: 0 } : {}),
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
        const resolved = resolveBuilderFont(fs.font_family)
        if (resolved) {
          textRules.push(`font-family: ${resolved.fontFamily} !important`)
          let style = resolved.fontStyle ?? 'normal'
          if (fs.font_style === 'italic' && !resolved.fontStyle) style = 'italic'
          if (fs.font_style === 'normal') style = 'normal'
          textRules.push(`font-style: ${style} !important`)
        }
      } else if (fs.font_style === 'italic') {
        textRules.push('font-style: italic !important')
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
          'min-width: 0 !important',
          'box-sizing: border-box !important',
        )
        if (fs.text_wrap !== false) {
          textRules.push(
            'display: block !important',
            'max-width: 100% !important',
            'width: 100% !important',
            'min-width: 0 !important',
            'box-sizing: border-box !important',
            'overflow-wrap: break-word !important',
            'word-break: break-word !important',
          )
          if (fs.text_wrap === true || fs.text_wrap == null) {
            textRules.push('white-space: pre-wrap !important')
          }
        } else {
          textRules.push('max-width: 100% !important', 'width: 100% !important', 'min-width: 0 !important')
        }
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
