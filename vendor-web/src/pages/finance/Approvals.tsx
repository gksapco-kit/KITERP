import { useState } from 'react'
import { useApprovals, useApproveRequest, useRejectRequest, useApprovalPolicies } from '@/hooks/useFinance'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  auto_approved: 'bg-blue-100 text-blue-700',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
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
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 capitalize">{a.request_type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || ''}`}>{a.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Ref: {a.ref_id?.slice(0,8)}… · Amount: {fmt(a.amount || 0)} · {a.created_at?.slice(0,10)}
                    </p>
                    {a.reason && <p className="text-sm text-gray-600 mt-1">{a.reason}</p>}
                    {a.comments && <p className="text-xs text-gray-400 mt-1 italic">{a.comments}</p>}
                  </div>
                  {a.status === 'pending' && (
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <input placeholder="Add comment…" value={comments[a.id] || ''}
                        onChange={e => setComments(c => ({ ...c, [a.id]: e.target.value }))}
                        className="border border-gray-300 rounded px-2 py-1 text-xs" />
                      <div className="flex gap-2">
                        <button onClick={() => approveMut.mutate({ id: a.id, data: { comments: comments[a.id] || '' } })}
                          disabled={approveMut.isPending}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button onClick={() => rejectMut.mutate({ id: a.id, data: { comments: comments[a.id] || '' } })}
                          disabled={rejectMut.isPending}
                          className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50">
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    </div>
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
                  <p className="font-semibold text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-500 capitalize mt-1">{p.request_type} · Threshold: {fmt(p.amount_threshold || 0)}</p>
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
