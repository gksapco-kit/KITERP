import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TablePagination } from '@/components/table/TablePagination'
import { useProducts, useDeleteProduct, useRestoreProduct, useUpdateProduct, useCategoryTree } from '@/hooks/useVendor'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { useVendorStore } from '@/stores/vendorStore'
import { flattenCategoryTree, filterCategoryTree } from '@/lib/categoryHierarchy'
import { formatCurrency, formatDate, mediaUrl } from '@/lib/utils'
import { processRows, type SortDir } from '@/lib/tableList'
import { ResizableTable } from '@/components/table/ResizableTable'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import {
  VariantInlineEditor,
  formatVariantPriceRange,
  formatVariantStockTotal,
} from '@/components/products/VariantInlineEditor'
import type { Product } from '@/types'
import { toast } from 'sonner'
import {
  Plus, Search, Pencil, Trash2, Loader2, X,
  Filter, Copy, Share2, Mail, MessageCircle, MoreVertical, Package, Eye,
  Image as ImageIcon, ChevronUp, ChevronDown, ChevronsUpDown, ScanLine,
  Layers, RotateCcw,
} from 'lucide-react'
import { formatVariantDisplayLabel } from '@/lib/productVariantPresets'
import { variantToUpdatePayload } from '@/lib/productVariants'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import { vendorApi } from '@/api/vendor'
import { BarcodeScannerModal } from '@/components/scanner/BarcodeScannerModal'
import {
  CatalogFilterField,
  CatalogListFiltersPanel,
  PRODUCT_STATUS_FILTER_OPTIONS,
  PRODUCT_STOCK_FILTER_OPTIONS,
  PRODUCT_TYPE_FILTER_OPTIONS,
  productTypeLabel,
  VISIBILITY_FILTER_OPTIONS,
  type CatalogActiveFilter,
} from '@/components/catalog/CatalogListFilters'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { showBarcodeNotFound } from '@/components/scanner/BarcodeNotFoundToast'

const resolveUrl = mediaUrl

