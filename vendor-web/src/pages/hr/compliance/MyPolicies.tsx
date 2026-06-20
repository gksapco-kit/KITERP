import { Link } from 'react-router-dom'
import { ShieldCheck, FileSignature, ExternalLink } from 'lucide-react'
import { useMyPendingPolicies, useAcknowledgePolicy } from '@/hooks/useVendor'
import type { Policy } from '@/types'

export default function MyPoliciesPage() {
  const { data: pending = [], isLoading } = useMyPendingPolicies()
  const ack = useAcknowledgePolicy()

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">My Policies</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">Policies awaiting your acknowledgement</p>

      {isLoading ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400">Loading…</div>
      ) : (pending as Policy[]).length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <ShieldCheck className="w-10 h-10 text-green-300 mx-auto mb-3" />
          <p className="text-gray-500">All caught up! No pending policies.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(pending as Policy[]).map(p => (
            <div key={p.id} className="bg-card border border-border text-foreground rounded-xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900">{p.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">v{p.version} · {p.category ?? 'Policy'}
                    {p.effective_from && <> · Effective {p.effective_from}</>}</p>
                  {p.summary && <p className="text-sm text-gray-700 mt-2 line-clamp-2">{p.summary}</p>}
                </div>
                <Link to={`/hr/compliance/policies/${p.id}`}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline shrink-0">
                  <ExternalLink className="w-4 h-4" /> Read
                </Link>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={() => ack.mutate(p.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                  <FileSignature className="w-4 h-4" /> I acknowledge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
