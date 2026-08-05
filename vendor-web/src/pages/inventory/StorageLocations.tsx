import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalPanel,
} from '@/components/ui/Modal'
import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import {
  BranchPlantSelect,
  type BranchPlantSelection,
} from '@/components/common/BranchPlantSelect'
import {
  useStores,
  usePlants,
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
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import type { StorageLocation, CustomField } from '@/types'

import { askConfirm } from '@/components/common/ConfirmProvider'
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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">
          Custom Fields <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={addField} className="gap-1 text-xs h-7">
          <Plus className="w-3 h-3" /> Add Field
        </Button>
      </div>
      {fields.length === 0 && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          No custom fields yet. Add Aisle, Shelf, Temperature zone, etc.
        </p>
      )}
      {fields.map((f, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2">
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
          <label className="flex items-center gap-1 text-xs text-muted-foreground pt-1.5 shrink-0">
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

function LocationRow({ loc, level, onEdit, onAddSub, onDelete, patchField, isSaving }: {
  loc: StorageLocation
  level: number
  onEdit: (l: StorageLocation) => void
  onAddSub: (parentId: string) => void
  onDelete: (id: string) => void
  patchField: (id: string, field: string, value: unknown) => Promise<void>
  isSaving: (id: string, field: string) => boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = loc.children && loc.children.length > 0
  const indent = level * 28

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3" style={{ paddingLeft: `${16 + indent}px` }}>
          <div className="flex min-w-0 items-center gap-2">
            {hasChildren ? (
              <button type="button" onClick={() => setExpanded(!expanded)} className="shrink-0 p-0.5 rounded hover:bg-gray-200 text-gray-400">
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            <MapPin className={`w-4 h-4 shrink-0 ${level === 0 ? 'text-indigo-500' : 'text-gray-400'}`} />
            <div className="min-w-0 flex-1 overflow-hidden">
              <InlineEditCell
                value={loc.name}
                saving={isSaving(loc.id, 'name')}
                onSave={(v) => patchField(loc.id, 'name', String(v).trim())}
                className="text-sm font-medium"
                title={loc.name}
              >
                {loc.name}
              </InlineEditCell>
              {loc.description && (
                <p className="truncate text-xs text-gray-500" title={loc.description}>
                  {loc.description}
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">
          <InlineEditCell
            value={loc.code || ''}
            saving={isSaving(loc.id, 'code')}
            onSave={(v) => patchField(loc.id, 'code', String(v).trim())}
            title={loc.code || undefined}
          >
            {loc.code || '—'}
          </InlineEditCell>
        </td>
        <td className="px-4 py-3">
          <InlineEditCell
            readOnly
            readOnlyMessage="Custom fields are edited in the location form"
            value={loc.custom_fields?.length ?? 0}
            onSave={() => {}}
          >
            {loc.custom_fields?.length > 0 && (
              <span className="text-xs text-gray-500">{loc.custom_fields.length} field{loc.custom_fields.length > 1 ? 's' : ''}</span>
            )}
          </InlineEditCell>
        </td>
        <td className="px-4 py-3">
          <InlineEditCell
            type="select"
            value={loc.is_active ? 'true' : 'false'}
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
            saving={isSaving(loc.id, 'is_active')}
            onSave={(v) => patchField(loc.id, 'is_active', v === 'true')}
          >
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${loc.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {loc.is_active ? 'Active' : 'Inactive'}
            </span>
          </InlineEditCell>
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
              onClick={async () => { if (await askConfirm(`Delete "${loc.name}" and all sub-locations?`)) onDelete(loc.id) }}
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
          patchField={patchField}
          isSaving={isSaving}
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
  const [scope, setScope] = useState<BranchPlantSelection>({ kind: '' })
  const selectedBranchId = scope.kind === 'branch' ? scope.id : ''
  const selectedPlantId = scope.kind === 'plant' ? scope.id : ''

  // Plants belong to the business unit; branch filter uses the branch store id.
  const { data: plantsData } = usePlants(selectedStoreId || null)
  const plants = plantsData?.plants ?? []
  const selectedPlant = plants.find((p) => p.id === selectedPlantId)
  const effectiveStoreId = selectedBranchId || selectedStoreId || selectedPlant?.store_id || ''

  const { data, isLoading } = useStorageLocationTree(
    effectiveStoreId || null,
    selectedPlantId || null,
  )
  const createLocation = useCreateStorageLocation()
  const updateLocation = useUpdateStorageLocation()
  const deleteLocation = useDeleteStorageLocation()
  const { patchField: patchLocationField, cellKey, savingCellKey } = useInlineFieldPatch({
    mutateAsync: ({ id, data }) => updateLocation.mutateAsync({ id, data }),
  })
  const isSaving = (id: string, field: string) => savingCellKey === cellKey(id, field)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<StorageLocation | null>(null)
  const [formStoreId, setFormStoreId] = useState('')
  const [formScope, setFormScope] = useState<BranchPlantSelection>({ kind: '' })
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState(0)
  const [stockType, setStockType] = useState('unrestricted')
  const [storageCondition, setStorageCondition] = useState('')
  const [tempMinC, setTempMinC] = useState<string>('')
  const [tempMaxC, setTempMaxC] = useState<string>('')
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [search, setSearch] = useState('')

  const { data: formPlantsData } = usePlants(formStoreId || null)
  const formPlants = formPlantsData?.plants ?? []
  const formPlantId = formScope.kind === 'plant' ? formScope.id : ''
  const formPlant = formPlants.find((p) => p.id === formPlantId)

  const resetForm = () => {
    setShowForm(false)
    setEditing(null)
    setFormStoreId('')
    setFormScope({ kind: '' })
    setName('')
    setCode('')
    setDescription('')
    setParentId(null)
    setSortOrder(0)
    setStockType('unrestricted')
    setStorageCondition('')
    setTempMinC('')
    setTempMaxC('')
    setCustomFields([])
  }

  const openCreate = (pId?: string) => {
    setEditing(null)
    setName('')
    setCode('')
    setDescription('')
    setSortOrder(0)
    setStockType('unrestricted')
    setStorageCondition('')
    setTempMinC('')
    setTempMaxC('')
    setCustomFields([])
    setFormStoreId(selectedStoreId)
    // Mirror filter bar Branch / Plant choice into the create form.
    setFormScope(
      scope.kind
        ? { kind: scope.kind, id: scope.id }
        : { kind: 'plant', id: '' },
    )
    setParentId(pId || null)
    setShowForm(true)
  }

  const openEdit = (loc: StorageLocation) => {
    setEditing(loc)
    // Prefer plant scope when present; otherwise treat store_id as branch/BU scope.
    if (loc.plant_id) {
      setFormStoreId(selectedStoreId || loc.store_id)
      setFormScope({ kind: 'plant', id: loc.plant_id })
    } else {
      setFormStoreId(selectedStoreId || '')
      setFormScope({ kind: 'branch', id: loc.store_id })
    }
    setName(loc.name)
    setCode(loc.code || '')
    setDescription(loc.description || '')
    setParentId(loc.parent_id || null)
    setSortOrder(loc.sort_order || 0)
    setStockType(loc.stock_type || 'unrestricted')
    setStorageCondition((loc as any).storage_condition || '')
    setTempMinC((loc as any).temp_min_c != null ? String((loc as any).temp_min_c) : '')
    setTempMaxC((loc as any).temp_max_c != null ? String((loc as any).temp_max_c) : '')
    setCustomFields(loc.custom_fields || [])
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      code: code.trim() || undefined,
      description: description.trim() || undefined,
      parent_id: parentId || undefined,
      sort_order: sortOrder,
      stock_type: stockType,
      storage_condition: storageCondition || null,
      temp_min_c: tempMinC !== '' ? Number(tempMinC) : null,
      temp_max_c: tempMaxC !== '' ? Number(tempMaxC) : null,
      custom_fields: customFields.filter(f => f.name.trim()),
    }

    if (editing) {
      updateLocation.mutate({ id: editing.id, data: payload }, { onSuccess: resetForm })
      return
    }

    if (!formScope.kind || !formScope.id) {
      toast.error('Choose Branch or Plant, then select a value')
      return
    }
    if (!formStoreId) {
      toast.error('Select a business unit first')
      return
    }

    if (formScope.kind === 'plant') {
      const createStoreId = formPlant?.store_id || formStoreId
      if (formPlant && formPlant.store_id !== formStoreId && formPlant.store_id !== createStoreId) {
        toast.error('Selected plant does not belong to this business unit')
        return
      }
      createLocation.mutate(
        { ...payload, store_id: createStoreId, plant_id: formScope.id },
        { onSuccess: resetForm },
      )
      return
    }

    // Branch: location belongs to the branch store; no plant required.
    createLocation.mutate(
      { ...payload, store_id: formScope.id, plant_id: null },
      { onSuccess: resetForm },
    )
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
  const canCreate = stores.length > 0
  const filterHint = selectedPlantId
    ? `Locations for plant ${selectedPlant?.name ?? 'selected'}${selectedStore ? ` · ${selectedStore.name}` : ''}`
    : selectedBranchId
      ? `Filtered by branch${selectedStore ? ` under ${selectedStore.name}` : ''}`
      : effectiveStoreId
        ? `All branches / plants in ${selectedStore?.name ?? 'this unit'}`
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
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-[220px] space-y-1.5">
              <Label className="text-xs text-muted-foreground">Business Unit</Label>
              {storesLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              ) : stores.length === 0 ? (
                <p className="text-sm text-gray-400">No business units yet. Create one under Finance → Business Units.</p>
              ) : (
                <BusinessUnitSelect
                  value={selectedStoreId}
                  onChange={(v) => { setSelectedStoreId(v); setScope({ kind: '' }) }}
                  allowAll
                  autoSelectDefault={false}
                />
              )}
            </div>
            {stores.length > 0 && (
              <BranchPlantSelect
                businessUnitId={selectedStoreId || null}
                value={scope}
                onChange={setScope}
                allowAll
              />
            )}
            {stores.length > 0 && (
              <p className="text-xs text-gray-400 pb-2">{filterHint}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b space-y-1">
            <div className="relative max-w-sm">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search locations…"
                className="pl-9 h-9"
              />
            </div>
            <p className="text-xs text-gray-400">{INLINE_EDIT_HINT}</p>
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
                      patchField={patchLocationField}
                      isSaving={isSaving}
                    />
                  ))
                )}
              </tbody>
            </ResizableTable>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <ModalOverlay onClose={resetForm} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-lg max-h-[calc(100dvh-1.5rem)] !rounded-lg">
            <ModalHeader
              title={editing ? 'Edit Storage Location' : 'New Storage Location'}
              onClose={resetForm}
              className="border-0 px-4 py-2.5 [&>div>h2]:text-base"
            />
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <ModalBody className="space-y-2.5 overflow-y-auto px-4 pb-3 pt-0">
                {!editing && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Business Unit *</Label>
                      <BusinessUnitSelect
                        value={formStoreId}
                        onChange={(id) => {
                          setFormStoreId(id)
                          setFormScope({ kind: 'plant', id: '' })
                          setParentId(null)
                        }}
                        autoSelectDefault={false}
                      />
                    </div>
                    <BranchPlantSelect
                      businessUnitId={formStoreId || null}
                      value={formScope}
                      onChange={(next) => {
                        setFormScope(next)
                        setParentId(null)
                      }}
                      allowAll={false}
                    />
                    {formScope.kind === 'plant' && formStoreId && formPlants.length === 0 && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
                        No plants for this business unit yet. Create one under Inventory → Plants first.
                      </p>
                    )}
                  </>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Name *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Warehouse, Aisle A, Shelf 3" required />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs">Code</Label>
                    <Input value={code} onChange={e => setCode(e.target.value)} placeholder="WH-01" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sort order</Label>
                    <Input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Stock type (pharma)</Label>
                  <Select
                    value={stockType}
                    onChange={setStockType}
                    options={[
                      { value: 'unrestricted', label: 'Unrestricted' },
                      { value: 'quarantine', label: 'Quarantine' },
                      { value: 'rejected', label: 'Rejected' },
                      { value: 'returns', label: 'Returns' },
                    ]}
                    aria-label="Stock type"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Storage condition (GDP)</Label>
                  <Select
                    value={storageCondition}
                    onChange={setStorageCondition}
                    options={[
                      { value: '', label: '— None —' },
                      { value: 'ambient', label: 'Ambient' },
                      { value: 'controlled_room', label: 'CRT (controlled room temp)' },
                      { value: 'refrigerated', label: 'Refrigerated (2–8 °C)' },
                      { value: 'frozen', label: 'Frozen' },
                    ]}
                    aria-label="Storage condition"
                  />
                </div>
                {storageCondition && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs">Min temp (°C)</Label>
                      <Input
                        type="number"
                        value={tempMinC}
                        onChange={e => setTempMinC(e.target.value)}
                        placeholder="e.g. 2"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max temp (°C)</Label>
                      <Input
                        type="number"
                        value={tempMaxC}
                        onChange={e => setTempMaxC(e.target.value)}
                        placeholder="e.g. 8"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Parent location</Label>
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
              </ModalBody>
              <ModalFooter className="px-4 py-2.5">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={createLocation.isPending || updateLocation.isPending}>
                  {(createLocation.isPending || updateLocation.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editing ? 'Save Changes' : 'Create Location'}
                </Button>
              </ModalFooter>
            </form>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  )
}
