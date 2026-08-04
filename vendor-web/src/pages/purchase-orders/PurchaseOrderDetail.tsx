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
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
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
import { ThemeSelect } from '@/components/common/ThemeSelect'
import { processRows, type SortDir } from '@/lib/tableList'
import { usePOTemplateSettings } from '@/hooks/useVendor'
import { printPO, generatePOHtml, DEFAULT_PO_SETTINGS } from '@/lib/poTemplates'
import type { POTemplateSettings } from '@/lib/poTemplates'
import { fetchAsDataUrl, resolveMediaUrl, downloadAsPdf, shareViaWhatsApp, shareViaSms, buildShareMessage } from '@/lib/printUtils'
import {
  PoDestinationFields,
  poDestinationFromLine,
  poDestinationToPayload,
  type PoDestinationValue,
} from '@/components/procurement/PoDestinationFields'

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

  const deleteItem = useCallback (async (item: POItem) => {
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
    <div className="space-y-4">
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
              {po.status === 'sent' && (
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
          <CardContent className="p-3 sm:p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-blue-700">Editing Purchase Order</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-gray-500">Supplier</Label>
                <Select
                  value={headerDraft.supplier_id}
                  onChange={v => setHeaderDraft(d => ({ ...d, supplier_id: v }))}
                  options={selectOptionsWithBlank(
                    '— Select supplier —',
                    suppliers.map(s => ({ value: s.id, label: s.name })),
                  )}
                  className={selectClass}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-gray-500">Expected Delivery Date</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={headerDraft.expected_delivery_date}
                  onChange={e => setHeaderDraft(d => ({ ...d, expected_delivery_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                <Label className="text-[11px] text-gray-500">Notes / Reference</Label>
                <Input
                  className="h-9"
                  value={headerDraft.notes}
                  placeholder="e.g., Invoice ref, delivery instructions…"
                  onChange={e => setHeaderDraft(d => ({ ...d, notes: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <InfoCard icon={Truck} label="Supplier" value={po.supplier_name || '-'} />
          <InfoCard icon={Calendar} label="Order Date" value={formatDate(po.order_date)} />
          <InfoCard icon={Calendar} label="Expected Delivery" value={formatDate(po.expected_delivery_date)} />
          <InfoCard icon={FileText} label="Total" value={formatCurrency(po.total)} />
        </div>
      )}

      {po.notes && !editingHeader && (
        <Card>
          <CardContent className="px-4 py-2.5">
            <p className="text-sm text-gray-600"><span className="font-medium">Notes:</span> {po.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Items table */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0 border-b p-3 sm:px-4 sm:py-2.5">
          <CardTitle className="shrink-0 text-base">Items ({po.items.length})</CardTitle>
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Sort</span>
            <ThemeSelect
              value={itemSortKey}
              onChange={setItemSortKey}
              options={itemSortOptions}
              aria-label="Sort by column"
              className="h-8 text-xs"
              wrapperClassName="w-[7.5rem]"
            />
            <ThemeSelect
              value={itemSortDir}
              onChange={(v) => setItemSortDir(v as SortDir)}
              options={[
                { value: 'asc', label: 'Asc' },
                { value: 'desc', label: 'Desc' },
              ]}
              aria-label="Sort direction"
              className="h-8 text-xs"
              wrapperClassName="w-[5.5rem]"
              menuMinWidth={100}
            />
            {isDraft && (
              <>
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setShowScanner(true)} disabled={scanLoading}>
                  {scanLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
                  Scan Barcode
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => { setScanPrefill(undefined); setAddingItem(true) }}>
                  <Plus className="w-4 h-4" /> Add Item
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
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

          <ResizableTable tableId="po-lines-v2" defaultWidths={[200, 100, 110, 70, 70, 70, 90, 90, isDraft ? 44 : 0]}>
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500"><TableColumnLabel>Product</TableColumnLabel></th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500"><TableColumnLabel>Variant</TableColumnLabel></th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500"><TableColumnLabel>Barcode / SKU</TableColumnLabel></th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500"><TableColumnLabel>Ordered</TableColumnLabel></th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500"><TableColumnLabel>Received</TableColumnLabel></th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500"><TableColumnLabel>Remaining</TableColumnLabel></th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500"><TableColumnLabel>Unit Cost</TableColumnLabel></th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500"><TableColumnLabel>Total</TableColumnLabel></th>
                {isDraft && <th className="w-11 px-2 py-2" />}
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
                      <td className="px-3 py-2 text-sm font-medium">
                        <div className="flex items-center gap-1.5">
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                          <span className="leading-snug">{item.product_name || item.product_id}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {item.variant_name ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {item.variant_name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {displayBarcode && (
                          <div className="font-mono text-gray-600">{displayBarcode}</div>
                        )}
                        {displaySku && (
                          <div className="text-gray-400">{displaySku}</div>
                        )}
                        {!displayBarcode && !displaySku && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-sm tabular-nums">{item.quantity_ordered}</td>
                      <td className="px-3 py-2 text-right text-sm tabular-nums">
                        <span className={item.quantity_received >= item.quantity_ordered ? 'text-green-600 font-medium' : ''}>
                          {item.quantity_received}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-sm tabular-nums">
                        <span className={remaining > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>{remaining}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap">{formatCurrency(item.unit_cost)}</td>
                      <td className="px-3 py-2 text-right text-sm font-medium tabular-nums whitespace-nowrap">{formatCurrency(item.total_cost)}</td>
                      {isDraft && (
                        <td className="px-2 py-2 text-right">
                          <button
                            onClick={() => deleteItem(item)}
                            className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
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
                        <td colSpan={isDraft ? 9 : 8} className="border-b bg-blue-50/30 px-0 py-0">
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
                <td colSpan={7} className="px-3 py-2 text-right text-sm font-semibold text-gray-700">Subtotal</td>
                <td className="px-3 py-2 text-right text-sm font-bold tabular-nums whitespace-nowrap">{formatCurrency(po.subtotal)}</td>
                {isDraft && <td className="px-2 py-2" />}
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
    <div className="rounded-lg border bg-white px-3 py-2.5" onClick={e => e.stopPropagation()}>
      <div className="mb-0.5 flex items-center gap-1.5 text-gray-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium">{label}</span>
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
          <Select
            value={productId}
            onChange={v => { setProductId(v); setVariantId(''); setUnitCost('') }}
            options={selectOptionsWithBlank(
              'Select product…',
              products.map(p => ({
                value: p.id,
                label: `${p.name}${p.sku ? ` (${p.sku})` : ''}`,
              })),
            )}
            className={selectClass}
          />
        </div>
        {variants.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Variant</Label>
            <Select
              value={variantId}
              onChange={v => {
                setVariantId(v)
                if (v) {
                  const variant = variants.find((x: { id: string }) => x.id === v)
                  if (variant?.cost_price) setUnitCost(String(variant.cost_price))
                  else if (variant?.price) setUnitCost(String(variant.price))
                }
              }}
              options={selectOptionsWithBlank(
                'Product-level',
                variants.map((v: { id: string; name: string; sku?: string; barcode?: string }) => ({
                  value: v.id,
                  label: `${v.name}${v.sku ? ` · ${v.sku}` : ''}${v.barcode ? ` · ${v.barcode}` : ''}`,
                })),
              )}
              className={selectClass}
            />
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
  const [receiveExternalBatch, setReceiveExternalBatch] = useState('')
  const [receiveTrackId, setReceiveTrackId] = useState('')
  const [receiveReference, setReceiveReference] = useState('')
  const [receiveDest, setReceiveDest] = useState<PoDestinationValue>(() => poDestinationFromLine(item))
  const [receiveNotes, setReceiveNotes] = useState('')

  // Auto-fill receive cost from item unit_cost
  useEffect(() => {
    if (item.unit_cost) setReceiveCostPrice(String(item.unit_cost))
  }, [item.unit_cost])

  useEffect(() => {
    setReceiveDest(poDestinationFromLine(item))
  }, [item.id, item.plant_id, item.storage_location_id])

  const handleReceive = useCallback(async () => {
    const qty = parseFloat(receiveQty)
    if (!qty || qty <= 0) { toast.error('Enter a valid quantity'); return }
    const remaining = item.quantity_ordered - item.quantity_received
    if (qty > remaining) { toast.error(`Max receivable: ${remaining}`); return }
    const dest = poDestinationToPayload(receiveDest)

    try {
      // Record in PO receipt (lot metadata used for batch-managed / QI products)
      await receiveMut.mutateAsync({
        id: item.purchase_order_id,
        data: {
          items: [{
            item_id: item.id,
            quantity: qty,
            batch_number: receiveBatch || undefined,
            supplier_batch_number: receiveExternalBatch || undefined,
            manufacturing_date: receiveManufacture || undefined,
            expiry_date: receiveExpiry || undefined,
            track_id: receiveTrackId || undefined,
            reference: receiveReference || undefined,
            ...dest,
          }],
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
      setReceiveBatch('')
      setReceiveExternalBatch('')
      setReceiveTrackId('')
      setReceiveReference('')
    } catch { /* handled */ }
  }, [item, receiveMut, receiveQty, receiveNotes, receiveBatch, receiveExternalBatch, receiveTrackId, receiveReference, receiveDest, receiveCostPrice, receiveSellingPrice, receiveExpiry, receiveManufacture, receiveBestBefore])

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
                <Select
                  value={editVariantId}
                  onChange={setEditVariantId}
                  options={selectOptionsWithBlank(
                    'Product-level',
                    variants.map((v: { id: string; name: string; sku?: string }) => ({
                      value: v.id,
                      label: `${v.name}${v.sku ? ` · ${v.sku}` : ''}`,
                    })),
                  )}
                  className={selectClass}
                />
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
              <Label className="text-xs">Inbound quantity <span className="text-red-500">*</span></Label>
              <Input type="number" min={1} max={item.quantity_ordered - item.quantity_received}
                value={receiveQty} onChange={e => setReceiveQty(e.target.value)} placeholder="Inbound qty" />
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
            <div className="space-y-1">
              <Label className="text-xs">External batch ID</Label>
              <Input value={receiveExternalBatch} onChange={e => setReceiveExternalBatch(e.target.value)} placeholder="Supplier lot" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Track ID</Label>
              <Input value={receiveTrackId} onChange={e => setReceiveTrackId(e.target.value)} placeholder="Track / SSCC" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reference</Label>
              <Input value={receiveReference} onChange={e => setReceiveReference(e.target.value)} placeholder="Challan / container" />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <Label className="text-xs">
                Destination
                {(item.plant_id || item.storage_location_id) ? (
                  <span className="ml-1 text-muted-foreground">(defaults from PO)</span>
                ) : null}
              </Label>
              <PoDestinationFields value={receiveDest} onChange={setReceiveDest} compact />
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

type ReceiveLineDraft = {
  quantity: string
  batch_number: string
  supplier_batch_number: string
  manufacturing_date: string
  expiry_date: string
  track_id: string
  reference: string
  dest: PoDestinationValue
}

const emptyReceiveLine = (item?: POItem): ReceiveLineDraft => ({
  quantity: '',
  batch_number: '',
  supplier_batch_number: '',
  manufacturing_date: '',
  expiry_date: '',
  track_id: '',
  reference: '',
  dest: poDestinationFromLine(item),
})

function ReceiveModal({
 po_id, items, onClose }: {
  po_id: string
  items: POItem[]
  onClose: () => void
}) {
  const receiveMut = useReceivePOItems()
  const receivableItems = items.filter(i => i.quantity_received < i.quantity_ordered)
  const [lines, setLines] = useState<Record<string, ReceiveLineDraft>>(
    Object.fromEntries(receivableItems.map(i => [i.id, emptyReceiveLine(i)]))
  )
  const [notes, setNotes] = useState('')
  const hasAny = Object.values(lines).some(v => parseFloat(v.quantity) > 0)

  const patchLine = (itemId: string, patch: Partial<ReceiveLineDraft>) => {
    setLines(prev => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }))
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown>[] = []
    for (const item of receivableItems) {
      const line = lines[item.id] || emptyReceiveLine(item)
      const qty = parseFloat(line.quantity)
      if (!qty || qty <= 0) continue
      const remaining = item.quantity_ordered - item.quantity_received
      if (qty > remaining) {
        toast.error(`${item.product_name || 'Item'}: max receivable is ${remaining}`)
        return
      }
      payload.push({
        item_id: item.id,
        quantity: qty,
        batch_number: line.batch_number.trim() || undefined,
        supplier_batch_number: line.supplier_batch_number.trim() || undefined,
        manufacturing_date: line.manufacturing_date || undefined,
        expiry_date: line.expiry_date || undefined,
        track_id: line.track_id.trim() || undefined,
        reference: line.reference.trim() || undefined,
        ...poDestinationToPayload(line.dest),
      })
    }
    if (!payload.length) return
    try {
      await receiveMut.mutateAsync({ id: po_id, data: { items: payload, notes: notes || undefined } })
      onClose()
    } catch { /* handled */ }
  }, [lines, notes, po_id, receiveMut, onClose, receivableItems])

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
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">Receive Items</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-500">
            Enter quantity for each line. Destination uses the same Business Unit / Branch·Plant / Storage Location inputs as PO create — defaults from the PO line when set.
          </p>
          <div className="space-y-3">
            {receivableItems.map((item) => {
              const remaining = item.quantity_ordered - item.quantity_received
              const line = lines[item.id] || emptyReceiveLine(item)
              return (
                <div key={item.id} className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.product_name || item.product_id}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Product ID <span className="font-mono text-foreground/80">{item.product_id}</span>
                        {item.product_sku ? <> · SKU <span className="font-mono">{item.product_sku}</span></> : null}
                      </p>
                      <p className="text-xs text-gray-500">
                        Ordered: {item.quantity_ordered} · Received: {item.quantity_received} ·{' '}
                        <span className="text-amber-600 font-medium">Remaining: {remaining}</span>
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Inbound quantity <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        min={0}
                        max={remaining}
                        step="any"
                        placeholder="Inbound qty"
                        value={line.quantity}
                        onChange={e => patchLine(item.id, { quantity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Expiry date</Label>
                      <Input
                        type="date"
                        value={line.expiry_date}
                        onChange={e => patchLine(item.id, { expiry_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Manufacture date</Label>
                      <Input
                        type="date"
                        value={line.manufacturing_date}
                        onChange={e => patchLine(item.id, { manufacturing_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Batch / lot #</Label>
                      <Input
                        value={line.batch_number}
                        onChange={e => patchLine(item.id, { batch_number: e.target.value })}
                        placeholder="Internal lot"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">External batch ID</Label>
                      <Input
                        value={line.supplier_batch_number}
                        onChange={e => patchLine(item.id, { supplier_batch_number: e.target.value })}
                        placeholder="Supplier lot"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Track ID</Label>
                      <Input
                        value={line.track_id}
                        onChange={e => patchLine(item.id, { track_id: e.target.value })}
                        placeholder="Track / SSCC"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Reference</Label>
                      <Input
                        value={line.reference}
                        onChange={e => patchLine(item.id, { reference: e.target.value })}
                        placeholder="Challan / invoice line / container"
                      />
                    </div>
                  </div>
                  <PoDestinationFields
                    value={line.dest}
                    onChange={(dest) => patchLine(item.id, { dest })}
                    compact
                  />
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
