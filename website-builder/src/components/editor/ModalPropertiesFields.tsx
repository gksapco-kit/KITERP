import type { Block, BlockStyles } from '../../types/builder'
import type { ModalIcon, ModalLayout } from '../../lib/modalStyles'

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
        <input className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={fallback} />
      </div>
    </Field>
  )
}

interface ModalPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function ModalPropertiesFields({ block, onChange, onStylesChange }: ModalPropertiesFieldsProps) {
  const p = block.props
  const s = block.styles
  const layout = (p.modalLayout ?? 'classic') as ModalLayout
  const isSplit = layout === 'split'

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Modal Dialog</p>

      <Field label="Layout style">
        <select
          className={inputClass}
          value={layout}
          onChange={(e) => onChange({ modalLayout: e.target.value as ModalLayout })}
        >
          <option value="classic">Classic card</option>
          <option value="glass">Frosted glass</option>
          <option value="sheet">Bottom sheet</option>
          <option value="split">Split with image</option>
        </select>
      </Field>

      <Field label="Header icon">
        <select
          className={inputClass}
          value={p.modalIcon ?? 'gift'}
          onChange={(e) => onChange({ modalIcon: e.target.value as ModalIcon })}
        >
          <option value="none">None</option>
          <option value="gift">Gift</option>
          <option value="sparkles">Sparkles</option>
          <option value="bell">Bell</option>
          <option value="percent">Percent</option>
          <option value="mail">Mail</option>
        </select>
      </Field>

      <Field label="Title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>

      <Field label="Message">
        <textarea className={inputClass} rows={3} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      {isSplit && (
        <>
          <Field label="Side image URL">
            <input className={inputClass} value={p.imageUrl ?? ''} onChange={(e) => onChange({ imageUrl: e.target.value })} />
          </Field>
          <Field label="Image alt text">
            <input className={inputClass} value={p.imageAlt ?? ''} onChange={(e) => onChange({ imageAlt: e.target.value })} />
          </Field>
        </>
      )}

      <Field label="Primary button">
        <input className={inputClass} value={p.buttonText ?? ''} onChange={(e) => onChange({ buttonText: e.target.value })} />
      </Field>

      <Field label="Primary link">
        <input className={inputClass} value={p.buttonLink ?? ''} onChange={(e) => onChange({ buttonLink: e.target.value })} placeholder="#products" />
      </Field>

      <Field label="Show secondary button">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={p.showModalSecondary !== false} onChange={(e) => onChange({ showModalSecondary: e.target.checked })} />
          Display cancel / dismiss action
        </label>
      </Field>

      {p.showModalSecondary !== false && (
        <Field label="Secondary button">
          <input className={inputClass} value={p.buttonText2 ?? ''} onChange={(e) => onChange({ buttonText2: e.target.value })} />
        </Field>
      )}

      <Field label="Show on page load">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={p.modalAutoShow !== false} onChange={(e) => onChange({ modalAutoShow: e.target.checked })} />
          Auto-open in preview and live site
        </label>
      </Field>

      <Field label="Close button">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={p.showModalClose !== false} onChange={(e) => onChange({ showModalClose: e.target.checked })} />
          Allow visitors to close
        </label>
      </Field>

      <Field label="Backdrop">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={p.showModalBackdrop !== false} onChange={(e) => onChange({ showModalBackdrop: e.target.checked })} />
          Dim page behind modal
        </label>
      </Field>

      {p.showModalBackdrop !== false && (
        <>
          <Field label="Backdrop blur">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={p.modalBackdropBlur !== false} onChange={(e) => onChange({ modalBackdropBlur: e.target.checked })} />
              Frosted backdrop effect
            </label>
          </Field>
          <Field label="Backdrop darkness" hint="0 = transparent, 1 = solid">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={p.modalOverlayOpacity ?? 0.55}
              onChange={(e) => onChange({ modalOverlayOpacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </Field>
        </>
      )}

      <Field label="Re-open button label">
        <input className={inputClass} value={p.modalTriggerText ?? ''} onChange={(e) => onChange({ modalTriggerText: e.target.value })} />
      </Field>

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Appearance</p>

      <ColorInput label="Panel background" value={s.backgroundColor} fallback="#ffffff" onChange={(backgroundColor) => onStylesChange({ backgroundColor })} />
      <ColorInput label="Text color" value={s.textColor} fallback="#111827" onChange={(textColor) => onStylesChange({ textColor })} />
      <ColorInput label="Button gradient start" value={s.gradientFrom} fallback="#7c3aed" onChange={(gradientFrom) => onStylesChange({ gradientFrom })} />
      <ColorInput label="Button gradient end" value={s.gradientTo} fallback="#a855f7" onChange={(gradientTo) => onStylesChange({ gradientTo })} />

      <Field label="Border radius">
        <input className={inputClass} value={s.borderRadius ?? ''} onChange={(e) => onStylesChange({ borderRadius: e.target.value || undefined })} placeholder="20px" />
      </Field>

      <Field label="Shadow">
        <input className={inputClass} value={s.boxShadow ?? ''} onChange={(e) => onStylesChange({ boxShadow: e.target.value || undefined })} placeholder="0 25px 50px -12px rgba(0,0,0,0.25)" />
      </Field>
    </div>
  )
}
