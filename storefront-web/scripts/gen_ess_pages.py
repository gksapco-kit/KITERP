from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src" / "pages" / "employee"

TICKET = r'''import { useState } from 'react'
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
          <span className={`text-[10px] px-1.5 py-0.5 rounded ml-2 ${stat.color}`}>{stat.label}</span>
        </p>
      </header>
      {t.description ? (
        <article className="bg-white border rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-700 whitespace-pre-line">{String(t.description)}</p>
        </article>
      ) : null}
      <section className="bg-white border rounded-xl shadow-sm">
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
'''

POLICY = r'''import { useParams, Link } from 'react-router-dom'
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
'''

REVIEW = r'''import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Save, Check } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { useESSReview, useESSSubmitSelfReview, useESSAcknowledgeReview } from '@/hooks/useESS'

export default function ESSReviewDetailPage() {
  const { reviewId = '' } = useParams<{ reviewId: string }>()
  const { storePath } = useVendor()
  const { data: review, isLoading } = useESSReview(reviewId)
  const submitSelf = useESSSubmitSelfReview()
  const ack = useESSAcknowledgeReview()

  const [self, setSelf] = useState({ self_assessment: '', self_rating: 0 })
  const [kpiScores, setKpiScores] = useState<Record<string, unknown>[]>([])
  const [ackNote, setAckNote] = useState('')

  useEffect(() => {
    if (!review) return
    const r = review as Record<string, unknown>
    setSelf({ self_assessment: String(r.self_assessment ?? ''), self_rating: Number(r.self_rating ?? 0) })
    setKpiScores((r.kpi_scores as Record<string, unknown>[]) ?? [])
  }, [review])

  if (isLoading || !review) return <p className="p-6 text-gray-400">Loading…</p>
  const r = review as Record<string, unknown>
  const cycle = r.cycle as Record<string, unknown> | undefined
  const status = String(r.status)
  const isSelfStage = status === 'self_pending' || status === 'draft'
  const isAckStage = status === 'manager_submitted'
  const kpiTemplate = (cycle?.kpi_template as { key: string; label: string; weight: number }[]) ?? []

  function getKpi(key: string) {
    return kpiScores.find((k) => k.kpi_key === key)
  }
  function setKpi(key: string, field: string, val: unknown) {
    setKpiScores((prev) => {
      const idx = prev.findIndex((k) => k.kpi_key === key)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], [field]: val }
        return next
      }
      const tpl = kpiTemplate.find((t) => t.key === key)
      return [...prev, { kpi_key: key, label: tpl?.label, weight: tpl?.weight, [field]: val }]
    })
  }

  async function handleSelfSubmit() {
    await submitSelf.mutateAsync({
      id: reviewId,
      data: {
        self_assessment: self.self_assessment,
        self_rating: Number(self.self_rating) || 0,
        kpi_self_scores: kpiScores.map((k) => ({
          kpi_key: k.kpi_key,
          label: k.label,
          weight: k.weight,
          self_score: k.self_score,
          comments: k.comments,
        })),
      },
    })
  }

  return (
    <section className="p-6 max-w-4xl mx-auto space-y-6">
      <Link to={storePath('/hr/performance')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to performance
      </Link>
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Performance review</h1>
        <p className="text-sm text-gray-500">Status: <strong>{status}</strong></p>
      </header>

      {isSelfStage && (
        <section className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Self assessment</h2>
          <label className="block text-sm">
            <span className="text-gray-600">Your comments</span>
            <textarea className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" rows={4}
              value={self.self_assessment} onChange={(e) => setSelf({ ...self, self_assessment: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Self rating (1–5)</span>
            <input type="number" min={1} max={5} className="w-24 border rounded-lg px-3 py-2 mt-1"
              value={self.self_rating} onChange={(e) => setSelf({ ...self, self_rating: Number(e.target.value) })} />
          </label>
          {kpiTemplate.map((tpl) => (
            <label key={tpl.key} className="block text-sm border rounded-lg p-3">
              <span className="font-medium">{tpl.label}</span>
              <input type="number" min={0} max={5} className="w-24 border rounded px-2 py-1 mt-1 block"
                value={Number(getKpi(tpl.key)?.self_score ?? '')}
                onChange={(e) => setKpi(tpl.key, 'self_score', Number(e.target.value))} />
            </label>
          ))}
          <button type="button" onClick={handleSelfSubmit} disabled={submitSelf.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm">
            <Save className="w-4 h-4" /> Submit self-review
          </button>
        </section>
      )}

      {isAckStage && (
        <section className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Acknowledge manager review</h2>
          {r.manager_comments ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{String(r.manager_comments)}</p> : null}
          <label className="block text-sm">
            <span className="text-gray-600">Optional note</span>
            <textarea className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" rows={2}
              value={ackNote} onChange={(e) => setAckNote(e.target.value)} />
          </label>
          <button type="button" onClick={() => ack.mutate({ id: reviewId, note: ackNote || undefined })}
            disabled={ack.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm">
            <Check className="w-4 h-4" /> Acknowledge
          </button>
        </section>
      )}

      {!isSelfStage && !isAckStage && (
        <p className="text-sm text-gray-500">This review is not awaiting your action right now.</p>
      )}
    </section>
  )
}
'''

for name, content in [('TicketDetail.tsx', TICKET), ('PolicyDetail.tsx', POLICY), ('ReviewDetail.tsx', REVIEW)]:
    (ROOT / name).write_text(content, encoding='utf-8')
    print('wrote', name)
