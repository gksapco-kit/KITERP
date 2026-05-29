import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { createStepperStep, defaultStepperSteps } from '../../lib/stepperDefaults'
import type { Block, StepperStepItem } from '../../types/builder'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded" />
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

export function StepperPropertiesFields({ block, onChange }: { block: Block; onChange: (p: Partial<Block['props']>) => void }) {
  const p = block.props
  const steps = p.stepperSteps ?? defaultStepperSteps()
  const [expanded, setExpanded] = useState<number | null>(0)
  const updateSteps = (next: StepperStepItem[]) => onChange({ stepperSteps: next })

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Stepper</p>
      <Field label="Title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>
      <Field label="Layout">
        <select className={inputClass} value={p.stepperLayout ?? 'horizontal'} onChange={(e) => onChange({ stepperLayout: e.target.value as 'horizontal' | 'vertical' | 'dots' | 'progress' })}>
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
          <option value="dots">Dots only</option>
          <option value="progress">Progress bar</option>
        </select>
      </Field>
      <Field label="Current step (0-based preview)">
        <input type="number" min={0} max={Math.max(steps.length - 1, 0)} className={inputClass} value={p.stepperCurrentStep ?? 0} onChange={(e) => onChange({ stepperCurrentStep: Number(e.target.value) })} />
      </Field>
      <ToggleField label="Show labels" checked={p.showStepperLabels !== false} onChange={(v) => onChange({ showStepperLabels: v })} />
      <ToggleField label="Show descriptions" checked={p.showStepperDescriptions !== false} onChange={(v) => onChange({ showStepperDescriptions: v })} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-gray-400">Steps ({steps.length})</span>
        <button type="button" onClick={() => updateSteps([...steps, createStepperStep({ title: `Step ${steps.length + 1}` })])} className="text-xs font-medium text-brand-600">
          + Add
        </button>
      </div>
      {steps.map((step, i) => (
        <div key={step.id ?? i} className="rounded-lg border border-gray-100">
          <div className="flex items-center gap-1 p-2">
            <button type="button" className="flex flex-1 items-center gap-1 text-left text-sm" onClick={() => setExpanded(expanded === i ? null : i)}>
              {expanded === i ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {step.title}
            </button>
            <button type="button" onClick={() => updateSteps(steps.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {expanded === i && (
            <div className="space-y-2 border-t p-3">
              <Field label="Step title">
                <input className={inputClass} value={step.title} onChange={(e) => { const n = [...steps]; n[i] = { ...step, title: e.target.value }; updateSteps(n) }} />
              </Field>
              <Field label="Description">
                <input className={inputClass} value={step.description ?? ''} onChange={(e) => { const n = [...steps]; n[i] = { ...step, description: e.target.value }; updateSteps(n) }} />
              </Field>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
