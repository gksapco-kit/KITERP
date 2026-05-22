import { onModalBackdropClick } from '@/lib/utils'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, X, Pencil, Rocket, Target, ClipboardList, Lock, ExternalLink } from 'lucide-react'
import {
  useHRCycles, useCreateHRCycle, useUpdateHRCycle, useLaunchHRCycle, useCloseHRCycle, useDeleteHRCycle,
  useHRGoals, useCreateHRGoal, useUpdateHRGoal, useDeleteHRGoal,
  useHRReviews, useHREmployees,
} from '@/hooks/useVendor'
import type { ReviewCycle, KPITemplateItem, PerformanceGoal, PerformanceReview, EmployeeProfile } from '@/types'

type Tab = 'cycles' | 'goals' | 'reviews'

const CYCLE_STATUS: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: 'bg-gray-100 text-gray-600' },
  launched: { label: 'Launched', color: 'bg-blue-100 text-blue-700' },
  closed:   { label: 'Closed',   color: 'bg-gray-200 text-gray-700' },
}

const REVIEW_STATUS: Record<string, { label: string; color: string }> = {
  draft:             { label: 'Draft',             color: 'bg-gray-100 text-gray-600' },
  self_pending:      { label: 'Self pending',      color: 'bg-amber-100 text-amber-700' },
  self_submitted:    { label: 'Self done',         color: 'bg-blue-100 text-blue-700' },
  manager_pending:   { label: 'Manager pending',   color: 'bg-amber-100 text-amber-700' },
  manager_submitted: { label: 'Manager done',      color: 'bg-indigo-100 text-indigo-700' },
  acknowledged:      { label: 'Acknowledged',      color: 'bg-green-100 text-green-700' },
  closed:            { label: 'Closed',            color: 'bg-gray-200 text-gray-700' },
}

export default function PerformancePage() {
  const [tab, setTab] = useState<Tab>('cycles')
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
          <p className="text-sm text-gray-500 mt-1">Review Cycles, Goals And KPIs</p>
        </div>
      </div>
      <div className="flex border-b mb-5 gap-1">
        {[
          { k: 'cycles',  label: 'Review Cycles', icon: Rocket },
          { k: 'goals',   label: 'Goals',         icon: Target },
          { k: 'reviews', label: 'All Reviews',   icon: ClipboardList },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as Tab)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'cycles' && <CyclesTab />}
      {tab === 'goals' && <GoalsTab />}
      {tab === 'reviews' && <ReviewsTab />}
    </div>
  )
}

