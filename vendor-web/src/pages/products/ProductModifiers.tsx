import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2, GripVertical } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import type { ModifierGroup, ModifierOption } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

interface Props {
  productId: string
}

export function ProductModifiers({ productId }: Props) {
  const qc = useQueryClient()
  const qKey = ['product-modifiers', productId]

  const { data, isLoading } = useQuery({
    queryKey: qKey,
    queryFn: () => vendorApi.productListModifiers(productId),
  })

  const groups = data?.items ?? []

  const createGroup = useMutation({
    mutationFn: (name: string) =>
      vendorApi.productCreateModifierGroup(productId, { name, selection_type: 'single', is_required: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); toast.success('Group added') },
    onError: () => toast.error('Could not add group'),
  })

  const deleteGroup = useMutation({
    mutationFn: (groupId: string) => vendorApi.productDeleteModifierGroup(productId, groupId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); toast.success('Group removed') },
    onError: () => toast.error('Could not remove group'),
  })

  const [newGroupName, setNewGroupName] = useState('')

  if (isLoading) return <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Add modifier groups (e.g. "Spice Level", "Add-ons") with options. These appear as a picker when this product is added to a POS transaction.
      </p>

      {groups.map(group => (
        <ModifierGroupRow
          key={group.id}
          productId={productId}
          group={group}
          onDelete={() => deleteGroup.mutate(group.id)}
        />
      ))}

      {!groups.length && (
        <p className="text-sm text-gray-400 py-2">No modifier groups yet.</p>
      )}

      {/* Add new group */}
      <div className="flex gap-2 items-center pt-2">
        <Input
          value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)}
          placeholder="New group name (e.g. Add-ons, Spice Level)"
          className="h-9 text-sm max-w-xs"
          onKeyDown={e => {
            if (e.key === 'Enter' && newGroupName.trim()) {
              createGroup.mutate(newGroupName.trim())
              setNewGroupName('')
            }
          }}
        />
        <Button
          size="sm"
          disabled={!newGroupName.trim() || createGroup.isPending}
          onClick={() => { createGroup.mutate(newGroupName.trim()); setNewGroupName('') }}
        >
          {createGroup.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add group</>}
        </Button>
      </div>
    </div>
  )
}


function ModifierGroupRow({ productId, group, onDelete }: { productId: string; group: ModifierGroup; onDelete: () => void }) {
  const qc = useQueryClient()
  const qKey = ['product-modifiers', productId]
  const [open, setOpen] = useState(true)
  const [newOptionName, setNewOptionName] = useState('')
  const [newOptionPrice, setNewOptionPrice] = useState('')

  const updateGroup = useMutation({
    mutationFn: (body: Partial<ModifierGroup>) => vendorApi.productUpdateModifierGroup(productId, group.id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  })

  const createOption = useMutation({
    mutationFn: () =>
      vendorApi.productCreateModifierOption(productId, group.id, {
        name: newOptionName.trim(),
        price_delta: parseFloat(newOptionPrice) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qKey })
      setNewOptionName('')
      setNewOptionPrice('')
      toast.success('Option added')
    },
    onError: () => toast.error('Could not add option'),
  })

  const deleteOption = useMutation({
    mutationFn: (optionId: string) => vendorApi.productDeleteModifierOption(productId, group.id, optionId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); toast.success('Option removed') },
    onError: () => toast.error('Could not remove option'),
  })

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b">
        <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
        <button type="button" onClick={() => setOpen(o => !o)} className="flex-1 flex items-center gap-2 text-sm font-semibold text-gray-800 text-left">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          {group.name}
        </button>
        {/* selection_type toggle */}
        <select
          className="text-xs border rounded px-2 py-1 bg-white"
          value={group.selection_type}
          onChange={e => updateGroup.mutate({ selection_type: e.target.value as 'single' | 'multiple' })}
        >
          <option value="single">Pick one</option>
          <option value="multiple">Pick many</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={group.is_required}
            onChange={e => updateGroup.mutate({ is_required: e.target.checked })}
            className="accent-primary"
          />
          Required
        </label>
        <button type="button" onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div className="p-3 space-y-2">
          {(group.options ?? []).map(opt => (
            <OptionRow
              key={opt.id}
              productId={productId}
              groupId={group.id}
              option={opt}
              onDelete={() => deleteOption.mutate(opt.id)}
            />
          ))}
          {!group.options?.length && (
            <p className="text-xs text-gray-400">No options yet.</p>
          )}

          {/* Add option */}
          <div className="flex gap-2 items-center pt-1 border-t">
            <Input
              value={newOptionName}
              onChange={e => setNewOptionName(e.target.value)}
              placeholder="Option name"
              className="h-8 text-xs flex-1"
            />
            <Input
              value={newOptionPrice}
              onChange={e => setNewOptionPrice(e.target.value)}
              placeholder="+₹ price"
              type="number"
              step="0.01"
              className="h-8 text-xs w-24"
            />
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!newOptionName.trim() || createOption.isPending}
              onClick={() => createOption.mutate()}
            >
              {createOption.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}


function OptionRow({ productId, groupId, option, onDelete }: { productId: string; groupId: string; option: ModifierOption; onDelete: () => void }) {
  const qc = useQueryClient()
  const qKey = ['product-modifiers', productId]
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(option.name)
  const [priceDelta, setPriceDelta] = useState(String(option.price_delta))

  const updateOption = useMutation({
    mutationFn: () => vendorApi.productUpdateModifierOption(productId, groupId, option.id, {
      name: name.trim(),
      price_delta: parseFloat(priceDelta) || 0,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); setEditing(false) },
    onError: () => toast.error('Could not update option'),
  })

  return (
    <div className="flex items-center gap-2 text-sm py-1">
      <GripVertical className="w-3 h-3 text-gray-300 shrink-0" />
      {editing ? (
        <>
          <Input value={name} onChange={e => setName(e.target.value)} className="h-7 text-xs flex-1" />
          <Input value={priceDelta} onChange={e => setPriceDelta(e.target.value)} type="number" step="0.01" className="h-7 text-xs w-20" />
          <Button size="sm" className="h-7 text-xs" disabled={updateOption.isPending} onClick={() => updateOption.mutate()}>
            {updateOption.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
          </Button>
          <button type="button" className="text-xs text-gray-400" onClick={() => setEditing(false)}>Cancel</button>
        </>
      ) : (
        <>
          <span className="flex-1 text-gray-800">{option.name}</span>
          <span className={cn('text-xs', option.price_delta > 0 ? 'text-emerald-600' : 'text-gray-400')}>
            {option.price_delta > 0 ? `+${formatCurrency(option.price_delta)}` : option.price_delta < 0 ? formatCurrency(option.price_delta) : 'free'}
          </span>
          <button type="button" className="text-xs text-gray-400 hover:text-primary" onClick={() => setEditing(true)}>Edit</button>
          <button type="button" className="p-0.5 text-gray-400 hover:text-red-500" onClick={onDelete}>
            <Trash2 className="w-3 h-3" />
          </button>
        </>
      )}
    </div>
  )
}
