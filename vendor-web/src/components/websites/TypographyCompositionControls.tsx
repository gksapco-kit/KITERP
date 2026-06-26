import type { ComponentProps, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { forwardRef, useCallback, useEffect, useRef } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceBetween,
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  RotateCw,
  WrapText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type TextAlignH = 'left' | 'center' | 'right'
export type TextAlignV = 'top' | 'middle' | 'bottom'
import {
  FONT_SIZE_PX_CHOICES,
  FONT_SIZE_PX_STEP,
  LINE_HEIGHT_RATIO_PRESETS,
  TEXT_CASE_MENU_ROWS,
  formatLineHeightLabel,
  normalizeLineHeightRatio,
  type TextCaseMenuId,
  normalizeFontSizePx,
  stepFontSizePx,
} from '@/lib/builderTypography'
import { FIELD_OFFSET_STEP_PX, readFieldOffset, readFlipFlag, readRotateDeg } from '@storefront/lib/fieldTextStyles'
import { BUILDER_FONT_FAMILIES, builderFontPreviewStyle, ensureBuilderFontLoaded, matchBuilderFontFamily } from '@storefront/lib/builderFontFamilies'
import { pinInlineTextSelectionBeforeToolbarAction } from '@storefront/lib/builderInlineTextSelection'

type ControlSize = 'panel' | 'compact' | 'mini' | 'transformPad'

/** Shared tight toolbar shell — matches design bar chrome. */
export const typographyToolbarBox =
  'inline-flex h-14 items-stretch overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm shrink-0'

const toolbarShell = typographyToolbarBox

const embeddedShell = 'inline-flex h-full items-stretch shrink-0 border-r border-gray-200 last:border-r-0'

/** Unified height for General tab tool clusters (typography + position pads). */
export const GENERAL_DESIGN_BAR_H = 'h-14'

const sizeStyles = {
  panel: {
    cell: 'w-9 h-9',
    icon: 'w-4 h-4',
    select: 'h-9 w-[4.25rem] px-1 text-xs',
    caseBtn: 'px-2.5 py-2 text-xs',
    wrapW: 'w-9',
    wrapH: 'h-[4.5rem]',
  },
  compact: {
    cell: 'w-7 h-7',
    icon: 'w-3.5 h-3.5',
    select: 'h-7 w-[3.25rem] px-0.5 text-[11px]',
    caseBtn: 'px-2 py-1.5 text-xs',
    wrapW: 'w-7',
    wrapH: 'h-14',
  },
  mini: {
    cell: 'w-6 h-6',
    icon: 'w-2.5 h-2.5',
    select: 'h-6 w-[2.75rem] px-0.5 text-[9px]',
    caseBtn: 'px-1 py-0.5 text-[9px]',
    wrapW: 'w-6',
    wrapH: 'h-[4.5rem]',
  },
  /** Position / flip pads — wide cells for easier freehand nudging. */
  transformPad: {
    cell: 'h-full min-h-0 w-8',
    icon: 'w-3 h-3',
    select: 'h-7 w-[3.25rem] px-0.5 text-[9px]',
    caseBtn: 'px-1 py-0.5 text-[9px]',
    wrapW: 'w-8',
    wrapH: GENERAL_DESIGN_BAR_H,
  },
} as const

/** Returns true when a hex color is perceptually dark (use light text on it). */
function isColorDark(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length < 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  // Relative luminance (WCAG)
  return 0.299 * r + 0.587 * g + 0.114 * b < 140
}

/** Design-bar font stack = h-7 family + h-7 size (compact). */
const COMPACT_FONT_STACK_H = 'h-14'
const COMPACT_COLOR_COL_W = 'w-7'
const DESIGN_BAR_COLOR_CELL = 'h-7 w-14 px-0'
const DESIGN_BAR_COLOR_SWATCH = 'sr-only'

/** Box-mode font size: A↑ · A↓ · px — flush grid, no pill rounding. */
export function FontSizePxControl({
  valuePx,
  onChange,
  onStep,
  size = 'panel',
  embedded = false,
  stacked = false,
  className,
  onMouseDown,
}: {
  valuePx: number | null | undefined
  onChange: (px: number | null) => void
  /** Preferred for A↑ / A↓ — uses selection-aware sizing in the design bar. */
  onStep?: (delta: number) => void
  size?: ControlSize
  /** Strip outer border when nested inside {@link typographyToolbarBox}. */
  embedded?: boolean
  /** Stack color row below — no right border on this segment. */
  stacked?: boolean
  className?: string
  onMouseDown?: (e: MouseEvent) => void
}) {
  const s = sizeStyles[size]
  const normalized = normalizeFontSizePx(valuePx)
  const extraSize =
    normalized != null && !(FONT_SIZE_PX_CHOICES as readonly number[]).includes(normalized)
      ? normalized
      : null

  const step = (delta: number) => {
    if (onStep) {
      onStep(delta)
      return
    }
    onChange(stepFontSizePx(valuePx, delta))
  }

  const shell = stacked
    ? 'flex h-7 min-h-0 w-full items-stretch shrink-0'
    : embedded
      ? embeddedShell
      : toolbarShell

  return (
    <div className={cn(shell, className)} onMouseDown={onMouseDown}>
      <button
        type="button"
        className={cn(
          stacked ? 'h-full w-7' : s.cell,
          'flex shrink-0 items-center justify-center gap-0.5 border-r border-gray-200 text-gray-800 transition-colors hover:bg-gray-50',
        )}
        onClick={() => step(FONT_SIZE_PX_STEP)}
      >
        <span className="text-[11px] font-bold leading-none">A</span>
        <ChevronUp className="w-2.5 h-2.5 shrink-0 text-primary" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        className={cn(
          stacked ? 'h-full w-7' : s.cell,
          'flex shrink-0 items-center justify-center gap-0.5 border-r border-gray-200 text-gray-800 transition-colors hover:bg-gray-50',
        )}
        onClick={() => step(-FONT_SIZE_PX_STEP)}
      >
        <span className="text-[11px] font-bold leading-none">A</span>
        <ChevronDown className="w-2.5 h-2.5 shrink-0 text-primary" strokeWidth={2.5} />
      </button>
      <select
        className={cn(
          'cursor-pointer border-0 bg-white font-medium text-gray-800 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40',
          stacked
            ? 'h-full min-w-0 flex-1 px-1 text-[10px]'
            : cn('shrink-0', s.select),
        )}
        value={normalized != null ? String(normalized) : ''}
        onChange={e => {
          const v = e.target.value
          onChange(v ? Math.round(Number(v)) : null)
        }}
        onClick={e => e.stopPropagation()}
      >
        <option value="">Auto</option>
        {extraSize != null ? (
          <option key={`extra-${extraSize}`} value={extraSize}>{extraSize}</option>
        ) : null}
        {FONT_SIZE_PX_CHOICES.map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  )
}

/** Font family picker — compact select for the design bar or props panel. */
export function FontFamilyControl({
  value,
  onChange,
  size = 'compact',
  stacked = false,
  className,
  onMouseDown,
}: {
  value?: string | null
  onChange: (font: string | null) => void
  size?: ControlSize
  stacked?: boolean
  className?: string
  onMouseDown?: (e: MouseEvent) => void
}) {
  const s = sizeStyles[size]
  const current = matchBuilderFontFamily(value) ?? ''
  const extraFont =
    current && !BUILDER_FONT_FAMILIES.includes(current as (typeof BUILDER_FONT_FAMILIES)[number])
      ? current
      : null

  return (
    <select
      title="Font family"
      aria-label="Font family"
      className={cn(
        'w-full cursor-pointer border-0 bg-white font-medium text-gray-800 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40 truncate',
        stacked
          ? 'h-7 shrink-0 px-2 text-[10px]'
          : cn(s.select, 'border-l border-gray-200'),
        className,
      )}
      value={current}
      onChange={e => {
        const next = e.target.value.trim()
        if (next) ensureBuilderFontLoaded(next)
        onChange(next || null)
      }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => {
        // Parent typography toolbar uses preventDefault on mousedown (keeps canvas focus).
        // Stop propagation so native <select> can open and show font choices.
        pinInlineTextSelectionBeforeToolbarAction()
        e.stopPropagation()
        onMouseDown?.(e)
      }}
      style={current ? builderFontPreviewStyle(current) : undefined}
    >
      <option value="">Auto</option>
      {extraFont ? (
        <option value={extraFont} style={builderFontPreviewStyle(extraFont)}>
          {extraFont}
        </option>
      ) : null}
      {BUILDER_FONT_FAMILIES.map(font => (
        <option key={font} value={font} style={builderFontPreviewStyle(font)}>
          {font}
        </option>
      ))}
    </select>
  )
}

/** Fixed-width two-row font family + size stack for design-bar typography toolbars. */
export function TypographyFontStack({
  fontFamily,
  onFontFamilyChange,
  fontSizePx,
  onFontSizeChange,
  onFontSizeStep,
  showFamily = true,
  showSize = true,
  size = 'compact',
  className,
  onMouseDown,
}: {
  fontFamily?: string | null
  onFontFamilyChange: (font: string | null) => void
  fontSizePx?: number | null
  onFontSizeChange: (px: number | null) => void
  onFontSizeStep?: (delta: number) => void
  showFamily?: boolean
  showSize?: boolean
  size?: ControlSize
  className?: string
  onMouseDown?: (e: MouseEvent) => void
}) {
  return (
    <div
      className={cn(
        'flex h-14 w-[7.25rem] shrink-0 flex-col divide-y divide-gray-200 overflow-hidden',
        className,
      )}
      onMouseDown={onMouseDown}
    >
      {showFamily ? (
        <FontFamilyControl
          stacked
          size={size}
          value={fontFamily}
          onChange={onFontFamilyChange}
          onMouseDown={onMouseDown}
        />
      ) : null}
      {showSize ? (
        <FontSizePxControl
          stacked
          size={size}
          valuePx={fontSizePx}
          onStep={onFontSizeStep}
          onChange={onFontSizeChange}
          onMouseDown={onMouseDown}
        />
      ) : null}
    </div>
  )
}

/** Vertical text-case list — box panel rows. */
export function TextCaseList({
  activeId,
  onSelect,
  size = 'panel',
  className,
}: {
  activeId: TextCaseMenuId
  onSelect: (id: TextCaseMenuId) => void
  size?: ControlSize
  className?: string
}) {
  const s = sizeStyles[size]

  return (
    <div className={cn('overflow-hidden rounded-none border border-gray-200 bg-white', className)}>
      {TEXT_CASE_MENU_ROWS.map(row => (
        <button
          key={row.id}
          type="button"
          onClick={() => onSelect(row.id)}
          className={cn(
            'w-full border-b border-gray-100 text-left font-medium transition-colors last:border-b-0',
            s.caseBtn,
            activeId === row.id
              ? 'bg-primary text-white'
              : 'text-gray-700 hover:bg-gray-50',
          )}
        >
          {row.label}
        </button>
      ))}
    </div>
  )
}

/** Compact horizontal text-case picker for slim side panels. */
export function TextCaseChipRow({
  activeId,
  onSelect,
  className,
}: {
  activeId: TextCaseMenuId
  onSelect: (id: TextCaseMenuId) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {TEXT_CASE_MENU_ROWS.map(row => (
        <button
          key={row.id}
          type="button"
          title={row.label}
          onClick={() => onSelect(row.id)}
          className={cn(
            'rounded-md border px-2 py-1 text-[10px] font-semibold leading-tight transition-colors',
            activeId === row.id
              ? 'border-primary bg-primary text-white'
              : 'border-border bg-background text-muted-foreground hover:border-primary/40',
          )}
        >
          {row.label}
        </button>
      ))}
    </div>
  )
}

/** Word-style color swatch — T / B with matching letter + color bar sizing. */
export function ColorIdentPicker({
  letter,
  color,
  onChange,
  title,
  size = 'compact',
  inRow = false,
  rowPosition = 'single',
  orientation = 'horizontal',
  designBar = false,
  onMouseDown,
}: {
  letter: 'T' | 'B'
  color: string
  onChange: (color: string) => void
  title: string
  size?: ControlSize
  /** Equal-width cell inside a T|B row under font size controls. */
  inRow?: boolean
  rowPosition?: 'start' | 'middle' | 'end' | 'single'
  /** Stack T / B vertically (design bar column). */
  orientation?: 'horizontal' | 'vertical'
  /** Full-height design bar cell — larger target and swatch. */
  designBar?: boolean
  onMouseDown?: (e: MouseEvent) => void
}) {
  const rowH = size === 'compact' ? 'h-7' : 'h-9'
  const vertical = orientation === 'vertical'
  const colCell = size === 'compact' ? `${COMPACT_COLOR_COL_W} flex-1 min-h-0` : 'h-9 w-11 flex-1 min-h-0'
  const swatch = designBar
    ? DESIGN_BAR_COLOR_SWATCH
    : vertical
      ? 'mt-px h-[3px] w-2.5 border border-gray-300 pointer-events-none'
      : 'mt-0.5 h-2 w-[18px] border border-gray-300 pointer-events-none'
  const letterClass = designBar
    ? 'text-[11px] font-bold leading-none text-gray-900 select-none pointer-events-none'
    : vertical && size === 'compact'
      ? 'text-[9px] font-bold leading-none text-gray-900 select-none pointer-events-none'
      : 'text-[11px] font-bold leading-none text-gray-900 select-none pointer-events-none'

  if (designBar) {
    // Pill-shaped color button: entire capsule is filled with the current color
    const isDark = isColorDark(color)
    return (
      <label
        title={title}
        onMouseDown={onMouseDown}
        className={cn(
          DESIGN_BAR_COLOR_CELL,
          'relative flex cursor-pointer items-center justify-center rounded-full border-2 transition-all hover:scale-105 hover:shadow-md shrink-0',
          isDark ? 'border-white/20' : 'border-black/10',
        )}
        style={{ backgroundColor: color }}
      >
        <span
          className="select-none pointer-events-none text-[10px] font-bold leading-none"
          style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)' }}
        >
          {letter}
        </span>
        <input
          type="color"
          value={color}
          onInput={e => onChange(e.currentTarget.value)}
          onChange={e => onChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    )
  }

  return (
    <label
      title={title}
      onMouseDown={onMouseDown}
      className={cn(
        'relative flex flex-col items-center justify-center hover:bg-gray-50 cursor-pointer shrink-0 py-0',
        inRow
          ? cn(
              vertical ? colCell : cn(rowH, 'flex-1 min-w-0'),
              !vertical && (rowPosition === 'start' || rowPosition === 'middle') && 'border-r border-gray-200',
              vertical && (rowPosition === 'start' || rowPosition === 'middle') && 'border-b border-gray-200',
            )
          : cn(size === 'compact' ? 'w-7 h-7' : 'w-9 h-9', 'border-l border-gray-200'),
      )}
    >
      <span className={letterClass}>
        {letter}
      </span>
      <span className={swatch} style={{ backgroundColor: color }} />
      <input
        type="color"
        value={color}
        onInput={e => onChange(e.currentTarget.value)}
        onChange={e => onChange(e.target.value)}
        onClick={e => e.stopPropagation()}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  )
}

/** T + B row — sits under font size, or stacks vertically beside font controls. */
export function ColorIdentPickerRow({
  textColor,
  backgroundColor,
  onTextColorChange,
  onBackgroundColorChange,
  showBackgroundPicker = true,
  size = 'compact',
  vertical = false,
  designBar = false,
  trailing,
  onMouseDown,
}: {
  textColor: string
  backgroundColor: string
  onTextColorChange: (color: string) => void
  onBackgroundColorChange: (color: string) => void
  /** Section background — use Section Edit → Design → Colors instead. */
  showBackgroundPicker?: boolean
  size?: ControlSize
  /** Stack T, B, and trailing controls in a narrow column. */
  vertical?: boolean
  /** Side-by-side T / B — full bar height, spaced apart (design bar). */
  designBar?: boolean
  /** Extra cell(s) after B — e.g. Aa case dropdown. */
  trailing?: ReactNode
  onMouseDown?: (e: MouseEvent) => void
}) {
  const rowH = size === 'compact' ? 'h-7' : 'h-9'

  if (designBar) {
    return (
      <div
        className="flex shrink-0 items-center gap-1.5 border-l border-gray-200 px-2"
        onMouseDown={onMouseDown}
      >
        <ColorIdentPicker
          letter="T"
          title="Text color"
          size={size}
          designBar
          color={textColor}
          onChange={onTextColorChange}
        />
        {showBackgroundPicker ? (
          <ColorIdentPicker
            letter="B"
            title="Block background color"
            size={size}
            designBar
            color={backgroundColor}
            onChange={onBackgroundColorChange}
          />
        ) : null}
      </div>
    )
  }

  if (vertical) {
    const stackH = size === 'compact' ? COMPACT_FONT_STACK_H : 'h-[4.5rem]'
    const colW = size === 'compact' ? COMPACT_COLOR_COL_W : 'w-11'
    return (
      <div
        className={cn('flex shrink-0 flex-col border-l border-gray-200', stackH, colW)}
        onMouseDown={onMouseDown}
      >
        <ColorIdentPicker
          letter="T"
          title="Text color"
          size={size}
          inRow
          orientation="vertical"
          rowPosition={showBackgroundPicker || trailing ? 'start' : 'single'}
          color={textColor}
          onChange={onTextColorChange}
        />
        {showBackgroundPicker ? (
          <ColorIdentPicker
            letter="B"
            title="Block background color"
            size={size}
            inRow
            orientation="vertical"
            rowPosition={trailing ? 'middle' : 'end'}
            color={backgroundColor}
            onChange={onBackgroundColorChange}
          />
        ) : null}
        {trailing ? (
          <div className={cn('relative flex min-h-0 flex-1 items-stretch justify-center', colW)}>
            {trailing}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="flex w-full border-t border-gray-200 shrink-0"
      onMouseDown={onMouseDown}
    >
      <ColorIdentPicker
        letter="T"
        title="Text color"
        size={size}
        inRow
        rowPosition={showBackgroundPicker || trailing ? 'start' : 'single'}
        color={textColor}
        onChange={onTextColorChange}
      />
      {showBackgroundPicker ? (
        <ColorIdentPicker
          letter="B"
          title="Block background color"
          size={size}
          inRow
          rowPosition={trailing ? 'middle' : 'end'}
          color={backgroundColor}
          onChange={onBackgroundColorChange}
        />
      ) : null}
      {trailing ? (
        <div className={cn('relative flex flex-1 min-w-0 items-stretch', rowH)}>
          {trailing}
        </div>
      ) : null}
    </div>
  )
}

/** Excel-style alignment — single box, flush cells, wrap column on the right. */
export function TextFieldAlignGrid({
  textAlign = 'left',
  verticalAlign = 'top',
  textWrap = true,
  onTextAlignChange,
  onVerticalAlignChange,
  onTextWrapChange,
  wrapColumnExtra,
  size = 'panel',
  embedded = false,
  className,
  onMouseDown,
}: {
  textAlign?: TextAlignH | string | null
  verticalAlign?: TextAlignV | string | null
  textWrap?: boolean | null
  onTextAlignChange: (align: TextAlignH) => void
  onVerticalAlignChange: (align: TextAlignV) => void
  onTextWrapChange: (wrap: boolean) => void
  /** Renders below wrap toggle in the same narrow column (e.g. line spacing). */
  wrapColumnExtra?: ReactNode
  size?: ControlSize
  embedded?: boolean
  className?: string
  onMouseDown?: (e: MouseEvent) => void
}) {
  const s = sizeStyles[size]
  const h = (textAlign === 'center' || textAlign === 'right') ? textAlign : 'left'
  const v = (verticalAlign === 'middle' || verticalAlign === 'bottom') ? verticalAlign : 'top'
  const wrap = textWrap !== false

  const cell = (
    active: boolean,
    onClick: () => void,
    title: string,
    Icon: typeof AlignLeft,
    borderClass: string,
  ) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        s.cell,
        'flex items-center justify-center transition-colors',
        borderClass,
        active
          ? 'bg-primary/10 text-primary'
          : 'bg-white text-gray-600 hover:bg-gray-50',
      )}
    >
      <Icon className={s.icon} strokeWidth={2} />
    </button>
  )

  if (embedded) {
    // Design-bar embedded mode: two segmented pill rows (V + H) stacked vertically
    const segBtn = (active: boolean, onClick: () => void, title: string, Icon: typeof AlignLeft, pos: 'start' | 'mid' | 'end') => (
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={cn(
          'flex flex-1 items-center justify-center transition-colors',
          pos === 'start' && 'rounded-l-full',
          pos === 'end' && 'rounded-r-full',
          active
            ? 'bg-primary text-white shadow-sm'
            : 'bg-white text-gray-400 hover:bg-gray-100 hover:text-gray-700',
        )}
      >
        <Icon className="h-3 w-3" strokeWidth={2.5} />
      </button>
    )

    return (
      <div
        className={cn(embeddedShell, 'h-full items-center gap-1.5 px-2', className)}
        onMouseDown={onMouseDown}
      >
        {/* Vertical + horizontal align stacked */}
        <div className="flex flex-col gap-1 py-1.5">
          {/* Vertical align row */}
          <div className="flex h-5 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
            {segBtn(v === 'top',    () => onVerticalAlignChange('top'),    'Align top',    AlignVerticalJustifyStart,  'start')}
            <span className="w-px self-stretch bg-gray-200" />
            {segBtn(v === 'middle', () => onVerticalAlignChange('middle'), 'Align middle', AlignVerticalJustifyCenter, 'mid')}
            <span className="w-px self-stretch bg-gray-200" />
            {segBtn(v === 'bottom', () => onVerticalAlignChange('bottom'), 'Align bottom', AlignVerticalJustifyEnd,    'end')}
          </div>
          {/* Horizontal align row */}
          <div className="flex h-5 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
            {segBtn(h === 'left',   () => onTextAlignChange('left'),   'Align left',   AlignLeft,   'start')}
            <span className="w-px self-stretch bg-gray-200" />
            {segBtn(h === 'center', () => onTextAlignChange('center'), 'Align center', AlignCenter, 'mid')}
            <span className="w-px self-stretch bg-gray-200" />
            {segBtn(h === 'right',  () => onTextAlignChange('right'),  'Align right',  AlignRight,  'end')}
          </div>
        </div>

        {/* Wrap toggle + extras */}
        <div className="flex flex-col gap-1 border-l border-gray-200 pl-1.5 py-1.5">
          <button
            type="button"
            title={wrap ? 'Wrap text (on)' : 'Wrap text (off)'}
            onClick={() => onTextWrapChange(!wrap)}
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full border transition-colors',
              wrap
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600',
            )}
          >
            <WrapText className="h-3 w-3" strokeWidth={2.5} />
          </button>
          {wrapColumnExtra ? (
            <div className="relative flex">{wrapColumnExtra}</div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={cn(toolbarShell, className)} onMouseDown={onMouseDown}>
      <div className="grid grid-cols-3">
        {cell(v === 'top', () => onVerticalAlignChange('top'), 'Align top', AlignVerticalJustifyStart, 'border-r border-b border-gray-200')}
        {cell(v === 'middle', () => onVerticalAlignChange('middle'), 'Align middle', AlignVerticalJustifyCenter, 'border-r border-b border-gray-200')}
        {cell(v === 'bottom', () => onVerticalAlignChange('bottom'), 'Align bottom', AlignVerticalJustifyEnd, 'border-b border-gray-200')}
        {cell(h === 'left', () => onTextAlignChange('left'), 'Align left', AlignLeft, 'border-r border-gray-200')}
        {cell(h === 'center', () => onTextAlignChange('center'), 'Align center', AlignCenter, 'border-r border-gray-200')}
        {cell(h === 'right', () => onTextAlignChange('right'), 'Align right', AlignRight, '')}
      </div>
      <div
        className={cn(
          s.wrapW,
          s.wrapH,
          'flex shrink-0 flex-col border-l border-gray-200',
        )}
      >
        <button
          type="button"
          title={wrap ? 'Wrap text (on)' : 'Wrap text (off)'}
          onClick={() => onTextWrapChange(!wrap)}
          className={cn(
            'flex flex-1 min-h-0 items-center justify-center transition-colors',
            wrapColumnExtra && 'border-b border-gray-200',
            wrap
              ? 'bg-primary/10 text-primary'
              : 'bg-white text-gray-600 hover:bg-gray-50',
          )}
        >
          <WrapText className={s.icon} strokeWidth={2} />
        </button>
        {wrapColumnExtra ? (
          <div className="relative flex flex-1 min-h-0">{wrapColumnExtra}</div>
        ) : null}
      </div>
    </div>
  )
}

function isTypingElement(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return el.isContentEditable
}

function useHoldRepeatAction(action: () => void) {
  const actionRef = useRef(action)
  actionRef.current = action
  const cleanupRef = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
  }, [])

  const start = useCallback((e: ReactPointerEvent) => {
    e.preventDefault()
    stop()
    actionRef.current()
    let intervalId: number | null = null
    const delayId = window.setTimeout(() => {
      intervalId = window.setInterval(() => actionRef.current(), 70)
    }, 300)
    const cleanup = () => {
      window.clearTimeout(delayId)
      if (intervalId != null) window.clearInterval(intervalId)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
      window.removeEventListener('blur', cleanup)
    }
    cleanupRef.current = cleanup
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
    window.addEventListener('blur', cleanup)
  }, [stop])

  useEffect(() => () => stop(), [stop])

  return start
}

function HoldRepeatButton({
  label,
  onAction,
  className,
  children,
  disabled = false,
}: {
  label: string
  onAction: () => void
  className?: string
  children: ReactNode
  disabled?: boolean
}) {
  const startHold = useHoldRepeatAction(onAction)
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      className={className}
      onPointerDown={disabled ? undefined : startHold}
      onClick={e => e.preventDefault()}
    >
      {children}
    </button>
  )
}

