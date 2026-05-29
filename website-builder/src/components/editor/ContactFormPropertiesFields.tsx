import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { createDefaultFormField } from '../../lib/contactFormDefaults'
import type { Block, FormFieldItem, FormFieldType } from '../../types/builder'

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

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Dropdown' },
]

interface ContactFormPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function ContactFormPropertiesFields({ block, onChange }: ContactFormPropertiesFieldsProps) {
  const p = block.props
  const fields = p.formFields ?? []
  const [expanded, setExpanded] = useState<number | null>(fields.length > 0 ? 0 : null)

  const updateFields = (next: FormFieldItem[]) => onChange({ formFields: next })

  const updateField = (index: number, field: FormFieldItem) => {
    const next = [...fields]
    next[index] = field
    updateFields(next)
  }

  const removeField = (index: number) => {
    updateFields(fields.filter((_, i) => i !== index))
    if (expanded === index) setExpanded(null)
    else if (expanded != null && expanded > index) setExpanded(expanded - 1)
  }

  const addField = () => {
    const next = [...fields, createDefaultFormField()]
    updateFields(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Contact form</p>

      <Field label="Form title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>

      <Field label="Description">
        <textarea className={inputClass} rows={2} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      <Field label="Submit button text">
        <input className={inputClass} value={p.buttonText ?? ''} onChange={(e) => onChange({ buttonText: e.target.value })} />
      </Field>

      <Field label="Note below button (optional)">
        <input className={inputClass} value={p.submitNote ?? ''} onChange={(e) => onChange({ submitNote: e.target.value })} placeholder="e.g. We reply within 24 hours" />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Fields ({fields.length})</span>
          <button
            type="button"
            onClick={addField}
            className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add field
          </button>
        </div>

        <div className="space-y-2">
          {fields.map((field, i) => {
            const isOpen = expanded === i
            return (
              <div key={field.id ?? i} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-1 p-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                    onClick={() => setExpanded(isOpen ? null : i)}
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">
                      {field.label || `Field ${i + 1}`}
                      <span className="ml-1 font-normal text-gray-400">({field.type})</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    title="Delete field"
                    className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => removeField(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {isOpen && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <Field label="Label">
                      <input className={inputClass} value={field.label} onChange={(e) => updateField(i, { ...field, label: e.target.value })} />
                    </Field>
                    <Field label="Field type">
                      <select
                        className={inputClass}
                        value={field.type}
                        onChange={(e) => {
                          const type = e.target.value as FormFieldType
                          updateField(i, {
                            ...field,
                            type,
                            options: type === 'select' ? field.options ?? ['Option 1', 'Option 2'] : undefined,
                          })
                        }}
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {field.type !== 'select' && (
                      <Field label="Placeholder">
                        <input
                          className={inputClass}
                          value={field.placeholder ?? ''}
                          onChange={(e) => updateField(i, { ...field, placeholder: e.target.value })}
                        />
                      </Field>
                    )}
                    {field.type === 'select' && (
                      <Field label="Options (comma separated)">
                        <input
                          className={inputClass}
                          value={field.options?.join(', ') ?? ''}
                          onChange={(e) =>
                            updateField(i, {
                              ...field,
                              options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })
                          }
                          placeholder="Option 1, Option 2"
                        />
                      </Field>
                    )}
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={!!field.required}
                        onChange={(e) => updateField(i, { ...field, required: e.target.checked })}
                      />
                      Required field
                    </label>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {fields.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400">Click &ldquo;Add field&rdquo; to build your form.</p>
        )}
      </div>
    </div>
  )
}
