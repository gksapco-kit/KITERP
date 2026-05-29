import type { Block, BlockStyles } from '../../types/builder'
import { DEFAULT_THEME_GRADIENT_FROM, DEFAULT_THEME_GRADIENT_TO, themeUsesGradient } from '../../lib/themeGradientUtils'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

function ColorInput({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string
  value?: string
  fallback: string
  onChange: (v: string) => void
}) {
  const hex = value?.startsWith('#') ? value : fallback
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="color" className="h-10 w-10 shrink-0 cursor-pointer rounded border border-gray-200" value={hex} onChange={(e) => onChange(e.target.value)} />
        <input className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={fallback} />
      </div>
    </Field>
  )
}

interface ThemeGradientFieldsProps {
  block: Block
  /** Current theme prop value (e.g. props.stateScreenTheme) */
  theme?: string
  onStylesChange: (styles: Partial<BlockStyles>) => void
  /** Override which theme values show gradient controls */
  showForThemes?: string[]
}

export function ThemeGradientFields({ block, theme, onStylesChange, showForThemes }: ThemeGradientFieldsProps) {
  const active = showForThemes ? showForThemes.includes(theme ?? '') : themeUsesGradient(theme)
  if (!active) return null

  const s = block.styles

  return (
    <div className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Gradient colors</p>
      <p className="text-[11px] leading-snug text-gray-500">Used for gradient / dark / brand theme backgrounds and accents.</p>
      <ColorInput
        label="Gradient start"
        value={s.gradientFrom}
        fallback={DEFAULT_THEME_GRADIENT_FROM}
        onChange={(gradientFrom) => onStylesChange({ gradientFrom, backgroundMode: 'gradient' })}
      />
      <ColorInput
        label="Gradient end"
        value={s.gradientTo}
        fallback={DEFAULT_THEME_GRADIENT_TO}
        onChange={(gradientTo) => onStylesChange({ gradientTo, backgroundMode: 'gradient' })}
      />
    </div>
  )
}
