import { useState, useCallback, useMemo, useEffect } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { ResizableTable } from '@/components/table/ResizableTable'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  usePurchaseOrder, useSendPO, useReceivePOItems, useClosePO, useCancelPO,
  useUpdatePurchaseOrder, useSuppliers, useProducts,
} from '@/hooks/useVendor'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import type { PurchaseOrderItem as POItem } from '@/types'
import {
  Loader2, ArrowLeft, Send, PackageCheck, CheckCircle2, XCircle,
  X, ClipboardList, Truck, Calendar, FileText, History,
  Download, Copy, MessageCircle, Mail, Share2, Printer, Palette, MessageSquare,
  ChevronDown, ChevronRight, Edit2, Trash2, Plus, Save, RotateCcw, ScanLine,
} from 'lucide-react'
import { toast } from 'sonner'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { BarcodeScannerModal } from '@/components/scanner/BarcodeScannerModal'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { usePOTemplateSettings } from '@/hooks/useVendor'
import { printPO, generatePOHtml, DEFAULT_PO_SETTINGS } from '@/lib/poTemplates'
import type { POTemplateSettings } from '@/lib/poTemplates'
import { fetchAsDataUrl, resolveMediaUrl, downloadAsPdf, shareViaWhatsApp, shareViaSms, buildShareMessage } from '@/lib/printUtils'

