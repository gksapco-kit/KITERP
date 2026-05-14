import { useState } from 'react'
import { Plus, CheckCircle, DollarSign, X, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import {
  usePayoutRuns, useCreatePayoutRun, useApprovePayoutRun, usePayPayoutRun, useCancelPayoutRun, usePayoutRun,
} from '@/hooks/useCommission'
import type { CommissionPayoutRun } from '@/types/commission'

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  paid: 'bg-primary/12 text-primary',
  cancelled: 'bg-gray-100 text-gray-500',
}

function RunDetail({ runId }: { runId: string }) {
  const { data: run } = usePayoutRun(runId)
  if (!run) return <div className="px-6 py-4 text-sm text-gray-400">Loading…</div>
  const items = run.items || []
  const fmtCurrency = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  return (
    <div className="px-6 py-4 border-t border-gray-100">
      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Payee Breakdown</h4>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-gray-100">
          <th className="text-left py-2 text-xs text-gray-500">Payee</th>
          <th className="text-right py-2 text-xs text-gray-500">Accruals</th>
          <th className="text-right py-2 text-xs text-gray-500">Amount</th>
          <th className="text-right py-2 text-xs text-gray-500">Points</th>
          <th className="text-right py-2 text-xs text-gray-500">Status</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-50">
          {items.map(item => (
            <tr key={item.id}>
              <td className="py-2 text-xs font-mono text-gray-500">{item.payee_id.slice(0, 8)}…</td>
              <td className="py-2 text-right text-gray-600">{item.accrual_count}</td>
              <td className="py-2 text-right font-medium text-gray-900">{fmtCurrency(item.total_amount)}</td>
              <td className="py-2 text-right text-gray-600">{item.total_points}</td>
              <td className="py-2 text-right">
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${item.status === 'paid' ? 'bg-primary/12 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function PayoutsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    period_start: '', period_end: '', payment_method: 'bank_transfer', notes: '',
  })

  const { data, isLoading } = usePayoutRuns()
  const create = useCreatePayoutRun()
  const approveMut = useApprovePayoutRun()
  const payMut = usePayPayoutRun()
  const cancelMut = useCancelPayoutRun()

  const runs = data?.items || []
  const fmtCurrency = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  const handleCreate = async () => {
    try {
      await create.mutateAsync({
        period_start: createForm.period_start || null,
        period_end: createForm.period_end || null,
        payment_method: createForm.payment_method,
        notes: createForm.notes || null,
      })
      toast.success('Payout run created')
      setShowCreate(false)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'No approved accruals found for the given period')
    }
  }

  const handleApprove = async (id: string) => {
    try { await approveMut.mutateAsync({ id }); toast.success('Run approved') }
    catch { toast.error('Failed to approve') }
  }
  const handlePay = async (id: string) => {
    try { await payMut.mutateAsync({ id }); toast.success('Run marked as paid') }
    catch { toast.error('Failed to mark as paid') }
  }
  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this payout run?')) return
    try { await cancelMut.mutateAsync({ id }); toast.success('Run cancelled') }
    catch { toast.error('Failed to cancel') }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Payout Runs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Batch approved accruals into payable runs</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New Run
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
          <p className="font-medium">No payout runs yet</p>
          <p className="text-sm mt-1">Create a run to batch and pay approved commissions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map(run => (
            <div key={run.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === run.id ? null : run.id)} className="text-gray-400">
                    {expanded === run.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{run.run_no}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[run.status]}`}>{run.status}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3">
                      {run.period_start && <span>{run.period_start} → {run.period_end}</span>}
                      <span>{run.payee_count} payees</span>
                      <span className="font-medium text-gray-700">{fmtCurrency(run.total_amount)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {run.status === 'open' && (
                    <button onClick={() => handleApprove(run.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100">
                      <CheckCircle className="h-3.5 w-3.5" /> Approve
                    </button>
                  )}
                  {run.status === 'approved' && (
                    <button onClick={() => handlePay(run.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-accent text-primary rounded-lg text-xs font-medium hover:bg-primary/12">
                      <DollarSign className="h-3.5 w-3.5" /> Mark Paid
                    </button>
                  )}
                  {['open', 'approved'].includes(run.status) && (
                    <button onClick={() => handleCancel(run.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {expanded === run.id && <RunDetail runId={run.id} />}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">New Payout Run</h2>
              <p className="text-xs text-gray-500 mt-1">Will batch all approved accruals in the selected period</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[{ k: 'period_start', l: 'Period Start' }, { k: 'period_end', l: 'Period End' }].map(f => (
                  <div key={f.k}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{f.l}</label>
                    <input type="date" value={createForm[f.k as keyof typeof createForm]}
                      onChange={e => setCreateForm(p => ({ ...p, [f.k]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                <select value={createForm.payment_method} onChange={e => setCreateForm(p => ({ ...p, payment_method: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  {['bank_transfer', 'cash', 'upi', 'cheque'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={createForm.notes} onChange={e => setCreateForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} disabled={create.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {create.isPending ? 'Creating…' : 'Create Run'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
