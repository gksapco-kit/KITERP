import { onModalBackdropClick, cn } from '@/lib/utils'
import { dialogOverlayClass, dialogPanelClass } from '@/lib/modalUi'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Link } from 'react-router-dom'
import { Play, CheckCircle, CreditCard, Receipt, Loader2, Trash2, AlertTriangle, X } from 'lucide-react'
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
            {deleteRun.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
  const { data: runs = [], isLoading } = useHRPayrollRuns(now.getFullYear())
  const [showWizard, setShowWizard] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PayrollRun | null>(null)

  const totalNet = (runs as PayrollRun[]).reduce((s, r) => s + Number(r.total_net), 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500 mt-1">YTD Net Payout: ₹{totalNet.toLocaleString()}</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
        >
          <Play className="w-4 h-4" /> Process Payroll
        </button>
      </div>

      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No payroll runs yet. Process your first payroll above.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Period', 'Version', 'Employees', 'Total Gross', 'Total Deductions', 'Net Payout', 'Status', ''].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(runs as PayrollRun[]).map(run => {
                const periodName = new Date(run.year, run.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                const cfg = STATUS_CONFIG[run.status] ?? { label: run.status, color: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={run.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-sm text-gray-900">{periodName}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        v{run.version ?? 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{run.employee_count}</td>
                    <td className="py-3 px-4 text-sm text-green-700">₹{Number(run.total_gross).toLocaleString()}</td>
                    <td className="py-3 px-4 text-sm text-red-600">₹{Number(run.total_deductions).toLocaleString()}</td>
                    <td className="py-3 px-4 text-sm font-bold text-blue-700">₹{Number(run.total_net).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-3">
                        <Link to={`/hr/payroll/${run.id}`} className="text-sm text-blue-600 hover:underline font-medium">
                          View →
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(run)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Delete run"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showWizard && <ProcessWizard onClose={() => setShowWizard(false)} />}
      {deleteTarget && <DeleteConfirmModal run={deleteTarget} onClose={() => setDeleteTarget(null)} />}
    </div>
  )
}
