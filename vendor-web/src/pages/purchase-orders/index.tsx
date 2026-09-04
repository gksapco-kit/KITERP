import { useState, useCallback, useMemo, useEffect } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ResizableTable } from '@/components/table/ResizableTable'
import type { PurchaseOrder } from '@/types'
import { TableToolbar } from '@/components/table/TableToolbar'
import { TablePagination } from '@/components/table/TablePagination'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { processRows, type SortDir } from '@/lib/tableList'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { BarcodeScannerModal } from '@/components/scanner/BarcodeScannerModal'
import { toast } from 'sonner'
import { Loader2, Plus, Palette, ScanLine, Package, ClipboardList, ShieldCheck } from 'lucide-react'
import { PO_FROM_PR_KEY, PO_FROM_INVENTORY_KEY } from '@/lib/prToPoPrefill'
import {
  usePurchaseOrders, usePendingPOApprovalCount, useUpdatePurchaseOrder,
} from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import { formatDate, formatCurrency } from '@/lib/utils'

// sessionStorage key for pending supplier pre-select
const PO_PENDING_SUPPLIER_KEY = 'po_pending_supplier'

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', label: 'Draft' },
  sent: { bg: 'bg-blue-50 dark:bg-blue-950/50', text: 'text-blue-700 dark:text-blue-300', label: 'Sent' },
  ordered: { bg: 'bg-blue-50 dark:bg-blue-950/50', text: 'text-blue-700 dark:text-blue-300', label: 'Ordered' },
  partial_received: { bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-300', label: 'Partial' },
  received: { bg: 'bg-green-50 dark:bg-green-950/50', text: 'text-green-700 dark:text-green-300', label: 'Received' },
  closed: { bg: 'bg-accent', text: 'text-primary', label: 'Closed' },
  cancelled: { bg: 'bg-red-50 dark:bg-red-950/50', text: 'text-red-700 dark:text-red-300', label: 'Cancelled' },
}

// Prefill data set by barcode scan or inventory alert to pass into CreatePOModal
interface BarcodePrefill {
  productId: string
  variantId?: string
  productName: string
  variantName?: string
  unitCost?: number
  /** Pre-fill the quantity field (e.g. from reorder_quantity or shortage) */
  prefillQty?: number
}

