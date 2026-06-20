import { onModalBackdropClick } from '@/lib/utils'
import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle, CreditCard, ExternalLink, Download, Loader2, Trash2, AlertTriangle, Info, X } from 'lucide-react'
import { useHRPayrollRun, useFinalizePayroll, useMarkPayrollPaid, useDeletePayrollRun } from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import { useNavigate } from 'react-router-dom'
import type { PayrollEntry } from '@/types'

function DeleteConfirmModal({
 runId, label, onClose }: { runId: string; label: string; onClose: () => void }) {
  const deleteRun = useDeletePayrollRun()
  const navigate = useNavigate()

  async function handleDelete() {
    await deleteRun.mutateAsync(runId)
    onClose()
    navigate('/hr/payroll')
  }

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={onModalBackdropClick(onClose)}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-sm p-6 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Delete Payroll Run?</h2>
            <p className="text-sm text-gray-500">{label}</p>
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
  )
}

export default function PayrollDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: run, isLoading } = useHRPayrollRun(id ?? null)
  const finalize = useFinalizePayroll()
  const markPaid = useMarkPayrollPaid()
  const [showDelete, setShowDelete] = useState(false)
  const [downloading, setDownloading] = useState(false)

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!run) return <div className="p-8 text-center text-red-500">Payroll run not found.</div>

  const periodName = new Date(run.year, run.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const version = run.version ?? 1
  const label = `${periodName} — v${version}`
  const entries: PayrollEntry[] = run.entries ?? []

  async function handleDownload() {
    setDownloading(true)
    try {
      const filename = `payroll_${run.year}-${String(run.month).padStart(2, '0')}_v${version}.csv`
      await vendorApi.hrDownloadPayrollCsv(run.id, filename)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/hr/payroll" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Payroll — {periodName}</h1>
            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">v{version}</span>
          </div>
          <p className="text-sm text-gray-500">
            {run.employee_count} employees · Status: <span className="font-medium capitalize">{run.status}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {/* Download CSV */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download CSV
          </button>

          {run.status === 'processed' && (
            <button onClick={() => markPaid.mutate(run.id)} disabled={markPaid.isPending} className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              <CreditCard className="w-4 h-4" /> Mark Paid
            </button>
          )}
          {run.status === 'draft' && (
            <button onClick={() => finalize.mutate(run.id)} disabled={finalize.isPending} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              <CheckCircle className="w-4 h-4" /> Finalize
            </button>
          )}

          {/* Delete */}
          <button
            onClick={() => setShowDelete(true)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete this payroll run"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Warning if any entries have no salary structure */}
      {entries.some(e => e.status === 'pending') && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5 text-sm">
          <Info className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold text-orange-800">
              {entries.filter(e => e.status === 'pending').length} employee(s) have no salary structure configured.
            </span>
            <span className="text-orange-700 ml-1">
              Go to <Link to="/hr/salary" className="underline font-medium">HR → Salary</Link> to set up salary structures, then re-run payroll for this period.
            </span>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <p className="text-xs text-green-600">Total Gross</p>
          <p className="text-2xl font-bold text-green-900">₹{Number(run.total_gross).toLocaleString()}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-100">
          <p className="text-xs text-red-600">Total Deductions</p>
          <p className="text-2xl font-bold text-red-900">₹{Number(run.total_deductions).toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs text-blue-600">Net Payout</p>
          <p className="text-2xl font-bold text-blue-900">₹{Number(run.total_net).toLocaleString()}</p>
        </div>
      </div>

      {/* Entries */}
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Employee Payslips</h3>
          <span className="text-xs text-gray-400">{entries.length} entries</span>
        </div>
        {entries.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No payslip entries for this run.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Employee', 'Days Worked', 'Absent', 'Gross', 'Deductions', 'Net', 'Status', 'Payslip'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const emp = entry.employee as any
                const name = emp?.vendor_user?.user?.full_name ?? emp?.employee_code ?? '—'
                return (
                  <tr key={entry.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-sm text-gray-900">{name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{Number(entry.days_worked).toFixed(0)}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{Number(entry.days_absent).toFixed(0)}</td>
                    <td className="py-3 px-4 text-sm text-green-700">₹{Number(entry.gross_amount).toLocaleString()}</td>
                    <td className="py-3 px-4 text-sm text-red-600">₹{Number(entry.total_deductions).toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold text-sm text-blue-700">₹{Number(entry.net_amount).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        entry.status === 'paid' ? 'bg-green-100 text-green-700'
                        : entry.status === 'pending' ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                      }`}>
                        {entry.status === 'pending' ? 'No salary set' : entry.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <a
                        href={vendorApi.hrGetPayslipHtmlUrl(run.id, entry.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> View
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showDelete && (
        <DeleteConfirmModal
          runId={run.id}
          label={label}
          onClose={() => setShowDelete(false)}
        />
      )}
    </div>
  )
}
