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

interface SearchBarPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function SearchBarPropertiesFields({ block, onChange, onStylesChange }: SearchBarPropertiesFieldsProps) {
  const p = block.props
  const s = block.styles

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Search Bar</p>

      <Field label="Placeholder">
        <input
          className={inputClass}
          value={p.placeholder ?? ''}
          onChange={(e) => onChange({ placeholder: e.target.value })}
          placeholder="Search…"
        />
      </Field>

      <Field label="Show search button">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={p.showSearchButton !== false}
            onChange={(e) => onChange({ showSearchButton: e.target.checked })}
          />
          Display button
        </label>
      </Field>

      {p.showSearchButton !== false && (
        <Field label="Button text">
          <input
            className={inputClass}
            value={p.buttonText ?? ''}
            onChange={(e) => onChange({ buttonText: e.target.value })}
            placeholder="Search"
          />
        </Field>
      )}

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Spacing & size</p>

      <Field label="Padding">
        <input
          className={inputClass}
          value={s.padding ?? ''}
          onChange={(e) => onStylesChange({ padding: e.target.value || undefined })}
          placeholder="e.g. 12px 16px"
        />
      </Field>

      <Field label="Margin">
        <input
          className={inputClass}
          value={s.margin ?? ''}
          onChange={(e) => onStylesChange({ margin: e.target.value || undefined })}
          placeholder="e.g. 0 0 16px"
        />
      </Field>

      <Field label="Width" hint="Leave empty for full width.">
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={s.width ?? ''}
            onChange={(e) => onStylesChange({ width: e.target.value || undefined })}
            placeholder="Auto"
          />
          {s.width && (
            <button
              type="button"
              className="shrink-0 rounded-lg border border-gray-200 px-2 text-xs text-gray-500 hover:bg-gray-50"
              onClick={() => onStylesChange({ width: undefined })}
            >
              Clear
            </button>
          )}
        </div>
      </Field>

      <Field label="Height">
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={s.height ?? ''}
            onChange={(e) => onStylesChange({ height: e.target.value || undefined })}
            placeholder="Auto"
          />
          {s.height && (
            <button
              type="button"
              className="shrink-0 rounded-lg border border-gray-200 px-2 text-xs text-gray-500 hover:bg-gray-50"
              onClick={() => onStylesChange({ height: undefined })}
            >
              Clear
            </button>
          )}
        </div>
      </Field>

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Border</p>

      <Field label="Border width">
        <input
          className={inputClass}
          value={s.borderWidth ?? ''}
          onChange={(e) => onStylesChange({ borderWidth: e.target.value || undefined })}
          placeholder="e.g. 1px"
        />
      </Field>

      <Field label="Border style">
        <select
          className={inputClass}
          value={s.borderStyle ?? ''}
          onChange={(e) => onStylesChange({ borderStyle: e.target.value || undefined })}
        >
          <option value="">Default</option>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
          <option value="none">None</option>
        </select>
      </Field>

      <ColorInput
        label="Border color"
        value={s.borderColor}
        fallback="#e5e7eb"
        onChange={(borderColor) => onStylesChange({ borderColor })}
      />

      <Field label="Border radius">
        <input
          className={inputClass}
          value={s.borderRadius ?? ''}
          onChange={(e) => onStylesChange({ borderRadius: e.target.value || undefined })}
          placeholder="e.g. 8px"
        />
      </Field>
    </div>
  )
}
