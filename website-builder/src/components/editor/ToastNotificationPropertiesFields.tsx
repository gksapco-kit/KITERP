import type { Block, BlockStyles } from '../../types/builder'
import type { ToastPosition, ToastVariant } from '../../lib/toastNotificationStyles'

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

interface ToastNotificationPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function ToastNotificationPropertiesFields({
  block,
  onChange,
  onStylesChange,
}: ToastNotificationPropertiesFieldsProps) {
  const p = block.props
  const s = block.styles

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Notification Toast</p>

      <Field label="Title">
        <input
          className={inputClass}
          value={p.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Item added to cart"
        />
      </Field>

      <Field label="Message">
        <textarea
          className={inputClass}
          rows={2}
          value={p.subtitle ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Optional details"
        />
      </Field>

      <Field label="Type">
        <select
          className={inputClass}
          value={p.toastVariant ?? 'success'}
          onChange={(e) => onChange({ toastVariant: e.target.value as ToastVariant })}
        >
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </Field>

      <Field label="Position on screen">
        <select
          className={inputClass}
          value={p.toastPosition ?? 'top-right'}
          onChange={(e) => onChange({ toastPosition: e.target.value as ToastPosition })}
        >
          <option value="top-right">Top right</option>
          <option value="top-left">Top left</option>
          <option value="top-center">Top center</option>
          <option value="bottom-right">Bottom right</option>
          <option value="bottom-left">Bottom left</option>
          <option value="bottom-center">Bottom center</option>
        </select>
      </Field>

      <Field label="Show on page load">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={p.toastAutoShow !== false}
            onChange={(e) => onChange({ toastAutoShow: e.target.checked })}
          />
          Auto-show in preview and live site
        </label>
      </Field>

      <Field label="Show icon">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={p.showToastIcon !== false}
            onChange={(e) => onChange({ showToastIcon: e.target.checked })}
          />
          Display type icon
        </label>
      </Field>

      <Field label="Dismiss button">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={p.showToastClose !== false}
            onChange={(e) => onChange({ showToastClose: e.target.checked })}
          />
          Allow visitors to close
        </label>
      </Field>

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Appearance</p>

      <ColorInput
        label="Background"
        value={s.backgroundColor}
        fallback="#ffffff"
        onChange={(backgroundColor) => onStylesChange({ backgroundColor })}
      />

      <ColorInput
        label="Text color"
        value={s.textColor}
        fallback="#111827"
        onChange={(textColor) => onStylesChange({ textColor })}
      />

      <Field label="Padding">
        <input
          className={inputClass}
          value={s.padding ?? ''}
          onChange={(e) => onStylesChange({ padding: e.target.value || undefined })}
          placeholder="14px 16px"
        />
      </Field>

      <Field label="Border radius">
        <input
          className={inputClass}
          value={s.borderRadius ?? ''}
          onChange={(e) => onStylesChange({ borderRadius: e.target.value || undefined })}
          placeholder="12px"
        />
      </Field>

      <Field label="Shadow">
        <input
          className={inputClass}
          value={s.boxShadow ?? ''}
          onChange={(e) => onStylesChange({ boxShadow: e.target.value || undefined })}
          placeholder="0 10px 40px rgba(0,0,0,0.12)"
        />
      </Field>

      <Field label="Max width">
        <input
          className={inputClass}
          value={s.maxWidth ?? ''}
          onChange={(e) => onStylesChange({ maxWidth: e.target.value || undefined })}
          placeholder="360px"
        />
      </Field>
    </div>
  )
}
