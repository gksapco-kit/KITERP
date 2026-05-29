import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  createTrustBadge,
  defaultTrustBadges,
  SECURE_CHECKOUT_DEFAULTS,
} from '../../lib/secureCheckoutDefaults'
import type { Block, TrustBadgeItem } from '../../types/builder'

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

const ICON_OPTIONS: { value: TrustBadgeItem['icon']; label: string }[] = [
  { value: 'lock', label: 'Lock' },
  { value: 'shield', label: 'Shield' },
  { value: 'truck', label: 'Truck' },
  { value: 'refresh', label: 'Returns / refresh' },
  { value: 'award', label: 'Award' },
  { value: 'check', label: 'Checkmark' },
  { value: 'credit-card', label: 'Credit card' },
  { value: 'headphones', label: 'Support' },
]

interface SecureCheckoutPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function SecureCheckoutPropertiesFields({ block, onChange }: SecureCheckoutPropertiesFieldsProps) {
  const p = block.props
  const badges = p.trustBadges ?? defaultTrustBadges()
  const layout = p.secureCheckoutLayout ?? SECURE_CHECKOUT_DEFAULTS.secureCheckoutLayout
  const [expanded, setExpanded] = useState<number | null>(null)

  const updateBadges = (next: TrustBadgeItem[]) => onChange({ trustBadges: next })

  const updateBadge = (index: number, item: TrustBadgeItem) => {
    const next = [...badges]
    next[index] = item
    updateBadges(next)
  }

  const removeBadge = (index: number) => {
    updateBadges(badges.filter((_, i) => i !== index))
    if (expanded === index) setExpanded(null)
    else if (expanded != null && expanded > index) setExpanded(expanded - 1)
  }

  const addBadge = () => {
    const next = [...badges, createTrustBadge({ title: `Badge ${badges.length + 1}` })]
    updateBadges(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Secure Checkout</p>

      <Field label="Section title">
        <input
          className={inputClass}
          value={p.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Shop with confidence"
        />
      </Field>

      <Field label="Section subtitle">
        <input
          className={inputClass}
          value={p.subtitle ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Trusted by thousands of customers"
        />
      </Field>

      <Field label="Layout">
        <select
          className={inputClass}
          value={layout}
          onChange={(e) =>
            onChange({ secureCheckoutLayout: e.target.value as 'grid' | 'row' | 'banner' | 'compact' })
          }
        >
          <option value="grid">Grid cards</option>
          <option value="row">Horizontal rows</option>
          <option value="banner">Banner strip</option>
          <option value="compact">Compact pills</option>
        </select>
      </Field>

      <ToggleField
        label="Show secure highlight banner"
        checked={p.showSecureHighlight !== false}
        onChange={(v) => onChange({ showSecureHighlight: v })}
      />

      {p.showSecureHighlight !== false && layout !== 'compact' && (
        <>
          <Field label="Highlight title">
            <input
              className={inputClass}
              value={p.highlightTitle ?? SECURE_CHECKOUT_DEFAULTS.highlightTitle}
              onChange={(e) => onChange({ highlightTitle: e.target.value })}
            />
          </Field>
          <Field label="Highlight subtitle">
            <textarea
              className={inputClass}
              rows={2}
              value={p.highlightSubtitle ?? SECURE_CHECKOUT_DEFAULTS.highlightSubtitle}
              onChange={(e) => onChange({ highlightSubtitle: e.target.value })}
            />
          </Field>
        </>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Trust badges ({badges.length})
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={addBadge}
              className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
            <button
              type="button"
              onClick={() => updateBadges(defaultTrustBadges())}
              className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Reset
            </button>
          </div>
        </div>

        <ul className="space-y-2">
          {badges.map((badge, i) => {
            const open = expanded === i
            return (
              <li key={badge.id ?? i} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2 p-2">
                  <input
                    type="checkbox"
                    checked={badge.enabled !== false}
                    onChange={(e) => updateBadge(i, { ...badge, enabled: e.target.checked })}
                    className="h-4 w-4 shrink-0 rounded border-gray-300"
                    title="Show on page"
                  />
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : i)}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                  >
                    {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{badge.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBadge(i)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {open && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <Field label="Title">
                      <input
                        className={inputClass}
                        value={badge.title}
                        onChange={(e) => updateBadge(i, { ...badge, title: e.target.value })}
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={badge.description ?? ''}
                        onChange={(e) => updateBadge(i, { ...badge, description: e.target.value })}
                      />
                    </Field>
                    <Field label="Icon">
                      <select
                        className={inputClass}
                        value={badge.icon ?? 'shield'}
                        onChange={(e) =>
                          updateBadge(i, { ...badge, icon: e.target.value as TrustBadgeItem['icon'] })
                        }
                      >
                        {ICON_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </Field>
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
