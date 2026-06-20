import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ClipboardList, ExternalLink } from 'lucide-react'
import { useHRCycle, useHRReviews, useHREmployees } from '@/hooks/useVendor'
import type { PerformanceReview, EmployeeProfile } from '@/types'

const REVIEW_STATUS: Record<string, { label: string; color: string }> = {
  draft:             { label: 'Draft',             color: 'bg-gray-100 text-gray-600' },
  self_pending:      { label: 'Self pending',      color: 'bg-amber-100 text-amber-700' },
  self_submitted:    { label: 'Self done',         color: 'bg-blue-100 text-blue-700' },
  manager_pending:   { label: 'Manager pending',   color: 'bg-amber-100 text-amber-700' },
  manager_submitted: { label: 'Manager done',      color: 'bg-indigo-100 text-indigo-700' },
  acknowledged:      { label: 'Acknowledged',      color: 'bg-green-100 text-green-700' },
  closed:            { label: 'Closed',            color: 'bg-gray-200 text-gray-700' },
}

export default function CycleDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: cycle, isLoading } = useHRCycle(id)
  const { data: reviews = [] } = useHRReviews({ cycle_id: id })
  const { data: empData } = useHREmployees({ limit: 200 })
  const employees: EmployeeProfile[] = empData?.items ?? []
  const empMap = new Map(employees.map(e => [e.id, e.vendor_user?.user?.full_name ?? e.employee_code]))

  if (isLoading || !cycle) return <div className="p-6 text-gray-400">Loading…</div>

  const total = (reviews as PerformanceReview[]).length
  const acked = (reviews as PerformanceReview[]).filter(r => r.status === 'acknowledged' || r.status === 'closed').length
  const completionPct = total ? Math.round((acked / total) * 100) : 0

  return (
    <div className="p-6">
      <Link to="/hr/performance" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back to performance
      </Link>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{cycle.name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {cycle.period_start} → {cycle.period_end} · {cycle.review_type} · Status: <strong>{cycle.status}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Reviews" value={total} />
        <StatCard label="Self Pending" value={(reviews as PerformanceReview[]).filter(r => r.status === 'self_pending').length} />
        <StatCard label="Manager Pending" value={(reviews as PerformanceReview[]).filter(r => r.status === 'manager_pending').length} />
        <StatCard label="Completed" value={`${completionPct}%`} />
      </div>

      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {total === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No reviews in this cycle. Launch the cycle to create reviews.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>
                {['Employee', 'Status', 'Self Rating', 'Overall', 'Submitted', 'Actions'].map(h =>
                  <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(reviews as PerformanceReview[]).map(r => {
                const cfg = REVIEW_STATUS[r.status] ?? REVIEW_STATUS.draft
                return (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium">{empMap.get(r.employee_id) ?? r.employee_id.slice(0, 8)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{r.self_rating ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{r.overall_rating ?? '—'}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {r.manager_submitted_at ? new Date(r.manager_submitted_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <Link to={`/hr/performance/reviews/${r.id}`}
                        className="p-1.5 inline-flex text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}
