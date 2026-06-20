import { useState } from 'react'
import { formLabelClass } from '@/components/common/FormSectionNav'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { CommissionRule } from '@/types/commission'

const CALC_TYPES = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'flat', label: 'Flat Amount' },
  { value: 'points', label: 'Points per Unit' },
  { value: 'tiered', label: 'Tiered' },
  { value: 'time_based', label: 'Time Based (per hour)' },
  { value: 'revenue_based', label: 'Revenue Based' },
  { value: 'count_based', label: 'Count Based' },
  { value: 'equity', label: 'Equity Units' },
]

const CHANNELS = ['any', 'online', 'pos', 'booking']
const WINDOW_TYPES = ['per_line', 'per_sale', 'per_period']
const PERIODS = ['day', 'week', 'month', 'quarter', 'year']

type RuleDraft = Partial<CommissionRule> & { _key?: string }

interface RuleBuilderProps {
  rules: RuleDraft[]
  onChange: (rules: RuleDraft[]) => void
}

export function RuleBuilder({ rules, onChange }: RuleBuilderProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const addRule = () => {
    const key = Date.now().toString()
    onChange([...rules, {
      _key: key, priority: (rules.length + 1) * 10, is_active: true,
      applies_to: 'all', channel: 'any', window_type: 'per_line', calculation_type: 'percentage',
      value_numeric: 5,
    }])
    setExpanded(key)
  }

  const updateRule = (idx: number, patch: Partial<RuleDraft>) => {
    const next = rules.map((r, i) => i === idx ? { ...r, ...patch } : r)
    onChange(next)
  }

  const removeRule = (idx: number) => {
    onChange(rules.filter((_, i) => i !== idx))
  }

  const getKey = (r: RuleDraft, i: number) => r._key || r.id || String(i)

  return (
    <div className="space-y-2">
      {rules.map((rule, idx) => {
        const key = getKey(rule, idx)
        const isOpen = expanded === key
        return (
          <div key={key} className="border border-border rounded-lg overflow-hidden bg-card">
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
              onClick={() => setExpanded(isOpen ? null : key)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                <span className="text-sm font-medium text-foreground">
                  {rule.name || CALC_TYPES.find(c => c.value === rule.calculation_type)?.label || 'Rule'}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${rule.is_active ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                  {rule.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={e => { e.stopPropagation(); removeRule(idx) }} className="text-red-500/80 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>

            {isOpen && (
              <div className="p-4 space-y-4 border-t border-border bg-card">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Rule Name" value={rule.name || ''} onChange={v => updateRule(idx, { name: v })} />
                  <FieldNum label="Priority" value={rule.priority || 10} onChange={v => updateRule(idx, { priority: v })} />
                </div>

                {/* Calculation */}
                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>Calculation Type</Label>
                  <Select
                    value={rule.calculation_type ?? 'percentage'}
                    onChange={v => updateRule(idx, { calculation_type: v as CommissionRule['calculation_type'] })}
                    options={CALC_TYPES}
                  />
                </div>

                {/* Dynamic value inputs */}
                {rule.calculation_type === 'percentage' && (
                  <FieldNum label="Rate (%)" value={rule.value_numeric ?? 0} onChange={v => updateRule(idx, { value_numeric: v })} step="0.01" />
                )}
                {rule.calculation_type === 'flat' && (
                  <FieldNum label="Flat Amount" value={rule.value_currency ?? 0} onChange={v => updateRule(idx, { value_currency: v })} step="0.01" />
                )}
                {rule.calculation_type === 'points' && (
                  <FieldNum label="Points per Unit" value={rule.points_per_unit ?? 0} onChange={v => updateRule(idx, { points_per_unit: v })} step="0.0001" />
                )}
                {rule.calculation_type === 'equity' && (
                  <FieldNum label="Equity Units" value={rule.equity_units ?? 0} onChange={v => updateRule(idx, { equity_units: v })} step="0.000001" />
                )}
                {rule.calculation_type === 'time_based' && (
                  <FieldNum label="Rate per Hour" value={(rule.time_rate as Record<string, number>)?.rate_per_hour ?? 0}
                    onChange={v => updateRule(idx, { time_rate: { rate_per_hour: v } })} step="0.01" />
                )}
                {(rule.calculation_type === 'revenue_based' || rule.calculation_type === 'count_based') && (
                  <div className="grid grid-cols-2 gap-4">
                    <FieldNum label="Rate (%)" value={rule.value_numeric ?? 0} onChange={v => updateRule(idx, { value_numeric: v })} step="0.01" />
                    {rule.calculation_type === 'revenue_based' && (
                      <FieldNum label="Revenue Threshold" value={rule.revenue_threshold ?? 0} onChange={v => updateRule(idx, { revenue_threshold: v })} />
                    )}
                    {rule.calculation_type === 'count_based' && (
                      <FieldNum label="Count Threshold" value={rule.count_threshold ?? 0} onChange={v => updateRule(idx, { count_threshold: Math.round(v) })} />
                    )}
                  </div>
                )}

                <hr className="border-border" />

                {/* Match conditions */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={`block mb-1 ${formLabelClass}`}>Channel</Label>
                    <Select
                      value={rule.channel || 'any'}
                      onChange={v => updateRule(idx, { channel: v })}
                      options={CHANNELS.map(c => ({ value: c, label: c }))}
                    />
                  </div>
                  <div>
                    <Label className={`block mb-1 ${formLabelClass}`}>Applies To</Label>
                    <Select
                      value={rule.applies_to || 'all'}
                      onChange={v => updateRule(idx, { applies_to: v })}
                      options={['all', 'product', 'service', 'category'].map(v => ({ value: v, label: v }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FieldNum label="Min Qty" value={rule.min_qty ?? ''} onChange={v => updateRule(idx, { min_qty: v || undefined })} />
                  <FieldNum label="Min Amount" value={rule.min_amount ?? ''} onChange={v => updateRule(idx, { min_amount: v || undefined })} />
                  <Field label="UOM" value={rule.uom || ''} onChange={v => updateRule(idx, { uom: v || undefined })} />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FieldNum label="Cap Amount" value={rule.cap_amount ?? ''} onChange={v => updateRule(idx, { cap_amount: v || undefined })} />
                  <FieldNum label="Floor Amount" value={rule.floor_amount ?? ''} onChange={v => updateRule(idx, { floor_amount: v || undefined })} />
                  <FieldNum label="Payee Share %" value={rule.payee_share_percent ?? ''} onChange={v => updateRule(idx, { payee_share_percent: v || undefined })} step="0.01" />
                </div>

                {/* Aggregation */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={`block mb-1 ${formLabelClass}`}>Window Type</Label>
                    <Select
                      value={rule.window_type || 'per_line'}
                      onChange={v => updateRule(idx, { window_type: v })}
                      options={WINDOW_TYPES.map(w => ({ value: w, label: w }))}
                    />
                  </div>
                  {rule.window_type === 'per_period' && (
                    <div>
                      <Label className={`block mb-1 ${formLabelClass}`}>Period</Label>
                      <Select
                        value={rule.period || 'month'}
                        onChange={v => updateRule(idx, { period: v })}
                        options={PERIODS.map(p => ({ value: p, label: p }))}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`active-${key}`}
                    checked={rule.is_active !== false}
                    onChange={e => updateRule(idx, { is_active: e.target.checked })}
                    className="rounded border-input accent-primary"
                  />
                  <label htmlFor={`active-${key}`} className="text-sm text-muted-foreground">Active</label>
                </div>
              </div>
            )}
          </div>
        )
      })}
      <button type="button" onClick={addRule}
        className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium">
        <Plus className="h-4 w-4" /> Add Rule
      </button>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className={`block mb-1 ${formLabelClass}`}>{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} className="h-9" />
    </div>
  )
}

function FieldNum({ label, value, onChange, step }: { label: string; value: number | string; onChange: (v: number) => void; step?: string }) {
  return (
    <div>
      <Label className={`block mb-1 ${formLabelClass}`}>{label}</Label>
      <Input
        type="number"
        step={step || '1'}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="h-9"
      />
    </div>
  )
}