import { askConfirm } from '@/components/common/ConfirmProvider'
const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  sent: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Sent to Supplier' },
  ordered: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Ordered' },
  partial_received: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Partially Received' },
  received: { bg: 'bg-green-50', text: 'text-green-700', label: 'Fully Received' },
  closed: { bg: 'bg-accent', text: 'text-primary', label: 'Closed' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', label: 'Cancelled' },
}

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: po, isLoading } = usePurchaseOrder(id || '')

  const sendMut = useSendPO()
  const closeMut = useClosePO()
  const cancelMut = useCancelPO()
  const updateMut = useUpdatePurchaseOrder()
  const { data: poTemplateSettings } = usePOTemplateSettings()
  const { data: suppliersData } = useSuppliers({ size: 200 })
  const suppliers = suppliersData?.items ?? []

  const [showReceive, setShowReceive] = useState(false)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [editingHeader, setEditingHeader] = useState(false)
  const [headerDraft, setHeaderDraft] = useState({ supplier_id: '', expected_delivery_date: '', notes: '' })
  const [addingItem, setAddingItem] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanPrefill, setScanPrefill] = useState<{ productId: string; variantId?: string; unitCost?: number } | undefined>()

  const [itemSortKey, setItemSortKey] = useState('name')
  const [itemSortDir, setItemSortDir] = useState<SortDir>('asc')
  const [receiptSortKey, setReceiptSortKey] = useState('date')
  const [receiptSortDir, setReceiptSortDir] = useState<SortDir>('desc')

  const itemSortOptions = useMemo(() => [
    { value: 'name', label: 'Product' },
    { value: 'sku', label: 'SKU' },
    { value: 'ordered_qty', label: 'Ordered' },
    { value: 'received_qty', label: 'Received' },
    { value: 'unit_cost', label: 'Unit Cost' },
    { value: 'total', label: 'Total' },
  ], [])

  const itemAccessors = useMemo<Record<string, (r: POItem) => unknown>>(() => ({
    name: (r) => r.product_name || r.product_id,
    sku: (r) => r.product_sku || '',
    ordered_qty: (r) => r.quantity_ordered,
    received_qty: (r) => r.quantity_received,
    unit_cost: (r) => r.unit_cost,
    total: (r) => r.total_cost,
  }), [])

  const sortedItems = useMemo(
    () => processRows(po?.items, '', () => [], itemSortKey, itemSortDir, itemAccessors),
    [po?.items, itemSortKey, itemSortDir, itemAccessors],
  )

  const receiptSortOptions = useMemo(() => [
    { value: 'date', label: 'Date' },
    { value: 'items_count', label: 'Items Count' },
  ], [])

  const receiptAccessors = useMemo<Record<string, (r: NonNullable<typeof po>['receipts'][number]) => unknown>>(() => ({
    date: (r) => r.received_at,
    items_count: (r) => (r.items || []).length,
  }), [])

  const sortedReceipts = useMemo(
    () => processRows(po?.receipts, '', () => [], receiptSortKey, receiptSortDir, receiptAccessors),
    [po?.receipts, receiptSortKey, receiptSortDir, receiptAccessors],
  )

  // Populate header draft when editing starts
  const startEditHeader = useCallback(() => {
    if (!po) return
    setHeaderDraft({
      supplier_id: po.supplier_id || '',
      expected_delivery_date: po.expected_delivery_date ? po.expected_delivery_date.slice(0, 10) : '',
      notes: po.notes || '',
    })
    setEditingHeader(true)
  }, [po])

  const saveHeader = useCallback(async () => {
    if (!po) return
    try {
      await updateMut.mutateAsync({
        id: po.id,
        data: {
          supplier_id: headerDraft.supplier_id || undefined,
          expected_delivery_date: headerDraft.expected_delivery_date || undefined,
          notes: headerDraft.notes || undefined,
          items: po.items.map(i => ({
            product_id: i.product_id,
            variant_id: i.variant_id || undefined,
            quantity: i.quantity_ordered,
            unit_cost: i.unit_cost,
          })),
        },
      })
      setEditingHeader(false)
      toast.success('Purchase order updated')
    } catch { /* handled by hook */ }
  }, [po, updateMut, headerDraft])

  // Save updated items list (for add/edit/delete item operations)
  const saveItems = useCallback(async (newItems: { product_id: string; variant_id?: string; quantity: number; unit_cost: number }[]) => {
    if (!po) return
    await updateMut.mutateAsync({
      id: po.id,
      data: {
        supplier_id: po.supplier_id || undefined,
        expected_delivery_date: po.expected_delivery_date || undefined,
        notes: po.notes || undefined,
        items: newItems,
      },
    })
  }, [po, updateMut])

  const deleteItem = useCallbackasync (async (item: POItem) => {
    if (!po || !await askConfirm(`Remove "${item.product_name || 'this item'}" from the PO?`)) return
    const remaining = po.items
      .filter(i => i.id !== item.id)
      .map(i => ({ product_id: i.product_id, variant_id: i.variant_id || undefined, quantity: i.quantity_ordered, unit_cost: i.unit_cost }))
    try {
      await saveItems(remaining)
      toast.success('Item removed')
    } catch { /* handled */ }
  }, [po, saveItems])

  // Barcode scan — finds product/variant then opens Add Item panel pre-filled
  const handleBarcodeScan = useCallback(async (code: string) => {
    if (scanLoading || !po) return
    setScanLoading(true)
    setShowScanner(false)
    try {
      const result = await vendorApi.barcodeLookup(code)
      const p = result.product
      const v = result.variant
      setScanPrefill({
        productId: p.id,
        variantId: v?.id,
        unitCost: v?.cost_price ?? p.cost_price ?? v?.price ?? p.price,
      })
      setAddingItem(true)
      toast.success(`Found: ${v ? `${p.name} — ${v.name}` : p.name}`)
    } catch (err: any) {
      if (err?.response?.status === 404) {
        toast.error(`No product found for barcode: ${code}`)
      } else {
        toast.error('Barcode scan error. Please try again.')
      }
    } finally {
      setScanLoading(false)
    }
  }, [scanLoading, po])

  const poIsDraft = po?.status === 'draft'
  useBarcodeScanner({ enabled: !!poIsDraft && !showScanner && !addingItem, onScan: handleBarcodeScan })

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!po) {
    return (
      <div className="text-center py-24">
        <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500">Purchase order not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/purchase-orders')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to list
        </Button>
      </div>
    )
  }

  const badge = statusConfig[po.status] || statusConfig.draft
  const actionLoading = sendMut.isPending || closeMut.isPending || cancelMut.isPending || updateMut.isPending
  const isDraft = po.status === 'draft'
  const canReceive = po.status === 'sent' || po.status === 'ordered' || po.status === 'partial_received'

  const poMessage = () => buildShareMessage({
    type: 'po',
    number: po.po_number,
    vendorName: (po as unknown as Record<string, unknown>).vendor_name as string || 'Your Company',
    customerOrSupplier: po.supplier_name || '',
    total: po.total,
    date: formatDate(po.order_date),
    status: po.status,
    items: po.items.map(i => ({ name: i.product_name || 'Item', qty: i.quantity_ordered, amount: i.total_cost })),
  })

  const handleCopy = () => { navigator.clipboard.writeText(poMessage()); toast.success('PO details copied!') }
  const handleWhatsApp = () => shareViaWhatsApp(poMessage(), (po as any).supplier_phone)
  const handleSms = () => shareViaSms(poMessage(), (po as any).supplier_phone)
  const handleEmail = () => {
    const email = (po as any).supplier_email || ''
    window.open(`mailto:${email}?subject=${encodeURIComponent(`Purchase Order: ${po.po_number}`)}&body=${encodeURIComponent(poMessage())}`, '_blank')
  }
  // Build a normalised PO data object that templates can consume regardless of field naming
  const buildPODataForTemplate = (): Record<string, unknown> => {
    const raw = po as unknown as Record<string, unknown>
    return {
      ...raw,
      // Alias backend field names to what templates expect
      grand_total: raw.grand_total ?? raw.total,
      total_tax: raw.total_tax ?? raw.tax_amount,
      // Provide CGST/SGST split when only total tax is available (50/50 split assumed for intra-state)
      cgst_amount: raw.cgst_amount ?? (raw.tax_amount ? Number(raw.tax_amount) / 2 : 0),
      sgst_amount: raw.sgst_amount ?? (raw.tax_amount ? Number(raw.tax_amount) / 2 : 0),
      igst_amount: raw.igst_amount ?? 0,
    }
  }

  const mergedTemplateSettings = (): POTemplateSettings => ({
    ...DEFAULT_PO_SETTINGS,
    ...(poTemplateSettings as Partial<POTemplateSettings> || {}),
  })

  const handlePrint = async () => printPO(buildPODataForTemplate(), mergedTemplateSettings())
  const handleDownload = async () => {
    const settings = mergedTemplateSettings()
    const poData = buildPODataForTemplate()
    const rawLogo = (settings.logo_url || (poData.vendor_logo_url as string | undefined)) || ''
    const rawSig = settings.signature_url || ''
    const [logoDataUrl, sigDataUrl] = await Promise.all([
      rawLogo ? fetchAsDataUrl(rawLogo) : Promise.resolve(''),
      rawSig ? fetchAsDataUrl(rawSig) : Promise.resolve(''),
    ])
    const enriched: POTemplateSettings = {
      ...settings,
      logo_url: logoDataUrl || undefined,
      signature_url: sigDataUrl || undefined,
    }
    const html = generatePOHtml(
      { ...poData, vendor_logo_url: logoDataUrl || resolveMediaUrl(rawLogo) },
      enriched,
      '',
    )
    await downloadAsPdf(html, `${po.po_number.replace(/\//g, '-')}.pdf`, {
      margin: settings.pdf_margin ?? 5,
      orientation: 'portrait',
    })
  }
  const handleShare = () => {
    if (navigator.share) navigator.share({ title: `PO: ${po.po_number}`, text: poMessage() }).catch(() => {})
    else handleCopy()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/purchase-orders')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{po.po_number}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Supplier: <span className="font-medium text-gray-700">{po.supplier_name}</span></p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {isDraft && (
            <>
              {!editingHeader ? (
                <Button variant="outline" className="gap-2" onClick={startEditHeader}>
                  <Edit2 className="w-4 h-4" /> Edit PO
                </Button>
              ) : (
                <>
                  <Button variant="outline" className="gap-2" onClick={() => setEditingHeader(false)} disabled={actionLoading}>
                    <RotateCcw className="w-4 h-4" /> Discard
                  </Button>
                  <Button className="gap-2" onClick={saveHeader} disabled={actionLoading}>
                    {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                  </Button>
                </>
              )}
              <Button variant="outline" className="gap-2" disabled={actionLoading} onClick={() => sendMut.mutate(po.id)}>
                <Send className="w-4 h-4" /> Send to Supplier
              </Button>
              <Button variant="cancel" className="gap-2 text-red-600 hover:text-red-700" disabled={actionLoading}
                onClick={async () => { if (await askConfirm('Cancel this purchase order?')) cancelMut.mutate(po.id) }}>
                <XCircle className="w-4 h-4" />Cancel</Button>
            </>
          )}
          {canReceive && (
            <>
              <Button className="gap-2" onClick={() => setShowReceive(true)}>
                <PackageCheck className="w-4 h-4" /> Receive Items
              </Button>
              {po.status === 'sent' && async (
                <Button variant="cancel" className="gap-2 text-red-600 hover:text-red-700" disabled={actionLoading}
                  onClick={async () => { if (await askConfirm('Cancel this purchase order?')) cancelMut.mutate(po.id) }}>
                  <XCircle className="w-4 h-4" />Cancel</Button>
              )}
            </>
          )}
          {po.status === 'received' && (
            <Button variant="outline" className="gap-2" disabled={actionLoading} onClick={() => closeMut.mutate(po.id)}>
              <CheckCircle2 className="w-4 h-4" /> Close PO
            </Button>
          )}
        </div>
      </div>

      {/* Share toolbar */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}><Printer className="w-3.5 h-3.5" /> Print</Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}><Download className="w-3.5 h-3.5 text-red-500" /> Download PDF</Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}><Copy className="w-3.5 h-3.5" /> Copy</Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleWhatsApp}><MessageCircle className="w-3.5 h-3.5 text-green-600" /> WhatsApp</Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSms}><MessageSquare className="w-3.5 h-3.5 text-amber-600" /> SMS</Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleEmail}><Mail className="w-3.5 h-3.5 text-blue-600" /> Email</Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShare}><Share2 className="w-3.5 h-3.5 text-primary" /> Share</Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/purchase-orders/templates')}>
          <Palette className="w-3.5 h-3.5 text-gray-500" /> Template
        </Button>
      </div>

      {/* Editable header form / Info cards */}
      {editingHeader ? (
        <Card className="border-blue-200 bg-blue-50/20">
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-blue-700 uppercase mb-4">Editing Purchase Order</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Supplier</Label>
                <select className={selectClass} value={headerDraft.supplier_id}
                  onChange={e => setHeaderDraft(d => ({ ...d, supplier_id: e.target.value }))}>
                  <option value="">— Select supplier —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Expected Delivery Date</Label>
                <Input type="date" value={headerDraft.expected_delivery_date}
                  onChange={e => setHeaderDraft(d => ({ ...d, expected_delivery_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label>Notes / Reference</Label>
                <Input value={headerDraft.notes} placeholder="e.g., Invoice ref, delivery instructions…"
                  onChange={e => setHeaderDraft(d => ({ ...d, notes: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCard icon={Truck} label="Supplier" value={po.supplier_name || '-'} />
          <InfoCard icon={Calendar} label="Order Date" value={formatDate(po.order_date)} />
          <InfoCard icon={Calendar} label="Expected Delivery" value={formatDate(po.expected_delivery_date)} />
          <InfoCard icon={FileText} label="Total" value={formatCurrency(po.total)} />
        </div>
      )}

      {po.notes && !editingHeader && (
        <Card>
          <CardContent className="py-3 px-6">
            <p className="text-sm text-gray-600"><span className="font-medium">Notes:</span> {po.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Items table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Items ({po.items.length})</CardTitle>
            {isDraft && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowScanner(true)} disabled={scanLoading}>
                  {scanLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
                  Scan Barcode
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setScanPrefill(undefined); setAddingItem(true) }}>
                  <Plus className="w-4 h-4" /> Add Item
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <TableToolbar
            search="" onSearchChange={() => {}} hideSearch
            sortOptions={itemSortOptions} sortKey={itemSortKey} sortDir={itemSortDir}
            onSortKeyChange={setItemSortKey} onSortDirChange={setItemSortDir} className="py-2"
          />

          {/* Add Item form */}
          {addingItem && (
            <AddItemPanel
              po={po}
              prefillProductId={scanPrefill?.productId}
              prefillVariantId={scanPrefill?.variantId}
              prefillUnitCost={scanPrefill?.unitCost}
              onSave={async (newItem) => {
                const updated = [
                  ...po.items.map(i => ({ product_id: i.product_id, variant_id: i.variant_id || undefined, quantity: i.quantity_ordered, unit_cost: i.unit_cost })),
                  newItem,
                ]
                try {
                  await saveItems(updated)
                  setAddingItem(false)
                  setScanPrefill(undefined)
                  toast.success('Item added')
                } catch { /* handled */ }
              }}
              onCancel={() => { setAddingItem(false); setScanPrefill(undefined) }}
              saving={updateMut.isPending}
            />
          )}

          <ResizableTable tableId="po-lines" defaultWidths={[220, 130, 110, 80, 80, 80, 90, 90, isDraft ? 60 : 0]}>
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Product</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Variant</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Barcode / SKU</TableColumnLabel></th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Ordered</TableColumnLabel></th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Received</TableColumnLabel></th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Remaining</TableColumnLabel></th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Unit Cost</TableColumnLabel></th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Total</TableColumnLabel></th>
                {isDraft && <th className="px-3 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedItems.map((item) => {
                const remaining = item.quantity_ordered - item.quantity_received
                const isExpanded = expandedItemId === item.id
                const displayBarcode = item.variant_barcode || ''
                const displaySku = item.variant_sku || item.product_sku || ''
                return (
                  <>
                    <tr key={item.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={onClickableTableRow(() => setExpandedItemId(isExpanded ? null : item.id))}
                    >
                      <td className="px-6 py-4 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                          <span>{item.product_name || item.product_id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {item.variant_name ? (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                            {item.variant_name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {displayBarcode && (
                          <div className="font-mono text-gray-600">{displayBarcode}</div>
                        )}
                        {displaySku && (
                          <div className="text-gray-400">{displaySku}</div>
                        )}
                        {!displayBarcode && !displaySku && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-right">{item.quantity_ordered}</td>
                      <td className="px-6 py-4 text-sm text-right">
                        <span className={item.quantity_received >= item.quantity_ordered ? 'text-green-600 font-medium' : ''}>
                          {item.quantity_received}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        <span className={remaining > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>{remaining}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right">{formatCurrency(item.unit_cost)}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium">{formatCurrency(item.total_cost)}</td>
                      {isDraft && (
                        <td className="px-3 py-4 text-right">
                          <button
                            onClick={() => deleteItem(item)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>

                    {/* Expanded panel */}
                    {isExpanded && (
                      <tr key={`${item.id}-expanded`}>
                        <td colSpan={isDraft ? 9 : 8} className="px-0 py-0 bg-blue-50/30 border-b">
                          <ItemExpandPanel
                            item={item}
                            po={po}
                            isDraft={isDraft}
                            canReceive={canReceive}
                            onSaveEdit={async (updated) => {
                              const newItems = po.items.map(i =>
                                i.id === item.id
                                  ? { product_id: updated.product_id, variant_id: updated.variant_id, quantity: updated.quantity, unit_cost: updated.unit_cost }
                                  : { product_id: i.product_id, variant_id: i.variant_id || undefined, quantity: i.quantity_ordered, unit_cost: i.unit_cost }
                              )
                              await saveItems(newItems)
                              setExpandedItemId(null)
                              toast.success('Item updated')
                            }}
                            saving={updateMut.isPending}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-gray-50">
                <td colSpan={isDraft ? 6 : 6} className="px-6 py-3 text-sm font-semibold text-right">Subtotal</td>
                <td className="px-6 py-3 text-sm text-right font-bold">{formatCurrency(po.subtotal)}</td>
                {isDraft && <td />}
              </tr>
            </tfoot>
          </ResizableTable>
        </CardContent>
      </Card>

      {/* Receipt history */}
      {po.receipts && po.receipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4" /> Receipt History ({po.receipts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TableToolbar
              search="" onSearchChange={() => {}} hideSearch
              sortOptions={receiptSortOptions} sortKey={receiptSortKey} sortDir={receiptSortDir}
              onSortKeyChange={setReceiptSortKey} onSortDirChange={setReceiptSortDir} className="py-2"
            />
            <ResizableTable tableId="po-receipts" defaultWidths={[150, 300, 200]}>
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Date</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Items Received</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Notes</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedReceipts.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-700">{formatDateTime(r.received_at)}</td>
                    <td className="px-6 py-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {(r.items || []).map((ri, i) => {
                          const poItem = po.items.find(pi => pi.id === ri.item_id)
                          return (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                              {poItem?.product_name || ri.product_id}: +{ri.quantity_received}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{r.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </ResizableTable>
          </CardContent>
        </Card>
      )}

      {showReceive && <ReceiveModal po_id={po.id} items={po.items} onClose={() => setShowReceive(false)} />}

      <BarcodeScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
        title="Scan to Add Item to PO"
      />
    </div>
  )
}

// ── InfoCard ──────────────────────────────────────────────────────

function InfoCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border p-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-2 text-gray-500 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  )
}

// ── AddItemPanel ──────────────────────────────────────────────────

function AddItemPanel({ onSave, onCancel, saving, prefillProductId, prefillVariantId, prefillUnitCost }: {
  po: NonNullable<ReturnType<typeof usePurchaseOrder>['data']>
  onSave: (item: { product_id: string; variant_id?: string; quantity: number; unit_cost: number }) => Promise<void>
  onCancel: () => void
  saving: boolean
  prefillProductId?: string
  prefillVariantId?: string
  prefillUnitCost?: number
}) {
  const { data: productsData } = useProducts({ size: 500 })
  const products = productsData?.items ?? []

  const [productId, setProductId] = useState(prefillProductId || '')
  const [variantId, setVariantId] = useState(prefillVariantId || '')
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState(prefillUnitCost != null ? String(prefillUnitCost) : '')

  const { data: fullProduct } = useQuery({
    queryKey: ['product-full', productId],
    queryFn: () => vendorApi.getProduct(productId),
    enabled: !!productId,
  })
  const variants = useMemo(
    () => ((fullProduct as any)?.variants ?? []).filter((v: any) => v.is_active !== false),
    [fullProduct]
  )

  // When prefillVariantId arrives after variants load, ensure it stays selected
  useEffect(() => {
    if (prefillVariantId && variants.some((v: any) => v.id === prefillVariantId)) {
      setVariantId(prefillVariantId)
    }
  }, [prefillVariantId, variants])

  // Auto-fill unit cost from variant or product price (unless already set from prefill)
  useEffect(() => {
    if (prefillUnitCost != null) return  // prefill takes precedence
    if (variantId) {
      const v = variants.find((v: any) => v.id === variantId)
      if (v?.cost_price) setUnitCost(String(v.cost_price))
      else if (v?.price) setUnitCost(String(v.price))
    } else if (fullProduct && !prefillProductId) {
      const p = fullProduct as any
      if (p.cost_price) setUnitCost(String(p.cost_price))
      else if (p.price) setUnitCost(String(p.price))
    }
  }, [variantId, fullProduct, variants, prefillUnitCost, prefillProductId])

  const handleSave = async () => {
    if (!productId || !quantity || !unitCost) { toast.error('Fill all required fields'); return }
    await onSave({ product_id: productId, variant_id: variantId || undefined, quantity: parseInt(quantity), unit_cost: parseFloat(unitCost) })
  }

  const isScanPrefill = !!prefillProductId

  return (
    <div className={`mx-4 mb-4 border border-dashed rounded-xl p-4 ${isScanPrefill ? 'border-green-300 bg-green-50/30' : 'border-blue-300 bg-blue-50/30'}`}>
      <div className="flex items-center gap-2 mb-3">
        <p className={`text-xs font-medium uppercase ${isScanPrefill ? 'text-green-700' : 'text-blue-700'}`}>
          {isScanPrefill ? '📷 Add Item from Barcode Scan' : 'New Line Item'}
        </p>
        {isScanPrefill && (
          <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
            Product pre-selected
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
          <Label className="text-xs">Product <span className="text-red-500">*</span></Label>
          <select className={selectClass} value={productId}
            onChange={e => { setProductId(e.target.value); setVariantId(''); setUnitCost('') }}>
            <option value="">Select product…</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
          </select>
        </div>
        {variants.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Variant</Label>
            <select className={selectClass} value={variantId} onChange={e => {
              setVariantId(e.target.value)
              if (e.target.value) {
                const v = variants.find((v: any) => v.id === e.target.value)
                if (v?.cost_price) setUnitCost(String(v.cost_price))
                else if (v?.price) setUnitCost(String(v.price))
              }
            }}>
              <option value="">Product-level</option>
              {variants.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.name}{v.sku ? ` · ${v.sku}` : ''}{v.barcode ? ` · ${v.barcode}` : ''}
                </option>
              ))}
            </select>
            {variantId && (() => {
              const v = variants.find((v: any) => v.id === variantId)
              return v?.barcode ? <p className="text-xs font-mono text-gray-400 mt-0.5">{v.barcode}</p> : null
            })()}
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Quantity <span className="text-red-500">*</span></Label>
          <Input type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Qty" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Unit Cost <span className="text-red-500">*</span></Label>
          <Input type="number" min={0} step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="₹0.00" />
        </div>
      </div>
      {productId && quantity && unitCost && (
        <p className="text-xs text-gray-500 mt-2">
          Line total: {formatCurrency(parseFloat(unitCost || '0') * parseInt(quantity || '0'))}
        </p>
      )}
      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={handleSave} disabled={saving || !productId || !quantity || !unitCost} className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add Item
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

// ── ItemExpandPanel ───────────────────────────────────────────────

function ItemExpandPanel({ item, isDraft, canReceive, onSaveEdit, saving }: {
  item: POItem
  po: NonNullable<ReturnType<typeof usePurchaseOrder>['data']>
  isDraft: boolean
  canReceive: boolean
  onSaveEdit: (data: { product_id: string; variant_id?: string; quantity: number; unit_cost: number }) => Promise<void>
  saving: boolean
}) {
  const { data: fullProduct } = useQuery({
    queryKey: ['product-full', item.product_id],
    queryFn: () => vendorApi.getProduct(item.product_id),
    enabled: !!item.product_id,
  })
  const variants = useMemo(
    () => ((fullProduct as any)?.variants ?? []).filter((v: any) => v.is_active !== false),
    [fullProduct]
  )
  const selectedVariant = useMemo(
    () => variants.find((v: any) => v.id === item.variant_id),
    [variants, item.variant_id]
  )

  // Edit state (draft mode)
  const [editVariantId, setEditVariantId] = useState(item.variant_id || '')
  const [editQty, setEditQty] = useState(String(item.quantity_ordered))
  const [editCost, setEditCost] = useState(String(item.unit_cost))

  // Receive state
  const receiveMut = useReceivePOItems()
  const [receiveQty, setReceiveQty] = useState('')
  const [receiveCostPrice, setReceiveCostPrice] = useState('')
  const [receiveSellingPrice, setReceiveSellingPrice] = useState('')
  const [receiveExpiry, setReceiveExpiry] = useState('')
  const [receiveManufacture, setReceiveManufacture] = useState('')
  const [receiveBestBefore, setReceiveBestBefore] = useState('')
  const [receiveBatch, setReceiveBatch] = useState('')
  const [receiveNotes, setReceiveNotes] = useState('')

  // Auto-fill receive cost from item unit_cost
  useEffect(() => {
    if (item.unit_cost) setReceiveCostPrice(String(item.unit_cost))
  }, [item.unit_cost])

  const handleReceive = useCallback(async () => {
    const qty = parseInt(receiveQty)
    if (!qty || qty <= 0) { toast.error('Enter a valid quantity'); return }
    const remaining = item.quantity_ordered - item.quantity_received
    if (qty > remaining) { toast.error(`Max receivable: ${remaining}`); return }

    try {
      // Record in PO receipt
      await receiveMut.mutateAsync({
        id: item.purchase_order_id,
        data: {
          items: [{ item_id: item.id, quantity: qty }],
          notes: receiveNotes || undefined,
        },
      })

      // Also stock-in via inventory API with full metadata
      await vendorApi.inventoryStockIn({
        product_id: item.product_id,
        variant_id: item.variant_id || undefined,
        quantity: qty,
        purchase_order_id: item.purchase_order_id,
        batch_number: receiveBatch || undefined,
        cost_price: receiveCostPrice ? parseFloat(receiveCostPrice) : undefined,
        selling_price: receiveSellingPrice ? parseFloat(receiveSellingPrice) : undefined,
        expiration_date: receiveExpiry || undefined,
        manufacture_date: receiveManufacture || undefined,
        best_before_date: receiveBestBefore || undefined,
        reason: `Received via PO`,
      })
      toast.success(`Received ${qty} units`)
      setReceiveQty('')
    } catch { /* handled */ }
  }, [item, receiveMut, receiveQty, receiveNotes, receiveBatch, receiveCostPrice, receiveSellingPrice, receiveExpiry, receiveManufacture, receiveBestBefore])

  const p = fullProduct as any

  return (
    <div className="px-6 py-4 space-y-4">
      {/* Product / Variant info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Product</p>
          <p className="font-medium">{item.product_name || item.product_id}</p>
          {p?.category && <p className="text-xs text-gray-400">{p.category}</p>}
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">SKU / Barcode</p>
          <p>{item.product_sku || p?.sku || '-'}</p>
          {(selectedVariant?.barcode || p?.barcode) && (
            <p className="text-xs text-gray-400 font-mono">{selectedVariant?.barcode || p?.barcode}</p>
          )}
        </div>
        {selectedVariant ? (
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Variant</p>
            <p className="font-medium text-blue-700">{selectedVariant.name}</p>
            {selectedVariant.sku && <p className="text-xs text-gray-400">{selectedVariant.sku}</p>}
          </div>
        ) : variants.length > 0 ? (
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Variants</p>
            <p className="text-xs text-gray-500">{variants.length} variant{variants.length !== 1 ? 's' : ''} available</p>
          </div>
        ) : null}
        <div>
          <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Current Stock</p>
          <p>{selectedVariant ? selectedVariant.quantity ?? '-' : p?.quantity ?? '-'} units</p>
          {(selectedVariant?.cost_price ?? p?.cost_price) && (
            <p className="text-xs text-gray-400">Cost: {formatCurrency(selectedVariant?.cost_price ?? p?.cost_price)}</p>
          )}
        </div>
      </div>

      {/* Draft: Edit item */}
      {isDraft && (
        <div className="border-t pt-3">
          <p className="text-xs font-medium text-gray-500 uppercase mb-3">Edit Line Item</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {variants.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Variant</Label>
                <select className={selectClass} value={editVariantId} onChange={e => setEditVariantId(e.target.value)}>
                  <option value="">Product-level</option>
                  {variants.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name}{v.sku ? ` · ${v.sku}` : ''}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Quantity</Label>
              <Input type="number" min={1} value={editQty} onChange={e => setEditQty(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unit Cost (₹)</Label>
              <Input type="number" min={0} step="0.01" value={editCost} onChange={e => setEditCost(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" disabled={saving} className="gap-1.5"
              onClick={() => onSaveEdit({ product_id: item.product_id, variant_id: editVariantId || undefined, quantity: parseInt(editQty), unit_cost: parseFloat(editCost) })}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Receive: per-item stock-in with inventory fields */}
      {canReceive && item.quantity_received < item.quantity_ordered && (
        <div className="border-t pt-3">
          <p className="text-xs font-medium text-gray-500 uppercase mb-3">
            Receive Stock
            <span className="ml-2 font-normal text-amber-600">
              {item.quantity_ordered - item.quantity_received} remaining
            </span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Quantity to Receive <span className="text-red-500">*</span></Label>
              <Input type="number" min={1} max={item.quantity_ordered - item.quantity_received}
                value={receiveQty} onChange={e => setReceiveQty(e.target.value)} placeholder="Qty" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cost Price (₹) <span className="text-gray-400">(updates record)</span></Label>
              <Input type="number" min={0} step="0.01" value={receiveCostPrice}
                onChange={e => setReceiveCostPrice(e.target.value)} placeholder="e.g. 300.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Selling Price (₹) <span className="text-gray-400">(updates record)</span></Label>
              <Input type="number" min={0} step="0.01" value={receiveSellingPrice}
                onChange={e => setReceiveSellingPrice(e.target.value)} placeholder="e.g. 450.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Manufacture Date</Label>
              <Input type="date" value={receiveManufacture} onChange={e => setReceiveManufacture(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Best Before</Label>
              <Input type="date" value={receiveBestBefore} onChange={e => setReceiveBestBefore(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expiration Date</Label>
              <Input type="date" value={receiveExpiry} onChange={e => setReceiveExpiry(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Batch / Lot Number</Label>
              <Input value={receiveBatch} onChange={e => setReceiveBatch(e.target.value)} placeholder="LOT-2024-001" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)} placeholder="Delivery challan ref, inspection notes…" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="gap-1.5" onClick={handleReceive}
              disabled={receiveMut.isPending || !receiveQty}>
              {receiveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5" />}
              Confirm Receipt
            </Button>
          </div>
        </div>
      )}

      {canReceive && item.quantity_received >= item.quantity_ordered && (
        <div className="border-t pt-3">
          <p className="text-xs text-green-600 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Fully received
          </p>
        </div>
      )}
    </div>
  )
}

// ── ReceiveModal (bulk) ───────────────────────────────────────────

function ReceiveModal({
 po_id, items, onClose }: {
  po_id: string
  items: POItem[]
  onClose: () => void
}) {
  const receiveMut = useReceivePOItems()
  const receivableItems = items.filter(i => i.quantity_received < i.quantity_ordered)
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(receivableItems.map(i => [i.id, '']))
  )
  const [notes, setNotes] = useState('')
  const hasAny = Object.values(quantities).some(v => parseInt(v) > 0)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const receiveItems = Object.entries(quantities)
      .filter(([, v]) => parseInt(v) > 0)
      .map(([itemId, qty]) => ({ item_id: itemId, quantity: parseInt(qty) }))
    if (!receiveItems.length) return
    try {
      await receiveMut.mutateAsync({ id: po_id, data: { items: receiveItems, notes: notes || undefined } })
      onClose()
    } catch { /* handled */ }
  }, [quantities, notes, po_id, receiveMut, onClose])

  if (receivableItems.length === 0) {
    return (
      <div data-kiterp-modal className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 overflow-y-auto" onClick={onClose}>
        <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <p className="text-center text-gray-600">All items have been fully received.</p>
          <Button className="w-full mt-4" onClick={onClose}>Close</Button>
        </div>
      </div>
    )
  }

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">Receive Items</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-500">Enter quantities received for each item. Leave blank to skip.</p>
          <div className="space-y-3">
            {receivableItems.map((item) => {
              const remaining = item.quantity_ordered - item.quantity_received
              return (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name || item.product_id}</p>
                    {item.product_sku && <p className="text-xs text-gray-400 font-mono">{item.product_sku}</p>}
                    <p className="text-xs text-gray-500">
                      Ordered: {item.quantity_ordered} · Received: {item.quantity_received} ·{' '}
                      <span className="text-amber-600 font-medium">Remaining: {remaining}</span>
                    </p>
                  </div>
                  <Input type="number" min={0} max={remaining} className="w-24" placeholder="Qty"
                    value={quantities[item.id] || ''}
                    onChange={e => setQuantities({ ...quantities, [item.id]: e.target.value })} />
                </div>
              )
            })}
          </div>
          <div className="space-y-1.5">
            <Label>Receipt Notes</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none"
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Invoice #, delivery challan ref..." />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 gap-2" disabled={receiveMut.isPending || !hasAny}>
              {receiveMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <PackageCheck className="w-4 h-4" /> Confirm Receipt
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
