import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { createDefaultFaqItem } from '../../lib/faqDefaults'
import type { Block, FaqItem } from '../../types/builder'

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

interface FaqPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function FaqPropertiesFields({ block, onChange }: FaqPropertiesFieldsProps) {
  const p = block.props
  const items = p.faqItems ?? []
  const [expanded, setExpanded] = useState<number | null>(items.length > 0 ? 0 : null)

  const updateItems = (next: FaqItem[]) => onChange({ faqItems: next })

  const updateItem = (index: number, item: FaqItem) => {
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
    const next = [...items, createDefaultFaqItem()]
    updateItems(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">FAQ</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Frequently Asked Questions" />
      </Field>

      <Field label="Section subtitle">
        <textarea
          className={inputClass}
          rows={2}
          value={p.subtitle ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Short intro below the title"
        />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Questions ({items.length})</span>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add question
          </button>
        </div>

        <div className="space-y-2">
          {items.map((item, i) => {
            const isOpen = expanded === i
            return (
              <div key={item.id ?? i} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-1 p-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                    onClick={() => setExpanded(isOpen ? null : i)}
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{item.question || `Question ${i + 1}`}</span>
                  </button>
                  <button
                    type="button"
                    title="Delete question"
                    className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => removeItem(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {isOpen && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <Field label="Question">
                      <input
                        className={inputClass}
                        value={item.question}
                        onChange={(e) => updateItem(i, { ...item, question: e.target.value })}
                      />
                    </Field>
                    <Field label="Answer">
                      <textarea
                        className={inputClass}
                        rows={4}
                        value={item.answer}
                        onChange={(e) => updateItem(i, { ...item, answer: e.target.value })}
                      />
                    </Field>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {items.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400">Click &ldquo;Add question&rdquo; to create your first FAQ item.</p>
        )}
      </div>
    </div>
  )
}
