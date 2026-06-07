import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProducts, useDeleteProduct, useCategoryTree } from '@/hooks/useVendor'
import { flattenCategoryTree, filterCategoryTree } from '@/lib/categoryHierarchy'
import { formatCurrency, formatDate, mediaUrl } from '@/lib/utils'
import { processRows, type SortDir } from '@/lib/tableList'
import { ResizableTable } from '@/components/table/ResizableTable'
import type { Product } from '@/types'
import {
  Plus, Search, Pencil, Trash2, Loader2, X, ChevronLeft, ChevronRight,
  Filter, Copy, Share2, Mail, MessageCircle, MoreVertical, Package,
  Image as ImageIcon, ChevronUp, ChevronDown, ChevronsUpDown, ScanLine,
} from 'lucide-react'
import { toast } from 'sonner'
import { vendorApi } from '@/api/vendor'
import { BarcodeScannerModal } from '@/components/scanner/BarcodeScannerModal'
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
      className="w-44 bg-white rounded-lg border shadow-lg py-1 animate-in fade-in-0 zoom-in-95 max-h-[min(90vh,24rem)] overflow-y-auto"
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const { data: categoryData } = useCategoryTree()
  const productCategories = useMemo(
    () => flattenCategoryTree(filterCategoryTree(categoryData?.categories || [], 'product')),
    [categoryData?.categories],
  )

  const categoryRoot = category.includes('::') ? category.split('::')[0] : category
  const categorySub = category.includes('::') ? category.split('::').slice(1).join('::') : ''

  const { data, isLoading } = useProducts({
    page,
    size: pageSize,
    search: search || undefined,
    status: status || undefined,
    category: categoryRoot || undefined,
  })
  const deleteProduct = useDeleteProduct()

  const activeFilterCount = [status, category].filter(Boolean).length
  const clearFilters = () => { setStatus(''); setCategory(''); setPage(1) }

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} total products</p>
        </div>
        <div className="flex gap-2">
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
            <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search products..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-10" />
              </div>
              <Button type="submit" variant="outline">Search</Button>
            </form>
            <Button type="button" variant="outline" className="gap-2" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4" />Filters
              {activeFilterCount > 0 && <span className="ml-1 px-1.5 py-0.5 text-xs leading-none font-bold bg-primary text-white rounded-full">{activeFilterCount}</span>}
            </Button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-end gap-3 pt-3 border-t">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Status</label>
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-shadow">
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Category</label>
                <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-shadow">
                  <option value="">All Categories</option>
                  {productCategories.map(c => (
                    <option key={c.id} value={c.subcategory ? `${c.category}::${c.subcategory}` : c.category}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-9 text-gray-500 gap-1" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5" />Clear
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-gray-200/80 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
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
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : !data?.items?.length ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-500 mb-1">No products yet</p>
                    <p className="text-xs text-gray-400 mb-4">Create your first product to get started</p>
                    <Button size="sm" onClick={() => navigate('/products/new')} className="gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Add Product
                    </Button>
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
                    <span className="px-2 py-0.5 text-xs rounded-full font-semibold bg-blue-50 text-blue-700 capitalize whitespace-nowrap">{product.product_type || 'physical'}</span>
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
                    <span className={`px-2 py-0.5 text-xs rounded-full font-semibold whitespace-nowrap ${
                      product.status === 'active' ? 'bg-green-100 text-green-700' :
                      product.status === 'archived' ? 'bg-red-50 text-red-600' :
                      'bg-gray-100 text-gray-700'
                    }`}>{product.status}</span>
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
          </div>

          {data && (
            <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50/50 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-gray-500">
                  {(() => {
                    const from = (page - 1) * pageSize + 1
                    const to = Math.min(page * pageSize, data.total)
                    return data.total > 0 ? `${from}–${to} of ${data.total} products` : '0 products'
                  })()}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-gray-400">Rows per page</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                    className="h-7 rounded-md border border-gray-200 bg-white px-2 text-[12px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  >
                    {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
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
