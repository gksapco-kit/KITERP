import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useProducts, useDeleteProduct, useCategoryTree } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { flattenCategoryTree, filterCategoryTree } from '@/lib/categoryHierarchy'
import { formatCurrency, formatDate, mediaUrl } from '@/lib/utils'
import { processRows, type SortDir } from '@/lib/tableList'
import { ResizableTable } from '@/components/table/ResizableTable'
import type { Product } from '@/types'
import {
  Plus, Search, Pencil, Trash2, Loader2, X, ChevronLeft, ChevronRight,
  Filter, Copy, Share2, Mail, MessageCircle, MoreVertical, Package,
  Image as ImageIcon, ChevronUp, ChevronDown, ChevronsUpDown, ScanLine,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { vendorApi } from '@/api/vendor'
import { BarcodeScannerModal } from '@/components/scanner/BarcodeScannerModal'
import { CatalogItemStatusCell } from '@/components/common/CatalogItemStatusCell'
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

function MoreMenu({ product, onDelete }: { product: Product; onDelete: () => void }) {
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
        className="inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-gray-500 hover:bg-gray-100 transition-colors"
        onClick={() => { setOpen(v => !v); setConfirmDelete(false) }}
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {menu}
    </>
  )
}

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
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [viewMode, setViewMode] = useState<'product' | 'variant'>(() => {
    try { return (localStorage.getItem('kiterp:products:viewMode') as 'product' | 'variant') || 'product' } catch { return 'product' }
  })
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

  const { data, isLoading } = useProducts({
    page,
    size: pageSize,
    search: search || undefined,
    status: status || undefined,
    category: categoryRoot || undefined,
    is_visible: visibility === 'true' ? true : visibility === 'false' ? false : undefined,
    product_type: productType || undefined,
    stock: stock || undefined,
    store_id: selectedStore?.id || undefined,
  })
  const deleteProduct = useDeleteProduct()

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
        name: (p) => p.name,
        brand: (p) => p.brand || '',
        product_type: (p) => p.product_type || 'physical',
        price: (p) => p.price,
        quantity: (p) => p.quantity,
        status: (p) => p.status,
      },
    )
  }, [data?.items, sortKey, sortDir, categorySub])

  // Flattened variant rows for variant-wise view
  const variantRows = useMemo(() => {
    if (viewMode !== 'variant') return []
    const rows: {
      productId: string; productName: string; productCategory: string; productType: string; thumbUrl: string
      variantId: string; variantName: string; sku: string; uom: string; uom_quantity: number | null
      price: number; quantity: number; stock_status: string; low_stock_threshold: number; currency: string; is_active: boolean
    }[] = []
    for (const product of displayProducts) {
      const primaryImg = product.images?.find((img: any) => img.is_primary) || product.images?.[0]
      const productThumb = primaryImg ? resolveUrl(primaryImg.url) : ''
      const variants = product.variants || []
      if (variants.length === 0) {
        // Product with no variants — show it as a single row
        rows.push({
          productId: product.id, productName: product.name,
          productCategory: product.category || 'Uncategorized', productType: product.product_type || 'physical',
          thumbUrl: productThumb,
          variantId: '', variantName: '—',
          sku: product.sku || '', uom: product.uom || 'piece', uom_quantity: product.uom_quantity ?? null,
          price: product.price, quantity: product.quantity ?? 0,
          stock_status: product.stock_status || 'in_stock', low_stock_threshold: product.low_stock_threshold ?? 5,
          currency: product.currency || 'INR', is_active: product.status === 'active',
        })
      } else {
        for (const v of variants) {
          const vImg = (v.images || v.media || []).find((img: any) => img?.url)
          const vThumb = vImg ? resolveUrl(vImg.url) : productThumb
          rows.push({
            productId: product.id, productName: product.name,
            productCategory: product.category || 'Uncategorized', productType: product.product_type || 'physical',
            thumbUrl: vThumb,
            variantId: v.id || '', variantName: v.name || `Variant`,
            sku: v.sku || '', uom: v.uom || 'piece', uom_quantity: v.uom_quantity ?? null,
            price: v.price ?? 0, quantity: v.quantity ?? 0,
            stock_status: v.stock_status || 'in_stock', low_stock_threshold: v.low_stock_threshold ?? 5,
            currency: v.currency || product.currency || 'INR', is_active: v.is_active !== false,
          })
        }
      }
    }
    return rows
  }, [displayProducts, viewMode])

  const setViewModePersisted = (mode: 'product' | 'variant') => {
    setViewMode(mode)
    try { localStorage.setItem('kiterp:products:viewMode', mode) } catch { /* ignore */ }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} total products</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
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
          <Button variant="outline" className="gap-2" onClick={() => setShowScanner(true)} disabled={scanLoading}>
            {scanLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4 text-blue-500" />}
            Scan
          </Button>
          <Button onClick={() => navigate('/products/new')} className="gap-2 shadow-sm"><Plus className="w-4 h-4" />Add Product</Button>
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
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-gray-200/80 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">

          {/* ── Product-wise view ── */}
          {viewMode === 'product' && (
          <ResizableTable tableId="products" defaultWidths={[280, 120, 90, 100, 110, 90, 80]}>
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
                    {hasActiveQuery ? (
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
                const symbol = product.currency === 'INR' ? '\u20B9' : '$'
                const primaryImg = product.images?.find((img: any) => img.is_primary) || product.images?.[0]
                const variantImg = !primaryImg
                  ? variants.flatMap((v: any) => v.images || v.media || []).find((img: any) => img?.url)
                  : null
                const thumbUrl = primaryImg ? resolveUrl(primaryImg.url) : variantImg ? resolveUrl(variantImg.url) : ''

                return (
                <tr key={product.id} className="hover:bg-gray-50/80 cursor-pointer transition-colors group" onClick={() => navigate(`/products/${product.id}`)}>
                  <td className="px-5 py-3 max-w-[280px]">
                    <div className="flex items-center gap-3 min-w-0">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 border border-gray-200/80" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200/80 flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors truncate">{product.name}</p>
                        <p className="text-xs text-gray-400 truncate">{product.category || 'Uncategorized'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[120px]">
                    <p className="text-sm text-gray-600 truncate" title={product.brand || undefined}>{product.brand || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 text-xs rounded-full font-semibold bg-blue-50 text-blue-700 whitespace-nowrap">{productTypeLabel(product.product_type)}</span>
                  </td>
                  <td className="px-4 py-3 max-w-[110px]">
                    {(() => {
                      if (!hasVariants) return <span className="text-sm font-medium text-gray-900 truncate block">{formatCurrency(product.price)}</span>
                      const prices = variants.map((v: any) => v.price).filter((p: number) => p > 0).sort((a: number, b: number) => a - b)
                      if (prices.length === 0) return <span className="text-sm text-gray-400">—</span>
                      const low = prices[0]
                      const high = prices[prices.length - 1]
                      return (
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {low === high ? formatCurrency(low) : `${symbol}${low.toLocaleString()} – ${symbol}${high.toLocaleString()}`}
                          </p>
                          <p className="text-xs text-gray-400">{variants.length} variant{variants.length > 1 ? 's' : ''}</p>
                        </div>
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
                          <div className="min-w-0">
                            <p>
                              <span className={`text-sm font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-800'}`}>{qty}</span>
                              <span className={`ml-1 text-xs ${isOut ? 'text-red-400' : 'text-gray-400'}`}>{sts.replace(/_/g, ' ')}</span>
                            </p>
                          </div>
                        )
                      }
                      const totalStock = variants.reduce((s: number, v: any) => s + (v.quantity || 0), 0)
                      const outCount = variants.filter((v: any) => v.stock_status === 'out_of_stock' || (v.quantity || 0) === 0).length
                      const isAllOut = outCount === variants.length
                      const hasLow = !isAllOut && outCount > 0
                      return (
                        <div className="min-w-0">
                          <p>
                            <span className={`text-sm font-semibold ${isAllOut ? 'text-red-600' : hasLow ? 'text-amber-600' : 'text-gray-800'}`}>
                              {totalStock.toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-400 ml-1">total</span>
                          </p>
                          {outCount > 0 && !isAllOut && (
                            <p className="text-xs text-red-400 truncate">{outCount}/{variants.length} out of stock</p>
                          )}
                          {isAllOut && <p className="text-xs text-red-400">all out of stock</p>}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <CatalogItemStatusCell status={product.status} isVisible={product.is_visible} />
                  </td>
                  <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end items-center">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Edit" onClick={() => navigate(`/products/${product.id}?edit=true`)}>
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </Button>
                      <MoreMenu product={product} onDelete={() => deleteProduct.mutate(product.id)} />
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </ResizableTable>
          )}

          {/* ── Variant-wise view ── */}
          {viewMode === 'variant' && (
          <ResizableTable tableId="products-variant" defaultWidths={[240, 130, 90, 80, 90, 80, 90]}>
            <thead>
              <tr className="border-b bg-gray-50/80">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Product</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Variant</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>SKU</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Pack</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Price</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Stock</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Actions</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={8} className="px-6 py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : !variantRows.length ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <Layers className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-500 mb-1">No variants found</p>
                    {hasActiveQuery && (
                      <Button size="sm" variant="outline" className="gap-1.5 mt-3" onClick={() => { setSearch(''); setSearchInput(''); clearFilters() }}>
                        Clear search & filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : variantRows.map((row, i) => {
                const sym = row.currency === 'INR' ? '₹' : '$'
                const isOut = row.stock_status === 'out_of_stock' || row.stock_status === 'discontinued'
                const isLow = !isOut && row.quantity <= row.low_stock_threshold
                const packLabel = row.uom_quantity != null && row.uom_quantity > 0
                  ? `${row.uom_quantity} ${row.uom}`
                  : row.uom
                // Group header: first row of a new product gets a subtle top border accent
                const prevProduct = i > 0 ? variantRows[i - 1].productId : null
                const isFirstOfProduct = prevProduct !== row.productId

                return (
                  <tr
                    key={`${row.productId}-${row.variantId || i}`}
                    className={`hover:bg-gray-50/80 cursor-pointer transition-colors group ${isFirstOfProduct && i > 0 ? 'border-t-2 border-t-gray-200' : ''}`}
                    onClick={() => navigate(`/products/${row.productId}`)}
                  >
                    <td className="px-5 py-2.5 max-w-[240px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {row.thumbUrl ? (
                          <img src={row.thumbUrl} alt="" className="w-8 h-8 rounded-md object-cover bg-gray-100 border border-gray-200/80 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-gray-100 border border-gray-200/80 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-3.5 h-3.5 text-gray-300" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">{row.productName}</p>
                          <p className="text-[10px] text-gray-400 truncate">{row.productCategory}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-sm text-gray-700 font-medium truncate">{row.variantName}</p>
                      {!row.is_active && (
                        <span className="text-[10px] text-amber-600 font-medium">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-xs font-mono text-gray-500 truncate">{row.sku || '—'}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-600 whitespace-nowrap">{packLabel}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">
                        {row.price > 0 ? `${sym}${row.price.toLocaleString()}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-sm font-semibold tabular-nums ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-800'}`}>
                        {row.quantity.toLocaleString()}
                      </span>
                      {isLow && !isOut && <span className="ml-1 text-[10px] text-amber-500">low</span>}
                      {isOut && <span className="ml-1 text-[10px] text-red-400">{row.stock_status.replace(/_/g, ' ')}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                        row.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0"
                        title="Edit product"
                        onClick={() => navigate(`/products/${row.productId}?edit=true`)}
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-500" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </ResizableTable>
          )}

          </div>

          {data && (
            <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50/50 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-gray-500">
                  {(() => {
                    const from = (page - 1) * pageSize + 1
                    const to = Math.min(page * pageSize, data.total)
                    const base = data.total > 0 ? `${from}–${to} of ${data.total} products` : '0 products'
                    return viewMode === 'variant' && variantRows.length > 0
                      ? `${base} · ${variantRows.length} variant row${variantRows.length === 1 ? '' : 's'}`
                      : base
                  })()}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-gray-400">Rows per page</span>
                  <Select
                    value={String(pageSize)}
                    onChange={(v) => { setPageSize(Number(v)); setPage(1) }}
                    options={[10, 25, 50, 100].map(n => ({ value: String(n), label: String(n) }))}
                    aria-label="Rows per page"
                    className="h-7 min-w-[4rem] text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-[12px] text-gray-500 px-2">
                  {data.page} / {data.pages || 1}
                </span>
                <Button variant="outline" size="sm" disabled={page >= (data.pages || 1)} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <BarcodeScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
        title="Scan to Find Product"
      />
    </div>
  )
}