/** Nudge pad with optional All / 1× scope toggle stacked above. */
export function FieldPositionControlGroup({
  scopeMode,
  onScopeChange,
  showScopeToggle = true,
  size = 'mini',
  ...nudgeProps
}: {
  scopeMode?: 'field' | 'group'
  onScopeChange?: (mode: 'field' | 'group') => void
  showScopeToggle?: boolean
  size?: ControlSize
} & ComponentProps<typeof FieldPositionNudge>) {
  return (
    <div className="flex flex-col shrink-0 self-center overflow-hidden rounded-sm border border-gray-200 bg-white">
      {showScopeToggle && scopeMode != null && onScopeChange ? (
        <FieldPositionScopeToggle
          mode={scopeMode}
          onChange={onScopeChange}
          layout="horizontal"
          dense
          className="w-full border-0 rounded-none border-b border-gray-200"
        />
      ) : null}
      <FieldPositionNudge
        {...nudgeProps}
        size={size}
        embedded
        className={cn('border-0 rounded-none', nudgeProps.className)}
      />
    </div>
  )
}

/** Nudge selected text field position within its section (↑↓←→ + reset). */
export function FieldPositionNudge({
  offsetX = 0,
  offsetY = 0,
  onNudge,
  onReset,
  size = 'compact',
  embedded = false,
  className,
  onMouseDown,
  titleLabel = 'Field position',
  keyboardShortcuts = false,
  disabled = false,
}: {
  offsetX?: number
  offsetY?: number
  onNudge: (dx: number, dy: number) => void
  onReset: () => void
  size?: ControlSize
  embedded?: boolean
  className?: string
  onMouseDown?: (e: MouseEvent) => void
  titleLabel?: string
  /** Arrow keys nudge while this control is shown. Hold key or button to keep moving. */
  keyboardShortcuts?: boolean
  disabled?: boolean
}) {
  const s = sizeStyles[size]
  const step = FIELD_OFFSET_STEP_PX
  const ox = readFieldOffset(offsetX)
  const oy = readFieldOffset(offsetY)
  const moved = ox !== 0 || oy !== 0
  const onNudgeRef = useRef(onNudge)
  onNudgeRef.current = onNudge
  const onResetRef = useRef(onReset)
  onResetRef.current = onReset

  useEffect(() => {
    if (!keyboardShortcuts || disabled) return
    const onKey = (e: KeyboardEvent) => {
      if (isTypingElement(e.target)) return
      let dx = 0
      let dy = 0
      switch (e.key) {
        case 'ArrowUp':
          dy = -step
          break
        case 'ArrowDown':
          dy = step
          break
        case 'ArrowLeft':
          dx = -step
          break
        case 'ArrowRight':
          dx = step
          break
        default:
          return
      }
      e.preventDefault()
      e.stopPropagation()
      onNudgeRef.current(dx, dy)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [keyboardShortcuts, disabled, step])

  const iconStroke = size === 'mini' || size === 'transformPad' ? 1.75 : 2

  const nudgeBtn = (label: string, action: () => void, Icon?: typeof ArrowUp, border = '') => (
    <HoldRepeatButton
      label={`${label} — arrow key · hold to repeat`}
      onAction={action}
      disabled={disabled}
      className={cn(
        s.cell,
        'flex items-center justify-center text-gray-600 transition-colors hover:bg-gray-50 active:bg-primary/10 touch-none select-none',
        border,
        disabled && 'opacity-40 pointer-events-none',
      )}
    >
      {Icon ? <Icon className={cn(s.icon, 'shrink-0')} strokeWidth={iconStroke} /> : <span className="text-[6px] font-bold leading-none">·</span>}
    </HoldRepeatButton>
  )

  return (
    <div
      className={cn(embedded ? embeddedShell : toolbarShell, size === 'transformPad' && 'h-full', className)}
      onMouseDown={onMouseDown}
      title={`${titleLabel}${moved ? ` (${ox}, ${oy})` : ''} · Arrow keys · hold buttons to repeat`}
    >
      <div className={cn('grid grid-cols-3', size === 'transformPad' ? 'h-full' : undefined)}>
        <div className={cn(s.cell, 'border-r border-b border-gray-200 bg-gray-50/80')} />
        {nudgeBtn('Move up', () => onNudge(0, -step), ArrowUp, 'border-r border-b border-gray-200')}
        <div className={cn(s.cell, 'border-b border-gray-200 bg-gray-50/80')} />
        {nudgeBtn('Move left', () => onNudge(-step, 0), ArrowLeft, 'border-r border-b border-gray-200')}
        <HoldRepeatButton
          label="Reset position"
          onAction={() => onResetRef.current()}
          disabled={disabled}
          className={cn(
            s.cell,
            'flex items-center justify-center text-gray-600 transition-colors hover:bg-gray-50 active:bg-primary/10 touch-none select-none',
            'border-r border-b border-gray-200',
            moved && !disabled && 'bg-primary/10 text-primary',
            disabled && 'opacity-40 pointer-events-none',
          )}
        >
          <span className={cn('font-bold leading-none', size === 'mini' || size === 'transformPad' ? 'text-[6px]' : 'text-[8px]')}>·</span>
        </HoldRepeatButton>
        {nudgeBtn('Move right', () => onNudge(step, 0), ArrowRight, 'border-b border-gray-200')}
        <div className={cn(s.cell, 'border-r border-gray-200 bg-gray-50/80')} />
        {nudgeBtn('Move down', () => onNudge(0, step), ArrowDown, 'border-r border-gray-200')}
        <div className={cn(s.cell, 'bg-gray-50/80')} />
      </div>
    </div>
  )
}

/** Toggle between moving one field vs the whole content cluster. */
export function FieldPositionScopeToggle({
  mode,
  onChange,
  layout = 'vertical',
  dense = false,
  className,
  onMouseDown,
}: {
  mode: 'field' | 'group'
  onChange: (mode: 'field' | 'group') => void
  layout?: 'vertical' | 'horizontal'
  dense?: boolean
  className?: string
  onMouseDown?: (e: MouseEvent) => void
}) {
  const cell = cn(
    'flex flex-1 items-center justify-center font-bold leading-none transition-colors',
    dense && layout === 'horizontal'
      ? 'h-3 px-0 text-[7px]'
      : layout === 'horizontal'
        ? 'px-0.5 py-0.5 text-[8px]'
        : 'px-1.5 py-1 text-[9px]',
  )
  return (
    <div
      className={cn(
        'flex shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white',
        layout === 'horizontal' ? 'flex-row w-full' : 'flex-col w-9',
        className,
      )}
      onMouseDown={onMouseDown}
      title={mode === 'group' ? 'Move all content together' : 'Move selected field only'}
    >
      <button
        type="button"
        title="Move all content (headline, text, buttons)"
        onClick={() => onChange('group')}
        className={cn(
          cell,
          layout === 'horizontal' ? 'border-r border-gray-200' : 'border-b border-gray-200',
          mode === 'group' ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-50',
        )}
      >
        All
      </button>
      <button
        type="button"
        title="Move selected field only"
        onClick={() => onChange('field')}
        className={cn(cell, mode === 'field' ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-50')}
      >
        1×
      </button>
    </div>
  )
}

export type LayoutTransformScope = 'section' | 'group' | 'field'

/** Section vs all content vs single field — for flip / rotate. */
export function LayoutTransformScopeToggle({
  mode,
  onChange,
  showGroup = true,
  layout = 'vertical',
  dense = false,
  className,
  onMouseDown,
}: {
  mode: LayoutTransformScope
  onChange: (mode: LayoutTransformScope) => void
  showGroup?: boolean
  layout?: 'vertical' | 'horizontal'
  dense?: boolean
  className?: string
  onMouseDown?: (e: MouseEvent) => void
}) {
  const horizontal = layout === 'horizontal'
  const cell = cn(
    'flex flex-1 items-center justify-center font-bold leading-none transition-colors',
    dense && horizontal
      ? 'h-7 px-1.5 text-[9px]'
      : dense && !horizontal
        ? 'min-h-0 flex-1 px-2 py-1 text-[10px]'
        : horizontal
          ? 'px-1.5 py-0.5 text-[9px]'
          : 'px-2 py-1.5 text-[10px]',
  )
  const items: { id: LayoutTransformScope; label: string; title: string }[] = [
    { id: 'section', label: 'Sec', title: 'Flip / rotate entire section' },
    ...(showGroup ? [{ id: 'group' as const, label: 'All', title: 'Flip / rotate all content (headline, text, buttons)' }] : []),
    { id: 'field', label: '1×', title: 'Flip / rotate selected field only' },
  ]
  return (
    <div
      className={cn(
        'flex shrink-0 overflow-hidden bg-white',
        horizontal ? 'flex-row w-full' : cn('flex-col', dense ? 'h-full w-10' : 'w-10 rounded-md border border-gray-200'),
        className,
      )}
      onMouseDown={onMouseDown}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          title={item.title}
          onClick={() => onChange(item.id)}
          className={cn(
            cell,
            horizontal
              ? index < items.length - 1 && 'border-r border-gray-200'
              : index < items.length - 1 && 'border-b border-gray-200',
            mode === item.id ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-50',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/** Sec / All / 1× scope strip with nudge + flip pads — single h-14 cluster. */
export function LayoutTransformPositionGroup({
  scopeMode,
  onScopeChange,
  showGroup = true,
  nudgeDisabled = false,
  size = 'transformPad',
  flipProps,
  ...nudgeProps
}: {
  scopeMode: LayoutTransformScope
  onScopeChange: (mode: LayoutTransformScope) => void
  showGroup?: boolean
  nudgeDisabled?: boolean
  size?: ControlSize
  flipProps?: ComponentProps<typeof FlipRotateControls>
} & ComponentProps<typeof FieldPositionNudge>) {
  return (
    <div className={cn(GENERAL_DESIGN_BAR_H, 'flex shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm')}>
      <LayoutTransformScopeToggle
        mode={scopeMode}
        onChange={onScopeChange}
        showGroup={showGroup}
        layout="vertical"
        dense
        className="h-full w-10 shrink-0 border-0 border-r border-gray-200 rounded-none"
      />
      <div className="flex h-full min-w-0 items-stretch">
        <FieldPositionNudge
          {...nudgeProps}
          size={size}
          embedded
          disabled={nudgeDisabled}
          className={cn('h-full rounded-none border-0', nudgeProps.className)}
        />
        {flipProps ? (
          <FlipRotateControls
            {...flipProps}
            size={size}
            embedded
            className="h-full rounded-none border-0 border-l border-gray-200"
          />
        ) : null}
      </div>
    </div>
  )
}

/** Flip horizontal / vertical and rotate 90° — 3×3 pad matching {@link FieldPositionNudge}. */
export function FlipRotateControls({
  flipH = false,
  flipV = false,
  rotateDeg = 0,
  onChange,
  onReset,
  embedded = true,
  size = 'mini',
  className,
  onMouseDown,
  disabled = false,
}: {
  flipH?: boolean
  flipV?: boolean
  rotateDeg?: number
  onChange: (patch: { flip_h?: boolean | null; flip_v?: boolean | null; rotate_deg?: number | null }) => void
  onReset: () => void
  embedded?: boolean
  size?: ControlSize
  className?: string
  onMouseDown?: (e: MouseEvent) => void
  disabled?: boolean
}) {
  const s = sizeStyles[size]
  const h = readFlipFlag(flipH)
  const v = readFlipFlag(flipV)
  const r = readRotateDeg(rotateDeg)
  const active = h || v || r !== 0
  const iconStroke = size === 'mini' || size === 'transformPad' ? 1.75 : 2

  const stepRotate = (delta: number) => {
    const next = readRotateDeg(r + delta)
    onChange({ rotate_deg: next === 0 ? null : next })
  }

  const padBtn = (
    label: string,
    onClick: () => void,
    Icon: typeof FlipHorizontal,
    isActive = false,
    border = '',
  ) => (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        s.cell,
        'flex items-center justify-center transition-colors touch-none select-none',
        border,
        isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-50 active:bg-primary/10',
        disabled && 'opacity-40 pointer-events-none',
      )}
    >
      <Icon className={cn(s.icon, 'shrink-0')} strokeWidth={iconStroke} />
    </button>
  )

  const spacer = (border: string) => (
    <div className={cn(s.cell, 'bg-gray-50/80', border)} aria-hidden />
  )

  return (
    <div
      className={cn(
        embedded ? embeddedShell : toolbarShell,
        size === 'transformPad' && 'h-full',
        !embedded && 'overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm',
        className,
      )}
      onMouseDown={onMouseDown}
      title="Flip & rotate"
    >
      <div className={cn('grid grid-cols-3', size === 'transformPad' ? 'h-full' : undefined)}>
        {spacer('border-r border-b border-gray-200')}
        {padBtn('Flip horizontal', () => onChange({ flip_h: h ? null : true }), FlipHorizontal, h, 'border-r border-b border-gray-200')}
        {spacer('border-b border-gray-200')}
        {padBtn('Rotate left 90°', () => stepRotate(-90), RotateCcw, r !== 0, 'border-r border-b border-gray-200')}
        <button
          type="button"
          title="Reset flip & rotate"
          disabled={disabled || !active}
          onClick={onReset}
          className={cn(
            s.cell,
            'flex items-center justify-center transition-colors touch-none select-none',
            'border-r border-b border-gray-200',
            active && !disabled ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'text-gray-600 hover:bg-gray-50',
            disabled && 'opacity-40 pointer-events-none',
          )}
        >
          <span className={cn('font-bold leading-none', size === 'mini' || size === 'transformPad' ? 'text-[6px]' : 'text-[8px]')}>·</span>
        </button>
        {padBtn('Rotate right 90°', () => stepRotate(90), RotateCw, r !== 0, 'border-b border-gray-200')}
        {spacer('border-r border-gray-200')}
        {padBtn('Flip vertical', () => onChange({ flip_v: v ? null : true }), FlipVertical, v, 'border-r border-gray-200')}
        {spacer('')}
      </div>
    </div>
  )
}

/** Docs-style line spacing + paragraph spacing — compact trigger for the design bar. */
export const LineSpacingToolbarButton = forwardRef(function LineSpacingToolbarButton({
  lineHeightRatio,
  active,
  size = 'compact',
  embedded = false,
  stacked = false,
  className,
  onClick,
  onMouseDown,
}: {
  lineHeightRatio?: number | null
  active?: boolean
  size?: ControlSize
  embedded?: boolean
  /** Fills lower half of wrap column — icon + label only, no side border. */
  stacked?: boolean
  className?: string
  onClick?: () => void
  onMouseDown?: (e: MouseEvent) => void
}, ref: React.Ref<HTMLButtonElement>) {
  const s = sizeStyles[size]
  const label = formatLineHeightLabel(lineHeightRatio)

  return (
    <button
      ref={ref}
      type="button"
      title="Line & paragraph spacing"
      onClick={onClick}
      onMouseDown={onMouseDown}
      className={cn(
        stacked
          ? 'flex h-full w-full flex-col items-center justify-center gap-0 transition-colors'
          : cn(s.cell, 'flex shrink-0 flex-col items-center justify-center gap-0 transition-colors'),
        !stacked && embedded && 'border-l border-gray-200',
        active ? 'bg-primary/10 text-primary' : 'bg-white text-gray-700 hover:bg-gray-50',
        className,
      )}
    >
      <AlignVerticalSpaceBetween className="w-3 h-3" strokeWidth={2} />
      <span className="text-[8px] font-semibold leading-none">{label}</span>
      {!stacked ? <ChevronDown className="w-2 h-2 opacity-60" /> : null}
    </button>
  )
})

/** Dropdown body — line spacing presets, paragraph spacing, line break. */
export function LineSpacingMenuContent({
  lineHeightRatio,
  spaceBeforePx = 0,
  spaceAfterPx,
  onLineHeightChange,
  onAddSpaceBefore,
  onRemoveSpaceBefore,
  onAddSpaceAfter,
  onRemoveSpaceAfter,
  onInsertLineBreak,
  size = 'compact',
}: {
  lineHeightRatio?: number | null
  spaceBeforePx?: number
  spaceAfterPx?: number | null
  onLineHeightChange: (ratio: number | null) => void
  onAddSpaceBefore: () => void
  onRemoveSpaceBefore: () => void
  onAddSpaceAfter: () => void
  onRemoveSpaceAfter: () => void
  onInsertLineBreak?: () => void
  size?: ControlSize
}) {
  const s = sizeStyles[size]
  const activeRatio = normalizeLineHeightRatio(lineHeightRatio)

  return (
    <div className="min-w-[210px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-2xl">
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
        Line spacing
      </div>
      {LINE_HEIGHT_RATIO_PRESETS.map(ratio => {
        const active = activeRatio === ratio
        return (
          <button
            key={ratio}
            type="button"
            onClick={() => onLineHeightChange(ratio)}
            className={cn(
              'flex w-full items-center gap-2 px-3 text-left font-medium transition-colors',
              s.caseBtn,
              active ? 'bg-primary/10 text-primary' : 'text-gray-800 hover:bg-gray-50',
            )}
          >
            <span className="w-4 shrink-0">{active ? <Check className="w-3.5 h-3.5" /> : null}</span>
            <span>{Number.isInteger(ratio) ? ratio.toFixed(1) : ratio}</span>
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => onLineHeightChange(null)}
        className={cn(
          'flex w-full items-center gap-2 border-t border-border bg-muted/25 px-3 text-left font-medium text-gray-600 transition-colors hover:bg-gray-50',
          s.caseBtn,
        )}
      >
        <span className="w-4 shrink-0">{activeRatio == null ? <Check className="w-3.5 h-3.5" /> : null}</span>
        <span>Auto</span>
      </button>

      <div className="my-1 border-t border-gray-200" />

      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
        Paragraph spacing
      </div>
      <div className="px-3 py-0.5 text-[10px] font-semibold text-gray-500">Before</div>
      <button
        type="button"
        onClick={onAddSpaceBefore}
        className={cn(
          'flex w-full items-center gap-2 px-3 text-left text-gray-800 transition-colors hover:bg-gray-50',
          s.caseBtn,
        )}
      >
        <ArrowDownToLine className="w-3.5 h-3.5 shrink-0 text-gray-500" />
        <span className="text-xs font-medium">
          Add space before
          {spaceBeforePx > 0 ? (
            <span className="ml-1 text-[10px] text-gray-400">({spaceBeforePx}px)</span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemoveSpaceBefore}
        disabled={spaceBeforePx <= 0}
        className={cn(
          'flex w-full items-center gap-2 px-3 text-left text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40',
          s.caseBtn,
        )}
      >
        <ArrowUpFromLine className="w-3.5 h-3.5 shrink-0 text-gray-500" />
        <span className="text-xs font-medium">Remove space before</span>
      </button>

      <div className="px-3 py-0.5 text-[10px] font-semibold text-gray-500">After</div>
      <button
        type="button"
        onClick={onAddSpaceAfter}
        className={cn(
          'flex w-full items-center gap-2 px-3 text-left text-gray-800 transition-colors hover:bg-gray-50',
          s.caseBtn,
        )}
      >
        <ArrowDownToLine className="w-3.5 h-3.5 shrink-0 text-gray-500" />
        <span className="text-xs font-medium">
          Add space after
          {spaceAfterPx != null && spaceAfterPx > 0 ? (
            <span className="ml-1 text-[10px] text-gray-400">({spaceAfterPx}px)</span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemoveSpaceAfter}
        className={cn(
          'flex w-full items-center gap-2 px-3 text-left text-gray-800 transition-colors hover:bg-gray-50',
          s.caseBtn,
        )}
      >
        <ArrowUpFromLine className="w-3.5 h-3.5 shrink-0 text-gray-500" />
        <span className="text-xs font-medium">
          Remove space after
          <span className="ml-1 text-[10px] text-gray-400">
            ({spaceAfterPx == null ? 'Auto' : `${spaceAfterPx}px`})
          </span>
        </span>
      </button>

      {onInsertLineBreak ? (
        <>
          <div className="my-1 border-t border-gray-200" />
          <button
            type="button"
            onClick={onInsertLineBreak}
            className={cn(
              'flex w-full items-center gap-2 px-3 text-left text-gray-800 transition-colors hover:bg-gray-50',
              s.caseBtn,
            )}
          >
            <CornerDownLeft className="w-3.5 h-3.5 shrink-0 text-gray-500" />
            <span className="text-xs font-medium">Insert line break</span>
          </button>
        </>
      ) : null}
    </div>
  )
}

/** Full Composition typography block for the Props side panel. */
export function TypographyCompositionFields({
  fontFamily,
  onFontFamilyChange,
  fontSizePx,
  onFontSizeChange,
  textCaseId,
  onTextCaseSelect,
  textAlign,
  verticalAlign,
  textWrap,
  onTextAlignChange,
  onVerticalAlignChange,
  onTextWrapChange,
  compact = false,
}: {
  fontFamily?: string | null
  onFontFamilyChange?: (font: string | null) => void
  fontSizePx: number | null | undefined
  onFontSizeChange: (px: number | null) => void
  textCaseId: TextCaseMenuId
  onTextCaseSelect: (id: TextCaseMenuId) => void
  textAlign?: TextAlignH | string | null
  verticalAlign?: TextAlignV | string | null
  textWrap?: boolean | null
  onTextAlignChange?: (align: TextAlignH) => void
  onVerticalAlignChange?: (align: TextAlignV) => void
  onTextWrapChange?: (wrap: boolean) => void
  /** Slim layout for section edit side panel — no helper paragraphs. */
  compact?: boolean
}) {
  const blockGap = compact ? 'space-y-2' : 'space-y-3'
  const fieldLabel = compact
    ? 'text-[11px] font-medium text-muted-foreground'
    : 'text-xs font-medium text-gray-500'

  return (
    <div className={blockGap}>
      {onTextAlignChange && onVerticalAlignChange && onTextWrapChange && (
        <div className="space-y-1">
          <div className={fieldLabel}>Text position in field</div>
          <TextFieldAlignGrid
            size={compact ? 'compact' : 'panel'}
            textAlign={textAlign}
            verticalAlign={verticalAlign}
            textWrap={textWrap}
            onTextAlignChange={onTextAlignChange}
            onVerticalAlignChange={onVerticalAlignChange}
            onTextWrapChange={onTextWrapChange}
          />
          {!compact ? (
            <p className="text-xs leading-relaxed text-gray-400">
              Click a text field on the canvas first for per-field alignment, or set section-wide defaults here.
            </p>
          ) : null}
        </div>
      )}

      {onFontFamilyChange ? (
        <div className="space-y-1">
          <div className={fieldLabel}>Font family</div>
          <FontFamilyControl
            value={fontFamily}
            onChange={onFontFamilyChange}
            size={compact ? 'compact' : 'panel'}
          />
          {!compact ? (
            <p className="text-xs leading-relaxed text-gray-400">
              Auto uses your site heading/body fonts. Pick a font to override this field only.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1">
        <div className={fieldLabel}>Font size (px)</div>
        <FontSizePxControl valuePx={fontSizePx} onChange={onFontSizeChange} size={compact ? 'compact' : 'panel'} />
        {!compact ? (
          <p className="text-xs leading-relaxed text-gray-400">
            Px sizing overrides XS–2X scale. Auto uses theme + scale only.
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <div className={fieldLabel}>Text case</div>
        {compact ? (
          <TextCaseChipRow activeId={textCaseId} onSelect={onTextCaseSelect} />
        ) : (
          <TextCaseList activeId={textCaseId} onSelect={onTextCaseSelect} size="panel" />
        )}
        {!compact ? (
          <p className="text-xs leading-relaxed text-gray-400">
            Default clears CSS case. Sentence / toggle rewrite stored text (skips URLs and nav links).
          </p>
        ) : null}
      </div>
    </div>
  )
}