function CyclesTab() {
  const { data: cycles = [], isLoading } = useHRCycles()
  const launch = useLaunchHRCycle()
  const close = useCloseHRCycle()
  const del = useDeleteHRCycle()
  const [editing, setEditing] = useState<ReviewCycle | null>(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Cycle
        </button>
      </div>
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (cycles as ReviewCycle[]).length === 0 ? (
          <div className="p-12 text-center">
            <Rocket className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No review cycles yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>
                {['Name', 'Period', 'Type', 'Status', 'Reviews', 'Actions'].map(h =>
                  <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(cycles as ReviewCycle[]).map(c => {
                const cfg = CYCLE_STATUS[c.status] ?? CYCLE_STATUS.draft
                return (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Link to={`/hr/performance/cycles/${c.id}`} className="text-sm font-medium text-blue-700 hover:underline">{c.name}</Link>
                      {c.description && <p className="text-xs text-gray-500">{c.description}</p>}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{c.period_start} → {c.period_end}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">{c.review_type}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {c.kpi_template?.length ? `${c.kpi_template.length} KPIs` : 'No KPIs'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Link to={`/hr/performance/cycles/${c.id}`}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Open">
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        {c.status === 'draft' && (
                          <>
                            <button onClick={() => setEditing(c)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => { if (confirm('Launch this cycle? Reviews will be created for all employees.')) launch.mutate(c.id) }}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Launch">
                              <Rocket className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {c.status === 'launched' && (
                          <button onClick={() => { if (confirm('Close this cycle?')) close.mutate(c.id) }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Close">
                            <Lock className="w-4 h-4" />
                          </button>
                        )}
                        {c.status === 'draft' && (
                          <button onClick={() => { if (confirm('Delete this draft cycle?')) del.mutate(c.id) }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {(showNew || editing) && (
        <CycleModal existing={editing} onClose={() => { setShowNew(false); setEditing(null) }} />
      )}
    </div>
  )
}

function CycleModal({ existing, onClose }: { existing?: ReviewCycle | null; onClose: () => void }) {
  const create = useCreateHRCycle()
  const update = useUpdateHRCycle()
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    period_start: existing?.period_start ?? '',
    period_end: existing?.period_end ?? '',
    review_type: existing?.review_type ?? 'annual',
    rating_scale_max: existing?.rating_scale_max ?? 5,
    self_review_required: existing?.self_review_required ?? true,
    manager_review_required: existing?.manager_review_required ?? true,
    enable_kpi_scoring: existing?.enable_kpi_scoring ?? true,
  })
  const [kpis, setKpis] = useState<KPITemplateItem[]>(
    existing?.kpi_template ?? [
      { key: 'quality', label: 'Quality of Work', weight: 30 },
      { key: 'productivity', label: 'Productivity', weight: 30 },
      { key: 'teamwork', label: 'Teamwork', weight: 20 },
      { key: 'communication', label: 'Communication', weight: 20 },
    ]
  )

  function addKpi() { setKpis([...kpis, { key: '', label: '', weight: 0 }]) }
  function rmKpi(i: number) { setKpis(kpis.filter((_, idx) => idx !== i)) }
  function setKpi(i: number, k: keyof KPITemplateItem, v: string | number) {
    setKpis(kpis.map((kp, idx) => idx === i ? { ...kp, [k]: v } : kp))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...form, kpi_template: kpis.filter(k => k.key && k.label) }
    if (existing) await update.mutateAsync({ id: existing.id, data: payload })
    else await create.mutateAsync(payload)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onModalBackdropClick(onClose)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">{existing ? 'Edit Cycle' : 'New Review Cycle'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Cycle Name *</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Annual Review 2026" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Period Start *</label>
              <input type="date" required value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Period End *</label>
              <input type="date" required value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Type</label>
              <select value={form.review_type} onChange={e => setForm({ ...form, review_type: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                <option value="annual">Annual</option>
                <option value="semi_annual">Semi-Annual</option>
                <option value="quarterly">Quarterly</option>
                <option value="probation">Probation</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Rating Scale Max</label>
              <input type="number" value={form.rating_scale_max}
                onChange={e => setForm({ ...form, rating_scale_max: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.self_review_required}
                onChange={e => setForm({ ...form, self_review_required: e.target.checked })} />
              Self review
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.manager_review_required}
                onChange={e => setForm({ ...form, manager_review_required: e.target.checked })} />
              Manager review
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enable_kpi_scoring}
                onChange={e => setForm({ ...form, enable_kpi_scoring: e.target.checked })} />
              KPI scoring
            </label>
          </div>

          {form.enable_kpi_scoring && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">KPI Template ({kpis.length})</h3>
                <button type="button" onClick={addKpi}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded">
                  <Plus className="w-3 h-3" /> Add KPI
                </button>
              </div>
              <div className="space-y-2">
                {kpis.map((k, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <input value={k.key} onChange={e => setKpi(i, 'key', e.target.value)}
                      placeholder="key" className="col-span-3 px-2 py-1.5 border rounded text-sm" />
                    <input value={k.label} onChange={e => setKpi(i, 'label', e.target.value)}
                      placeholder="Label" className="col-span-6 px-2 py-1.5 border rounded text-sm" />
                    <input type="number" value={k.weight} onChange={e => setKpi(i, 'weight', Number(e.target.value))}
                      placeholder="Weight" className="col-span-2 px-2 py-1.5 border rounded text-sm" />
                    <button type="button" onClick={() => rmKpi(i)}
                      className="col-span-1 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <p className="text-xs text-gray-500">
                  Total weight: {kpis.reduce((s, k) => s + (Number(k.weight) || 0), 0)}%
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={create.isPending || update.isPending}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {create.isPending || update.isPending ? 'Saving…' : (existing ? 'Save changes' : 'Create cycle')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function GoalsTab() {
  const [employeeFilter, setEmployeeFilter] = useState('')
  const { data: empData } = useHREmployees({ limit: 200 })
  const employees: EmployeeProfile[] = empData?.items ?? []
  const { data: goals = [], isLoading } = useHRGoals(employeeFilter ? { employee_id: employeeFilter } : undefined)
  const del = useDeleteHRGoal()
  const update = useUpdateHRGoal()
  const [editing, setEditing] = useState<PerformanceGoal | null>(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All employees</option>
          {(employees as EmployeeProfile[]).map(e => (
            <option key={e.id} value={e.id}>{e.vendor_user?.user?.full_name ?? e.employee_code}</option>
          ))}
        </select>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Goal
        </button>
      </div>
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (goals as PerformanceGoal[]).length === 0 ? (
          <div className="p-12 text-center">
            <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No goals yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>
                {['Title', 'Category', 'Progress', 'Target Date', 'Status', 'Actions'].map(h =>
                  <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(goals as PerformanceGoal[]).map(g => (
                <tr key={g.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium">{g.title}</p>
                    {g.description && <p className="text-xs text-gray-500">{g.description}</p>}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">{g.category ?? '—'}</td>
                  <td className="py-3 px-4">
                    <div className="w-32">
                      <input type="number" min={0} max={100} value={g.progress_pct ?? 0}
                        onChange={e => update.mutate({ id: g.id, data: { progress_pct: Number(e.target.value) } })}
                        className="w-16 px-2 py-1 text-xs border rounded mr-2" /> %
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{g.target_date ?? '—'}</td>
                  <td className="py-3 px-4">
                    <select value={g.status} onChange={e => update.mutate({ id: g.id, data: { status: e.target.value } })}
                      className="text-xs border rounded px-2 py-1">
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="dropped">Dropped</option>
                      <option value="on_hold">On hold</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditing(g)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => { if (confirm('Delete this goal?')) del.mutate(g.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {(showNew || editing) && (
        <GoalModal existing={editing} onClose={() => { setShowNew(false); setEditing(null) }} />
      )}
    </div>
  )
}

function GoalModal({ existing, onClose }: { existing?: PerformanceGoal | null; onClose: () => void }) {
  const { data: empData } = useHREmployees({ limit: 200 })
  const employees: EmployeeProfile[] = empData?.items ?? []
  const { data: cycles = [] } = useHRCycles()
  const create = useCreateHRGoal()
  const update = useUpdateHRGoal()
  const [form, setForm] = useState({
    employee_id: existing?.employee_id ?? '',
    cycle_id: existing?.cycle_id ?? '',
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    category: existing?.category ?? '',
    weight: existing?.weight ?? 1,
    target_date: existing?.target_date ?? '',
    target_value: existing?.target_value ?? '',
    status: existing?.status ?? 'active',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      cycle_id: form.cycle_id || null,
      target_date: form.target_date || null,
      target_value: form.target_value || null,
      weight: Number(form.weight) || 1,
    }
    if (existing) await update.mutateAsync({ id: existing.id, data: payload })
    else await create.mutateAsync(payload)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">{existing ? 'Edit Goal' : 'New Goal'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Employee *</label>
            <select required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
              <option value="">— Select —</option>
              {(employees as EmployeeProfile[]).map(e => (
                <option key={e.id} value={e.id}>{e.vendor_user?.user?.full_name ?? e.employee_code}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Cycle (optional)</label>
            <select value={form.cycle_id} onChange={e => setForm({ ...form, cycle_id: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
              <option value="">— None —</option>
              {(cycles as ReviewCycle[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Title *</label>
            <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Category</label>
              <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Technical" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Target Date</label>
              <input type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Weight</label>
              <input type="number" value={form.weight} onChange={e => setForm({ ...form, weight: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Target Value</label>
              <input value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="e.g. 100k revenue" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={create.isPending || update.isPending}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {create.isPending || update.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ReviewsTab() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data: reviews = [], isLoading } = useHRReviews(statusFilter ? { status: statusFilter } : undefined)
  const { data: empData } = useHREmployees({ limit: 200 })
  const employees: EmployeeProfile[] = empData?.items ?? []
  const empMap = new Map((employees as EmployeeProfile[]).map(e => [e.id, e.vendor_user?.user?.full_name ?? e.employee_code]))

  return (
    <div>
      <div className="flex items-center mb-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All statuses</option>
          {Object.entries(REVIEW_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (reviews as PerformanceReview[]).length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No reviews yet. Launch a cycle to generate reviews.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>
                {['Employee', 'Status', 'Self Rating', 'Overall', 'Submitted', 'Actions'].map(h =>
                  <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(reviews as PerformanceReview[]).map(r => {
                const cfg = REVIEW_STATUS[r.status] ?? REVIEW_STATUS.draft
                return (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{empMap.get(r.employee_id) ?? r.employee_id.slice(0, 8)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{r.self_rating ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{r.overall_rating ?? '—'}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {r.manager_submitted_at ? new Date(r.manager_submitted_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <Link to={`/hr/performance/reviews/${r.id}`}
                        className="p-1.5 inline-flex text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
