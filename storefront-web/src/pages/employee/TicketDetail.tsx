import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { useESSTicket, useESSAddTicketComment } from '@/hooks/useESS'

const STATUS: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  waiting: { label: 'Waiting', color: 'bg-primary/12 text-primary' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', color: 'bg-gray-200 text-gray-700' },
}

export default function ESSTicketDetailPage() {
  const { ticketId = '' } = useParams<{ ticketId: string }>()
  const { storePath } = useVendor()
  const { data, isLoading } = useESSTicket(ticketId)
  const comment = useESSAddTicketComment()
  const [body, setBody] = useState('')

  if (isLoading || !data) return <p className="p-6 text-gray-400">Loading…</p>
  const t = data as Record<string, unknown>
  const stat = STATUS[String(t.status)] ?? STATUS.open
  const comments = (t.comments as Record<string, unknown>[]) ?? []

  const post = () => {
    if (!body.trim()) return
    comment.mutate({ id: String(t.id), body }, { onSuccess: () => setBody('') })
  }

  return (
    <section className="p-6 max-w-4xl mx-auto">
      <Link to={storePath('/hr/helpdesk')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back to help desk
      </Link>
      <header className="mb-3">
        <p className="text-xs font-mono text-gray-500">{String(t.ticket_number ?? '')}</p>
        <h1 className="text-2xl font-bold text-gray-900">{String(t.subject)}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {String(t.category ?? 'Other')} · Priority <strong>{String(t.priority)}</strong>
          <span className={`text-xs px-1.5 py-0.5 rounded ml-2 ${stat.color}`}>{stat.label}</span>
        </p>
      </header>
      {t.description ? (
        <article className="bg-white border rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-700 whitespace-pre-line">{String(t.description)}</p>
        </article>
      ) : null}
      <section className="bg-white border rounded-xl shadow-sm max-h-[90vh] overflow-y-auto">
        <h2 className="p-3 border-b text-sm font-semibold text-gray-700">Replies</h2>
        <ul className="divide-y">
          {comments.length === 0 ? (
            <li className="p-4 text-sm text-gray-400">No replies yet.</li>
          ) : (
            comments.map((c) => (
              <li key={String(c.id)} className="p-3">
                <p className="text-xs text-gray-500 mb-1">
                  {c.is_staff_reply ? 'HR / Support' : 'You'} · {new Date(String(c.created_at)).toLocaleString()}
                </p>
                <p className="text-sm text-gray-800 whitespace-pre-line">{String(c.body)}</p>
              </li>
            ))
          )}
        </ul>
        <footer className="p-3 border-t bg-gray-50">
          <textarea className="w-full border rounded px-3 py-2 text-sm" rows={3} value={body}
            placeholder="Add a reply…" onChange={(e) => setBody(e.target.value)} />
          <button type="button" onClick={post} disabled={!body.trim() || comment.isPending}
            className="mt-2 flex items-center gap-1 px-4 py-1.5 bg-primary text-white rounded-lg text-sm disabled:opacity-50">
            <Send className="w-4 h-4" /> Send
          </button>
        </footer>
      </section>
    </section>
  )
}
