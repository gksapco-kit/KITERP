import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  SelectRoot as Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { vendorApi } from '@/api/vendor'
import { formatDate } from '@/lib/utils'
import type { RFQ, SupplierQuotation, Supplier } from '@/types'
import {
  FileText, Plus, Send, CheckCircle2, XCircle, Clock,
  BarChart3, ChevronRight, Package, Users, Trophy, Trash2, AlertCircle,
} from 'lucide-react'
import { ProcurementLineItemSelector } from '@/components/procurement/ProcurementLineItemSelector'
import { SupplierTypeahead } from '@/components/procurement/SupplierTypeahead'
import { useProducts, useServices, useRequisitions } from '@/hooks/useVendor'
import type { RequisitionType } from '@/components/procurement/procurementLineItemTypes'
import { DEFAULT_UOM } from '@/components/procurement/procurementLineItemTypes'

// ─────────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────────

const RFQ_STATUS: Record<string, { label: string; cls: string }> = {
  draft:       { label: 'Draft',        cls: 'bg-gray-100 text-gray-700' },
  issued:      { label: 'Issued',       cls: 'bg-blue-100 text-blue-700' },
  bids_closed: { label: 'Bids Closed',  cls: 'bg-yellow-100 text-yellow-700' },
  awarded:     { label: 'Awarded',      cls: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Cancelled',    cls: 'bg-red-100 text-red-700' },
}

const SQ_STATUS: Record<string, { label: string; cls: string }> = {
  draft:        { label: 'Draft',        cls: 'bg-gray-100 text-gray-700' },
  submitted:    { label: 'Submitted',    cls: 'bg-blue-100 text-blue-700' },
  under_review: { label: 'Under Review', cls: 'bg-yellow-100 text-yellow-700' },
  accepted:     { label: 'Accepted',     cls: 'bg-green-100 text-green-700' },
  rejected:     { label: 'Rejected',     cls: 'bg-red-100 text-red-700' },
  expired:      { label: 'Expired',      cls: 'bg-gray-100 text-gray-500' },
}

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; cls: string }> }) {
  const cfg = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
}

// ─────────────────────────────────────────────────────────────────
// RFQ line item row for forms
// ─────────────────────────────────────────────────────────────────
interface RFQItemRow {
  item_type: RequisitionType
  reference_id: string     // product_id or service_id depending on item_type
  variant_id: string
  description: string      // free-text for asset / other types
  quantity: string
  unit_of_measure: string
  target_price: string
  needed_by_date: string
  pr_item_id: string       // originating PR item (traceability)
}

function emptyRFQItem(type: RequisitionType = 'product'): RFQItemRow {
  return {
    item_type: type,
    reference_id: '',
    variant_id: '',
    description: '',
    quantity: '1',
    unit_of_measure: DEFAULT_UOM[type],
    target_price: '',
    needed_by_date: '',
    pr_item_id: '',
  }
}

function isRFQItemValid(item: RFQItemRow): boolean {
  const qty = parseFloat(item.quantity)
  if (isNaN(qty) || qty <= 0) return false
  if (item.item_type === 'product' || item.item_type === 'consumption' || item.item_type === 'service') {
    return !!item.reference_id
  }
  return !!item.description.trim()
}

// ─────────────────────────────────────────────────────────────────
// Create RFQ dialog — header + line items + supplier invite
// ─────────────────────────────────────────────────────────────────

function CreateRFQDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    title: '',
    sourcing_type: 'rfq',
    department: '',
    currency: 'INR',
    payment_terms: '',
    delivery_terms: '',
    bid_submission_deadline: '',
    delivery_required_by: '',
    instructions_to_suppliers: '',
    internal_notes: '',
    requisition_id: '',
  })
  const [items, setItems] = useState<RFQItemRow[]>([emptyRFQItem()])
  const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([])
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const { data: requisitionsData } = useRequisitions({ size: 100, status: 'approved' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requisitions: any[] = requisitionsData?.items ?? []

  const { data: productsData } = useProducts({ size: 500, status: 'active' })
  const products = productsData?.items ?? []

  const { data: servicesData } = useServices({ size: 500, status: 'active' })
  const services = servicesData?.items ?? []

  function addItem() { setItems(prev => [...prev, emptyRFQItem()]) }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, patch: Partial<RFQItemRow>) {
    setItems(prev => prev.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  }

  function handleItemTypeChange(i: number, type: RequisitionType) {
    setItems(prev => prev.map((row, idx) =>
      idx === i
        ? { ...row, item_type: type, reference_id: '', variant_id: '', description: '', unit_of_measure: DEFAULT_UOM[type] }
        : row,
    ))
  }

  function handleReferenceChange(i: number, id: string) {
    const item = items[i]
    let uom = item.unit_of_measure
    let price = item.target_price

    if (item.item_type === 'product' || item.item_type === 'consumption') {
      const product = products.find((p: { id: string }) => p.id === id)
      if (product) {
        uom = product.uom || DEFAULT_UOM[item.item_type]
        if (product.cost_price != null) price = String(product.cost_price)
        else if (product.price != null) price = String(product.price)
      }
    } else if (item.item_type === 'service') {
      const service = services.find((s: { id: string }) => s.id === id)
      if (service) {
        uom = service.uom || DEFAULT_UOM['service']
        if (service.price != null) price = String(service.price)
      }
    }

    updateItem(i, { reference_id: id, unit_of_measure: uom, target_price: price })
  }

  function handlePRChange(requisitionId: string) {
    setForm(f => ({ ...f, requisition_id: requisitionId }))
    if (!requisitionId) return

    const pr = requisitions.find((r: { id: string }) => r.id === requisitionId)
    if (!pr?.items?.length) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prefilled: RFQItemRow[] = pr.items.map((it: any) => {
      const type: RequisitionType = (it.item_type as RequisitionType) || 'product'
      const refId = it.product_id || it.service_id || ''
      return {
        item_type: type,
        reference_id: refId,
        variant_id: it.variant_id || '',
        description: it.description || '',
        quantity: String(it.quantity ?? 1),
        unit_of_measure: it.unit_of_measure || DEFAULT_UOM[type],
        target_price: it.estimated_price != null ? String(it.estimated_price) : '',
        needed_by_date: it.needed_by_date || '',
        pr_item_id: it.id || '',
      }
    })
    setItems(prefilled.length ? prefilled : [emptyRFQItem()])
    if (pr.department) setForm(f => ({ ...f, requisition_id: requisitionId, department: pr.department }))
  }

  function buildItemPayload(it: RFQItemRow) {
    const base = {
      item_type: it.item_type,
      quantity: parseFloat(it.quantity),
      unit_of_measure: it.unit_of_measure,
      target_price: it.target_price ? parseFloat(it.target_price) : undefined,
      needed_by_date: it.needed_by_date || undefined,
      pr_item_id: it.pr_item_id || undefined,
      description: it.description || undefined,
    }
    if (it.item_type === 'product' || it.item_type === 'consumption') {
      return { ...base, product_id: it.reference_id, variant_id: it.variant_id || undefined }
    }
    if (it.item_type === 'service') {
      return { ...base, service_id: it.reference_id }
    }
    return base
  }

  const create = useMutation({
    mutationFn: () => vendorApi.createRFQ({
      ...form,
      bid_submission_deadline: form.bid_submission_deadline || undefined,
      delivery_required_by: form.delivery_required_by || undefined,
      requisition_id: form.requisition_id || undefined,
      items: items.filter(isRFQItemValid).map(buildItemPayload),
      supplier_ids: selectedSuppliers.map(s => s.id),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] })
      queryClient.invalidateQueries({ queryKey: ['vendor', 'rfqs'] })
      handleClose()
    },
  })

  function handleClose() {
    setForm({ title: '', sourcing_type: 'rfq', department: '', currency: 'INR', payment_terms: '', delivery_terms: '', bid_submission_deadline: '', delivery_required_by: '', instructions_to_suppliers: '', internal_notes: '', requisition_id: '' })
    setItems([emptyRFQItem()])
    setSelectedSuppliers([])
    setSubmitAttempted(false)
    onClose()
  }

  const validItems = items.filter(isRFQItemValid)

  const canSubmit = !!form.title && validItems.length > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl flex flex-col max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Create Request for Quotation</DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">Header</h3>
            <div>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Q3 Raw Material Sourcing"
                className={submitAttempted && !form.title ? 'border-red-400 focus-visible:ring-red-300' : ''}
              />
              {submitAttempted && !form.title && (
                <p className="text-xs text-red-500 mt-0.5">Title is required.</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Sourcing Type</Label>
                <Select value={form.sourcing_type} onValueChange={v => setForm(f => ({ ...f, sourcing_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rfq">Open RFQ</SelectItem>
                    <SelectItem value="rfi">Request for Info</SelectItem>
                    <SelectItem value="spot">Spot Purchase</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR — Indian Rupee</SelectItem>
                    <SelectItem value="USD">USD — US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                    <SelectItem value="GBP">GBP — British Pound</SelectItem>
                    <SelectItem value="AED">AED — UAE Dirham</SelectItem>
                    <SelectItem value="SGD">SGD — Singapore Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Bid Deadline</Label><Input type="date" value={form.bid_submission_deadline} onChange={e => setForm(f => ({ ...f, bid_submission_deadline: e.target.value }))} /></div>
              <div><Label>Delivery Required By</Label><Input type="date" value={form.delivery_required_by} onChange={e => setForm(f => ({ ...f, delivery_required_by: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Department</Label><Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. Production, Stores" /></div>
              <div>
                <Label>Source Requisition (optional)</Label>
                <Select value={form.requisition_id} onValueChange={handlePRChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select approved PR…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {requisitions.map((r: { id: string; pr_number: string; department?: string }) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.pr_number}{r.department ? ` — ${r.department}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.requisition_id && (
                  <p className="text-xs text-blue-600 mt-0.5">Line items prefilled from PR</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Payment Terms</Label><Input value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} placeholder="Net 30, Advance…" /></div>
              <div><Label>Delivery Terms</Label><Input value={form.delivery_terms} onChange={e => setForm(f => ({ ...f, delivery_terms: e.target.value }))} placeholder="FOB, CIF, Ex-Works…" /></div>
            </div>
            <div><Label>Instructions to Suppliers</Label><Textarea value={form.instructions_to_suppliers} onChange={e => setForm(f => ({ ...f, instructions_to_suppliers: e.target.value }))} rows={2} /></div>
            <div><Label>Internal Notes</Label><Textarea value={form.internal_notes} onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))} rows={1} /></div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3 border-b pb-1">
              <h3 className="text-sm font-semibold text-gray-700">Line Items</h3>
              <Button type="button" size="sm" variant="outline" onClick={addItem} className="h-7 text-xs">
                <Plus className="w-3 h-3 mr-1" />Add Line
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                  {/* Row 1: type + needed-by + delete */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-xs text-gray-500">Type</Label>
                      <Select value={item.item_type} onValueChange={v => handleItemTypeChange(i, v as RequisitionType)}>
                        <SelectTrigger className="h-8 text-sm mt-0.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product">Product</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
                          <SelectItem value="consumption">Consumable</SelectItem>
                          <SelectItem value="asset">Asset</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-36 shrink-0">
                      <Label className="text-xs text-gray-500">Needed By</Label>
                      <Input type="date" value={item.needed_by_date} onChange={e => updateItem(i, { needed_by_date: e.target.value })} className="h-8 text-sm mt-0.5" />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-600 shrink-0 self-end"
                      onClick={() => removeItem(i)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {/* Row 2: catalog selector */}
                  <ProcurementLineItemSelector
                    type={item.item_type}
                    referenceId={item.reference_id}
                    description={item.description}
                    onReferenceChange={id => handleReferenceChange(i, id)}
                    onDescriptionChange={val => updateItem(i, { description: val })}
                  />
                  {/* Row 3: qty + UoM + target price */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-gray-500">Qty *</Label>
                      <Input type="number" min={0} value={item.quantity} onChange={e => updateItem(i, { quantity: e.target.value })} className="h-8 text-sm mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">UoM</Label>
                      <Input
                        value={item.unit_of_measure}
                        onChange={e => updateItem(i, { unit_of_measure: e.target.value })}
                        className="h-8 text-sm mt-0.5"
                        readOnly={!!(item.reference_id && (item.item_type === 'product' || item.item_type === 'consumption' || item.item_type === 'service'))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Target Price</Label>
                      <Input type="number" min={0} value={item.target_price} onChange={e => updateItem(i, { target_price: e.target.value })} placeholder="Optional" className="h-8 text-sm mt-0.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {submitAttempted && validItems.length === 0 && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Add at least one valid line item before creating.
              </p>
            )}
          </div>

          {/* Invite Suppliers */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-1 mb-3">
              Invite Suppliers <span className="font-normal text-gray-400">(optional)</span>
            </h3>
            <SupplierTypeahead
              mode="multi"
              selectedSuppliers={selectedSuppliers}
              onChange={setSelectedSuppliers}
              enabled={open}
              placeholder="Type supplier name, email or GSTIN…"
            />
          </div>
        </div>

        {/* Sticky footer */}
        <div className="px-6 py-4 border-t bg-white shrink-0 flex justify-between items-center gap-3">
          {submitAttempted && !canSubmit && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {!form.title && validItems.length === 0
                ? 'Enter a title and at least one line item.'
                : !form.title
                  ? 'Title is required.'
                  : 'Add at least one valid line item.'}
            </p>
          )}
          {(!submitAttempted || canSubmit) && <span />}
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={() => {
                setSubmitAttempted(true)
                if (canSubmit) create.mutate()
              }}
              disabled={create.isPending}
            >
              {create.isPending ? 'Creating…' : 'Create RFQ'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────
// Create Supplier Quotation Dialog
// ─────────────────────────────────────────────────────────────────

interface SQItemRow {
  description: string
  quantity: string
  unit_of_measure: string
  unit_price: string
  discount_pct: string
  cgst_rate: string
  sgst_rate: string
  igst_rate: string
  lead_time_days: string
}

function emptySQItem(): SQItemRow {
  return { description: '', quantity: '1', unit_of_measure: 'piece', unit_price: '', discount_pct: '0', cgst_rate: '0', sgst_rate: '0', igst_rate: '0', lead_time_days: '' }
}

function CreateQuotationDialog({
  open, onClose, rfqId, rfqItems,
}: {
  open: boolean
  onClose: () => void
  rfqId?: string
  rfqItems?: Array<{ id: string; description?: string | null; quantity: number; unit_of_measure: string }>
}) {
  const queryClient = useQueryClient()
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [form, setForm] = useState({
    quote_date: new Date().toISOString().slice(0, 10),
    valid_until: '',
    currency: 'INR',
    delivery_lead_time_days: '',
    payment_terms: '',
    delivery_terms: '',
    notes: '',
  })
  const [items, setItems] = useState<SQItemRow[]>(
    rfqItems && rfqItems.length > 0
      ? rfqItems.map(ri => ({ ...emptySQItem(), description: ri.description ?? '', quantity: String(ri.quantity), unit_of_measure: ri.unit_of_measure }))
      : [emptySQItem()]
  )

  function updateItem(i: number, field: keyof SQItemRow, value: string) {
    setItems(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  const create = useMutation({
    mutationFn: () => vendorApi.createQuotation({
      supplier_id: selectedSupplier?.id ?? '',
      rfq_id: rfqId || undefined,
      quote_type: rfqId ? 'rfq_response' : 'spot_quote',
      source: 'manual',
      quote_date: form.quote_date,
      valid_until: form.valid_until || undefined,
      currency: form.currency,
      delivery_lead_time_days: form.delivery_lead_time_days ? parseInt(form.delivery_lead_time_days) : undefined,
      payment_terms: form.payment_terms || undefined,
      delivery_terms: form.delivery_terms || undefined,
      notes: form.notes || undefined,
      items: items
        .filter(it => it.description.trim() && parseFloat(it.unit_price) > 0)
        .map(it => ({
          description: it.description,
          quantity: parseFloat(it.quantity),
          unit_of_measure: it.unit_of_measure,
          unit_price: parseFloat(it.unit_price),
          discount_pct: parseFloat(it.discount_pct) || 0,
          cgst_rate: parseFloat(it.cgst_rate) || 0,
          sgst_rate: parseFloat(it.sgst_rate) || 0,
          igst_rate: parseFloat(it.igst_rate) || 0,
          lead_time_days: it.lead_time_days ? parseInt(it.lead_time_days) : undefined,
        })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['vendor', 'quotations'] })
      if (rfqId) queryClient.invalidateQueries({ queryKey: ['rfq-comparison', rfqId] })
      handleClose()
    },
  })

  function handleClose() {
    setSelectedSupplier(null)
    setItems(rfqItems && rfqItems.length > 0
      ? rfqItems.map(ri => ({ ...emptySQItem(), description: ri.description ?? '', quantity: String(ri.quantity), unit_of_measure: ri.unit_of_measure }))
      : [emptySQItem()])
    setForm({ quote_date: new Date().toISOString().slice(0, 10), valid_until: '', currency: 'INR', delivery_lead_time_days: '', payment_terms: '', delivery_terms: '', notes: '' })
    onClose()
  }

  const validItems = items.filter(it => it.description.trim() && parseFloat(it.unit_price) > 0)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl flex flex-col max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>{rfqId ? 'Enter Supplier Quotation' : 'Create Spot Quotation'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Supplier */}
          <div>
            <Label className="mb-1.5 block">Supplier *</Label>
            <SupplierTypeahead
              mode="single"
              selectedSupplier={selectedSupplier}
              onChange={setSelectedSupplier}
              enabled={open}
              placeholder="Type supplier name, email or GSTIN…"
            />
          </div>

          {/* Header fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label>Quote Date *</Label><Input type="date" value={form.quote_date} onChange={e => setForm(f => ({ ...f, quote_date: e.target.value }))} /></div>
            <div><Label>Valid Until</Label><Input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} /></div>
            <div>
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="AED">AED</SelectItem>
                  <SelectItem value="SGD">SGD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Lead Time (days)</Label><Input type="number" min={0} value={form.delivery_lead_time_days} onChange={e => setForm(f => ({ ...f, delivery_lead_time_days: e.target.value }))} placeholder="e.g. 14" /></div>
            <div><Label>Payment Terms</Label><Input value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} placeholder="Net 30…" /></div>
            <div><Label>Delivery Terms</Label><Input value={form.delivery_terms} onChange={e => setForm(f => ({ ...f, delivery_terms: e.target.value }))} placeholder="FOB…" /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2 border-b pb-1">
              <h3 className="text-sm font-semibold text-gray-700">Quotation Lines</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => setItems(p => [...p, emptySQItem()])} className="h-7 text-xs">
                <Plus className="w-3 h-3 mr-1" />Add Line
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  {/* Labels row — always visible */}
                  {i === 0 && (
                    <div className="grid grid-cols-12 gap-2 mb-1">
                      <Label className="col-span-3 text-xs text-gray-500">Description *</Label>
                      <Label className="col-span-1 text-xs text-gray-500">Qty</Label>
                      <Label className="col-span-1 text-xs text-gray-500">UoM</Label>
                      <Label className="col-span-2 text-xs text-gray-500">Unit Price *</Label>
                      <Label className="col-span-1 text-xs text-gray-500">CGST %</Label>
                      <Label className="col-span-1 text-xs text-gray-500">SGST %</Label>
                      <Label className="col-span-1 text-xs text-gray-500">IGST %</Label>
                      <Label className="col-span-1 text-xs text-gray-500">Lead d.</Label>
                    </div>
                  )}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                      <Input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Item" className="h-8 text-sm" />
                    </div>
                    <div className="col-span-1">
                      <Input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="col-span-1">
                      <Input value={item.unit_of_measure} onChange={e => updateItem(i, 'unit_of_measure', e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} placeholder="0.00" className="h-8 text-sm" />
                    </div>
                    <div className="col-span-1">
                      <Input type="number" value={item.cgst_rate} onChange={e => updateItem(i, 'cgst_rate', e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="col-span-1">
                      <Input type="number" value={item.sgst_rate} onChange={e => updateItem(i, 'sgst_rate', e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="col-span-1">
                      <Input type="number" value={item.igst_rate} onChange={e => updateItem(i, 'igst_rate', e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="col-span-1">
                      <Input type="number" value={item.lead_time_days} onChange={e => updateItem(i, 'lead_time_days', e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600" onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="px-6 py-4 border-t bg-white shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!selectedSupplier || validItems.length === 0 || create.isPending}
          >
            {create.isPending ? 'Creating…' : 'Create Quotation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────
// RFQ Detail panel
// ─────────────────────────────────────────────────────────────────

function RFQDetail({ rfqId, onBack }: { rfqId: string; onBack: () => void }) {
  const queryClient = useQueryClient()
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [closeReason, setCloseReason] = useState('')
  const [showAwardDialog, setShowAwardDialog] = useState(false)
  const [awardNotes, setAwardNotes] = useState('')
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([])
  const [showAddQuote, setShowAddQuote] = useState(false)
  const [showInviteSupplier, setShowInviteSupplier] = useState(false)
  const [inviteSuppliers, setInviteSuppliers] = useState<Supplier[]>([])

  const { data: rfq, isLoading } = useQuery({
    queryKey: ['rfq', rfqId],
    queryFn: () => vendorApi.getRFQ(rfqId) as Promise<RFQ>,
  })

  const { data: comparison } = useQuery({
    queryKey: ['rfq-comparison', rfqId],
    queryFn: () => vendorApi.getRFQComparison(rfqId),
    enabled: ['issued', 'bids_closed', 'awarded'].includes(rfq?.status ?? ''),
    refetchInterval: rfq?.status === 'issued' ? 30_000 : false,  // live-refresh while bids are open
  })

  const issueMut = useMutation({
    mutationFn: () => vendorApi.issueRFQ(rfqId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rfq', rfqId] }),
  })
  const closeBidsMut = useMutation({
    mutationFn: () => vendorApi.closeRFQBids(rfqId, { reason: closeReason }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rfq', rfqId] }); setShowCloseDialog(false) },
  })
  const cancelMut = useMutation({
    mutationFn: () => vendorApi.cancelRFQ(rfqId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rfq', rfqId] }); queryClient.invalidateQueries({ queryKey: ['rfqs'] }) },
  })
  const awardMut = useMutation({
    mutationFn: () => vendorApi.awardRFQ(rfqId, { awarded_quotation_ids: selectedQuoteIds, notes: awardNotes }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rfq', rfqId] }); queryClient.invalidateQueries({ queryKey: ['rfqs'] }); setShowAwardDialog(false) },
  })
  const inviteMut = useMutation({
    mutationFn: () => vendorApi.addRFQSuppliers(rfqId, { supplier_ids: inviteSuppliers.map(s => s.id) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfq', rfqId] })
      setShowInviteSupplier(false)
      setInviteSuppliers([])
    },
  })

  if (isLoading || !rfq) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500">← Back</Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">{rfq.rfq_number}</h2>
            <StatusBadge status={rfq.status} map={RFQ_STATUS} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{rfq.title}</p>
        </div>
        <div className="flex gap-2">
          {rfq.status === 'draft' && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowAddQuote(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />Add Quote
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowInviteSupplier(true)}>
                <Users className="w-3.5 h-3.5 mr-1.5" />Invite Suppliers
              </Button>
              <Button size="sm" onClick={() => issueMut.mutate()} disabled={issueMut.isPending}>
                <Send className="w-3.5 h-3.5 mr-1.5" />{issueMut.isPending ? 'Issuing…' : 'Issue RFQ'}
              </Button>
            </>
          )}
          {rfq.status === 'issued' && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowAddQuote(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />Enter Quote
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCloseDialog(true)}>
                Close Bids
              </Button>
            </>
          )}
          {rfq.status === 'bids_closed' && (
            <Button size="sm" onClick={() => setShowAwardDialog(true)}>
              <Trophy className="w-3.5 h-3.5 mr-1.5" />Award
            </Button>
          )}
          {(rfq.status === 'draft' || rfq.status === 'issued') && (
            <Button size="sm" variant="outline" className="text-red-500 border-red-200" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Card className="p-3">
          <p className="text-xs text-gray-500">Sourcing Type</p>
          <p className="text-sm font-medium uppercase">{rfq.sourcing_type}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-500">Bid Deadline</p>
          <p className="text-sm font-medium">{rfq.bid_submission_deadline ? formatDate(rfq.bid_submission_deadline) : '—'}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-500">Currency</p>
          <p className="text-sm font-medium">{rfq.currency}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-500">Suppliers</p>
          <p className="text-sm font-medium">{rfq.suppliers?.length ?? 0} invited</p>
        </Card>
      </div>

      <Tabs defaultValue="items">
        <TabsList className="mb-4">
          <TabsTrigger value="items"><Package className="w-3.5 h-3.5 mr-1.5" />Items ({rfq.items?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="suppliers"><Users className="w-3.5 h-3.5 mr-1.5" />Suppliers ({rfq.suppliers?.length ?? 0})</TabsTrigger>
          {['issued', 'bids_closed', 'awarded'].includes(rfq.status) && (
            <TabsTrigger value="comparison">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
              Comparison
              {comparison?.summary?.length ? <span className="ml-1.5 bg-green-100 text-green-700 text-xs px-1.5 rounded-full">{comparison.summary.length}</span> : null}
            </TabsTrigger>
          )}
          <TabsTrigger value="history"><Clock className="w-3.5 h-3.5 mr-1.5" />History</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead className="text-right">Target Price</TableHead>
                <TableHead>Needed By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rfq.items?.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm text-gray-500">{item.line_number}</TableCell>
                  <TableCell className="text-sm font-medium">{item.product_name ?? item.description ?? '—'}</TableCell>
                  <TableCell className="text-sm text-right">{Number(item.quantity).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-gray-500">{item.unit_of_measure}</TableCell>
                  <TableCell className="text-sm text-right">{item.target_price ? `${rfq.currency} ${Number(item.target_price).toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="text-sm text-gray-500">{item.needed_by_date ? formatDate(item.needed_by_date) : '—'}</TableCell>
                </TableRow>
              ))}
              {!rfq.items?.length && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-gray-400 py-6">No items added</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="suppliers">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-600">{rfq.suppliers?.length ?? 0} suppliers invited</span>
            {rfq.status === 'draft' && (
              <Button size="sm" variant="outline" onClick={() => setShowInviteSupplier(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />Invite More
              </Button>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead>Acknowledged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rfq.suppliers?.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm font-medium">{s.supplier_name ?? '—'}</TableCell>
                  <TableCell><span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded capitalize">{s.invite_status?.replace('_', ' ')}</span></TableCell>
                  <TableCell className="text-sm text-gray-500">{s.invited_at ? formatDate(s.invited_at) : '—'}</TableCell>
                  <TableCell className="text-sm text-gray-500">{s.acknowledged_at ? formatDate(s.acknowledged_at) : '—'}</TableCell>
                </TableRow>
              ))}
              {!rfq.suppliers?.length && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-gray-400 py-6">No suppliers invited yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {['issued', 'bids_closed', 'awarded'].includes(rfq.status) && (
          <TabsContent value="comparison">
            {!comparison?.summary?.length ? (
              <div className="py-12 text-center text-sm text-gray-400">
                <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No quotations received yet</p>
                <p className="mt-1 text-xs">Comparison will appear once suppliers submit their quotes.</p>
              </div>
            ) : (
              <>
                {/* Supplier summary with rank */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">Supplier Summary</h3>
                    <span className="text-xs text-gray-400">{comparison.summary.length} quotes · sorted by total (lowest first)</span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-8">#</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Supplier</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Quotation</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Subtotal</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Tax</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Lead Days</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">vs. Lowest</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const sorted = [...comparison.summary].sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(a.total) - Number(b.total))
                          const lowestTotal = Number(sorted[0]?.total ?? 0)
                          return sorted.map((s: Record<string, unknown>, i: number) => {
                            const total = Number(s.total)
                            const pctAbove = lowestTotal > 0 ? ((total - lowestTotal) / lowestTotal) * 100 : 0
                            const isLowest = i === 0
                            return (
                              <tr key={String(s.quotation_id)} className={isLowest ? 'bg-green-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="px-3 py-2.5">
                                  {isLowest
                                    ? <Trophy className="w-3.5 h-3.5 text-amber-500" />
                                    : <span className="text-xs text-gray-400 font-medium">{i + 1}</span>}
                                </td>
                                <td className="px-3 py-2.5 font-medium">{String(s.supplier_name)}</td>
                                <td className="px-3 py-2.5 text-gray-500">{String(s.quotation_number)}</td>
                                <td className="px-3 py-2.5"><StatusBadge status={String(s.status)} map={SQ_STATUS} /></td>
                                <td className="px-3 py-2.5 text-right tabular-nums">{Number(s.subtotal).toLocaleString()}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{Number(s.tax_amount).toLocaleString()}</td>
                                <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${isLowest ? 'text-green-700' : ''}`}>
                                  {String(s.currency)} {total.toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5 text-center text-gray-500">{s.delivery_lead_time_days ? `${s.delivery_lead_time_days}d` : '—'}</td>
                                <td className={`px-3 py-2.5 text-right text-xs font-medium ${isLowest ? 'text-green-600' : 'text-red-500'}`}>
                                  {isLowest ? 'Lowest' : `+${pctAbove.toFixed(1)}%`}
                                </td>
                              </tr>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1"><Trophy className="w-3 h-3 text-amber-500" /> Best bid highlighted</p>
                </div>

                {/* Line-level matrix — backend returns key "matrix", each line's quotes are in "quote_lines" */}
                {comparison.matrix && comparison.matrix.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Line-Level Comparison</h3>
                    <div className="space-y-4">
                      {comparison.matrix.map((rfqLine: Record<string, unknown>, li: number) => {
                        const targetPrice = Number(rfqLine.target_price ?? 0)
                        // quote_lines is the backend key; each entry has is_lowest_price from the server
                        const quoteLines = (rfqLine.quote_lines ?? []) as Record<string, unknown>[]
                        // Only priced quotes (unit_price != null) for the "lowest" / savings calculation
                        const pricedLines = quoteLines.filter(q => q.net_unit_price != null)
                        const lowestUnit = pricedLines.length
                          ? Math.min(...pricedLines.map(q => Number(q.net_unit_price)))
                          : 0
                        return (
                          <div key={li} className="border rounded-lg overflow-hidden">
                            <div className="bg-gray-100 px-3 py-2 flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700">
                                Line {Number(rfqLine.line_number)}: {String(rfqLine.description ?? rfqLine.product_name ?? '')}
                                <span className="ml-2 text-gray-500 font-normal">Qty {Number(rfqLine.quantity).toLocaleString()} {String(rfqLine.unit_of_measure ?? '')}</span>
                              </span>
                              {targetPrice > 0 && (
                                <span className="text-xs text-gray-500">
                                  Target: <strong className="text-gray-700">{targetPrice.toLocaleString()}</strong>
                                  {lowestUnit > 0 && lowestUnit < targetPrice && (
                                    <span className="ml-1 text-green-600 font-semibold">↓ {((1 - lowestUnit / targetPrice) * 100).toFixed(1)}% savings</span>
                                  )}
                                </span>
                              )}
                            </div>
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 border-b">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Supplier</th>
                                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Unit Price</th>
                                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Net Price</th>
                                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Lead Days</th>
                                  {targetPrice > 0 && <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">vs. Target</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {[...quoteLines]
                                  // sort: priced quotes first (lowest net price first), then no-quote rows last
                                  .sort((a, b) => {
                                    if (a.net_unit_price == null && b.net_unit_price == null) return 0
                                    if (a.net_unit_price == null) return 1
                                    if (b.net_unit_price == null) return -1
                                    return Number(a.net_unit_price) - Number(b.net_unit_price)
                                  })
                                  .map((q: Record<string, unknown>, qi: number) => {
                                    const hasPrice = q.net_unit_price != null
                                    const netPrice = Number(q.net_unit_price ?? 0)
                                    const unitPrice = Number(q.unit_price ?? netPrice)
                                    // use server-computed flag when available
                                    const isLineLowest = q.is_lowest_price === true || (hasPrice && qi === 0)
                                    const vsTarget = targetPrice > 0 && hasPrice ? ((netPrice - targetPrice) / targetPrice) * 100 : null
                                    return (
                                      <tr key={String(q.supplier_id ?? qi)} className={isLineLowest ? 'bg-green-50' : qi % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                                        <td className="px-3 py-2 font-medium">
                                          {isLineLowest && <Trophy className="w-3 h-3 text-amber-500 inline mr-1.5" />}
                                          {String(q.supplier_name ?? '—')}
                                        </td>
                                        <td className={`px-3 py-2 text-right tabular-nums ${isLineLowest ? 'font-semibold text-green-700' : ''}`}>
                                          {hasPrice ? unitPrice.toLocaleString() : <span className="text-gray-300 text-xs">—</span>}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                                          {hasPrice ? netPrice.toLocaleString() : <span className="text-gray-300 text-xs">—</span>}
                                        </td>
                                        <td className="px-3 py-2 text-center text-gray-500">{q.lead_time_days ? `${q.lead_time_days}d` : '—'}</td>
                                        {targetPrice > 0 && (
                                          <td className={`px-3 py-2 text-right text-xs font-medium ${vsTarget !== null && vsTarget <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {vsTarget !== null ? `${vsTarget > 0 ? '+' : ''}${vsTarget.toFixed(1)}%` : '—'}
                                          </td>
                                        )}
                                      </tr>
                                    )
                                  })}
                              </tbody>
                            </table>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        )}

        <TabsContent value="history">
          <div className="space-y-2">
            {[...(rfq.audit_log ?? [])].reverse().map((entry, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b text-sm">
                <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="capitalize font-medium text-gray-700">{entry.action}</span>
                <span className="text-gray-400">{String(entry.at ?? '').slice(0, 10)}</span>
              </div>
            ))}
            {!rfq.audit_log?.length && <p className="text-sm text-gray-400 py-4 text-center">No history yet</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Close Bids Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Close Bids</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Reason (optional)</Label>
            <Textarea value={closeReason} onChange={e => setCloseReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Cancel</Button>
            <Button onClick={() => closeBidsMut.mutate()} disabled={closeBidsMut.isPending}>
              {closeBidsMut.isPending ? 'Closing…' : 'Close Bids'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Award Dialog */}
      <Dialog open={showAwardDialog} onOpenChange={setShowAwardDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Award RFQ</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-gray-600">Select the quotation(s) to award. Non-selected submitted quotes will be rejected.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {comparison?.summary?.map((s: Record<string, unknown>) => (
                <label key={String(s.quotation_id)} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedQuoteIds.includes(String(s.quotation_id))}
                    onChange={e => {
                      const id = String(s.quotation_id)
                      setSelectedQuoteIds(prev => e.target.checked ? [...prev, id] : prev.filter(x => x !== id))
                    }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{String(s.supplier_name)}</p>
                    <p className="text-xs text-gray-500">{String(s.quotation_number)} · {String(s.currency)} {Number(s.total).toLocaleString()}</p>
                  </div>
                </label>
              ))}
              {!comparison?.summary?.length && <p className="text-sm text-gray-400 text-center py-4">No submitted quotations found</p>}
            </div>
            <div><Label>Notes</Label><Textarea value={awardNotes} onChange={e => setAwardNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAwardDialog(false)}>Cancel</Button>
            <Button onClick={() => awardMut.mutate()} disabled={selectedQuoteIds.length === 0 || awardMut.isPending}>
              {awardMut.isPending ? 'Awarding…' : 'Award'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Suppliers Dialog */}
      <Dialog open={showInviteSupplier} onOpenChange={open => { setShowInviteSupplier(open); if (!open) setInviteSuppliers([]) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Invite Additional Suppliers</DialogTitle></DialogHeader>
          <div className="py-3">
            <SupplierTypeahead
              mode="multi"
              selectedSuppliers={inviteSuppliers}
              onChange={setInviteSuppliers}
              enabled={showInviteSupplier}
              placeholder="Type supplier name, email or GSTIN…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowInviteSupplier(false); setInviteSuppliers([]) }}>Cancel</Button>
            <Button onClick={() => inviteMut.mutate()} disabled={inviteSuppliers.length === 0 || inviteMut.isPending}>
              {inviteMut.isPending ? 'Inviting…' : `Invite${inviteSuppliers.length > 0 ? ` (${inviteSuppliers.length})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Quotation Dialog */}
      {showAddQuote && (
        <CreateQuotationDialog
          open={showAddQuote}
          onClose={() => setShowAddQuote(false)}
          rfqId={rfqId}
          rfqItems={rfq.items}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Quotation Detail — view and take actions
// ─────────────────────────────────────────────────────────────────

function QuotationDetail({ quotation, onClose }: { quotation: SupplierQuotation; onClose: () => void }) {
  const queryClient = useQueryClient()

  const submitMut = useMutation({
    mutationFn: () => vendorApi.submitQuotation(quotation.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['quotations'] }); onClose() },
  })
  const acceptMut = useMutation({
    mutationFn: () => vendorApi.acceptQuotation(quotation.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['quotations'] }); onClose() },
  })
  const rejectMut = useMutation({
    mutationFn: () => vendorApi.rejectQuotation(quotation.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['quotations'] }); onClose() },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>{quotation.quotation_number}</DialogTitle>
            <StatusBadge status={quotation.status} map={SQ_STATUS} />
          </div>
          <p className="text-sm text-gray-500">{quotation.supplier_name} {quotation.rfq_number ? `· RFQ: ${quotation.rfq_number}` : ''}</p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Card className="p-3"><p className="text-xs text-gray-500">Quote Date</p><p className="font-medium">{quotation.quote_date ? formatDate(quotation.quote_date) : '—'}</p></Card>
            <Card className="p-3"><p className="text-xs text-gray-500">Valid Until</p><p className="font-medium">{quotation.valid_until ? formatDate(quotation.valid_until) : '—'}</p></Card>
            <Card className="p-3"><p className="text-xs text-gray-500">Lead Time</p><p className="font-medium">{quotation.delivery_lead_time_days ? `${quotation.delivery_lead_time_days} days` : '—'}</p></Card>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotation.items?.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm text-gray-500">{item.line_number}</TableCell>
                  <TableCell className="text-sm font-medium">{item.product_name ?? item.description ?? '—'}</TableCell>
                  <TableCell className="text-sm text-right">{Number(item.quantity).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-right">{quotation.currency} {Number(item.unit_price).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-right text-gray-500">{Number(item.cgst_rate + item.sgst_rate + item.igst_rate).toFixed(1)}%</TableCell>
                  <TableCell className="text-sm text-right font-medium">{quotation.currency} {Number(item.line_total).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end gap-6 text-sm pt-2">
            <span className="text-gray-500">Subtotal: {quotation.currency} {Number(quotation.subtotal).toLocaleString()}</span>
            <span className="text-gray-500">Tax: {quotation.currency} {Number(quotation.tax_amount).toLocaleString()}</span>
            <span className="font-bold text-gray-900">Total: {quotation.currency} {Number(quotation.total).toLocaleString()}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {quotation.status === 'draft' && (
            <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
              {submitMut.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          )}
          {quotation.status === 'submitted' && (
            <>
              <Button variant="outline" className="text-red-500 border-red-200" onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}>
                <XCircle className="w-3.5 h-3.5 mr-1.5" />Reject
              </Button>
              <Button onClick={() => acceptMut.mutate()} disabled={acceptMut.isPending}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />{acceptMut.isPending ? 'Accepting…' : 'Accept'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────

export default function RFQQuotationsPage() {
  const [tab, setTab] = useState<'rfq' | 'quotations'>('rfq')
  const [showCreate, setShowCreate] = useState(false)
  const [showCreateQuote, setShowCreateQuote] = useState(false)
  const [selectedRFQId, setSelectedRFQId] = useState<string | null>(null)
  const [selectedQuotation, setSelectedQuotation] = useState<SupplierQuotation | null>(null)
  const [rfqFilter, setRfqFilter] = useState('')
  const [sqFilter, setSqFilter] = useState('')

  const { data: rfqData, isLoading: rfqLoading } = useQuery({
    queryKey: ['rfqs'],
    queryFn: () => vendorApi.listRFQs({ size: 50 }),
  })
  const { data: sqData, isLoading: sqLoading } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => vendorApi.listQuotations({ size: 50 }),
  })

  const rfqs = (rfqData?.items ?? []) as RFQ[]
  const quotes = (sqData?.items ?? []) as SupplierQuotation[]

  const filteredRFQs = rfqs.filter(r =>
    !rfqFilter ||
    r.rfq_number.toLowerCase().includes(rfqFilter.toLowerCase()) ||
    (r.title ?? '').toLowerCase().includes(rfqFilter.toLowerCase())
  )
  const filteredQuotes = quotes.filter(q =>
    !sqFilter ||
    q.quotation_number.toLowerCase().includes(sqFilter.toLowerCase()) ||
    (q.supplier_name ?? '').toLowerCase().includes(sqFilter.toLowerCase())
  )

  if (selectedRFQId) {
    return (
      <div className="flex h-[calc(100vh-64px)]">
        <RFQDetail rfqId={selectedRFQId} onBack={() => setSelectedRFQId(null)} />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RFQ & Supplier Quotations</h1>
          <p className="text-sm text-gray-500 mt-1">Manage Requests for Quotation and compare supplier bids</p>
        </div>
        <div className="flex gap-2">
          {tab === 'rfq' && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1.5" />New RFQ
            </Button>
          )}
          {tab === 'quotations' && (
            <Button onClick={() => setShowCreateQuote(true)}>
              <Plus className="w-4 h-4 mr-1.5" />New Quotation
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-500 bg-blue-50 rounded-lg p-1.5" />
            <div>
              <p className="text-xs text-gray-500">Total RFQs</p>
              <p className="text-2xl font-bold text-gray-800">{rfqs.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Send className="w-8 h-8 text-yellow-500 bg-yellow-50 rounded-lg p-1.5" />
            <div>
              <p className="text-xs text-gray-500">Issued / Open</p>
              <p className="text-2xl font-bold text-gray-800">{rfqs.filter(r => r.status === 'issued').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-500 bg-green-50 rounded-lg p-1.5" />
            <div>
              <p className="text-xs text-gray-500">Quotations Received</p>
              <p className="text-2xl font-bold text-gray-800">{quotes.filter(q => q.status === 'submitted').length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as 'rfq' | 'quotations')}>
        <TabsList className="mb-4">
          <TabsTrigger value="rfq">Requests for Quotation ({rfqs.length})</TabsTrigger>
          <TabsTrigger value="quotations">Supplier Quotations ({quotes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rfq">
          <div className="mb-3">
            <Input
              placeholder="Search by number or title…"
              value={rfqFilter}
              onChange={e => setRfqFilter(e.target.value)}
              className="max-w-xs h-8 text-sm"
            />
          </div>
          {rfqLoading ? (
            <p className="text-center py-8 text-sm text-gray-400">Loading…</p>
          ) : (
            <div className="space-y-2">
              {filteredRFQs.map(rfq => (
                <button
                  key={rfq.id}
                  onClick={() => setSelectedRFQId(rfq.id)}
                  className="w-full text-left p-4 border rounded-lg hover:bg-gray-50 hover:border-blue-200 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <FileText className="w-5 h-5 text-blue-400 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{rfq.rfq_number}</span>
                        <StatusBadge status={rfq.status} map={RFQ_STATUS} />
                        <span className="text-xs text-gray-400">{rfq.items?.length ?? 0} items · {rfq.suppliers?.length ?? 0} suppliers</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{rfq.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{rfq.bid_submission_deadline ? `Deadline: ${formatDate(rfq.bid_submission_deadline)}` : ''}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              ))}
              {filteredRFQs.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No RFQs found. Create one to start sourcing.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="quotations">
          <div className="mb-3">
            <Input
              placeholder="Search by number or supplier…"
              value={sqFilter}
              onChange={e => setSqFilter(e.target.value)}
              className="max-w-xs h-8 text-sm"
            />
          </div>
          {sqLoading ? (
            <p className="text-center py-8 text-sm text-gray-400">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>RFQ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map(q => (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedQuotation(q)}
                  >
                    <TableCell className="text-sm font-medium">{q.quotation_number}</TableCell>
                    <TableCell className="text-sm">{q.supplier_name ?? '—'}</TableCell>
                    <TableCell className="text-sm text-gray-500">{q.rfq_number ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={q.status} map={SQ_STATUS} /></TableCell>
                    <TableCell className="text-sm text-right font-medium">{q.currency} {Number(q.total).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-gray-500">{q.valid_until ? formatDate(q.valid_until) : '—'}</TableCell>
                    <TableCell className="text-sm text-gray-500">{q.quote_date ? formatDate(q.quote_date) : '—'}</TableCell>
                  </TableRow>
                ))}
                {filteredQuotes.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-gray-400">No quotations found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <CreateRFQDialog open={showCreate} onClose={() => setShowCreate(false)} />
      <CreateQuotationDialog open={showCreateQuote} onClose={() => setShowCreateQuote(false)} />
      {selectedQuotation && (
        <QuotationDetail quotation={selectedQuotation} onClose={() => setSelectedQuotation(null)} />
      )}
    </div>
  )
}
