import type { Block } from '../../types/builder'
import { SIMPLE_LOADER_DEFAULTS } from '../../lib/simpleLoaderDefaults'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </label>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300"
      />
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

interface SimpleLoaderPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function SimpleLoaderPropertiesFields({ block, onChange }: SimpleLoaderPropertiesFieldsProps) {
  const p = block.props
  const style = p.simpleLoaderStyle ?? SIMPLE_LOADER_DEFAULTS.simpleLoaderStyle
  const size = p.simpleLoaderSize ?? SIMPLE_LOADER_DEFAULTS.simpleLoaderSize
  const color = p.simpleLoaderColor ?? SIMPLE_LOADER_DEFAULTS.simpleLoaderColor
  const align = p.simpleLoaderAlign ?? SIMPLE_LOADER_DEFAULTS.simpleLoaderAlign
  const showLabel = p.showLoaderLabel ?? SIMPLE_LOADER_DEFAULTS.showLoaderLabel

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Simple Loader</p>

      <Field label="Loader style">
        <select
          className={inputClass}
          value={style}
          onChange={(e) =>
            onChange({ simpleLoaderStyle: e.target.value as 'spinner' | 'dots' | 'ring' | 'bars' })
          }
        >
          <option value="spinner">Spinner</option>
          <option value="dots">Dots</option>
          <option value="ring">Ring</option>
          <option value="bars">Bars</option>
        </select>
      </Field>

      <Field label="Size">
        <select
          className={inputClass}
          value={size}
          onChange={(e) => onChange({ simpleLoaderSize: e.target.value as 'sm' | 'md' | 'lg' })}
        >
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
        </select>
      </Field>

      <Field label="Color">
        <div className="flex gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => onChange({ simpleLoaderColor: e.target.value })}
            className="h-10 w-12 cursor-pointer rounded-lg border border-gray-200"
          />
          <input
            className={inputClass}
            value={color}
            onChange={(e) => onChange({ simpleLoaderColor: e.target.value })}
            placeholder="#4f46e5"
          />
        </div>
      </Field>

      <Field label="Alignment">
        <select
          className={inputClass}
          value={align}
          onChange={(e) => onChange({ simpleLoaderAlign: e.target.value as 'left' | 'center' | 'right' })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>

      <ToggleField label="Show label" checked={showLabel} onChange={(v) => onChange({ showLoaderLabel: v })} />

      {showLabel && (
        <Field label="Label text">
          <input
            className={inputClass}
            value={p.text ?? ''}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Loading..."
          />
        </Field>
      )}

      <Field label="Helper text (optional)">
        <input
          className={inputClass}
          value={p.subtitle ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Please wait while we fetch your data"
        />
      </Field>
    </div>
  )
}
