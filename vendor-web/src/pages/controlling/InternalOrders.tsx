import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, ExternalLink, FolderOpen, Target } from 'lucide-react'
import { useCompanies } from '@/hooks/useFinance'
import {
  useInternalOrdersReport,
  useCreateManufacturingOrder,
  useBudgetVsActual,
  useBudgetLines,
  useCreateBudgetLine,
  useDeleteBudgetLine,
} from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'

const ORDER_KINDS = [
  { value: '', label: 'All internal' },
  { value: 'project', label: 'Project Orders' },
  { value: 'internal', label: 'Internal Orders' },
  { value: 'assembly', label: 'Assembly Orders' },
  { value: 'process', label: 'Process Orders' },
]

const STATUS_OPTIONS = ['', 'draft', 'released', 'in_progress', 'completed', 'closed', 'cancelled']

const BUDGET_CATEGORIES = ['material', 'labor', 'overhead', 'other']

const statusColor = (s: string) => {
  const m: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    released: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    completed: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-gray-200 text-gray-500',
    cancelled: 'bg-red-100 text-red-600',
  }
  return m[s] ?? 'bg-gray-100 text-gray-500'
}

interface OrderRow {
  order_id: string
  order_no: string
  title: string | null
  order_kind: string
  status: string
  scheduled_start: string | null
  scheduled_end: string | null
  budgeted: string
  planned: string
  actual: string
  budget_variance: string
  plan_variance: string
  settlement_status: string
}

