import { useState, useMemo } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Label } from '@/components/ui/label'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Clock, Trash2, X } from 'lucide-react'
import { useCompanies } from '@/hooks/useFinance'
import {
  useActivityConfirmations,
  useCreateActivityConfirmation,
  useDeleteActivityConfirmation,
  useManufacturingOrders,
  useActivityTypes,
} from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'
import type { ActivityConfirmationOut } from '@/api/controlling'

const CONFIRMATION_TYPES = ['labor', 'machine', 'setup', 'other']

interface CreateForm {
  order_id: string
  operation_id: string
  activity_type_id: string
  confirmation_date: string
  confirmation_type: string
  qty_confirmed: string
  hours_confirmed: string
  rate_per_hour: string
  scrap_qty: string
  yield_pct: string
  narration: string
}

export default function ActivityConfirmationsPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState('')

  useEscapeToClose(() => setShowCreate(false), showCreate)

  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: confirmations = [], isLoading } = useActivityConfirmations({
    company_id: activeCo || undefined,
    confirmation_type: typeFilter || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
  })

  const { data: orders = [] } = useManufacturingOrders({ company_id: activeCo || undefined })
  const { data: activityTypes = [] } = useActivityTypes(activeCo || undefined)

  const createMut = useCreateActivityConfirmation()
  const deleteMut = useDeleteActivityConfirmation()

  const [form, setForm] = useState<CreateForm>({
    order_id: '',
    operation_id: '',
    activity_type_id: '',
    confirmation_date: new Date().toISOString().split('T')[0],
    confirmation_type: 'labor',
    qty_confirmed: '',
    hours_confirmed: '',
    rate_per_hour: '',
    scrap_qty: '0',
    yield_pct: '100',
    narration: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await createMut.mutateAsync({
        company_id: activeCo,
        order_id: form.order_id,
        operation_id: form.operation_id || undefined,
        activity_type_id: form.activity_type_id || undefined,
        confirmation_date: form.confirmation_date,
        confirmation_type: form.confirmation_type,
        qty_confirmed: parseFloat(form.qty_confirmed || '0'),
        hours_confirmed: parseFloat(form.hours_confirmed || '0'),
        rate_per_hour: parseFloat(form.rate_per_hour || '0'),
        scrap_qty: parseFloat(form.scrap_qty || '0'),
        yield_pct: parseFloat(form.yield_pct || '100'),
        narration: form.narration || undefined,
      })
      setShowCreate(false)
      setForm(f => ({ ...f, qty_confirmed: '', hours_confirmed: '', narration: '' }))
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to post confirmation')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this activity confirmation?')) return
    try {
      await deleteMut.mutateAsync(id)
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to delete')
    }
  }

  const totalHours = confirmations.reduce((s, c) => s + parseFloat((c as ActivityConfirmationOut).hours_confirmed), 0)
  const totalCost = confirmations.reduce((s, c) => s + parseFloat((c as ActivityConfirmationOut).total_cost), 0)

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/controlling" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Confirmations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Time entry and actual activity cost confirmation for orders</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Post Confirmation
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Confirmations posted</p>
          <p className="text-2xl font-bold text-gray-900">{confirmations.length}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs text-blue-600 mb-1">Total hours confirmed</p>
          <p className="text-2xl font-bold text-blue-700">{totalHours.toFixed(2)} h</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-accent p-4">
          <p className="text-xs text-primary mb-1">Total confirmed cost</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(totalCost)}</p>
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
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          <option value="">All types</option>
          {CONFIRMATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white" />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white" />
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div>}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Date</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Type</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Order</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Qty</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Hours</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Rate/h</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Total Cost</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Yield %</TableColumnLabel></th>
              <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Status</TableColumnLabel></th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && confirmations.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No confirmations yet. Post the first time entry above.</td></tr>
            )}
            {(confirmations as ActivityConfirmationOut[]).map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-700">{c.confirmation_date}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    <Clock className="w-3 h-3" />{c.confirmation_type}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.order_id.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-right text-gray-700">{parseFloat(c.qty_confirmed).toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{parseFloat(c.hours_confirmed).toFixed(3)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(parseFloat(c.rate_per_hour))}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(parseFloat(c.total_cost))}</td>
                <td className="px-4 py-3 text-right text-gray-600">{parseFloat(c.yield_pct).toFixed(1)}%</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'reversed' ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {c.status === 'posted' && (
                    <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" /> Post Activity Confirmation
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
                <Label className="block text-xs font-medium text-gray-600 mb-1" required>CO Order</Label>
                <select value={form.order_id} onChange={e => setForm(f => ({ ...f, order_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" required>
                  <option value="">— select order —</option>
                  {(orders as Array<{ id: string; order_no: string; title?: string }>).map(o => (
                    <option key={o.id} value={o.id}>{o.order_no} {o.title ? `— ${o.title}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">Confirmation Type</Label>
                  <select value={form.confirmation_type}
                    onChange={e => setForm(f => ({ ...f, confirmation_type: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    {CONFIRMATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">Activity Type</Label>
                  <select value={form.activity_type_id}
                    onChange={e => setForm(f => ({ ...f, activity_type_id: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <option value="">— optional —</option>
                    {(activityTypes as Array<{ id: string; code: string; name: string }>).map(a => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label className="block text-xs font-medium text-gray-600 mb-1" required>Confirmation Date</Label>
                <input type="date" value={form.confirmation_date}
                  onChange={e => setForm(f => ({ ...f, confirmation_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">Qty Confirmed</Label>
                  <input type="number" step="0.0001" value={form.qty_confirmed}
                    onChange={e => setForm(f => ({ ...f, qty_confirmed: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1" required>Hours</Label>
                  <input type="number" step="0.001" value={form.hours_confirmed}
                    onChange={e => setForm(f => ({ ...f, hours_confirmed: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" required />
                </div>
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">Rate / Hour</Label>
                  <input type="number" step="0.0001" value={form.rate_per_hour}
                    onChange={e => setForm(f => ({ ...f, rate_per_hour: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">Scrap Qty</Label>
                  <input type="number" step="0.0001" value={form.scrap_qty}
                    onChange={e => setForm(f => ({ ...f, scrap_qty: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">Yield %</Label>
                  <input type="number" step="0.01" min="0" max="100" value={form.yield_pct}
                    onChange={e => setForm(f => ({ ...f, yield_pct: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <Label className="block text-xs font-medium text-gray-600 mb-1">Narration</Label>
                <input value={form.narration} onChange={e => setForm(f => ({ ...f, narration: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Optional notes…" />
              </div>
              {form.hours_confirmed && form.rate_per_hour && (
                <div className="rounded-lg bg-blue-50 text-blue-700 text-sm p-3">
                  Computed total cost: <strong>{formatCurrency(parseFloat(form.hours_confirmed) * parseFloat(form.rate_per_hour))}</strong>
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="btn-cancel flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={createMut.isPending}
                  className="flex-1 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                  {createMut.isPending ? 'Posting…' : 'Post Confirmation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
