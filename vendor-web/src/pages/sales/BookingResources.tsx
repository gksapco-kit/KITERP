import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, Building2, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AiDescriptionTextarea } from '@/components/common/AiDescriptionTextarea'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { ResizableTable } from '@/components/table/ResizableTable'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { TableToolbar } from '@/components/table/TableToolbar'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { CheckboxFieldLabel, TableColumnLabel } from '@/components/common/FieldLabel'
import { formatCurrency } from '@/lib/utils'
import { processRows, type SortDir } from '@/lib/tableList'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import {
  useBookingResources,
  useCreateBookingResource,
  useUpdateBookingResource,
  useDeleteBookingResource,
  useToggleBookingResourceActive,
} from '@/hooks/useBookingResources'
import type { VendorBookingResource, VendorBookingResourceCreate } from '@/api/bookingResources'

import { ThemeSelect } from '@/components/common/ThemeSelect'
import { askConfirm } from '@/components/common/ConfirmProvider'
const RESOURCE_TYPES = ['room', 'table', 'court', 'equipment']

function ResourceModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: VendorBookingResource
  onClose: () => void
  onSave: (data: VendorBookingResourceCreate) => void
  saving: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [resourceType, setResourceType] = useState(initial?.resource_type ?? 'room')
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? 1))
  const [description, setDescription] = useState(initial?.description ?? '')
  const [features, setFeatures] = useState((initial?.features ?? []).join(', '))
  const [pricePerHour, setPricePerHour] = useState(String(initial?.price_per_hour ?? 0))
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD')
  const [isAvailable, setIsAvailable] = useState(initial?.is_available ?? true)
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0))
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      resource_type: resourceType,
      capacity: Number(capacity) || 1,
      description: description.trim() || undefined,
      features: features.split(',').map(f => f.trim()).filter(Boolean),
      price_per_hour: Number(pricePerHour) || 0,
      currency: currency.trim() || 'USD',
      is_available: isAvailable,
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    })
  }

  const labelCls = 'text-xs leading-none'
  const fieldGap = 'space-y-1'
  const inputCls = 'h-8 text-sm'
  const selectCls = 'h-8 w-full rounded-md border border-input bg-background px-2 text-sm'

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-3">
      <ModalPanel className="max-w-md max-h-[calc(100dvh-1.5rem)] !rounded-lg">
        <ModalHeader
          title={initial ? 'Edit resource' : 'New resource'}
          onClose={onClose}
          className="border-0 px-4 py-3 [&>div>h2]:text-base"
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-2.5 overflow-y-auto px-4 pb-3 pt-0">
            <div className={fieldGap}>
              <Label className={labelCls}>Name *</Label>
              <Input className={inputCls} value={name} onChange={e => setName(e.target.value)} required autoFocus placeholder="Studio A — North light" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={fieldGap}>
                <Label className={labelCls}>Type</Label>
                <ThemeSelect
                  value={resourceType}
                  onChange={setResourceType}
                  options={RESOURCE_TYPES.map(t => ({
                    value: t,
                    label: t[0].toUpperCase() + t.slice(1),
                  }))}
                  className={selectCls}
                />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Capacity</Label>
                <Input className={inputCls} type="number" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={fieldGap}>
                <Label className={labelCls}>Price / hour</Label>
                <Input className={inputCls} type="number" min={0} step="0.01" value={pricePerHour} onChange={e => setPricePerHour(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Currency</Label>
                <Input className={inputCls} value={currency} onChange={e => setCurrency(e.target.value)} placeholder="USD" />
              </div>
            </div>

            <div className={fieldGap}>
              <Label className={labelCls}>Sort order</Label>
              <Input className={inputCls} type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
            </div>

            <div className={fieldGap}>
              <Label className={labelCls}>Description</Label>
              <AiDescriptionTextarea
                value={description}
                onChange={setDescription}
                rows={4}
                className="min-h-[6rem] w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                placeholder="Bright corner studio with 14ft ceilings…"
                maxLength={1000}
                context={{
                  field_kind: 'booking_resource_description',
                  name,
                  category: resourceType,
                  extra_context: { capacity, features },
                }}
              />
            </div>
            <div className={fieldGap}>
              <Label className={labelCls}>Features (comma-separated)</Label>
              <Input className={inputCls} value={features} onChange={e => setFeatures(e.target.value)} placeholder="Natural light, Sound system" />
            </div>
          </ModalBody>
          <ModalFooter className="flex-wrap items-center justify-between gap-2 border-0 bg-transparent px-4 py-3">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <CheckboxFieldLabel
                label="Available now"
                checked={isAvailable}
                onChange={setIsAvailable}
                labelClassName="text-xs"
              />
              <CheckboxFieldLabel
                label="Active on storefront"
                checked={isActive}
                onChange={setIsActive}
                labelClassName="text-xs"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="cancel" className="h-8 rounded-md px-3 text-sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="h-8 rounded-md px-3 text-sm" disabled={saving || !name.trim()}>
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {initial ? 'Save' : 'Add resource'}
              </Button>
            </div>
          </ModalFooter>
        </form>
      </ModalPanel>
    </ModalOverlay>
  )
}

