import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, Workflow, ToggleLeft, ToggleRight, X, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableToolbar } from '@/components/table/TableToolbar'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { processRows, type SortDir } from '@/lib/tableList'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import {
  useBookingWizardSteps,
  useCreateBookingWizardStep,
  useUpdateBookingWizardStep,
  useDeleteBookingWizardStep,
  useToggleBookingWizardStepActive,
} from '@/hooks/useBookingWizardSteps'
import type { VendorBookingWizardStep, VendorBookingWizardStepCreate } from '@/api/bookingWizardSteps'

function StepModal({
  initial,
  nextSortOrder,
  onClose,
  onSave,
  saving,
}: {
  initial?: VendorBookingWizardStep
  nextSortOrder: number
  onClose: () => void
  onSave: (data: VendorBookingWizardStepCreate) => void
  saving: boolean
}) {
  useEscapeToClose(onClose)
  const [label, setLabel] = useState(initial?.label ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? nextSortOrder))
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    onSave({
      label: label.trim(),
      description: description.trim() || undefined,
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-md max-h-[90vh] flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{initial ? 'Edit step' : 'New step'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-5">
            <div>
              <Label>Step label</Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} required placeholder="Service" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What are you booking?" />
            </div>
            <div>
              <Label>Sort order</Label>
              <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              Active on storefront
            </label>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initial ? 'Save' : 'Add step'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SalesBookingWizardStepsPage() {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; step?: VendorBookingWizardStep } | null>(null)
  const [sortKey, setSortKey] = useState('sort_order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useBookingWizardSteps({ size: 100, search: search.trim() || undefined })
  const createStep = useCreateBookingWizardStep()
  const updateStep = useUpdateBookingWizardStep()
  const deleteStep = useDeleteBookingWizardStep()
  const toggleActive = useToggleBookingWizardStepActive()

  const rows = useMemo(() => {
    const items = data?.items ?? []
    return processRows(
      items,
      search,
      (s) => [s.label, s.description ?? ''],
      sortKey,
      sortDir,
      {
        sort_order: (s) => s.sort_order,
        label: (s) => s.label,
        is_active: (s) => (s.is_active ? 1 : 0),
      },
    )
  }, [data?.items, search, sortKey, sortDir])

  const saving = createStep.isPending || updateStep.isPending
  const nextSortOrder = (data?.items?.length ?? 0)

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            Booking Wizard
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Define the steps shown in the Booking Wizard section of your website builder. Steps sync automatically —
            if none are added, a default Service → Date → Time → Details → Review flow is shown instead. Edit the
            section title and subtitle directly in the website builder.
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="gap-2">
          <Plus className="h-4 w-4" /> Add step
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search steps…"
            sortOptions={[
              { value: 'sort_order', label: 'Order' },
              { value: 'label', label: 'Label' },
              { value: 'is_active', label: 'Active' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
          />
          <div className="overflow-x-auto">
            <ResizableTable tableId="sales-booking-wizard-steps-v1" defaultWidths={[64, 220, 360, 90, 120]}>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Order</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Step</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Description</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Active</TableColumnLabel></th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No steps yet — the default Service → Date → Time → Details → Review flow is shown until you add your own.</td></tr>
                ) : rows.map(step => (
                  <tr
                    key={step.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={onClickableTableRow(() => setModal({ mode: 'edit', step }))}
                  >
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="h-3.5 w-3.5 opacity-40" />
                        {step.sort_order}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{step.label}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground line-clamp-2 max-w-sm">{step.description || '—'}</td>
                    <td className="px-4 py-3 text-sm">{step.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={step.is_active ? 'Deactivate' : 'Activate'}
                          onClick={e => {
                            e.stopPropagation()
                            toggleActive.mutate({ id: step.id, is_active: !step.is_active })
                          }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          {step.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', step }) }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={e => {
                            e.stopPropagation()
                            if (window.confirm(`Delete step "${step.label}"?`)) deleteStep.mutate(step.id)
                          }}
                          className="rounded p-1 hover:bg-muted text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResizableTable>
          </div>
        </CardContent>
      </Card>

      {modal && (
        <StepModal
          initial={modal.mode === 'edit' ? modal.step : undefined}
          nextSortOrder={nextSortOrder}
          onClose={() => setModal(null)}
          saving={saving}
          onSave={data => {
            if (modal.mode === 'edit' && modal.step) {
              updateStep.mutate({ id: modal.step.id, data }, { onSuccess: () => setModal(null) })
            } else {
              createStep.mutate(data, { onSuccess: () => setModal(null) })
            }
          }}
        />
      )}
    </div>
  )
}