function BudgetPanel({ orderId, companyId }: { orderId: string; companyId: string }) {
  const { data: bva } = useBudgetVsActual(orderId)
  const { data: lines = [] } = useBudgetLines(orderId)
  const createMut = useCreateBudgetLine()
  const deleteMut = useDeleteBudgetLine()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ category: 'material', amount_budgeted: '', description: '' })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    await createMut.mutateAsync({
      orderId,
      data: { company_id: companyId, order_id: orderId, category: form.category, amount_budgeted: parseFloat(form.amount_budgeted || '0'), description: form.description },
    })
    setShowAdd(false)
    setForm({ category: 'material', amount_budgeted: '', description: '' })
  }

  return (
    <div className="space-y-4">
      {bva && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
            <p className="text-xs text-blue-600 mb-0.5">Budgeted</p>
            <p className="font-bold text-blue-800">{formatCurrency(parseFloat(bva.total_budgeted))}</p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
            <p className="text-xs text-amber-600 mb-0.5">Actual Cost</p>
            <p className="font-bold text-amber-800">{formatCurrency(parseFloat(bva.total_actual))}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
            <p className="text-xs text-emerald-600 mb-0.5">Remaining Budget</p>
            <p className={`font-bold ${parseFloat(bva.total_variance) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatCurrency(parseFloat(bva.total_variance))}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Budget Lines</h4>
        <button onClick={() => setShowAdd(true)}
          className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add Line
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-lg border border-violet-200 bg-violet-50 p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="rounded border border-gray-200 px-2 py-1.5 text-xs">
              {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" step="0.01" value={form.amount_budgeted}
              onChange={e => setForm(f => ({ ...f, amount_budgeted: e.target.value }))}
              className="rounded border border-gray-200 px-2 py-1.5 text-xs" placeholder="Amount" required />
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="rounded border border-gray-200 px-2 py-1.5 text-xs" placeholder="Description" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="text-xs text-violet-700 font-medium">
              {createMut.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {lines.length > 0 && (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Category</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Budgeted</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map(bl => (
                <tr key={bl.id}>
                  <td className="px-3 py-2 font-medium text-gray-700">{bl.category}</td>
                  <td className="px-3 py-2 text-gray-600">{bl.description ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(parseFloat(bl.amount_budgeted))}</td>
                  <td className="px-3 py-2 text-gray-500">{bl.budget_type}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => deleteMut.mutate({ orderId, blId: bl.id })}
                      className="text-red-400 hover:text-red-600 text-xs">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function InternalOrdersPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [error, setError] = useState('')

  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: orders = [], isLoading } = useInternalOrdersReport({
    company_id: activeCo || undefined,
    order_kind: kindFilter || undefined,
    status: statusFilter || undefined,
  })

  const createMut = useCreateManufacturingOrder()
  const [form, setForm] = useState({
    order_no: '',
    title: '',
    order_kind: 'project',
    priority: 'medium',
    scheduled_start: '',
    scheduled_end: '',
    notes: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await createMut.mutateAsync({
        company_id: activeCo,
        order_no: form.order_no || undefined,
        title: form.title,
        order_kind: form.order_kind,
        priority: form.priority,
        scheduled_start: form.scheduled_start || undefined,
        scheduled_end: form.scheduled_end || undefined,
        notes: form.notes || undefined,
        status: 'draft',
      })
      setShowCreate(false)
      setForm({ order_no: '', title: '', order_kind: 'project', priority: 'medium', scheduled_start: '', scheduled_end: '', notes: '' })
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to create order')
    }
  }

  const rows = orders as unknown as OrderRow[]
  const totalBudgeted = rows.reduce((s, r) => s + parseFloat(r.budgeted), 0)
  const totalActual = rows.reduce((s, r) => s + parseFloat(r.actual), 0)

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/controlling" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Internal &amp; Project Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Budget planning, actual cost tracking, and variance for internal orders</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Orders</p>
          <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs text-blue-600 mb-1">Total budgeted</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalBudgeted)}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs text-amber-600 mb-1">Total actual cost</p>
          <p className="text-2xl font-bold text-amber-700">{formatCurrency(totalActual)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {companies.length > 1 && (
          <select value={activeCo} onChange={e => setCompanyId(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
            {companies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        )}
        <select value={kindFilter} onChange={e => setKindFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          {ORDER_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div>}

      {/* Orders */}
      <div className="space-y-3">
        {isLoading && <div className="text-gray-400 text-sm">Loading orders…</div>}
        {!isLoading && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400 text-sm">
            No internal/project orders found. Create one above.
          </div>
        )}
        {rows.map(row => {
          const budVar = parseFloat(row.budget_variance)
          const isExpanded = expandedOrder === row.order_id
          return (
            <div key={row.order_id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div
                className="flex flex-wrap items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedOrder(isExpanded ? null : row.order_id)}
              >
                <FolderOpen className="w-5 h-5 text-violet-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{row.order_no}</span>
                    {row.title && <span className="text-gray-600 text-sm">— {row.title}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(row.status)}`}>{row.status}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{row.order_kind}</span>
                  </div>
                  {(row.scheduled_start || row.scheduled_end) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {row.scheduled_start} → {row.scheduled_end}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-6 text-right ml-auto">
                  <div>
                    <p className="text-xs text-gray-500">Budgeted</p>
                    <p className="text-sm font-medium text-gray-800">{formatCurrency(parseFloat(row.budgeted))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Actual</p>
                    <p className="text-sm font-medium text-gray-800">{formatCurrency(parseFloat(row.actual))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Budget Remaining</p>
                    <p className={`text-sm font-bold ${budVar >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {budVar >= 0 ? '+' : ''}{formatCurrency(budVar)}
                    </p>
                  </div>
                  <Link
                    to={`/controlling/orders/${row.order_id}`}
                    onClick={e => e.stopPropagation()}
                    className="text-violet-600 hover:text-violet-800"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                  <BudgetPanel orderId={row.order_id} companyId={activeCo} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-violet-600" /> New Internal / Project Order
              </h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Order Kind *</label>
                  <select value={form.order_kind} onChange={e => setForm(f => ({ ...f, order_kind: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <option value="project">Project</option>
                    <option value="internal">Internal</option>
                    <option value="assembly">Assembly</option>
                    <option value="process">Process</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Order No (auto if blank)</label>
                <input value={form.order_no} onChange={e => setForm(f => ({ ...f, order_no: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="e.g. INT-2026-001" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Order description" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input type="date" value={form.scheduled_start}
                    onChange={e => setForm(f => ({ ...f, scheduled_start: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input type="date" value={form.scheduled_end}
                    onChange={e => setForm(f => ({ ...f, scheduled_end: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Project description, scope, objectives…" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium">Cancel</button>
                <button type="submit" disabled={createMut.isPending}
                  className="flex-1 bg-violet-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
                  {createMut.isPending ? 'Creating…' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
