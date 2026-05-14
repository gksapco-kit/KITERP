import { useState } from 'react'
import { CheckCircle, RotateCcw, Filter, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { useAccruals, useApproveAccrual, useReverseAccrual, useBulkApproveAccruals } from '@/hooks/useCommission'
import type { CommissionAccrual, AccrualStatus } from '@/types/commission'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  accrued: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  paid: 'bg-primary/12 text-primary',
  reversed: 'bg-red-100 text-red-700',
  disputed: 'bg-yellow-100 text-yellow-700',
}

const CHANNELS = ['', 'pos', 'online', 'booking']
const STATUSES = ['', 'accrued', 'approved', 'paid', 'reversed', 'disputed']

export default function AccrualsPage() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Record<string, string>>({
    status: '', channel: '', date_from: '', date_to: '',
  })
  const [showFilters, setShowFilters] = useState(false)

  const params = { page, size: 20, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }
  const { data, isLoading, refetch } = useAccruals(params)
  const approve = useApproveAccrual()
  const reverse = useReverseAccrual()
  const bulkApprove = useBulkApproveAccruals()

  const items = data?.items || []
  const pages = data?.pages || 1
  const total = data?.total || 0

  const handleApprove = async (id: string) => {
    try { await approve.mutateAsync(id); toast.success('Accrual approved') }
    catch { toast.error('Failed to approve') }
  }

  const handleReverse = async (id: string) => {
    if (!confirm('Reverse this accrual? This cannot be undone.')) return
    try { await reverse.mutateAsync(id); toast.success('Reversed') }
    catch { toast.error('Failed to reverse') }
  }

  const handleBulkApprove = async () => {
    if (!confirm('Approve all accrued accruals?')) return
    try {
      const r = await bulkApprove.mutateAsync(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)))
      toast.success(`Approved ${r.approved} accruals`)
    } catch { toast.error('Bulk approve failed') }
  }

  const fmtCurrency = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  const fmtPoints = (v: number) => (v === 0 ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 4 }))
  const fmtEquity = (v: number) => (v === 0 ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 6 }))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Commission Accruals</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} accruals found</p>
          <p className="text-xs text-amber-800/90 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 mt-2 max-w-3xl">
            <strong className="font-medium">Points</strong> rules earn <strong>points</strong>, not rupees — check the <em>Points</em> column.
            For currency commission, edit the plan rule and use <strong>percentage</strong> or <strong>flat</strong>.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(p => !p)}
            className="flex items-center gap-2 border border-gray-200 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
            <Filter className="h-4 w-4" /> Filters <ChevronDown className="h-3 w-3" />
          </button>
          <button onClick={handleBulkApprove} disabled={bulkApprove.isPending}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            <CheckCircle className="h-4 w-4" /> Bulk Approve
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              {STATUSES.map(s => <option key={s} value={s}>{s || 'All'}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Channel</label>
            <select value={filters.channel} onChange={e => setFilters(p => ({ ...p, channel: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              {CHANNELS.map(c => <option key={c} value={c}>{c || 'All'}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
            <input type="date" value={filters.date_from} onChange={e => setFilters(p => ({ ...p, date_from: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
            <input type="date" value={filters.date_to} onChange={e => setFilters(p => ({ ...p, date_to: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Date', 'Source', 'Payee', 'Channel', 'Base', 'Type', 'Commission', 'Points', 'Equity', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={11} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-12 text-gray-400">No accruals found</td></tr>
            ) : items.map(a => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{a.sale_date}</td>
                <td className="px-4 py-3">
                  <div className="text-xs font-mono text-gray-500">{a.source_type}/{a.source_id.slice(0, 8)}</div>
                  <div className="text-xs text-gray-400">{a.source_line_ref}</div>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-gray-500">{a.payee_id.slice(0, 8)}…</td>
                <td className="px-4 py-3 capitalize text-gray-600">{a.channel || '—'}</td>
                <td className="px-4 py-3 text-gray-700">{fmtCurrency(a.base_amount)}</td>
                <td className="px-4 py-3 text-gray-500 capitalize text-xs">{a.calculation_type.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 font-semibold text-gray-900">{fmtCurrency(a.commission_amount ?? 0)}</td>
                <td className="px-4 py-3 text-gray-700 tabular-nums">{fmtPoints(a.points_amount ?? 0)}</td>
                <td className="px-4 py-3 text-gray-600 text-xs tabular-nums">{fmtEquity(a.equity_units_amount ?? 0)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 justify-end">
                    {a.status === 'accrued' && (
                      <button onClick={() => handleApprove(a.id)} title="Approve"
                        className="text-green-500 hover:text-green-700"><CheckCircle className="h-4 w-4" /></button>
                    )}
                    {['accrued', 'approved'].includes(a.status) && (
                      <button onClick={() => handleReverse(a.id)} title="Reverse"
                        className="text-red-400 hover:text-red-600"><RotateCcw className="h-4 w-4" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: Math.min(pages, 10) }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`px-3 py-1 rounded text-sm ${page === i + 1 ? 'bg-blue-600 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
