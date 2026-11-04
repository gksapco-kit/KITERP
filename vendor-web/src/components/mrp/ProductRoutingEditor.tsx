import { useEffect, useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useHasPermission } from '@/hooks/usePermissions'
import { useProductRouting, useSaveProductRouting, useWorkCenters } from '@/hooks/useProductionOrders'

interface StepRow {
  name: string
  work_center_id: string
  setup_hours: number
  hours_per_unit: number
}

/** Standard routing of a finished product: copied onto production orders when they are confirmed. */
export function ProductRoutingEditor({ productId }: { productId: string }) {
  const canEdit = useHasPermission('production.manage')
  const { data, isLoading } = useProductRouting(productId)
  const { data: workCenters = [] } = useWorkCenters({ is_active: true })
  const save = useSaveProductRouting(productId)
  const [rows, setRows] = useState<StepRow[]>([])
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (data) {
      setRows(data.items.map((s) => ({
        name: s.name, work_center_id: s.work_center_id ?? '', setup_hours: s.setup_hours, hours_per_unit: s.hours_per_unit,
      })))
      setDirty(false)
    }
  }, [data])

  const patch = (idx: number, p: Partial<StepRow>) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...p } : row)))
    setDirty(true)
  }
  const invalid = rows.some((r) => !r.name.trim())

  if (isLoading) return null
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-700">Standard routing</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Copied onto a production order when it is confirmed (unless the order already has operations).
            Planned hours = setup hours + hours per unit × ordered quantity.
          </p>
        </div>
        {dirty && canEdit && (
          <Button
            size="sm" disabled={save.isPending || invalid} className="gap-1.5 shrink-0"
            onClick={() => save.mutate(rows.map((r) => ({
              name: r.name.trim(), work_center_id: r.work_center_id || null,
              setup_hours: r.setup_hours || 0, hours_per_unit: r.hours_per_unit || 0,
            })))}
          >
            {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save routing
          </Button>
        )}
      </div>
      <fieldset disabled={!canEdit} className="m-0 min-w-0 space-y-2 border-0 p-0">
        {rows.map((r, idx) => (
          <div key={idx} className="grid grid-cols-[2rem_1fr_11rem_6rem_6rem_2rem] items-center gap-2">
            <span className="text-xs text-gray-400 text-center">{(idx + 1) * 10}</span>
            <Input value={r.name} placeholder="Step name (e.g. Cutting)" onChange={(e) => patch(idx, { name: e.target.value })} className="h-8 text-sm" />
            <select
              value={r.work_center_id} onChange={(e) => patch(idx, { work_center_id: e.target.value })}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">No work center</option>
              {workCenters.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <Input
              type="number" min={0} step={0.25} value={r.setup_hours} title="Setup hours (once per order)"
              onChange={(e) => patch(idx, { setup_hours: parseFloat(e.target.value) || 0 })} className="h-8 text-sm"
            />
            <Input
              type="number" min={0} step={0.05} value={r.hours_per_unit} title="Hours per finished unit"
              onChange={(e) => patch(idx, { hours_per_unit: parseFloat(e.target.value) || 0 })} className="h-8 text-sm"
            />
            <button type="button" onClick={() => { setRows((x) => x.filter((_, i) => i !== idx)); setDirty(true) }}>
              <Trash2 className="h-4 w-4 text-red-600" />
            </button>
          </div>
        ))}
        {rows.length > 0 && (
          <p className="text-[11px] text-gray-400 pl-10">Columns: step · work center · setup hours · hours per unit</p>
        )}
        {canEdit && (
          <Button
            size="sm" variant="ghost" className="gap-1.5 text-indigo-600"
            onClick={() => { setRows((r) => [...r, { name: '', work_center_id: '', setup_hours: 0, hours_per_unit: 0 }]); setDirty(true) }}
          >
            <Plus className="h-3.5 w-3.5" /> Add step
          </Button>
        )}
        {rows.length === 0 && !canEdit && <p className="text-xs text-gray-400">No standard routing defined.</p>}
      </fieldset>
    </div>
  )
}
