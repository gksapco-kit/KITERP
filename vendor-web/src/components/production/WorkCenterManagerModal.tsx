import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Trash2, Loader2, Factory, Pencil, Check } from 'lucide-react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import {
  useWorkCenters, useCreateWorkCenter, useUpdateWorkCenter, useDeleteWorkCenter,
} from '@/hooks/useProductionOrders'
import type { WorkCenterRecord } from '@/api/vendor'

interface WorkCenterManagerModalProps {
  onClose: () => void
}

const emptyDraft = { name: '', code: '', cost_per_hour: 0, capacity_per_day: '' as number | '' }

export function WorkCenterManagerModal({ onClose }: WorkCenterManagerModalProps) {
  useEscapeToClose(onClose)
  const { data: workCenters = [], isLoading } = useWorkCenters()
  const createWc = useCreateWorkCenter()
  const updateWc = useUpdateWorkCenter()
  const deleteWc = useDeleteWorkCenter()

  const [draft, setDraft] = useState(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleCreate = () => {
    if (!draft.name.trim()) return
    createWc.mutate(
      {
        name: draft.name.trim(),
        code: draft.code.trim() || undefined,
        cost_per_hour: Number(draft.cost_per_hour) || 0,
        capacity_per_day: draft.capacity_per_day === '' ? undefined : Number(draft.capacity_per_day),
      },
      { onSuccess: () => setDraft(emptyDraft) },
    )
  }

  const handleFieldUpdate = (wc: WorkCenterRecord, data: Partial<WorkCenterRecord>) => {
    updateWc.mutate({ id: wc.id, data })
  }

  const modal = (
    <div data-kiterp-modal className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Factory className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Work Centers</h2>
              <p className="text-xs text-muted-foreground">Machines, workstations or crews that run production operations</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Add new */}
        <div className="border-b border-border bg-muted/10 px-6 py-3">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Name</label>
              <input
                value={draft.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Cutting Table 1"
                className="w-full mt-1 text-sm rounded-lg border border-border bg-card px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div className="col-span-3">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Code (optional)</label>
              <input
                value={draft.code}
                onChange={e => setDraft(d => ({ ...d, code: e.target.value }))}
                placeholder="Auto"
                className="w-full mt-1 text-sm rounded-lg border border-border bg-card px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">₹ / hour</label>
              <input
                type="number"
                min={0}
                value={draft.cost_per_hour}
                onChange={e => setDraft(d => ({ ...d, cost_per_hour: Number(e.target.value) }))}
                className="w-full mt-1 text-sm rounded-lg border border-border bg-card px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Hrs / day</label>
              <input
                type="number"
                min={0}
                value={draft.capacity_per_day}
                onChange={e => setDraft(d => ({ ...d, capacity_per_day: e.target.value === '' ? '' : Number(e.target.value) }))}
                placeholder="—"
                className="w-full mt-1 text-sm rounded-lg border border-border bg-card px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div className="col-span-1">
              <button
                onClick={handleCreate}
                disabled={!draft.name.trim() || createWc.isPending}
                className="w-full flex items-center justify-center rounded-lg bg-primary text-primary-foreground py-1.5 hover:opacity-90 transition-opacity disabled:opacity-40"
                title="Add work center"
              >
                {createWc.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : workCenters.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Factory className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No work centers yet</p>
              <p className="text-xs mt-1">Add one above to start building routings</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/40 border-b border-border">
                <tr className="text-xs font-medium text-muted-foreground uppercase">
                  <th className="py-2 px-4 text-left"><TableColumnLabel>Code</TableColumnLabel></th>
                  <th className="py-2 px-3 text-left"><TableColumnLabel>Name</TableColumnLabel></th>
                  <th className="py-2 px-3 text-right"><TableColumnLabel>₹/hr</TableColumnLabel></th>
                  <th className="py-2 px-3 text-right"><TableColumnLabel>Hrs/day</TableColumnLabel></th>
                  <th className="py-2 px-3 text-center"><TableColumnLabel>Active</TableColumnLabel></th>
                  <th className="py-2 px-2 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {workCenters.map(wc => {
                  const isEditing = editingId === wc.id
                  return (
                    <tr key={wc.id} className="hover:bg-muted/30">
                      <td className="py-2 px-4 font-mono text-xs text-muted-foreground">{wc.code}</td>
                      <td className="py-2 px-3">
                        {isEditing ? (
                          <input
                            defaultValue={wc.name}
                            autoFocus
                            onBlur={e => { handleFieldUpdate(wc, { name: e.target.value.trim() || wc.name }); setEditingId(null) }}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                            className="w-full bg-transparent font-medium rounded px-1 py-0.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary/40"
                          />
                        ) : (
                          <span className="font-medium">{wc.name}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={0}
                          defaultValue={wc.cost_per_hour}
                          onBlur={e => {
                            const v = parseFloat(e.target.value)
                            if (!Number.isNaN(v) && v !== wc.cost_per_hour) handleFieldUpdate(wc, { cost_per_hour: v })
                          }}
                          className="w-20 bg-transparent text-right rounded px-1 py-0.5 border border-transparent hover:border-border focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={0}
                          defaultValue={wc.capacity_per_day ?? ''}
                          placeholder="—"
                          onBlur={e => {
                            const raw = e.target.value
                            const v = raw === '' ? null : parseFloat(raw)
                            if (v !== wc.capacity_per_day) handleFieldUpdate(wc, { capacity_per_day: v ?? undefined })
                          }}
                          className="w-16 bg-transparent text-right rounded px-1 py-0.5 border border-transparent hover:border-border focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={wc.is_active}
                          onChange={e => handleFieldUpdate(wc, { is_active: e.target.checked })}
                          className="rounded border-input"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditingId(isEditing ? null : wc.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Rename"
                          >
                            {isEditing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => deleteWc.mutate(wc.id)}
                            disabled={deleteWc.isPending}
                            className="text-muted-foreground hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
