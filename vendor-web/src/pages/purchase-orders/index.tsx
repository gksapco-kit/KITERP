import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  usePurchaseOrders, useCreatePurchaseOrder, useSuppliers, useProducts, useServices,
  useCreateSupplier,
} from '@/hooks/useVendor'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { formatDate, formatCurrency } from '@/lib/utils'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { ResizableTable } from '@/components/table/ResizableTable'
import type { Product, Service, PurchaseOrder } from '@/types'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { BarcodeScannerModal } from '@/components/scanner/BarcodeScannerModal'
import { toast } from 'sonner'
import {
  Loader2, Plus, ChevronLeft, ChevronRight, X, ClipboardList, Trash2, Palette,
  ScanLine, Package, AlertCircle, UserPlus, Building2, ExternalLink,
} from 'lucide-react'

// Supplier created on the full-page form is stored here so CreatePOModal can auto-select it
const PO_PENDING_SUPPLIER_KEY = 'po_pending_supplier'

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  sent: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Sent' },
  ordered: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Ordered' },
  partial_received: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Partial' },
  received: { bg: 'bg-green-50', text: 'text-green-700', label: 'Received' },
  closed: { bg: 'bg-accent', text: 'text-primary', label: 'Closed' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', label: 'Cancelled' },
}

// Prefill data set by barcode scan to pass into CreatePOModal
interface BarcodePrefill {
  productId: string
  variantId?: string
  productName: string
  variantName?: string
  unitCost?: number
}

