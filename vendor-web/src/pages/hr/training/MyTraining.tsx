import { Link } from 'react-router-dom'
import { GraduationCap, Award, ExternalLink, Clock } from 'lucide-react'
import { useMyTraining } from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import type { TrainingEnrollment } from '@/types'

const STATUS: Record<string, { label: string; color: string }> = {
  enrolled:    { label: 'Enrolled',    color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700' },
  failed:      { label: 'Failed',      color: 'bg-red-100 text-red-700' },
  overdue:     { label: 'Overdue',     color: 'bg-red-100 text-red-700' },
}

interface MyTrainingItem extends TrainingEnrollment {
  program?: { name: string; description?: string; cover_image_url?: string; estimated_hours?: number }
  certificate_id?: string
}

export default function MyTrainingPage() {
  const { data: items = [], isLoading } = useMyTraining()
  const list = (items as MyTrainingItem[])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">My Training</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">Your enrolled programs and certificates</p>

      {isLoading ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400">Loading…</div>
      ) : list.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">You have no training enrollments yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map(e => {
            const stat = STATUS[e.status] ?? STATUS.enrolled
            return (
              <div key={e.id} className="bg-white border rounded-xl shadow-sm overflow-hidden">
                {e.program?.cover_image_url ? (
                  <img src={e.program.cover_image_url} alt={e.program.name} className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center">
                    <GraduationCap className="w-10 h-10 text-white opacity-80" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900">{e.program?.name ?? `Program ${e.program_id.slice(0, 6)}`}</h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${stat.color} shrink-0`}>{stat.label}</span>
                  </div>
                  {e.program?.description && <p className="text-xs text-gray-600 line-clamp-2 mb-2">{e.program.description}</p>}
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                    {e.program?.estimated_hours && <><Clock className="w-3 h-3" /> {e.program.estimated_hours}h</>}
                    {e.due_date && <span className="ml-auto">Due {e.due_date}</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2 flex-1 bg-gray-200 rounded">
                      <div className="h-2 bg-blue-500 rounded" style={{ width: `${e.progress_pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-600">{e.progress_pct}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Link to={`/hr/my-training/${e.id}`}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                      <ExternalLink className="w-3 h-3" /> {e.status === 'completed' ? 'Review' : 'Continue'}
                    </Link>
                    {e.certificate_id && (
                      <a href={vendorApi.hrCertificateUrl(e.certificate_id)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-green-600 hover:underline">
                        <Award className="w-3 h-3" /> Certificate
                      </a>
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
