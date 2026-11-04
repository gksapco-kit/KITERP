import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errMessage, reApi } from '@/api/realestate'
import { EmptyState, fieldClass, fmtCompact, fmtDate, humanize, useREMeta } from '../shared'

const STAGE_TONE: Record<string, string> = {
  new: 'border-t-slate-400',
  contacted: 'border-t-sky-400',
  qualified: 'border-t-indigo-400',
  site_visit: 'border-t-violet-400',
  negotiation: 'border-t-amber-400',
  booked: 'border-t-emerald-500',
  lost: 'border-t-red-400',
}

export default function Pipeline() {
  const { data: meta } = useREMeta()
  const qc = useQueryClient()
  const [projectId, setProjectId] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const projects = useQuery({ queryKey: ['re-ref', 'projects'], queryFn: () => reApi.list('projects', { size: 200 }) })
  const pipe = useQuery({
    queryKey: ['re-pipeline', projectId],
    queryFn: () => reApi.pipeline({ project_id: projectId }),
  })
  const canMove = ['realestate.sales', 'realestate.manage', 'realestate.admin'].some((p) => meta?.permissions.includes(p))

  const move = useMutation({
    mutationFn: ({ id, stage, reason }: { id: string; stage: string; reason?: string }) => reApi.moveLead(id, stage, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['re-pipeline'] })
      qc.invalidateQueries({ queryKey: ['re-list', 'leads'] })
    },
    onError: (e) => toast.error(errMessage(e)),
  })

  const drop = (stage: string) => {
    const id = dragId
    setDragId(null)
    setOver(null)
    if (!id || !canMove) return
    if (stage === 'booked') {
      toast.info('A lead moves to “Booked” automatically when its booking is confirmed.')
      return
    }
    let reason: string | undefined
    if (stage === 'lost') {
      reason = window.prompt('Reason for marking this lead as lost?')?.trim()
      if (!reason) return
    }
    move.mutate({ id, stage, reason })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select className={`${fieldClass} w-64`} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">All projects</option>
          {(projects.data?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p._label}</option>)}
        </select>
        {pipe.data && (
          <p className="text-sm text-muted-foreground">
            {pipe.data.total} leads · {pipe.data.conversion_percent}% converted to bookings
          </p>
        )}
        {!canMove && <p className="text-xs text-muted-foreground">Read-only: you need the Sales permission to move leads.</p>}
      </div>

      {pipe.isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !pipe.data?.total ? (
        <EmptyState title="No leads in the pipeline" hint="Add leads from Sales & CRM → Leads." />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {pipe.data.stages.map((s) => (
            <div
              key={s.stage}
              onDragOver={(e) => { e.preventDefault(); setOver(s.stage) }}
              onDragLeave={() => setOver((o) => (o === s.stage ? null : o))}
              onDrop={() => drop(s.stage)}
              className={`w-64 shrink-0 rounded-xl border border-t-4 border-border bg-muted/30 p-2 ${STAGE_TONE[s.stage] ?? ''} ${over === s.stage ? 'ring-2 ring-primary/50' : ''}`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-semibold">{humanize(s.stage)}</span>
                <span className="text-xs text-muted-foreground">{s.count} · {fmtCompact(s.budget_total)}</span>
              </div>
              <div className="space-y-2">
                {s.items.map((l) => (
                  <div
                    key={l.id}
                    draggable={canMove && l.id !== undefined && s.stage !== 'booked'}
                    onDragStart={() => setDragId(l.id)}
                    className="cursor-grab rounded-lg border border-border bg-card p-2.5 text-sm shadow-sm active:cursor-grabbing"
                  >
                    <div className="font-medium">{l.full_name}</div>
                    <div className="text-xs text-muted-foreground">{l.lead_no} {l.phone ? `· ${l.phone}` : ''}</div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span>{l.budget_max ? fmtCompact(l.budget_max) : 'No budget'}</span>
                      <span className="text-muted-foreground">{l.assigned_to_name ?? 'Unassigned'}</span>
                    </div>
                    {l.next_followup_at && (
                      <div className={`mt-1 text-[11px] ${new Date(l.next_followup_at) < new Date() ? 'text-red-600' : 'text-muted-foreground'}`}>
                        Follow-up {fmtDate(l.next_followup_at, true)}
                      </div>
                    )}
                  </div>
                ))}
                {s.count > s.items.length && (
                  <p className="px-1 text-center text-[11px] text-muted-foreground">+{s.count - s.items.length} more — see Leads tab</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
