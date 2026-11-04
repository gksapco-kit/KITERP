import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reApi } from '@/api/realestate'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '../shared'
import { Kpi, Loading, ProjectFilter } from './parts'

type Task = {
  id: string
  code: string
  name: string
  parent_id: string | null
  duration_days: number
  progress_percent: number
  status: string
  is_summary: boolean
  is_milestone: boolean
  start?: string
  end?: string
  float_days?: number
  critical?: boolean
  delayed?: boolean
}

type Schedule = {
  start: string
  finish: string | null
  duration_days: number
  progress_percent: number
  critical_path: string[]
  delayed_tasks: number
  tasks: Task[]
}

const DAY = 86_400_000
const day = (s: string) => Date.parse(s + 'T00:00:00Z')
const fmt = (s?: string) => (s ? new Date(s + 'T00:00:00Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : '—')

export default function Gantt() {
  const [project, setProject] = useState('')
  const q = useQuery({
    queryKey: ['re-schedule', project],
    queryFn: () => reApi.report<Schedule>(`/projects/${project}/schedule`),
    enabled: !!project,
  })

  const d = q.data
  const tasks = (d?.tasks ?? []).filter((t) => t.start && t.end)
  const t0 = d ? day(d.start) : 0
  const span = d && d.finish ? Math.max(day(d.finish) - t0 + DAY, DAY) : DAY
  const depth = (t: Task): number => {
    let n = 0
    let p = t.parent_id
    const byId = new Map((d?.tasks ?? []).map((x) => [x.id, x]))
    while (p && n < 8) {
      n += 1
      p = byId.get(p)?.parent_id ?? null
    }
    return n
  }

  return (
    <div className="space-y-4">
      <ProjectFilter value={project} onChange={setProject} />
      {!project && <EmptyState title="Choose a project" hint="The schedule is calculated from the WBS tasks, durations and dependencies." />}
      {project && q.isLoading && <Loading />}
      {project && q.isError && <EmptyState title="Could not build the schedule" hint="Check the task dependencies for a cycle." />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Planned finish" value={fmt(d.finish ?? undefined)} />
            <Kpi label="Duration" value={`${d.duration_days} days`} />
            <Kpi label="Overall progress" value={`${d.progress_percent}%`} tone="good" />
            <Kpi label="Delayed tasks" value={d.delayed_tasks} tone={d.delayed_tasks ? 'bad' : 'good'} />
          </div>
          {tasks.length === 0 ? (
            <EmptyState title="No tasks planned" hint="Add tasks under Project Management → WBS / Planning." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[260px_1fr] border-b border-border bg-muted/50 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <span>Task</span>
                  <span className="flex justify-between">
                    <span>{fmt(d.start)}</span>
                    <span>{fmt(d.finish ?? undefined)}</span>
                  </span>
                </div>
                {tasks.map((t) => {
                  const left = ((day(t.start!) - t0) / span) * 100
                  const width = Math.max(((day(t.end!) - day(t.start!) + DAY) / span) * 100, 0.8)
                  const color = t.is_summary ? 'bg-slate-500' : t.critical ? 'bg-red-500' : t.delayed ? 'bg-amber-500' : 'bg-sky-500'
                  return (
                    <div key={t.id} className="grid grid-cols-[260px_1fr] items-center border-b border-border/60 px-3 py-1.5 text-sm last:border-0">
                      <div className="flex items-center gap-2 truncate pr-2" style={{ paddingLeft: depth(t) * 14 }}>
                        <span className="font-mono text-xs text-muted-foreground">{t.code}</span>
                        <span className={`truncate ${t.is_summary ? 'font-semibold' : ''}`} title={t.name}>{t.name}</span>
                        {t.critical && <Badge variant="destructive">Critical</Badge>}
                      </div>
                      <div className="relative h-5 rounded bg-muted/40" title={`${fmt(t.start)} → ${fmt(t.end)} · ${t.progress_percent}% · float ${t.float_days ?? '—'}d`}>
                        <div className={`absolute top-0 h-5 overflow-hidden rounded ${color} opacity-40`} style={{ left: `${left}%`, width: `${width}%` }} />
                        <div className={`absolute top-0 h-5 rounded ${color}`} style={{ left: `${left}%`, width: `${(width * t.progress_percent) / 100}%` }} />
                        <span className="absolute top-0 flex h-5 items-center pl-1 text-[10px] font-medium text-foreground" style={{ left: `${left}%` }}>
                          {t.progress_percent > 0 ? `${t.progress_percent}%` : ''}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Bars show planned dates; the solid part is progress. Red = on the critical path (zero float), amber = past its planned finish.
          </p>
        </>
      )}
    </div>
  )
}
