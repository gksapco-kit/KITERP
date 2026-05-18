import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, SendHorizonal, Trash2, GitMerge, X } from 'lucide-react'
import { useCompanies } from '@/hooks/useFinance'
import {
  useCostAllocations,
  useCreateCostAllocation,
  usePostCostAllocation,
  useDeleteCostAllocation,
} from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'
import type { CostAllocationOut } from '@/api/controlling'

const METHODS = ['percentage', 'fixed_amount', 'quantity_based', 'headcount']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const statusColor = (s: string) => {
  if (s === 'posted') return 'bg-emerald-100 text-emerald-700'
  if (s === 'reversed') return 'bg-gray-100 text-gray-500'
  return 'bg-amber-100 text-amber-700'
}

interface CreateForm {
  allocation_cycle: string
  period_year: string
  period_month: string
  allocation_method: string
  allocation_value: string
  allocated_amount: string
  narration: string
}

export default function CostAllocationsPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState('')

  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: allocations = [], isLoading } = useCostAllocations({
    company_id: activeCo || undefined,
    period_year: year,
    period_month: month,
    status: statusFilter || undefined,
  })

  const createMut = useCreateCostAllocation()
  const postMut = usePostCostAllocation()
  const deleteMut = useDeleteCostAllocation()

  const [form, setForm] = useState<CreateForm>({
    allocation_cycle: '',
    period_year: String(currentYear),
    period_month: String(currentMonth),
    allocation_method: 'percentage',
    allocation_value: '',
    allocated_amount: '',
    narration: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await createMut.mutateAsync({
        company_id: activeCo,
        period_year: parseInt(form.period_year),
        period_month: parseInt(form.period_month),
        allocation_cycle: form.allocation_cycle || undefined,
        allocation_method: form.allocation_method,
        allocation_value: parseFloat(form.allocation_value || '0'),
        allocated_amount: parseFloat(form.allocated_amount || '0'),
        narration: form.narration || undefined,
      })
      setShowCreate(false)
      setForm(f => ({ ...f, allocation_cycle: '', allocated_amount: '', narration: '' }))
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to create')
    }
  }

  const handlePost = async (id: string) => {
    try {
      await postMut.mutateAsync({ id })
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to post')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this allocation?')) return
    try {
      await deleteMut.mutateAsync(id)
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to delete')
    }
  }

  const totalAllocated = (allocations as CostAllocationOut[]).reduce(
    (s, a) => s + parseFloat(a.allocated_amount),
    0,
  )

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/controlling" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cost Allocations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Period-end cost center to cost center allocations</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Allocation
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Allocations this period</p>
          <p className="text-2xl font-bold text-gray-900">{allocations.length}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs text-amber-600 mb-1">Pending (not yet posted)</p>
          <p className="text-2xl font-bold text-amber-700">
            {(allocations as CostAllocationOut[]).filter(a => a.status === 'planned').length}
          </p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-accent p-4">
          <p className="text-xs text-primary mb-1">Total allocated amount</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(totalAllocated)}</p>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap gap-3 items-center">
        {companies.length > 1 && (
          <select value={activeCo} onChange={e => setCompanyId(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
            {companies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        )}
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          {[currentYear - 1, currentYear, currentYear + 1].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          <option value="">All statuses</option>
          <option value="planned">Planned</option>
          <option value="posted">Posted</option>
          <option value="reversed">Reversed</option>
        </select>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div>}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Cycle</th>
              <th className="px-4 py-3 font-medium text-gray-600">Period</th>
              <th className="px-4 py-3 font-medium text-gray-600">Method</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Allocation Value</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Allocated Amount</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600">Posting Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && allocations.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No allocations for {MONTHS[month - 1]} {year}. Create one above.
                </td>
              </tr>
            )}
            {(allocations as CostAllocationOut[]).map(a => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{a.allocation_cycle || '—'}</td>
                <td className="px-4 py-3 text-gray-700">{MONTHS[a.period_month - 1]} {a.period_year}</td>
                <td className="px-4 py-3 text-gray-600">{a.allocation_method}</td>
                <td className="px-4 py-3 text-right text-gray-700">{parseFloat(a.allocation_value).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(parseFloat(a.allocated_amount))}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(a.status)}`}>{a.status}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{a.posting_date ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {a.status === 'planned' && (
                      <>
                        <button
                          onClick={() => handlePost(a.id)}
                          disabled={postMut.isPending}
                          className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
                        >
                          <SendHorizonal className="w-3 h-3" /> Post
                        </button>
                        <button onClick={() => handleDelete(a.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-primary" /> New Cost Allocation
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Allocation Cycle Name</label>
                <input value={form.allocation_cycle}
                  onChange={e => setForm(f => ({ ...f, allocation_cycle: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="e.g. ADMIN-ALLOC, FACILITY-COST" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Year *</label>
                  <input type="number" value={form.period_year}
                    onChange={e => setForm(f => ({ ...f, period_year: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Month *</label>
                  <select value={form.period_month}
                    onChange={e => setForm(f => ({ ...f, period_month: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Allocation Method</label>
                <select value={form.allocation_method}
                  onChange={e => setForm(f => ({ ...f, allocation_method: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {form.allocation_method === 'percentage' ? 'Percentage (%)' : 'Driver Value'}
                  </label>
                  <input type="number" step="0.000001" value={form.allocation_value}
                    onChange={e => setForm(f => ({ ...f, allocation_value: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Allocated Amount</label>
                  <input type="number" step="0.0001" value={form.allocated_amount}
                    onChange={e => setForm(f => ({ ...f, allocated_amount: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Narration</label>
                <input value={form.narration} onChange={e => setForm(f => ({ ...f, narration: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Description…" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="btn-cancel flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium">Cancel</button>
                <button type="submit" disabled={createMut.isPending}
                  className="flex-1 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                  {createMut.isPending ? 'Saving…' : 'Create Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
