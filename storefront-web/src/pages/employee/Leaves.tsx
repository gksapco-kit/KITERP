import { useState } from 'react'
import { Plus, Plane } from 'lucide-react'
import { useESSLeaves, useESSLeavePolicies, useESSSubmitLeave, useESSCancelLeave } from '@/hooks/useESS'

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function ESSLeavesPage() {
  const { data, isLoading } = useESSLeaves()
  const { data: policies = [] } = useESSLeavePolicies()
  const submit = useESSSubmitLeave()
  const cancel = useESSCancelLeave()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    leave_policy_id: '', from_date: '', to_date: '',
    days: 1, reason: '', is_half_day: false, half_day_type: '',
  })

  const balances: any[] = data?.balances ?? []
  const requests: any[] = data?.requests ?? []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submit.mutateAsync({ ...form, days: Number(form.days) })
    setShowForm(false)
    setForm({ leave_policy_id: '', from_date: '', to_date: '', days: 1, reason: '', is_half_day: false, half_day_type: '' })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Leaves</h1>
          <p className="text-sm text-gray-500 mt-1">View balances and manage your leave requests</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Apply Leave
        </button>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {balances.map((b: any) => (
          <div key={b.id} className="bg-white rounded-xl border shadow-sm p-4">
            <p className="text-xs font-medium text-gray-500">{b.leave_policy?.name ?? 'Leave'}</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{Number(b.available).toFixed(1)}</p>
            <p className="text-xs text-gray-400">of {Number(b.allocated).toFixed(0)} days</p>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${Math.min(100, (Number(b.used) / Number(b.allocated)) * 100)}%` }}
              />
            </div>
          </div>
        ))}
        {balances.length === 0 && !isLoading && (
          <p className="text-sm text-gray-400 col-span-4">No leave balances found. Contact HR.</p>
        )}
      </div>

      {/* Apply form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border shadow-sm p-5 mb-6 space-y-4">
          <h3 className="font-semibold text-gray-900">New Leave Request</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type *</label>
              <select
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.leave_policy_id}
                onChange={(e) => setForm((f) => ({ ...f, leave_policy_id: e.target.value }))}
              >
                <option value="">— Select —</option>
                {(policies as any[]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Days</label>
              <input
                type="number" min={0.5} step={0.5}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.days}
                onChange={(e) => setForm((f) => ({ ...f, days: parseFloat(e.target.value) || 0.5 }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From *</label>
              <input type="date" required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.from_date}
                onChange={(e) => setForm((f) => ({ ...f, from_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To *</label>
              <input type="date" required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.to_date}
                onChange={(e) => setForm((f) => ({ ...f, to_date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              rows={2}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox" className="rounded"
              checked={form.is_half_day}
              onChange={(e) => setForm((f) => ({ ...f, is_half_day: e.target.checked }))}
            />
            Half Day
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={submit.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700">
              {submit.isPending ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      )}

      {/* History */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-900">Leave History</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <Plane className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No leave requests yet.</p>
          </div>
        ) : (
          <div className="divide-y">
            {requests.map((req: any) => (
              <div key={req.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{req.leave_policy?.name ?? '—'}</p>
                  <p className="text-xs text-gray-500">
                    {req.from_date} → {req.to_date} · {Number(req.days).toFixed(1)} days
                  </p>
                  {req.reason && <p className="text-xs text-gray-400 mt-0.5">{req.reason}</p>}
                </div>
                <div className="flex items-center gap-3">
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
  )
}
