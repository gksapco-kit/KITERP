import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalPanel,
} from '@/components/ui/Modal'
import {
  useStores,
  usePlants,
  useCreatePlant,
  useUpdatePlant,
  useDeletePlant,
} from '@/hooks/useVendor'
import {
  Loader2, Plus, Pencil, Trash2, Factory, Store,
} from 'lucide-react'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import type { Plant } from '@/types'

import { askConfirm } from '@/components/common/ConfirmProvider'
export default function PlantsPage() {
  const { data: storesData, isLoading: storesLoading } = useStores()
  const stores = storesData?.stores ?? []
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) {
      setSelectedStoreId(stores.find(s => s.is_default)?.id ?? stores[0].id)
    }
  }, [stores, selectedStoreId])

  const { data, isLoading } = usePlants(selectedStoreId)
  const plants = data?.plants ?? []

  const createPlant = useCreatePlant()
  const updatePlant = useUpdatePlant()
  const deletePlant = useDeletePlant()
  const { savingCellKey, cellKey, patchField: patchPlantField } = useInlineFieldPatch({
    mutateAsync: ({ id, data }) => updatePlant.mutateAsync({ id, data }),
  })
  const isSaving = (id: string, field: string) => savingCellKey === cellKey(id, field)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Plant | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState(0)

  const resetForm = () => {
    setShowForm(false)
    setEditing(null)
    setName('')
    setCode('')
    setDescription('')
    setSortOrder(0)
  }

  const openCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const openEdit = (plant: Plant) => {
    setEditing(plant)
    setName(plant.name)
    setCode(plant.code || '')
    setDescription(plant.description || '')
    setSortOrder(plant.sort_order || 0)
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !selectedStoreId) return

    const payload: Record<string, unknown> = {
      name: name.trim(),
      code: code.trim() || undefined,
      description: description.trim() || undefined,
      sort_order: sortOrder,
    }

    if (editing) {
      updatePlant.mutate({ id: editing.id, data: payload }, { onSuccess: resetForm })
    } else {
      createPlant.mutate({ ...payload, store_id: selectedStoreId }, { onSuccess: resetForm })
    }
  }

  const selectedStore = stores.find(s => s.id === selectedStoreId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Factory className="w-7 h-7 text-indigo-600" />
            Plants
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Define manufacturing or distribution plants per business unit. Storage locations are organised within each plant.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!selectedStoreId} className="gap-2">
          <Plus className="w-4 h-4" /> Add Plant
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[220px] space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" /> Business Unit
              </Label>
              {storesLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              ) : stores.length === 0 ? (
                <p className="text-sm text-gray-400">No business units yet.</p>
              ) : (
                <Select
                  value={selectedStoreId || ''}
                  onChange={setSelectedStoreId}
                  options={stores.map(s => ({
                    value: s.id,
                    label: `${s.name}${s.code ? ` (${s.code})` : ''}`,
                  }))}
                  aria-label="Store"
                />
              )}
            </div>
            {selectedStore && (
              <p className="text-xs text-gray-400 pb-2">
                Plants below belong to <span className="font-medium text-gray-600">{selectedStore.name}</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {!selectedStoreId ? (
            <p className="text-sm text-gray-400 text-center py-12">Select a business unit to manage plants.</p>
          ) : isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
          ) : (
            <ResizableTable tableId="plants" defaultWidths={[280, 100, 200, 90, 120]}>
              <thead>
                <tr className="border-b bg-gray-50/80 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3"><TableColumnLabel>Plant</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Code</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Description</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {plants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                      No plants yet. Add a plant (e.g. Main Plant, North Warehouse, Assembly Unit).
                    </td>
                  </tr>
                ) : (
                  plants.map(plant => (
                    <tr key={plant.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Factory className="w-4 h-4 text-indigo-500 shrink-0" />
                          <InlineEditCell
                            value={plant.name}
                            saving={isSaving(plant.id, 'name')}
                            onSave={(v) => patchPlantField(plant.id, 'name', String(v).trim())}
                            className="text-sm font-medium"
                          >
                            {plant.name}
                          </InlineEditCell>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <InlineEditCell
                          value={plant.code || ''}
                          saving={isSaving(plant.id, 'code')}
                          onSave={(v) => patchPlantField(plant.id, 'code', String(v).trim())}
                        >
                          {plant.code || '—'}
                        </InlineEditCell>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <InlineEditCell
                          value={plant.description || ''}
                          saving={isSaving(plant.id, 'description')}
                          onSave={(v) => patchPlantField(plant.id, 'description', String(v).trim())}
                        >
                          {plant.description || '—'}
                        </InlineEditCell>
                      </td>
                      <td className="px-4 py-3">
                        <InlineEditCell
                          type="select"
                          value={plant.is_active ? 'true' : 'false'}
                          options={[
                            { value: 'true', label: 'Active' },
                            { value: 'false', label: 'Inactive' },
                          ]}
                          saving={isSaving(plant.id, 'is_active')}
                          onSave={(v) => patchPlantField(plant.id, 'is_active', v === 'true')}
                        >
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${plant.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {plant.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </InlineEditCell>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(plant)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500"
                            onClick={async () => {
                              if (await askConfirm(`Delete plant "${plant.name}"? All storage locations inside this plant will also be deleted.`))
                                deletePlant.mutate(plant.id)
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </ResizableTable>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <ModalOverlay onClose={resetForm} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-md max-h-[calc(100dvh-1.5rem)] !rounded-lg">
            <ModalHeader
              title={editing ? 'Edit Plant' : 'New Plant'}
              onClose={resetForm}
            />
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <ModalBody className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Plant, Assembly Unit, North Warehouse" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Code</Label>
                    <Input value={code} onChange={e => setCode(e.target.value)} placeholder="PLT-01" />
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
              </ModalBody>
              <ModalFooter>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={createPlant.isPending || updatePlant.isPending}>
                  {(createPlant.isPending || updatePlant.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editing ? 'Save Changes' : 'Create Plant'}
                </Button>
              </ModalFooter>
            </form>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  )
}
