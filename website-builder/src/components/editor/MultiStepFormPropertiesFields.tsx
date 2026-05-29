import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { createDefaultFormField } from '../../lib/contactFormDefaults'
import { createFormStep, defaultMultiStepFormSteps } from '../../lib/multiStepFormDefaults'
import type { Block, BlockStyles, FormFieldItem, FormFieldType, FormStepItem } from '../../types/builder'
import { ThemeGradientFields } from './ThemeGradientFields'

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

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Dropdown' },
]

interface MultiStepFormPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function MultiStepFormPropertiesFields({ block, onChange, onStylesChange }: MultiStepFormPropertiesFieldsProps) {
  const p = block.props
  const steps = p.multiStepFormSteps ?? defaultMultiStepFormSteps()
  const [expandedStep, setExpandedStep] = useState<number | null>(0)
  const [expandedField, setExpandedField] = useState<string | null>(null)

  const updateSteps = (next: FormStepItem[]) => onChange({ multiStepFormSteps: next })

  const updateStep = (index: number, step: FormStepItem) => {
    const next = [...steps]
    next[index] = step
    updateSteps(next)
  }

  const updateStepField = (stepIndex: number, fieldIndex: number, field: FormFieldItem) => {
    const step = steps[stepIndex]
    if (!step) return
    const fields = [...(step.fields ?? [])]
    fields[fieldIndex] = field
    updateStep(stepIndex, { ...step, fields })
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Multi-Step Form</p>

      <Field label="Form title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>

      <Field label="Description">
        <textarea className={inputClass} rows={2} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      <Field label="Step indicator layout">
        <select
          className={inputClass}
          value={p.multiStepFormLayout ?? 'numbered'}
          onChange={(e) =>
            onChange({ multiStepFormLayout: e.target.value as 'numbered' | 'tabs' | 'minimal' | 'sidebar' })
          }
        >
          <option value="numbered">Numbered steps</option>
          <option value="tabs">Tab bar</option>
          <option value="minimal">Progress bar</option>
          <option value="sidebar">Sidebar (desktop)</option>
        </select>
      </Field>

      <Field label="Theme">
        <select
          className={inputClass}
          value={p.multiStepFormTheme ?? 'premium'}
          onChange={(e) => onChange({ multiStepFormTheme: e.target.value as 'light' | 'premium' | 'dark' })}
        >
          <option value="premium">Premium (custom gradient)</option>
          <option value="light">Light</option>
          <option value="dark">Dark gradient</option>
        </select>
      </Field>

      <ThemeGradientFields block={block} theme={p.multiStepFormTheme} onStylesChange={onStylesChange} showForThemes={['premium', 'dark']} />

      <ToggleField label="Show step progress" checked={p.showMultiStepProgress !== false} onChange={(v) => onChange({ showMultiStepProgress: v })} />
      <ToggleField label="Show step labels" checked={p.showMultiStepLabels !== false} onChange={(v) => onChange({ showMultiStepLabels: v })} />

      <Field label="Back button">
        <input className={inputClass} value={p.multiStepBackText ?? ''} onChange={(e) => onChange({ multiStepBackText: e.target.value })} />
      </Field>
      <Field label="Next button">
        <input className={inputClass} value={p.multiStepNextText ?? ''} onChange={(e) => onChange({ multiStepNextText: e.target.value })} />
      </Field>
      <Field label="Submit button">
        <input className={inputClass} value={p.multiStepSubmitText ?? ''} onChange={(e) => onChange({ multiStepSubmitText: e.target.value })} />
      </Field>
      <Field label="Note on first step (optional)">
        <input className={inputClass} value={p.submitNote ?? ''} onChange={(e) => onChange({ submitNote: e.target.value })} placeholder="Privacy note" />
      </Field>

      <Field label="Success title">
        <input className={inputClass} value={p.multiStepSuccessTitle ?? ''} onChange={(e) => onChange({ multiStepSuccessTitle: e.target.value })} />
      </Field>
      <Field label="Success message">
        <textarea className={inputClass} rows={2} value={p.multiStepSuccessMessage ?? ''} onChange={(e) => onChange({ multiStepSuccessMessage: e.target.value })} />
      </Field>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Steps ({steps.length})</p>
        <button
          type="button"
          onClick={() => {
            const next = [...steps, createFormStep({ title: `Step ${steps.length + 1}` })]
            updateSteps(next)
            setExpandedStep(next.length - 1)
          }}
          className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
        >
          <Plus className="h-3.5 w-3.5" /> Add step
        </button>
      </div>

      <div className="space-y-2">
        {steps.map((step, si) => {
          const stepOpen = expandedStep === si
          const fields = step.fields ?? []
          return (
            <div key={step.id ?? si} className="rounded-lg border border-gray-200 bg-gray-50">
              <div className="flex items-center gap-1 p-2">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                  onClick={() => setExpandedStep(stepOpen ? null : si)}
                >
                  {stepOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{step.title || `Step ${si + 1}`}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateSteps(steps.filter((_, i) => i !== si))
                    if (expandedStep === si) setExpandedStep(null)
                  }}
                  className="rounded p-1 text-gray-400 hover:text-red-600"
                  aria-label="Remove step"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {stepOpen && (
                <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                  <Field label="Step title">
                    <input className={inputClass} value={step.title} onChange={(e) => updateStep(si, { ...step, title: e.target.value })} />
                  </Field>
                  <Field label="Step description">
                    <input className={inputClass} value={step.description ?? ''} onChange={(e) => updateStep(si, { ...step, description: e.target.value })} />
                  </Field>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Fields ({fields.length})</span>
                    <button
                      type="button"
                      onClick={() => updateStep(si, { ...step, fields: [...fields, createDefaultFormField()] })}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      + Add field
                    </button>
                  </div>

                  {fields.map((field, fi) => {
                    const fieldKey = `${si}-${field.id ?? fi}`
                    const fieldOpen = expandedField === fieldKey
                    return (
                      <div key={field.id ?? fi} className="rounded border border-gray-100 bg-gray-50/80">
                        <div className="flex items-center gap-1 p-2">
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-1 text-left text-xs font-medium text-gray-700"
                            onClick={() => setExpandedField(fieldOpen ? null : fieldKey)}
                          >
                            {fieldOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <span className="truncate">{field.label || `Field ${fi + 1}`}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStep(si, { ...step, fields: fields.filter((_, i) => i !== fi) })}
                            className="rounded p-1 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {fieldOpen && (
                          <div className="space-y-2 border-t border-gray-100 p-2">
                            <Field label="Label">
                              <input
                                className={inputClass}
                                value={field.label}
                                onChange={(e) => updateStepField(si, fi, { ...field, label: e.target.value })}
                              />
                            </Field>
                            <Field label="Type">
                              <select
                                className={inputClass}
                                value={field.type}
                                onChange={(e) => {
                                  const type = e.target.value as FormFieldType
                                  updateStepField(si, fi, {
                                    ...field,
                                    type,
                                    options: type === 'select' ? field.options ?? ['Option 1'] : undefined,
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
                            {field.type !== 'select' ? (
                              <Field label="Placeholder">
                                <input
                                  className={inputClass}
                                  value={field.placeholder ?? ''}
                                  onChange={(e) => updateStepField(si, fi, { ...field, placeholder: e.target.value })}
                                />
                              </Field>
                            ) : (
                              <Field label="Options (comma separated)">
                                <input
                                  className={inputClass}
                                  value={field.options?.join(', ') ?? ''}
                                  onChange={(e) =>
                                    updateStepField(si, fi, {
                                      ...field,
                                      options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                                    })
                                  }
                                />
                              </Field>
                            )}
                            <label className="flex items-center gap-2 text-xs text-gray-700">
                              <input
                                type="checkbox"
                                checked={!!field.required}
                                onChange={(e) => updateStepField(si, fi, { ...field, required: e.target.checked })}
                              />
                              Required
                            </label>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
