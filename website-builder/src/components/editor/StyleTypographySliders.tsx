import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  FONT_WEIGHT_STEP,
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
} from '../../lib/styleConstants'
import type { BlockStyles } from '../../types/builder'

function Field({ label, valueLabel, children }: { label: string; valueLabel: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs tabular-nums text-gray-400">{valueLabel}</span>
      </div>
      {children}
    </label>
  )
}

const rangeClass = 'h-2 w-full cursor-pointer accent-brand-600'

function parseFontSizePx(value?: string): number | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  const px = trimmed.match(/^(\d+(?:\.\d+)?)px$/i)
  if (px) return Number(px[1])
  const rem = trimmed.match(/^(\d+(?:\.\d+)?)rem$/i)
  if (rem) return Math.round(Number(rem[1]) * 16)
  const num = Number(trimmed)
  if (Number.isFinite(num) && num > 0) return num
  return null
}

function parseLineHeight(value?: string): number | null {
  if (!value?.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseLetterSpacingEm(value?: string): number | null {
  if (!value?.trim()) return null
  const m = value.trim().match(/^(-?\d+(?:\.\d+)?)em$/)
  return m ? Number(m[1]) : null
}

interface StyleTypographySlidersProps {
  styles: BlockStyles
  onChange: (patch: Partial<BlockStyles>) => void
}

export function StyleTypographySliders({ styles, onChange }: StyleTypographySlidersProps) {
  const fontSizePx = parseFontSizePx(styles.fontSize) ?? 16
  const fontWeight = Number(styles.fontWeight) || 400
  const lineHeight = parseLineHeight(styles.lineHeight) ?? 1.5
  const letterEm = parseLetterSpacingEm(styles.letterSpacing) ?? 0

  const lineHeightSlider = Math.round(lineHeight * 100)
  const letterSlider = Math.round(letterEm * 1000)

  return (
    <div className="space-y-4">
      <Field label="Font size" valueLabel={`${fontSizePx}px`}>
        <input
          type="range"
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          step={1}
          className={rangeClass}
          value={fontSizePx}
          onChange={(e) => onChange({ fontSize: `${e.target.value}px` })}
        />
      </Field>

      <Field label="Font weight" valueLabel={String(fontWeight)}>
        <input
          type="range"
          min={FONT_WEIGHT_MIN}
          max={FONT_WEIGHT_MAX}
          step={FONT_WEIGHT_STEP}
          className={rangeClass}
          value={fontWeight}
          onChange={(e) => onChange({ fontWeight: e.target.value })}
        />
      </Field>

      <Field label="Line height" valueLabel={lineHeight.toFixed(2)}>
        <input
          type="range"
          min={LINE_HEIGHT_MIN}
          max={LINE_HEIGHT_MAX}
          step={5}
          className={rangeClass}
          value={lineHeightSlider}
          onChange={(e) => onChange({ lineHeight: String(Number(e.target.value) / 100) })}
        />
      </Field>

      <Field label="Letter spacing" valueLabel={`${letterEm.toFixed(3)}em`}>
        <input
          type="range"
          min={LETTER_SPACING_MIN}
          max={LETTER_SPACING_MAX}
          step={5}
          className={rangeClass}
          value={letterSlider}
          onChange={(e) => onChange({ letterSpacing: `${Number(e.target.value) / 1000}em` })}
        />
      </Field>
    </div>
  )
}
