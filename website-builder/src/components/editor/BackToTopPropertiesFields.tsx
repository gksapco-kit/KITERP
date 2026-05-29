import type { Block, BlockStyles } from '../../types/builder'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
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
        <input type="color" className="h-10 w-10 shrink-0 rounded border" value={hex} onChange={(e) => onChange(e.target.value)} />
        <input
          className={inputClass}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
        />
      </div>
    </Field>
  )
}

interface BackToTopPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function BackToTopPropertiesFields({ block, onChange, onStylesChange }: BackToTopPropertiesFieldsProps) {
  const p = block.props
  const s = block.styles

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Back to Top</p>

      <Field label="Button label">
        <input
          className={inputClass}
          value={p.buttonText ?? ''}
          onChange={(e) => onChange({ buttonText: e.target.value })}
          placeholder="Back to top"
        />
      </Field>

      <Field label="Show arrow icon">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={p.showBackToTopIcon !== false}
            onChange={(e) => onChange({ showBackToTopIcon: e.target.checked })}
          />
          Display icon
        </label>
      </Field>

      <Field label="Position on page">
        <select
          className={inputClass}
          value={p.backToTopPosition ?? 'bottom-right'}
          onChange={(e) =>
            onChange({
              backToTopPosition: e.target.value as 'bottom-right' | 'bottom-left' | 'bottom-center',
            })
          }
        >
          <option value="bottom-right">Bottom right</option>
          <option value="bottom-left">Bottom left</option>
          <option value="bottom-center">Bottom center</option>
        </select>
      </Field>

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Appearance</p>

      <ColorInput
        label="Background color"
        value={s.backgroundColor}
        fallback="#4f46e5"
        onChange={(backgroundColor) => onStylesChange({ backgroundColor })}
      />

      <ColorInput
        label="Text color"
        value={s.textColor}
        fallback="#ffffff"
        onChange={(textColor) => onStylesChange({ textColor })}
      />

      <Field label="Padding">
        <input
          className={inputClass}
          value={s.padding ?? ''}
          onChange={(e) => onStylesChange({ padding: e.target.value || undefined })}
          placeholder="12px 20px"
        />
      </Field>

      <Field label="Border radius">
        <input
          className={inputClass}
          value={s.borderRadius ?? ''}
          onChange={(e) => onStylesChange({ borderRadius: e.target.value || undefined })}
          placeholder="9999px"
        />
      </Field>

      <Field label="Shadow">
        <input
          className={inputClass}
          value={s.boxShadow ?? ''}
          onChange={(e) => onStylesChange({ boxShadow: e.target.value || undefined })}
          placeholder="0 4px 14px rgba(0,0,0,0.15)"
        />
      </Field>

      <Field label="Font size">
        <input
          className={inputClass}
          value={s.fontSize ?? ''}
          onChange={(e) => onStylesChange({ fontSize: e.target.value || undefined })}
          placeholder="e.g. 14px"
        />
      </Field>
    </div>
  )
}
