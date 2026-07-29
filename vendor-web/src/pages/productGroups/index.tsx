import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  ModalOverlay, ModalPanel, ModalHeader, ModalBody, ModalFooter,
} from '@/components/ui/Modal'
import {
  useProductGroups, useProductGroup, useCreateProductGroup, useUpdateProductGroup,
  useDeleteProductGroup, useAddProductGroupItems, useRemoveProductGroupItem,
  useUpdateProductGroupItem, useProducts, useServices, useProductGroupFlatOptions,
} from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import { askConfirm } from '@/components/common/ConfirmProvider'
import { formatCurrency, mediaUrl } from '@/lib/utils'
import type { ProductGroup, ProductGroupItem } from '@/types'
import {
  Plus, Search, Pencil, Trash2, Layers, Package, Wrench, X, Boxes,
  Loader2, ChevronRight, ChevronDown, Folder,
} from 'lucide-react'

export default function ProductGroupsPage() {
  const location = useLocation()

  const [search, setSearch] = useState('')
  const [formGroup, setFormGroup] = useState<ProductGroup | 'new' | null>(null)
  const [manageItemsId, setManageItemsId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Support opening the "new group" modal from the detail page's "New Sub-group" button
  const locationState = location.state as { presetParentId?: string; presetParentName?: string } | null
  useEffect(() => {
    if (locationState?.presetParentId) {
      setFormGroup('new')
      window.history.replaceState({}, '')
    }
  }, [locationState])

  const { data, isLoading } = useProductGroups({
    tree: true,
    search: search || undefined,
  })
  const deleteGroup = useDeleteProductGroup()
  const roots = data?.groups ?? []

  const isExpanded = (id: string) => (search.trim() ? true : expandedIds.has(id))

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (search.trim()) return // all expanded while searching
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = async (e: React.MouseEvent, group: ProductGroup) => {
    e.stopPropagation()
    const childCount = group.children?.length ?? 0
    if (childCount > 0) {
      await askConfirm({
        title: 'Cannot delete',
        description: `"${group.name}" has ${childCount} sub-group${childCount === 1 ? '' : 's'}. Move or delete them first.`,
      })
      return
    }
    const ok = await askConfirm({
      title: `Delete "${group.name}"?`,
      description: `This will remove the group and its ${group.item_count} item${group.item_count === 1 ? '' : 's'}. Products and services themselves are not deleted.`,
    })
    if (!ok) return
    deleteGroup.mutate(group.id)
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> Product Groups
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Hierarchical groups. Expand a node to see sub-groups and products/services.
          </p>
        </div>
        <Button onClick={() => setFormGroup('new')}>
          <Plus className="w-4 h-4" /> New Group
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search groups by name or code..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : roots.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-foreground">No product groups yet</p>
            <p className="text-sm mt-1">Create a group to organize products and services in a hierarchy.</p>
            <Button className="mt-4" onClick={() => setFormGroup('new')}>
              <Plus className="w-4 h-4" /> Create your first group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden divide-y divide-border bg-card">
          {roots.map((g) => (
            <GroupTreeNode
              key={g.id}
              group={g}
              level={0}
              isExpanded={isExpanded}
              onToggle={toggleExpand}
              onEdit={(grp) => setFormGroup(grp)}
              onManageItems={(id) => setManageItemsId(id)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {formGroup && (
        <GroupFormModal
          group={formGroup === 'new' ? null : formGroup}
          presetParentId={formGroup === 'new' ? locationState?.presetParentId : undefined}
          onClose={() => setFormGroup(null)}
        />
      )}

      {manageItemsId && (
        <ManageItemsSheet groupId={manageItemsId} onClose={() => setManageItemsId(null)} />
      )}
    </div>
  )
}

// ── Slim expandable tree row ─────────────────────────────────────────
function GroupTreeNode({
  group,
  level,
  isExpanded,
  onToggle,
  onEdit,
  onManageItems,
  onDelete,
}: {
  group: ProductGroup
  level: number
  isExpanded: (id: string) => boolean
  onToggle: (id: string, e?: React.MouseEvent) => void
  onEdit: (g: ProductGroup) => void
  onManageItems: (id: string) => void
  onDelete: (e: React.MouseEvent, g: ProductGroup) => void
}) {
  const children = group.children ?? []
  const hasChildren = children.length > 0
  const hasItems = (group.item_count ?? 0) > 0
  const canExpand = hasChildren || hasItems
  const expanded = isExpanded(group.id)
  const childCount = children.length
  const itemLabel = `${group.item_count} item${group.item_count === 1 ? '' : 's'}`

  // Lazy-load products/services only when this node is expanded and has members
  const { data: detail, isLoading: loadingItems } = useProductGroup(group.id, {
    enabled: expanded && hasItems,
  })
  const items = detail?.items ?? []

  return (
    <>
      <div
        className={`group flex items-center gap-1.5 h-10 px-2 hover:bg-muted/50 transition-colors ${
          canExpand ? 'cursor-pointer' : 'cursor-default'
        } ${!group.is_active ? 'opacity-55' : ''}`}
        style={{ paddingLeft: `${8 + level * 20}px` }}
        onClick={() => { if (canExpand) onToggle(group.id) }}
      >
        {/* Expand / collapse */}
        {canExpand ? (
          <button
            type="button"
            onClick={(e) => onToggle(group.id, e)}
            className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:bg-muted shrink-0"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Icon */}
        {group.image_url ? (
          <img src={mediaUrl(group.image_url)} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
        ) : (
          <Folder className={`w-4 h-4 shrink-0 ${level === 0 ? 'text-primary' : 'text-amber-600 dark:text-amber-400'}`} />
        )}

        {/* Name + meta */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{group.name}</span>
          {group.code && (
            <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              {group.code}
            </span>
          )}
          {!group.is_active && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">Inactive</Badge>
          )}
          <span className="text-xs text-muted-foreground truncate hidden sm:inline">
            {itemLabel}
            {childCount > 0 && ` · ${childCount} sub`}
          </span>
        </div>

        {/* Actions — appear on hover */}
        <div
          className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Button size="icon-sm" variant="ghost" className="h-7 w-7" title="Manage items" onClick={() => onManageItems(group.id)}>
            <Boxes className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" className="h-7 w-7" title="Edit" onClick={() => onEdit(group)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" className="h-7 w-7" title="Delete" onClick={(e) => onDelete(e, group)}>
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </Button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Direct products/services first, then sub-groups */}
          {hasItems && loadingItems && (
            <div
              className="flex items-center gap-2 h-9 text-xs text-muted-foreground"
              style={{ paddingLeft: `${28 + (level + 1) * 20}px` }}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading items…
            </div>
          )}

          {hasItems && !loadingItems && items.map((item) => (
            <TreeItemRow key={item.id} item={item} level={level + 1} />
          ))}

          {hasItems && !loadingItems && items.length === 0 && !hasChildren && (
            <div
              className="flex items-center h-9 text-xs text-muted-foreground"
              style={{ paddingLeft: `${28 + (level + 1) * 20}px` }}
            >
              No products or services in this group.
            </div>
          )}

          {hasChildren && children.map((child) => (
            <GroupTreeNode
              key={child.id}
              group={child}
              level={level + 1}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onEdit={onEdit}
              onManageItems={onManageItems}
              onDelete={onDelete}
            />
          ))}
        </>
      )}
    </>
  )
}

function TreeItemRow({ item, level }: { item: ProductGroupItem; level: number }) {
  return (
    <div
      className="flex items-center gap-1.5 h-9 px-2 text-muted-foreground"
      style={{ paddingLeft: `${8 + level * 20}px` }}
    >
      <span className="w-5 shrink-0" />
      {item.image_url ? (
        <img src={mediaUrl(item.image_url)} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
      ) : (
        <span className="w-5 h-5 flex items-center justify-center shrink-0">
          {item.item_type === 'product'
            ? <Package className="w-3.5 h-3.5" />
            : <Wrench className="w-3.5 h-3.5" />}
        </span>
      )}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm text-foreground truncate">{item.name}</span>
        {item.sku && (
          <span className="font-mono text-[11px] text-muted-foreground shrink-0 hidden sm:inline">{item.sku}</span>
        )}
        <span className="text-xs text-muted-foreground capitalize shrink-0 hidden sm:inline">{item.item_type}</span>
        <span className="text-xs text-muted-foreground shrink-0 ml-auto tabular-nums">
          {formatCurrency(item.price)}
        </span>
      </div>
    </div>
  )
}

// ── Create / Edit modal ──────────────────────────────────────────────
function GroupFormModal({
  group,
  presetParentId,
  onClose,
}: {
  group: ProductGroup | null
  presetParentId?: string
  onClose: () => void
}) {
  const isEdit = !!group
  const createGroup = useCreateProductGroup()
  const updateGroup = useUpdateProductGroup()
  const { data: optionsData } = useProductGroupFlatOptions(group?.id)
  const options = optionsData?.options ?? []

  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [parentId, setParentId] = useState(group?.parent_id ?? presetParentId ?? '')
  const [isActive, setIsActive] = useState(group?.is_active ?? true)

  const saving = createGroup.isPending || updateGroup.isPending

  const handleSave = async () => {
    if (!name.trim()) return
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      // Preserve existing business code on edit; new groups have none
      code: isEdit ? (group?.code ?? null) : null,
      parent_id: parentId || null,
      group_types: ['general'],
      is_active: isActive,
    }
    if (isEdit && group) {
      await updateGroup.mutateAsync({ id: group.id, data: payload })
    } else {
      await createGroup.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className="max-w-lg w-full">
        <ModalHeader title={isEdit ? 'Edit Product Group' : 'New Product Group'} onClose={onClose} />
        <ModalBody className="space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-foreground">Name</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Active</span>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Diwali Combo, Winter Wear"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">
              Parent Group <span className="text-muted-foreground font-normal text-xs">(optional — leave blank for root)</span>
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">— Root level —</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1" />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save Changes' : 'Create Group'}
          </Button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}

// ── Manage items sheet ───────────────────────────────────────────────
function ManageItemsSheet({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: group, isLoading } = useProductGroup(groupId)
  const addItems = useAddProductGroupItems()
  const removeItem = useRemoveProductGroupItem()
  const updateItem = useUpdateProductGroupItem()

  const [tab, setTab] = useState<'products' | 'services'>('products')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [memberTab, setMemberTab] = useState<'products' | 'services'>('products')
  const [memberQuery, setMemberQuery] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
  const [selectedAddIds, setSelectedAddIds] = useState<Set<string>>(new Set())
  const [bulkRemoving, setBulkRemoving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  // Drop stale selections when members change
  useEffect(() => {
    const valid = new Set((group?.items ?? []).map((i) => i.id))
    setSelectedMemberIds((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [group?.items])

  const { data: productResults, isFetching: loadingProducts } = useProducts(
    tab === 'products' ? { search: debouncedQuery || undefined, size: 20, page: 1 } : undefined,
  )
  const { data: serviceResults, isFetching: loadingServices } = useServices(
    tab === 'services' ? { search: debouncedQuery || undefined, size: 20, page: 1 } : undefined,
  )

  const existingIds = useMemo(
    () => new Set((group?.items ?? []).map((i) => `${i.item_type}:${i.item_id}`)),
    [group?.items],
  )

  const isBundle = true
  const results = tab === 'products' ? (productResults?.items ?? []) : (serviceResults?.items ?? [])
  const loadingResults = tab === 'products' ? loadingProducts : loadingServices
  const members = group?.items ?? []
  const memberType = memberTab === 'products' ? 'product' : 'service'
  const memberSearch = memberQuery.trim().toLowerCase()
  const filteredMembers = members.filter((m) => {
    if (m.item_type !== memberType) return false
    if (!memberSearch) return true
    return (
      m.name.toLowerCase().includes(memberSearch)
      || (m.sku ?? '').toLowerCase().includes(memberSearch)
    )
  })
  const addableResults = results.filter((r) => !existingIds.has(`${tab === 'products' ? 'product' : 'service'}:${r.id}`))

  const allMembersSelected = filteredMembers.length > 0 && filteredMembers.every((m) => selectedMemberIds.has(m.id))
  const allAddableSelected = addableResults.length > 0 && addableResults.every((r) => selectedAddIds.has(r.id))

  const toggleMember = (id: string, checked: boolean) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleAdd = (id: string, checked: boolean) => {
    setSelectedAddIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleAllMembers = (checked: boolean) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev)
      if (checked) filteredMembers.forEach((m) => next.add(m.id))
      else filteredMembers.forEach((m) => next.delete(m.id))
      return next
    })
  }

  const toggleAllAddable = (checked: boolean) => {
    setSelectedAddIds(checked ? new Set(addableResults.map((r) => r.id)) : new Set())
  }

  const handleAdd = (itemId: string) => {
    addItems.mutate(
      { groupId, items: [{ item_type: tab === 'products' ? 'product' : 'service', item_id: itemId, quantity: 1 }] },
      { onSuccess: () => setSelectedAddIds((prev) => { const n = new Set(prev); n.delete(itemId); return n }) },
    )
  }

  const handleAddSelected = () => {
    if (selectedAddIds.size === 0) return
    const itemType = tab === 'products' ? 'product' : 'service'
    const payload = [...selectedAddIds]
      .filter((id) => !existingIds.has(`${itemType}:${id}`))
      .map((item_id) => ({ item_type: itemType as 'product' | 'service', item_id, quantity: 1 }))
    if (payload.length === 0) return
    addItems.mutate(
      { groupId, items: payload },
      { onSuccess: () => setSelectedAddIds(new Set()) },
    )
  }

  const handleRemove = async (itemId: string, name: string) => {
    const ok = await askConfirm({ title: `Remove "${name}" from group?` })
    if (!ok) return
    removeItem.mutate({ groupId, itemId })
  }

  const handleRemoveSelected = async () => {
    const count = selectedMemberIds.size
    if (count === 0) return
    const ok = await askConfirm({
      title: `Remove ${count} item${count === 1 ? '' : 's'} from group?`,
      description: 'Products and services themselves are not deleted.',
    })
    if (!ok) return
    setBulkRemoving(true)
    try {
      await Promise.all([...selectedMemberIds].map((itemId) => vendorApi.removeProductGroupItem(groupId, itemId)))
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['vendor', 'product-groups'] }),
        qc.invalidateQueries({ queryKey: ['vendor', 'product-group', groupId] }),
      ])
      toast.success(`Removed ${count} item${count === 1 ? '' : 's'} from group`)
      setSelectedMemberIds(new Set())
    } catch {
      toast.error('Could not remove some items')
    } finally {
      setBulkRemoving(false)
    }
  }

  const switchTab = (next: 'products' | 'services') => {
    setTab(next)
    setSelectedAddIds(new Set())
    setQuery('')
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="sm:max-w-4xl w-full flex flex-col">
        <SheetHeader>
          <SheetTitle>{group ? `Manage Items — ${group.name}` : 'Manage Items'}</SheetTitle>
          <SheetDescription>Add or remove products and services that belong to this group. Select multiple to act in bulk.</SheetDescription>
        </SheetHeader>

        {isLoading || !group ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 -mx-1 px-1">
            {/* Current items — left column */}
            <div className="min-h-0 flex flex-col border border-border rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                <p className="text-sm font-medium text-foreground">Current items ({members.length})</p>
                {selectedMemberIds.size > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={bulkRemoving}
                    onClick={handleRemoveSelected}
                  >
                    {bulkRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Remove ({selectedMemberIds.size})
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mb-2 shrink-0">
                <Button size="sm" variant={memberTab === 'products' ? 'default' : 'outline'} onClick={() => setMemberTab('products')}>
                  <Package className="w-3.5 h-3.5" /> Products
                </Button>
                <Button size="sm" variant={memberTab === 'services' ? 'default' : 'outline'} onClick={() => setMemberTab('services')}>
                  <Wrench className="w-3.5 h-3.5" /> Services
                </Button>
                <div className="relative flex-1 min-w-[8rem]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder={`Search ${memberTab}...`}
                    className="pl-9 h-8"
                  />
                </div>
              </div>
              {members.length === 0 ? (
                <p className="flex-1 text-sm text-muted-foreground border border-dashed border-border rounded-md p-4 text-center flex items-center justify-center">
                  No items yet — add from the right.
                </p>
              ) : filteredMembers.length === 0 ? (
                <p className="flex-1 text-sm text-muted-foreground text-center flex items-center justify-center">
                  No {memberTab} match.
                </p>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
                  <label className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground cursor-pointer select-none sticky top-0 bg-card z-10">
                    <Checkbox
                      checked={allMembersSelected}
                      onCheckedChange={(checked) => toggleAllMembers(!!checked)}
                      aria-label="Select all items"
                    />
                    Select all
                  </label>
                  {filteredMembers.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-2">
                      <Checkbox
                        checked={selectedMemberIds.has(item.id)}
                        onCheckedChange={(checked) => toggleMember(item.id, !!checked)}
                        aria-label={`Select ${item.name}`}
                      />
                      {item.image_url ? (
                        <img src={mediaUrl(item.image_url)} alt={item.name} className="w-7 h-7 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded bg-muted flex items-center justify-center shrink-0">
                          {item.item_type === 'product' ? <Package className="w-3.5 h-3.5 text-muted-foreground" /> : <Wrench className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.sku ? `${item.sku} · ` : ''}{formatCurrency(item.price)}</p>
                      </div>
                      {isBundle && (
                        <Input
                          type="number"
                          min={0.001}
                          step="0.001"
                          value={item.quantity}
                          onChange={(e) => updateItem.mutate({ groupId, itemId: item.id, data: { quantity: Number(e.target.value) || 1 } })}
                          className="w-14 h-7 text-sm"
                        />
                      )}
                      <Button size="icon-sm" variant="ghost" onClick={() => handleRemove(item.id, item.name)}>
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add items — right column */}
            <div className="min-h-0 flex flex-col border border-border rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                <p className="text-sm font-medium text-foreground">Add items</p>
                {selectedAddIds.size > 0 && (
                  <Button
                    size="sm"
                    disabled={addItems.isPending}
                    onClick={handleAddSelected}
                  >
                    {addItems.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add ({selectedAddIds.size})
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mb-2 shrink-0">
                <Button size="sm" variant={tab === 'products' ? 'default' : 'outline'} onClick={() => switchTab('products')}>
                  <Package className="w-3.5 h-3.5" /> Products
                </Button>
                <Button size="sm" variant={tab === 'services' ? 'default' : 'outline'} onClick={() => switchTab('services')}>
                  <Wrench className="w-3.5 h-3.5" /> Services
                </Button>
                <div className="relative flex-1 min-w-[8rem]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${tab}...`} className="pl-9 h-8" />
                </div>
              </div>

              {loadingResults ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : results.length === 0 ? (
                <p className="flex-1 text-sm text-muted-foreground text-center flex items-center justify-center">No {tab} found.</p>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
                  {addableResults.length > 0 && (
                    <label className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground cursor-pointer select-none sticky top-0 bg-card z-10">
                      <Checkbox
                        checked={allAddableSelected}
                        onCheckedChange={(checked) => toggleAllAddable(!!checked)}
                        aria-label="Select all addable"
                      />
                      Select all available
                    </label>
                  )}
                  {results.map((r) => {
                    const key = `${tab === 'products' ? 'product' : 'service'}:${r.id}`
                    const already = existingIds.has(key)
                    return (
                      <div key={r.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-2">
                        <Checkbox
                          checked={already ? false : selectedAddIds.has(r.id)}
                          disabled={already}
                          onCheckedChange={(checked) => toggleAdd(r.id, !!checked)}
                          aria-label={`Select ${r.name}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency((r as { price?: number }).price ?? 0)}</p>
                        </div>
                        <Button size="sm" variant={already ? 'secondary' : 'outline'} disabled={already || addItems.isPending} onClick={() => handleAdd(r.id)}>
                          {already ? 'Added' : <><Plus className="w-3.5 h-3.5" /> Add</>}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
