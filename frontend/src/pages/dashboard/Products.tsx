import { useState, useMemo } from 'react'
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '@/hooks/useProducts'
import type { Product, ProductCreate } from '@/types/product'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Package, Plus, Search, Loader2, Edit2, Trash2, X,
  EyeOff, Star, IndianRupee, AlertTriangle,
} from 'lucide-react'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'

type ViewMode = 'list' | 'create' | 'edit'

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-600',
}

const emptyProduct: Omit<ProductCreate, 'name' | 'price'> & { name: string; price: string } = {
  name: '',
  description: '',
  short_description: '',
  category: '',
  subcategory: '',
  tags: [],
  price: '',
  compare_at_price: undefined,
  cost_price: undefined,
  currency: 'INR',
  is_taxable: true,
  tax_rate: undefined,
  hsn_code: '',
  sku: '',
  barcode: '',
  track_inventory: true,
  quantity: 0,
  low_stock_threshold: 5,
  is_featured: false,
  is_visible: true,
}

export default function Products() {
  const [view, setView] = useState<ViewMode>('list')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useProducts({
    page,
    size: 20,
    status: statusFilter || undefined,
    search: search || undefined,
  })
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()

  const [form, setForm] = useState(emptyProduct)

  const openCreate = () => {
    setForm(emptyProduct)
    setEditingProduct(null)
    setView('create')
  }

  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setForm({
      name: product.name,
      description: product.description || '',
      short_description: product.short_description || '',
      category: product.category || '',
      subcategory: product.subcategory || '',
      tags: product.tags || [],
      price: String(product.price),
      compare_at_price: product.compare_at_price ?? undefined,
      cost_price: product.cost_price ?? undefined,
      currency: product.currency,
      is_taxable: product.is_taxable ?? true,
      tax_rate: product.tax_rate ?? undefined,
      hsn_code: product.hsn_code || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      track_inventory: product.track_inventory,
      quantity: product.quantity,
      low_stock_threshold: product.low_stock_threshold,
      is_featured: product.is_featured,
      is_visible: product.is_visible,
    })
    setView('edit')
  }

  const handleSave = () => {
    const payload: ProductCreate = {
      name: form.name,
      description: form.description || undefined,
      short_description: form.short_description || undefined,
      category: form.category || undefined,
      subcategory: form.subcategory || undefined,
      tags: form.tags,
      price: parseFloat(form.price),
      compare_at_price: form.compare_at_price,
      cost_price: form.cost_price,
      currency: form.currency,
      is_taxable: form.is_taxable,
      tax_rate: form.tax_rate,
      hsn_code: form.hsn_code || undefined,
      sku: form.sku || undefined,
      barcode: form.barcode || undefined,
      track_inventory: form.track_inventory,
      quantity: form.quantity,
      low_stock_threshold: form.low_stock_threshold,
      is_featured: form.is_featured,
      is_visible: form.is_visible,
    }

    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, data: payload }, { onSuccess: () => setView('list') })
    } else {
      createProduct.mutate(payload, { onSuccess: () => setView('list') })
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      deleteProduct.mutate(id)
    }
  }

  const products = useMemo(() => {
    const items = data?.items || []
    return processRows(
      items,
      '',
      () => [],
      sortKey,
      sortDir,
      {
        name: (p) => p.name,
        category: (p) => p.category || '',
        price: (p) => p.price,
        quantity: (p) => p.quantity,
        status: (p) => p.status,
      },
    )
  }, [data?.items, sortKey, sortDir])
  const total = data?.total || 0
  const isSaving = createProduct.isPending || updateProduct.isPending

  // ── Create / Edit Form ──
  if (view === 'create' || view === 'edit') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {view === 'create' ? 'Add Product' : `Edit: ${editingProduct?.name}`}
          </h1>
          <Button variant="ghost" onClick={() => setView('list')}><X className="w-4 h-4 mr-1" /> Cancel</Button>
        </div>

        <Card>
          <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Wireless Mouse" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Electronics" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Short Description</Label>
              <Input value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} placeholder="One-line summary" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Detailed product description..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pricing & Tax</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Selling Price (INR) *</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="999" />
              </div>
              <div className="space-y-2">
                <Label>MRP / Compare Price</Label>
                <Input type="number" value={form.compare_at_price ?? ''} onChange={(e) => setForm({ ...form, compare_at_price: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="1499" />
              </div>
              <div className="space-y-2">
                <Label>Cost Price</Label>
                <Input type="number" value={form.cost_price ?? ''} onChange={(e) => setForm({ ...form, cost_price: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="500" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>GST Rate (%)</Label>
                <select value={form.tax_rate ?? ''} onChange={(e) => setForm({ ...form, tax_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">No GST</option>
                  <option value="0">0% (Exempt)</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>HSN Code</Label>
                <Input value={form.hsn_code} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} placeholder="e.g. 84713010" maxLength={8} className="font-mono" />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_taxable} onChange={(e) => setForm({ ...form, is_taxable: e.target.checked })} className="rounded" />
                  Taxable
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Inventory & SKU</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="WM-001" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Barcode</Label>
                <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="8901234567890" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Stock Quantity</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Low Stock Alert At</Label>
                <Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: parseInt(e.target.value) || 5 })} />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.track_inventory} onChange={(e) => setForm({ ...form, track_inventory: e.target.checked })} className="rounded" />
                  Track Inventory
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} className="rounded" />
                  Featured
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="cancel" onClick={() => setView('list')}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !form.name || !form.price} className="min-w-[140px]">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {view === 'create' ? 'Create Product' : 'Save Changes'}
          </Button>
        </div>
      </div>
    )
  }

  // ── Product List ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" /> Products
          </h1>
          <p className="text-sm text-gray-500 mt-1">{total} product{total !== 1 ? 's' : ''} total</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search products..."
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Product Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-medium text-gray-600">No products yet</p>
            <p className="text-sm text-gray-500 mt-1">Add your first product to get started.</p>
            <Button onClick={openCreate} className="mt-4 gap-2"><Plus className="w-4 h-4" /> Add Product</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <TableToolbar
              search=""
              onSearchChange={() => {}}
              hideSearch
              hint="Sorting applies to the current page."
              sortOptions={[
                { value: 'name', label: 'Product' },
                { value: 'category', label: 'Category' },
                { value: 'price', label: 'Price' },
                { value: 'quantity', label: 'Stock' },
                { value: 'status', label: 'Status' },
              ]}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortKeyChange={setSortKey}
              onSortDirChange={setSortDir}
            />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/50 text-left text-gray-500">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3">GST</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] ? (
                          <img src={p.images[0].url} alt={p.name} className="w-10 h-10 rounded-lg object-cover border" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium flex items-center gap-1.5">
                            {p.name}
                            {p.is_featured && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
                            {!p.is_visible && <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
                          </p>
                          {p.sku && <p className="text-xs text-gray-400 font-mono">{p.sku}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.category || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <IndianRupee className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium">{p.price}</span>
                      </div>
                      {p.compare_at_price && p.compare_at_price > p.price && (
                        <p className="text-xs text-gray-400 line-through text-right">₹{p.compare_at_price}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${p.track_inventory && p.quantity <= p.low_stock_threshold ? 'text-red-600' : ''}`}>
                        {p.track_inventory ? p.quantity : '∞'}
                      </span>
                      {p.track_inventory && p.quantity <= p.low_stock_threshold && p.quantity > 0 && (
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-500 inline ml-1" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.tax_rate != null ? (
                        <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{p.tax_rate}%</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {data.page} of {data.pages} ({data.total} products)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
