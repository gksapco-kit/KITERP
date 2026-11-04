import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { reApi } from '@/api/realestate'
import type { ActionMeta, AvailabilityUnit, Row } from '@/api/realestate'
import { ActionDialog, ResultModal } from '../ResourceTable'
import { EmptyState, fieldClass, fmtCompact, fmtMoney, humanize, useREMeta } from '../shared'

const CELL: Record<string, string> = {
  available: 'bg-emerald-100 border-emerald-400 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200',
  hold: 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
  booked: 'bg-blue-100 border-blue-400 text-blue-900 dark:bg-blue-500/15 dark:text-blue-200',
  sold: 'bg-slate-200 border-slate-400 text-slate-800 dark:bg-slate-500/20 dark:text-slate-200',
  handed_over: 'bg-slate-300 border-slate-500 text-slate-900 dark:bg-slate-500/30 dark:text-slate-100',
  blocked: 'bg-red-100 border-red-400 text-red-900 dark:bg-red-500/15 dark:text-red-200',
}

export default function Availability() {
  const { data: meta } = useREMeta()
  const qc = useQueryClient()
  const [projectId, setProjectId] = useState('')
  const [sel, setSel] = useState<AvailabilityUnit | null>(null)
  const [action, setAction] = useState<ActionMeta | null>(null)
  const [result, setResult] = useState<unknown>(null)

  const projects = useQuery({ queryKey: ['re-ref', 'projects'], queryFn: () => reApi.list('projects', { size: 200 }) })
  useEffect(() => {
    if (!projectId && projects.data?.items.length) setProjectId(projects.data.items[0].id)
  }, [projects.data, projectId])

  const grid = useQuery({
    queryKey: ['re-availability', projectId],
    queryFn: () => reApi.availability(projectId),
    enabled: !!projectId,
  })
  const summary = useQuery({
    queryKey: ['re-inventory-summary', projectId],
    queryFn: () => reApi.inventorySummary(projectId),
    enabled: !!projectId,
  })

  const unitsRes = meta?.resources.units
  const perms = meta?.permissions ?? []
  const canAct = perms.includes('realestate.booking') || perms.includes('realestate.manage') || perms.includes('realestate.admin')
  const unitRow: Row | null = sel ? { id: sel.id, _label: sel.unit_number, status: sel.status } : null
  const unitActions = (unitsRes?.actions ?? []).filter(
    (a) => ['block', 'cost_sheet'].includes(a.key) && (!a.when || (sel && a.when.status?.includes(sel.status))),
  )

  const reload = () => {
    qc.invalidateQueries({ queryKey: ['re-availability', projectId] })
    qc.invalidateQueries({ queryKey: ['re-inventory-summary', projectId] })
    qc.invalidateQueries({ queryKey: ['re-list', 'units'] })
    setSel(null)
  }

  if (projects.isSuccess && !projects.data.items.length) {
    return <EmptyState title="No projects yet" hint="Create a project under Property Management → Project Master first." />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select className={`${fieldClass} w-64`} value={projectId} onChange={(e) => { setProjectId(e.target.value); setSel(null) }}>
          {(projects.data?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p._label}</option>)}
        </select>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(CELL).map(([s, cls]) => (
            <span key={s} className={`rounded border px-2 py-0.5 ${cls}`}>
              {humanize(s)} · {grid.data?.summary[s] ?? 0}
            </span>
          ))}
        </div>
      </div>

      {summary.data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Total units', summary.data.total_units],
            ['Sold', `${summary.data.sold_units} (${summary.data.sold_percent}%)`],
            ['Inventory value', fmtCompact(summary.data.inventory_value)],
            ['Unsold > 180 days', (summary.data.unsold_ageing_days['181-365'] ?? 0) + (summary.data.unsold_ageing_days['365+'] ?? 0)],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="mt-1 text-lg font-semibold">{v}</p>
            </div>
          ))}
        </div>
      )}

      {grid.isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !grid.data?.total ? (
        <EmptyState title="No units in this project" hint="Generate units from Towers → “Generate units”." />
      ) : (
        <div className="space-y-6">
          {grid.data.towers.map((t) => (
            <div key={t.id ?? 'none'} className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">{t.name}</h3>
              <div className="space-y-1.5 overflow-x-auto">
                {t.floors.map((f) => (
                  <div key={f.floor} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">F{f.floor}</span>
                    <div className="flex gap-1.5">
                      {f.units.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setSel(u)}
                          title={`${u.unit_number} · ${humanize(u.status)} · ${u.area} sq.ft · ${fmtMoney(u.price)}`}
                          className={`h-10 min-w-[3.5rem] rounded border px-2 text-xs font-medium transition hover:scale-105 ${CELL[u.status] ?? 'bg-muted'} ${sel?.id === u.id ? 'ring-2 ring-primary' : ''}`}
                        >
                          {u.unit_number}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {sel && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Unit {sel.unit_number}</h3>
              <p className="text-sm text-muted-foreground">
                {humanize(sel.category)} · {sel.bedrooms ? `${sel.bedrooms} BHK · ` : ''}{sel.area} sq.ft
                {sel.facing ? ` · ${humanize(sel.facing)} facing` : ''} · {fmtMoney(sel.price)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {unitActions.map((a) => (
                <Button
                  key={a.key}
                  size="sm"
                  variant={a.key === 'block' ? 'default' : 'outline'}
                  disabled={a.key === 'block' && !canAct}
                  onClick={() => setAction(a)}
                >
                  {a.label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setSel(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {action && unitsRes && unitRow && (
        <ActionDialog
          res={unitsRes}
          row={unitRow}
          action={action}
          onClose={() => setAction(null)}
          onDone={(out) => {
            setAction(null)
            if (action.method === 'GET') setResult(out)
            else { toast.success(out?.message || `${action.label} done`); reload() }
          }}
        />
      )}
      {result !== null && <ResultModal title="Cost sheet" data={result} onClose={() => setResult(null)} />}
    </div>
  )
}
