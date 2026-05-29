import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  createStatItem,
  defaultStatItems,
  STATS_COUNTER_DEFAULTS,
} from '../../lib/statsCounterDefaults'
import type { Block, StatCounterItem } from '../../types/builder'

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

const ICON_OPTIONS: { value: StatCounterItem['icon']; label: string }[] = [
  { value: undefined, label: 'None' },
  { value: 'users', label: 'Users' },
  { value: 'globe', label: 'Globe' },
  { value: 'star', label: 'Star' },
  { value: 'headphones', label: 'Support' },
  { value: 'trending', label: 'Trending' },
  { value: 'award', label: 'Award' },
  { value: 'zap', label: 'Zap' },
]

interface StatsCounterPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function StatsCounterPropertiesFields({ block, onChange }: StatsCounterPropertiesFieldsProps) {
  const p = block.props
  const items = p.statItems ?? defaultStatItems()
  const layout = p.statsCounterLayout ?? STATS_COUNTER_DEFAULTS.statsCounterLayout
  const [expanded, setExpanded] = useState<number | null>(null)

  const updateItems = (next: StatCounterItem[]) => onChange({ statItems: next })

  const updateItem = (index: number, item: StatCounterItem) => {
    const next = [...items]
    next[index] = item
    updateItems(next)
  }

  const removeItem = (index: number) => {
    updateItems(items.filter((_, i) => i !== index))
    if (expanded === index) setExpanded(null)
    else if (expanded != null && expanded > index) setExpanded(expanded - 1)
  }

  const addItem = () => {
    const next = [...items, createStatItem({ label: `Stat ${items.length + 1}` })]
    updateItems(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Stats Counter</p>

      <Field label="Section title">
        <input
          className={inputClass}
          value={p.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="By the numbers"
        />
      </Field>

      <Field label="Section subtitle">
        <input
          className={inputClass}
          value={p.subtitle ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Trusted worldwide"
        />
      </Field>

      <Field label="Layout">
        <select
          className={inputClass}
          value={layout}
          onChange={(e) =>
            onChange({ statsCounterLayout: e.target.value as 'grid' | 'row' | 'banner' | 'minimal' })
          }
        >
          <option value="grid">Grid cards</option>
          <option value="row">Row with dividers</option>
          <option value="banner">Dark banner</option>
          <option value="minimal">Minimal numbers</option>
        </select>
      </Field>

      {layout === 'row' && (
        <ToggleField
          label="Show dividers between stats"
          checked={p.statsDivider !== false}
          onChange={(v) => onChange({ statsDivider: v })}
        />
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Stats ({items.length})
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
            <button
              type="button"
              onClick={() => updateItems(defaultStatItems())}
              className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Reset
            </button>
          </div>
        </div>

        <ul className="space-y-2">
          {items.map((item, i) => {
            const open = expanded === i
            return (
              <li key={item.id ?? i} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2 p-2">
                  <input
                    type="checkbox"
                    checked={item.enabled !== false}
                    onChange={(e) => updateItem(i, { ...item, enabled: e.target.checked })}
                    className="h-4 w-4 shrink-0 rounded border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : i)}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                  >
                    {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">
                      {item.value} — {item.label}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {open && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Prefix">
                        <input
                          className={inputClass}
                          value={item.prefix ?? ''}
                          onChange={(e) => updateItem(i, { ...item, prefix: e.target.value || undefined })}
                          placeholder="$"
                        />
                      </Field>
                      <Field label="Value">
                        <input
                          className={inputClass}
                          value={item.value}
                          onChange={(e) => updateItem(i, { ...item, value: e.target.value })}
                          placeholder="50K+"
                        />
                      </Field>
                      <Field label="Suffix">
                        <input
                          className={inputClass}
                          value={item.suffix ?? ''}
                          onChange={(e) => updateItem(i, { ...item, suffix: e.target.value || undefined })}
                          placeholder="%"
                        />
                      </Field>
                    </div>
                    <Field label="Label">
                      <input
                        className={inputClass}
                        value={item.label}
                        onChange={(e) => updateItem(i, { ...item, label: e.target.value })}
                      />
                    </Field>
                    <Field label="Description (optional)">
                      <input
                        className={inputClass}
                        value={item.description ?? ''}
                        onChange={(e) => updateItem(i, { ...item, description: e.target.value || undefined })}
                      />
                    </Field>
                    <Field label="Icon">
                      <select
                        className={inputClass}
                        value={item.icon ?? ''}
                        onChange={(e) =>
                          updateItem(i, {
                            ...item,
                            icon: (e.target.value || undefined) as StatCounterItem['icon'],
                          })
                        }
                      >
                        {ICON_OPTIONS.map((opt) => (
                          <option key={opt.label} value={opt.value ?? ''}>
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
