import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  createProductTab,
  defaultProductTabs,
  PRODUCT_TABS_DEFAULTS,
} from '../../lib/productTabsDefaults'
import type { Block, ProductTabItem } from '../../types/builder'

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

interface ProductTabsPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function ProductTabsPropertiesFields({ block, onChange }: ProductTabsPropertiesFieldsProps) {
  const p = block.props
  const tabs = p.productTabs ?? defaultProductTabs()
  const layout = p.productTabsLayout ?? PRODUCT_TABS_DEFAULTS.productTabsLayout
  const [expanded, setExpanded] = useState<number | null>(null)

  const updateTabs = (next: ProductTabItem[]) => onChange({ productTabs: next })

  const updateTab = (index: number, item: ProductTabItem) => {
    const next = [...tabs]
    next[index] = item
    updateTabs(next)
  }

  const removeTab = (index: number) => {
    updateTabs(tabs.filter((_, i) => i !== index))
    if (expanded === index) setExpanded(null)
    else if (expanded != null && expanded > index) setExpanded(expanded - 1)
  }

  const addTab = () => {
    const next = [...tabs, createProductTab({ label: `Tab ${tabs.length + 1}` })]
    updateTabs(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Product Tabs</p>

      <Field label="Section title">
        <input
          className={inputClass}
          value={p.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Product details"
        />
      </Field>

      <Field label="Section subtitle">
        <input
          className={inputClass}
          value={p.subtitle ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Everything you need to know"
        />
      </Field>

      <Field label="Tab style">
        <select
          className={inputClass}
          value={layout}
          onChange={(e) => onChange({ productTabsLayout: e.target.value as 'underline' | 'pills' | 'boxed' })}
        >
          <option value="underline">Underline</option>
          <option value="pills">Pills</option>
          <option value="boxed">Segmented box</option>
        </select>
      </Field>

      <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Tabs ({tabs.length})
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={addTab}
                className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
              <button
                type="button"
                onClick={() => updateTabs(defaultProductTabs())}
                className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Reset
              </button>
            </div>
          </div>

          <ul className="space-y-2">
            {tabs.map((tab, i) => {
              const open = expanded === i
              return (
                <li key={tab.id ?? i} className="rounded-lg border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2 p-2">
                    <input
                      type="checkbox"
                      checked={tab.enabled !== false}
                      onChange={(e) => updateTab(i, { ...tab, enabled: e.target.checked })}
                      className="h-4 w-4 shrink-0 rounded border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : i)}
                      className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                    >
                      {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <span className="truncate">{tab.label}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTab(i)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {open && (
                    <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                      <Field label="Tab label">
                        <input
                          className={inputClass}
                          value={tab.label}
                          onChange={(e) => updateTab(i, { ...tab, label: e.target.value })}
                        />
                      </Field>
                      <Field label="Content" hint="Use • or - at line start for bullet lists. Blank line for paragraphs.">
                        <textarea
                          className={inputClass}
                          rows={6}
                          value={tab.content ?? ''}
                          onChange={(e) => updateTab(i, { ...tab, content: e.target.value })}
                        />
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
