import type { ItemContentStyle } from '../../types/builder'
import { StyleTypographySliders } from './StyleTypographySliders'

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
  onChange: (v: string | undefined) => void
}) {
  const hex = value?.startsWith('#') ? value : fallback
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="color" className="h-9 w-9 shrink-0 rounded border" value={hex} onChange={(e) => onChange(e.target.value)} />
        <input className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} placeholder={fallback} />
      </div>
    </Field>
  )
}

interface ItemContentStyleFieldsProps {
  style?: ItemContentStyle
  onChange: (style: ItemContentStyle) => void
  titleLabel?: string
  descriptionLabel?: string
}

export function ItemContentStyleFields({
  style = {},
  onChange,
  titleLabel = 'Item title color',
  descriptionLabel = 'Item description color',
}: ItemContentStyleFieldsProps) {
  const patch = (p: Partial<ItemContentStyle>) => onChange({ ...style, ...p })

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-brand-200 bg-brand-50/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">This item only</p>
      <p className="text-[11px] text-gray-500">Overrides section defaults for this card/row.</p>

      <ColorInput label={titleLabel} value={style.titleColor} fallback="#111827" onChange={(titleColor) => patch({ titleColor })} />
      <ColorInput
        label={descriptionLabel}
        value={style.descriptionColor ?? style.textColor}
        fallback="#6b7280"
        onChange={(descriptionColor) => patch({ descriptionColor, textColor: descriptionColor })}
      />

      <p className="text-[11px] font-medium text-gray-500">Item typography</p>
      <StyleTypographySliders
        styles={{
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
        }}
        onChange={(s) => patch(s)}
      />
    </div>
  )
}