function shareProduct(product: { name: string; price: number; category?: string; slug?: string }, action: 'copy' | 'whatsapp' | 'email' | 'native') {
  const text = `Check out ${product.name} - ${formatCurrency(product.price)}${product.category ? ` in ${product.category}` : ''}`
  if (action === 'copy') { navigator.clipboard.writeText(text); toast.success('Product info copied!') }
  else if (action === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  else if (action === 'email') window.open(`mailto:?subject=${encodeURIComponent(`Product: ${product.name}`)}&body=${encodeURIComponent(text)}`, '_blank')
  else if (navigator.share) navigator.share({ title: product.name, text }).catch(() => {})
  else { navigator.clipboard.writeText(text); toast.success('Product info copied!') }
}

function MoreMenu({
  product,
  onView,
  onEdit,
  onDelete,
}: {
  product: Product
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, right: 0, openUp: false })

  // Position menu anchored to the trigger button via portal
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuHeight = 320
    const openUp = window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight
    setPos({
      top: openUp ? rect.top + window.scrollY - 4 : rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
      openUp,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
      setConfirmDelete(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const menu = open ? createPortal(
    <div
      ref={menuRef}
      style={{ position: 'absolute', top: pos.top, right: pos.right, zIndex: 9999, transform: pos.openUp ? 'translateY(-100%)' : undefined }}
      className="w-44 bg-popover text-popover-foreground rounded-lg border border-border shadow-lg py-1 animate-in fade-in-0 zoom-in-95 max-h-[min(90vh,24rem)] overflow-y-auto"
    >
      <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        onClick={() => { onView(); setOpen(false) }}>
        <Eye className="w-4 h-4 text-blue-500" /> View
      </button>
      <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        onClick={() => { onEdit(); setOpen(false) }}>
        <Pencil className="w-4 h-4 text-gray-500" /> Edit
      </button>
      <div className="border-t my-1" />
      <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        onClick={() => { shareProduct(product, 'copy'); setOpen(false) }}>
        <Copy className="w-4 h-4 text-gray-400" /> Copy Info
      </button>
      <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        onClick={() => { shareProduct(product, 'whatsapp'); setOpen(false) }}>
        <MessageCircle className="w-4 h-4 text-green-500" /> WhatsApp
      </button>
      <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        onClick={() => { shareProduct(product, 'email'); setOpen(false) }}>
        <Mail className="w-4 h-4 text-blue-500" /> Email
      </button>
      <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        onClick={() => { shareProduct(product, 'native'); setOpen(false) }}>
        <Share2 className="w-4 h-4 text-primary/80" /> Share
      </button>
      <div className="border-t my-1" />
      {confirmDelete ? (
        <div className="px-3 py-2 space-y-2">
          <p className="text-xs font-medium text-red-600">Delete this product?</p>
          <div className="flex gap-2">
            <button className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              onClick={() => { onDelete(); setOpen(false); setConfirmDelete(false) }}>
              Yes, Delete
            </button>
            <button className="btn-cancel flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors"
              onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          onClick={() => setConfirmDelete(true)}>
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      )}
    </div>,
    document.body,
  ) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-gray-500 hover:bg-gray-100 transition-colors"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); setConfirmDelete(false) }}
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {menu}
    </>
  )
}

const ACTIVE_INACTIVE_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

export default function Products() {
  const navigate = useNavigate()
  const selectedStore = useVendorStore(s => s.selectedStore)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('')
  const [visibility, setVisibility] = useState('')
  const [category, setCategory] = useState('')
  const [productType, setProductType] = useState('')
  const [stock, setStock] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<'product' | 'variant'>(() => {
    try { return (localStorage.getItem('kiterp:products:viewMode') as 'product' | 'variant') || 'product' } catch { return 'product' }
  })
  const [showDeleted, setShowDeleted] = useState(false)
  const { data: categoryData } = useCategoryTree()
  const productCategories = useMemo(
    () => flattenCategoryTree(filterCategoryTree(categoryData?.categories || [], 'product')),
    [categoryData?.categories],
  )

  const categoryRoot = category.includes('::') ? category.split('::')[0] : category
  const categorySub = category.includes('::') ? category.split('::').slice(1).join('::') : ''

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Product view: server-paginated by product. Variant view: load a large product
  // batch, flatten to variant rows, then paginate those rows by pageSize.
  // Trash view is always product-wise.
  const listViewMode = showDeleted ? 'product' : viewMode
  const { data, isLoading } = useProducts({
    page: listViewMode === 'variant' ? 1 : page,
    size: listViewMode === 'variant' ? 500 : pageSize,
    search: search || undefined,
    status: status || undefined,
    category: categoryRoot || undefined,
    is_visible: visibility === 'true' ? true : visibility === 'false' ? false : undefined,
    product_type: productType || undefined,
    stock: stock || undefined,
    store_id: selectedStore?.id || undefined,
    deleted_only: showDeleted || undefined,
  })
  const deleteProduct = useDeleteProduct()
  const restoreProduct = useRestoreProduct()
  const updateProduct = useUpdateProduct()
  const { savingCellKey, setSavingCellKey, cellKey, patchField: patchProductField } = useInlineFieldPatch(updateProduct)

  const [productDeleteConfirm, setProductDeleteConfirm] = useState<{
    id: string
    name: string
    permanent?: boolean
  } | null>(null)

  const activeFilterCount = [status, visibility, category, productType, stock].filter(Boolean).length
  const hasActiveQuery = Boolean(search.trim() || activeFilterCount > 0)
  const clearFilters = () => {
    setStatus('')
    setVisibility('')
    setCategory('')
    setProductType('')
    setStock('')
    setPage(1)
  }

  const activeFilters = useMemo((): CatalogActiveFilter[] => {
    const chips: CatalogActiveFilter[] = []
    if (status) {
      chips.push({
        key: 'status',
        label: `Status: ${PRODUCT_STATUS_FILTER_OPTIONS.find(o => o.value === status)?.label || status}`,
        onRemove: () => { setStatus(''); setPage(1) },
      })
    }
    if (visibility) {
      chips.push({
        key: 'visibility',
        label: VISIBILITY_FILTER_OPTIONS.find(o => o.value === visibility)?.label || 'Visibility',
        onRemove: () => { setVisibility(''); setPage(1) },
      })
    }
    if (category) {
      chips.push({
        key: 'category',
        label: `Category: ${productCategories.find(c => (c.subcategory ? `${c.category}::${c.subcategory}` : c.category) === category)?.label || category}`,
        onRemove: () => { setCategory(''); setPage(1) },
      })
    }
    if (productType) {
      chips.push({
        key: 'product_type',
        label: `Type: ${PRODUCT_TYPE_FILTER_OPTIONS.find(o => o.value === productType)?.label || productType}`,
        onRemove: () => { setProductType(''); setPage(1) },
      })
    }
    if (stock) {
      chips.push({
        key: 'stock',
        label: PRODUCT_STOCK_FILTER_OPTIONS.find(o => o.value === stock)?.label || 'Stock',
        onRemove: () => { setStock(''); setPage(1) },
      })
    }
    return chips
  }, [status, visibility, category, productType, stock, productCategories])

  const handleBarcodeScan = useCallback(async (code: string) => {
    if (scanLoading) return
    setScanLoading(true)
    setShowScanner(false)
    try {
      const result = await vendorApi.barcodeLookup(code)
      navigate(`/products/${result.product.id}`)
    } catch (err: any) {
      if (err?.response?.status === 404) {
        showBarcodeNotFound(code, () => navigate(`/products/new?barcode=${encodeURIComponent(code)}`))
      } else {
        toast.error('Barcode scan error. Please try again.')
      }
    } finally {
      setScanLoading(false)
    }
  }, [scanLoading, navigate])

  useBarcodeScanner({ enabled: !showScanner, onScan: handleBarcodeScan })

  const displayProducts = useMemo(() => {
    if (!data?.items?.length) return []
    const items = categorySub
      ? (data.items as Product[]).filter(p => (p.subcategory || '') === categorySub)
      : (data.items as Product[])
    return processRows(
      items,
      '',
      () => [],
      sortKey,
      sortDir,
      {
        created_at: (p) => (p.created_at ? new Date(p.created_at).getTime() : 0),
        name: (p) => p.name,
        brand: (p) => p.brand || '',
        product_type: (p) => p.product_type || 'physical',
        price: (p) => p.price,
        quantity: (p) => p.quantity,
        status: (p) => p.status,
      },
    )
  }, [data?.items, sortKey, sortDir, categorySub])

  const patchVariantFields = useCallback(async (
    productId: string,
    variantId: string,
    updates: Record<string, unknown>,
    savingField?: string,
  ) => {
    const product = displayProducts.find(p => p.id === productId)
    if (!product) {
      toast.error('Product not found')
      return
    }
    const field = savingField ?? Object.keys(updates)[0] ?? 'variant'
    const key = `${productId}:variant:${variantId}:${field}`
    setSavingCellKey(key)
    try {
      const updatedVariants = (product.variants || []).map((v) => {
        const payload = variantToUpdatePayload(v)
        return v.id === variantId ? { ...payload, ...updates } : payload
      })
      await updateProduct.mutateAsync({ id: productId, data: { variants: updatedVariants } })
    } finally {
      setSavingCellKey(null)
    }
  }, [displayProducts, updateProduct])

  const patchVariantField = useCallback(async (
    productId: string,
    variantId: string,
    field: 'price' | 'quantity',
    value: number,
  ) => patchVariantFields(productId, variantId, { [field]: value }, field),
  [patchVariantFields])

  // Flattened variant rows for variant-wise view
  const variantRows = useMemo(() => {
    if (viewMode !== 'variant') return []
    const rows: {
      productId: string; productName: string; productCategory: string; productType: string; thumbUrl: string
      groupKey: string; variantName: string; variantRawName: string; variantCount: number; variantIds: string[]
      sku: string; uom: string; uom_quantity: number | null
      price: number; priceHigh: number; quantity: number; stock_status: string; low_stock_threshold: number; currency: string; is_active: boolean
    }[] = []
    for (const product of displayProducts) {
      const primaryImg = product.images?.find((img: any) => img.is_primary) || product.images?.[0]
      const productThumb = primaryImg ? resolveUrl(primaryImg.url) : ''
      const variants = product.variants || []
      if (variants.length === 0) {
        rows.push({
          productId: product.id, productName: product.name,
          productCategory: product.category || 'Uncategorized', productType: product.product_type || 'physical',
          thumbUrl: productThumb,
          groupKey: 'default', variantName: '—', variantRawName: '', variantCount: 0, variantIds: [],
          sku: product.sku || '', uom: product.uom || 'piece', uom_quantity: product.uom_quantity ?? null,
          price: product.price, priceHigh: product.price, quantity: product.quantity ?? 0,
          stock_status: product.stock_status || 'in_stock', low_stock_threshold: product.low_stock_threshold ?? 5,
          currency: product.currency || 'INR', is_active: product.status === 'active',
        })
      } else {
        for (const v of variants) {
          const vImg = (v.media || []).find((img) => img?.url)
          const vThumb = vImg ? resolveUrl(vImg.url) : productThumb
          const price = v.price ?? 0
          const qty = v.quantity ?? 0
          rows.push({
            productId: product.id, productName: product.name,
            productCategory: product.category || 'Uncategorized', productType: product.product_type || 'physical',
            thumbUrl: vThumb,
            groupKey: v.id || `${product.id}-${v.name || 'variant'}`,
            variantName: formatVariantDisplayLabel(v.name || '', v.attributes),
            variantRawName: v.name || '',
            variantCount: 1,
            variantIds: v.id ? [v.id] : [],
            sku: v.sku || '',
            uom: v.uom || 'piece',
            uom_quantity: v.uom_quantity ?? null,
            price,
            priceHigh: price,
            quantity: qty,
            stock_status: v.stock_status || (qty === 0 ? 'out_of_stock' : 'in_stock'),
            low_stock_threshold: v.low_stock_threshold ?? 5,
            currency: v.currency || product.currency || 'INR',
            is_active: v.is_active !== false,
          })
        }
      }
    }
    return rows
  }, [displayProducts, viewMode])

  const variantTotal = variantRows.length
  const variantPages = Math.max(1, Math.ceil(variantTotal / pageSize) || 1)
  const pagedVariantRows = useMemo(() => {
    if (viewMode !== 'variant') return []
    const start = (page - 1) * pageSize
    return variantRows.slice(start, start + pageSize)
  }, [viewMode, variantRows, page, pageSize])

  useEffect(() => {
    if (listViewMode === 'variant' && page > variantPages) setPage(1)
  }, [viewMode, page, variantPages])

  const setViewModePersisted = (mode: 'product' | 'variant') => {
    setViewMode(mode)
    setPage(1)
    try { localStorage.setItem('kiterp:products:viewMode', mode) } catch { /* ignore */ }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {showDeleted ? 'Deleted Products' : 'Products'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {showDeleted
              ? `${data?.total ?? 0} deleted product${(data?.total ?? 0) === 1 ? '' : 's'}`
              : `${data?.total ?? 0} total products`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          {!showDeleted && (
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewModePersisted('product')}
              title="Product-wise view"
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-all ${
                viewMode === 'product'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Product
            </button>
            <button
              type="button"
              onClick={() => setViewModePersisted('variant')}
              title="Variant-wise view"
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-all ${
                viewMode === 'variant'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Variant
            </button>
          </div>
          )}
          <Button
            variant={showDeleted ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => {
              setShowDeleted((v) => !v)
              setPage(1)
              setProductDeleteConfirm(null)
            }}
          >
            <Trash2 className={`w-4 h-4 ${showDeleted ? '' : 'text-red-500'}`} />
            {showDeleted ? 'Back to products' : 'Deleted'}
          </Button>
          {!showDeleted && (
            <>
          <Button variant="outline" className="gap-2" onClick={() => setShowScanner(true)} disabled={scanLoading}>
            {scanLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4 text-blue-500" />}
            Scan
          </Button>
          <Button onClick={() => navigate('/products/new')} className="gap-2 shadow-sm"><Plus className="w-4 h-4" />Add Product</Button>
            </>
          )}
        </div>
      </div>


      {/* Search + Filters */}
      <Card className="border-gray-200/80">
        <CardContent className="pt-5 pb-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                data-kiterp-search-field
                placeholder="Search products..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
                aria-label="Search products"
              />
            </div>
            <Button type="button" variant="outline" className="gap-2" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4" />Filters
              {activeFilterCount > 0 && <span className="ml-1 px-1.5 py-0.5 text-xs leading-none font-bold bg-primary text-white rounded-full">{activeFilterCount}</span>}
            </Button>
          </div>

          {showFilters && (
            <CatalogListFiltersPanel activeFilters={activeFilters} onClearAll={clearFilters}>
              <CatalogFilterField
                label="Status"
                value={status}
                onChange={(value) => { setStatus(value); setPage(1) }}
                options={PRODUCT_STATUS_FILTER_OPTIONS}
                placeholder="All statuses"
              />
              <CatalogFilterField
                label="Visibility"
                value={visibility}
                onChange={(value) => { setVisibility(value); setPage(1) }}
                options={VISIBILITY_FILTER_OPTIONS}
                placeholder="All visibility"
              />
              <CatalogFilterField
                label="Category"
                value={category}
                onChange={(value) => { setCategory(value); setPage(1) }}
                options={productCategories.map(c => ({
                  value: c.subcategory ? `${c.category}::${c.subcategory}` : c.category,
                  label: c.label,
                }))}
                placeholder="All categories"
              />
              <CatalogFilterField
                label="Product type"
                value={productType}
                onChange={(value) => { setProductType(value); setPage(1) }}
                options={PRODUCT_TYPE_FILTER_OPTIONS}
                placeholder="All types"
              />
              <CatalogFilterField
                label="Stock"
                value={stock}
                onChange={(value) => { setStock(value); setPage(1) }}
                options={PRODUCT_STOCK_FILTER_OPTIONS}
                placeholder="Any stock"
              />
            </CatalogListFiltersPanel>
          )}
          {!showFilters && activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={filter.onRemove}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  {filter.label}
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              ))}
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-gray-500" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          )}
          <p className="text-xs text-gray-400 px-1">{INLINE_EDIT_HINT}</p>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-gray-200/80 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">

          {/* ── Product-wise view ── */}
          {listViewMode === 'product' && (
          <ResizableTable tableId="products-v2" defaultWidths={[280, 120, 90, 100, 110, 110, 120]}>
            <thead>
              <tr className="border-b bg-gray-50/80">
                {([
                  { key: 'name', label: 'Product', px: 'px-5', align: 'text-left' },
                  { key: 'brand', label: 'Brand', px: 'px-4', align: 'text-left' },
                  { key: 'product_type', label: 'Type', px: 'px-4', align: 'text-left' },
                  { key: 'price', label: 'Price', px: 'px-4', align: 'text-left' },
                  { key: 'quantity', label: 'Stock', px: 'px-4', align: 'text-left' },
                  { key: 'status', label: 'Status', px: 'px-4', align: 'text-left' },
                ] as { key: string; label: string; px: string; align: string }[]).map(col => {
                  const active = sortKey === col.key
                  return (
                    <th key={col.key} className={`${col.align} ${col.px} py-3 text-xs font-medium uppercase tracking-wider`}>
                      <button
                        onClick={() => {
                          if (sortKey === col.key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
                          else { setSortKey(col.key); setSortDir('asc') }
                        }}
                        className={`inline-flex items-center gap-1 hover:text-gray-700 transition-colors ${active ? 'text-blue-600' : 'text-gray-400'}`}
                      >
                        {col.label}
                        {active
                          ? sortDir === 'asc'
                            ? <ChevronUp className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />
                          : <ChevronsUpDown className="w-3 h-3 opacity-40" />
                        }
                      </button>
                    </th>
                  )
                })}
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Actions</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : !displayProducts.length ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    {showDeleted ? (
                      <>
                        <p className="text-sm font-medium text-gray-500 mb-1">No deleted products</p>
                        <p className="text-xs text-gray-400 mb-4">Deleted products will appear here so you can restore them</p>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowDeleted(false)}>
                          Back to products
                        </Button>
                      </>
                    ) : hasActiveQuery ? (
                      <>
                        <p className="text-sm font-medium text-gray-500 mb-1">No products found</p>
                        <p className="text-xs text-gray-400 mb-4">
                          {search.trim()
                            ? `No results for "${search.trim()}". Try a different search or clear your filters.`
                            : 'No products match your current filters. Try adjusting or clearing them.'}
                        </p>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setSearch(''); setSearchInput(''); clearFilters() }}>
                          Clear search & filters
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-500 mb-1">No products yet</p>
                        <p className="text-xs text-gray-400 mb-4">Create your first product to get started</p>
                        <Button size="sm" onClick={() => navigate('/products/new')} className="gap-1.5">
                          <Plus className="w-3.5 h-3.5" /> Add Product
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ) : displayProducts.map((product) => {
                const variants = product.variants || []
                const hasVariants = variants.length > 0
                const primaryImg = product.images?.find((img: any) => img.is_primary) || product.images?.[0]
                const variantImg = !primaryImg
                  ? variants.flatMap((v: any) => v.images || v.media || []).find((img: any) => img?.url)
                  : null
                const thumbUrl = primaryImg ? resolveUrl(primaryImg.url) : variantImg ? resolveUrl(variantImg.url) : ''

                return (
                <tr
                  key={product.id}
                  className={`hover:bg-gray-50/80 transition-colors group ${showDeleted ? '' : 'cursor-pointer'}`}
                  onClick={showDeleted ? undefined : onClickableTableRow(() => navigate(`/products/${product.id}`))}
                >
                  <td className="px-5 py-3 max-w-[280px]">
                    <div className="flex items-center gap-3 min-w-0">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 border border-gray-200/80 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200/80 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <InlineEditCell
                          value={product.name}
                          saving={savingCellKey === cellKey(product.id, 'name')}
                          validate={(v) => String(v).trim().length < 2 ? 'Min 2 characters' : null}
                          onSave={(v) => patchProductField(product.id, 'name', String(v).trim())}
                          className="-mx-1.5"
                          title="Edit product name"
                        >
                          <span className="text-sm font-medium text-gray-900">{product.name}</span>
                        </InlineEditCell>
                        <InlineEditCell
                          value={product.category || ''}
                          saving={savingCellKey === cellKey(product.id, 'category')}
                          onSave={(v) => patchProductField(product.id, 'category', String(v).trim())}
                          title="Edit category"
                        >
                          <span className="text-xs text-gray-400">{product.category || 'Uncategorized'}</span>
                        </InlineEditCell>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[120px]">
                    <InlineEditCell
                      value={product.brand || ''}
                      saving={savingCellKey === cellKey(product.id, 'brand')}
                      onSave={(v) => patchProductField(product.id, 'brand', String(v).trim())}
                      title="Edit brand"
                    >
                      <span className="text-sm text-gray-600">{product.brand || '—'}</span>
                    </InlineEditCell>
                  </td>
                  <td className="px-4 py-3">
                    <InlineEditCell
                      type="select"
                      value={product.product_type || 'physical'}
                      options={PRODUCT_TYPE_FILTER_OPTIONS}
                      saving={savingCellKey === cellKey(product.id, 'product_type')}
                      onSave={(v) => patchProductField(product.id, 'product_type', v)}
                      title="Edit product type"
                    >
                      <span className="px-2 py-0.5 text-xs rounded-full font-semibold bg-blue-50 text-blue-700 whitespace-nowrap">
                        {productTypeLabel(product.product_type)}
                      </span>
                    </InlineEditCell>
                  </td>
                  <td className="px-4 py-3 max-w-[110px]">
                    {(() => {
                      if (!hasVariants) {
                        return (
                          <InlineEditCell
                            type="number"
                            value={product.price}
                            min={0}
                            step="0.01"
                            saving={savingCellKey === cellKey(product.id, 'price')}
                            validate={(v) => Number(v) < 0 ? 'Price must be 0 or more' : null}
                            onSave={(v) => patchProductField(product.id, 'price', Number(v))}
                            title="Edit price"
                          >
                            <span className="text-sm font-medium text-gray-900">{formatCurrency(product.price)}</span>
                          </InlineEditCell>
                        )
                      }
                      const prices = variants.map((v) => v.price).filter((p) => p > 0).sort((a, b) => a - b)
                      if (prices.length === 0) return <span className="text-sm text-gray-400 px-1.5">—</span>
                      const { text, sub } = formatVariantPriceRange(variants, product.currency)
                      return (
                        <VariantInlineEditor
                          productId={product.id}
                          variants={variants}
                          field="price"
                          currency={product.currency}
                          savingKey={savingCellKey}
                          onSaveVariant={(variantId, value) => patchVariantField(product.id, variantId, 'price', value)}
                          display={(
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{text}</p>
                              <p className="text-xs text-gray-400">{sub}</p>
                            </div>
                          )}
                        />
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3 max-w-[110px]">
                    {(() => {
                      if (!hasVariants) {
                        const qty = product.quantity ?? 0
                        const sts = product.stock_status || 'in_stock'
                        const isOut = sts === 'out_of_stock' || sts === 'discontinued'
                        const isLow = !isOut && qty <= (product.low_stock_threshold ?? 5)
                        return (
                          <div className="space-y-1">
                            <InlineEditCell
                              type="number"
                              value={qty}
                              min={0}
                              step="1"
                              saving={savingCellKey === cellKey(product.id, 'quantity')}
                              validate={(v) => Number(v) < 0 || !Number.isInteger(Number(v)) ? 'Enter a whole number ≥ 0' : null}
                              parse={(raw) => Math.max(0, Math.round(Number(raw) || 0))}
                              onSave={(v) => patchProductField(product.id, 'quantity', Number(v))}
                              title="Edit stock quantity"
                            >
                              <span className={`text-sm font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-800'}`}>
                                {qty}
                              </span>
                            </InlineEditCell>
                            <InlineEditCell
                              type="select"
                              value={sts}
                              options={PRODUCT_STOCK_FILTER_OPTIONS}
                              saving={savingCellKey === cellKey(product.id, 'stock_status')}
                              onSave={(v) => patchProductField(product.id, 'stock_status', v)}
                              title="Edit stock status"
                            >
                              <span className={`text-xs ${isOut ? 'text-red-400' : 'text-gray-400'}`}>{sts.replace(/_/g, ' ')}</span>
                            </InlineEditCell>
                          </div>
                        )
                      }
                      const { total, outCount, isAllOut, hasLow, variantCount } = formatVariantStockTotal(variants)
                      return (
                        <VariantInlineEditor
                          productId={product.id}
                          variants={variants}
                          field="quantity"
                          savingKey={savingCellKey}
                          onSaveVariant={(variantId, value) => patchVariantField(product.id, variantId, 'quantity', value)}
                          display={(
                            <div className="min-w-0">
                              <p>
                                <span className={`text-sm font-semibold ${isAllOut ? 'text-red-600' : hasLow ? 'text-amber-600' : 'text-gray-800'}`}>
                                  {total.toLocaleString()}
                                </span>
                                <span className="text-xs text-gray-400 ml-1">total</span>
                              </p>
                              {outCount > 0 && !isAllOut && (
                                <p className="text-xs text-red-400 truncate">{outCount}/{variantCount} out of stock</p>
                              )}
                              {isAllOut && <p className="text-xs text-red-400">all out of stock</p>}
                            </div>
                          )}
                        />
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {showDeleted ? (
                      <div className="flex flex-col gap-1 min-w-[6.5rem]">
                        <span className="px-2 py-0.5 text-xs rounded-full font-semibold whitespace-nowrap bg-red-50 text-red-600 w-fit">
                          Deleted
                        </span>
                        {product.deleted_at && (
                          <span className="text-[10px] text-gray-400">
                            {formatDate(product.deleted_at)}
                          </span>
                        )}
                      </div>
                    ) : (
                    <div className="flex flex-col gap-1.5 min-w-[6.5rem] py-0.5">
                      <InlineEditCell
                        type="select"
                        value={product.status}
                        options={PRODUCT_STATUS_FILTER_OPTIONS}
                        saving={savingCellKey === cellKey(product.id, 'status')}
                        onSave={(v) => patchProductField(product.id, 'status', v)}
                        title="Edit status"
                        truncateContent={false}
                      >
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full font-semibold whitespace-nowrap capitalize leading-tight ${
                          product.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : product.status === 'archived'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-gray-100 text-gray-700'
                        }`}>
                          {product.status}
                        </span>
                      </InlineEditCell>
                      <InlineEditCell
                        type="select"
                        value={product.is_visible ? 'true' : 'false'}
                        options={VISIBILITY_FILTER_OPTIONS}
                        saving={savingCellKey === cellKey(product.id, 'is_visible')}
                        onSave={(v) => patchProductField(product.id, 'is_visible', v === 'true')}
                        title="Edit visibility"
                        truncateContent={false}
                      >
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full font-semibold whitespace-nowrap leading-tight ${
                          product.is_visible
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-amber-50 text-amber-800 border border-amber-100'
                        }`}>
                          {product.is_visible ? 'Visible' : 'Hidden'}
                        </span>
                      </InlineEditCell>
                    </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {showDeleted ? (
                      <div className="flex gap-1 justify-end items-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          disabled={restoreProduct.isPending}
                          title="Restore product"
                          onClick={() => restoreProduct.mutate(product.id)}
                        >
                          {restoreProduct.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          title="Delete permanently"
                          onClick={() => setProductDeleteConfirm({ id: product.id, name: product.name, permanent: true })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-end items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="View product"
                          onClick={() => navigate(`/products/${product.id}`)}
                        >
                          <Eye className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Edit product"
                          onClick={() => navigate(`/products/${product.id}?edit=true`)}
                        >
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          title="Move to trash"
                          onClick={() => setProductDeleteConfirm({ id: product.id, name: product.name })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <MoreMenu
                          product={product}
                          onView={() => navigate(`/products/${product.id}`)}
                          onEdit={() => navigate(`/products/${product.id}?edit=true`)}
                          onDelete={() => deleteProduct.mutate(product.id)}
                        />
                      </div>
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </ResizableTable>
          )}

          {/* ── Variant-wise view ── */}
          {listViewMode === 'variant' && (
          <ResizableTable tableId="products-variant-v2" defaultWidths={[220, 140, 70, 90, 80, 90, 100, 90, 120]}>
            <thead>
              <tr className="border-b bg-gray-50/80">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Product</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Variant</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Count</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>SKU</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Pack</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Price</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Stock</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap"><TableColumnLabel>Actions</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={9} className="px-6 py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : !pagedVariantRows.length ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <Layers className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-500 mb-1">No variants found</p>
                    {hasActiveQuery && (
                      <Button size="sm" variant="outline" className="gap-1.5 mt-3" onClick={() => { setSearch(''); setSearchInput(''); clearFilters() }}>
                        Clear search & filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : pagedVariantRows.map((row, i) => {
                const sym = row.currency === 'INR' ? '₹' : '$'
                const isOut = row.stock_status === 'out_of_stock' || row.stock_status === 'discontinued'
                const isLow = !isOut && row.quantity <= row.low_stock_threshold
                const packLabel = row.uom_quantity != null && row.uom_quantity > 0
                  ? `${row.uom_quantity} ${row.uom}`
                  : row.uom
                // Group header: first row of a new product gets a subtle top border accent
                const prevProductId = i > 0 ? pagedVariantRows[i - 1].productId : null
                const isFirstOfProduct = prevProductId !== row.productId

                const variantId = row.variantIds[0]
                const variantPriceKey = variantId ? `${row.productId}:variant:${variantId}:price` : cellKey(row.productId, 'price')
                const variantQtyKey = variantId ? `${row.productId}:variant:${variantId}:quantity` : cellKey(row.productId, 'quantity')

                return (
                  <tr
                    key={`${row.productId}-${row.groupKey}-${i}`}
                    className={`hover:bg-gray-50/80 cursor-pointer transition-colors group ${isFirstOfProduct && i > 0 ? 'border-t-2 border-t-gray-200' : ''}`}
                    onClick={onClickableTableRow(() => navigate(`/products/${row.productId}`))}
                  >
                    <td className="px-5 py-2.5 max-w-[240px] overflow-hidden">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {row.thumbUrl ? (
                          <img src={row.thumbUrl} alt="" className="w-8 h-8 rounded-md object-cover bg-gray-100 border border-gray-200/80 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-gray-100 border border-gray-200/80 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-3.5 h-3.5 text-gray-300" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <InlineEditCell
                            value={row.productName}
                            saving={savingCellKey === cellKey(row.productId, 'name')}
                            validate={(v) => String(v).trim().length < 2 ? 'Min 2 characters' : null}
                            onSave={(v) => patchProductField(row.productId, 'name', String(v).trim())}
                            className="-mx-1"
                            title="Edit product name"
                          >
                            <span className="text-xs font-semibold text-gray-900 truncate block">{row.productName}</span>
                          </InlineEditCell>
                          <InlineEditCell
                            value={row.productCategory === 'Uncategorized' ? '' : row.productCategory}
                            saving={savingCellKey === cellKey(row.productId, 'category')}
                            onSave={(v) => patchProductField(row.productId, 'category', String(v).trim())}
                            title="Edit category"
                          >
                            <span className="text-[10px] text-gray-400 truncate block">{row.productCategory}</span>
                          </InlineEditCell>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 overflow-hidden">
                      {variantId ? (
                        <InlineEditCell
                          value={row.variantRawName}
                          saving={savingCellKey === `${row.productId}:variant:${variantId}:name`}
                          validate={(v) => String(v).trim().length < 1 ? 'Name required' : null}
                          onSave={(v) => patchVariantFields(row.productId, variantId, { name: String(v).trim() }, 'name')}
                          title="Edit variant name"
                        >
                          <span className="text-sm text-gray-700 font-medium truncate block">{row.variantName}</span>
                        </InlineEditCell>
                      ) : (
                        <span className="text-sm text-gray-700 font-medium px-1.5">{row.variantName}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 overflow-hidden">
                      <InlineEditCell
                        type="number"
                        value={row.variantCount}
                        readOnly
                        readOnlyMessage="Variant count is automatic"
                        title="Variant count"
                        onSave={() => {}}
                      >
                        <span className="text-sm font-semibold tabular-nums text-gray-800">
                          {row.variantCount > 0 ? row.variantCount : '—'}
                        </span>
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-2.5 overflow-hidden">
                      {variantId ? (
                        <InlineEditCell
                          value={row.sku}
                          saving={savingCellKey === `${row.productId}:variant:${variantId}:sku`}
                          onSave={(v) => patchVariantFields(row.productId, variantId, { sku: String(v).trim() }, 'sku')}
                          title="Edit SKU"
                          inputClassName="font-mono text-xs"
                        >
                          <span className="text-xs font-mono text-gray-500 truncate block">{row.sku || '—'}</span>
                        </InlineEditCell>
                      ) : (
                        <InlineEditCell
                          value={row.sku}
                          saving={savingCellKey === cellKey(row.productId, 'sku')}
                          onSave={(v) => patchProductField(row.productId, 'sku', String(v).trim())}
                          title="Edit SKU"
                          inputClassName="font-mono text-xs"
                        >
                          <span className="text-xs font-mono text-gray-500 truncate block">{row.sku || '—'}</span>
                        </InlineEditCell>
                      )}
                    </td>
                    <td className="px-4 py-2.5 overflow-hidden">
                      {variantId ? (
                        <div className="space-y-1 min-w-0">
                          <InlineEditCell
                            type="number"
                            value={row.uom_quantity ?? 0}
                            min={0}
                            step="0.01"
                            saving={savingCellKey === `${row.productId}:variant:${variantId}:uom_quantity`}
                            onSave={(v) => patchVariantFields(row.productId, variantId, { uom_quantity: Number(v) || null }, 'uom_quantity')}
                            title="Edit pack quantity"
                          >
                            <span className="text-xs text-gray-600">{row.uom_quantity ?? '—'}</span>
                          </InlineEditCell>
                          <InlineEditCell
                            value={row.uom}
                            saving={savingCellKey === `${row.productId}:variant:${variantId}:uom`}
                            onSave={(v) => patchVariantFields(row.productId, variantId, { uom: String(v).trim() }, 'uom')}
                            title="Edit unit"
                          >
                            <span className="text-xs text-gray-500 truncate block">{row.uom}</span>
                          </InlineEditCell>
                        </div>
                      ) : (
                        <InlineEditCell
                          value={row.uom}
                          saving={savingCellKey === cellKey(row.productId, 'uom')}
                          onSave={(v) => patchProductField(row.productId, 'uom', String(v).trim())}
                          title="Edit unit"
                        >
                          <span className="text-xs text-gray-600 truncate block">{packLabel}</span>
                        </InlineEditCell>
                      )}
                    </td>
                    <td className="px-4 py-2.5 overflow-hidden">
                      <InlineEditCell
                        type="number"
                        value={row.price}
                        min={0}
                        step="0.01"
                        saving={savingCellKey === variantPriceKey}
                        validate={(v) => Number(v) < 0 ? 'Price must be 0 or more' : null}
                        onSave={(v) => (
                          variantId
                            ? patchVariantField(row.productId, variantId, 'price', Number(v))
                            : patchProductField(row.productId, 'price', Number(v))
                        )}
                        title="Edit price"
                      >
                        <span className="text-sm font-semibold text-gray-900 tabular-nums truncate block">
                          {row.price > 0
                            ? row.priceHigh > row.price
                              ? `${sym}${row.price.toLocaleString()} – ${sym}${row.priceHigh.toLocaleString()}`
                              : `${sym}${row.price.toLocaleString()}`
                            : '—'}
                        </span>
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-2.5 overflow-hidden">
                      <div className="min-w-0 space-y-0.5">
                        <InlineEditCell
                          type="number"
                          value={row.quantity}
                          min={0}
                          step="1"
                          saving={savingCellKey === variantQtyKey}
                          validate={(v) => Number(v) < 0 || !Number.isInteger(Number(v)) ? 'Enter a whole number ≥ 0' : null}
                          parse={(raw) => Math.max(0, Math.round(Number(raw) || 0))}
                          onSave={(v) => (
                            variantId
                              ? patchVariantField(row.productId, variantId, 'quantity', Number(v))
                              : patchProductField(row.productId, 'quantity', Number(v))
                          )}
                          title="Edit stock"
                        >
                          <span className={`text-sm font-semibold tabular-nums ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-800'}`}>
                            {row.quantity.toLocaleString()}
                          </span>
                        </InlineEditCell>
                        {isLow && !isOut && <p className="text-[10px] text-amber-500 truncate">low stock</p>}
                        {isOut && <p className="text-[10px] text-red-400 truncate">{row.stock_status.replace(/_/g, ' ')}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 overflow-hidden">
                      {variantId ? (
                        <InlineEditCell
                          type="select"
                          value={row.is_active ? 'true' : 'false'}
                          options={ACTIVE_INACTIVE_OPTIONS}
                          saving={savingCellKey === `${row.productId}:variant:${variantId}:is_active`}
                          onSave={(v) => patchVariantFields(row.productId, variantId, { is_active: v === 'true' }, 'is_active')}
                          title="Edit variant status"
                        >
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                            row.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
                          }`}>
                            {row.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </InlineEditCell>
                      ) : (
                        <InlineEditCell
                          type="select"
                          value={row.is_active ? 'true' : 'false'}
                          options={ACTIVE_INACTIVE_OPTIONS}
                          saving={savingCellKey === cellKey(row.productId, 'status')}
                          onSave={(v) => patchProductField(row.productId, 'status', v === 'true' ? 'active' : 'draft')}
                          title="Edit status"
                        >
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                            row.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
                          }`}>
                            {row.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </InlineEditCell>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0"
                          title="View product"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/products/${row.productId}`)
                          }}
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0"
                          title="Edit product"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/products/${row.productId}?edit=true`)
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          title="Move to trash"
                          onClick={() => setProductDeleteConfirm({ id: row.productId, name: row.productName })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </ResizableTable>
          )}

          </div>

          {data && (
            <TablePagination
              page={page}
              pages={listViewMode === 'variant' ? variantPages : (data.pages || 1)}
              total={listViewMode === 'variant' ? variantTotal : data.total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
              itemLabel={listViewMode === 'variant' ? 'variant rows' : showDeleted ? 'deleted products' : 'products'}
              countSuffix={
                listViewMode === 'variant' && (data.total ?? 0) > 0
                  ? ` · ${data.total} product${data.total === 1 ? '' : 's'}`
                  : undefined
              }
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(productDeleteConfirm)}
        onOpenChange={(open) => {
          if (!open && !deleteProduct.isPending) setProductDeleteConfirm(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-4 w-4" />
              </span>
              {productDeleteConfirm?.permanent ? 'Delete permanently?' : 'Move to trash?'}
            </DialogTitle>
            <DialogDescription className="pt-1">
              {productDeleteConfirm?.permanent ? (
                <>
                  <span className="font-medium text-foreground">{productDeleteConfirm.name}</span>
                  {' '}will be permanently deleted. This cannot be undone.
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">{productDeleteConfirm?.name}</span>
                  {' '}will be moved to Deleted products. You can restore it later.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={deleteProduct.isPending}
              onClick={() => setProductDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteProduct.isPending || !productDeleteConfirm}
              onClick={() => {
                if (!productDeleteConfirm) return
                deleteProduct.mutate(
                  productDeleteConfirm.permanent
                    ? { id: productDeleteConfirm.id, permanent: true }
                    : productDeleteConfirm.id,
                  { onSettled: () => setProductDeleteConfirm(null) },
                )
              }}
            >
              {deleteProduct.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : productDeleteConfirm?.permanent ? (
                'Delete permanently'
              ) : (
                'Move to trash'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
        title="Scan to Find Product"
      />

    </div>
  )
}
