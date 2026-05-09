import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useCategoryTree, useCreateCategory, useUpdateCategory, useDeleteCategory,
  useCategoryCatalogues,
} from '@/hooks/useVendor'
import { Loader2, Plus, Pencil, Trash2, X, ChevronRight, ChevronDown, FolderTree, Package, Wrench, Eye, GripVertical, Copy, Share2, Mail, MessageCircle } from 'lucide-react'
import { ResizableTable } from '@/components/table/ResizableTable'
import { toast } from 'sonner'

function shareCategory(cat: { name: string; description?: string; applies_to?: string }, action: 'copy' | 'whatsapp' | 'email' | 'native') {
  const text = `Browse our ${cat.name} category${cat.description ? ` - ${cat.description}` : ''}`
  if (action === 'copy') { navigator.clipboard.writeText(text); toast.success('Category info copied!') }
  else if (action === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  else if (action === 'email') window.open(`mailto:?subject=${encodeURIComponent(`Category: ${cat.name}`)}&body=${encodeURIComponent(text)}`, '_blank')
  else if (navigator.share) navigator.share({ title: cat.name, text }).catch(() => {})
  else { navigator.clipboard.writeText(text); toast.success('Category info copied!') }
}
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import type { VendorCategory, CustomField } from '@/types'
import { useNavigate } from 'react-router-dom'
import { formatCurrency, mediaUrl } from '@/lib/utils'

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

function appliesBadge(v: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    both: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Product & Service' },
    product: { bg: 'bg-green-50', text: 'text-green-700', label: 'Product' },
    service: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Service' },
  }
  const s = map[v] || map.both
  return <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${s.bg} ${s.text}`}>{s.label}</span>
}

// ── Category Tree Row ────────────────────────────────────────────
function CategoryRow({ cat, level, onEdit, onAddSub, onDelete, onViewCatalogue }: {
  cat: VendorCategory; level: number
  onEdit: (c: VendorCategory) => void
  onAddSub: (parentId: string) => void
  onDelete: (id: string) => void
  onViewCatalogue: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = cat.children && cat.children.length > 0
  const indent = level * 28

  return (
    <>
      <tr className="hover:bg-gray-50 group">
        <td className="px-4 py-3" style={{ paddingLeft: `${16 + indent}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button onClick={() => setExpanded(!expanded)} className="p-0.5 rounded hover:bg-gray-200 text-gray-400">
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <FolderTree className={`w-4 h-4 shrink-0 ${level === 0 ? 'text-blue-500' : 'text-gray-400'}`} />
            <div>
              <p className="text-sm font-medium">{cat.name}</p>
              {cat.description && <p className="text-xs text-gray-500">{cat.description}</p>}
            </div>
          </div>
        </td>
        <td className="px-4 py-3">{appliesBadge(cat.applies_to)}</td>
        <td className="px-4 py-3">
          {cat.custom_fields?.length > 0 && (
            <span className="text-xs text-gray-500">{cat.custom_fields.length} field{cat.custom_fields.length > 1 ? 's' : ''}</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {cat.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" title="Copy" onClick={() => shareCategory(cat, 'copy')}><Copy className="w-3.5 h-3.5 text-gray-500" /></Button>
            <Button variant="ghost" size="sm" title="WhatsApp" onClick={() => shareCategory(cat, 'whatsapp')}><MessageCircle className="w-3.5 h-3.5 text-green-600" /></Button>
            <Button variant="ghost" size="sm" title="Email" onClick={() => shareCategory(cat, 'email')}><Mail className="w-3.5 h-3.5 text-blue-600" /></Button>
            <Button variant="ghost" size="sm" title="View catalogue" onClick={() => onViewCatalogue(cat.id)}>
              <Eye className="w-4 h-4 text-blue-500" />
            </Button>
            <Button variant="ghost" size="sm" title="Add subcategory" onClick={() => onAddSub(cat.id)}>
              <Plus className="w-4 h-4 text-green-500" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onEdit(cat)}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => { if (confirm(`Delete "${cat.name}" and all its subcategories?`)) onDelete(cat.id) }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </td>
      </tr>
      {expanded && hasChildren && cat.children.map(child => (
        <CategoryRow key={child.id} cat={child} level={level + 1}
          onEdit={onEdit} onAddSub={onAddSub} onDelete={onDelete} onViewCatalogue={onViewCatalogue} />
      ))}
    </>
  )
}

// ── Catalogue Drawer ─────────────────────────────────────────────
function CatalogueDrawer({ categoryId, onClose }: { categoryId: string; onClose: () => void }) {
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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
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
                  <Wrench className="w-4 h-4 text-purple-600" /> Services ({data!.service_count})
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
          <button type="button" onClick={() => removeField(i)} className="p-1 text-red-400 hover:text-red-600 shrink-0 mt-0.5">
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

  const resetForm = () => {
    setShowForm(false); setEditing(null); setName(''); setDescription('')
    setAppliesTo('both'); setParentId(null); setSortOrder(0); setCustomFields([])
  }

  const openCreate = (pId?: string) => {
    resetForm()
    if (pId) setParentId(pId)
    setShowForm(true)
  }

  const openEdit = (cat: VendorCategory) => {
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

  // Flatten tree for parent dropdown
  const flattenCategories = (cats: VendorCategory[], prefix = ''): { id: string; label: string }[] => {
    const result: { id: string; label: string }[] = []
    for (const c of cats) {
      result.push({ id: c.id, label: prefix + c.name })
      if (c.children?.length) {
        result.push(...flattenCategories(c.children, prefix + c.name + ' / '))
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
                <div className="space-y-1.5">
                  <Label>Parent Category</Label>
                  <select value={parentId || ''} onChange={e => setParentId(e.target.value || null)} className={selectCls}>
                    <option value="">— Root (top-level) —</option>
                    {flatOptions
                      .filter(o => o.id !== editing?.id)
                      .map(o => <option key={o.id} value={o.id}>{o.label}</option>)
                    }
                  </select>
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
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending}>
                  {(createCategory.isPending || updateCategory.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editing ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Category Tree Table */}
      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search=""
            onSearchChange={() => {}}
            hideSearch
            sortOptions={[
              { value: 'name', label: 'Name' },
              { value: 'applies_to', label: 'Applies To' },
              { value: 'status', label: 'Status' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            hint="Sorts top-level categories"
          />
          <div className="overflow-x-auto">
            <ResizableTable tableId="categories" defaultWidths={[240, 120, 160, 90, 80]}>
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category / Subcategory</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Applies To</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Custom Fields</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : !data?.categories?.length ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                    No categories yet. Click "Add Category" to get started.
                  </td></tr>
                ) : sortedCategories.map(cat => (
                  <CategoryRow key={cat.id} cat={cat} level={0}
                    onEdit={openEdit}
                    onAddSub={(pid) => openCreate(pid)}
                    onDelete={(id) => deleteCategory.mutate(id)}
                    onViewCatalogue={(id) => setCatalogueId(id)}
                  />
                ))}
              </tbody>
            </ResizableTable>
          </div>
        </CardContent>
      </Card>

      {/* Catalogue Drawer */}
      {catalogueId && <CatalogueDrawer categoryId={catalogueId} onClose={() => setCatalogueId(null)} />}
    </div>
  )
}