export default function PurchaseOrdersPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [sortKey, setSortKey] = useState('order_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showScanner, setShowScanner] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [barcodePrefill, setBarcodePrefill] = useState<BarcodePrefill | undefined>()
  // Supplier pre-select: pick up supplier created on the full-page master data form
  const [pendingSupplier, setPendingSupplier] = useState<{ id: string; name: string } | undefined>()

  // On mount: check if we returned from the supplier creation page
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PO_PENDING_SUPPLIER_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        sessionStorage.removeItem(PO_PENDING_SUPPLIER_KEY)
        if (parsed?.id) {
          setPendingSupplier(parsed)
          setShowCreate(true)
        }
      }
    } catch { /* ignore */ }
  }, [])

  const params: Record<string, unknown> = { page, size: 20 }
  if (statusFilter) params.status = statusFilter

  const { data, isLoading } = usePurchaseOrders(params)

  const total = data?.total || 0
  const pages = data?.pages || 0

  const displayOrders = useMemo(() => {
    if (!data?.items?.length) return []
    return processRows(
      data.items as PurchaseOrder[],
      '',
      () => [],
      sortKey,
      sortDir,
      {
        po_number: (po) => po.po_number,
        supplier_name: (po) => po.supplier_name || '',
        status: (po) => po.status,
        total: (po) => po.total,
        order_date: (po) => po.order_date || '',
        expected_delivery_date: (po) => po.expected_delivery_date || '',
        created_at: (po) => po.created_at,
        item_count: (po) => po.items?.length || 0,
      },
    )
  }, [data?.items, sortKey, sortDir])

  const statuses = ['', 'draft', 'sent', 'partial_received', 'received', 'closed', 'cancelled']

  const handleBarcodeScan = useCallback(async (code: string) => {
    if (scanLoading) return
    setScanLoading(true)
    setShowScanner(false)
    try {
      const result = await vendorApi.barcodeLookup(code)
      const p = result.product
      const v = result.variant
      const prefill: BarcodePrefill = {
        productId: p.id,
        variantId: v?.id,
        productName: p.name,
        variantName: v?.name,
        unitCost: v?.cost_price ?? p.cost_price ?? v?.price ?? p.price,
      }
      setBarcodePrefill(prefill)
      setShowCreate(true)
      toast.success(`Found: ${v ? `${p.name} — ${v.name}` : p.name}. Opening new PO…`)
    } catch (err: any) {
      if (err?.response?.status === 404) {
        toast.error(`No product found for barcode: ${code}`)
      } else {
        toast.error('Barcode scan error. Please try again.')
      }
    } finally {
      setScanLoading(false)
    }
  }, [scanLoading])

  // Hardware scanner listener (keyboard-wedge) — active when no modal is open
  useBarcodeScanner({ enabled: !showScanner && !showCreate, onScan: handleBarcodeScan })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2" onClick={() => navigate('/purchase-orders/templates')}>
            <Palette className="w-4 h-4" /> Templates
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setShowScanner(true)} disabled={scanLoading}>
            {scanLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ScanLine className="w-4 h-4" />}
            Scan Barcode
          </Button>
          <Button className="gap-2" onClick={() => { setBarcodePrefill(undefined); setShowCreate(true) }}>
            <Plus className="w-4 h-4" /> New Purchase Order
          </Button>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map((s) => {
          const badge = s ? statusBadge[s] : null
          return (
            <button
              key={s || 'all'}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {badge?.label || 'All'}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : displayOrders.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">No purchase orders found.</p>
          <p className="text-sm text-gray-400 mt-1">Scan a barcode or click "New Purchase Order" to create one.</p>
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <TableToolbar
                search=""
                onSearchChange={() => {}}
                hideSearch
                hint="Sorting applies to the current page."
                sortOptions={[
                  { value: 'order_date', label: 'Order date' },
                  { value: 'created_at', label: 'Created' },
                  { value: 'po_number', label: 'PO #' },
                  { value: 'supplier_name', label: 'Supplier' },
                  { value: 'status', label: 'Status' },
                  { value: 'total', label: 'Total' },
                  { value: 'item_count', label: 'Items' },
                  { value: 'expected_delivery_date', label: 'Expected' },
                ]}
                sortKey={sortKey}
                sortDir={sortDir}
                onSortKeyChange={setSortKey}
                onSortDirChange={setSortDir}
              />
              <ResizableTable tableId="purchase-orders" defaultWidths={[110, 160, 100, 100, 200, 110, 110]}>
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">PO #</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Items / Variants</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Order Date</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Expected</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayOrders.map((po) => {
                    const badge = statusBadge[po.status] || statusBadge.draft
                    const items = po.items || []
                    const itemSummary = items.slice(0, 3).map((i: any) => {
                      const base = i.product_name || 'Product'
                      const variant = i.variant_name || (i.variant_id ? 'Variant' : null)
                      return variant ? `${base} — ${variant}` : base
                    })
                    const remaining = items.length - 3
                    return (
                      <tr
                        key={po.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/purchase-orders/${po.id}`)}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-blue-600">{po.po_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{po.supplier_name || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-medium">{formatCurrency(po.total)}</td>
                        <td className="px-6 py-4">
                          {items.length === 0 ? (
                            <span className="text-xs text-gray-400">No items</span>
                          ) : (
                            <div className="space-y-0.5">
                              {itemSummary.map((s: string, i: number) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <Package className="w-3 h-3 text-gray-300 shrink-0" />
                                  <span className="text-xs text-gray-700 truncate max-w-[160px]">{s}</span>
                                </div>
                              ))}
                              {remaining > 0 && (
                                <span className="text-xs text-gray-400 pl-4.5">+{remaining} more</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(po.order_date)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(po.expected_delivery_date)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </ResizableTable>
            </CardContent>
          </Card>
          {pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Page {page} of {pages} ({total} records)</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Camera barcode scanner */}
      <BarcodeScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
        title="Scan Product Barcode"
      />

      {showCreate && (
        <CreatePOModal
          barcodePrefill={barcodePrefill}
          pendingSupplier={pendingSupplier}
          onClose={() => { setShowCreate(false); setBarcodePrefill(undefined); setPendingSupplier(undefined) }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface ItemRow {
  product_id: string
  variant_id: string
  quantity: string
  unit_cost: string
  item_note: string
}

interface CatalogItem {
  id: string
  name: string
  sku?: string
  cost_price?: number
  price?: number
  type: 'product' | 'service'
  variants?: { id: string; name: string; sku?: string; barcode?: string; cost_price?: number; price?: number }[]
}

// ─────────────────────────────────────────────────────────────────
// CreatePOModal
// ─────────────────────────────────────────────────────────────────

function CreatePOModal({
  barcodePrefill,
  pendingSupplier,
  onClose,
}: {
  barcodePrefill?: BarcodePrefill
  pendingSupplier?: { id: string; name: string }
  onClose: () => void
}) {
  const createMut = useCreatePurchaseOrder()
  const createSupplierMut = useCreateSupplier()
  const { data: suppliersData, refetch: refetchSuppliers } = useSuppliers({ is_active: true })
  const { data: productsData } = useProducts({ size: 500, status: 'active' })
  const { data: servicesData } = useServices({ size: 500, status: 'active' })
  const navigate = useNavigate()

  const [supplierId, setSupplierId] = useState(pendingSupplier?.id || '')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')

  // Quick-create supplier mini-panel state
  const [showQuickSupplier, setShowQuickSupplier] = useState(false)
  const [qsName, setQsName]   = useState('')
  const [qsPhone, setQsPhone] = useState('')
  const [qsEmail, setQsEmail] = useState('')

  // Auto-select supplier if returned from full-page creation form
  useEffect(() => {
    if (pendingSupplier?.id) setSupplierId(pendingSupplier.id)
  }, [pendingSupplier?.id])

  const handleQuickCreateSupplier = async () => {
    if (!qsName.trim()) return
    try {
      const created: any = await createSupplierMut.mutateAsync({
        name: qsName.trim(),
        phone: qsPhone || undefined,
        email: qsEmail || undefined,
      })
      await refetchSuppliers()
      setSupplierId(created.id)
      setShowQuickSupplier(false)
      setQsName(''); setQsPhone(''); setQsEmail('')
    } catch { /* handled by hook */ }
  }
  const [items, setItems] = useState<ItemRow[]>([
    barcodePrefill
      ? {
          product_id: barcodePrefill.productId,
          variant_id: barcodePrefill.variantId || '',
          quantity: '1',
          unit_cost: barcodePrefill.unitCost != null ? String(barcodePrefill.unitCost) : '',
          item_note: '',
        }
      : { product_id: '', variant_id: '', quantity: '', unit_cost: '', item_note: '' },
  ])

  // Full product details (with variants) keyed by product_id
  const [productDetails, setProductDetails] = useState<Record<string, CatalogItem>>({})

  const products: CatalogItem[] = (productsData?.items || []).map((p: Product) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    cost_price: p.cost_price,
    price: p.price,
    type: 'product' as const,
  }))
  const services: CatalogItem[] = (servicesData?.items || []).map((s: Service) => ({
    id: s.id,
    name: s.name,
    cost_price: s.price,
    price: s.price,
    type: 'service' as const,
  }))
  const catalogItems = [...products, ...services]
  const catalogMap = new Map(catalogItems.map((c) => [c.id, c]))

  // Fetch full product details (with variants) when a product is first selected
  const fetchProductDetails = useCallback(async (productId: string) => {
    if (!productId || productDetails[productId]) return
    try {
      const full = await vendorApi.getProduct(productId)
      const variants = (full.variants || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        cost_price: v.cost_price,
        price: v.price,
      }))
      setProductDetails(prev => ({
        ...prev,
        [productId]: { ...prev[productId], id: productId, name: full.name, variants },
      }))
    } catch {
      // silently ignore — variant selector just won't appear
    }
  }, [productDetails])

  // Load product details for prefill product on mount
  useEffect(() => {
    if (barcodePrefill?.productId) {
      fetchProductDetails(barcodePrefill.productId)
    }
  }, [barcodePrefill?.productId])

  const addItem = () => setItems([...items, { product_id: '', variant_id: '', quantity: '', unit_cost: '', item_note: '' }])
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx))

  const updateItem = (idx: number, field: keyof ItemRow, value: string) => {
    const updated = [...items]
    updated[idx] = { ...updated[idx], [field]: value }

    if (field === 'product_id') {
      // Clear variant when product changes
      updated[idx].variant_id = ''
      const c = catalogMap.get(value)
      if (c?.cost_price) updated[idx].unit_cost = String(c.cost_price)
      else if (c?.price) updated[idx].unit_cost = String(c.price)
      // Fetch variants for newly selected product
      if (value) fetchProductDetails(value)
    }

    if (field === 'variant_id' && value) {
      const details = productDetails[updated[idx].product_id]
      const variant = details?.variants?.find(v => v.id === value)
      if (variant?.cost_price) updated[idx].unit_cost = String(variant.cost_price)
      else if (variant?.price) updated[idx].unit_cost = String(variant.price)
    }

    setItems(updated)
  }

  const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_cost) || 0), 0)
  const canSubmit = supplierId && items.every(i => i.product_id && parseInt(i.quantity) > 0 && parseFloat(i.unit_cost) >= 0)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    try {
      const po = await createMut.mutateAsync({
        supplier_id: supplierId,
        items: items.map(i => ({
          product_id: i.product_id,
          variant_id: i.variant_id || undefined,
          quantity: parseInt(i.quantity),
          unit_cost: parseFloat(i.unit_cost),
          description: i.item_note || undefined,
        })),
        expected_delivery_date: expectedDate || undefined,
        notes: notes || undefined,
      })
      onClose()
      navigate(`/purchase-orders/${po.id}`)
    } catch {
      // handled by hook
    }
  }, [canSubmit, supplierId, items, expectedDate, notes, createMut, onClose, navigate])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">New Purchase Order</h2>
            {barcodePrefill && (
              <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                <ScanLine className="w-3.5 h-3.5" />
                Pre-filled from barcode scan: {barcodePrefill.variantName
                  ? `${barcodePrefill.productName} — ${barcodePrefill.variantName}`
                  : barcodePrefill.productName}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Supplier *</Label>
                <button
                  type="button"
                  onClick={() => setShowQuickSupplier(v => !v)}
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                >
                  <UserPlus className="w-3 h-3" /> New Supplier
                </button>
              </div>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
              >
                <option value="">Select supplier...</option>
                {suppliersData?.items?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {/* Quick-create supplier inline panel */}
              {showQuickSupplier && (
                <div className="border border-blue-200 rounded-lg bg-blue-50/60 p-3 space-y-2 mt-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Quick Create Supplier
                    </p>
                    <button type="button" onClick={() => setShowQuickSupplier(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <Input
                      className="h-8 text-sm bg-white"
                      placeholder="Supplier name *"
                      value={qsName}
                      onChange={e => setQsName(e.target.value)}
                    />
                    <PhoneInput value={qsPhone} onChange={setQsPhone} defaultCountryIso="IN" />
                    <Input
                      className="h-8 text-sm bg-white"
                      placeholder="Email (optional)"
                      value={qsEmail}
                      onChange={e => setQsEmail(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        // Save current state hint and navigate to full form
                        navigate('/master-data/new?returnTo=purchase-orders&kind=supplier')
                      }}
                      className="flex items-center gap-1 text-[11px] text-primary hover:text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Full Details
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700"
                      disabled={!qsName.trim() || createSupplierMut.isPending}
                      onClick={handleQuickCreateSupplier}
                    >
                      {createSupplierMut.isPending
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Plus className="w-3 h-3" />}
                      Create & Select
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Expected Delivery</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const selectedProductDetails = productDetails[item.product_id]
                const variants = selectedProductDetails?.variants || []
                const isProduct = catalogMap.get(item.product_id)?.type === 'product'
                const hasVariants = isProduct && variants.length > 0

                const selectedVariant = variants.find(v => v.id === item.variant_id)
                const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0)

                return (
                  <div key={idx} className="border rounded-lg p-3 space-y-2.5 bg-gray-50/50">
                    {/* Row 1: product selector + remove button */}
                    <div className="flex gap-2 items-start">
                      <select
                        className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={item.product_id}
                        onChange={(e) => updateItem(idx, 'product_id', e.target.value)}
                        required
                      >
                        <option value="">Product / Service...</option>
                        {products.length > 0 && (
                          <optgroup label="Products">
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                            ))}
                          </optgroup>
                        )}
                        {services.length > 0 && (
                          <optgroup label="Services">
                            {services.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400 hover:text-red-600 shrink-0" onClick={() => removeItem(idx)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Row 2: variant selector (when applicable) */}
                    {hasVariants && (
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-gray-500 shrink-0 w-14">Variant</span>
                        <select
                          className="flex h-8 flex-1 rounded-md border border-blue-200 bg-blue-50/40 px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          value={item.variant_id}
                          onChange={(e) => updateItem(idx, 'variant_id', e.target.value)}
                        >
                          <option value="">— All / Product-level —</option>
                          {variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}{v.sku ? ` · ${v.sku}` : ''}{v.barcode ? ` · ${v.barcode}` : ''}
                            </option>
                          ))}
                        </select>
                        {selectedVariant?.barcode && (
                          <span className="text-xs text-gray-400 font-mono shrink-0 hidden sm:block">{selectedVariant.barcode}</span>
                        )}
                      </div>
                    )}

                    {/* Loading indicator for variants */}
                    {isProduct && item.product_id && !selectedProductDetails && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Loading variants…
                      </div>
                    )}

                    {/* Row 3: qty + unit cost + line total */}
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">Qty</span>
                        <Input
                          type="number"
                          min={1}
                          className="h-8 text-sm"
                          placeholder="0"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">Unit Cost (₹)</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="h-8 text-sm"
                          placeholder="0.00"
                          value={item.unit_cost}
                          onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-0.5 text-right">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">Total</span>
                        <div className="h-8 flex items-center justify-end text-sm font-semibold text-gray-700 tabular-nums min-w-[80px]">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>
                    </div>

                    {/* Row 4: per-item note */}
                    <div>
                      <Input
                        className="h-7 text-xs text-gray-600 bg-white placeholder:text-gray-300"
                        placeholder="Item note (optional)..."
                        value={item.item_note}
                        onChange={(e) => updateItem(idx, 'item_note', e.target.value)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="text-right text-sm font-medium text-gray-700">
              Subtotal: {formatCurrency(subtotal)}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={createMut.isPending || !canSubmit}>
              {createMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Draft PO
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
