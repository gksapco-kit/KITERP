import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  createHowItWorksStep,
  defaultHowItWorksSteps,
  HOW_IT_WORKS_DEFAULTS,
} from '../../lib/howItWorksDefaults'
import type { Block, HowItWorksStep } from '../../types/builder'

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

const ICON_OPTIONS: { value: HowItWorksStep['icon']; label: string }[] = [
  { value: 'search', label: 'Search' },
  { value: 'cart', label: 'Cart' },
  { value: 'credit-card', label: 'Credit card' },
  { value: 'truck', label: 'Truck / delivery' },
  { value: 'package', label: 'Package' },
  { value: 'check', label: 'Checkmark' },
  { value: 'user', label: 'User' },
  { value: 'settings', label: 'Settings' },
]

interface HowItWorksPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function HowItWorksPropertiesFields({ block, onChange }: HowItWorksPropertiesFieldsProps) {
  const p = block.props
  const steps = p.howItWorksSteps ?? defaultHowItWorksSteps()
  const layout = p.howItWorksLayout ?? HOW_IT_WORKS_DEFAULTS.howItWorksLayout
  const [expanded, setExpanded] = useState<number | null>(null)

  const updateSteps = (next: HowItWorksStep[]) => onChange({ howItWorksSteps: next })

  const updateStep = (index: number, item: HowItWorksStep) => {
    const next = [...steps]
    next[index] = item
    updateSteps(next)
  }

  const removeStep = (index: number) => {
    updateSteps(steps.filter((_, i) => i !== index))
    if (expanded === index) setExpanded(null)
    else if (expanded != null && expanded > index) setExpanded(expanded - 1)
  }

  const addStep = () => {
    const next = [...steps, createHowItWorksStep({ title: `Step ${steps.length + 1}` })]
    updateSteps(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">How It Works</p>

        <Field label="Section title">
          <input
            className={inputClass}
            value={p.text ?? ''}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="How it works"
          />
        </Field>

        <Field label="Section subtitle">
          <input
            className={inputClass}
            value={p.subtitle ?? ''}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            placeholder="Simple steps to get started"
          />
        </Field>

        <Field label="Layout">
          <select
            className={inputClass}
            value={layout}
            onChange={(e) =>
              onChange({ howItWorksLayout: e.target.value as 'horizontal' | 'vertical' | 'cards' | 'minimal' })
            }
          >
            <option value="horizontal">Horizontal with connectors</option>
            <option value="vertical">Vertical timeline</option>
            <option value="cards">Step cards</option>
            <option value="minimal">Minimal list</option>
          </select>
        </Field>

        <ToggleField
          label="Show step numbers"
          checked={p.showStepNumbers !== false}
          onChange={(v) => onChange({ showStepNumbers: v })}
        />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Steps ({steps.length})
            </span>
            <div className="flex gap-1">
                <button
                  type="button"
                  onClick={addStep}
                  className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
                <button
                  type="button"
                  onClick={() => updateSteps(defaultHowItWorksSteps())}
                  className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Reset
                </button>
              </div>
          </div>

          <ul className="space-y-2">
            {steps.map((step, i) => {
              const open = expanded === i
              return (
                <li key={step.id ?? i} className="rounded-lg border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2 p-2">
                    <input
                      type="checkbox"
                      checked={step.enabled !== false}
                      onChange={(e) => updateStep(i, { ...step, enabled: e.target.checked })}
                      className="h-4 w-4 shrink-0 rounded border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : i)}
                      className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                    >
                      {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <span className="truncate">
                        {i + 1}. {step.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStep(i)}
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
                          value={step.title}
                          onChange={(e) => updateStep(i, { ...step, title: e.target.value })}
                        />
                      </Field>
                      <Field label="Description">
                        <textarea
                          className={inputClass}
                          rows={2}
                          value={step.description ?? ''}
                          onChange={(e) => updateStep(i, { ...step, description: e.target.value })}
                        />
                      </Field>
                      <Field label="Icon">
                        <select
                          className={inputClass}
                          value={step.icon ?? 'check'}
                          onChange={(e) =>
                            updateStep(i, { ...step, icon: e.target.value as HowItWorksStep['icon'] })
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
