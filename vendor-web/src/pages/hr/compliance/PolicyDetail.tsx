import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileSignature } from 'lucide-react'
import { useHRPolicy, useAcknowledgePolicy } from '@/hooks/useVendor'
import type { Policy, PolicyAcknowledgement } from '@/types'

export default function PolicyDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data, isLoading } = useHRPolicy(id)
  const ack = useAcknowledgePolicy()

  if (isLoading || !data) return <div className="p-6 text-gray-400">Loading…</div>
  const p = data as Policy
  const acks = (p.acknowledgements ?? []) as PolicyAcknowledgement[]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/hr/compliance" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back to compliance
      </Link>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{p.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            v{p.version} · {p.category ?? 'Uncategorized'} · Status: <strong>{p.status}</strong>
            {p.effective_from && <> · Effective {p.effective_from}</>}
          </p>
        </div>
        {p.requires_acknowledgement && p.status === 'published' && (
          <button onClick={() => ack.mutate(p.id)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
            <FileSignature className="w-4 h-4" /> Acknowledge
          </button>
        )}
      </div>

      {p.summary && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded">
          <p className="text-sm text-gray-800">{p.summary}</p>
        </div>
      )}

      <div className="bg-white border rounded-xl shadow-sm p-6 mb-6 prose prose-sm max-w-none max-h-[90vh] overflow-y-auto">
        <div dangerouslySetInnerHTML={{ __html: p.body ?? '<p class="text-gray-400">No body content.</p>' }} />
      </div>

      {p.attachment_url && (
        <a href={p.attachment_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline mb-6">
          📎 View attachment
        </a>
      )}

      <section>
        <h2 className="text-sm font-bold uppercase text-gray-700 mb-3">
          Acknowledgements ({acks.length})
        </h2>
        <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
          {acks.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No acknowledgements yet.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                <tr>{['Employee', 'Version', 'Acknowledged', 'IP'].map(h =>
                  <th key={h} className="text-left py-2 px-4 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {acks.map(a => (
                  <tr key={a.id} className="border-b">
                    <td className="py-2 px-4 text-sm font-mono text-gray-500">{a.employee_id.slice(0, 8)}</td>
                    <td className="py-2 px-4 text-sm">v{a.policy_version}</td>
                    <td className="py-2 px-4 text-xs text-gray-500">{new Date(a.acknowledged_at).toLocaleString()}</td>
                    <td className="py-2 px-4 text-xs text-gray-500 font-mono">{a.ip_address ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
