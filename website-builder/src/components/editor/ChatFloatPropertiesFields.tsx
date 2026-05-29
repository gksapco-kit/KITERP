import type { Block, BlockStyles } from '../../types/builder'
import { CHAT_FLOAT_DEFAULTS } from '../../lib/chatFloatDefaults'

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
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
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

interface ChatFloatPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function ChatFloatPropertiesFields({ block, onChange, onStylesChange }: ChatFloatPropertiesFieldsProps) {
  const p = block.props
  const s = block.styles
  const provider = p.chatFloatProvider ?? CHAT_FLOAT_DEFAULTS.chatFloatProvider
  const variant = p.chatFloatVariant ?? CHAT_FLOAT_DEFAULTS.chatFloatVariant

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Chat / WhatsApp</p>

      <Field label="Link type">
        <select
          className={inputClass}
          value={provider}
          onChange={(e) => onChange({ chatFloatProvider: e.target.value as 'whatsapp' | 'custom' })}
        >
          <option value="whatsapp">WhatsApp</option>
          <option value="custom">Custom URL</option>
        </select>
      </Field>

      {provider === 'whatsapp' ? (
        <>
          <Field label="Phone number" hint="Country code + number, digits only (e.g. 15551234567)">
            <input
              className={inputClass}
              value={p.chatPhoneNumber ?? ''}
              onChange={(e) => onChange({ chatPhoneNumber: e.target.value })}
              placeholder="15551234567"
            />
          </Field>
          <Field label="Prefill message">
            <textarea
              className={inputClass}
              rows={2}
              value={p.chatPrefillMessage ?? ''}
              onChange={(e) => onChange({ chatPrefillMessage: e.target.value })}
              placeholder="Hi! I have a question..."
            />
          </Field>
        </>
      ) : (
        <Field label="Chat URL">
          <input
            className={inputClass}
            value={p.chatUrl ?? ''}
            onChange={(e) => onChange({ chatUrl: e.target.value })}
            placeholder="https://m.me/yourpage or any chat link"
          />
        </Field>
      )}

      <Field label="Button style">
        <select
          className={inputClass}
          value={variant}
          onChange={(e) => onChange({ chatFloatVariant: e.target.value as 'icon' | 'pill' | 'bubble' })}
        >
          <option value="bubble">Greeting bubble + button</option>
          <option value="pill">Pill with label</option>
          <option value="icon">Icon only</option>
        </select>
      </Field>

      {variant !== 'icon' && (
        <Field label="Button label">
          <input
            className={inputClass}
            value={p.buttonText ?? ''}
            onChange={(e) => onChange({ buttonText: e.target.value })}
            placeholder="Chat on WhatsApp"
          />
        </Field>
      )}

      {variant === 'bubble' && (
        <Field label="Greeting message">
          <textarea
            className={inputClass}
            rows={2}
            value={p.chatGreeting ?? ''}
            onChange={(e) => onChange({ chatGreeting: e.target.value })}
            placeholder="Need help? Message us!"
          />
        </Field>
      )}

      <Field label="Position on page">
        <select
          className={inputClass}
          value={p.chatFloatPosition ?? CHAT_FLOAT_DEFAULTS.chatFloatPosition}
          onChange={(e) =>
            onChange({ chatFloatPosition: e.target.value as 'bottom-right' | 'bottom-left' })
          }
        >
          <option value="bottom-right">Bottom right</option>
          <option value="bottom-left">Bottom left</option>
        </select>
      </Field>

      <ToggleField
        label="Pulse animation"
        checked={p.showChatPulse !== false}
        onChange={(v) => onChange({ showChatPulse: v })}
      />

      <ToggleField
        label="Show icon"
        checked={p.showChatIcon !== false}
        onChange={(v) => onChange({ showChatIcon: v })}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Appearance</p>

      <ColorInput
        label="Background color"
        value={s.backgroundColor}
        fallback="#25D366"
        onChange={(backgroundColor) => onStylesChange({ backgroundColor })}
      />

      <ColorInput
        label="Text / icon color"
        value={s.textColor}
        fallback="#ffffff"
        onChange={(textColor) => onStylesChange({ textColor })}
      />

      <Field label="Padding">
        <input
          className={inputClass}
          value={s.padding ?? ''}
          onChange={(e) => onStylesChange({ padding: e.target.value || undefined })}
          placeholder="14px"
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
          placeholder="0 4px 20px rgba(37, 211, 102, 0.45)"
        />
      </Field>
    </div>
  )
}
