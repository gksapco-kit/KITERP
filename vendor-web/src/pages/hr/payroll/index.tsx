import { onModalBackdropClick, cn } from '@/lib/utils'
import { dialogOverlayClass, dialogPanelClass } from '@/lib/modalUi'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Link } from 'react-router-dom'
import { Play, CheckCircle, Receipt, Loader2, Trash2, AlertTriangle, X, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { useHRPayrollRuns, useProcessPayroll, useDeletePayrollRun } from '@/hooks/useVendor'
import type { PayrollRun } from '@/types'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  processing: { label: 'Processing', color: 'bg-yellow-100 text-yellow-700' },
  processed: { label: 'Processed', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
}

function ProcessWizard({
 onClose }: { onClose: () => void }) {
  const processPayroll = useProcessPayroll()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [step, setStep] = useState<'config' | 'confirm' | 'done'>('config')

  async function handleProcess() {
    setStep('confirm')
    await processPayroll.mutateAsync({ month, year })
    setStep('done')
  }

  return (
    <div data-kiterp-modal className={dialogOverlayClass} onClick={onModalBackdropClick(onClose)}>
      <div className={cn(dialogPanelClass, 'max-w-md relative')} onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
        {step === 'config' && (
          <>
            <h2 className="text-lg font-semibold mb-4 pr-8">Process Payroll</h2>
            <p className="text-sm text-gray-500 mb-4">
              Select the payroll period to process. A new version will be created if you re-run for the same month.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <Label className="block text-xs font-medium text-gray-700 mb-1">Month</Label>
                <Select
                  value={String(month)}
                  onChange={v => setMonth(parseInt(v))}
                  options={Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({
                    value: String(m),
                    label: new Date(year, m - 1).toLocaleDateString('en-IN', { month: 'long' }),
                  }))}
                />
              </div>
              <div>
                <Label className="block text-xs font-medium text-gray-700 mb-1">Year</Label>
                <Select
                  value={String(year)}
                  onChange={v => setYear(parseInt(v))}
                  options={[now.getFullYear() - 1, now.getFullYear()].map(y => ({ value: String(y), label: String(y) }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
              <button onClick={handleProcess} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
                <Play className="w-4 h-4" /> Process
              </button>
            </div>
          </>
        )}
        {step === 'confirm' && (
          <div className="text-center py-6">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="font-medium text-gray-700">Processing payroll…</p>
            <p className="text-sm text-gray-400 mt-1">Computing earnings, deductions, and attendance adjustments.</p>
          </div>
        )}
        {step === 'done' && (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-900">Payroll Processed!</p>
            <p className="text-sm text-gray-500 mt-1">All payslips have been generated.</p>
            <button onClick={onClose} className="mt-4 px-5 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">Done</button>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

function DeleteConfirmModal({
 run, onClose }: { run: PayrollRun; onClose: () => void }) {
  const deleteRun = useDeletePayrollRun()
  const periodName = new Date(run.year, run.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  async function handleDelete() {
    await deleteRun.mutateAsync(run.id)
    onClose()
  }

  return (
    <div data-kiterp-modal className={dialogOverlayClass} onClick={onModalBackdropClick(onClose)}>
      <div className={cn(dialogPanelClass, 'max-w-sm relative')} onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Delete Payroll Run?</h2>
            <p className="text-sm text-gray-500">{periodName} — v{run.version}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          This will permanently delete all payslip entries for this run. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button
            onClick={handleDelete}
            disabled={deleteRun.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {deleteRun.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-red-600" />}
            Delete
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

export default function PayrollPage() {
  const now = new Date()
  const { data: runs = [], isLoading, isError, error, refetch } = useHRPayrollRuns(now.getFullYear())
  const [showWizard, setShowWizard] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PayrollRun | null>(null)

  const totalNet = (runs as PayrollRun[]).reduce((s, r) => s + Number(r.total_net), 0)

  const runHeaders = [
    { key: 'period', label: 'Period', align: 'left' as const },
    { key: 'version', label: 'Version', align: 'left' as const },
    { key: 'employees', label: 'Employees', align: 'right' as const },
    { key: 'gross', label: 'Total Gross', align: 'right' as const },
    { key: 'ded', label: 'Total Deductions', align: 'right' as const },
    { key: 'net', label: 'Net Payout', align: 'right' as const },
    { key: 'status', label: 'Status', align: 'left' as const },
    { key: 'actions', label: 'Actions', align: 'right' as const },
  ]

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Payroll</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            YTD Net Payout: <span className="font-medium text-foreground">{formatCurrency(totalNet)}</span>
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setShowWizard(true)}
        >
          <Play className="h-4 w-4" /> Process Payroll
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card text-foreground">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-600 space-y-3">
            <p>Could not load payroll runs.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-primary underline text-sm font-medium"
            >
              Retry
            </button>
          </div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center">
            <Receipt className="mx-auto mb-2 h-9 w-9 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No payroll runs yet. Process your first payroll above.</p>
          </div>
        ) : (
          <div className="vendor-scroll-x">
          <table className="w-full min-w-[720px] border-collapse">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {runHeaders.map(h => (
                  <th
                    key={h.key}
                    className={cn(
                      'px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap',
                      h.align === 'right' ? 'text-right' : 'text-left',
                      h.key === 'actions' && 'w-[1%]',
                    )}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(runs as PayrollRun[]).map(run => {
                const periodName = new Date(run.year, run.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                const cfg = STATUS_CONFIG[run.status] ?? { label: run.status, color: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={run.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-3 py-2 align-middle text-sm font-medium text-foreground whitespace-nowrap">{periodName}</td>
                    <td className="px-3 py-2 align-middle">
                      <span className="inline-block rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        v{run.version ?? 1}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-middle text-right text-sm tabular-nums text-muted-foreground">{run.employee_count}</td>
                    <td className="px-3 py-2 align-middle text-right text-sm tabular-nums text-green-700 dark:text-green-400">{formatCurrency(Number(run.total_gross))}</td>
                    <td className="px-3 py-2 align-middle text-right text-sm tabular-nums text-red-600 dark:text-red-400">{formatCurrency(Number(run.total_deductions))}</td>
                    <td className="px-3 py-2 align-middle text-right text-sm font-semibold tabular-nums text-primary">{formatCurrency(Number(run.total_net))}</td>
                    <td className="px-3 py-2 align-middle">
                      <span className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium', cfg.color)}>{cfg.label}</span>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1">
                        <Link
                          to={`/hr/payroll/${run.id}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-primary/10"
                        >
                          View <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(run)}
                          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                          title="Delete run"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {showWizard && <ProcessWizard onClose={() => setShowWizard(false)} />}
      {deleteTarget && <DeleteConfirmModal run={deleteTarget} onClose={() => setDeleteTarget(null)} />}
    </div>
  )
}
