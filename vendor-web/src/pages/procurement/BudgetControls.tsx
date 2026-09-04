/**
 * Procurement Budget Controls — approval threshold configuration.
 * Allows admins to define rules like:
 *   "Auto-approve PRs/POs up to ₹50,000; require Manager above ₹50k; require CFO above ₹2L"
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { vendorApi, type BudgetRule } from '@/api/vendor'
import { toast } from 'sonner'
import { Plus, Trash2, ShieldCheck, Loader2, Save, Info } from 'lucide-react'

const APPROVAL_LEVELS = [
  { value: 'none',    label: 'None (auto-approve)' },
  { value: 'manager', label: 'Manager' },
  { value: 'director', label: 'Director' },
  { value: 'cfo',     label: 'CFO' },
  { value: 'board',   label: 'Board / MD' },
]

function emptyRule(): BudgetRule {
  return { max_amount: 0, require_approval_level: 'manager', department: null, category: null }
}

function formatAmountLabel(amount: number): string {
  if (amount >= 10_00_000) return `₹${(amount / 10_00_000).toFixed(1)}L`
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(0)}k`
  return `₹${amount}`
}

export default function BudgetControlsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['vendor', 'budget-rules'],
    queryFn: () => vendorApi.getBudgetRules(),
  })

  const [rules, setRules] = useState<BudgetRule[]>([])
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (data?.rules) {
      setRules(data.rules)
      setDirty(false)
    }
  }, [data])

  const saveMut = useMutation({
    mutationFn: () => vendorApi.updateBudgetRules(rules),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'budget-rules'] })
      toast.success('Budget rules saved')
      setDirty(false)
    },
    onError: () => toast.error('Could not save budget rules'),
  })

  const addRule = () => {
    setRules(r => [...r, emptyRule()])
    setDirty(true)
  }

  const removeRule = (i: number) => {
    setRules(r => r.filter((_, idx) => idx !== i))
    setDirty(true)
  }

  const updateRule = (i: number, patch: Partial<BudgetRule>) => {
    setRules(r => r.map((rule, idx) => idx === i ? { ...rule, ...patch } : rule))
    setDirty(true)
  }

  // Sort display: lowest max_amount first
  const sortedForDisplay = [...rules].sort((a, b) => a.max_amount - b.max_amount)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" /> Budget Controls
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Define approval thresholds for Purchase Requisitions and Purchase Orders by value
          </p>
        </div>
        <Button onClick={() => saveMut.mutate()} disabled={!dirty || saveMut.isPending} className="gap-2">
          {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Rules
        </Button>
      </div>

      {/* How it works */}
      <Card className="border-blue-100 bg-blue-50/60">
        <CardContent className="pt-4 pb-3 flex gap-3">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 space-y-1">
            <p><strong>How rules work:</strong> Each rule defines the maximum amount that can be auto-approved (or requires a specific level of approval).</p>
            <p>Example: Rule A: up to ₹50k → auto-approve. Rule B: up to ₹2L → requires Manager. Rule C: above ₹2L → requires CFO.</p>
            <p>Leave <em>Department</em> and <em>Category</em> blank to apply the rule globally.</p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <>
          {/* Visual summary */}
          {sortedForDisplay.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Threshold Summary</CardTitle>
                <CardDescription className="text-xs">Rules sorted by amount (lowest first)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sortedForDisplay.map((rule, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        rule.require_approval_level === 'none' ? 'bg-green-400' :
                        rule.require_approval_level === 'manager' ? 'bg-yellow-400' :
                        rule.require_approval_level === 'director' ? 'bg-amber-400' :
                        rule.require_approval_level === 'cfo' ? 'bg-orange-400' : 'bg-red-400'
                      }`} />
                      <span className="text-sm">
                        Up to <strong>{formatAmountLabel(rule.max_amount)}</strong>
                        {rule.department ? ` (${rule.department})` : ''}
                        {rule.category ? ` — ${rule.category}` : ''}
                      </span>
                      <span className="ml-auto text-xs font-medium text-gray-600">
                        {APPROVAL_LEVELS.find(l => l.value === rule.require_approval_level)?.label ?? rule.require_approval_level}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rule editor */}
          <div className="space-y-3">
            {rules.map((rule, i) => (
              <Card key={i} className="relative">
                <CardContent className="pt-4 pb-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <Label className="text-xs mb-1 block">Max Amount (₹) *</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        value={rule.max_amount}
                        onChange={e => updateRule(i, { max_amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Required Approval *</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none"
                        value={rule.require_approval_level}
                        onChange={e => updateRule(i, { require_approval_level: e.target.value })}
                      >
                        {APPROVAL_LEVELS.map(l => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Department (optional)</Label>
                      <Input
                        placeholder="e.g. Operations"
                        value={rule.department ?? ''}
                        onChange={e => updateRule(i, { department: e.target.value || null })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Category (optional)</Label>
                      <Input
                        placeholder="e.g. Raw Materials"
                        value={rule.category ?? ''}
                        onChange={e => updateRule(i, { category: e.target.value || null })}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeRule(i)}
                    className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </CardContent>
              </Card>
            ))}

            {rules.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-lg">
                <ShieldCheck className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500 font-medium">No budget rules configured</p>
                <p className="text-xs text-gray-400 mt-1">All PRs and POs require manual approval by default</p>
              </div>
            )}

            <Button variant="outline" className="w-full gap-2" onClick={addRule}>
              <Plus className="w-4 h-4" /> Add Budget Rule
            </Button>
          </div>

          {dirty && (
            <div className="flex items-center justify-end gap-3 border-t pt-4">
              <p className="text-sm text-amber-600 font-medium">Unsaved changes</p>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-2">
                {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Rules
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
