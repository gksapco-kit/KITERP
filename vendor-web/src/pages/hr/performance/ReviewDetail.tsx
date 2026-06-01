import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileSignature, Save, Check } from 'lucide-react'
import {
  useHRReview, useSubmitSelfReview, useSubmitManagerReview, useAcknowledgeReview, useHRCycle,
} from '@/hooks/useVendor'
import type { ReviewKPIScore } from '@/types'

export default function ReviewDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: review, isLoading } = useHRReview(id)
  const { data: cycle } = useHRCycle((review as any)?.cycle_id ?? null)
  const submitSelf = useSubmitSelfReview()
  const submitMgr = useSubmitManagerReview()
  const ack = useAcknowledgeReview()

  const [self, setSelf] = useState({ self_assessment: '', self_rating: 0 })
  const [mgr, setMgr] = useState({
    manager_comments: '', overall_rating: 0, strengths: '', improvement_areas: '',
    promotion_recommended: false, salary_change_suggestion_pct: '',
  })
  const [kpiScores, setKpiScores] = useState<ReviewKPIScore[]>([])
  const [ackNote, setAckNote] = useState('')

  useEffect(() => {
    if (!review) return
    const r = review as any
    setSelf({ self_assessment: r.self_assessment ?? '', self_rating: r.self_rating ?? 0 })
    setMgr({
      manager_comments: r.manager_comments ?? '',
      overall_rating: r.overall_rating ?? 0,
      strengths: r.strengths ?? '',
      improvement_areas: r.improvement_areas ?? '',
      promotion_recommended: !!r.promotion_recommended,
      salary_change_suggestion_pct: r.salary_change_suggestion_pct ?? '',
    })
    setKpiScores(r.kpi_scores ?? [])
  }, [review])

  if (isLoading || !review) return <div className="p-6 text-gray-400">Loading…</div>
  const r = review as any

  const isSelfStage = r.status === 'self_pending' || r.status === 'draft'
  const isMgrStage = r.status === 'self_submitted' || r.status === 'manager_pending'
  const isAckStage = r.status === 'manager_submitted'

  const kpiTemplate: { key: string; label: string; weight: number }[] = cycle?.kpi_template ?? []

  function setKpi(key: string, field: 'self_score' | 'manager_score' | 'comments', val: any) {
    setKpiScores(prev => {
      const idx = prev.findIndex(k => k.kpi_key === key)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], [field]: val }
        return next
      }
      const tpl = kpiTemplate.find(t => t.key === key)
      return [...prev, { id: '', review_id: id, kpi_key: key, label: tpl?.label, weight: tpl?.weight, [field]: val }]
    })
  }
  function getKpi(key: string): ReviewKPIScore | undefined {
    return kpiScores.find(k => k.kpi_key === key)
  }

  async function handleSelfSubmit() {
    await submitSelf.mutateAsync({
      id,
      data: {
        self_assessment: self.self_assessment,
        self_rating: Number(self.self_rating) || 0,
        kpi_scores: kpiScores.map(k => ({
          kpi_key: k.kpi_key, label: k.label, weight: k.weight,
          self_score: k.self_score, comments: k.comments,
        })),
      },
    })
  }
  async function handleMgrSubmit() {
    await submitMgr.mutateAsync({
      id,
      data: {
        manager_comments: mgr.manager_comments,
        overall_rating: Number(mgr.overall_rating) || 0,
        strengths: mgr.strengths,
        improvement_areas: mgr.improvement_areas,
        promotion_recommended: mgr.promotion_recommended,
        salary_change_suggestion_pct: mgr.salary_change_suggestion_pct ? Number(mgr.salary_change_suggestion_pct) : null,
        kpi_scores: kpiScores.map(k => ({
          kpi_key: k.kpi_key, label: k.label, weight: k.weight,
          manager_score: k.manager_score, comments: k.comments,
        })),
      },
    })
  }
  async function handleAck() {
    await ack.mutateAsync({ id, note: ackNote || undefined })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/hr/performance" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back to performance
      </Link>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Review</h1>
          <p className="text-sm text-gray-500 mt-1">
            {cycle?.name && <span>{cycle.name} · </span>}Status: <strong>{r.status}</strong>
          </p>
        </div>
      </div>

      {/* KPI Scoring */}
      {kpiTemplate.length > 0 && (
        <section className="bg-white border rounded-xl shadow-sm p-5 mb-4 max-h-[90vh] overflow-y-auto">
          <h2 className="text-sm font-bold uppercase text-gray-700 mb-3">KPI Scoring (out of {cycle?.rating_scale_max ?? 5})</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-xs uppercase text-gray-500 bg-gray-50">
                <tr>
                  <th className="text-left py-2 px-3">KPI</th>
                  <th className="text-left py-2 px-3">Weight</th>
                  <th className="text-left py-2 px-3">Self</th>
                  <th className="text-left py-2 px-3">Manager</th>
                  <th className="text-left py-2 px-3">Comments</th>
                </tr>
              </thead>
              <tbody>
                {kpiTemplate.map(k => {
                  const score = getKpi(k.key)
                  return (
                    <tr key={k.key} className="border-b">
                      <td className="py-2 px-3 text-sm font-medium">{k.label}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">{k.weight}%</td>
                      <td className="py-2 px-3">
                        <input type="number" min={0} max={cycle?.rating_scale_max ?? 5}
                          disabled={!isSelfStage}
                          value={score?.self_score ?? ''}
                          onChange={e => setKpi(k.key, 'self_score', Number(e.target.value))}
                          className="w-16 px-2 py-1 text-sm border rounded disabled:bg-gray-50" />
                      </td>
                      <td className="py-2 px-3">
                        <input type="number" min={0} max={cycle?.rating_scale_max ?? 5}
                          disabled={!isMgrStage}
                          value={score?.manager_score ?? ''}
                          onChange={e => setKpi(k.key, 'manager_score', Number(e.target.value))}
                          className="w-16 px-2 py-1 text-sm border rounded disabled:bg-gray-50" />
                      </td>
                      <td className="py-2 px-3">
                        <input value={score?.comments ?? ''}
                          disabled={!isSelfStage && !isMgrStage}
                          onChange={e => setKpi(k.key, 'comments', e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded disabled:bg-gray-50" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Self Assessment */}
      <section className="bg-white border rounded-xl shadow-sm p-5 mb-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-sm font-bold uppercase text-gray-700 mb-3">Self Assessment</h2>
        <div className="space-y-3">
          <textarea rows={5} value={self.self_assessment}
            disabled={!isSelfStage}
            onChange={e => setSelf({ ...self, self_assessment: e.target.value })}
            placeholder="Reflect on your achievements, challenges, and learning during this period…"
            className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50" />
          <div className="flex items-center gap-3">
            <label className="text-xs uppercase text-gray-600">Self rating ({cycle?.rating_scale_max ?? 5}-pt)</label>
            <input type="number" min={0} max={cycle?.rating_scale_max ?? 5}
              disabled={!isSelfStage}
              value={self.self_rating}
              onChange={e => setSelf({ ...self, self_rating: Number(e.target.value) })}
              className="w-20 px-2 py-1 text-sm border rounded disabled:bg-gray-50" />
            {isSelfStage && (
              <button onClick={handleSelfSubmit} disabled={submitSelf.isPending}
                className="ml-auto flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                <Save className="w-4 h-4" /> Submit Self Review
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Manager Review */}
      {(isMgrStage || r.manager_comments || r.overall_rating) && (
        <section className="bg-white border rounded-xl shadow-sm p-5 mb-4 max-h-[90vh] overflow-y-auto">
          <h2 className="text-sm font-bold uppercase text-gray-700 mb-3">Manager Review</h2>
          <div className="space-y-3">
            <textarea rows={4} value={mgr.manager_comments}
              disabled={!isMgrStage}
              onChange={e => setMgr({ ...mgr, manager_comments: e.target.value })}
              placeholder="Manager comments…"
              className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase text-gray-600">Strengths</label>
                <textarea rows={3} value={mgr.strengths}
                  disabled={!isMgrStage}
                  onChange={e => setMgr({ ...mgr, strengths: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50" />
              </div>
              <div>
                <label className="text-xs uppercase text-gray-600">Improvement Areas</label>
                <textarea rows={3} value={mgr.improvement_areas}
                  disabled={!isMgrStage}
                  onChange={e => setMgr({ ...mgr, improvement_areas: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 items-center">
              <div>
                <label className="text-xs uppercase text-gray-600">Overall Rating</label>
                <input type="number" min={0} max={cycle?.rating_scale_max ?? 5}
                  disabled={!isMgrStage}
                  value={mgr.overall_rating}
                  onChange={e => setMgr({ ...mgr, overall_rating: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50" />
              </div>
              <div>
                <label className="text-xs uppercase text-gray-600">Salary Change %</label>
                <input type="number" step="0.1"
                  disabled={!isMgrStage}
                  value={mgr.salary_change_suggestion_pct}
                  onChange={e => setMgr({ ...mgr, salary_change_suggestion_pct: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50" />
              </div>
              <label className="flex items-center gap-2 text-sm pt-5">
                <input type="checkbox" checked={mgr.promotion_recommended}
                  disabled={!isMgrStage}
                  onChange={e => setMgr({ ...mgr, promotion_recommended: e.target.checked })} />
                Recommend promotion
              </label>
            </div>
            {isMgrStage && (
              <div className="flex justify-end pt-2">
                <button onClick={handleMgrSubmit} disabled={submitMgr.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                  <Save className="w-4 h-4" /> Submit Manager Review
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Acknowledgement */}
      {(isAckStage || r.acknowledged_at) && (
        <section className="bg-white border rounded-xl shadow-sm p-5 mb-4 max-h-[90vh] overflow-y-auto">
          <h2 className="text-sm font-bold uppercase text-gray-700 mb-3">Employee Acknowledgement</h2>
          {r.acknowledged_at ? (
            <p className="text-sm text-green-700 flex items-center gap-2">
              <Check className="w-4 h-4" /> Acknowledged on {new Date(r.acknowledged_at).toLocaleDateString()}
              {r.employee_acknowledgement && <span className="text-gray-600">— {r.employee_acknowledgement}</span>}
            </p>
          ) : (
            <div className="space-y-3">
              <textarea rows={3} value={ackNote} onChange={e => setAckNote(e.target.value)}
                placeholder="Your comments (optional)"
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <button onClick={handleAck} disabled={ack.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                <FileSignature className="w-4 h-4" /> Acknowledge Review
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
