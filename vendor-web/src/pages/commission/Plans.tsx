import { useState } from 'react'
import { Plus, Edit2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan, useCreateRule, useUpdateRule, useDeleteRule } from '@/hooks/useCommission'
import { RuleBuilder } from '@/components/commission/RuleBuilder'
import type { CommissionPlan, CommissionRule } from '@/types/commission'

const PAYEE_SCOPES = ['any', 'employee', 'vendor', 'contractor', 'agent', 'customer']
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  draft: 'bg-yellow-100 text-yellow-700',
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
    setShowForm(true)
  }

  const openEdit = (plan: CommissionPlan) => {
    setEditing(plan)
    setForm({
      code: plan.code, name: plan.name, description: plan.description || '',
      status: plan.status, payee_scope: plan.payee_scope, priority: plan.priority,
      stackable: plan.stackable, effective_from: plan.effective_from || '', effective_to: plan.effective_to || '',
    })
    setRules(plan.rules || [])
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.code || !form.name) return toast.error('Code and name are required')
    try {
      const payload = { ...form, effective_from: form.effective_from || null, effective_to: form.effective_to || null }
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
    } catch {
      toast.error('Failed to save plan')
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Commission Plans</h1>
          <p className="text-sm text-gray-500 mt-0.5">Define rule-based plans that drive accrual calculations</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Plan
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="font-medium">No commission plans yet</p>
          <p className="text-sm mt-1">Create your first plan to start tracking commissions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <button onClick={() => setExpanded(expanded === plan.id ? null : plan.id)} className="text-gray-400">
                    {expanded === plan.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{plan.name}</span>
                      <span className="text-xs text-gray-400 font-mono">{plan.code}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[plan.status]}`}>{plan.status}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3">
                      <span>Scope: {plan.payee_scope}</span>
                      <span>Priority: {plan.priority}</span>
                      <span>{plan.rules?.length || 0} rules</span>
                      {plan.stackable && <span className="text-primary">Stackable</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleStatus(plan)} className="text-gray-400 hover:text-gray-700">
                    {plan.status === 'active'
                      ? <ToggleRight className="h-5 w-5 text-green-500" />
                      : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button onClick={() => openEdit(plan)} className="text-gray-400 hover:text-primary">
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {expanded === plan.id && (
                <div className="border-t border-gray-100 px-5 py-4">
                  {plan.description && <p className="text-sm text-gray-600 mb-3">{plan.description}</p>}
                  <div className="text-xs text-gray-500 flex gap-4 mb-3">
                    {plan.effective_from && <span>From: {plan.effective_from}</span>}
                    {plan.effective_to && <span>To: {plan.effective_to}</span>}
                  </div>
                  {(plan.rules || []).length === 0 ? (
                    <p className="text-sm text-gray-400">No rules defined</p>
                  ) : (
                    <div className="space-y-2">
                      {(plan.rules || []).map((rule, i) => (
                        <div key={rule.id || i} className="flex items-center gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
                          <span className="font-medium text-gray-700">{rule.name || `Rule ${i + 1}`}</span>
                          <span className="text-gray-500 capitalize">{rule.calculation_type?.replace('_', ' ')}</span>
                          {rule.value_numeric != null && <span className="text-blue-600 font-medium">{rule.value_numeric}%</span>}
                          {rule.value_currency != null && <span className="text-blue-600 font-medium">₹{rule.value_currency}</span>}
                          <span className="text-gray-400 ml-auto">Ch: {rule.channel}</span>
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl my-8">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editing ? 'Edit Plan' : 'New Commission Plan'}</h2>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {[{ key: 'code', label: 'Code *' }, { key: 'name', label: 'Name *' }].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                    <input value={String(form[f.key] || '')} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea value={String(form.description || '')} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select value={String(form.status)} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    {['active', 'inactive', 'draft'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payee Scope</label>
                  <select value={String(form.payee_scope)} onChange={e => setForm(p => ({ ...p, payee_scope: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    {PAYEE_SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                  <input type="number" value={Number(form.priority)} onChange={e => setForm(p => ({ ...p, priority: parseInt(e.target.value) || 10 }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[{ key: 'effective_from', label: 'Effective From' }, { key: 'effective_to', label: 'Effective To' }].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                    <input type="date" value={String(form[f.key] || '')} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="stackable" checked={Boolean(form.stackable)} onChange={e => setForm(p => ({ ...p, stackable: e.target.checked }))} />
                <label htmlFor="stackable" className="text-sm text-gray-700">Stackable (multiple plans can fire on same sale)</label>
              </div>

              <hr className="border-gray-100" />
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Rules</h3>
                <RuleBuilder rules={rules} onChange={setRules as (r: (Partial<CommissionRule> & { _key?: string })[]) => void} />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={create.isPending || update.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {create.isPending || update.isPending ? 'Saving…' : 'Save Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
