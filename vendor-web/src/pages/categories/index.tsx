import { useState, useMemo, useRef, useEffect } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import {
  useCategoryTree, useCreateCategory, useUpdateCategory, useDeleteCategory,
  useCategoryCatalogues,
} from '@/hooks/useVendor'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Loader2, Plus, Pencil, Trash2, X, ChevronRight, ChevronDown, FolderTree, Package, Wrench, Eye, EyeOff, Copy, Folder, FolderOpen, File, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { processRows, type SortDir } from '@/lib/tableList'
import type { VendorCategory, CustomField } from '@/types'
import { useNavigate } from 'react-router-dom'
import { formatCurrency, mediaUrl, cn, isLikelyImageFile } from '@/lib/utils'
import { resolveBusinessGalleryDisplayUrl } from '@/data/businessImagePack'
import { ImageSourcePicker } from '@/components/common/ImageSourcePicker'
import { SingleImagePreview } from '@/components/common/CatalogMediaLightbox'
import { vendorApi } from '@/api/vendor'

const APPLIES_OPTIONS = [
  { value: 'both', label: 'Product & Service' },
  { value: 'product', label: 'Product only' },
  { value: 'service', label: 'Service only' },
]

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'boolean', label: 'Yes/No' },
]

const selectCls = 'h-10 text-sm'