export default function PurchaseOrdersPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showScanner, setShowScanner] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)

  // On mount: redirect to /purchase-orders/new if sessionStorage prefill keys are present
  useEffect(() => {
    const hasPr = !!sessionStorage.getItem(PO_FROM_PR_KEY)
    const hasInv = !!sessionStorage.getItem(PO_FROM_INVENTORY_KEY)
    const hasSupplier = !!sessionStorage.getItem(PO_PENDING_SUPPLIER_KEY)
    if (hasPr || hasInv || hasSupplier) {
      navigate('/purchase-orders/new', { replace: false })
    }
  }, [])

  const [viewMode, setViewMode] = useState<'all' | 'pending_my_approval'>('all')
  const { data: pendingCountData } = usePendingPOApprovalCount()
  const pendingCount = pendingCountData ?? 0

  const params: Record<string, unknown> =
    viewMode === 'pending_my_approval'
      ? { pending_my_approval: true, page, size: pageSize }
      : { page, size: pageSize, ...(statusFilter ? { status: statusFilter } : {}) }

  const { data, isLoading } = usePurchaseOrders(params)
  const updatePO = useUpdatePurchaseOrder()
  const { savingCellKey, cellKey, patchField: patchPOField } = useInlineFieldPatch({
    mutateAsync: ({ id, data }) => updatePO.mutateAsync({ id, data }),
  })
  const isSaving = (id: string, field: string) => savingCellKey === cellKey(id, field)

  const poStatusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'ordered', label: 'Ordered' },
    { value: 'partial_received', label: 'Partial' },
    { value: 'received', label: 'Received' },
    { value: 'closed', label: 'Closed' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

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
        created_at: (po) => (po.created_at ? new Date(po.created_at).getTime() : 0),
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
      // Store prefill in sessionStorage; CreatePurchaseOrderPage reads it on mount
      sessionStorage.setItem('po_barcode_prefill', JSON.stringify(prefill))
      navigate('/purchase-orders/new')
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
  }, [scanLoading, navigate])

  // Hardware scanner listener (keyboard-wedge) — active when scanner modal is closed
  useBarcodeScanner({ enabled: !showScanner, onScan: handleBarcodeScan })

  return (
    <div className="space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Draft, send, and receive supplier purchase orders
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-8 gap-1.5 px-3 text-sm" onClick={() => navigate('/purchase-orders/templates')}>
            <Palette className="h-3.5 w-3.5" /> Templates
          </Button>
          <Button variant="outline" className="h-8 gap-1.5 px-3 text-sm" onClick={() => setShowScanner(true)} disabled={scanLoading}>
            {scanLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <ScanLine className="h-3.5 w-3.5" />}
            Scan
          </Button>
          <Button className="h-8 gap-1.5 px-3 text-sm" onClick={() => navigate('/purchase-orders/new')}>
            <Plus className="h-3.5 w-3.5" /> New Purchase Order
          </Button>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => { setViewMode('all'); setPage(1) }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            viewMode === 'all'
              ? 'bg-primary text-white border-primary'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          All POs
        </button>
        <button
          type="button"
          onClick={() => { setViewMode('pending_my_approval'); setPage(1) }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            viewMode === 'pending_my_approval'
              ? 'bg-primary text-white border-primary'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Pending My Approval
          {pendingCount > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              viewMode === 'pending_my_approval' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
            }`}>
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Status filter pills — only shown in "All" view */}
      {viewMode === 'all' && (
      <div className="flex gap-2 flex-wrap">
        {statuses.map((s) => {
          const badge = s ? statusBadge[s] : null
          return (
            <button
              key={s || 'all'}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-gray-900 text-white dark:bg-primary dark:text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {badge?.label || 'All'}
            </button>
          )
        })}
      </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : displayOrders.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          {viewMode === 'pending_my_approval' ? (
            <>
              <p className="text-gray-500">No purchase orders awaiting your approval.</p>
              <p className="text-sm text-gray-400 mt-1">POs assigned to you for approval will appear here.</p>
            </>
          ) : (
            <>
              <p className="text-gray-500">No purchase orders found.</p>
              <p className="text-sm text-gray-400 mt-1">Scan a barcode or click "New Purchase Order" to create one.</p>
            </>
          )}
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <TableToolbar
                search=""
                onSearchChange={() => {}}
                hideSearch
                hint={`${INLINE_EDIT_HINT} Sorting applies to the current page.`}
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
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>PO #</TableColumnLabel></th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Supplier</TableColumnLabel></th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Status</TableColumnLabel></th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Total</TableColumnLabel></th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Items / Variants</TableColumnLabel></th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Order Date</TableColumnLabel></th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Expected</TableColumnLabel></th>
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
                        onClick={onClickableTableRow(() => navigate(`/purchase-orders/${po.id}`))}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-blue-600">{po.po_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{po.supplier_name || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <InlineEditCell
                            type="select"
                            value={po.status}
                            options={poStatusOptions}
                            saving={isSaving(po.id, 'status')}
                            onSave={(v) => patchPOField(po.id, 'status', v)}
                          >
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                              {badge.label}
                            </span>
                          </InlineEditCell>
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-medium">
                          <InlineEditCell readOnly readOnlyMessage="PO total is calculated from line items" value={po.total} onSave={() => {}} className="text-right font-medium">
                            {formatCurrency(po.total)}
                          </InlineEditCell>
                        </td>
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
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <InlineEditCell
                            type="text"
                            value={po.expected_delivery_date || ''}
                            saving={isSaving(po.id, 'expected_delivery_date')}
                            onSave={(v) => patchPOField(po.id, 'expected_delivery_date', String(v).trim() || null)}
                          >
                            {formatDate(po.expected_delivery_date)}
                          </InlineEditCell>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </ResizableTable>
            </CardContent>
          </Card>
          {data && (
            <TablePagination
              page={page}
              pages={data.pages || 1}
              total={data.total || 0}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="records"
              className="rounded-lg border bg-white"
            />
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

    </div>
  )
}
