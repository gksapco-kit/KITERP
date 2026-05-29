import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  createPaymentMethod,
  defaultPaymentMethods,
  PAYMENT_METHODS_DEFAULTS,
} from '../../lib/paymentMethodsDefaults'
import type { Block, PaymentMethodItem } from '../../types/builder'

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

const PRESET_OPTIONS = [
  { id: 'visa', name: 'Visa', brandColor: '#1a1f71', textColor: '#ffffff' },
  { id: 'mastercard', name: 'Mastercard', brandColor: '#eb001b', textColor: '#ffffff' },
  { id: 'amex', name: 'Amex', brandColor: '#006fcf', textColor: '#ffffff' },
  { id: 'paypal', name: 'PayPal', brandColor: '#003087', textColor: '#ffffff' },
  { id: 'applepay', name: 'Apple Pay', brandColor: '#000000', textColor: '#ffffff' },
  { id: 'googlepay', name: 'Google Pay', brandColor: '#ffffff', textColor: '#3c4043' },
  { id: 'upi', name: 'UPI', brandColor: '#097939', textColor: '#ffffff' },
  { id: 'cod', name: 'Cash on delivery', brandColor: '#f3f4f6', textColor: '#374151' },
]

interface PaymentMethodsPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function PaymentMethodsPropertiesFields({ block, onChange }: PaymentMethodsPropertiesFieldsProps) {
  const p = block.props
  const methods = p.paymentMethods ?? defaultPaymentMethods()
  const layout = p.paymentMethodsLayout ?? PAYMENT_METHODS_DEFAULTS.paymentMethodsLayout
  const [expanded, setExpanded] = useState<number | null>(null)

  const updateMethods = (next: PaymentMethodItem[]) => onChange({ paymentMethods: next })

  const updateMethod = (index: number, item: PaymentMethodItem) => {
    const next = [...methods]
    next[index] = item
    updateMethods(next)
  }

  const removeMethod = (index: number) => {
    updateMethods(methods.filter((_, i) => i !== index))
    if (expanded === index) setExpanded(null)
    else if (expanded != null && expanded > index) setExpanded(expanded - 1)
  }

  const addCustom = () => {
    const next = [...methods, createPaymentMethod({ name: 'New method' })]
    updateMethods(next)
    setExpanded(next.length - 1)
  }

  const addPreset = (presetId: string) => {
    const preset = PRESET_OPTIONS.find((x) => x.id === presetId)
    if (!preset) return
    if (methods.some((m) => m.id === preset.id || m.name === preset.name)) return
    updateMethods([...methods, { ...preset, enabled: true }])
  }

  const resetPresets = () => updateMethods(defaultPaymentMethods())

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Payment Methods</p>

      <Field label="Section title">
        <input
          className={inputClass}
          value={p.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="We accept"
        />
      </Field>

      <Field label="Section subtitle">
        <input
          className={inputClass}
          value={p.subtitle ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Pay safely with your preferred method"
        />
      </Field>

      <Field label="Layout">
        <select
          className={inputClass}
          value={layout}
          onChange={(e) => onChange({ paymentMethodsLayout: e.target.value as 'card' | 'inline' | 'compact' })}
        >
          <option value="card">Card (boxed)</option>
          <option value="inline">Inline</option>
          <option value="compact">Compact strip</option>
        </select>
      </Field>

      <ToggleField
        label="Show secure checkout badge"
        checked={p.showSecureBadge !== false}
        onChange={(v) => onChange({ showSecureBadge: v })}
      />

      {p.showSecureBadge !== false && (
        <Field label="Secure checkout text">
          <input
            className={inputClass}
            value={p.secureText ?? PAYMENT_METHODS_DEFAULTS.secureText}
            onChange={(e) => onChange({ secureText: e.target.value })}
          />
        </Field>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Methods ({methods.length})
          </span>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={addCustom}
              className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
            >
              <Plus className="h-3.5 w-3.5" /> Custom
            </button>
            <button
              type="button"
              onClick={resetPresets}
              className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Reset defaults
            </button>
          </div>
        </div>

        <Field label="Add preset" hint="Skips if already in the list">
          <select
            className={inputClass}
            value=""
            onChange={(e) => {
              if (e.target.value) addPreset(e.target.value)
              e.target.value = ''
            }}
          >
            <option value="">Choose preset…</option>
            {PRESET_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </Field>

        <ul className="mt-2 space-y-2">
          {methods.map((method, i) => {
            const open = expanded === i
            return (
              <li key={method.id ?? i} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2 p-2">
                  <input
                    type="checkbox"
                    checked={method.enabled !== false}
                    onChange={(e) => updateMethod(i, { ...method, enabled: e.target.checked })}
                    className="h-4 w-4 shrink-0 rounded border-gray-300"
                    title="Show on page"
                  />
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : i)}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                  >
                    {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{method.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMethod(i)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {open && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <Field label="Label">
                      <input
                        className={inputClass}
                        value={method.name}
                        onChange={(e) => updateMethod(i, { ...method, name: e.target.value })}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Background">
                        <input
                          type="color"
                          className="h-10 w-full rounded border"
                          value={method.brandColor?.startsWith('#') ? method.brandColor : '#4f46e5'}
                          onChange={(e) => updateMethod(i, { ...method, brandColor: e.target.value })}
                        />
                      </Field>
                      <Field label="Text">
                        <input
                          type="color"
                          className="h-10 w-full rounded border"
                          value={method.textColor?.startsWith('#') ? method.textColor : '#ffffff'}
                          onChange={(e) => updateMethod(i, { ...method, textColor: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
