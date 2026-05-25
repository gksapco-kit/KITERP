import { onModalBackdropClick } from '@/lib/utils'
import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { CheckCircle, XCircle, Clock, Filter, X } from 'lucide-react'
import { useHRLeaveRequests, useApproveLeave, useRejectLeave, useHREmployees } from '@/hooks/useVendor'
import type { LeaveRequest } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function RejectModal({
 reqId, onClose }: { reqId: string; onClose: () => void }) {
  const reject = useRejectLeave()
  const [reason, setReason] = useState('')
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await reject.mutateAsync({ id: reqId, reason })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onModalBackdropClick(onClose)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold mb-3">Reject Leave Request</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} value={reason} onChange={e => setReason(e.target.value)} required />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={reject.isPending} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50">Reject</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LeaveRequestsPage() {
  const [statusFilter, setStatusFilter] = useState('pending')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const approve = useApproveLeave()

  const { data, isLoading } = useHRLeaveRequests({ status: statusFilter || undefined })
  const requests: LeaveRequest[] = data?.items ?? []

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
          <p className="text-sm text-gray-500 mt-1">Manage Employee Leave Approvals</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-3 mb-4 flex gap-2">
        {['', 'pending', 'approved', 'rejected', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No leave requests found.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Employee', 'Leave Type', 'Period', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map(req => {
                const emp = req.employee as any
                const name = emp?.vendor_user?.user?.full_name ?? emp?.employee_code ?? '—'
                return (
                  <tr key={req.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{req.leave_policy?.name ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {req.from_date} → {req.to_date}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{Number(req.days).toFixed(1)}</td>
                    <td className="py-3 px-4 text-sm text-gray-500 max-w-xs truncate">{req.reason ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {req.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approve.mutate(req.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            <CheckCircle className="w-3 h-3" /> Approve
                          </button>
                          <button
                            onClick={() => setRejectId(req.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
                          >
                            <XCircle className="w-3 h-3" /> Reject
                          </button>
                        </div>
                      )}
                      {req.status === 'rejected' && req.rejection_reason && (
                        <span className="text-xs text-red-500 italic">{req.rejection_reason}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {rejectId && <RejectModal reqId={rejectId} onClose={() => setRejectId(null)} />}
    </div>
  )
}
