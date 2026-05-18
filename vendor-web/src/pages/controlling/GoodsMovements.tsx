import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, RotateCcw, Package, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { useCompanies } from '@/hooks/useFinance'
import {
  useGoodsMovements,
  useCreateGoodsMovement,
  useReverseGoodsMovement,
  useManufacturingOrders,
} from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'
import type { GoodsMovementOut } from '@/api/controlling'

const MOVEMENT_TYPES = [
  { value: '261', label: 'Goods Issue (261) — Component → Order', icon: ArrowDownToLine, color: 'red' },
  { value: '262', label: 'GI Return (262) — Component ← Order', icon: ArrowUpFromLine, color: 'amber' },
  { value: '101', label: 'Goods Receipt (101) — FG ← Order', icon: ArrowUpFromLine, color: 'emerald' },
  { value: '102', label: 'GR Return (102) — FG → Order', icon: ArrowDownToLine, color: 'gray' },
]

const typeLabel = (mt: string) => MOVEMENT_TYPES.find(t => t.value === mt)?.label ?? mt

const typeColor = (mt: string) => {
  const m: Record<string, string> = {
    '261': 'bg-red-100 text-red-700',
    '262': 'bg-amber-100 text-amber-700',
    '101': 'bg-emerald-100 text-emerald-700',
    '102': 'bg-gray-100 text-gray-700',
  }
  return m[mt] ?? 'bg-gray-100 text-gray-600'
}

interface CreateForm {
  company_id: string
  order_id: string
  movement_type: string
  posting_date: string
  product_id: string
  description: string
  uom: string
  qty: string
  unit_cost: string
  storage_location: string
  batch_no: string
}

export default function GoodsMovementsPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const [movTypeFilter, setMovTypeFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [reverseId, setReverseId] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [error, setError] = useState('')

  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: movements = [], isLoading } = useGoodsMovements({
    company_id: activeCo || undefined,
    movement_type: movTypeFilter || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
  })

  const { data: orders = [] } = useManufacturingOrders({
    company_id: activeCo || undefined,
  })

  const createMut = useCreateGoodsMovement()
  const reverseMut = useReverseGoodsMovement()

  const [form, setForm] = useState<CreateForm>({
    company_id: '',
    order_id: '',
    movement_type: '261',
    posting_date: new Date().toISOString().split('T')[0],
    product_id: '',
    description: '',
    uom: 'EA',
    qty: '',
    unit_cost: '',
    storage_location: '',
    batch_no: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await createMut.mutateAsync({
        ...form,
        company_id: activeCo,
        qty: parseFloat(form.qty),
        unit_cost: parseFloat(form.unit_cost || '0'),
        product_id: form.product_id || undefined,
      })
      setShowCreate(false)
      setForm(f => ({ ...f, qty: '', description: '', batch_no: '' }))
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to create goods movement')
    }
  }

  const handleReverse = async () => {
    if (!reverseId || !reverseReason.trim()) return
    try {
      await reverseMut.mutateAsync({ id: reverseId, reason: reverseReason })
      setReverseId(null)
      setReverseReason('')
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to reverse')
    }
  }

  const total261 = movements.filter(m => m.movement_type === '261').reduce((s, m) => s + parseFloat(m.total_cost), 0)
  const total101 = movements.filter(m => m.movement_type === '101').reduce((s, m) => s + parseFloat(m.total_cost), 0)

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/controlling" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goods Movements</h1>
          <p className="text-sm text-gray-500 mt-0.5">Component issues (261), FG receipts (101), and returns</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Post Movement
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Total movements</p>
          <p className="text-2xl font-bold text-gray-900">{movements.length}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-xs text-red-600 mb-1">Component issues (261) cost</p>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(total261)}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs text-emerald-600 mb-1">FG receipts (101) cost</p>
          <p className="text-2xl font-bold text-emerald-700">{formatCurrency(total101)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {companies.length > 1 && (
          <select
            value={activeCo}
            onChange={e => setCompanyId(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
          >
            {companies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        )}
        <select
          value={movTypeFilter}
          onChange={e => setMovTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
        >
          <option value="">All types</option>
          {MOVEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.value} — {t.label.split('—')[1]?.trim()}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white" placeholder="From" />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white" placeholder="To" />
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div>}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Doc No</th>
              <th className="px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Qty</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Unit Cost</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && movements.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No goods movements. Post your first movement above.</td></tr>
            )}
            {movements.map((gm: GoodsMovementOut) => (
              <tr key={gm.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{gm.document_no}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${typeColor(gm.movement_type)}`}>
                    {gm.movement_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{gm.posting_date}</td>
                <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{gm.description}</td>
                <td className="px-4 py-3 text-right text-gray-700">{parseFloat(gm.qty).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(parseFloat(gm.unit_cost))}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(parseFloat(gm.total_cost))}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${gm.status === 'reversed' ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>
                    {gm.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {gm.status === 'posted' && (
                    <button
                      onClick={() => { setReverseId(gm.id); setReverseReason('') }}
                      className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Reverse
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" /> Post Goods Movement
              </h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Movement Type *</label>
                <select
                  value={form.movement_type}
                  onChange={e => setForm(f => ({ ...f, movement_type: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  required
                >
                  {MOVEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CO Order *</label>
                <select
                  value={form.order_id}
                  onChange={e => setForm(f => ({ ...f, order_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  required
                >
                  <option value="">— select order —</option>
                  {(orders as Array<{ id: string; order_no: string; title?: string }>).map(o => (
                    <option key={o.id} value={o.id}>{o.order_no} {o.title ? `— ${o.title}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Posting Date *</label>
                  <input type="date" value={form.posting_date}
                    onChange={e => setForm(f => ({ ...f, posting_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">UoM</label>
                  <input value={form.uom} onChange={e => setForm(f => ({ ...f, uom: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Component name / item description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
                  <input type="number" step="0.0001" value={form.qty}
                    onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit Cost</label>
                  <input type="number" step="0.0001" value={form.unit_cost}
                    onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Storage Location</label>
                  <input value={form.storage_location}
                    onChange={e => setForm(f => ({ ...f, storage_location: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Batch / Lot No</label>
                  <input value={form.batch_no}
                    onChange={e => setForm(f => ({ ...f, batch_no: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="btn-cancel flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={createMut.isPending}
                  className="flex-1 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                  {createMut.isPending ? 'Posting…' : 'Post Movement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reverse modal */}
      {reverseId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Reverse Goods Movement</h2>
            <p className="text-sm text-gray-600">
              This will mark the movement as reversed. Please provide a reason.
            </p>
            <textarea
              value={reverseReason}
              onChange={e => setReverseReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Reason for reversal…"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setReverseId(null)}
                className="btn-cancel flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={handleReverse}
                disabled={!reverseReason.trim() || reverseMut.isPending}
                className="flex-1 bg-amber-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-60"
              >
                {reverseMut.isPending ? 'Reversing…' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
