import { useState, useMemo } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useCategoryTree, useCreateCategory, useUpdateCategory, useDeleteCategory,
  useCategoryCatalogues,
} from '@/hooks/useVendor'
import { Loader2, Plus, Pencil, Trash2, X, ChevronRight, ChevronDown, FolderTree, Package, Wrench, Eye, Copy, Folder, FolderOpen, File } from 'lucide-react'
import { toast } from 'sonner'
import { processRows, type SortDir } from '@/lib/tableList'
import type { VendorCategory, CustomField } from '@/types'
import { useNavigate } from 'react-router-dom'
import { formatCurrency, mediaUrl, cn } from '@/lib/utils'

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

const selectCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring'

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
  return <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${s.bg} ${s.text}`}>{s.label}</span>
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

// ── Nested bullet-tree node (vertical grouping, not table rows) ──
function CategoryTreeBranch({
  cat,
  depth,
  selectedId,
  onSelect,
  onAddSub,
}: {
  cat: VendorCategory
  depth: number
  selectedId: string | null
  onSelect: (c: VendorCategory) => void
  onAddSub: (parentId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const children = cat.children || []
  const hasChildren = children.length > 0
  const isSelected = selectedId === cat.id
  const isRoot = depth === 0

  return (
    <li className={cn(!isRoot && 'mt-1')}>
      <div className="flex items-center gap-1.5 min-h-[2rem]">
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

function CategoryTreeExplorer({
  categories,
  selectedId,
  onSelect,
  onAddSub,
  onAddRoot,
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
  sortKey: string
  sortDir: SortDir
  onSortKeyChange: (v: string) => void
  onSortDirChange: (v: SortDir) => void
}) {
  return (
    <div className="rounded-xl border bg-slate-50/80 p-4 min-h-[420px]">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-800">Category tree</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortKey}
            onChange={e => onSortKeyChange(e.target.value)}
            className="h-7 rounded border border-gray-200 bg-white px-2 text-xs"
          >
            <option value="name">Name</option>
            <option value="applies_to">Applies To</option>
            <option value="status">Status</option>
          </select>
          <select
            value={sortDir}
            onChange={e => onSortDirChange(e.target.value as SortDir)}
            className="h-7 rounded border border-gray-200 bg-white px-2 text-xs"
          >
            <option value="asc">A → Z</option>
            <option value="desc">Z → A</option>
          </select>
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onAddRoot}>
            <Plus className="w-3 h-3" /> Root
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="py-12 text-center">
          <FolderTree className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No categories yet.</p>
          <Button type="button" size="sm" className="mt-3 gap-1" onClick={onAddRoot}>
            <Plus className="w-3.5 h-3.5" /> Add root category
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {categories.map(root => (
            <li
              key={root.id}
              className="rounded-lg border border-gray-200 bg-white shadow-sm px-3 py-2"
            >
              <CategoryTreeBranch
                cat={root}
                depth={0}
                selectedId={selectedId}
                onSelect={onSelect}
                onAddSub={onAddSub}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CategoryDetailPanel({
  cat,
  onEdit,
  onDelete,
  onViewCatalogue,
  onAddSub,
}: {
  cat: VendorCategory | null
  onEdit: (c: VendorCategory) => void
  onDelete: (id: string) => void
  onViewCatalogue: (id: string) => void
  onAddSub: (parentId: string) => void
}) {
  if (!cat) {
    return (
      <div className="rounded-xl border border-dashed bg-white p-8 flex flex-col items-center justify-center min-h-[420px] text-center">
        <FolderTree className="w-12 h-12 text-gray-200 mb-3" />
        <p className="text-sm font-medium text-gray-600">Select a category in the tree</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">
          Click any folder in the tree on the left. Use the + button on a category to add subcategories beneath it.
        </p>
      </div>
    )
  }

  const childCount = cat.children?.length ?? 0
  const descCount = countDescendants(cat)

  return (
    <div className="rounded-xl border bg-white p-5 min-h-[420px] flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
            {cat.parent_id ? 'Subcategory' : 'Root category'}
          </p>
          <h2 className="text-xl font-bold text-gray-900">{cat.name}</h2>
          {cat.description && <p className="text-sm text-gray-500 mt-1">{cat.description}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {appliesBadge(cat.applies_to)}
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {cat.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div className="rounded-lg bg-gray-50 p-3">
          <dt className="text-xs text-gray-400">Direct subcategories</dt>
          <dd className="font-semibold text-gray-900">{childCount}</dd>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <dt className="text-xs text-gray-400">Total nested</dt>
          <dd className="font-semibold text-gray-900">{descCount}</dd>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <dt className="text-xs text-gray-400">Sort order</dt>
          <dd className="font-semibold text-gray-900">{cat.sort_order ?? 0}</dd>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <dt className="text-xs text-gray-400">Custom fields</dt>
          <dd className="font-semibold text-gray-900">{cat.custom_fields?.length ?? 0}</dd>
        </div>
      </dl>

      {(cat.children?.length ?? 0) > 0 && (
        <div className="mb-4 flex-1 min-h-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Subcategories</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-1">
            {cat.children!.map(child => (
              <li key={child.id}>
                {child.name}
                {(child.children?.length ?? 0) > 0 && (
                  <ul className="list-disc list-inside ml-4 mt-0.5 text-gray-500">
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

      <div className="flex flex-wrap gap-2 pt-4 mt-auto border-t">
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onAddSub(cat.id)}>
          <Plus className="w-3.5 h-3.5" /> Add subcategory
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onViewCatalogue(cat.id)}>
          <Eye className="w-3.5 h-3.5" /> Catalogue
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onEdit(cat)}>
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => shareCategory(cat, 'copy')}>
          <Copy className="w-3.5 h-3.5" /> Copy
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1 text-red-600 hover:text-red-700"
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-lg bg-white shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
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
        <Label className="text-sm font-medium">Custom Fields <span className="text-gray-400 font-normal">(configurable attributes)</span></Label>
        <Button type="button" variant="outline" size="sm" onClick={addField} className="gap-1 text-xs h-7">
          <Plus className="w-3 h-3" /> Add Field
        </Button>
      </div>
      {fields.length === 0 && (
        <p className="text-xs text-gray-400">No custom fields. Add fields like Color, Size, Material, etc.</p>
      )}
      {fields.map((f, i) => (
        <div key={i} className="flex items-start gap-2 p-3 rounded-lg border bg-gray-50">
          <div className="flex-1 grid grid-cols-3 gap-2">
            <Input placeholder="Field name" value={f.name} onChange={e => updateField(i, { name: e.target.value })} className="h-8 text-sm" />
            <select value={f.type} onChange={e => updateField(i, { type: e.target.value, options: e.target.value === 'select' || e.target.value === 'multiselect' ? f.options || [] : undefined })}
              className={`${selectCls} h-8 text-sm`}
            >
              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {(f.type === 'select' || f.type === 'multiselect') && (
              <Input placeholder="Options (comma separated)" value={(f.options || []).join(', ')}
                onChange={e => updateField(i, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                className="h-8 text-sm" />
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
  const [sortOrder, setSortOrder] = useState(0)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [catalogueId, setCatalogueId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const resetForm = () => {
    setShowForm(false); setEditing(null); setName(''); setDescription('')
    setAppliesTo('both'); setParentId(null); setSortOrder(0); setCustomFields([])
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
    setSelectedId(cat.id)
    setEditing(cat); setName(cat.name); setDescription(cat.description || '')
    setAppliesTo(cat.applies_to); setParentId(cat.parent_id || null)
    setSortOrder(cat.sort_order || 0); setCustomFields(cat.custom_fields || [])
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || undefined,
      applies_to: appliesTo,
      parent_id: parentId || undefined,
      sort_order: sortOrder,
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">Organize your catalogue with categories, subcategories, and custom fields</p>
        </div>
        <Button onClick={() => openCreate()} className="gap-2"><Plus className="w-4 h-4" />Add Category</Button>
      </div>

      {/* Category Form */}
      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{editing ? 'Edit Category' : parentId ? 'New Subcategory' : 'New Category'}</h3>
                <Button type="button" variant="ghost" size="sm" onClick={resetForm}><X className="w-4 h-4" /></Button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Electronics" required />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Parent Category</Label>
                  {editing ? (
                    <select value={parentId || ''} onChange={e => setParentId(e.target.value || null)} className={selectCls}>
                      <option value="">— Root (top-level) —</option>
                      {flatOptions
                        .filter(o => o.id !== editing.id)
                        .map(o => <option key={o.id} value={o.id}>{o.label}</option>)
                      }
                    </select>
                  ) : (
                    <>
                      <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-gray-700">
                        {parentLabel ? (
                          <span>Under: <strong>{parentLabel}</strong></span>
                        ) : (
                          <span className="text-gray-500">Root (top-level category)</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        Use + on a category in the tree to create a subcategory under it.
                      </p>
                    </>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Applies To</Label>
                  <select value={appliesTo} onChange={e => setAppliesTo(e.target.value)} className={selectCls}>
                    {APPLIES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sort Order</Label>
                  <Input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} placeholder="0" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
              </div>

              <CustomFieldsEditor fields={customFields} onChange={setCustomFields} />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="cancel" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending}>
                  {(createCategory.isPending || updateCategory.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editing ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Split tree explorer */}
      {isLoading ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CategoryTreeExplorer
            categories={sortedCategories}
            selectedId={selectedId}
            onSelect={(c) => { setSelectedId(c.id); setShowForm(false) }}
            onAddSub={(pid) => openCreate(pid)}
            onAddRoot={() => openCreate()}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
          />
          <CategoryDetailPanel
            cat={selectedCategory}
            onEdit={openEdit}
            onDelete={(id) => {
              deleteCategory.mutate(id)
              if (selectedId === id) setSelectedId(null)
            }}
            onViewCatalogue={(id) => setCatalogueId(id)}
            onAddSub={(pid) => openCreate(pid)}
          />
        </div>
      )}

      {/* Catalogue Drawer */}
      {catalogueId && <CatalogueDrawer categoryId={catalogueId} onClose={() => setCatalogueId(null)} />}
    </div>
  )
}
