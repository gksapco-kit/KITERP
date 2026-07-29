import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  useProductGroup, useDeleteProductGroup, useUpdateProductGroup, useProductGroupFlatOptions,
  useAddProductGroupItems, useRemoveProductGroupItem, useUpdateProductGroupItem,
  useProducts, useServices,
} from '@/hooks/useVendor'
import { askConfirm } from '@/components/common/ConfirmProvider'
import { formatCurrency, mediaUrl } from '@/lib/utils'
import type { ProductGroup, ProductGroupItem } from '@/types'
import {
  ChevronRight, ChevronDown, Layers, Package, Wrench, Pencil, Trash2,
  Plus, Search, X, Loader2, Folder,
  AlertCircle,
} from 'lucide-react'

type TabId = 'contents' | 'settings'

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ProductGroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>('contents')
  const [editOpen, setEditOpen] = useState(false)

  const { data: group, isLoading, error } = useProductGroup(id ?? '')
  const deleteGroup = useDeleteProductGroup()

  const handleDelete = async () => {
    if (!group) return
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
      description: `This will remove the group and its ${group.item_count} member${group.item_count === 1 ? '' : 's'}. Products and services are not deleted.`,
    })
    if (!ok) return
    deleteGroup.mutate(group.id, { onSuccess: () => navigate('/product-groups') })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-7 h-7 animate-spin" />
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Group not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/product-groups')}>
          Back to groups
        </Button>
      </div>
    )
  }

  const ancestors = group.ancestors ?? []
  const children = group.children ?? []
  const items = group.items ?? []
  const totalContents = children.length + items.length

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Breadcrumb — only list link; nested groups expand in Contents, no per-group screens */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
        <Link to="/product-groups" className="hover:text-foreground transition-colors">Product Groups</Link>
        {ancestors.map((a) => (
          <span key={a.id} className="contents">
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span>{a.name}</span>
          </span>
        ))}
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <span className="text-foreground font-medium">{group.name}</span>
      </nav>

      {/* Header card — SAP-style: code prominent, path visible */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Blue accent bar at top (SAP-style) */}
        <div className="h-1.5 w-full bg-primary" />
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {group.image_url ? (
              <img
                src={mediaUrl(group.image_url)}
                alt={group.name}
                className="w-14 h-14 rounded-lg object-cover border border-border shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Folder className="w-7 h-7 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {group.code && (
                  <span className="font-mono text-sm font-bold text-primary">{group.code}</span>
                )}
                <h1 className="text-lg font-semibold text-foreground leading-tight">{group.name}</h1>
                {!group.is_active && <Badge variant="outline">Inactive</Badge>}
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{group.path || '/'}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  L{group.level}
                  {children.length > 0 && ` · ${children.length} sub-group${children.length === 1 ? '' : 's'}`}
                  {items.length > 0 && ` · ${items.length} item${items.length === 1 ? '' : 's'}`}
                </span>
              </div>
              {group.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{group.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4" /> Edit
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={handleDelete} aria-label="Delete">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex">
          {([
            { id: 'contents' as TabId, label: `Contents (${totalContents})` },
            { id: 'settings' as TabId, label: 'Settings' },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'contents' && <ContentsTab group={group} />}
      {tab === 'settings' && <SettingsTab group={group} />}

      {editOpen && <EditGroupPanel group={group} onClose={() => setEditOpen(false)} />}
    </div>
  )
}

// ── Contents tab — unified expandable tree of sub-groups + items ─────────────
function ContentsTab({ group }: { group: ProductGroup }) {
  const navigate = useNavigate()
  const addItems = useAddProductGroupItems()
  const removeItem = useRemoveProductGroupItem()
  const updateItem = useUpdateProductGroupItem()

  const [addPanel, setAddPanel] = useState<'products' | 'services' | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const { data: productResults, isFetching: loadingProducts } = useProducts(
    addPanel === 'products' ? { search: debouncedQuery || undefined, size: 12, page: 1 } : undefined,
  )
  const { data: serviceResults, isFetching: loadingServices } = useServices(
    addPanel === 'services' ? { search: debouncedQuery || undefined, size: 12, page: 1 } : undefined,
  )

  const existingIds = useMemo(
    () => new Set((group.items ?? []).map((i) => `${i.item_type}:${i.item_id}`)),
    [group.items],
  )

  const isBundle = true
  const children = group.children ?? []
  const items = group.items ?? []
  const results = addPanel === 'products' ? (productResults?.items ?? []) : (serviceResults?.items ?? [])
  const loadingResults = addPanel === 'products' ? loadingProducts : loadingServices

  const handleAdd = (itemId: string) => {
    if (!addPanel) return
    addItems.mutate({
      groupId: group.id,
      items: [{ item_type: addPanel === 'products' ? 'product' : 'service', item_id: itemId, quantity: 1 }],
    })
  }

  const handleRemove = async (groupId: string, itemId: string, name: string) => {
    const ok = await askConfirm({ title: `Remove "${name}" from group?` })
    if (!ok) return
    removeItem.mutate({ groupId, itemId })
  }

  const handleQtyChange = (groupId: string, itemId: string, qty: number) => {
    updateItem.mutate({ groupId, itemId, data: { quantity: qty } })
  }

  const isEmpty = children.length === 0 && items.length === 0

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {isEmpty ? 'Empty group — add sub-groups or items below.' : `${children.length} sub-group${children.length === 1 ? '' : 's'} · ${items.length} item${items.length === 1 ? '' : 's'}`}
        </p>
        <div className="flex gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/product-groups', { state: { presetParentId: group.id, presetParentName: group.name } })}
          >
            <Folder className="w-3.5 h-3.5" /> New Sub-group
          </Button>
          <Button
            size="sm"
            variant={addPanel === 'products' ? 'default' : 'outline'}
            onClick={() => { setAddPanel(addPanel === 'products' ? null : 'products'); setQuery('') }}
          >
            <Package className="w-3.5 h-3.5" /> Add Products
          </Button>
          <Button
            size="sm"
            variant={addPanel === 'services' ? 'default' : 'outline'}
            onClick={() => { setAddPanel(addPanel === 'services' ? null : 'services'); setQuery('') }}
          >
            <Wrench className="w-3.5 h-3.5" /> Add Services
          </Button>
        </div>
      </div>

      {/* Search add panel */}
      {addPanel && (
        <Card className="border-primary/40 bg-primary/[0.02]">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Add {addPanel === 'products' ? 'Products' : 'Services'}
              </p>
              <Button size="icon-sm" variant="ghost" onClick={() => { setAddPanel(null); setQuery('') }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${addPanel}...`}
                className="pl-9 h-8"
              />
            </div>
            {loadingResults ? (
              <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No {addPanel} found.</p>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {results.map((r) => {
                  const key = `${addPanel === 'products' ? 'product' : 'service'}:${r.id}`
                  const already = existingIds.has(key)
                  return (
                    <div key={r.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency((r as { price?: number }).price ?? 0)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={already ? 'secondary' : 'outline'}
                        disabled={already || addItems.isPending}
                        onClick={() => handleAdd(r.id)}
                        className="shrink-0"
                      >
                        {already ? 'Added' : <><Plus className="w-3 h-3" /> Add</>}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Expandable tree — sub-groups open in place (no nested detail pages) */}
      {isEmpty ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            <Folder className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-foreground">Empty group</p>
            <p className="text-sm mt-1">Use the buttons above to add sub-groups, products, or services.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Direct products/services first, then sub-groups */}
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1 && children.length === 0
            return (
              <ItemRow
                key={item.id}
                item={item}
                isLast={isLast}
                depth={0}
                isBundle={isBundle}
                onRemove={() => handleRemove(group.id, item.id, item.name)}
                onQtyChange={(qty) => handleQtyChange(group.id, item.id, qty)}
              />
            )
          })}

          {children.map((child, idx) => {
            const isLast = idx === children.length - 1
            return (
              <SubGroupRow
                key={child.id}
                child={child}
                isLast={isLast}
                depth={0}
                isBundle={isBundle}
                onRemove={handleRemove}
                onQtyChange={handleQtyChange}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Sub-group row — expands in place (no separate screen) ─────────────────────
function SubGroupRow({
  child,
  isLast,
  depth,
  isBundle,
  onRemove,
  onQtyChange,
}: {
  child: ProductGroup
  isLast: boolean
  depth: number
  isBundle: boolean
  onRemove: (groupId: string, itemId: string, name: string) => void
  onQtyChange: (groupId: string, itemId: string, qty: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const subCount = child.children?.length ?? 0
  const itemCount = child.item_count ?? 0
  const canExpand = subCount > 0 || itemCount > 0

  const { data: detail, isLoading } = useProductGroup(child.id, { enabled: expanded && canExpand })
  const nestedChildren = detail?.children ?? child.children ?? []
  const nestedItems = detail?.items ?? []

  return (
    <div className={isLast && !expanded ? '' : 'border-b border-border'}>
      <button
        type="button"
        onClick={() => { if (canExpand) setExpanded((v) => !v) }}
        disabled={!canExpand}
        className={`w-full flex items-center gap-0 text-left group transition-colors ${
          canExpand ? 'hover:bg-muted/40 cursor-pointer' : 'cursor-default opacity-80'
        }`}
        style={{ paddingLeft: depth > 0 ? `${depth * 20}px` : undefined }}
      >
        {/* Tree line column */}
        <div className="flex flex-col items-center w-10 shrink-0 self-stretch">
          <div className="w-px flex-1 bg-border" />
          <div className="w-3 h-px bg-border" />
          <div className={`w-px flex-1 ${isLast && !expanded ? 'bg-transparent' : 'bg-border'}`} />
        </div>

        {/* Folder icon accent */}
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 shrink-0 mr-3 my-2">
          <Folder className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {child.code && (
              <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                {child.code}
              </span>
            )}
            <span className="font-medium text-foreground text-sm">{child.name}</span>
            {!child.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {subCount > 0 && `${subCount} sub-group${subCount === 1 ? '' : 's'}`}
            {subCount > 0 && itemCount > 0 && ' · '}
            {itemCount > 0 && `${itemCount} item${itemCount === 1 ? '' : 's'}`}
            {subCount === 0 && itemCount === 0 && 'Empty'}
          </p>
        </div>

        {/* Expand / collapse — not a navigate-away chevron */}
        {canExpand && (
          <div className="px-4 shrink-0">
            {expanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />}
          </div>
        )}
      </button>

      {expanded && (
        <div>
          {isLoading ? (
            <div
              className="flex items-center gap-2 py-2.5 text-xs text-muted-foreground"
              style={{ paddingLeft: `${40 + (depth + 1) * 20}px` }}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading contents…
            </div>
          ) : (
            <>
              {/* Direct products/services first, then nested sub-groups */}
              {nestedItems.map((item, idx) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isLast={idx === nestedItems.length - 1 && nestedChildren.length === 0}
                  depth={depth + 1}
                  isBundle={isBundle}
                  onRemove={() => onRemove(child.id, item.id, item.name)}
                  onQtyChange={(qty) => onQtyChange(child.id, item.id, qty)}
                />
              ))}
              {nestedChildren.map((nested, idx) => {
                const nestedIsLast = idx === nestedChildren.length - 1
                return (
                  <SubGroupRow
                    key={nested.id}
                    child={nested}
                    isLast={nestedIsLast}
                    depth={depth + 1}
                    isBundle={isBundle}
                    onRemove={onRemove}
                    onQtyChange={onQtyChange}
                  />
                )
              })}
              {nestedChildren.length === 0 && nestedItems.length === 0 && (
                <div
                  className="py-2.5 text-xs text-muted-foreground"
                  style={{ paddingLeft: `${40 + (depth + 1) * 20}px` }}
                >
                  No products or services in this group.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Item row (leaf node) ──────────────────────────────────────────────────────
function ItemRow({
  item,
  isLast,
  depth = 0,
  isBundle,
  onRemove,
  onQtyChange,
}: {
  item: ProductGroupItem
  isLast: boolean
  depth?: number
  isBundle: boolean
  onRemove: () => void
  onQtyChange: (qty: number) => void
}) {
  return (
    <div
      className={`group flex items-center gap-0 ${isLast ? '' : 'border-b border-border'} hover:bg-muted/20 transition-colors`}
      style={{ paddingLeft: depth > 0 ? `${depth * 20}px` : undefined }}
    >
      {/* Tree line column */}
      <div className="flex flex-col items-center w-10 shrink-0 self-stretch">
        <div className="w-px flex-1 bg-border" />
        <div className="w-3 h-px bg-border" />
        {isLast ? <div className="flex-1" /> : <div className="w-px flex-1 bg-border" />}
      </div>

      {/* Thumbnail or icon */}
      {item.image_url ? (
        <img
          src={mediaUrl(item.image_url)}
          alt={item.name}
          className="w-8 h-8 rounded object-cover border border-border shrink-0 mr-3 my-2"
        />
      ) : (
        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0 mr-3 my-2">
          {item.item_type === 'product'
            ? <Package className="w-3.5 h-3.5 text-muted-foreground" />
            : <Wrench className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {item.sku && (
            <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
          )}
          <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatCurrency(item.price)}
          <span className="ml-1.5 capitalize opacity-60">{item.item_type}</span>
        </p>
      </div>

      {/* Bundle qty */}
      {isBundle && (
        <div className="flex items-center gap-1 px-3 shrink-0">
          <span className="text-xs text-muted-foreground">Qty</span>
          <Input
            type="number"
            min={0.001}
            step="0.001"
            value={item.quantity}
            onChange={(e) => onQtyChange(Number(e.target.value) || 1)}
            onClick={(e) => e.stopPropagation()}
            className="w-16 h-7 text-sm text-center"
          />
        </div>
      )}

      {/* Remove */}
      <div className="px-3 shrink-0">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onRemove}
          aria-label="Remove from group"
          className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  )
}

// ── Settings tab (was Overview) ───────────────────────────────────────────────
function SettingsTab({ group }: { group: ProductGroup }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Hierarchy path', value: group.path || '/' },
            { label: 'Depth level', value: `L${group.level}` },
            { label: 'Business code', value: group.code ?? '—' },
            { label: 'Status', value: group.is_active ? 'Active' : 'Inactive' },
            { label: 'Created', value: group.created_at ? new Date(group.created_at).toLocaleDateString() : '—' },
            { label: 'Updated', value: group.updated_at ? new Date(group.updated_at).toLocaleDateString() : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-medium text-foreground truncate">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Edit side-sheet ───────────────────────────────────────────────────────────
function EditGroupPanel({ group, onClose }: { group: ProductGroup; onClose: () => void }) {
  const updateGroup = useUpdateProductGroup()
  const { data: optionsData } = useProductGroupFlatOptions(group.id)
  const options = optionsData?.options ?? []

  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? '')
  const [parentId, setParentId] = useState(group.parent_id ?? '')
  const saving = updateGroup.isPending

  const handleSave = async () => {
    if (!name.trim()) return
    await updateGroup.mutateAsync({
      id: group.id,
      data: {
        name: name.trim(),
        description: description.trim() || null,
        code: group.code ?? null,
        parent_id: parentId || null,
      },
    })
    onClose()
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="sm:max-w-md w-full">
        <SheetHeader>
          <SheetTitle>Edit Group</SheetTitle>
          <SheetDescription>Update name, parent, and description.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              Parent Group <span className="text-muted-foreground font-normal text-xs">(optional)</span>
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
