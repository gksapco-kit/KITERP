import { useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { formLabelClass } from '@/components/common/FormSectionNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Plus, CheckCircle, DollarSign, X, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import {
  usePayoutRuns, useCreatePayoutRun, useApprovePayoutRun, usePayPayoutRun, useCancelPayoutRun, usePayoutRun,
} from '@/hooks/useCommission'
import {
  PAYOUT_STATUS_COLORS,
  commissionEmptyCell,
  commissionFieldInput,
  commissionPageSub,
  commissionPageTitle,
  commissionTableIconBtn,
  commissionTbody,
} from '@/pages/commission/commissionUi'

function RunDetail({ runId }: { runId: string }) {
  const { data: run } = usePayoutRun(runId)
  if (!run) return <div className="px-6 py-4 text-sm text-muted-foreground">Loading…</div>
  const items = run.items || []
  const fmtCurrency = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  return (
    <div className="px-6 py-4 border-t border-border bg-muted/20">
      <h4 className="text-xs font-medium text-muted-foreground uppercase mb-3">Payee Breakdown</h4>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border">
          <th className="text-left py-2 text-xs text-muted-foreground"><TableColumnLabel>Payee</TableColumnLabel></th>
          <th className="text-right py-2 text-xs text-muted-foreground"><TableColumnLabel>Accruals</TableColumnLabel></th>
          <th className="text-right py-2 text-xs text-muted-foreground"><TableColumnLabel>Amount</TableColumnLabel></th>
          <th className="text-right py-2 text-xs text-muted-foreground"><TableColumnLabel>Points</TableColumnLabel></th>
          <th className="text-right py-2 text-xs text-muted-foreground"><TableColumnLabel>Status</TableColumnLabel></th>
        </tr></thead>
        <tbody className={commissionTbody}>
          {items.map(item => (
            <tr key={item.id}>
              <td className="py-2 text-xs font-mono text-muted-foreground">{item.payee_id.slice(0, 8)}…</td>
              <td className="py-2 text-right text-muted-foreground">{item.accrual_count}</td>
              <td className="py-2 text-right font-medium text-foreground">{fmtCurrency(item.total_amount)}</td>
              <td className="py-2 text-right text-muted-foreground">{item.total_points}</td>
              <td className="py-2 text-right">
                <span className={`px-1.5 py-0.5 rounded text-xs ${item.status === 'paid' ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground'}`}>
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

  const closeCreate = () => setShowCreate(false)

  useEscapeToClose(closeCreate, showCreate)

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
          <h1 className={commissionPageTitle}>Payout Runs</h1>
          <p className={commissionPageSub}>Batch approved accruals into payable runs</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Run
        </Button>
      </div>

      {isLoading ? (
        <div className={commissionEmptyCell}>Loading…</div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl text-muted-foreground">
          <p className="font-medium text-foreground">No payout runs yet</p>
          <p className="text-sm mt-1">Create a run to batch and pay approved commissions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map(run => (
            <div key={run.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setExpanded(expanded === run.id ? null : run.id)} className="text-muted-foreground hover:text-foreground">
                    {expanded === run.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{run.run_no}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${PAYOUT_STATUS_COLORS[run.status]}`}>{run.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                      {run.period_start && <span>{run.period_start} → {run.period_end}</span>}
                      <span>{run.payee_count} payees</span>
                      <span className="font-medium text-foreground">{fmtCurrency(run.total_amount)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {run.status === 'open' && (
                    <button type="button" onClick={() => handleApprove(run.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-medium hover:bg-emerald-500/25">
                      <CheckCircle className="h-3.5 w-3.5" /> Approve
                    </button>
                  )}
                  {run.status === 'approved' && (
                    <button type="button" onClick={() => handlePay(run.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-accent text-primary rounded-lg text-xs font-medium hover:bg-primary/12">
                      <DollarSign className="h-3.5 w-3.5" /> Mark Paid
                    </button>
                  )}
                  {['open', 'approved'].includes(run.status) && (
                    <button type="button" aria-label="Cancel run" onClick={() => handleCancel(run.id)}
                      className={`${commissionTableIconBtn} hover:text-red-500 dark:hover:text-red-400`}>
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

      {showCreate && (
        <div data-kiterp-modal
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={closeCreate}
        >
          <div
            className="bg-card border border-border text-foreground rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-foreground">New Payout Run</h2>
                <p className="text-xs text-muted-foreground mt-1">Will batch all approved accruals in the selected period</p>
              </div>
              <button
                type="button"
                onClick={closeCreate}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[{ k: 'period_start', l: 'Period Start' }, { k: 'period_end', l: 'Period End' }].map(f => (
                  <div key={f.k}>
                    <Label className={`block mb-1 ${formLabelClass}`}>{f.l}</Label>
                    <Input type="date" value={createForm[f.k as keyof typeof createForm]}
                      onChange={e => setCreateForm(p => ({ ...p, [f.k]: e.target.value }))}
                      className="h-9" />
                  </div>
                ))}
              </div>
              <div>
                <Label className={`block mb-1 ${formLabelClass}`}>Payment Method</Label>
                <Select
                  value={createForm.payment_method}
                  onChange={(v) => setCreateForm(p => ({ ...p, payment_method: v }))}
                  options={['bank_transfer', 'cash', 'upi', 'cheque'].map(m => ({
                    value: m,
                    label: m.replace('_', ' '),
                  }))}
                  aria-label="Payment method"
                  className="w-full"
                />
              </div>
              <div>
                <Label className={`block mb-1 ${formLabelClass}`}>Notes</Label>
                <textarea value={createForm.notes} onChange={e => setCreateForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2} className={commissionFieldInput} />
              </div>
            </div>
            <div className="p-4 border-t border-border bg-muted/25 flex gap-3 justify-end">
              <Button type="button" variant="cancel" onClick={closeCreate}>Cancel</Button>
              <Button onClick={handleCreate} disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create Run'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
