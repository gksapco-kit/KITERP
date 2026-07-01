import { useState, useMemo } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import { BranchSelect } from '@/components/common/BranchSelect'
import { PlantSelect } from '@/components/common/PlantSelect'
import {
  useStores,
  useStorageLocationTree,
  useCreateStorageLocation,
  useUpdateStorageLocation,
  useDeleteStorageLocation,
} from '@/hooks/useVendor'
import {
  Loader2, Plus, Pencil, Trash2, X, ChevronRight, ChevronDown,
  Boxes, MapPin,
} from 'lucide-react'
import { ResizableTable } from '@/components/table/ResizableTable'
import type { StorageLocation, CustomField } from '@/types'

const selectCls = 'h-10 text-sm'

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'boolean', label: 'Yes/No' },
]

function CustomFieldsEditor({ fields, onChange }: { fields: CustomField[]; onChange: (f: CustomField[]) => void }) {
  const addField = () => onChange([...fields, { name: '', type: 'text', required: false }])
  const removeField = (i: number) => onChange(fields.filter((_, idx) => idx !== i))
  const updateField = (i: number, patch: Partial<CustomField>) => {
    const updated = [...fields]
    updated[i] = { ...updated[i], ...patch }
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Custom Fields <span className="text-gray-400 font-normal">(attributes for this location)</span>
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={addField} className="gap-1 text-xs h-7">
          <Plus className="w-3 h-3" /> Add Field
        </Button>
      </div>
      {fields.length === 0 && (
        <p className="text-xs text-gray-400">No custom fields. Add fields like Aisle, Shelf, Temperature zone, etc.</p>
      )}
      {fields.map((f, i) => (
        <div key={i} className="flex items-start gap-2 p-3 rounded-lg border bg-gray-50">
          <div className="flex-1 grid grid-cols-3 gap-2">
            <Input placeholder="Field name" value={f.name} onChange={e => updateField(i, { name: e.target.value })} className="h-8 text-sm" />
            <Select
              value={f.type}
              onChange={(v) => updateField(i, { type: v, options: v === 'select' || v === 'multiselect' ? f.options || [] : undefined })}
              options={FIELD_TYPES.map(t => ({ value: t.value, label: t.label }))}
              aria-label="Field type"
              className={`${selectCls} h-8 text-sm`}
            />
            {(f.type === 'select' || f.type === 'multiselect') && (
              <Input
                placeholder="Options (comma separated)"
                value={(f.options || []).join(', ')}
                onChange={e => updateField(i, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                className="h-8 text-sm"
              />
            )}
          </div>
          <label className="flex items-center gap-1 text-xs text-gray-500 pt-1.5 shrink-0">
            <input type="checkbox" checked={f.required || false} onChange={e => updateField(i, { required: e.target.checked })} className="rounded" />
            Req
          </label>
          <button type="button" aria-label="Remove field" onClick={() => removeField(i)} className="p-1 text-red-400 hover:text-red-600 shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

function LocationRow({ loc, level, onEdit, onAddSub, onDelete }: {
  loc: StorageLocation
  level: number
  onEdit: (l: StorageLocation) => void
  onAddSub: (parentId: string) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = loc.children && loc.children.length > 0
  const indent = level * 28

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3" style={{ paddingLeft: `${16 + indent}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button type="button" onClick={() => setExpanded(!expanded)} className="p-0.5 rounded hover:bg-gray-200 text-gray-400">
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <MapPin className={`w-4 h-4 shrink-0 ${level === 0 ? 'text-indigo-500' : 'text-gray-400'}`} />
            <div>
              <p className="text-sm font-medium">{loc.name}</p>
              {loc.description && <p className="text-xs text-gray-500">{loc.description}</p>}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{loc.code || '—'}</td>
        <td className="px-4 py-3">
          {loc.custom_fields?.length > 0 && (
            <span className="text-xs text-gray-500">{loc.custom_fields.length} field{loc.custom_fields.length > 1 ? 's' : ''}</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${loc.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {loc.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" title="Add sub-location" onClick={() => onAddSub(loc.id)}>
              <Plus className="w-4 h-4 text-green-500" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onEdit(loc)}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500"
              onClick={() => { if (confirm(`Delete "${loc.name}" and all sub-locations?`)) onDelete(loc.id) }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </td>
      </tr>
      {expanded && hasChildren && loc.children.map(child => (
        <LocationRow
          key={child.id}
          loc={child}
          level={level + 1}
          onEdit={onEdit}
          onAddSub={onAddSub}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

function flattenLocations(locs: StorageLocation[], prefix = ''): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = []
  for (const loc of locs) {
    result.push({ id: loc.id, label: prefix + loc.name })
    if (loc.children?.length) {
      result.push(...flattenLocations(loc.children, prefix + loc.name + ' / '))
    }
  }
  return result
}

export default function StorageLocationsPage() {
  const { data: storesData, isLoading: storesLoading } = useStores()
  const stores = storesData?.stores ?? []
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const effectiveStoreId = selectedBranchId || selectedStoreId
  const [selectedPlantId, setSelectedPlantId] = useState('')

  const { data, isLoading } = useStorageLocationTree(
    effectiveStoreId || null,
    selectedPlantId || null,
  )
  const createLocation = useCreateStorageLocation()
  const updateLocation = useUpdateStorageLocation()
  const deleteLocation = useDeleteStorageLocation()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<StorageLocation | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState(0)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [search, setSearch] = useState('')

  const resetForm = () => {
    setShowForm(false)
    setEditing(null)
    setName('')
    setCode('')
    setDescription('')
    setParentId(null)
    setSortOrder(0)
    setCustomFields([])
  }

  useEscapeToClose(resetForm, showForm)

  const openCreate = (pId?: string) => {
    resetForm()
    if (pId) setParentId(pId)
    setShowForm(true)
  }

  const openEdit = (loc: StorageLocation) => {
    setEditing(loc)
    setName(loc.name)
    setCode(loc.code || '')
    setDescription(loc.description || '')
    setParentId(loc.parent_id || null)
    setSortOrder(loc.sort_order || 0)
    setCustomFields(loc.custom_fields || [])
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !effectiveStoreId || !selectedPlantId) return

    const payload: Record<string, unknown> = {
      name: name.trim(),
      code: code.trim() || undefined,
      description: description.trim() || undefined,
      parent_id: parentId || undefined,
      sort_order: sortOrder,
      custom_fields: customFields.filter(f => f.name.trim()),
    }

    if (editing) {
      updateLocation.mutate({ id: editing.id, data: payload }, { onSuccess: resetForm })
    } else {
      createLocation.mutate({ ...payload, store_id: effectiveStoreId, plant_id: selectedPlantId }, { onSuccess: resetForm })
    }
  }

  const flatOptions = useMemo(
    () => flattenLocations(data?.locations || []).filter(o => o.id !== editing?.id),
    [data?.locations, editing?.id],
  )

  const filteredLocations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data?.locations || []
    const filterTree = (nodes: StorageLocation[]): StorageLocation[] =>
      nodes
        .map(node => {
          const kids = filterTree(node.children || [])
          const match = node.name.toLowerCase().includes(q)
            || (node.code || '').toLowerCase().includes(q)
            || (node.description || '').toLowerCase().includes(q)
          if (match || kids.length > 0) return { ...node, children: kids }
          return null
        })
        .filter(Boolean) as StorageLocation[]
    return filterTree(data?.locations || [])
  }, [data?.locations, search])

  const selectedStore = stores.find(s => s.id === selectedStoreId)
  const canCreate = Boolean(effectiveStoreId && selectedPlantId)
  const filterHint = effectiveStoreId && selectedPlantId
    ? `Locations below belong to ${selectedStore?.name ?? 'this unit'}`
    : effectiveStoreId
      ? `All plants in ${selectedStore?.name ?? 'this unit'}`
      : selectedPlantId
        ? 'Filtered by plant across all business units'
        : 'All business units and plants'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="w-7 h-7 text-indigo-600" />
            Storage Locations
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Define warehouse zones, aisles, shelves, and bins per business unit. Add custom fields on each location as needed.
          </p>
        </div>
        <Button onClick={() => openCreate()} disabled={!canCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Add Location
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[220px] space-y-1.5">
              <Label className="text-xs text-muted-foreground">Business Unit</Label>
              {storesLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              ) : stores.length === 0 ? (
                <p className="text-sm text-gray-400">No business units yet. Create one under Finance → Business Units.</p>
              ) : (
                <BusinessUnitSelect
                  value={selectedStoreId}
                  onChange={(v) => { setSelectedStoreId(v); setSelectedBranchId(''); setSelectedPlantId('') }}
                  allowAll
                  autoSelectDefault={false}
                />
              )}
            </div>
            {stores.length > 0 && (
              <div className="min-w-[220px] space-y-1.5">
                <Label className="text-xs text-muted-foreground">Branch</Label>
                <BranchSelect
                  businessUnitId={selectedStoreId || null}
                  value={selectedBranchId}
                  onChange={(v) => { setSelectedBranchId(v); setSelectedPlantId('') }}
                  allowAll
                />
              </div>
            )}
            {stores.length > 0 && (
              <div className="min-w-[220px] space-y-1.5">
                <Label className="text-xs text-muted-foreground">Plant</Label>
                <PlantSelect
                  value={selectedPlantId}
                  onChange={setSelectedPlantId}
                  storeId={effectiveStoreId || null}
                  allowAll
                />
              </div>
            )}
            {stores.length > 0 && (
              <p className="text-xs text-gray-400 pb-2">{filterHint}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b">
            <div className="relative max-w-sm">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search locations…"
                className="pl-9 h-9"
              />
            </div>
          </div>
          {stores.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Create a business unit first to manage storage locations.</p>
          ) : isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
          ) : (
            <ResizableTable tableId="storage-locations" defaultWidths={[280, 100, 100, 90, 120]}>
              <thead>
                <tr className="border-b bg-gray-50/80 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3"><TableColumnLabel>Location</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Code</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Fields</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLocations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                      No storage locations yet. Add a root location (e.g. Main Warehouse) then sub-locations (Aisle, Shelf, Bin).
                    </td>
                  </tr>
                ) : (
                  filteredLocations.map(loc => (
                    <LocationRow
                      key={loc.id}
                      loc={loc}
                      level={0}
                      onEdit={openEdit}
                      onAddSub={openCreate}
                      onDelete={id => deleteLocation.mutate(id)}
                    />
                  ))
                )}
              </tbody>
            </ResizableTable>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={resetForm}>
          <div className="w-full max-w-lg bg-card border border-border text-foreground rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Storage Location' : 'New Storage Location'}</h2>
              <button type="button" aria-label="Close" onClick={resetForm} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Warehouse, Aisle A, Shelf 3" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input value={code} onChange={e => setCode(e.target.value)} placeholder="WH-01" />
                </div>
                <div className="space-y-1.5">
                  <Label>Sort order</Label>
                  <Input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes" />
              </div>
              <div className="space-y-1.5">
                <Label>Parent location</Label>
                <Select
                  value={parentId || ''}
                  onChange={(v) => setParentId(v || null)}
                  options={selectOptionsWithBlank('None (root location)', flatOptions.map(o => ({
                    value: o.id,
                    label: o.label,
                  })))}
                  placeholder="None (root location)"
                  aria-label="Parent location"
                />
              </div>
              <CustomFieldsEditor fields={customFields} onChange={setCustomFields} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={createLocation.isPending || updateLocation.isPending}>
                  {(createLocation.isPending || updateLocation.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editing ? 'Save Changes' : 'Create Location'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
