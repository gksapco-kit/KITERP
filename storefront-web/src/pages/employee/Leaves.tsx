import { useState } from 'react'
import { Plane } from 'lucide-react'
import { useESSLeaves, useESSLeavePolicies, useESSSubmitLeave, useESSCancelLeave, useESSHolidays } from '@/hooks/useESS'

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function ESSLeavesPage() {
  const year = new Date().getFullYear()
  const { data, isLoading } = useESSLeaves()
  const { data: holidays = [] } = useESSHolidays(year)
  const { data: policies = [] } = useESSLeavePolicies()
  const submit = useESSSubmitLeave()
  const cancel = useESSCancelLeave()

  const [form, setForm] = useState({
    leave_policy_id: '', from_date: '', to_date: '',
    days: 1, reason: '', is_half_day: false, half_day_type: '',
  })

  const balances: any[] = data?.balances ?? []
  const requests: any[] = data?.requests ?? []

  function resetForm() {
    setForm({ leave_policy_id: '', from_date: '', to_date: '', days: 1, reason: '', is_half_day: false, half_day_type: '' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submit.mutateAsync({ ...form, days: Number(form.days) })
    resetForm()
  }

  return (
    <div className="p-4 h-full min-h-0 flex flex-col gap-3 overflow-hidden">
      <div className="flex items-end justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">My Leaves</h1>
          <p className="text-xs text-gray-500">View balances and manage your leave requests</p>
        </div>
        {balances.length === 0 && !isLoading && (
          <p className="text-xs text-gray-400">No leave balances found. Contact HR.</p>
        )}
      </div>

      {(holidays as Record<string, unknown>[]).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-medium text-gray-500 mr-1">Holidays ({year})</span>
          {(holidays as Record<string, unknown>[]).map((h) => (
            <span key={String(h.id)} className="text-[11px] bg-white border rounded-full px-2 py-0.5 text-gray-700">
              {String(h.name)} · {String(h.date)}
            </span>
          ))}
        </div>
      )}

      {balances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          {balances.map((b: any) => (
            <div key={b.id} className="bg-white rounded-lg border px-3 py-2">
              <p className="text-[11px] font-medium text-gray-500 truncate">{b.leave_policy?.name ?? 'Leave'}</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-lg font-bold text-blue-600 leading-tight">{Number(b.available).toFixed(1)}</p>
                <p className="text-[11px] text-gray-400">of {Number(b.allocated).toFixed(0)} days</p>
              </div>
              <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${Math.min(100, (Number(b.used) / Number(b.allocated || 1)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border shadow-sm p-4 flex flex-col gap-2.5 min-h-0 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-900">New Leave Request</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Leave Type *</label>
              <select
                required
                className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.leave_policy_id}
                onChange={(e) => setForm((f) => ({ ...f, leave_policy_id: e.target.value }))}
              >
                <option value="">— Select —</option>
                {(policies as any[]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Days</label>
              <input
                type="number" min={0.5} step={0.5}
                className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.days}
                onChange={(e) => setForm((f) => ({ ...f, days: parseFloat(e.target.value) || 0.5 }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">From *</label>
              <input type="date" required
                className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.from_date}
                onChange={(e) => setForm((f) => ({ ...f, from_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">To *</label>
              <input type="date" required
                className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.to_date}
                onChange={(e) => setForm((f) => ({ ...f, to_date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">Reason</label>
            <textarea
              className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              rows={2}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </div>
          <div className="flex items-center justify-between gap-3 mt-auto pt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox" className="rounded"
                checked={form.is_half_day}
                onChange={(e) => setForm((f) => ({ ...f, is_half_day: e.target.checked }))}
              />
              Half Day
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={resetForm}
                className="btn-cancel px-3 py-1.5 text-sm border rounded-md">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submit.isPending}
                className="btn-brand px-3 py-1.5 text-sm rounded-md"
                style={{ backgroundColor: '#64C3A0', color: '#fff' }}
              >
                {submit.isPending ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </form>

        <div className="bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b shrink-0">
            <h3 className="text-sm font-semibold text-gray-900">Leave History</h3>
          </div>
          {isLoading ? (
            <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
          ) : requests.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <Plane className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No leave requests yet.</p>
            </div>
          ) : (
            <div className="divide-y overflow-y-auto flex-1 min-h-0">
              {requests.map((req: any) => (
                <div key={req.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{req.leave_policy?.name ?? '—'}</p>
                    <p className="text-xs text-gray-500">
                      {req.from_date} → {req.to_date} · {Number(req.days).toFixed(1)} days
                    </p>
                    {req.reason && <p className="text-xs text-gray-400 mt-0.5 truncate">{req.reason}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {req.status}
                    </span>
                    {['pending', 'approved'].includes(req.status) && (
                      <button
                        onClick={() => cancel.mutate(req.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
