import { useMemo, useState } from 'react'
import {
  Plus, Trash2, ArrowUp, ArrowDown, Settings2, Loader2, PlayCircle, CheckCircle2,
  CircleDashed, MinusCircle, Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import {
  useProductionOperations, useWorkCenters, useCreateProductionOperation,
  useUpdateProductionOperation, useDeleteProductionOperation, useReorderProductionOperations,
} from '@/hooks/useProductionOrders'
import type { ProductionOperationRecord, ProductionOperationStatus } from '@/api/vendor'
import { WorkCenterManagerModal } from './WorkCenterManagerModal'

const STATUS_CFG: Record<ProductionOperationStatus, { label: string; badge: string; icon: typeof CircleDashed }> = {
  pending:     { label: 'Pending',     badge: 'bg-muted text-muted-foreground',                         icon: CircleDashed },
  in_progress: { label: 'In Progress', badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',      icon: PlayCircle },
  completed:   { label: 'Completed',   badge: 'bg-green-500/15 text-green-800 dark:text-green-300',      icon: CheckCircle2 },
  skipped:     { label: 'Skipped',     badge: 'bg-red-500/10 text-red-700 dark:text-red-400',            icon: MinusCircle },
}

function fmtHours(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

interface ProductionRoutingPanelProps {
  orderId: string
}

export function ProductionRoutingPanel({ orderId }: ProductionRoutingPanelProps) {
  const { data: operations = [], isLoading } = useProductionOperations(orderId)
  const { data: workCenters = [] } = useWorkCenters({ is_active: true })
  const createOp = useCreateProductionOperation(orderId)
  const updateOp = useUpdateProductionOperation(orderId)
  const deleteOp = useDeleteProductionOperation(orderId)
  const reorderOps = useReorderProductionOperations(orderId)
  const [showWorkCenters, setShowWorkCenters] = useState(false)

  const sorted = useMemo(
    () => [...operations].sort((a, b) => a.sequence - b.sequence),
    [operations],
  )

  const wcById = useMemo(() => new Map(workCenters.map(w => [w.id, w])), [workCenters])

  const totals = useMemo(() => {
    let planned = 0, actual = 0, laborCost = 0
    for (const op of sorted) {
      planned += op.planned_hours || 0
      actual += op.actual_hours || 0
      const rate = op.work_center_id ? wcById.get(op.work_center_id)?.cost_per_hour ?? 0 : 0
      laborCost += (op.actual_hours ?? 0) * rate
    }
    return { planned, actual, laborCost }
  }, [sorted, wcById])

  const handleAdd = () => {
    createOp.mutate({ name: `Operation ${sorted.length + 1}`, status: 'pending', planned_hours: 0 })
  }

  const handleMove = (op: ProductionOperationRecord, dir: -1 | 1) => {
    const idx = sorted.findIndex(o => o.id === op.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const ids = sorted.map(o => o.id)
    ;[ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]]
    reorderOps.mutate(ids)
  }

  const patch = (op: ProductionOperationRecord, data: Record<string, unknown>) => {
    updateOp.mutate({ opId: op.id, data })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading routing…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Routing steps this order flows through. Actual hours × work center rate feed the labor cost roll-up.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowWorkCenters(true)}
            className="flex items-center gap-1.5 text-xs font-medium border border-border rounded-lg px-2.5 py-1.5 bg-card hover:bg-accent transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" /> Work Centers
          </button>
          <button
            onClick={handleAdd}
            disabled={createOp.isPending}
            className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg px-2.5 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {createOp.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add Operation
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground">
          <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No routing steps yet</p>
          <p className="text-xs mt-1">Add operations like Cutting → Assembly → QC → Packing</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr className="text-xs font-medium text-muted-foreground uppercase">
                <th className="py-2 px-2 w-14 text-center"><TableColumnLabel>Seq</TableColumnLabel></th>
                <th className="py-2 px-3 text-left"><TableColumnLabel>Operation</TableColumnLabel></th>
                <th className="py-2 px-3 text-left"><TableColumnLabel>Work Center</TableColumnLabel></th>
                <th className="py-2 px-3 text-center"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="py-2 px-3 text-right"><TableColumnLabel>Planned Hrs</TableColumnLabel></th>
                <th className="py-2 px-3 text-right"><TableColumnLabel>Actual Hrs</TableColumnLabel></th>
                <th className="py-2 px-2 w-16 text-center"><TableColumnLabel>—</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((op, idx) => {
                const cfg = STATUS_CFG[op.status] ?? STATUS_CFG.pending
                return (
                  <tr key={op.id} className="hover:bg-muted/30">
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => handleMove(op, -1)}
                          disabled={idx === 0 || reorderOps.isPending}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-mono text-muted-foreground w-5 text-center">{idx + 1}</span>
                        <button
                          onClick={() => handleMove(op, 1)}
                          disabled={idx === sorted.length - 1 || reorderOps.isPending}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        defaultValue={op.name}
                        onBlur={e => { if (e.target.value.trim() && e.target.value !== op.name) patch(op, { name: e.target.value.trim() }) }}
                        className="w-full bg-transparent font-medium text-sm rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={op.work_center_id || ''}
                        onChange={e => patch(op, { work_center_id: e.target.value || null })}
                        className="w-full bg-transparent text-sm rounded px-1 py-0.5 border border-transparent hover:border-border focus:outline-none focus:ring-1 focus:ring-primary/40"
                      >
                        <option value="">— Unassigned —</option>
                        {workCenters.map(wc => (
                          <option key={wc.id} value={wc.id}>{wc.code} · {wc.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex justify-center">
                        <select
                          value={op.status}
                          onChange={e => patch(op, { status: e.target.value })}
                          className={cn('text-xs font-medium rounded-full px-2 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer', cfg.badge)}
                        >
                          {(Object.keys(STATUS_CFG) as ProductionOperationStatus[]).map(s => (
                            <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        defaultValue={op.planned_hours}
                        onBlur={e => {
                          const v = parseFloat(e.target.value)
                          if (!Number.isNaN(v) && v !== op.planned_hours) patch(op, { planned_hours: v })
                        }}
                        className="w-20 bg-transparent text-right text-sm rounded px-1 py-0.5 border border-transparent hover:border-border focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        defaultValue={op.actual_hours ?? ''}
                        placeholder="—"
                        onBlur={e => {
                          const raw = e.target.value
                          const v = raw === '' ? null : parseFloat(raw)
                          if (v !== op.actual_hours) patch(op, { actual_hours: v })
                        }}
                        className="w-20 bg-transparent text-right text-sm rounded px-1 py-0.5 border border-transparent hover:border-border focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => deleteOp.mutate(op.id)}
                        disabled={deleteOp.isPending}
                        className="text-muted-foreground hover:text-red-600 transition-colors"
                        title="Remove operation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-muted/25 border-t border-border">
              <tr>
                <td colSpan={4} className="py-2 px-3 text-xs font-bold text-muted-foreground uppercase">
                  Total ({sorted.length} step{sorted.length !== 1 ? 's' : ''})
                </td>
                <td className="py-2 px-3 text-right font-bold text-sm">{fmtHours(totals.planned)}</td>
                <td className="py-2 px-3 text-right font-bold text-sm">{fmtHours(totals.actual)}</td>
                <td />
              </tr>
              {totals.laborCost > 0 && (
                <tr>
                  <td colSpan={7} className="py-1.5 px-3 text-xs text-muted-foreground text-right">
                    Estimated labor cost so far: <span className="font-semibold text-foreground">₹{totals.laborCost.toFixed(2)}</span>
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}

      {showWorkCenters && <WorkCenterManagerModal onClose={() => setShowWorkCenters(false)} />}
    </div>
  )
}
