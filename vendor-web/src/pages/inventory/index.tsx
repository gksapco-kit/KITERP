import { useState, useCallback, useEffect, useMemo, useRef, Fragment } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useVendorStore } from '@/stores/vendorStore'
import { ResizableTable } from '@/components/table/ResizableTable'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import {
  useProducts,
  useInventorySummary,
  useInventoryHistory,
  useInventoryLowStock,
  useInventoryStockIn,
  useInventoryStockOut,
  useInventoryAdjust,
  useUpdateProduct,
  useSuppliers,
  usePurchaseOrders,
  useStores,
} from '@/hooks/useVendor'
import { formatDate } from '@/lib/utils'
import { StorageLocationSelect } from '@/components/inventory/StorageLocationSelect'
import {
  Loader2, Package, ArrowDownCircle, ArrowUpCircle, RefreshCw,
  AlertTriangle, X, ChevronLeft, ChevronRight, History, BarChart3,
  Upload, Download, CheckCircle2, XCircle, FileSpreadsheet, Store, ScanLine,
  ChevronDown, ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import { TableToolbar } from '@/components/table/TableToolbar'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { variantToUpdatePayload } from '@/lib/productVariantPresets'
import { processRows, type SortDir } from '@/lib/tableList'
import { BarcodeScannerModal } from '@/components/scanner/BarcodeScannerModal'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { toast } from 'sonner'
import { showBarcodeNotFound } from '@/components/scanner/BarcodeNotFoundToast'

type Tab = 'summary' | 'history' | 'low-stock'
type ModalType = 'stock-in' | 'stock-out' | 'adjust' | null

interface ModalState {
  type: ModalType
  productId?: string
  productName?: string
  variantId?: string
  storeId?: string
}

const movementBadge: Record<string, { bg: string; text: string; label: string }> = {
  stock_in: { bg: 'bg-green-50', text: 'text-green-700', label: 'Stock In' },
  stock_out: { bg: 'bg-red-50', text: 'text-red-700', label: 'Stock Out' },
  adjustment: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Adjustment' },
  sale: { bg: 'bg-accent', text: 'text-primary', label: 'Sale' },
  return: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Return' },
  sale_return: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Sale Return' },
  deduct: { bg: 'bg-red-50', text: 'text-red-700', label: 'Deduct' },
}

export default function Inventory() {
  const { selectedStore } = useVendorStore()
  const [tab, setTab] = useState<Tab>('summary')
  const [modal, setModal] = useState<ModalState>({ type: null })
  const [historyPage, setHistoryPage] = useState(1)
  const [historyProductFilter, setHistoryProductFilter] = useState('')
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [selectedStoreId, setSelectedStoreId] = useState<string>(selectedStore?.id ?? 'all')

  // Sync with global store selection
  useEffect(() => {
    setSelectedStoreId(selectedStore?.id ?? 'all')
  }, [selectedStore?.id])
  const [showScanner, setShowScanner] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)

  const { data: storesData } = useStores()
  const stores = storesData?.stores ?? []

  const { data: storeInventory, isLoading: storeInvLoading } = useQuery({
    queryKey: ['store-inventory', selectedStoreId],
    queryFn: () => vendorApi.getStoreInventory(selectedStoreId),
    enabled: selectedStoreId !== 'all',
  })

  const summaryStoreParam = selectedStoreId !== 'all' ? { store_id: selectedStoreId } : {}
  const { data: summary, isLoading: summaryLoading } = useInventorySummary(summaryStoreParam)
  const { data: history, isLoading: historyLoading } = useInventoryHistory({
    page: historyPage,
    size: 15,
    ...(historyProductFilter ? { product_id: historyProductFilter } : {}),
    ...(selectedStoreId !== 'all' ? { store_id: selectedStoreId } : {}),
  })
  const { data: lowStock, isLoading: lowStockLoading } = useInventoryLowStock(summaryStoreParam)

  const handleViewHistory = useCallback((productId: string) => {
    setHistoryProductFilter(productId)
    setHistoryPage(1)
    setTab('history')
  }, [])

  const handleBarcodeScan = useCallback(async (code: string) => {
    if (scanLoading) return
    setScanLoading(true)
    setShowScanner(false)
    try {
      const result = await vendorApi.barcodeLookup(code)
      const p = result.product
      const v = result.variant
      const productName = v ? `${p.name} — ${v.name}` : p.name
      setModal({ type: 'stock-in', productId: p.id, productName, variantId: v?.id, storeId: selectedStoreId !== 'all' ? selectedStoreId : undefined })
      toast.success(`Found: ${productName}`)
    } catch (err: any) {
      if (err?.response?.status === 404) {
        showBarcodeNotFound(code, () => window.open(`/products/new?barcode=${encodeURIComponent(code)}`, '_blank'))
      } else {
        toast.error('Barcode scan error. Please try again.')
      }
    } finally {
      setScanLoading(false)
    }
  }, [scanLoading])

  // Also listen for hardware scanner (keyboard-wedge) globally on this page
  useBarcodeScanner({ enabled: !showScanner && modal.type === null, onScan: handleBarcodeScan })

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'summary', label: 'Stock Overview', icon: BarChart3 },
    { key: 'history', label: 'Movement History', icon: History },
    { key: 'low-stock', label: `Low Stock${lowStock?.total ? ` (${lowStock.total})` : ''}`, icon: AlertTriangle },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          {stores.length > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <Store className="w-4 h-4 text-gray-400" />
              <Select
                value={selectedStoreId}
                onChange={setSelectedStoreId}
                options={[
                  { value: 'all', label: 'All Stores (Global)' },
                  ...stores.map(s => ({
                    value: s.id,
                    label: `${s.name}${s.code ? ` · ${s.code}` : ''}`,
                  })),
                ]}
                aria-label="Store filter"
                className="text-sm"
              />
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2" onClick={() => setShowBulkUpload(true)}>
            <Upload className="w-4 h-4 text-primary" />Bulk Upload
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setShowScanner(true)} disabled={scanLoading}>
            {scanLoading ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <ScanLine className="w-4 h-4 text-blue-500" />}
            Scan
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setModal({ type: 'stock-in' })}>
            <ArrowDownCircle className="w-4 h-4 text-green-600" />Stock In
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setModal({ type: 'stock-out' })}>
            <ArrowUpCircle className="w-4 h-4 text-red-600" />Stock Out
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setModal({ type: 'adjust' })}>
            <RefreshCw className="w-4 h-4 text-blue-600" />Adjust
          </Button>
        </div>
      </div>

      {/* Per-store inventory panel */}
      {selectedStoreId !== 'all' && (
        <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-primary">
              <Store className="w-4 h-4" />
              {stores.find(s => s.id === selectedStoreId)?.name} — Store Inventory
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {storeInvLoading ? (
              <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : !storeInventory?.items?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No inventory set for this store yet. Use the <a href="/stores" className="text-primary underline">Stores page</a> to manage stock levels.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground"><TableColumnLabel>Product</TableColumnLabel></th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground"><TableColumnLabel>SKU</TableColumnLabel></th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground"><TableColumnLabel>Location</TableColumnLabel></th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground"><TableColumnLabel>Qty</TableColumnLabel></th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground"><TableColumnLabel>Min Stock</TableColumnLabel></th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground"><TableColumnLabel>Status</TableColumnLabel></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {storeInventory.items.map(item => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 text-foreground">{item.product_name}</td>
                        <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{item.product_sku ?? '—'}</td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">{item.storage_location_name ?? '—'}</td>
                        <td className="px-4 py-2 text-right font-semibold text-foreground">{item.quantity}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{item.low_stock_threshold}</td>
                        <td className="px-4 py-2 text-right">
                          {item.quantity <= item.low_stock_threshold
                            ? <span className="bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 text-xs px-2 py-0.5 rounded-full">Low</span>
                            : <span className="bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">OK</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Products Tracked" value={summary?.total ?? '-'} loading={summaryLoading} />
        <StatCard label="Low Stock Items" value={summary?.low_stock_count ?? '-'} loading={summaryLoading} warn={(summary?.low_stock_count ?? 0) > 0} />
        <StatCard label="Movement Records" value={history?.total ?? '-'} loading={historyLoading} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px space-x-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key)
                if (t.key === 'history') setHistoryPage(1)
                if (t.key !== 'history') setHistoryProductFilter('')
              }}
              className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'summary' && (
        <SummaryTab
          data={summary}
          loading={summaryLoading}
          stores={stores}
          selectedStoreId={selectedStoreId}
          onAction={(pid, pname, type, vid?) => setModal({ type, productId: pid, productName: pname, variantId: vid, storeId: selectedStoreId !== 'all' ? selectedStoreId : undefined })}
          onViewHistory={handleViewHistory}
        />
      )}
      {tab === 'history' && (
        <HistoryTab
          data={history}
          loading={historyLoading}
          page={historyPage}
          setPage={setHistoryPage}
          productFilter={historyProductFilter}
          onClearFilter={() => setHistoryProductFilter('')}
        />
      )}
      {tab === 'low-stock' && (
        <LowStockTab
          data={lowStock}
          loading={lowStockLoading}
          selectedStoreId={selectedStoreId}
          onAction={(pid, pname) => setModal({ type: 'stock-in', productId: pid, productName: pname })}
          onViewHistory={handleViewHistory}
        />
      )}

      {/* Modal */}
      {modal.type && (
        <StockModal
          type={modal.type}
          prefillProductId={modal.productId}
          prefillProductName={modal.productName}
          prefillVariantId={modal.variantId}
          prefillStoreId={modal.storeId ?? (selectedStoreId !== 'all' ? selectedStoreId : undefined)}
          stores={stores}
          onClose={() => setModal({ type: null })}
        />
      )}

      {showBulkUpload && <BulkUploadModal onClose={() => setShowBulkUpload(false)} />}

      <BarcodeScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
        title="Scan to Find Product"
      />
    </div>
  )
}

function StatCard({ label, value, loading, warn }: { label: string; value: string | number; loading: boolean; warn?: boolean }) {
  return (
    <div className="bg-white rounded-xl border p-5" onClick={e => e.stopPropagation()}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${warn ? 'text-amber-600' : 'text-gray-900'}`}>
        {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : value}
      </p>
    </div>
  )
}

type VariantSummary = {
  id: string
  name: string
  sku?: string
  barcode?: string
  quantity: number
  cost_price?: number
  price?: number
  expiration_date?: string
  manufacture_date?: string
  best_before_date?: string
  low_stock_threshold: number
  stock_status: string
}

type StoreQty = { store_id: string; store_name: string; quantity: number }

type SummaryItem = {
  product_id: string
  product_name: string
  sku?: string
  current_quantity: number
  low_stock_threshold: number
  is_low_stock: boolean
  variants?: VariantSummary[]
  store_quantities?: StoreQty[]
}

function SummaryTab({ data, loading, stores, selectedStoreId, onAction, onViewHistory }: {
  data: { items: SummaryItem[] } | undefined
  loading: boolean
  stores: { id: string; name: string; code?: string }[]
  selectedStoreId: string
  onAction: (pid: string, pname: string, type: ModalType, vid?: string) => void
  onViewHistory: (pid: string) => void
}) {
  const qc = useQueryClient()
  const updateProduct = useUpdateProduct()
  const adjust = useInventoryAdjust()
  const { data: productsData } = useProducts({ size: 500 })
  const products = productsData?.items ?? []

  const { savingCellKey, setSavingCellKey, cellKey, patchField: patchProductField } = useInlineFieldPatch({
    mutateAsync: async ({ id, data: patchData }) => {
      const result = await updateProduct.mutateAsync({ id, data: patchData })
      await qc.invalidateQueries({ queryKey: ['vendor', 'inventory-summary'] })
      await qc.invalidateQueries({ queryKey: ['vendor', 'inventory-low-stock'] })
      return result
    },
  })

  const patchVariantFields = useCallback(async (
    productId: string,
    variantId: string,
    updates: Record<string, unknown>,
    savingField?: string,
  ) => {
    const product = products.find(p => p.id === productId)
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
      await qc.invalidateQueries({ queryKey: ['vendor', 'inventory-summary'] })
      await qc.invalidateQueries({ queryKey: ['vendor', 'inventory-low-stock'] })
    } finally {
      setSavingCellKey(null)
    }
  }, [products, updateProduct, qc, setSavingCellKey])

  const patchStockQuantity = useCallback(async (
    saveKey: string,
    productId: string,
    newQuantity: number,
    opts?: { variantId?: string; storeId?: string },
  ) => {
    setSavingCellKey(saveKey)
    try {
      await adjust.mutateAsync({
        product_id: productId,
        variant_id: opts?.variantId,
        store_id: opts?.storeId,
        new_quantity: newQuantity,
        reason: 'Inline edit',
      })
    } finally {
      setSavingCellKey(null)
    }
  }, [adjust, setSavingCellKey])

  const isSaving = useCallback(
    (entityId: string, field: string) => savingCellKey === cellKey(entityId, field),
    [cellKey, savingCellKey],
  )
  const isSavingVariant = useCallback(
    (productId: string, variantId: string, field: string) =>
      savingCellKey === `${productId}:variant:${variantId}:${field}`,
    [savingCellKey],
  )

  const getProduct = useCallback((id: string) => products.find(p => p.id === id), [products])

  const [q, setQ] = useState('')
  const [sk, setSk] = useState('product_name')
  const [sd, setSd] = useState<SortDir>('asc')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleExpanded = useCallback((pid: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid); else next.add(pid)
      return next
    })
  }, [])

  const rows = useMemo(() => {
    if (!data?.items?.length) return []
    return processRows(
      data.items,
      q,
      (i) => [i.product_name, i.sku || '', String(i.current_quantity)],
      sk,
      sd,
      {
        product_name: (i) => i.product_name,
        sku: (i) => i.sku || '',
        current_quantity: (i) => i.current_quantity,
        low_stock_threshold: (i) => i.low_stock_threshold,
        is_low_stock: (i) => (i.is_low_stock ? 0 : 1),
      },
    )
  }, [data?.items, q, sk, sd])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  if (!data?.items?.length) return (
    <div className="text-center py-16">
      <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
      <p className="text-gray-500">No tracked products yet. Add stock to get started.</p>
    </div>
  )

  return (
    <Card>
      <CardContent className="p-0">
        <TableToolbar
          search={q}
          onSearchChange={setQ}
          searchPlaceholder="Filter products…"
          sortOptions={[
            { value: 'product_name', label: 'Product' },
            { value: 'sku', label: 'SKU' },
            { value: 'current_quantity', label: 'Stock' },
            { value: 'low_stock_threshold', label: 'Threshold' },
            { value: 'is_low_stock', label: 'Low first' },
          ]}
          sortKey={sk}
          sortDir={sd}
          onSortKeyChange={setSk}
          onSortDirChange={setSd}
          hint={INLINE_EDIT_HINT}
          className="rounded-t-xl"
        />
        <div className="overflow-x-auto">
        <ResizableTable tableId="inventory-stock-v3" defaultWidths={[240, 110, 110, 110, 110, ...stores.map(() => 90), 140, 300]}>
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Product / Variant</TableColumnLabel></th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>SKU</TableColumnLabel></th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Barcode</TableColumnLabel></th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Cost Price</TableColumnLabel></th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                {selectedStoreId !== 'all' ? (stores.find(s => s.id === selectedStoreId)?.name ?? 'Store') + ' Stock' : 'Total Stock'}
              </th>
              {selectedStoreId === 'all' && stores.map(s => (
                <th key={s.id} className="text-right px-4 py-3 text-xs font-medium text-indigo-500 uppercase whitespace-nowrap">
                  {s.code || s.name}
                </th>
              ))}
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Status</TableColumnLabel></th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr><td colSpan={7 + stores.length} className="px-6 py-8 text-center text-sm text-gray-500">No rows match your filter.</td></tr>
            ) : rows.map((item) => {
              const hasVariants = (item.variants?.length ?? 0) > 0
              const isExpanded = expandedRows.has(item.product_id)
              const fullProduct = getProduct(item.product_id)
              const storeFilterId = selectedStoreId !== 'all' ? selectedStoreId : undefined
              return (
                <Fragment key={item.product_id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {hasVariants && (
                          <button onClick={() => toggleExpanded(item.product_id)} className="p-0.5 rounded hover:bg-gray-200 text-gray-400">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <InlineEditCell
                          value={item.product_name}
                          saving={isSaving(item.product_id, 'name')}
                          onSave={(v) => patchProductField(item.product_id, 'name', String(v).trim())}
                          className="font-medium"
                        >
                          <Link to={`/products/${item.product_id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                            {item.product_name}
                          </Link>
                        </InlineEditCell>
                        {hasVariants && (
                          <span className="text-xs text-gray-400">({item.variants!.length} variants)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <InlineEditCell
                        value={item.sku || ''}
                        saving={isSaving(item.product_id, 'sku')}
                        onSave={(v) => patchProductField(item.product_id, 'sku', String(v).trim())}
                      >
                        {item.sku || '-'}
                      </InlineEditCell>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400 font-mono text-xs">
                      <InlineEditCell
                        value={fullProduct?.barcode || ''}
                        readOnly={hasVariants}
                        readOnlyMessage="Edit barcode on variant rows"
                        saving={isSaving(item.product_id, 'barcode')}
                        onSave={(v) => patchProductField(item.product_id, 'barcode', String(v).trim())}
                      >
                        {hasVariants ? '-' : (fullProduct?.barcode || '-')}
                      </InlineEditCell>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-500">
                      <InlineEditCell
                        type="number"
                        min={0}
                        step="0.01"
                        value={fullProduct?.cost_price ?? 0}
                        readOnly={hasVariants}
                        readOnlyMessage="Edit cost price on variant rows"
                        saving={isSaving(item.product_id, 'cost_price')}
                        onSave={(v) => patchProductField(item.product_id, 'cost_price', Number(v))}
                        className="text-right"
                      >
                        {hasVariants ? '-' : (fullProduct?.cost_price != null ? `₹${fullProduct.cost_price.toFixed(2)}` : '-')}
                      </InlineEditCell>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium whitespace-nowrap">
                      <InlineEditCell
                        type="number"
                        min={0}
                        value={item.current_quantity}
                        readOnly={hasVariants}
                        readOnlyMessage="Edit stock on variant rows"
                        saving={isSaving(item.product_id, 'quantity')}
                        onSave={(v) => patchStockQuantity(
                          cellKey(item.product_id, 'quantity'),
                          item.product_id,
                          Number(v),
                          { storeId: storeFilterId },
                        )}
                        className="text-right font-medium"
                      >
                        {item.current_quantity}
                      </InlineEditCell>
                    </td>
                    {selectedStoreId === 'all' && stores.map(s => {
                      const sq = item.store_quantities?.find(q => q.store_id === s.id)
                      const qty = sq?.quantity ?? 0
                      return (
                        <td key={s.id} className="px-4 py-4 text-sm text-right text-indigo-600 font-medium">
                          <InlineEditCell
                            type="number"
                            min={0}
                            value={qty}
                            readOnly={hasVariants}
                            readOnlyMessage="Edit stock on variant rows"
                            saving={savingCellKey === `${item.product_id}:store:${s.id}`}
                            onSave={(v) => patchStockQuantity(
                              `${item.product_id}:store:${s.id}`,
                              item.product_id,
                              Number(v),
                              { storeId: s.id },
                            )}
                            className="text-right font-medium text-indigo-600"
                          >
                            {sq ? sq.quantity : <span className="text-gray-300">—</span>}
                          </InlineEditCell>
                        </td>
                      )
                    })}
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <InlineEditCell
                        type="number"
                        min={0}
                        value={item.low_stock_threshold}
                        saving={isSaving(item.product_id, 'low_stock_threshold')}
                        onSave={(v) => patchProductField(item.product_id, 'low_stock_threshold', Number(v))}
                        title="Double-click to edit low-stock threshold"
                        truncateContent={false}
                      >
                        {item.is_low_stock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            <AlertTriangle className="w-3 h-3 shrink-0" />Low
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">OK</span>
                        )}
                      </InlineEditCell>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="inline-flex flex-nowrap items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="text-gray-500 text-xs" onClick={() => onViewHistory(item.product_id)}>
                          <History className="w-3 h-3 mr-1" />History
                        </Button>
                        <Button variant="ghost" size="sm" className="text-green-600 text-xs" onClick={() => onAction(item.product_id, item.product_name, 'stock-in')}>+ In</Button>
                        <Button variant="ghost" size="sm" className="text-red-600 text-xs" onClick={() => onAction(item.product_id, item.product_name, 'stock-out')}>- Out</Button>
                        <Button variant="ghost" size="sm" className="text-blue-600 text-xs" onClick={() => onAction(item.product_id, item.product_name, 'adjust')}>Adjust</Button>
                      </div>
                    </td>
                  </tr>
                  {hasVariants && isExpanded && item.variants!.map((v) => {
                    const statusColor = v.stock_status === 'in_stock'
                      ? 'bg-green-50 text-green-700'
                      : v.stock_status === 'low_stock'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-red-50 text-red-700'
                    const statusLabel = v.stock_status === 'in_stock' ? 'In Stock' : v.stock_status === 'low_stock' ? 'Low' : 'Out'
                    return (
                      <tr key={v.id} className="bg-gray-50/60 border-l-2 border-l-blue-200">
                        <td className="px-6 py-3 text-sm text-gray-700 pl-12">
                          <span className="text-gray-400 mr-1">└</span>
                          <InlineEditCell
                            value={v.name}
                            saving={isSavingVariant(item.product_id, v.id, 'name')}
                            onSave={(val) => patchVariantFields(item.product_id, v.id, { name: String(val).trim() }, 'name')}
                          >
                            {v.name}
                          </InlineEditCell>
                          {v.expiration_date && (
                            <span className="ml-2 text-xs text-gray-400">Exp: {v.expiration_date}</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-500">
                          <InlineEditCell
                            value={v.sku || ''}
                            saving={isSavingVariant(item.product_id, v.id, 'sku')}
                            onSave={(val) => patchVariantFields(item.product_id, v.id, { sku: String(val).trim() }, 'sku')}
                          >
                            {v.sku || '-'}
                          </InlineEditCell>
                        </td>
                        <td className="px-6 py-3 text-xs text-gray-400 font-mono">
                          <InlineEditCell
                            value={v.barcode || ''}
                            saving={isSavingVariant(item.product_id, v.id, 'barcode')}
                            onSave={(val) => patchVariantFields(item.product_id, v.id, { barcode: String(val).trim() }, 'barcode')}
                          >
                            {v.barcode || '-'}
                          </InlineEditCell>
                        </td>
                        <td className="px-6 py-3 text-sm text-right text-gray-600">
                          <InlineEditCell
                            type="number"
                            min={0}
                            step="0.01"
                            value={v.cost_price ?? 0}
                            saving={isSavingVariant(item.product_id, v.id, 'cost_price')}
                            onSave={(val) => patchVariantFields(item.product_id, v.id, { cost_price: Number(val) }, 'cost_price')}
                            className="text-right"
                          >
                            {v.cost_price != null ? `₹${v.cost_price.toFixed(2)}` : '-'}
                          </InlineEditCell>
                        </td>
                        <td className="px-6 py-3 text-sm text-right font-medium">
                          <InlineEditCell
                            type="number"
                            min={0}
                            value={v.quantity}
                            saving={isSavingVariant(item.product_id, v.id, 'quantity')}
                            onSave={(val) => patchStockQuantity(
                              `${item.product_id}:variant:${v.id}:quantity`,
                              item.product_id,
                              Number(val),
                              { variantId: v.id, storeId: storeFilterId },
                            )}
                            className="text-right font-medium"
                          >
                            {v.quantity}
                          </InlineEditCell>
                        </td>
                        {selectedStoreId === 'all' && stores.map(s => (
                          <td key={s.id} className="px-4 py-3 text-sm text-right text-gray-300">
                            <InlineEditCell
                              readOnly
                              readOnlyMessage="Per-store stock is tracked at product level"
                              value={0}
                              onSave={() => {}}
                            >
                              —
                            </InlineEditCell>
                          </td>
                        ))}
                        <td className="px-6 py-3 text-center whitespace-nowrap">
                          <InlineEditCell
                            type="number"
                            min={0}
                            value={v.low_stock_threshold}
                            saving={isSavingVariant(item.product_id, v.id, 'low_stock_threshold')}
                            onSave={(val) => patchVariantFields(item.product_id, v.id, { low_stock_threshold: Number(val) }, 'low_stock_threshold')}
                            title="Double-click to edit low-stock threshold"
                            truncateContent={false}
                          >
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                          </InlineEditCell>
                        </td>
                        <td className="px-6 py-3 text-right whitespace-nowrap">
                          <Button variant="ghost" size="sm" className="text-green-600 text-xs" onClick={() => onAction(item.product_id, `${item.product_name} — ${v.name}`, 'stock-in', v.id)}>+ In</Button>
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </ResizableTable>
        </div>
      </CardContent>
    </Card>
  )
}

type HistRow = { id: string; product_id: string; movement_type: string; quantity: number; quantity_before: number; quantity_after: number; reason?: string; created_at: string }

function HistoryTab({ data, loading, page, setPage, productFilter, onClearFilter }: {
  data: { items: HistRow[]; total: number; pages: number } | undefined
  loading: boolean
  page: number
  setPage: (p: number) => void
  productFilter: string
  onClearFilter: () => void
}) {
  const [q, setQ] = useState('')
  const [sk, setSk] = useState('created_at')
  const [sd, setSd] = useState<SortDir>('desc')

  const rows = useMemo(() => {
    if (!data?.items?.length) return []
    let items = data.items
    if (productFilter) {
      items = items.filter((m) => m.product_id === productFilter)
    }
    return processRows(
      items,
      q,
      (m) => [m.movement_type, m.reason || '', m.product_id, String(m.quantity)],
      sk,
      sd,
      {
        movement_type: (m) => m.movement_type,
        quantity: (m) => m.quantity,
        quantity_before: (m) => m.quantity_before,
        quantity_after: (m) => m.quantity_after,
        reason: (m) => m.reason || '',
        created_at: (m) => m.created_at,
      },
    )
  }, [data?.items, q, sk, sd, productFilter])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  if (!data?.items?.length) return (
    <div className="text-center py-16">
      <History className="w-12 h-12 text-gray-200 mx-auto mb-3" />
      <p className="text-gray-500">No inventory movements recorded yet.</p>
    </div>
  )

  return (
    <>
      {productFilter && (
        <div className="flex items-center gap-2 px-1 py-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Filtered by product
            <button type="button" aria-label="Close" onClick={onClearFilter} className="hover:text-blue-900">
                <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}
      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search={q}
            onSearchChange={setQ}
            searchPlaceholder="Filter type, reason, product id…"
            sortOptions={[
              { value: 'created_at', label: 'Date' },
              { value: 'movement_type', label: 'Type' },
              { value: 'quantity', label: 'Qty' },
              { value: 'quantity_before', label: 'Before' },
              { value: 'quantity_after', label: 'After' },
              { value: 'reason', label: 'Reason' },
            ]}
            sortKey={sk}
            sortDir={sd}
            onSortKeyChange={setSk}
            onSortDirChange={setSd}
            hint={productFilter ? 'Showing history for one product.' : 'Applies to current page of history.'}
            className="rounded-t-xl"
          />
          <ResizableTable tableId="inventory-movements" defaultWidths={[110, 80, 80, 80, 140, 180, 120]}>
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Type</TableColumnLabel></th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Qty</TableColumnLabel></th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Before</TableColumnLabel></th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>After</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Location</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Reason</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Date</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No rows match your filter.</td></tr>
              ) : rows.map((m) => {
                const badge = movementBadge[m.movement_type] || { bg: 'bg-gray-50', text: 'text-gray-700', label: m.movement_type }
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium">{m.quantity}</td>
                    <td className="px-6 py-3 text-sm text-right text-gray-500">{m.quantity_before}</td>
                    <td className="px-6 py-3 text-sm text-right font-medium">{m.quantity_after}</td>
                    <td className="px-6 py-3 text-sm text-gray-600 max-w-[140px] truncate">{m.storage_location_name || '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-600 max-w-xs truncate">{m.reason || '-'}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{formatDate(m.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </ResizableTable>
        </CardContent>
      </Card>
      {!productFilter && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {page} of {data.pages} ({data.total} records)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
              Next<ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

type LowItem = { product_id: string; product_name: string; sku?: string; current_quantity: number; low_stock_threshold: number }

function LowStockTab({ data, loading, selectedStoreId, onAction, onViewHistory }: {
  data: { items: LowItem[]; total: number } | undefined
  loading: boolean
  selectedStoreId: string
  onAction: (pid: string, pname: string) => void
  onViewHistory: (pid: string) => void
}) {
  const qc = useQueryClient()
  const updateProduct = useUpdateProduct()
  const adjust = useInventoryAdjust()
  const { savingCellKey, setSavingCellKey, cellKey, patchField: patchProductField } = useInlineFieldPatch({
    mutateAsync: async ({ id, data: patchData }) => {
      const result = await updateProduct.mutateAsync({ id, data: patchData })
      await qc.invalidateQueries({ queryKey: ['vendor', 'inventory-summary'] })
      await qc.invalidateQueries({ queryKey: ['vendor', 'inventory-low-stock'] })
      return result
    },
  })

  const patchStockQuantity = useCallback(async (
    saveKey: string,
    productId: string,
    newQuantity: number,
  ) => {
    setSavingCellKey(saveKey)
    try {
      await adjust.mutateAsync({
        product_id: productId,
        new_quantity: newQuantity,
        store_id: selectedStoreId !== 'all' ? selectedStoreId : undefined,
        reason: 'Inline edit',
      })
    } finally {
      setSavingCellKey(null)
    }
  }, [adjust, selectedStoreId, setSavingCellKey])

  const isSaving = useCallback(
    (entityId: string, field: string) => savingCellKey === cellKey(entityId, field),
    [cellKey, savingCellKey],
  )

  const [q, setQ] = useState('')
  const [sk, setSk] = useState('shortage')
  const [sd, setSd] = useState<SortDir>('desc')

  const rows = useMemo(() => {
    if (!data?.items?.length) return []
    const withShortage = data.items.map((i) => ({
      ...i,
      shortage: i.low_stock_threshold - i.current_quantity,
    }))
    return processRows(
      withShortage,
      q,
      (i) => [i.product_name, i.sku || '', String(i.current_quantity)],
      sk,
      sd,
      {
        product_name: (i) => i.product_name,
        sku: (i) => i.sku || '',
        current_quantity: (i) => i.current_quantity,
        low_stock_threshold: (i) => i.low_stock_threshold,
        shortage: (i) => i.shortage,
      },
    )
  }, [data?.items, q, sk, sd])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  if (!data?.items?.length) return (
    <div className="text-center py-16">
      <AlertTriangle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
      <p className="text-gray-500">No low stock alerts. All products are well stocked!</p>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-amber-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />{data.total} product{data.total !== 1 ? 's' : ''} below threshold
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <TableToolbar
          search={q}
          onSearchChange={setQ}
          searchPlaceholder="Filter products…"
          sortOptions={[
            { value: 'shortage', label: 'Shortage' },
            { value: 'product_name', label: 'Product' },
            { value: 'sku', label: 'SKU' },
            { value: 'current_quantity', label: 'Current' },
            { value: 'low_stock_threshold', label: 'Threshold' },
          ]}
          sortKey={sk}
          sortDir={sd}
          onSortKeyChange={setSk}
          onSortDirChange={setSd}
          hint={INLINE_EDIT_HINT}
        />
        <ResizableTable tableId="inventory-lowstock" defaultWidths={[240, 120, 90, 90, 90, 80]}>
          <thead>
            <tr className="border-b bg-amber-50/50">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Product</TableColumnLabel></th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>SKU</TableColumnLabel></th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Current</TableColumnLabel></th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Threshold</TableColumnLabel></th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Shortage</TableColumnLabel></th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No rows match your filter.</td></tr>
            ) : rows.map((item) => (
              <tr key={item.product_id} className="hover:bg-amber-50/30">
                <td className="px-6 py-4 text-sm font-medium">
                  <InlineEditCell
                    value={item.product_name}
                    saving={isSaving(item.product_id, 'name')}
                    onSave={(v) => patchProductField(item.product_id, 'name', String(v).trim())}
                    className="font-medium"
                  >
                    <Link to={`/products/${item.product_id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                      {item.product_name}
                    </Link>
                  </InlineEditCell>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <InlineEditCell
                    value={item.sku || ''}
                    saving={isSaving(item.product_id, 'sku')}
                    onSave={(v) => patchProductField(item.product_id, 'sku', String(v).trim())}
                  >
                    {item.sku || '-'}
                  </InlineEditCell>
                </td>
                <td className="px-6 py-4 text-sm text-right font-medium text-red-600">
                  <InlineEditCell
                    type="number"
                    min={0}
                    value={item.current_quantity}
                    saving={isSaving(item.product_id, 'quantity')}
                    onSave={(v) => patchStockQuantity(cellKey(item.product_id, 'quantity'), item.product_id, Number(v))}
                    className="text-right font-medium text-red-600"
                  >
                    {item.current_quantity}
                  </InlineEditCell>
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-500">
                  <InlineEditCell
                    type="number"
                    min={0}
                    value={item.low_stock_threshold}
                    saving={isSaving(item.product_id, 'low_stock_threshold')}
                    onSave={(v) => patchProductField(item.product_id, 'low_stock_threshold', Number(v))}
                    className="text-right"
                  >
                    {item.low_stock_threshold}
                  </InlineEditCell>
                </td>
                <td className="px-6 py-4 text-sm text-right font-medium text-amber-600">
                  <InlineEditCell
                    readOnly
                    readOnlyMessage="Shortage is calculated from current stock and threshold"
                    value={item.shortage}
                    onSave={() => {}}
                    className="text-right font-medium text-amber-600"
                  >
                    {item.shortage}
                  </InlineEditCell>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="sm" className="text-gray-500 text-xs" onClick={() => onViewHistory(item.product_id)}>
                      <History className="w-3 h-3 mr-1" />History
                    </Button>
                    <Button size="sm" onClick={() => onAction(item.product_id, item.product_name)}>
                      <ArrowDownCircle className="w-4 h-4 mr-1" />Restock
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </ResizableTable>
      </CardContent>
    </Card>
  )
}

function StockModal({
 type, prefillProductId, prefillProductName, prefillVariantId, prefillStoreId, stores, onClose }: {
  type: 'stock-in' | 'stock-out' | 'adjust'
  prefillProductId?: string
  prefillProductName?: string
  prefillVariantId?: string
  prefillStoreId?: string
  stores: { id: string; name: string; code?: string }[]
  onClose: () => void
}) {
  const { data: productsData } = useProducts({ size: 500 })
  const { data: suppliersData } = useSuppliers({ size: 200 })
  const { data: poData } = usePurchaseOrders({ size: 200, status: 'ordered,partial' })
  const stockIn = useInventoryStockIn()
  const stockOut = useInventoryStockOut()
  const adjust = useInventoryAdjust()

  const [productId, setProductId] = useState(prefillProductId || '')
  const [variantId, setVariantId] = useState(prefillVariantId || '')
  const [storeId, setStoreId] = useState(prefillStoreId || '')
  const [storageLocationId, setStorageLocationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [purchaseOrderId, setPurchaseOrderId] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [manufactureDate, setManufactureDate] = useState('')
  const [bestBeforeDate, setBestBeforeDate] = useState('')

  const products = productsData?.items || []
  const suppliers = suppliersData?.items || []
  const allPOs = poData?.items || []

  // Fetch the full product (with variants) for the currently selected product
  const { data: fullProduct } = useQuery({
    queryKey: ['product-full', productId],
    queryFn: () => vendorApi.getProduct(productId),
    enabled: !!productId,
  })

  const productVariants = useMemo(
    () => ((fullProduct as any)?.variants ?? []).filter((v: any) => v.is_active !== false),
    [fullProduct]
  )

  // Once productVariants loads, restore the prefill variant selection if not yet set
  const variantsLoaded = productVariants.length > 0
  const prevVariantsLoaded = useRef(false)
  if (variantsLoaded && !prevVariantsLoaded.current) {
    prevVariantsLoaded.current = true
    if (prefillVariantId && variantId !== prefillVariantId) {
      // Schedule the state update outside of render
      setTimeout(() => setVariantId(prefillVariantId), 0)
    }
  }

  const [showAllPOs, setShowAllPOs] = useState(false)

  // POs that contain the selected product in their line items
  const productPOs = useMemo(
    () => productId
      ? allPOs.filter(po => po.items?.some((item: any) => item.product_id === productId))
      : allPOs,
    [allPOs, productId]
  )

  // Apply supplier filter on top, and respect showAllPOs toggle
  const filteredPOs = useMemo(() => {
    const base = showAllPOs ? allPOs : productPOs
    return supplierId ? base.filter(po => po.supplier_id === supplierId) : base
  }, [allPOs, productPOs, supplierId, showAllPOs])

  const isLoading = stockIn.isPending || stockOut.isPending || adjust.isPending
  const title = type === 'stock-in' ? 'Receive Stock' : type === 'stock-out' ? 'Stock Out' : 'Adjust Stock'
  const isStockIn = type === 'stock-in'

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productId || !quantity) return

    const resolvedProductId = productId
    const resolvedVariantId = variantId || undefined

    if (type === 'adjust') {
      const payload: Record<string, unknown> = {
        product_id: resolvedProductId,
        variant_id: resolvedVariantId,
        new_quantity: parseInt(quantity),
        reason: reason || undefined,
        store_id: storeId || undefined,
        storage_location_id: storageLocationId || undefined,
      }
      try {
        await adjust.mutateAsync(payload)
        onClose()
      } catch { /* handled by hook */ }
      return
    }

    if (type === 'stock-out') {
      const payload: Record<string, unknown> = {
        product_id: resolvedProductId,
        variant_id: resolvedVariantId,
        quantity: parseInt(quantity),
        reason: reason || undefined,
        store_id: storeId || undefined,
        storage_location_id: storageLocationId || undefined,
      }
      try {
        await stockOut.mutateAsync(payload)
        onClose()
      } catch { /* handled by hook */ }
      return
    }

    // Stock-in with all extended fields
    const payload: Record<string, unknown> = {
      product_id: resolvedProductId,
      variant_id: resolvedVariantId,
      quantity: parseInt(quantity),
      reason: reason || undefined,
      store_id: storeId || undefined,
      storage_location_id: storageLocationId || undefined,
      supplier_id: supplierId || undefined,
      purchase_order_id: purchaseOrderId || undefined,
      batch_number: batchNumber || undefined,
      cost_price: costPrice ? parseFloat(costPrice) : undefined,
      selling_price: sellingPrice ? parseFloat(sellingPrice) : undefined,
      expiration_date: expirationDate || undefined,
      manufacture_date: manufactureDate || undefined,
      best_before_date: bestBeforeDate || undefined,
    }

    try {
      await stockIn.mutateAsync(payload)
      onClose()
    } catch { /* handled by hook */ }
  }, [
    productId, variantId, quantity, reason, type, storeId, storageLocationId,
    supplierId, purchaseOrderId, batchNumber, costPrice, sellingPrice,
    expirationDate, manufactureDate, bestBeforeDate,
    stockIn, stockOut, adjust, onClose,
  ])

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* Product */}
          <div className="space-y-1.5">
            <Label>Product</Label>
            {prefillProductName && prefillProductId ? (
              <p className="text-sm font-medium text-gray-900 bg-gray-50 rounded-lg px-3 py-2">{prefillProductName}</p>
            ) : (
              <Select
                value={productId}
                onChange={(v) => { setProductId(v); setVariantId(''); setPurchaseOrderId(''); setShowAllPOs(false) }}
                options={selectOptionsWithBlank('Select a product...', products.map((p) => ({
                  value: p.id,
                  label: `${p.name}${p.sku ? ` (${p.sku})` : ''}`,
                })))}
                placeholder="Select a product..."
                aria-label="Product"
              />
            )}
          </div>

          {/* Variant selector — shown when product has variants */}
          {productVariants.length > 0 && (
            <div className="space-y-1.5">
              <Label>Variant <span className="text-gray-400 text-xs">(optional — leave blank for product-level)</span></Label>
              <Select
                value={variantId}
                onChange={setVariantId}
                options={selectOptionsWithBlank('All / Product-level', productVariants.map((v: any) => ({
                  value: v.id,
                  label: `${v.name}${v.sku ? ` · ${v.sku}` : ''}${v.barcode ? ` · ${v.barcode}` : ''}`,
                })))}
                placeholder="All / Product-level"
                aria-label="Variant"
              />
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label>{type === 'adjust' ? 'New Quantity (absolute)' : 'Quantity'}</Label>
            <Input
              type="number"
              min={type === 'adjust' ? 0 : 1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={type === 'adjust' ? 'Set to...' : 'Enter quantity'}
              required
            />
          </div>

          {/* Store selector — shown for all types when stores exist */}
          {stores.length > 0 && (
            <div className="space-y-1.5">
              <Label>Business Unit <span className="text-gray-400 text-xs">(which store receives or ships this stock)</span></Label>
              <Select
                value={storeId}
                onChange={(v) => { setStoreId(v); setStorageLocationId('') }}
                options={selectOptionsWithBlank('Global / All Stores', stores.map(s => ({
                  value: s.id,
                  label: `${s.name}${s.code ? ` · ${s.code}` : ''}`,
                })))}
                placeholder="Global / All Stores"
                aria-label="Business unit"
              />
            </div>
          )}

          {storeId && (
            <div className="space-y-1.5">
              <Label>Storage Location <span className="text-gray-400 text-xs">(optional — aisle, shelf, bin)</span></Label>
              <StorageLocationSelect
                storeId={storeId}
                value={storageLocationId}
                onChange={setStorageLocationId}
              />
            </div>
          )}

          {/* Extended stock-in fields */}
          {isStockIn && (
            <>
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase mb-3">Receiving Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Supplier */}
                  <div className="space-y-1.5">
                    <Label>Supplier</Label>
                    <Select
                      value={supplierId}
                      onChange={(v) => { setSupplierId(v); setPurchaseOrderId('') }}
                      options={selectOptionsWithBlank('— None —', suppliers.map((s) => ({ value: s.id, label: s.name })))}
                      placeholder="— None —"
                      aria-label="Supplier"
                    />
                  </div>

                  {/* Purchase Order */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Purchase Order</Label>
                      <button
                        type="button"
                        onClick={() => { setShowAllPOs(v => !v); setPurchaseOrderId('') }}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          showAllPOs
                            ? 'bg-primary text-white border-blue-600'
                            : 'text-blue-600 border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        {showAllPOs
                          ? `Product only (${productPOs.length})`
                          : `All open POs (${allPOs.length})`}
                      </button>
                    </div>
                    <Select
                      value={purchaseOrderId}
                      onChange={setPurchaseOrderId}
                      options={selectOptionsWithBlank('— None —', filteredPOs.map((po) => ({
                        value: po.id,
                        label: `${po.po_number}${po.supplier_name ? ` · ${po.supplier_name}` : ''}${!showAllPOs ? '' : po.items?.some((i: any) => i.product_id === productId) ? ' ✓' : ''}`,
                      })))}
                      placeholder={filteredPOs.length === 0 ? (showAllPOs ? 'No open POs found' : 'No POs for this product') : '— None —'}
                      aria-label="Purchase order"
                    />
                    {!showAllPOs && filteredPOs.length === 0 && productId && (
                      <p className="text-xs text-gray-400">
                        No POs contain this product.{' '}
                        <button type="button" onClick={() => setShowAllPOs(true)} className="text-blue-500 underline">
                          Show all open POs
                        </button>
                      </p>
                    )}
                  </div>

                  {/* Batch / Lot Number */}
                  <div className="space-y-1.5">
                    <Label>Batch / Lot Number</Label>
                    <Input
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                      placeholder="e.g., LOT-2024-001"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase mb-3">Pricing Updates</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Cost Price <span className="text-gray-400 text-xs">(updates record)</span></Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder="e.g., 150.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Selling Price <span className="text-gray-400 text-xs">(updates record)</span></Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      placeholder="e.g., 250.00"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase mb-3">Dates</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Manufacture Date</Label>
                    <Input
                      type="date"
                      value={manufactureDate}
                      onChange={(e) => setManufactureDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Best Before</Label>
                    <Input
                      type="date"
                      value={bestBeforeDate}
                      onChange={(e) => setBestBeforeDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Expiration Date</Label>
                    <Input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          <div className="space-y-1.5 border-t pt-4">
            <Label>Notes <span className="text-gray-400 text-xs">(optional)</span></Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isStockIn ? 'e.g., Purchase order received, inspection notes…'
                  : type === 'stock-out' ? 'e.g., Damaged goods, expired batch…'
                  : 'e.g., Physical count correction'
              }
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isLoading || !productId || !quantity}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {title}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Bulk Upload ─────────────────────────────────────────────────────

interface BulkRow {
  product_name: string
  sku: string
  quantity: string
  type: string
  reason: string
}

interface BulkRowResult {
  row: number
  status: 'pending' | 'success' | 'error'
  message?: string
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"/, '').replace(/"$/, ''))
  const rows = lines.slice(1).map((line) => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    cells.push(current.trim())
    return cells
  })
  return { headers, rows }
}

function BulkUploadModal({
 onClose }: { onClose: () => void }) {
  const { data: productsData } = useProducts({ size: 500 })
  const stockIn = useInventoryStockIn()
  const adjust = useInventoryAdjust()

  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'done'>('upload')
  const [parsedRows, setParsedRows] = useState<BulkRow[]>([])
  const [parseError, setParseError] = useState('')
  const [results, setResults] = useState<BulkRowResult[]>([])

  const products = productsData?.items || []

  const resolveProductId = useCallback((name: string, sku: string): string | null => {
    if (!products.length) return null
    if (sku) {
      const bySku = products.find((p) => p.sku?.toLowerCase() === sku.toLowerCase())
      if (bySku) return bySku.id
    }
    const byName = products.find((p) => p.name.toLowerCase() === name.toLowerCase())
    return byName?.id || null
  }, [products])

  const handleDownloadTemplate = useCallback(() => {
    const csv = 'product_name,sku,quantity,type,reason\n"Example Product","SKU-001",10,stock_in,"New shipment"\n"Another Product","SKU-002",5,adjustment,"Count correction"'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'inventory_bulk_upload_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError('')
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers, rows } = parseCSV(text)

      const required = ['product_name', 'quantity', 'type']
      const missing = required.filter((h) => !headers.includes(h))
      if (missing.length) {
        setParseError(`Missing required columns: ${missing.join(', ')}`)
        return
      }

      const nameIdx = headers.indexOf('product_name')
      const skuIdx = headers.indexOf('sku')
      const qtyIdx = headers.indexOf('quantity')
      const typeIdx = headers.indexOf('type')
      const reasonIdx = headers.indexOf('reason')

      const parsed: BulkRow[] = rows
        .filter((cells) => cells.some((c) => c.trim()))
        .map((cells) => ({
          product_name: cells[nameIdx] || '',
          sku: skuIdx >= 0 ? cells[skuIdx] || '' : '',
          quantity: cells[qtyIdx] || '',
          type: cells[typeIdx] || '',
          reason: reasonIdx >= 0 ? cells[reasonIdx] || '' : '',
        }))

      if (!parsed.length) {
        setParseError('No data rows found in the CSV file.')
        return
      }

      setParsedRows(parsed)
      setStep('preview')
    }
    reader.readAsText(file)
  }, [])

  const handleSubmit = useCallback(async () => {
    setStep('processing')
    const newResults: BulkRowResult[] = parsedRows.map((_, i) => ({ row: i + 1, status: 'pending' as const }))
    setResults([...newResults])

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i]
      const productId = resolveProductId(row.product_name, row.sku)

      if (!productId) {
        newResults[i] = { row: i + 1, status: 'error', message: `Product not found: "${row.product_name}"${row.sku ? ` (SKU: ${row.sku})` : ''}` }
        setResults([...newResults])
        continue
      }

      const qty = parseInt(row.quantity)
      if (isNaN(qty) || qty < 0) {
        newResults[i] = { row: i + 1, status: 'error', message: `Invalid quantity: "${row.quantity}"` }
        setResults([...newResults])
        continue
      }

      const rowType = row.type.trim().toLowerCase()
      try {
        if (rowType === 'stock_in') {
          await stockIn.mutateAsync({ product_id: productId, quantity: qty, reason: row.reason || undefined })
        } else if (rowType === 'adjustment') {
          await adjust.mutateAsync({ product_id: productId, new_quantity: qty, reason: row.reason || undefined })
        } else {
          newResults[i] = { row: i + 1, status: 'error', message: `Unknown type: "${row.type}". Use stock_in or adjustment.` }
          setResults([...newResults])
          continue
        }
        newResults[i] = { row: i + 1, status: 'success' }
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Server rejected this row — check product ID and quantity'
        newResults[i] = { row: i + 1, status: 'error', message: msg }
      }
      setResults([...newResults])
    }

    setStep('done')
  }, [parsedRows, resolveProductId, stockIn, adjust])

  const successCount = results.filter((r) => r.status === 'success').length
  const errorCount = results.filter((r) => r.status === 'error').length

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Bulk Upload Inventory
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          {step === 'upload' && (
            <>
              <p className="text-sm text-gray-600">
                Upload a CSV file to perform bulk stock-in or adjustment operations. Each row should specify a product and quantity.
              </p>

              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center space-y-3">
                <Upload className="w-10 h-10 text-gray-300 mx-auto" />
                <div>
                  <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                    <Upload className="w-4 h-4" />Select CSV File
                  </Button>
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                </div>
                <p className="text-xs text-gray-400">Accepts .csv files</p>
              </div>

              {parseError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {parseError}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button onClick={handleDownloadTemplate} className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1">
                  <Download className="w-4 h-4" />Download CSV template
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500 space-y-1">
                <p className="font-medium text-gray-700">Expected columns:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><span className="font-medium">product_name</span> (required) &mdash; must match an existing product name</li>
                  <li><span className="font-medium">sku</span> (optional) &mdash; used for product lookup if provided</li>
                  <li><span className="font-medium">quantity</span> (required) &mdash; number of units</li>
                  <li><span className="font-medium">type</span> (required) &mdash; <code>stock_in</code> or <code>adjustment</code></li>
                  <li><span className="font-medium">reason</span> (optional) &mdash; reason for the movement</li>
                </ul>
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <p className="text-sm text-gray-600">
                Review the {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} below before submitting.
              </p>
              <div className="border rounded-lg overflow-auto max-h-72">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>#</TableColumnLabel></th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Product</TableColumnLabel></th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>SKU</TableColumnLabel></th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Qty</TableColumnLabel></th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Type</TableColumnLabel></th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Reason</TableColumnLabel></th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Match</TableColumnLabel></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedRows.map((row, i) => {
                      const pid = resolveProductId(row.product_name, row.sku)
                      const validType = ['stock_in', 'adjustment'].includes(row.type.trim().toLowerCase())
                      const validQty = !isNaN(parseInt(row.quantity)) && parseInt(row.quantity) >= 0
                      return (
                        <tr key={i} className={!pid || !validType || !validQty ? 'bg-red-50/50' : ''}>
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2">{row.product_name}</td>
                          <td className="px-3 py-2 text-gray-500">{row.sku || '-'}</td>
                          <td className={`px-3 py-2 text-right ${!validQty ? 'text-red-600' : ''}`}>{row.quantity}</td>
                          <td className={`px-3 py-2 ${!validType ? 'text-red-600' : ''}`}>{row.type}</td>
                          <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">{row.reason || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            {pid ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500 inline" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 inline" />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {(step === 'processing' || step === 'done') && (
            <>
              {step === 'done' && (
                <div className={`rounded-lg p-3 text-sm ${errorCount === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  Completed: {successCount} succeeded, {errorCount} failed out of {results.length} rows.
                </div>
              )}
              {step === 'processing' && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing {results.filter((r) => r.status !== 'pending').length} of {results.length} rows…
                </div>
              )}
              <div className="border rounded-lg overflow-auto max-h-72">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Row</TableColumnLabel></th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Product</TableColumnLabel></th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Status</TableColumnLabel></th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Details</TableColumnLabel></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {results.map((r, i) => (
                      <tr key={i} className={r.status === 'error' ? 'bg-red-50/50' : ''}>
                        <td className="px-3 py-2 text-gray-400">{r.row}</td>
                        <td className="px-3 py-2">{parsedRows[i]?.product_name || '-'}</td>
                        <td className="px-3 py-2 text-center">
                          {r.status === 'pending' && <span className="text-gray-400 text-xs">Pending</span>}
                          {r.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500 inline" />}
                          {r.status === 'error' && <XCircle className="w-4 h-4 text-red-500 inline" />}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate">{r.message || (r.status === 'success' ? 'Done' : '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t shrink-0">
          {step === 'upload' && (
            <Button variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" className="flex-1" onClick={() => { setStep('upload'); setParsedRows([]); if (fileRef.current) fileRef.current.value = '' }}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleSubmit}>
                Submit {parsedRows.length} Row{parsedRows.length !== 1 ? 's' : ''}
              </Button>
            </>
          )}
          {step === 'processing' && (
            <Button variant="outline" className="flex-1" disabled>Processing…</Button>
          )}
          {step === 'done' && (
            <Button className="flex-1" onClick={onClose}>Close</Button>
          )}
        </div>
      </div>
    </div>
  )
}
