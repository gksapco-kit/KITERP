import { useState } from 'react'
import { toast } from 'sonner'
import { useApprovals, useApproveRequest, useRejectRequest, useApprovalPolicies } from '@/hooks/useFinance'
import { CheckCircle, XCircle } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-500',
  auto_approved: 'bg-blue-100 text-blue-700',
}

const ENTITY_LABELS: Record<string, string> = {
  journal_entry: 'Journal entry',
  vendor_bill: 'Vendor bill',
  payment_run: 'Payment run',
  budget: 'Budget',
}

function fmt(n: number | string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0)
}

function errorText(e: any, fallback: string): string {
  const d = e?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x: any) => x?.msg || String(x)).join('; ')
  return e?.message || fallback
}

export default function Approvals() {
  const [tab, setTab] = useState<'approvals' | 'policies'>('approvals')
  const [filter, setFilter] = useState('')
  const [comments, setComments] = useState<Record<string, string>>({})

  const { data: approvalsData, isLoading } = useApprovals()
  const { data: policies = [] } = useApprovalPolicies()
  const approveMut = useApproveRequest()
  const rejectMut = useRejectRequest()

  const approvals = Array.isArray(approvalsData) ? approvalsData : (approvalsData?.items || [])
  const filtered = filter ? approvals.filter((a: any) => a.status === filter) : approvals

  const decide = (kind: 'approve' | 'reject', a: any) => {
    const mut = kind === 'approve' ? approveMut : rejectMut
    // The server decides which level this action satisfies; `step` is only a hint for single-level requests.
    mut.mutate({ id: a.id, data: { comments: comments[a.id] || '' } }, {
      onSuccess: () => {
        setComments(c => ({ ...c, [a.id]: '' }))
        toast.success(kind === 'approve'
          ? (a.levels_required > 1 && a.levels_approved + 1 < a.levels_required
            ? `Level ${a.levels_approved + 1} approved — waiting for the next approver`
            : 'Approved')
          : 'Rejected')
      },
      onError: (e: any) => toast.error(errorText(e, `Could not ${kind}`)),
    })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Approvals & Workflow</h1>
      </div>

      <div className="flex gap-2">
        {(['approvals', 'policies'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm border capitalize ${tab === t ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {t === 'approvals' ? 'Approval Requests' : 'Approval Policies'}
          </button>
        ))}
      </div>

      {tab === 'approvals' && (
        <>
          <div className="flex gap-2">
            {['', 'pending', 'approved', 'rejected'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${filter === s ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {isLoading ? <p className="text-sm text-gray-500">Loading…</p> :
             filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm bg-white rounded-xl border border-gray-200">No approval requests.</div>
            ) : filtered.map((a: any) => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-800">
                        {ENTITY_LABELS[a.entity_type] || a.entity_type}
                        {a.entity_label ? <span className="ml-1 font-mono text-sm text-gray-600">{a.entity_label}</span> : null}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || ''}`}>{a.status}</span>
                      {a.levels_required > 1 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          Level {a.status === 'pending' ? Math.min(a.levels_approved + 1, a.levels_required) : a.levels_approved} of {a.levels_required}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {a.entity_label ? '' : `Ref: ${String(a.entity_id || '').slice(0, 8)}… · `}
                      Amount: {fmt(a.amount || 0)} · {a.created_at?.slice(0, 10)}
                      {a.requested_by_name ? ` · raised by ${a.requested_by_name}` : ''}
                    </p>
                    {a.notes && <p className="text-sm text-gray-600 mt-1">{a.notes}</p>}
                    {(a.steps || []).length > 0 && (
                      <ol className="mt-2 space-y-0.5 text-xs text-gray-500">
                        {a.steps.map((s: any) => (
                          <li key={s.id}>
                            Level {s.step_number}: <span className="capitalize">{s.status}</span>
                            {s.approver_name ? ` by ${s.approver_name}` : ''}
                            {s.comments ? <span className="italic"> — “{s.comments}”</span> : null}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                  {a.status === 'pending' && (
                    a.can_act ? (
                      <div className="flex flex-col gap-2 min-w-[200px]">
                        <input placeholder="Add comment…" value={comments[a.id] || ''}
                          onChange={e => setComments(c => ({ ...c, [a.id]: e.target.value }))}
                          className="border border-gray-300 rounded px-2 py-1 text-xs" />
                        <div className="flex gap-2">
                          <button onClick={() => decide('approve', a)}
                            disabled={approveMut.isPending || rejectMut.isPending}
                            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                            <CheckCircle className="w-3 h-3" /> Approve
                          </button>
                          <button onClick={() => decide('reject', a)}
                            disabled={approveMut.isPending || rejectMut.isPending}
                            className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50">
                            <XCircle className="w-3 h-3" /> Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="max-w-[220px] text-xs italic text-gray-400">{a.cannot_act_reason}</p>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'policies' && (
        <div className="space-y-3">
          {(policies as any[]).length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm bg-white rounded-xl border border-gray-200">No approval policies defined.</div>
          ) : (policies as any[]).map((p: any) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{ENTITY_LABELS[p.entity_type] || p.entity_type}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {p.threshold_amount != null ? `Above ${fmt(p.threshold_amount)}` : 'Always requires approval'}
                    {' · '}{p.levels > 1 ? `${p.levels}-level approval` : 'Single approval'}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
