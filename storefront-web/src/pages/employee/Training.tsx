import { GraduationCap, Award, Clock, ExternalLink } from 'lucide-react'
import { useESSTraining } from '@/hooks/useESS'
import { essApi } from '@/api/ess'

const STATUS: Record<string, { label: string; color: string }> = {
  enrolled:    { label: 'Enrolled',    color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700' },
  failed:      { label: 'Failed',      color: 'bg-red-100 text-red-700' },
  overdue:     { label: 'Overdue',     color: 'bg-red-100 text-red-700' },
}

export default function ESSTrainingPage() {
  const { data, isLoading } = useESSTraining()
  const items: any[] = (data?.enrollments ?? data) || []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">My Training</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">Your enrolled programs and learning progress</p>

      {isLoading ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No training enrollments yet.</p>
          <p className="text-xs text-gray-400 mt-1">Your manager will assign training programs to you.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((e: any) => {
            const stat = STATUS[e.status] ?? STATUS.enrolled
            return (
              <div key={e.id} className="bg-white border rounded-xl shadow-sm overflow-hidden">
                {e.program?.cover_image_url ? (
                  <img
                    src={e.program.cover_image_url}
                    alt={e.program?.name}
                    className="w-full h-32 object-cover"
                  />
                ) : (
                  <div className="w-full h-32 bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <GraduationCap className="w-10 h-10 text-white opacity-80" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {e.program?.name ?? `Program ${String(e.program_id ?? e.id).slice(0, 6)}`}
                    </h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${stat.color}`}>
                      {stat.label}
                    </span>
                  </div>
                  {e.program?.description && (
                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">{e.program.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    {e.program?.estimated_hours && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {e.program.estimated_hours}h
                      </span>
                    )}
                    {e.due_date && <span className="ml-auto">Due {e.due_date}</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2 flex-1 bg-gray-200 rounded">
                      <div
                        className="h-2 bg-blue-500 rounded"
                        style={{ width: `${e.progress_pct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">{e.progress_pct ?? 0}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 italic">
                      {e.status === 'completed' ? 'Completed' : 'In progress'}
                    </span>
                    {e.certificate_id && (
                      <button
                        type="button"
                        onClick={() => essApi.openCertificateInNewTab(e.certificate_id)}
                        className="flex items-center gap-1 text-sm text-green-600 hover:underline"
                      >
                        <Award className="w-3 h-3" /> Certificate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
