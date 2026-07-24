import { useState, useMemo } from 'react'
import {
  Package, AlertTriangle, ArrowUpCircle, ArrowDownCircle,
  History, ChevronLeft, ChevronRight,
  PenLine, Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import {
  useStockSummary, useInventoryHistory, useLowStockAlerts,
  useStockIn, useStockOut, useAdjustStock,
} from '@/hooks/useInventory'
import { useProducts } from '@/hooks/useProducts'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'

type Tab = 'overview' | 'history' | 'alerts'

const MOVEMENT_LABELS: Record<string, { label: string; color: string }> = {
  stock_in: { label: 'Stock In', color: 'text-green-600 bg-green-50' },
  stock_out: { label: 'Stock Out', color: 'text-red-600 bg-red-50' },
  adjustment: { label: 'Adjustment', color: 'text-blue-600 bg-blue-50' },
  sale: { label: 'Sale', color: 'text-orange-600 bg-orange-50' },
  sale_return: { label: 'Return', color: 'text-primary bg-accent' },
  order_cancel: { label: 'Cancelled', color: 'text-gray-600 bg-gray-100' },
  initial: { label: 'Initial', color: 'text-gray-600 bg-gray-100' },
}

export default function Inventory() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [showModal, setShowModal] = useState<'stock_in' | 'stock_out' | 'adjust' | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [historyFilter, setHistoryFilter] = useState<string>('')
  const [productFilter, setProductFilter] = useState<string>('')

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useStockSummary()
  const { data: history, isLoading: historyLoading } = useInventoryHistory({
    page: historyPage,
    size: 15,
    movement_type: historyFilter || undefined,
    product_id: productFilter || undefined,
  })
  const { data: alerts, isLoading: alertsLoading } = useLowStockAlerts()
  const { data: products } = useProducts({ size: 200 })

  const stockIn = useStockIn()
  const stockOut = useStockOut()
  const adjustStock = useAdjustStock()

  const handleSubmit = () => {
    if (!selectedProduct || !quantity) return

    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty <= 0) return

    if (showModal === 'stock_in') {
      stockIn.mutate(
        { product_id: selectedProduct, movement_type: 'stock_in', quantity: qty, reason },
        { onSuccess: () => { resetModal(); refetchSummary() } },
      )
    } else if (showModal === 'stock_out') {
      stockOut.mutate(
        { product_id: selectedProduct, movement_type: 'stock_out', quantity: qty, reason },
        { onSuccess: () => { resetModal(); refetchSummary() } },
      )
    } else if (showModal === 'adjust') {
      adjustStock.mutate(
        { product_id: selectedProduct, new_quantity: qty, reason },
        { onSuccess: () => { resetModal(); refetchSummary() } },
      )
    }
  }

  const resetModal = () => {
    setShowModal(null)
    setSelectedProduct('')
    setQuantity('')
    setReason('')
  }

  const isMutating = stockIn.isPending || stockOut.isPending || adjustStock.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Inventory Management</h1>
          <p className="text-gray-500 mt-1">Track stock levels, movements, and low stock alerts</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowModal('stock_in')} className="gap-2">
            <ArrowUpCircle className="w-4 h-4 text-green-600" /> Stock In
          </Button>
          <Button variant="outline" onClick={() => setShowModal('stock_out')} className="gap-2">
            <ArrowDownCircle className="w-4 h-4 text-red-600" /> Stock Out
          </Button>
          <Button variant="outline" onClick={() => setShowModal('adjust')} className="gap-2">
            <PenLine className="w-4 h-4 text-blue-600" /> Adjust
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Products</p>
              <p className="text-2xl font-bold">{summary?.total ?? '—'}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">In Stock</p>
              <p className="text-2xl font-bold">
                {summary ? summary.total - summary.low_stock_count : '—'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Low Stock</p>
              <p className="text-2xl font-bold text-amber-600">{summary?.low_stock_count ?? '—'}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
              <History className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Movements Today</p>
              <p className="text-2xl font-bold">{history?.total ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {([
            { id: 'overview' as const, label: 'Stock Overview', icon: Package },
            { id: 'history' as const, label: 'Movement History', icon: History },
            { id: 'alerts' as const, label: 'Low Stock Alerts', icon: AlertTriangle },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'alerts' && alerts && alerts.total > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                  {alerts.total}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <StockOverviewTab items={summary?.items ?? []} loading={summaryLoading} />
      )}
      {activeTab === 'history' && (
        <HistoryTab
          history={history}
          loading={historyLoading}
          page={historyPage}
          setPage={setHistoryPage}
          filter={historyFilter}
          setFilter={setHistoryFilter}
          productFilter={productFilter}
          setProductFilter={setProductFilter}
          products={products?.items ?? []}
        />
      )}
      {activeTab === 'alerts' && (
        <AlertsTab alerts={alerts?.items ?? []} loading={alertsLoading} onStockIn={(id) => {
          setSelectedProduct(id)
          setShowModal('stock_in')
        }} />
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto" onClick={resetModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">
              {showModal === 'stock_in' && 'Add Stock'}
              {showModal === 'stock_out' && 'Remove Stock'}
              {showModal === 'adjust' && 'Adjust Stock'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Product</label>
                <Select
                  value={selectedProduct}
                  onChange={setSelectedProduct}
                  options={selectOptionsWithBlank(
                    'Select product…',
                    (products?.items ?? []).map((p) => ({
                      value: p.id,
                      label: `${p.name}${p.sku ? ` (${p.sku})` : ''} — Qty: ${p.quantity}`,
                    })),
                  )}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-0 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {showModal === 'adjust' ? 'New Quantity' : 'Quantity'}
                </label>
                <Input
                  type="number"
                  min={0}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={showModal === 'adjust' ? 'Set new total' : 'Enter quantity'}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Reason (optional)</label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Supplier delivery, Damaged goods"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="cancel" onClick={resetModal}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!selectedProduct || !quantity || isMutating}>
                {isMutating ? 'Processing…' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function StockOverviewTab({ items, loading }: { items: StockSummaryItem[]; loading: boolean }) {
  const [search, setSearch] = useState('')
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [stockSortKey, setStockSortKey] = useState('product')
  const [stockSortDir, setStockSortDir] = useState<SortDir>('asc')

  const stockSortOptions = [
    { value: 'product', label: 'Product' },
    { value: 'sku', label: 'SKU' },
    { value: 'current_qty', label: 'Current Qty' },
    { value: 'low_threshold', label: 'Low Threshold' },
    { value: 'total_in', label: 'Total In' },
    { value: 'total_out', label: 'Total Out' },
    { value: 'status', label: 'Status' },
  ]

  const stockAccessors: Record<string, (r: StockSummaryItem) => unknown> = {
    product: (r) => r.product_name,
    sku: (r) => r.sku ?? '',
    current_qty: (r) => r.current_quantity,
    low_threshold: (r) => r.low_stock_threshold,
    total_in: (r) => r.total_stock_in,
    total_out: (r) => r.total_stock_out,
    status: (r) => (r.is_low_stock ? 'Low' : 'OK'),
  }

  const preFiltered = showLowOnly ? items.filter((i) => i.is_low_stock) : items

  const filtered = useMemo(
    () =>
      processRows(
        preFiltered,
        search,
        (r) => [r.product_name, r.sku ?? ''],
        stockSortKey,
        stockSortDir,
        stockAccessors,
      ),
    [preFiltered, search, stockSortKey, stockSortDir],
  )

  if (loading) return <div className="text-center py-12 text-gray-400">Loading stock data…</div>

  return (
    <div className="bg-white rounded-xl border">
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or SKU…"
        hideSearch={true}
        sortOptions={stockSortOptions}
        sortKey={stockSortKey}
        sortDir={stockSortDir}
        onSortKeyChange={setStockSortKey}
        onSortDirChange={setStockSortDir}
        extra={
          <Button
            variant={showLowOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowLowOnly(!showLowOnly)}
            className="gap-1"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Low Stock Only
          </Button>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium text-right">Current Qty</th>
              <th className="px-4 py-3 font-medium text-right">Low Threshold</th>
              <th className="px-4 py-3 font-medium text-right">Total In</th>
              <th className="px-4 py-3 font-medium text-right">Total Out</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last Movement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400">
                  {items.length === 0 ? 'No tracked products yet' : 'No matching products'}
                </td>
              </tr>
            ) : filtered.map((item) => (
              <tr key={item.product_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{item.product_name}</td>
                <td className="px-4 py-3 text-gray-500">{item.sku || '—'}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">
                  {item.current_quantity}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{item.low_stock_threshold}</td>
                <td className="px-4 py-3 text-right text-green-600 font-mono">
                  +{item.total_stock_in}
                </td>
                <td className="px-4 py-3 text-right text-red-600 font-mono">
                  -{item.total_stock_out}
                </td>
                <td className="px-4 py-3">
                  {item.is_low_stock ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> Low
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full">
                      OK
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {item.last_movement_at
                    ? new Date(item.last_movement_at).toLocaleDateString()
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface StockSummaryItem {
  product_id: string
  product_name: string
  sku?: string
  current_quantity: number
  low_stock_threshold: number
  is_low_stock: boolean
  total_stock_in: number
  total_stock_out: number
  last_movement_at?: string
}


function HistoryTab({
  history, loading, page, setPage,
  filter, setFilter, productFilter, setProductFilter,
  products,
}: {
  history: { items: HistoryItem[]; total: number; pages: number } | undefined
  loading: boolean
  page: number
  setPage: (p: number) => void
  filter: string
  setFilter: (f: string) => void
  productFilter: string
  setProductFilter: (f: string) => void
  products: { id: string; name: string }[]
}) {
  const [histSortKey, setHistSortKey] = useState('date')
  const [histSortDir, setHistSortDir] = useState<SortDir>('desc')

  const histSortOptions = [
    { value: 'date', label: 'Date' },
    { value: 'type', label: 'Type' },
    { value: 'product', label: 'Product' },
    { value: 'qty_change', label: 'Qty Change' },
  ]

  const histAccessors: Record<string, (r: HistoryItem) => unknown> = {
    date: (r) => r.created_at,
    type: (r) => r.movement_type,
    product: (r) => products.find((p) => p.id === r.product_id)?.name ?? r.product_id,
    qty_change: (r) => r.quantity,
  }

  const sortedHistory = useMemo(
    () =>
      processRows(
        history?.items,
        '',
        (r) => [r.movement_type, r.product_id],
        histSortKey,
        histSortDir,
        histAccessors,
      ),
    [history?.items, histSortKey, histSortDir, products],
  )

  return (
    <div className="bg-white rounded-xl border">
      <div className="p-4 flex items-center gap-3 border-b flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <Select
            value={filter}
            onChange={(v) => { setFilter(v); setPage(1) }}
            options={selectOptionsWithBlank(
              'All Types',
              Object.entries(MOVEMENT_LABELS).map(([k, v]) => ({ value: k, label: v.label })),
            )}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
        <Select
          value={productFilter}
          onChange={(v) => { setProductFilter(v); setPage(1) }}
          options={selectOptionsWithBlank(
            'All Products',
            products.map((p) => ({ value: p.id, label: p.name })),
          )}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm max-w-[240px]"
        />
      </div>

      <TableToolbar
        search=""
        onSearchChange={() => {}}
        hideSearch={true}
        sortOptions={histSortOptions}
        sortKey={histSortKey}
        sortDir={histSortDir}
        onSortKeyChange={setHistSortKey}
        onSortDirChange={setHistSortDir}
      />

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading history…</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium text-right">Qty Change</th>
                  <th className="px-4 py-3 font-medium text-right">Before</th>
                  <th className="px-4 py-3 font-medium text-right">After</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">No movements found</td>
                  </tr>
                ) : sortedHistory.map((m) => {
                  const label = MOVEMENT_LABELS[m.movement_type] || { label: m.movement_type, color: 'text-gray-600 bg-gray-100' }
                  const productName = products.find((p) => p.id === m.product_id)?.name || m.product_id.slice(0, 8)
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${label.color}`}>
                          {label.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{productName}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 font-mono">{m.quantity_before}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{m.quantity_after}</td>
                      <td className="px-4 py-3 text-gray-500 text-sm max-w-[200px] truncate">
                        {m.reason || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {history && history.pages > 1 && (
            <div className="flex flex-col gap-3 px-4 py-3 border-t sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-gray-500">
                Page {page} of {history.pages} ({history.total} movements)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= history.pages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface HistoryItem {
  id: string
  product_id: string
  movement_type: string
  quantity: number
  quantity_before: number
  quantity_after: number
  reason?: string
  created_at: string
}


function AlertsTab({
  alerts, loading, onStockIn,
}: {
  alerts: AlertItem[]
  loading: boolean
  onStockIn: (productId: string) => void
}) {
  if (loading) return <div className="text-center py-12 text-gray-400">Loading alerts…</div>

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-12 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">All stock levels are healthy</h3>
        <p className="text-gray-500 mt-1">No products are below their low stock threshold.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border">
      <div className="p-4 border-b">
        <p className="text-sm text-red-600 font-medium">
          {alerts.length} product{alerts.length > 1 ? 's' : ''} below low stock threshold
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {alerts.map((a) => (
          <div key={a.product_id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{a.product_name}</p>
                <p className="text-xs text-gray-500">
                  {a.sku ? `SKU: ${a.sku}` : ''}{a.category ? ` • ${a.category}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-lg font-bold text-red-600">{a.current_quantity}</p>
                <p className="text-xs text-gray-500">Threshold: {a.low_stock_threshold}</p>
              </div>
              <Button size="sm" onClick={() => onStockIn(a.product_id)} className="gap-1">
                <ArrowUpCircle className="w-3.5 h-3.5" /> Restock
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface AlertItem {
  product_id: string
  product_name: string
  sku?: string
  current_quantity: number
  low_stock_threshold: number
  category?: string
}
