import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileSignature } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { useESSPolicy, useESSAcknowledgePolicy } from '@/hooks/useESS'

export default function ESSPolicyDetailPage() {
  const { policyId = '' } = useParams<{ policyId: string }>()
  const { storePath } = useVendor()
  const { data, isLoading } = useESSPolicy(policyId)
  const ack = useESSAcknowledgePolicy()

  if (isLoading || !data) return <p className="p-6 text-gray-400">Loading…</p>
  const p = data as Record<string, unknown>

  return (
    <section className="p-6 max-w-4xl mx-auto">
      <Link to={storePath('/hr/policies')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back to policies
      </Link>
      <header className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{String(p.title)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            v{String(p.version)} · {String(p.category ?? 'Policy')}
            {p.effective_from ? <> · Effective {String(p.effective_from)}</> : null}
          </p>
        </div>
        {p.pending_acknowledgement ? (
          <button type="button" onClick={() => ack.mutate(String(p.id))} disabled={ack.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium shrink-0">
            <FileSignature className="w-4 h-4" /> I acknowledge
          </button>
        ) : null}
      </header>
      {p.summary ? (
        <aside className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded">
          <p className="text-sm text-gray-800">{String(p.summary)}</p>
        </aside>
      ) : null}
      <article className="bg-white border rounded-xl shadow-sm p-6 prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: String(p.body ?? '<p class="text-gray-400">No content.</p>') }} />
      {p.attachment_url ? (
        <p className="mt-4">
          <a href={String(p.attachment_url)} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
            View attachment
          </a>
        </p>
      ) : null}
    </section>
  )
}
