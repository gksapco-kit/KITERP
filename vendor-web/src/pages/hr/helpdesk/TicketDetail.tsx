import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Send, Lock } from 'lucide-react'
import { useHRTicket, useAddTicketComment, useUpdateTicket } from '@/hooks/useVendor'
import type { HelpdeskTicket, HelpdeskTicketComment } from '@/types'

const STATUS: Record<string, { label: string; color: string }> = {
  open:        { label: 'Open',        color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  waiting:     { label: 'Waiting',     color: 'bg-primary/12 text-primary' },
  resolved:    { label: 'Resolved',    color: 'bg-green-100 text-green-700' },
  closed:      { label: 'Closed',      color: 'bg-gray-200 text-gray-700' },
}

export default function TicketDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data, isLoading } = useHRTicket(id)
  const comment = useAddTicketComment()
  const update  = useUpdateTicket()
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)

  if (isLoading || !data) return <div className="p-6 text-gray-400">Loading…</div>
  const t = data as HelpdeskTicket
  const stat = STATUS[t.status] ?? STATUS.open
  const comments = (t.comments ?? []) as HelpdeskTicketComment[]

  const post = () => {
    if (!body.trim()) return
    comment.mutate({ id: t.id, body, is_internal: internal }, { onSuccess: () => setBody('') })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/hr/helpdesk" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back to helpdesk
      </Link>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-mono text-gray-500">{t.ticket_number}</p>
          <h1 className="text-2xl font-bold text-gray-900">{t.subject}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t.category ?? 'Other'} · Priority <strong>{t.priority}</strong> ·
            <span className={`text-[10px] px-1.5 py-0.5 rounded ml-2 ${stat.color}`}>{stat.label}</span>
          </p>
        </div>
        <select value={t.status} onChange={e => update.mutate({ id: t.id, data: { status: e.target.value } })}
          className="border rounded px-2 py-1 text-sm">
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {t.description && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-700 whitespace-pre-line">{t.description}</p>
        </div>
      )}

      <div className="bg-white border rounded-xl shadow-sm">
        <div className="p-3 border-b text-sm font-semibold text-gray-700">Replies</div>
        <ul className="divide-y">
          {comments.length === 0 ? (
            <li className="p-4 text-sm text-gray-400">No replies yet.</li>
          ) : (
            comments.map(c => (
              <li key={c.id} className={`p-3 ${c.is_internal ? 'bg-yellow-50' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-700">
                    {c.is_staff_reply ? 'Staff' : 'Employee'}
                  </span>
                  {c.is_internal && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-800 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Internal
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-line">{c.body}</p>
              </li>
            ))
          )}
        </ul>
        <div className="p-3 border-t bg-gray-50">
          <textarea className="w-full border rounded px-3 py-2 text-sm" rows={3} value={body}
            placeholder="Type your reply…" onChange={e => setBody(e.target.value)} />
          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} />
              Internal note (not visible to employee)
            </label>
            <button onClick={post} disabled={!body.trim() || comment.isPending}
              className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
