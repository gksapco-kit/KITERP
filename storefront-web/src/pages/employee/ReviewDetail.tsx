import { useState, useEffect } from 'react'
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
