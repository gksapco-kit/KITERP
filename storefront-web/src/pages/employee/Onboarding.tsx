import { CheckCircle2, Circle, Clock as ClockIcon, ListChecks } from 'lucide-react'
import { useESSOnboarding, useESSUpdateOnboardingTask } from '@/hooks/useESS'

const TASK_STATUS = {
  pending:     { color: 'text-gray-500',  icon: Circle,       label: 'Pending' },
  in_progress: { color: 'text-blue-500',  icon: ClockIcon,    label: 'In Progress' },
  done:        { color: 'text-green-600', icon: CheckCircle2, label: 'Done' },
  skipped:     { color: 'text-gray-400',  icon: Circle,       label: 'Skipped' },
} as const

export default function ESSOnboardingPage() {
  const { data, isLoading } = useESSOnboarding()
  const update = useESSUpdateOnboardingTask()

  if (isLoading) return <div className="p-6 text-gray-400">Loading…</div>

  const checklist = data as any

  if (!checklist || (!checklist.id && !checklist.tasks)) {
    return (
      <div className="p-6">
        <div className="bg-white border rounded-xl p-12 text-center">
          <ListChecks className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No active onboarding checklist.</p>
          <p className="text-xs text-gray-400 mt-1">Your manager will start one for you.</p>
        </div>
      </div>
    )
  }

  const tasks: any[] = checklist.tasks ?? []
  const done = tasks.filter((t: any) => t.status === 'done').length
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">My Onboarding</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">
        Started {checklist.started_at ? new Date(checklist.started_at).toLocaleDateString() : '—'}
        {checklist.target_completion_date && ` · Target ${checklist.target_completion_date}`}
      </p>

      {/* Progress */}
      <div className="bg-white border rounded-xl shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">{done}/{tasks.length} tasks complete</p>
          <p className="text-2xl font-bold text-blue-600">{pct}%</p>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-info transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Tasks */}
      <div className="bg-white border rounded-xl shadow-sm divide-y">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No tasks assigned yet.</div>
        ) : tasks.map((t: any) => {
          const cfg = TASK_STATUS[t.status as keyof typeof TASK_STATUS] ?? TASK_STATUS.pending
          const Icon = cfg.icon
          return (
            <div key={t.id} className="flex items-start gap-3 p-4">
              <Icon className={`w-5 h-5 ${cfg.color} mt-0.5 shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{t.title}</p>
                {t.description && (
                  <p className="text-xs text-gray-600 mt-0.5">{t.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {t.category && `${t.category} · `}{t.due_date && `Due ${t.due_date}`}
                </p>
              </div>
              <select
                value={t.status}
                onChange={(e) => update.mutate({ id: t.id, data: { status: e.target.value } })}
                className="text-xs border rounded px-2 py-1 shrink-0"
              >
                {Object.entries(TASK_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