export default function SalesBookingResourcesPage() {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; resource?: VendorBookingResource } | null>(null)
  const [sortKey, setSortKey] = useState('sort_order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useBookingResources({ size: 100, search: search.trim() || undefined })
  const createResource = useCreateBookingResource()
  const updateResource = useUpdateBookingResource()
  const deleteResource = useDeleteBookingResource()
  const toggleActive = useToggleBookingResourceActive()

  const rows = useMemo(() => {
    const items = data?.items ?? []
    return processRows(
      items,
      search,
      (r) => [r.name, r.resource_type, r.description ?? ''],
      sortKey,
      sortDir,
      {
        sort_order: (r) => r.sort_order,
        name: (r) => r.name,
        price: (r) => r.price_per_hour,
        is_active: (r) => (r.is_active ? 1 : 0),
      },
    )
  }, [data?.items, search, sortKey, sortDir])

  const saving = createResource.isPending || updateResource.isPending
  const { isSaving, patchField } = useInlineFieldPatch(updateResource)

  return (
    <div className="space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 text-lg font-semibold leading-tight">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            Resources
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Rooms &amp; equipment · syncs to Website Builder
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="h-8 gap-1.5 px-3 text-sm shrink-0">
          <Plus className="h-3.5 w-3.5" /> Add resource
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search resources…"
            sortOptions={[
              { value: 'sort_order', label: 'Order' },
              { value: 'name', label: 'Name' },
              { value: 'price', label: 'Price per hour' },
              { value: 'is_active', label: 'Active' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            hint={INLINE_EDIT_HINT}
          />
          <div className="overflow-x-auto">
            <ResizableTable tableId="sales-booking-resources-v1" defaultWidths={[64, 240, 110, 90, 130, 100, 100, 130]}>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Order</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Name</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Type</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Capacity</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Price / hour</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Available</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Active</TableColumnLabel></th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No resources yet — demo resources (Studio A, Studio B, Court 3, Boardroom) are shown until you add your own.</td></tr>
                ) : rows.map(resource => (
                  <tr
                    key={resource.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={onClickableTableRow(() => setModal({ mode: 'edit', resource }))}
                  >
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <InlineEditCell type="number" value={resource.sort_order} readOnly readOnlyMessage="Use the full editor to change sort order" title="Order">
                        {resource.sort_order}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <InlineEditCell
                        value={resource.name}
                        saving={isSaving(resource.id, 'name')}
                        validate={(v) => String(v).trim().length < 1 ? 'Name is required' : null}
                        onSave={(v) => patchField(resource.id, 'name', String(v).trim())}
                        title="Edit resource name"
                      >
                        <div>{resource.name}</div>
                      </InlineEditCell>
                      {resource.features.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {resource.features.slice(0, 3).map(f => (
                            <Badge key={f} variant="outline" className="text-[10px] font-normal">{f}</Badge>
                          ))}
                          {resource.features.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{resource.features.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                      <InlineEditCell
                        type="select"
                        value={resource.resource_type}
                        options={RESOURCE_TYPES.map(t => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))}
                        saving={isSaving(resource.id, 'resource_type')}
                        onSave={(v) => patchField(resource.id, 'resource_type', v)}
                        title="Edit resource type"
                      >
                        {resource.resource_type}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <InlineEditCell
                        type="number"
                        value={resource.capacity}
                        min={1}
                        step="1"
                        saving={isSaving(resource.id, 'capacity')}
                        validate={(v) => Number(v) < 1 ? 'Capacity must be at least 1' : null}
                        onSave={(v) => patchField(resource.id, 'capacity', Number(v) || 1)}
                        title="Edit capacity"
                      >
                        {resource.capacity}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="number"
                        value={resource.price_per_hour}
                        min={0}
                        step="0.01"
                        saving={isSaving(resource.id, 'price_per_hour')}
                        validate={(v) => Number(v) < 0 ? 'Price must be 0 or more' : null}
                        onSave={(v) => patchField(resource.id, 'price_per_hour', Number(v) || 0)}
                        title="Edit price per hour"
                      >
                        {formatCurrency(resource.price_per_hour, resource.currency)}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3">
                      <InlineEditCell
                        type="select"
                        value={resource.is_available ? 'true' : 'false'}
                        options={[
                          { value: 'true', label: 'Available' },
                          { value: 'false', label: 'Booked' },
                        ]}
                        saving={isSaving(resource.id, 'is_available')}
                        onSave={(v) => patchField(resource.id, 'is_available', v === 'true')}
                        title="Edit availability"
                      >
                        {resource.is_available
                          ? <span className="text-xs font-medium text-green-700">Available</span>
                          : <span className="text-xs text-muted-foreground">Booked</span>}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="select"
                        value={resource.is_active ? 'true' : 'false'}
                        options={[
                          { value: 'true', label: 'Active' },
                          { value: 'false', label: 'Hidden' },
                        ]}
                        saving={isSaving(resource.id, 'is_active')}
                        onSave={(v) => patchField(resource.id, 'is_active', v === 'true')}
                        title="Edit active status"
                      >
                        {resource.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={resource.is_active ? 'Deactivate' : 'Activate'}
                          onClick={e => {
                            e.stopPropagation()
                            toggleActive.mutate({ id: resource.id, is_active: !resource.is_active })
                          }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          {resource.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', resource }) }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={async e => {
                            e.stopPropagation()
                            if (await askConfirm(`Delete "${resource.name}"?`)) deleteResource.mutate(resource.id)
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
        <ResourceModal
          initial={modal.mode === 'edit' ? modal.resource : undefined}
          onClose={() => setModal(null)}
          saving={saving}
          onSave={data => {
            if (modal.mode === 'edit' && modal.resource) {
              updateResource.mutate({ id: modal.resource.id, data }, { onSuccess: () => setModal(null) })
            } else {
              createResource.mutate(data, { onSuccess: () => setModal(null) })
            }
          }}
        />
      )}
    </div>
  )
}
