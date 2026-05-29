import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { createPolicySection } from '../../lib/shippingReturnsDefaults'
import type { Block, PolicyInfoSection } from '../../types/builder'
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

const ICON_OPTIONS: { value: PolicyInfoSection['icon']; label: string }[] = [
  { value: 'truck', label: 'Truck (shipping)' },
  { value: 'package', label: 'Package' },
  { value: 'refresh', label: 'Returns / refresh' },
  { value: 'shield', label: 'Shield / guarantee' },
  { value: 'clock', label: 'Clock / timing' },
]

interface ShippingReturnsInfoPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function ShippingReturnsInfoPropertiesFields({ block, onChange }: ShippingReturnsInfoPropertiesFieldsProps) {
  const p = block.props
  const sections = p.policySections ?? []
  const [expanded, setExpanded] = useState<number | null>(sections.length > 0 ? 0 : null)

  const updateSections = (next: PolicyInfoSection[]) => onChange({ policySections: next })

  const updateSection = (index: number, section: PolicyInfoSection) => {
    const next = [...sections]
    next[index] = section
    updateSections(next)
  }

  const removeSection = (index: number) => {
    updateSections(sections.filter((_, i) => i !== index))
    if (expanded === index) setExpanded(null)
    else if (expanded != null && expanded > index) setExpanded(expanded - 1)
  }

  const addSection = () => {
    const next = [...sections, createPolicySection({ title: `Section ${sections.length + 1}` })]
    updateSections(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Shipping & Returns</p>

      <Field label="Section title">
        <input
          className={inputClass}
          value={p.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Shipping & Returns"
        />
      </Field>

      <Field label="Section subtitle">
        <textarea
          className={inputClass}
          rows={2}
          value={p.subtitle ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Short intro text"
        />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Policy sections ({sections.length})
          </span>
          <button
            type="button"
            onClick={addSection}
            className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add section
          </button>
        </div>

        <ul className="space-y-2">
          {sections.map((section, i) => {
            const open = expanded === i
            return (
              <li key={section.id ?? i} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-1 p-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : i)}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                  >
                    {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{section.title || `Section ${i + 1}`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSection(i)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove section"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {open && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <Field label="Title">
                      <input
                        className={inputClass}
                        value={section.title}
                        onChange={(e) => updateSection(i, { ...section, title: e.target.value })}
                      />
                    </Field>
                    <Field label="Short description">
                      <input
                        className={inputClass}
                        value={section.description ?? ''}
                        onChange={(e) => updateSection(i, { ...section, description: e.target.value })}
                      />
                    </Field>
                    <Field label="Icon">
                      <select
                        className={inputClass}
                        value={section.icon ?? 'truck'}
                        onChange={(e) =>
                          updateSection(i, { ...section, icon: e.target.value as PolicyInfoSection['icon'] })
                        }
                      >
                        {ICON_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Bullet points (one per line)">
                      <textarea
                        className={inputClass}
                        rows={5}
                        value={(section.items ?? []).join('\n')}
                        onChange={(e) =>
                          updateSection(i, {
                            ...section,
                            items: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean),
                          })
                        }
                        placeholder={'Free shipping over $50\n2–5 business days'}
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