function shareCategory(cat: { name: string; description?: string; applies_to?: string }, action: 'copy' | 'whatsapp' | 'email' | 'native') {
  const text = `Browse our ${cat.name} category${cat.description ? ` - ${cat.description}` : ''}`
  if (action === 'copy') { navigator.clipboard.writeText(text); toast.success('Category info copied!') }
  else if (action === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  else if (action === 'email') window.open(`mailto:?subject=${encodeURIComponent(`Category: ${cat.name}`)}&body=${encodeURIComponent(text)}`, '_blank')
  else if (navigator.share) navigator.share({ title: cat.name, text }).catch(() => {})
  else { navigator.clipboard.writeText(text); toast.success('Category info copied!') }
}

function appliesBadge(v: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    both: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Product & Service' },
    product: { bg: 'bg-green-50', text: 'text-green-700', label: 'Product' },
    service: { bg: 'bg-accent', text: 'text-primary', label: 'Service' },
  }
  const s = map[v] || map.both
  return (
    <span className={`inline-flex shrink-0 whitespace-nowrap px-2 py-0.5 text-xs rounded-full font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

function findInTree(cats: VendorCategory[], id: string): VendorCategory | null {
  for (const c of cats) {
    if (c.id === id) return c
    if (c.children?.length) {
      const found = findInTree(c.children, id)
      if (found) return found
    }
  }
  return null
}

function countDescendants(cat: VendorCategory): number {
  return (cat.children || []).reduce((n, c) => n + 1 + countDescendants(c), 0)
}

function isNodeInSubtree(root: VendorCategory, searchId: string): boolean {
  if (root.id === searchId) return true
  return (root.children || []).some(child => isNodeInSubtree(child, searchId))
}

function canReparentCategory(draggedId: string, newParentId: string | null, categories: VendorCategory[]): boolean {
  if (newParentId === null) return true
  if (draggedId === newParentId) return false
  const dragged = findInTree(categories, draggedId)
  if (!dragged) return false
  return !isNodeInSubtree(dragged, newParentId)
}

function CategoryImageThumb({ url, className }: { url: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const resolved = mediaUrl(resolveBusinessGalleryDisplayUrl(url))

  useEffect(() => {
    setFailed(false)
  }, [url])

  if (failed) {
    return (
      <div className={cn('flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-100', className)}>
        <FolderTree className="h-6 w-6 text-gray-300" />
      </div>
    )
  }

  return (
    <img
      src={resolved}
      alt=""
      className={className}
      onError={(e) => {
        const el = e.currentTarget
        const galleryFallback = resolveBusinessGalleryDisplayUrl(url)
        const fallbackSrc = mediaUrl(galleryFallback)
        if (galleryFallback !== url && el.src !== fallbackSrc) {
          el.src = fallbackSrc
          return
        }
        setFailed(true)
      }}
    />
  )
}

function CategoryVisibilityToggle({
  visible,
  onChange,
  compact = false,
}: {
  visible: boolean
  onChange: (visible: boolean) => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!visible)}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
        visible
          ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/60',
      )}
      title={visible ? 'Shown on business front — click to hide' : 'Hidden from business front — click to show'}
    >
      {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      {!compact && <span>{visible ? 'BU front' : 'Hidden'}</span>}
    </button>
  )
}

// ── Nested bullet-tree node (vertical grouping, not table rows) ──
function CategoryTreeBranch({
  cat,
  depth,
  selectedId,
  onSelect,
  onAddSub,
  onToggleVisibility,
  isDragging,
}: {
  cat: VendorCategory
  depth: number
  selectedId: string | null
  onSelect: (c: VendorCategory) => void
  onAddSub: (parentId: string) => void
  onToggleVisibility: (c: VendorCategory) => void
  isDragging?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const children = cat.children || []
  const hasChildren = children.length > 0
  const isSelected = selectedId === cat.id
  const isRoot = depth === 0
  const storefrontVisible = cat.is_visible !== false

  useEffect(() => {
    if (selectedId && selectedId !== cat.id && isNodeInSubtree(cat, selectedId)) {
      setExpanded(true)
    }
  }, [selectedId, cat])

  const { attributes, listeners, setNodeRef: setDragRef, isDragging: isSelfDragging } = useDraggable({
    id: cat.id,
    data: { type: 'category', name: cat.name },
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${cat.id}`,
    data: { type: 'category-target', categoryId: cat.id },
  })

  const setRowRef = (node: HTMLElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }

  return (
    <li className={cn(!isRoot && 'mt-1')}>
      <div
        ref={setRowRef}
        className={cn(
          'flex items-center gap-1 min-h-[2rem] rounded-md transition-colors',
          isSelfDragging && 'opacity-40',
          isOver && !isSelfDragging && 'bg-green-50 ring-1 ring-green-300',
          isDragging && !isSelfDragging && !isOver && 'hover:bg-green-50/50',
        )}
      >
        <button
          type="button"
          className="cursor-grab touch-none rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing shrink-0"
          title="Drag to move under another category"
          aria-label={`Drag ${cat.name}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="p-0.5 rounded hover:bg-gray-200 text-gray-500 shrink-0"
          aria-label={expanded ? 'Collapse group' : 'Expand group'}
        >
          {expanded
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => onSelect(cat)}
          className={cn(
            'flex items-center gap-2 flex-1 text-left px-2 py-1.5 rounded-md transition-colors min-w-0',
            isSelected
              ? 'bg-blue-100 text-blue-900 ring-1 ring-blue-200'
              : 'hover:bg-gray-100 text-gray-800',
            !storefrontVisible && 'opacity-60',
          )}
        >
          {hasChildren
            ? (expanded ? <FolderOpen className="w-4 h-4 shrink-0 text-amber-500" /> : <Folder className="w-4 h-4 shrink-0 text-amber-500" />)
            : <File className="w-4 h-4 shrink-0 text-gray-400" />}
          <span className={cn('truncate', isRoot ? 'font-semibold' : 'font-medium text-sm')}>{cat.name}</span>
          {hasChildren && (
            <span className="text-[0.625rem] text-gray-400 shrink-0">({children.length})</span>
          )}
        </button>

        <CategoryVisibilityToggle
          visible={storefrontVisible}
          onChange={() => onToggleVisibility(cat)}
          compact
        />

        <button
          type="button"
          title="Add subcategory"
          onClick={() => onAddSub(cat.id)}
          className="p-1 rounded hover:bg-green-50 text-green-600 shrink-0 opacity-60 hover:opacity-100"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <ul
          className={cn(
            'mt-1 space-y-0.5',
            depth === 0
              ? 'ml-3 pl-4 border-l-2 border-blue-200 list-disc marker:text-blue-400'
              : 'ml-6 pl-3 border-l border-gray-200 list-disc marker:text-gray-400',
          )}
        >
          {hasChildren ? (
            children.map(child => (
              <CategoryTreeBranch
                key={child.id}
                cat={child}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                onAddSub={onAddSub}
                onToggleVisibility={onToggleVisibility}
                isDragging={isDragging}
              />
            ))
          ) : (
            <li className="list-none -ml-4 pl-2">
              <button
                type="button"
                onClick={() => onAddSub(cat.id)}
                className="text-xs text-gray-400 hover:text-green-600 italic py-1"
              >
                + Add subcategory under {cat.name}
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

function RootDropZone({ show }: { show: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'drop-root' })
  if (!show) return null
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'mb-2 rounded-md border border-dashed px-2 py-1.5 text-center text-xs transition-colors',
        isOver ? 'border-green-500 bg-green-50 text-green-700' : 'border-border text-muted-foreground',
      )}
    >
      Drop here for top-level category
    </div>
  )
}

function CategoryTreeExplorer({
  categories,
  selectedId,
  onSelect,
  onAddSub,
  onAddRoot,
  onMove,
  onToggleVisibility,
  sortKey,
  sortDir,
  onSortKeyChange,
  onSortDirChange,
}: {
  categories: VendorCategory[]
  selectedId: string | null
  onSelect: (c: VendorCategory) => void
  onAddSub: (parentId: string) => void
  onAddRoot: () => void
  onMove: (categoryId: string, newParentId: string | null) => void
  onToggleVisibility: (cat: VendorCategory) => void
  sortKey: string
  sortDir: SortDir
  onSortKeyChange: (v: string) => void
  onSortDirChange: (v: SortDir) => void
}) {
  const [activeDrag, setActiveDrag] = useState<VendorCategory | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    const cat = findInTree(categories, String(event.active.id))
    setActiveDrag(cat)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null)
    const draggedId = String(event.active.id)
    const overId = event.over?.id ? String(event.over.id) : null
    if (!overId) return

    let newParentId: string | null = null
    if (overId === 'drop-root') {
      newParentId = null
    } else if (overId.startsWith('drop-')) {
      newParentId = overId.slice(5)
    } else {
      return
    }

    const dragged = findInTree(categories, draggedId)
    const currentParent = dragged?.parent_id ?? null
    if (currentParent === newParentId) return

    if (!canReparentCategory(draggedId, newParentId, categories)) {
      toast.error('Cannot move a category into itself or its subcategories')
      return
    }

    onMove(draggedId, newParentId)
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Category tree</span>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={sortKey}
            onChange={onSortKeyChange}
            options={[
              { value: 'name', label: 'Name' },
              { value: 'applies_to', label: 'Applies To' },
              { value: 'status', label: 'Status' },
            ]}
            aria-label="Sort by"
            className="h-8 text-xs"
            wrapperClassName="min-w-[6.5rem] shrink-0"
          />
          <Select
            value={sortDir}
            onChange={(v) => onSortDirChange(v as SortDir)}
            options={[
              { value: 'asc', label: 'A → Z' },
              { value: 'desc', label: 'Z → A' },
            ]}
            aria-label="Sort direction"
            className="h-8 text-xs"
            wrapperClassName="min-w-[5.5rem] shrink-0"
          />
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onAddRoot}>
            <Plus className="w-3 h-3" /> Root
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <FolderTree className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No categories yet.</p>
          <Button type="button" size="sm" className="mt-3 gap-1" onClick={onAddRoot}>
            <Plus className="w-3.5 h-3.5" /> Add root category
          </Button>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <RootDropZone show={!!activeDrag} />
          <ul className="sidebar-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
            {categories.map(root => (
              <li
                key={root.id}
                className="rounded-lg border border-border bg-card shadow-sm px-3 py-2"
              >
                <CategoryTreeBranch
                  cat={root}
                  depth={0}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onAddSub={onAddSub}
                  onToggleVisibility={onToggleVisibility}
                  isDragging={!!activeDrag}
                />
              </li>
            ))}
          </ul>
          <DragOverlay dropAnimation={null}>
            {activeDrag ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium shadow-lg">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                <Folder className="h-4 w-4 text-amber-500" />
                {activeDrag.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

function DetailReadOnlyField({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-foreground">
        <span className="truncate">{value ?? '—'}</span>
      </div>
    </div>
  )
}

function CategoryDetailPanel({
  cat,
  parentLabel,
  onEdit,
  onDelete,
  onViewCatalogue,
  onAddSub,
  onToggleVisibility,
}: {
  cat: VendorCategory | null
  parentLabel?: string | null
  onEdit: (c: VendorCategory) => void
  onDelete: (id: string) => void
  onViewCatalogue: (id: string) => void
  onAddSub: (parentId: string) => void
  onToggleVisibility: (c: VendorCategory) => void
}) {
  if (!cat) {
    return (
      <div className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-6 text-center shadow-sm">
        <FolderTree className="mb-3 h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">Select a category in the tree</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Click any folder in the tree on the left. Use the + button on a category to add subcategories beneath it.
        </p>
      </div>
    )
  }

  const childCount = cat.children?.length ?? 0
  const descCount = countDescendants(cat)
  const appliesLabel = APPLIES_OPTIONS.find(o => o.value === cat.applies_to)?.label ?? cat.applies_to
  const customFieldCount = cat.custom_fields?.length ?? 0
  const storefrontVisible = cat.is_visible !== false

  return (
    <div className="flex w-full max-h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:max-h-[calc(100dvh-12rem)]">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <FolderTree className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="truncate text-sm font-semibold text-foreground">{cat.name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <CategoryVisibilityToggle
            visible={storefrontVisible}
            onChange={() => onToggleVisibility(cat)}
          />
          {appliesBadge(cat.applies_to)}
          <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {cat.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="overflow-y-auto overscroll-contain px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <DetailReadOnlyField label="Name" value={cat.name} />
            <DetailReadOnlyField label="Description" value={cat.description || '—'} />
            <DetailReadOnlyField
              label="Applies To"
              value={appliesLabel}
              className={!cat.parent_id && 'sm:col-span-2'}
            />
            {cat.parent_id && (
              <DetailReadOnlyField
                label="Parent Category"
                value={parentLabel ? `Under: ${parentLabel}` : '—'}
              />
            )}
          </div>

          <div className="w-[6.5rem] shrink-0 space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Image</Label>
            {cat.image_url ? (
              <CategoryImageThumb
                url={cat.image_url}
                className="h-24 w-full rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-muted-foreground/40">
                <FolderTree className="h-6 w-6" />
              </div>
            )}
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Direct subs</p>
            <p className="text-sm font-semibold text-foreground">{childCount}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total nested</p>
            <p className="text-sm font-semibold text-foreground">{descCount}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Custom fields</p>
            <p className="text-sm font-semibold text-foreground">{customFieldCount}</p>
          </div>
        </div>

        {customFieldCount > 0 ? (
          <div className="mt-2.5 space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Custom Fields</Label>
            {cat.custom_fields!.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border bg-gray-50 px-2.5 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">{f.type}</span>
                {f.required && <span className="shrink-0 text-xs text-muted-foreground">Req</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2.5 inline-flex max-w-full items-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Custom fields <span className="text-muted-foreground/60">(none)</span>
            </p>
          </div>
        )}

        {(cat.children?.length ?? 0) > 0 && (
          <div className="mt-2.5">
            <Label className="mb-1.5 text-xs font-medium text-muted-foreground">Subcategories</Label>
            <ul className="ml-1 list-inside list-disc space-y-1 rounded-lg border border-border/70 bg-muted/10 px-3 py-2 text-sm text-gray-700">
              {cat.children!.map(child => (
                <li key={child.id}>
                  {child.name}
                  {(child.children?.length ?? 0) > 0 && (
                    <ul className="ml-4 mt-0.5 list-inside list-disc text-gray-500">
                      {child.children!.map(grand => (
                        <li key={grand.id}>{grand.name}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-2.5">
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-3 text-xs" onClick={() => onAddSub(cat.id)}>
          <Plus className="w-3.5 h-3.5" /> Add subcategory
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-3 text-xs" onClick={() => onViewCatalogue(cat.id)}>
          <Eye className="w-3.5 h-3.5" /> Catalogue
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-3 text-xs" onClick={() => onEdit(cat)}>
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-3 text-xs" onClick={() => shareCategory(cat, 'copy')}>
          <Copy className="w-3.5 h-3.5" /> Copy
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 px-3 text-xs text-red-600 hover:text-red-700"
          onClick={() => { if (confirm(`Delete "${cat.name}" and all subcategories?`)) onDelete(cat.id) }}
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </Button>
      </div>
    </div>
  )
}

// ── Catalogue Drawer ─────────────────────────────────────────────
function CatalogueDrawer({
 categoryId, onClose }: { categoryId: string; onClose: () => void }) {
  useEscapeToClose(onClose)

  const { data, isLoading } = useCategoryCatalogues(categoryId)
  const navigate = useNavigate()

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border-l border-border text-foreground shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-lg font-semibold">Catalogue</h2>
            {data?.category && <p className="text-sm text-gray-500">{data.category.name}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
        ) : (
          <div className="p-6 space-y-6">
            {(data?.product_count ?? 0) > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-green-600" /> Products ({data!.product_count})
                </h3>
                <div className="space-y-2">
                  {data!.products.map((p: any) => (
                    <div key={p.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/products/${p.id}`)}
                    >
                      {p.image_url ? (
                        <img src={mediaUrl(p.image_url)} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center"><Package className="w-5 h-5 text-gray-300" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.category}{p.subcategory ? ` / ${p.subcategory}` : ''}</p>
                      </div>
                      <p className="text-sm font-bold shrink-0">{formatCurrency(p.price)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(data?.service_count ?? 0) > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                  <Wrench className="w-4 h-4 text-primary" /> Services ({data!.service_count})
                </h3>
                <div className="space-y-2">
                  {data!.services.map((s: any) => (
                    <div key={s.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/services/${s.id}`)}
                    >
                      {s.image_url ? (
                        <img src={mediaUrl(s.image_url)} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center"><Wrench className="w-5 h-5 text-gray-300" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.category}{s.subcategory ? ` / ${s.subcategory}` : ''}</p>
                      </div>
                      <p className="text-sm font-bold shrink-0">{formatCurrency(s.price)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(data?.product_count ?? 0) === 0 && (data?.service_count ?? 0) === 0 && (
              <div className="text-center py-12">
                <FolderTree className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No products or services in this category yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Custom Fields Editor ─────────────────────────────────────────
function CustomFieldsEditor({
  fields,
  onChange,
  compact = false,
}: {
  fields: CustomField[]
  onChange: (f: CustomField[]) => void
  compact?: boolean
}) {
  const addField = () => onChange([...fields, { name: '', type: 'text', required: false }])
  const removeField = (i: number) => onChange(fields.filter((_, idx) => idx !== i))
  const updateField = (i: number, patch: Partial<CustomField>) => {
    const updated = [...fields]
    updated[i] = { ...updated[i], ...patch }
    onChange(updated)
  }

  if (compact && fields.length === 0) {
    return (
      <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          Custom fields <span className="text-muted-foreground/60">(optional)</span>
        </p>
        <Button type="button" variant="outline" size="sm" onClick={addField} className="h-7 gap-1 text-xs">
          <Plus className="w-3 h-3" /> Add Field
        </Button>
      </div>
    )
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact && (
        <Label className="text-sm font-medium">
          Custom Fields
          <span className="text-gray-400 font-normal"> (configurable attributes)</span>
        </Label>
      )}
      {!compact && fields.length === 0 && (
        <div className="inline-flex max-w-full flex-wrap items-center gap-2">
          <p className="text-xs text-gray-400">No custom fields yet.</p>
          <Button type="button" variant="outline" size="sm" onClick={addField} className="h-7 gap-1 text-xs">
            <Plus className="w-3 h-3" /> Add Field
          </Button>
        </div>
      )}
      {fields.map((f, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border bg-gray-50 p-2.5">
          <div className="min-w-0 flex-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input placeholder="Field name" value={f.name} onChange={e => updateField(i, { name: e.target.value })} className="h-8 text-sm" />
            <Select
              value={f.type}
              onChange={(v) => updateField(i, { type: v, options: v === 'select' || v === 'multiselect' ? f.options || [] : undefined })}
              options={FIELD_TYPES.map(t => ({ value: t.value, label: t.label }))}
              aria-label="Field type"
              className={`${selectCls} h-8 text-sm`}
            />
            {(f.type === 'select' || f.type === 'multiselect') && (
              <Input placeholder="Options (comma separated)" value={(f.options || []).join(', ')}
                onChange={e => updateField(i, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                className="h-8 text-sm sm:col-span-1" />
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pt-1">
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={f.required || false} onChange={e => updateField(i, { required: e.target.checked })} className="rounded" />
              Req
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addField}
              className={cn('h-7 gap-1 px-2 text-xs', i !== fields.length - 1 && 'hidden')}
            >
              <Plus className="w-3 h-3" /> Add
            </Button>
            <button type="button" aria-label="Remove field" onClick={() => removeField(i)} className="p-1 text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Category Form Panel ──────────────────────────────────────────
function CategoryFormPanel({
  editing,
  parentId,
  parentLabel,
  flatOptions,
  name,
  description,
  appliesTo,
  customFields,
  imageUrl,
  imageUploading,
  isVisible,
  pending,
  onNameChange,
  onDescriptionChange,
  onAppliesToChange,
  onParentIdChange,
  onCustomFieldsChange,
  onVisibleChange,
  onImageUrlClear,
  onUploadImage,
  onImageUrl,
  onSubmit,
  onCancel,
}: {
  editing: VendorCategory | null
  parentId: string | null
  parentLabel: string | null | undefined
  flatOptions: { id: string; label: string }[]
  name: string
  description: string
  appliesTo: string
  customFields: CustomField[]
  imageUrl: string | null
  imageUploading: boolean
  isVisible: boolean
  pending: boolean
  onNameChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onAppliesToChange: (v: string) => void
  onParentIdChange: (v: string | null) => void
  onCustomFieldsChange: (f: CustomField[]) => void
  onVisibleChange: (v: boolean) => void
  onImageUrlClear: () => void
  onUploadImage: (file: File) => Promise<void>
  onImageUrl: (url: string) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}) {
  const title = editing ? 'Edit Category' : parentId ? 'New Subcategory' : 'New Category'
  const fieldSelectCls = 'h-9 text-sm'
  return (
    <div className="flex w-full max-h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:max-h-[calc(100dvh-12rem)]">
      <form onSubmit={onSubmit} className="flex max-h-full flex-col">

        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
              <FolderTree className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <CategoryVisibilityToggle visible={isVisible} onChange={onVisibleChange} />
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto overscroll-contain px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="min-w-0 space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Name <span className="text-red-500">*</span></Label>
                <Input
                  value={name}
                  onChange={e => onNameChange(e.target.value)}
                  placeholder="e.g. Electronics"
                  required
                  className="h-9 w-full"
                />
              </div>

              <div className="min-w-0 space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Description</Label>
                <Input
                  value={description}
                  onChange={e => onDescriptionChange(e.target.value)}
                  placeholder="Optional"
                  className="h-9 w-full"
                />
              </div>

              <div className={cn('min-w-0 space-y-1', !editing && !parentId && 'sm:col-span-2')}>
                <Label className="text-xs font-medium text-muted-foreground">Applies To</Label>
                <Select
                  value={appliesTo}
                  onChange={onAppliesToChange}
                  options={APPLIES_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  aria-label="Applies to"
                  className={cn(fieldSelectCls, 'w-full')}
                />
              </div>

              {(editing || parentId) && (
                <div className="min-w-0 space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Parent Category</Label>
                  {editing ? (
                    <Select
                      value={parentId || ''}
                      onChange={(v) => onParentIdChange(v || null)}
                      options={selectOptionsWithBlank('— Root (top-level) —', flatOptions
                        .filter(o => o.id !== editing.id)
                        .map(o => ({ value: o.id, label: o.label })))}
                      placeholder="— Root (top-level) —"
                      aria-label="Parent category"
                      className={cn(fieldSelectCls, 'w-full')}
                    />
                  ) : (
                    <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                      <span className="truncate">Under: <strong className="text-foreground">{parentLabel}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="w-[6.5rem] shrink-0 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Image</Label>
              <div className="flex w-full flex-col items-stretch gap-1.5">
                {imageUrl ? (
                  <SingleImagePreview
                    url={imageUrl}
                    alt="Category image"
                    resolveUrl={(u) => mediaUrl(resolveBusinessGalleryDisplayUrl(u))}
                    className="w-full rounded-lg"
                    imgClassName="h-24 w-full rounded-lg object-cover border border-border bg-muted/30"
                    editable
                    onSave={onUploadImage}
                  />
                ) : (
                  <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-muted-foreground/40">
                    {imageUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderTree className="w-6 h-6" />}
                  </div>
                )}
                <ImageSourcePicker
                  title="Category image"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={pending}
                  uploading={imageUploading}
                  onFile={onUploadImage}
                  onUrl={onImageUrl}
                  buttonLabel="Upload"
                  buttonClassName="h-8 w-full px-2 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  className="w-full"
                />
                {imageUrl && (
                  <button
                    type="button"
                    onClick={onImageUrlClear}
                    className="text-center text-[10px] text-red-500 hover:text-red-700"
                    title="Remove image"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-2.5">
            <CustomFieldsEditor fields={customFields} onChange={onCustomFieldsChange} compact />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <Button type="button" variant="cancel" onClick={onCancel} className="h-8 px-4 text-sm">
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="h-8 px-4 text-sm">
            {pending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {editing ? 'Save changes' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────
export default function CategoriesPage() {
  const { data, isLoading } = useCategoryTree()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<VendorCategory | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [appliesTo, setAppliesTo] = useState('both')
  const [parentId, setParentId] = useState<string | null>(null)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const localPreviewRef = useRef<string | null>(null)
  const [catalogueId, setCatalogueId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(true)

  const clearLocalPreview = () => {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current)
      localPreviewRef.current = null
    }
  }

  useEffect(() => () => clearLocalPreview(), [])

  const resetForm = () => {
    setShowForm(false); setEditing(null); setName(''); setDescription('')
    setAppliesTo('both'); setParentId(null); setCustomFields([])
    setIsVisible(true)
    clearLocalPreview()
    setImageUrl(null); setImageUploading(false)
  }

  useEscapeToClose(resetForm, showForm)
  useEscapeToClose(() => setCatalogueId(null), !!catalogueId)

  const openCreate = (pId?: string) => {
    resetForm()
    if (pId) {
      setParentId(pId)
      setSelectedId(pId)
    }
    setShowForm(true)
  }

  const openEdit = (cat: VendorCategory) => {
    clearLocalPreview()
    setSelectedId(cat.id)
    setEditing(cat); setName(cat.name); setDescription(cat.description || '')
    setAppliesTo(cat.applies_to); setParentId(cat.parent_id || null)
    setCustomFields(cat.custom_fields || [])
    setImageUrl(cat.image_url || null)
    setIsVisible(cat.is_visible !== false)
    setShowForm(true)
  }

  const uploadCategoryImageFile = async (file: File) => {
    if (!isLikelyImageFile(file)) {
      toast.error('Please choose an image file (JPEG, PNG, WebP, or GIF)')
      return
    }
    clearLocalPreview()
    const localPreview = URL.createObjectURL(file)
    localPreviewRef.current = localPreview
    setImageUrl(localPreview)
    setImageUploading(true)
    try {
      const data = await vendorApi.uploadCategoryImage(file)
      const saved = data.image_url || (data as { url?: string }).url
      if (!saved) throw new Error('No image URL returned')
      clearLocalPreview()
      setImageUrl(saved)
      toast.success('Category image uploaded')
    } catch {
      clearLocalPreview()
      setImageUrl(null)
      toast.error('Upload failed — try again or pick another image')
    } finally {
      setImageUploading(false)
    }
  }

  const handleCategoryImageUrl = (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    clearLocalPreview()
    setImageUrl(trimmed)
  }

  const handleToggleCategoryVisibility = (cat: VendorCategory) => {
    updateCategory.mutate({
      id: cat.id,
      data: { is_visible: cat.is_visible === false },
    })
  }

  const handleMoveCategory = (categoryId: string, newParentId: string | null) => {
    updateCategory.mutate({ id: categoryId, data: { parent_id: newParentId } })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (imageUrl?.startsWith('blob:')) {
      toast.error('Image is still uploading — wait a moment and try again')
      return
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || undefined,
      image_url: imageUrl || null,
      applies_to: appliesTo,
      parent_id: parentId || undefined,
      is_visible: isVisible,
      custom_fields: customFields.filter(f => f.name.trim()),
    }

    if (editing) {
      updateCategory.mutate({ id: editing.id, data: payload }, { onSuccess: resetForm })
    } else {
      createCategory.mutate(payload, { onSuccess: resetForm })
    }
  }

  // Flatten tree for parent dropdown (edit mode — move category)
  const flattenCategories = (cats: VendorCategory[], prefix = ''): { id: string; label: string }[] => {
    const result: { id: string; label: string }[] = []
    for (const c of cats) {
      result.push({ id: c.id, label: prefix + c.name })
      if (c.children?.length) {
        result.push(...flattenCategories(c.children, prefix + '  '))
      }
    }
    return result
  }
  const flatOptions = flattenCategories(data?.categories || [])

  const sortedCategories = useMemo(() => {
    return processRows(
      data?.categories,
      '',
      () => [],
      sortKey,
      sortDir,
      {
        name: (c) => c.name,
        applies_to: (c) => c.applies_to,
        status: (c) => (c.is_active ? 1 : 0),
      },
    )
  }, [data?.categories, sortKey, sortDir])

  const selectedCategory = useMemo(
    () => (selectedId && data?.categories ? findInTree(data.categories, selectedId) : null),
    [selectedId, data?.categories],
  )

  const parentLabel = parentId ? findInTree(data?.categories || [], parentId)?.name : null

  return (
    <div className="mx-auto flex max-h-[calc(100dvh-10rem)] min-h-0 w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 pb-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5 truncate">Organize your catalogue with categories, subcategories, and custom fields</p>
        </div>
        <Button onClick={() => openCreate()} className="shrink-0 gap-2"><Plus className="w-4 h-4" />Add Category</Button>
      </div>

      {isLoading ? (
        <Card className="min-h-0 flex-1">
          <CardContent className="flex h-full items-center justify-center py-16 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
          <div className="h-full min-h-0">
            <CategoryTreeExplorer
              categories={sortedCategories}
              selectedId={selectedId}
              onSelect={(c) => { setSelectedId(c.id); setShowForm(false) }}
              onAddSub={(pid) => openCreate(pid)}
              onAddRoot={() => openCreate()}
              onMove={handleMoveCategory}
              onToggleVisibility={handleToggleCategoryVisibility}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortKeyChange={setSortKey}
              onSortDirChange={setSortDir}
            />
          </div>
          <div className="min-h-0 lg:self-start">
            {showForm ? (
              <CategoryFormPanel
                editing={editing}
                parentId={parentId}
                parentLabel={parentLabel}
                flatOptions={flatOptions}
                name={name}
                description={description}
                appliesTo={appliesTo}
                customFields={customFields}
                imageUrl={imageUrl}
                imageUploading={imageUploading}
                isVisible={isVisible}
                pending={createCategory.isPending || updateCategory.isPending}
                onNameChange={setName}
                onDescriptionChange={setDescription}
                onAppliesToChange={setAppliesTo}
                onParentIdChange={setParentId}
                onCustomFieldsChange={setCustomFields}
                onVisibleChange={setIsVisible}
                onImageUrlClear={() => { clearLocalPreview(); setImageUrl(null) }}
                onUploadImage={uploadCategoryImageFile}
                onImageUrl={handleCategoryImageUrl}
                onSubmit={handleSubmit}
                onCancel={resetForm}
              />
            ) : (
              <CategoryDetailPanel
                cat={selectedCategory}
                parentLabel={selectedCategory?.parent_id ? findInTree(data?.categories || [], selectedCategory.parent_id)?.name : null}
                onEdit={openEdit}
                onDelete={(id) => {
                  deleteCategory.mutate(id)
                  if (selectedId === id) setSelectedId(null)
                }}
                onViewCatalogue={(id) => setCatalogueId(id)}
                onAddSub={(pid) => openCreate(pid)}
                onToggleVisibility={handleToggleCategoryVisibility}
              />
            )}
          </div>
        </div>
      )}

      {catalogueId && <CatalogueDrawer categoryId={catalogueId} onClose={() => setCatalogueId(null)} />}
    </div>
  )
}
