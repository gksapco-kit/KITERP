import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, Building2, ToggleLeft, ToggleRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableToolbar } from '@/components/table/TableToolbar'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { formatCurrency } from '@/lib/utils'
import { processRows, type SortDir } from '@/lib/tableList'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import {
  useBookingResources,
  useCreateBookingResource,
  useUpdateBookingResource,
  useDeleteBookingResource,
  useToggleBookingResourceActive,
  useToggleBookingResourceAvailable,
} from '@/hooks/useBookingResources'
import type { VendorBookingResource, VendorBookingResourceCreate } from '@/api/bookingResources'

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
  useEscapeToClose(onClose)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-lg max-h-[90vh] flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{initial ? 'Edit resource' : 'New resource'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-5">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Studio A — North light" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <select
                  value={resourceType}
                  onChange={e => setResourceType(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {RESOURCE_TYPES.map(t => (
                    <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Capacity</Label>
                <Input type="number" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Bright corner studio with 14ft ceilings…" />
            </div>
            <div>
              <Label>Features</Label>
              <Input value={features} onChange={e => setFeatures(e.target.value)} placeholder="Natural light, Sound system, Whiteboard" />
              <p className="mt-1 text-[11px] text-muted-foreground">Comma-separated. Shown as tags on the storefront.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price per hour</Label>
                <Input type="number" min={0} step="0.01" value={pricePerHour} onChange={e => setPricePerHour(e.target.value)} />
              </div>
              <div>
                <Label>Currency</Label>
                <Input value={currency} onChange={e => setCurrency(e.target.value)} placeholder="USD" />
              </div>
            </div>
            <div>
              <Label>Sort order</Label>
              <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isAvailable} onChange={e => setIsAvailable(e.target.checked)} />
              Available for booking right now
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              Active on storefront
            </label>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initial ? 'Save' : 'Add resource'}
            </Button>
          </div>
        </form>
      </div>
    </div>
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
  const toggleAvailable = useToggleBookingResourceAvailable()

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

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Resources
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Manage the rooms, tables, courts, or equipment guests can pick from in the Resource Picker section of
            your website builder. Resources sync automatically — if none are added, demo resources are shown instead.
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="gap-2">
          <Plus className="h-4 w-4" /> Add resource
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
                    <td className="px-4 py-3 text-sm text-muted-foreground">{resource.sort_order}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <div>{resource.name}</div>
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
                    <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{resource.resource_type}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{resource.capacity}</td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(resource.price_per_hour, resource.currency)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        title={resource.is_available ? 'Mark booked' : 'Mark available'}
                        onClick={e => {
                          e.stopPropagation()
                          toggleAvailable.mutate({ id: resource.id, is_available: !resource.is_available })
                        }}
                        className="inline-flex items-center gap-1 rounded p-1 hover:bg-muted"
                      >
                        {resource.is_available
                          ? <span className="text-xs font-medium text-green-700">Available</span>
                          : <span className="text-xs text-muted-foreground">Booked</span>}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">{resource.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}</td>
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
                          onClick={e => {
                            e.stopPropagation()
                            if (window.confirm(`Delete "${resource.name}"?`)) deleteResource.mutate(resource.id)
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
