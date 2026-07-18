import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Plus, Edit2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, X, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan, useCreateRule, useUpdateRule, useDeleteRule } from '@/hooks/useCommission'
import { RuleBuilder } from '@/components/commission/RuleBuilder'
import { formLabelClass, formTextareaClass } from '@/components/common/FormSectionNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { CommissionPlan, CommissionRule } from '@/types/commission'
import { extractApiError } from '@/lib/errorMessages'
import { commissionTableIconBtn } from '@/pages/commission/commissionUi'

import { askConfirm } from '@/components/common/ConfirmProvider'
const PAYEE_SCOPES = ['any', 'employee', 'vendor', 'contractor', 'agent', 'customer']
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  inactive: 'bg-muted text-muted-foreground',
  draft: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
}

export default function PlansPage() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CommissionPlan | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({
    code: '', name: '', description: '', status: 'active', payee_scope: 'any',
    priority: 10, stackable: false, effective_from: '', effective_to: '',
  })
  const [rules, setRules] = useState<CommissionRule[]>([])
  const [codeError, setCodeError] = useState('')

  const { data, isLoading } = usePlans()
  const create = useCreatePlan()
  const update = useUpdatePlan()
  const deletePlan = useDeletePlan()
  const createRule = useCreateRule()
  const updateRule = useUpdateRule()
  const deleteRule = useDeleteRule()

  const plans = data?.items || []

  const openCreate = () => {
    setEditing(null)
    setForm({ code: '', name: '', description: '', status: 'active', payee_scope: 'any',
      priority: 10, stackable: false, effective_from: '', effective_to: '' })
    setRules([])
    setCodeError('')
    setShowForm(true)
  }

  const closeForm = () => setShowForm(false)

  useEscapeToClose(closeForm, showForm)

  const openEdit = (plan: CommissionPlan) => {
    setEditing(plan)
    setForm({
      code: plan.code, name: plan.name, description: plan.description || '',
      status: plan.status, payee_scope: plan.payee_scope, priority: plan.priority,
      stackable: plan.stackable, effective_from: plan.effective_from || '', effective_to: plan.effective_to || '',
    })
    setRules(plan.rules || [])
    setCodeError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    const code = String(form.code || '').trim()
    if (!code || !form.name) return toast.error('Code and name are required')
    if (!editing && plans.some(p => p.code.trim().toLowerCase() === code.toLowerCase())) {
      const msg = `A plan with code "${code}" already exists. Use a unique code.`
      setCodeError(msg)
      return toast.error(msg)
    }
    if (editing && plans.some(p => p.id !== editing.id && p.code.trim().toLowerCase() === code.toLowerCase())) {
      const msg = `A plan with code "${code}" already exists. Use a unique code.`
      setCodeError(msg)
      return toast.error(msg)
    }
    setCodeError('')
    try {
      const payload = { ...form, code, effective_from: form.effective_from || null, effective_to: form.effective_to || null }
      let plan: CommissionPlan
      if (editing) {
        plan = await update.mutateAsync({ id: editing.id, data: payload })
        toast.success('Plan updated')
        // Sync rules: delete removed, create new, update existing
        const existingIds = (editing.rules || []).map(r => r.id)
        const currentIds = rules.filter(r => r.id).map(r => r.id as string)
        for (const id of existingIds) {
          if (!currentIds.includes(id)) await deleteRule.mutateAsync(id)
        }
        for (const r of rules) {
          const { _key: _omitRuleKey, ...ruleData } = r as typeof r & { _key?: string }
          void _omitRuleKey
          if (r.id) {
            await updateRule.mutateAsync({ id: r.id as string, data: ruleData })
          } else {
            await createRule.mutateAsync({ planId: editing.id, data: ruleData })
          }
        }
      } else {
        plan = await create.mutateAsync(payload)
        for (const r of rules) {
          const { _key: _omitRuleKey, ...ruleData } = r as typeof r & { _key?: string }
          void _omitRuleKey
          await createRule.mutateAsync({ planId: plan.id, data: ruleData })
        }
        toast.success('Plan created')
      }
      setShowForm(false)
    } catch (err) {
      const msg = extractApiError(err, 'Failed to save plan')
      toast.error(msg)
      if (msg.toLowerCase().includes('code')) setCodeError(msg.replace(/^Failed to save plan:\s*/i, ''))
    }
  }

  const toggleStatus = async (plan: CommissionPlan) => {
    const newStatus = plan.status === 'active' ? 'inactive' : 'active'
    try {
      await update.mutateAsync({ id: plan.id, data: { status: newStatus } })
      toast.success(`Plan ${newStatus}`)
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async (plan: CommissionPlan) => {
    if (!await askConfirm(`Delete plan "${plan.name}" permanently? This cannot be undone.`)) return
    try {
      await deletePlan.mutateAsync(plan.id)
      if (expanded === plan.id) setExpanded(null)
      toast.success('Plan deleted')
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to delete plan'))
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Commission Plans</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Define rule-based plans that drive accrual calculations</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Plan
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading…</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <p className="font-medium text-foreground">No commission plans yet</p>
          <p className="text-sm mt-1">Create your first plan to start tracking commissions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <button onClick={() => setExpanded(expanded === plan.id ? null : plan.id)} className="text-muted-foreground hover:text-foreground">
                    {expanded === plan.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{plan.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{plan.code}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[plan.status]}`}>{plan.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                      <span>Scope: {plan.payee_scope}</span>
                      <span>Priority: {plan.priority}</span>
                      <span>{plan.rules?.length || 0} rules</span>
                      {plan.stackable && <span className="text-primary">Stackable</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleStatus(plan)}
                    className={commissionTableIconBtn}
                    aria-label={plan.status === 'active' ? 'Deactivate plan' : 'Activate plan'}
                  >
                    {plan.status === 'active'
                      ? <ToggleRight className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                      : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(plan)}
                    className={`${commissionTableIconBtn} hover:text-primary`}
                    aria-label="Edit plan"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(plan)}
                    className={`${commissionTableIconBtn} hover:text-red-500 dark:hover:text-red-400`}
                    aria-label="Delete plan"
                    disabled={deletePlan.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {expanded === plan.id && (
                <div className="border-t border-border px-5 py-4 bg-muted/20">
                  {plan.description && <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>}
                  <div className="text-xs text-muted-foreground flex gap-4 mb-3">
                    {plan.effective_from && <span>From: {plan.effective_from}</span>}
                    {plan.effective_to && <span>To: {plan.effective_to}</span>}
                  </div>
                  {(plan.rules || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No rules defined</p>
                  ) : (
                    <div className="space-y-2">
                      {(plan.rules || []).map((rule, i) => (
                        <div key={rule.id || i} className="flex items-center gap-3 text-sm bg-muted/40 rounded-lg px-3 py-2">
                          <span className="font-medium text-foreground">{rule.name || `Rule ${i + 1}`}</span>
                          <span className="text-muted-foreground capitalize">{rule.calculation_type?.replace('_', ' ')}</span>
                          {rule.value_numeric != null && <span className="text-primary font-medium">{rule.value_numeric}%</span>}
                          {rule.value_currency != null && <span className="text-primary font-medium">₹{rule.value_currency}</span>}
                          <span className="text-muted-foreground ml-auto">Ch: {rule.channel}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Plan Form Modal */}
      {showForm && (
        <div
          data-kiterp-modal
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
          onClick={closeForm}
        >
          <div
            className="bg-card border border-border text-foreground rounded-xl w-full max-w-2xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border flex items-start justify-between gap-3">
              <h2 className="font-semibold text-foreground">{editing ? 'Edit Plan' : 'New Commission Plan'}</h2>
              <button
                type="button"
                onClick={closeForm}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {[{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }].map(f => (
                  <div key={f.key}>
                    <Label required className={`block mb-1 ${formLabelClass}`}>
                      {f.label}
                    </Label>
                    <Input
                      value={String(form[f.key] || '')}
                      onChange={e => {
                        setForm(p => ({ ...p, [f.key]: e.target.value }))
                        if (f.key === 'code') setCodeError('')
                      }}
                      className={`h-9${f.key === 'code' && codeError ? ' border-destructive bg-destructive/10' : ''}`}
                    />
                    {f.key === 'code' && codeError && (
                      <p className="text-xs text-destructive mt-1">{codeError}</p>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <Label className={`block mb-1 ${formLabelClass}`}>Description</Label>
                <textarea
                  value={String(form.description || '')}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className={formTextareaClass}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>Status</Label>
                  <Select
                    value={String(form.status)}
                    onChange={(v) => setForm(p => ({ ...p, status: v }))}
                    options={['active', 'inactive', 'draft'].map(s => ({ value: s, label: s }))}
                    aria-label="Plan status"
                    className="w-full"
                  />
                </div>
                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>Payee Scope</Label>
                  <Select
                    value={String(form.payee_scope)}
                    onChange={(v) => setForm(p => ({ ...p, payee_scope: v }))}
                    options={PAYEE_SCOPES.map(s => ({ value: s, label: s }))}
                    aria-label="Payee scope"
                    className="w-full"
                  />
                </div>
                <div>
                  <Label className={`block mb-1 ${formLabelClass}`}>Priority</Label>
                  <Input
                    type="number"
                    value={Number(form.priority)}
                    onChange={e => setForm(p => ({ ...p, priority: parseInt(e.target.value) || 10 }))}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[{ key: 'effective_from', label: 'Effective From' }, { key: 'effective_to', label: 'Effective To' }].map(f => (
                  <div key={f.key}>
                    <Label className={`block mb-1 ${formLabelClass}`}>{f.label}</Label>
                    <Input
                      type="date"
                      value={String(form[f.key] || '')}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="stackable"
                  checked={Boolean(form.stackable)}
                  onChange={e => setForm(p => ({ ...p, stackable: e.target.checked }))}
                  className="rounded border-input accent-primary"
                />
                <label htmlFor="stackable" className="text-sm text-muted-foreground">Stackable (multiple plans can fire on same sale)</label>
              </div>

              <hr className="border-border" />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Rules</h3>
                <RuleBuilder rules={rules} onChange={setRules as (r: (Partial<CommissionRule> & { _key?: string })[]) => void} />
              </div>
            </div>
            <div className="p-4 border-t border-border bg-muted/25 flex gap-3 justify-end">
              <Button type="button" variant="cancel" onClick={closeForm}>Cancel</Button>
              <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
                {create.isPending || update.isPending ? 'Saving…' : 'Save Plan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
