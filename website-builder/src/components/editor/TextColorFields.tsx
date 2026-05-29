import type { BlockStyles } from '../../types/builder'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

function ColorRow({
  label,
  value,
  fallback,
  onChange,
  onClear,
}: {
  label: string
  value?: string
  fallback: string
  onChange: (color: string) => void
  onClear?: () => void
}) {
  const hex = value?.startsWith('#') ? value : fallback
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="color" className="h-10 w-10 shrink-0 rounded border" value={hex} onChange={(e) => onChange(e.target.value)} />
        <input className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={fallback} />
        {onClear && value && (
          <button type="button" className="shrink-0 rounded-lg border border-gray-200 px-2 text-xs text-gray-500" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </Field>
  )
}

interface TextColorFieldsProps {
  styles: BlockStyles
  onChange: (patch: Partial<BlockStyles>) => void
  showTitle?: boolean
  showSubtitle?: boolean
  titleLabel?: string
  subtitleLabel?: string
}

export function TextColorFields({
  styles,
  onChange,
  showTitle = true,
  showSubtitle = true,
  titleLabel = 'Title color',
  subtitleLabel = 'Subtitle color',
}: TextColorFieldsProps) {
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Text colors</p>
      <p className="text-xs text-gray-500">Overrides default gray text — especially useful on dark section backgrounds.</p>

      {showTitle && (
        <ColorRow
          label={titleLabel}
          value={styles.titleColor}
          fallback="#111827"
          onChange={(titleColor) => onChange({ titleColor })}
          onClear={() => onChange({ titleColor: undefined })}
        />
      )}
      {showSubtitle && (
        <ColorRow
          label={subtitleLabel}
          value={styles.subtitleColor}
          fallback="#4b5563"
          onChange={(subtitleColor) => onChange({ subtitleColor })}
          onClear={() => onChange({ subtitleColor: undefined })}
        />
      )}
      <ColorRow
        label="Body / default text color"
        value={styles.textColor}
        fallback="#111827"
        onChange={(textColor) => onChange({ textColor })}
        onClear={() => onChange({ textColor: undefined })}
      />
    </div>
  )
}
