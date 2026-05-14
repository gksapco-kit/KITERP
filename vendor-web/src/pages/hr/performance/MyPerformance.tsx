import { Link } from 'react-router-dom'
import { Target, ClipboardList, MessageCircle } from 'lucide-react'
import { useMyPerformance } from '@/hooks/useVendor'
import type { PerformanceGoal, PerformanceReview, Feedback } from '@/types'

const REVIEW_STATUS: Record<string, { label: string; color: string }> = {
  draft:             { label: 'Draft',             color: 'bg-gray-100 text-gray-600' },
  self_pending:      { label: 'Self pending',      color: 'bg-amber-100 text-amber-700' },
  self_submitted:    { label: 'Self done',         color: 'bg-blue-100 text-blue-700' },
  manager_pending:   { label: 'Manager pending',   color: 'bg-amber-100 text-amber-700' },
  manager_submitted: { label: 'Awaiting your ack', color: 'bg-primary/10 text-primary' },
  acknowledged:      { label: 'Acknowledged',      color: 'bg-green-100 text-green-700' },
  closed:            { label: 'Closed',            color: 'bg-gray-200 text-gray-700' },
}

export default function MyPerformancePage() {
  const { data, isLoading } = useMyPerformance()
  if (isLoading) return <div className="p-6 text-gray-400">Loading…</div>

  const goals = (data?.goals ?? []) as PerformanceGoal[]
  const reviews = (data?.reviews ?? []) as PerformanceReview[]
  const feedback = (data?.feedback ?? []) as Feedback[]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Performance</h1>
        <p className="text-sm text-gray-500 mt-1">Goals, reviews, and feedback for you</p>
      </div>

      {/* Goals */}
      <section>
        <h2 className="text-sm font-bold uppercase text-gray-700 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" /> My Goals ({goals.length})
        </h2>
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          {goals.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No goals set yet.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                <tr>{['Title', 'Target Date', 'Progress', 'Status'].map(h =>
                  <th key={h} className="text-left py-2 px-4 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {goals.map(g => (
                  <tr key={g.id} className="border-b">
                    <td className="py-3 px-4 text-sm">
                      <p className="font-medium">{g.title}</p>
                      {g.description && <p className="text-[11px] text-gray-500">{g.description}</p>}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{g.target_date ?? '—'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${g.progress_pct ?? 0}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{g.progress_pct ?? 0}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{g.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Reviews */}
      <section>
        <h2 className="text-sm font-bold uppercase text-gray-700 mb-3 flex items-center gap-2">
          <ClipboardList className="w-4 h-4" /> My Reviews ({reviews.length})
        </h2>
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          {reviews.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No reviews assigned.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                <tr>{['Cycle', 'Status', 'Self Rating', 'Overall', 'Action'].map(h =>
                  <th key={h} className="text-left py-2 px-4 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {reviews.map(r => {
                  const cfg = REVIEW_STATUS[r.status] ?? REVIEW_STATUS.draft
                  return (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-mono text-gray-500">{r.cycle_id.slice(0, 8)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{r.self_rating ?? '—'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{r.overall_rating ?? '—'}</td>
                      <td className="py-3 px-4">
                        <Link to={`/hr/performance/reviews/${r.id}`}
                          className="text-xs text-blue-600 hover:underline font-medium">Open</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Feedback */}
      <section>
        <h2 className="text-sm font-bold uppercase text-gray-700 mb-3 flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> Feedback Received ({feedback.length})
        </h2>
        <div className="bg-white border rounded-xl shadow-sm divide-y">
          {feedback.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No feedback yet.</div>
          ) : feedback.map(f => (
            <div key={f.id} className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">
                  {f.title ?? <span className="capitalize">{f.feedback_type ?? 'Feedback'}</span>}
                </p>
                <p className="text-[11px] text-gray-400">{new Date(f.created_at).toLocaleDateString()}</p>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{f.body}</p>
              {f.related_competency && (
                <p className="text-[11px] text-gray-500 mt-1">Re: {f.related_competency}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
