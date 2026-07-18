import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { ResizableTable } from '@/components/table/ResizableTable'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { TableToolbar } from '@/components/table/TableToolbar'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { CheckboxFieldLabel, TableColumnLabel } from '@/components/common/FieldLabel'
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

import { askConfirm } from '@/components/common/ConfirmProvider'
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
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-3">
      <ModalPanel className="max-w-md max-h-[calc(100dvh-1.5rem)] !rounded-lg">
        <ModalHeader
          title={initial ? 'Edit step' : 'New step'}
          onClose={onClose}
          className="border-0 px-4 py-3 [&>div>h2]:text-base"
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-2.5 px-4 pb-3 pt-0">
            <div className="space-y-1">
              <Label className="text-xs">Step label *</Label>
              <Input className="h-8 text-sm" value={label} onChange={e => setLabel(e.target.value)} required autoFocus placeholder="Service" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea className="min-h-[3.5rem] resize-none px-2.5 py-1.5 text-sm" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What are you booking?" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sort order</Label>
              <Input className="h-8 text-sm" type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
            </div>
          </ModalBody>
          <ModalFooter className="items-center justify-between gap-2 border-0 bg-transparent px-4 py-3">
            <CheckboxFieldLabel label="Active on storefront" checked={isActive} onChange={setIsActive} labelClassName="text-xs" />
            <div className="flex gap-2">
              <Button type="button" variant="cancel" className="h-8 rounded-md px-3 text-sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="h-8 rounded-md px-3 text-sm" disabled={saving || !label.trim()}>
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {initial ? 'Save' : 'Add step'}
              </Button>
            </div>
          </ModalFooter>
        </form>
      </ModalPanel>
    </ModalOverlay>
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
  const { isSaving, patchField } = useInlineFieldPatch(updateStep)
  const nextSortOrder = (data?.items?.length ?? 0)

  return (
    <div className="space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Steps for the storefront booking flow · syncs to Website Builder
        </p>
        <Button onClick={() => setModal({ mode: 'create' })} className="h-8 gap-1.5 px-3 text-sm shrink-0">
          <Plus className="h-3.5 w-3.5" /> Add step
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
            hint={INLINE_EDIT_HINT}
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
                        <GripVertical className="h-3.5 w-3.5 opacity-40 shrink-0" />
                        <InlineEditCell type="number" value={step.sort_order} readOnly readOnlyMessage="Use the full editor to change step order" title="Order">
                          {step.sort_order}
                        </InlineEditCell>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <InlineEditCell
                        value={step.label}
                        saving={isSaving(step.id, 'label')}
                        validate={(v) => String(v).trim().length < 1 ? 'Label is required' : null}
                        onSave={(v) => patchField(step.id, 'label', String(v).trim())}
                        title="Edit step label"
                      >
                        {step.label}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground line-clamp-2 max-w-sm">
                      <InlineEditCell
                        value={step.description || ''}
                        saving={isSaving(step.id, 'description')}
                        onSave={(v) => patchField(step.id, 'description', String(v).trim() || null)}
                        title="Edit description"
                      >
                        {step.description || '—'}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="select"
                        value={step.is_active ? 'true' : 'false'}
                        options={[
                          { value: 'true', label: 'Active' },
                          { value: 'false', label: 'Hidden' },
                        ]}
                        saving={isSaving(step.id, 'is_active')}
                        onSave={(v) => patchField(step.id, 'is_active', v === 'true')}
                        title="Edit active status"
                      >
                        {step.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}
                      </InlineEditCell>
                    </td>
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
                          onClick={async e => {
                            e.stopPropagation()
                            if (await askConfirm(`Delete step "${step.label}"?`)) deleteStep.mutate(step.id)
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
