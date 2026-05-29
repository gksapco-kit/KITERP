import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  createPricingMatrixPlan,
  createPricingMatrixRow,
  defaultPricingMatrixPlans,
  defaultPricingMatrixRows,
  normalizeMatrixCells,
} from '../../lib/pricingMatrixDefaults'
import type { Block, BlockStyles, PricingMatrixPlan, PricingMatrixRow } from '../../types/builder'
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

interface PricingMatrixPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function PricingMatrixPropertiesFields({ block, onChange, onStylesChange }: PricingMatrixPropertiesFieldsProps) {
  const p = block.props
  const plans = p.pricingMatrixPlans ?? defaultPricingMatrixPlans()
  const rows = p.pricingMatrixRows ?? defaultPricingMatrixRows(plans.length)
  const [expandedPlan, setExpandedPlan] = useState<string | null>(plans[0]?.id ?? '0')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const updatePlans = (next: PricingMatrixPlan[]) => {
    const syncedRows = rows.map((row) => ({
      ...row,
      cells: normalizeMatrixCells(row.cells, next.length),
    }))
    onChange({ pricingMatrixPlans: next, pricingMatrixRows: syncedRows })
  }

  const updateRows = (next: PricingMatrixRow[]) => onChange({ pricingMatrixRows: next })

  const updatePlan = (index: number, plan: PricingMatrixPlan) => {
    const next = [...plans]
    next[index] = plan
    updatePlans(next)
  }

  const removePlan = (index: number) => {
    const next = plans.filter((_, i) => i !== index)
    updatePlans(next)
  }

  const addPlan = () => {
    updatePlans([...plans, createPricingMatrixPlan({ name: `Plan ${plans.length + 1}` })])
  }

  const updateRow = (index: number, row: PricingMatrixRow) => {
    const next = [...rows]
    next[index] = row
    updateRows(next)
  }

  const removeRow = (index: number) => {
    updateRows(rows.filter((_, i) => i !== index))
  }

  const addRow = () => {
    updateRows([...rows, createPricingMatrixRow({ cells: Array(plans.length).fill('yes') })])
  }

  const setHighlighted = (index: number) => {
    updatePlans(plans.map((plan, i) => ({ ...plan, highlighted: i === index })))
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pricing Matrix</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>

      <Field label="Section subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      <Field label="Layout">
        <select
          className={inputClass}
          value={p.pricingMatrixLayout ?? 'table'}
          onChange={(e) => onChange({ pricingMatrixLayout: e.target.value as 'table' | 'cards' | 'compact' })}
        >
          <option value="table">Comparison table</option>
          <option value="cards">Plan cards</option>
          <option value="compact">Compact table</option>
        </select>
      </Field>

      <Field label="Theme">
        <select
          className={inputClass}
          value={p.pricingMatrixTheme ?? 'premium'}
          onChange={(e) => onChange({ pricingMatrixTheme: e.target.value as 'premium' | 'minimal' | 'dark' })}
        >
          <option value="premium">Premium</option>
          <option value="minimal">Minimal</option>
          <option value="dark">Dark gradient</option>
        </select>
      </Field>

      <ThemeGradientFields block={block} theme={p.pricingMatrixTheme} onStylesChange={onStylesChange} showForThemes={['premium', 'dark']} />

      <ToggleField label="Show plan buttons" checked={p.showPricingMatrixCta !== false} onChange={(v) => onChange({ showPricingMatrixCta: v })} />

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Plans ({plans.length})</p>
        <button type="button" onClick={addPlan} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <div className="space-y-2">
        {plans.map((plan, i) => {
          const key = plan.id ?? String(i)
          const open = expandedPlan === key
          return (
            <div key={key} className="rounded-lg border border-gray-100 bg-white">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => setExpandedPlan(open ? null : key)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {open ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
                  <span className="truncate text-sm font-medium">{plan.name}</span>
                  {plan.highlighted && <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">Popular</span>}
                </button>
                <button type="button" onClick={() => setHighlighted(i)} className="text-[10px] font-medium text-brand-600 hover:underline">
                  Highlight
                </button>
                <button type="button" onClick={() => removePlan(i)} className="rounded p-1 text-gray-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {open && (
                <div className="space-y-3 border-t border-gray-100 px-3 py-3">
                  <Field label="Plan name">
                    <input className={inputClass} value={plan.name} onChange={(e) => updatePlan(i, { ...plan, name: e.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Price">
                      <input className={inputClass} value={plan.price} onChange={(e) => updatePlan(i, { ...plan, price: e.target.value })} />
                    </Field>
                    <Field label="Period">
                      <input className={inputClass} value={plan.period ?? ''} onChange={(e) => updatePlan(i, { ...plan, period: e.target.value })} placeholder="/mo" />
                    </Field>
                  </div>
                  <Field label="Description">
                    <input className={inputClass} value={plan.description ?? ''} onChange={(e) => updatePlan(i, { ...plan, description: e.target.value })} />
                  </Field>
                  <Field label="Badge (highlighted plan)">
                    <input className={inputClass} value={plan.badge ?? ''} onChange={(e) => updatePlan(i, { ...plan, badge: e.target.value })} placeholder="Most popular" />
                  </Field>
                  <Field label="Button text">
                    <input className={inputClass} value={plan.buttonText ?? ''} onChange={(e) => updatePlan(i, { ...plan, buttonText: e.target.value })} />
                  </Field>
                  <Field label="Button link">
                    <input className={inputClass} value={plan.buttonLink ?? ''} onChange={(e) => updatePlan(i, { ...plan, buttonLink: e.target.value })} />
                  </Field>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Feature rows ({rows.length})</p>
        <button type="button" onClick={addRow} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <Field label="Cell values" hint="Use yes, no, partial, or custom text (e.g. 10 GB)">
        <span className="text-[11px] text-gray-400">One field per plan column</span>
      </Field>

      <div className="space-y-2">
        {rows.map((row, i) => {
          const key = row.id ?? String(i)
          const open = expandedRow === key
          const cells = normalizeMatrixCells(row.cells, plans.length)
          return (
            <div key={key} className="rounded-lg border border-gray-100">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => setExpandedRow(open ? null : key)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  <span className="truncate text-sm font-medium">{row.feature}</span>
                </button>
                <button type="button" onClick={() => removeRow(i)} className="rounded p-1 text-gray-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {open && (
                <div className="space-y-3 border-t border-gray-100 px-3 py-3">
                  <Field label="Feature name">
                    <input className={inputClass} value={row.feature} onChange={(e) => updateRow(i, { ...row, feature: e.target.value })} />
                  </Field>
                  <Field label="Hint (optional)">
                    <input className={inputClass} value={row.hint ?? ''} onChange={(e) => updateRow(i, { ...row, hint: e.target.value })} />
                  </Field>
                  {plans.map((plan, pi) => (
                    <Field key={plan.id ?? pi} label={`${plan.name} value`}>
                      <input
                        className={inputClass}
                        value={cells[pi] ?? ''}
                        onChange={(e) => {
                          const nextCells = [...cells]
                          nextCells[pi] = e.target.value
                          updateRow(i, { ...row, cells: nextCells })
                        }}
                        placeholder="yes / no / partial / 10 GB"
                      />
                    </Field>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
