import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableToolbar } from '@/components/table/TableToolbar'

import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import {
  useServiceEntrySheets, useCreateServiceEntrySheet, useUpdateServiceEntrySheet,
  useSubmitServiceEntrySheet, useApproveServiceEntrySheet,
  useSubcontractingOrders, useCreateSubcontractingOrder, useUpdateSubcontractingOrder,
  useConsignmentStock, useCreateConsignmentStock, useUpdateConsignmentStock, useWithdrawConsignmentStock,
  usePurchaseOrders,
} from '@/hooks/useVendor'
import { ProcurementSupplierField } from '@/components/procurement/ProcurementSupplierField'
import { ProcurementProductField } from '@/components/procurement/ProcurementProductField'
import { formatDate, formatCurrency } from '@/lib/utils'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import { toast } from 'sonner'
import type { ServiceEntrySheet, SubcontractingOrder, ConsignmentStock } from '@/types'
import {
  Loader2, Plus, X, FileCheck, CheckCircle, XCircle, Send,
  GitBranch, Package2, Boxes, ChevronDown, ChevronUp,
  Pencil, ArrowDownToLine,
} from 'lucide-react'

// ─── Consignment Stock modals ─────────────────────────────────────

function CreateConsignmentModal({ onClose }: { onClose: () => void }) {
  const create = useCreateConsignmentStock()
  const { data: posData } = usePurchaseOrders({ size: 200 })
  const pos = posData?.items ?? []
  const [supplierId, setSupplierId] = useState('')
  const [productId, setProductId] = useState('')
  const [poId, setPoId] = useState('')
  const [qty, setQty] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [currency, setCurrency] = useState('INR')
  useEscapeToClose(onClose, true)

  const handleSave = () => {
    if (!supplierId) { toast.error('Select a supplier'); return }
    if (!productId) { toast.error('Select a product'); return }
    if (!qty || Number(qty) <= 0) { toast.error('Enter a valid quantity'); return }
    create.mutate({
      supplier_id: supplierId,
      product_id: productId,
      purchase_order_id: poId || undefined,
      quantity_available: Number(qty),
      unit_price: unitPrice ? Number(unitPrice) : 0,
      currency,
    }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <Boxes className="w-4 h-4 text-teal-600" /> Add Consignment Stock
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="p-6 space-y-4">
          <div className="rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 p-3 text-xs text-teal-800 dark:text-teal-300">
            Consignment stock is <strong>supplier-owned</strong>. You hold it on your premises and pay only when you withdraw (consume) it.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ProcurementSupplierField
              value={supplierId}
              onChange={setSupplierId}
              label="Supplier *"
              required
              returnTo="procurement/special"
              className="col-span-2"
            />
            <ProcurementProductField
              value={productId}
              onChange={setProductId}
              label="Product *"
              required
              className="col-span-2"
            />
            <div className="col-span-2">
              <Label className="text-xs">Purchase Order Reference</Label>
              <Select
                value={poId}
                onChange={setPoId}
                options={selectOptionsWithBlank(
                  '— Optional PO —',
                  pos.map((p: { id: string; po_number: string }) => ({ value: p.id, label: p.po_number })),
                )}
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Qty Available *</Label>
              <Input type="number" min={0} step={0.001} value={qty} onChange={e => setQty(e.target.value)} className="mt-1" placeholder="e.g. 50" />
            </div>
            <div>
              <Label className="text-xs">Unit Price</Label>
              <Input type="number" min={0} step={0.01} value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className="mt-1" placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <Input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Stock
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function EditConsignmentModal({ record, onClose }: { record: ConsignmentStock; onClose: () => void }) {
  const update = useUpdateConsignmentStock()
  const [unitPrice, setUnitPrice] = useState(String(record.unit_price ?? ''))
  const [currency, setCurrency] = useState(record.currency ?? 'INR')
  const [qty, setQty] = useState(String(record.quantity_available ?? ''))
  useEscapeToClose(onClose, true)

  const handleSave = () => {
    update.mutate({
      id: record.id,
      data: {
        unit_price: unitPrice ? Number(unitPrice) : undefined,
        currency: currency || undefined,
        quantity_available: qty !== '' ? Number(qty) : undefined,
      },
    }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold">Edit Consignment Record</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="p-6 space-y-4">
          <div className="text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
            <p className="text-gray-500 text-xs">Product</p>
            <p className="font-semibold">{record.product_name || record.product_id.slice(0, 12)}</p>
            <p className="text-gray-500 text-xs mt-1">Supplier</p>
            <p className="font-medium">{record.supplier_name || record.supplier_id.slice(0, 12)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Qty Available</Label>
              <Input type="number" min={0} step={0.001} value={qty} onChange={e => setQty(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Unit Price</Label>
              <Input type="number" min={0} step={0.01} value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <Input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={update.isPending} className="gap-2">
              {update.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function WithdrawConsignmentModal({ record, onClose }: { record: ConsignmentStock; onClose: () => void }) {
  const withdraw = useWithdrawConsignmentStock()
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  useEscapeToClose(onClose, true)

  const handleWithdraw = () => {
    const q = Number(qty)
    if (!q || q <= 0) { toast.error('Enter a valid withdrawal quantity'); return }
    if (q > record.quantity_available) {
      toast.error(`Cannot withdraw more than available (${record.quantity_available})`)
      return
    }
    withdraw.mutate({ id: record.id, data: { quantity: q, notes: notes || undefined } }, { onSuccess: onClose })
  }

  const totalCost = qty && record.unit_price ? (Number(qty) * record.unit_price) : 0

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <ArrowDownToLine className="w-4 h-4 text-amber-600" /> Withdraw Stock
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
            <div>
              <p className="text-gray-500 text-xs">Product</p>
              <p className="font-semibold truncate">{record.product_name || record.product_id.slice(0, 12)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Supplier</p>
              <p className="font-medium truncate">{record.supplier_name || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Available</p>
              <p className="font-bold text-teal-600">{record.quantity_available}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Unit Price</p>
              <p className="font-medium">{formatCurrency(record.unit_price)} {record.currency}</p>
            </div>
          </div>
          <div>
            <Label className="text-xs">Quantity to Withdraw *</Label>
            <Input
              type="number" min={0.001} step={0.001}
              max={record.quantity_available}
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="mt-1"
              placeholder={`Max ${record.quantity_available}`}
            />
          </div>
          {totalCost > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Estimated liability: </span>
              <span className="font-bold text-amber-700 dark:text-amber-400">
                {formatCurrency(totalCost)} {record.currency}
              </span>
            </div>
          )}
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" placeholder="Reason for withdrawal…" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleWithdraw} disabled={withdraw.isPending} className="gap-2 bg-amber-600 hover:bg-amber-700">
              {withdraw.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <ArrowDownToLine className="w-4 h-4" /> Confirm Withdrawal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── SES Status badge ─────────────────────────────────────────────
const SES_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  draft:     { bg: 'bg-gray-100 dark:bg-gray-800',      text: 'text-gray-700 dark:text-gray-300',    label: 'Draft' },
  submitted: { bg: 'bg-blue-50 dark:bg-blue-950/50',    text: 'text-blue-700 dark:text-blue-300',    label: 'Submitted' },
  approved:  { bg: 'bg-green-50 dark:bg-green-950/50',  text: 'text-green-700 dark:text-green-300',  label: 'Approved' },
  rejected:  { bg: 'bg-red-50 dark:bg-red-950/50',      text: 'text-red-700 dark:text-red-300',      label: 'Rejected' },
  invoiced:  { bg: 'bg-purple-50 dark:bg-purple-950/50',text: 'text-purple-700 dark:text-purple-300', label: 'Invoiced' },
}

// ─── Subcontracting Status badge ──────────────────────────────────
const SC_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  open:               { bg: 'bg-blue-50 dark:bg-blue-950/50',    text: 'text-blue-700 dark:text-blue-300',    label: 'Open' },
  components_issued:  { bg: 'bg-amber-50 dark:bg-amber-950/50',  text: 'text-amber-700 dark:text-amber-300',  label: 'Components Issued' },
  in_progress:        { bg: 'bg-violet-50 dark:bg-violet-950/50',text: 'text-violet-700 dark:text-violet-300', label: 'In Progress' },
  received:           { bg: 'bg-teal-50 dark:bg-teal-950/50',    text: 'text-teal-700 dark:text-teal-300',    label: 'Received' },
  closed:             { bg: 'bg-green-50 dark:bg-green-950/50',  text: 'text-green-700 dark:text-green-300',  label: 'Closed' },
  cancelled:          { bg: 'bg-red-50 dark:bg-red-950/50',      text: 'text-red-700 dark:text-red-300',      label: 'Cancelled' },
}

// ─── Create SES Modal ─────────────────────────────────────────────
function CreateSESModal({ onClose }: { onClose: () => void }) {
  const create = useCreateServiceEntrySheet()
  const { data: posData } = usePurchaseOrders({ size: 200 })
  const pos = posData?.items ?? []

  const [supplierId, setSupplierId] = useState('')
  const [poId, setPoId] = useState('')
  const [description, setDescription] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [notes, setNotes] = useState('')

  useEscapeToClose(onClose, true)

  const handleSave = () => {
    if (!supplierId) { toast.error('Select a supplier'); return }
    if (!totalAmount || Number(totalAmount) <= 0) { toast.error('Enter total amount'); return }
    create.mutate({
      supplier_id: supplierId,
      purchase_order_id: poId || undefined,
      description: description || undefined,
      total_amount: Number(totalAmount),
      currency,
      service_period_from: periodFrom || undefined,
      service_period_to: periodTo || undefined,
      notes: notes || undefined,
    }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-green-600" /> New Service Entry Sheet
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ProcurementSupplierField
              value={supplierId}
              onChange={setSupplierId}
              label="Supplier"
              required
              returnTo="procurement/special"
              className="col-span-2"
            />
            <div className="col-span-2">
              <Label className="text-xs">Link to PO (optional)</Label>
              <Select
                value={poId}
                onChange={setPoId}
                options={selectOptionsWithBlank(
                  '— No PO —',
                  pos.map((p: { id: string; po_number: string }) => ({ value: p.id, label: p.po_number })),
                )}
                className="mt-1 text-sm"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Service Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. AMC for HVAC Q1 2026" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Total Amount *</Label>
              <Input type="number" min={0} step={0.01} value={totalAmount} onChange={e => setTotalAmount(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <Input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Service Period From</Label>
              <Input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Service Period To</Label>
              <Input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes" className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create SES
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── SES Detail Panel ─────────────────────────────────────────────
function SESDetailPanel({ ses, onClose }: { ses: ServiceEntrySheet; onClose: () => void }) {
  const submit = useSubmitServiceEntrySheet()
  const approve = useApproveServiceEntrySheet()
  const [remarks, setRemarks] = useState('')
  const badge = SES_BADGE[ses.status] ?? SES_BADGE.draft

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-mono">{ses.ses_number}</p>
            <h2 className="text-lg font-semibold">{ses.supplier_name || 'Service Entry'}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">PO Reference</p><p className="font-medium text-blue-600">{ses.po_number || '—'}</p></div>
            <div><p className="text-gray-500">Total Amount</p><p className="font-bold text-lg">{formatCurrency(ses.total_amount)} <span className="text-xs font-normal text-gray-500">{ses.currency}</span></p></div>
            <div><p className="text-gray-500">Service Period</p>
              <p className="font-medium">
                {ses.service_period_from ? formatDate(ses.service_period_from) : '—'}
                {ses.service_period_to ? ` → ${formatDate(ses.service_period_to)}` : ''}
              </p>
            </div>
            <div><p className="text-gray-500">Submitted</p><p className="font-medium">{ses.submitted_at ? formatDate(ses.submitted_at) : '—'}</p></div>
            <div><p className="text-gray-500">Approved</p><p className="font-medium">{ses.accepted_at ? formatDate(ses.accepted_at) : '—'}</p></div>
          </div>
          {ses.notes && <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 text-sm">{ses.notes}</div>}

          {ses.status === 'draft' && (
            <div className="flex gap-2 border-t pt-4">
              <Button onClick={() => submit.mutate(ses.id)} disabled={submit.isPending} className="gap-2">
                {submit.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <Send className="w-4 h-4" /> Submit for Approval
              </Button>
            </div>
          )}
          {ses.status === 'submitted' && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium text-sm">Approval Decision</h3>
              <Input placeholder="Remarks (required for rejection)" value={remarks} onChange={e => setRemarks(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={() => approve.mutate({ id: ses.id, data: { status: 'approved', remarks } }, { onSuccess: onClose })} disabled={approve.isPending} className="gap-2 bg-green-600 hover:bg-green-700">
                  {approve.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <CheckCircle className="w-4 h-4" /> Approve
                </Button>
                <Button variant="destructive" onClick={() => {
                  if (!remarks.trim()) { toast.error('Enter rejection remarks'); return }
                  approve.mutate({ id: ses.id, data: { status: 'rejected', remarks } }, { onSuccess: onClose })
                }} disabled={approve.isPending} className="gap-2">
                  <XCircle className="w-4 h-4" /> Reject
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Create Subcontracting Order Modal ────────────────────────────
function CreateSubcontractingModal({ onClose }: { onClose: () => void }) {
  const create = useCreateSubcontractingOrder()
  const { data: posData } = usePurchaseOrders({ size: 200 })
  const pos = posData?.items ?? []

  const [poId, setPoId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [ref, setRef] = useState('')
  const [qtyExpected, setQtyExpected] = useState('')
  const [notes, setNotes] = useState('')
  // Single component row for simplicity
  const [compQtyRequired, setCompQtyRequired] = useState('')
  const [compUom, setCompUom] = useState('EA')

  useEscapeToClose(onClose, true)

  const handleSave = () => {
    if (!poId) { toast.error('Select a linked Purchase Order'); return }
    if (!supplierId) { toast.error('Select a supplier'); return }
    if (!ref.trim()) { toast.error('Enter a reference number'); return }
    if (!compQtyRequired || Number(compQtyRequired) <= 0) { toast.error('Enter component quantity required'); return }

    create.mutate({
      purchase_order_id: poId,
      supplier_id: supplierId,
      ref: ref.trim(),
      qty_expected: qtyExpected ? Number(qtyExpected) : 0,
      notes: notes || undefined,
      components: [{
        qty_required: Number(compQtyRequired),
        qty_issued: 0,
        uom: compUom,
      }],
    }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-violet-600" /> New Subcontracting Order
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Linked Purchase Order *</Label>
              <Select
                value={poId}
                onChange={setPoId}
                options={selectOptionsWithBlank(
                  '— Select PO —',
                  pos.map((p: { id: string; po_number: string }) => ({ value: p.id, label: p.po_number })),
                )}
                className="mt-1 text-sm"
              />
            </div>
            <ProcurementSupplierField
              value={supplierId}
              onChange={setSupplierId}
              label="Subcontractor (Supplier) *"
              required
              returnTo="procurement/special"
              className="col-span-2"
            />
            <div>
              <Label className="text-xs">Reference No. *</Label>
              <Input value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. SC-2026-001" className="mt-1" maxLength={30} />
            </div>
            <div>
              <Label className="text-xs">Qty Expected Back</Label>
              <Input type="number" min={0} step={0.001} value={qtyExpected} onChange={e => setQtyExpected(e.target.value)} className="mt-1" placeholder="0" />
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Components to Issue</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Qty Required *</Label>
                <Input type="number" min={0} step={0.001} value={compQtyRequired} onChange={e => setCompQtyRequired(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Unit of Measure</Label>
                <Input value={compUom} onChange={e => setCompUom(e.target.value.toUpperCase())} maxLength={10} className="mt-1" placeholder="EA" />
              </div>
            </div>
            <p className="text-xs text-gray-400">You can add more components after creation by updating the order.</p>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes" className="mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Order
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Subcontracting Detail Panel ──────────────────────────────────
function SubcontractingDetailPanel({ sc, onClose }: { sc: SubcontractingOrder; onClose: () => void }) {
  const update = useUpdateSubcontractingOrder()
  const [status, setStatus] = useState(sc.status)
  const [qtyReceived, setQtyReceived] = useState(String(sc.qty_received))
  const [notes, setNotes] = useState(sc.notes ?? '')
  const [showComponents, setShowComponents] = useState(true)
  const badge = SC_BADGE[sc.status] ?? SC_BADGE.open

  const statusOptions = [
    { value: 'open', label: 'Open' },
    { value: 'components_issued', label: 'Components Issued' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'received', label: 'Received' },
    { value: 'closed', label: 'Closed' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  const handleSave = () => {
    update.mutate({
      id: sc.id,
      data: {
        status,
        qty_received: qtyReceived ? Number(qtyReceived) : 0,
        notes: notes || undefined,
      },
    }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-mono">{sc.ref}</p>
            <h2 className="text-lg font-semibold">{sc.supplier_name || 'Subcontracting Order'}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">PO Reference</p><p className="font-medium text-blue-600">{sc.po_number || sc.purchase_order_id.slice(0, 12)}</p></div>
            <div><p className="text-gray-500">Qty Expected</p><p className="font-semibold">{sc.qty_expected}</p></div>
            <div><p className="text-gray-500">Qty Received</p><p className="font-semibold text-green-600">{sc.qty_received}</p></div>
            <div><p className="text-gray-500">Created</p><p className="font-medium">{sc.created_at ? formatDate(sc.created_at) : '—'}</p></div>
          </div>

          {/* Components */}
          {sc.components?.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 text-sm font-medium"
                onClick={() => setShowComponents(v => !v)}
              >
                <span className="flex items-center gap-1.5"><Package2 className="w-3.5 h-3.5" /> Components ({sc.components.length})</span>
                {showComponents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showComponents && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t">
                      {['Product', 'Qty Required', 'Qty Issued', 'UOM'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sc.components.map((c, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{c.product_name || c.product_id || '—'}</td>
                        <td className="px-3 py-2 font-semibold">{c.qty_required}</td>
                        <td className="px-3 py-2 text-teal-600">{c.qty_issued ?? 0}</td>
                        <td className="px-3 py-2 text-gray-500">{c.uom || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Update form */}
          {sc.status !== 'closed' && sc.status !== 'cancelled' && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium text-sm">Update Order</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={status} onChange={v => setStatus(v as typeof status)} options={statusOptions} className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Qty Received</Label>
                  <Input type="number" min={0} step={0.001} value={qtyReceived} onChange={e => setQtyReceived(e.target.value)} className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" placeholder="Add notes…" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={update.isPending} className="gap-2">
                  {update.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
          {sc.notes && <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 text-sm">{sc.notes}</div>}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
export default function SpecialProcurementPage() {
  const [tab, setTab] = useState<'ses' | 'subcontracting' | 'consignment'>('ses')
  const [search, setSearch] = useState('')
  const [showSESForm, setShowSESForm] = useState(false)
  const [showSCForm, setShowSCForm] = useState(false)
  const [showCSForm, setShowCSForm] = useState(false)
  const [editingCS, setEditingCS] = useState<ConsignmentStock | undefined>()
  const [withdrawingCS, setWithdrawingCS] = useState<ConsignmentStock | undefined>()
  const [selectedSES, setSelectedSES] = useState<ServiceEntrySheet | undefined>()
  const [selectedSC, setSelectedSC] = useState<SubcontractingOrder | undefined>()

  const { data: sesData, isLoading: sesLoading } = useServiceEntrySheets()
  const ses: ServiceEntrySheet[] = sesData?.items ?? []

  const { data: scData, isLoading: scLoading } = useSubcontractingOrders()
  const scOrders: SubcontractingOrder[] = scData?.items ?? []

  const { data: csData, isLoading: csLoading } = useConsignmentStock()
  const consignment: ConsignmentStock[] = csData?.items ?? []

  const filteredSES = useMemo(() => {
    const q = search.toLowerCase()
    return ses.filter(s =>
      !q ||
      s.ses_number.toLowerCase().includes(q) ||
      (s.supplier_name || '').toLowerCase().includes(q)
    )
  }, [ses, search])

  const filteredSC = useMemo(() => {
    const q = search.toLowerCase()
    return scOrders.filter(s =>
      !q ||
      s.ref.toLowerCase().includes(q) ||
      (s.supplier_name || '').toLowerCase().includes(q)
    )
  }, [scOrders, search])

  const filteredCS = useMemo(() => {
    const q = search.toLowerCase()
    return consignment.filter(c =>
      !q ||
      (c.product_name || '').toLowerCase().includes(q) ||
      (c.supplier_name || '').toLowerCase().includes(q)
    )
  }, [consignment, search])

  const pendingSES = ses.filter(s => s.status === 'submitted').length
  const activeSC = scOrders.filter(s => !['closed', 'cancelled'].includes(s.status)).length
  const totalConsignmentQty = consignment.reduce((s, c) => s + c.quantity_available, 0)

  return (
    <div className="space-y-6">
      {showSESForm && <CreateSESModal onClose={() => setShowSESForm(false)} />}
      {showSCForm && <CreateSubcontractingModal onClose={() => setShowSCForm(false)} />}
      {showCSForm && <CreateConsignmentModal onClose={() => setShowCSForm(false)} />}
      {editingCS && <EditConsignmentModal record={editingCS} onClose={() => setEditingCS(undefined)} />}
      {withdrawingCS && <WithdrawConsignmentModal record={withdrawingCS} onClose={() => setWithdrawingCS(undefined)} />}
      {selectedSES && <SESDetailPanel ses={selectedSES} onClose={() => setSelectedSES(undefined)} />}
      {selectedSC && <SubcontractingDetailPanel sc={selectedSC} onClose={() => setSelectedSC(undefined)} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Special Procurement</h1>
          <p className="text-sm text-gray-500 mt-0.5">Service entry sheets, subcontracting & consignment stock</p>
        </div>
        <div className="flex gap-2">
          {tab === 'ses' && (
            <Button className="gap-2" onClick={() => setShowSESForm(true)}>
              <Plus className="w-4 h-4" /> New Service Entry Sheet
            </Button>
          )}
          {tab === 'subcontracting' && (
            <Button className="gap-2" onClick={() => setShowSCForm(true)}>
              <Plus className="w-4 h-4" /> New Subcontracting Order
            </Button>
          )}
          {tab === 'consignment' && (
            <Button className="gap-2" onClick={() => setShowCSForm(true)}>
              <Plus className="w-4 h-4" /> Add Consignment Stock
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'SES Pending', count: pendingSES, color: 'text-amber-600' },
          { label: 'Active Subcontracting', count: activeSC, color: 'text-violet-600' },
          { label: 'Consignment Items', count: consignment.length, color: 'text-teal-600' },
          { label: 'Consignment Qty Available', count: totalConsignmentQty, color: 'text-teal-700' },
          { label: 'SES Approved', count: ses.filter(s => s.status === 'approved').length, color: 'text-purple-600' },
          { label: 'SC Received', count: scOrders.filter(s => s.status === 'received').length, color: 'text-green-700' },
        ].map(s => (
          <Card key={s.label} className="py-3 px-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.count}</p>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="ses" className="gap-1.5">
            <FileCheck className="w-3.5 h-3.5" /> Service Entry Sheets ({ses.length})
          </TabsTrigger>
          <TabsTrigger value="subcontracting" className="gap-1.5">
            <GitBranch className="w-3.5 h-3.5" /> Subcontracting ({scOrders.length})
          </TabsTrigger>
          <TabsTrigger value="consignment" className="gap-1.5">
            <Boxes className="w-3.5 h-3.5" /> Consignment Stock ({consignment.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Service Entry Sheets ────────────────────────────────── */}
        <TabsContent value="ses">
          <Card>
            <div className="px-0">
              <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search SES number or supplier…" sortOptions={[{ value: 'created_at', label: 'Created' }, { value: 'total_amount', label: 'Amount' }]} sortKey="created_at" sortDir="desc" onSortKeyChange={() => {}} onSortDirChange={() => {}} />
            </div>
            {sesLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : filteredSES.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No service entry sheets yet</p>
                <p className="text-sm">Create SES documents to confirm service delivery before releasing AP invoices</p>
              </div>
            ) : (
              <ResizableTable tableId="service-entry-sheets" defaultWidths={[120, 160, 110, 100, 110, 110]}>
                <thead>
                  <tr>
                    {['SES No.', 'Supplier', 'PO Ref', 'Total', 'Period', 'Status'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSES.map(s => {
                    const badge = SES_BADGE[s.status] ?? SES_BADGE.draft
                    return (
                      <tr key={s.id} className="border-t cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={onClickableTableRow(() => setSelectedSES(s))}>
                        <td className="px-3 py-2 font-mono text-xs text-blue-600 font-medium">{s.ses_number}</td>
                        <td className="px-3 py-2 text-sm font-medium">{s.supplier_name || '—'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{s.po_number || '—'}</td>
                        <td className="px-3 py-2 text-sm font-semibold">{formatCurrency(s.total_amount)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {s.service_period_from ? formatDate(s.service_period_from) : '—'}
                          {s.service_period_to ? ` → ${formatDate(s.service_period_to)}` : ''}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </ResizableTable>
            )}
          </Card>
        </TabsContent>

        {/* ── Subcontracting Orders ───────────────────────────────── */}
        <TabsContent value="subcontracting">
          <Card>
            <div className="px-0">
              <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search ref or supplier…" sortOptions={[{ value: 'created_at', label: 'Created' }, { value: 'ref', label: 'Reference' }]} sortKey="created_at" sortDir="desc" onSortKeyChange={() => {}} onSortDirChange={() => {}} />
            </div>
            {scLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : filteredSC.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No subcontracting orders yet</p>
                <p className="text-sm">Issue components to an external supplier who returns the finished goods</p>
              </div>
            ) : (
              <ResizableTable tableId="subcontracting-orders" defaultWidths={[120, 160, 110, 90, 90, 110, 110]}>
                <thead>
                  <tr>
                    {['Reference', 'Supplier', 'PO Ref', 'Qty Expected', 'Qty Received', 'Created', 'Status'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSC.map(s => {
                    const badge = SC_BADGE[s.status] ?? SC_BADGE.open
                    return (
                      <tr key={s.id} className="border-t cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={onClickableTableRow(() => setSelectedSC(s))}>
                        <td className="px-3 py-2 font-mono text-xs text-violet-600 font-medium">{s.ref}</td>
                        <td className="px-3 py-2 text-sm font-medium">{s.supplier_name || '—'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{s.po_number || s.purchase_order_id.slice(0, 8)}</td>
                        <td className="px-3 py-2 text-sm font-semibold">{s.qty_expected}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-teal-600">{s.qty_received}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{s.created_at ? formatDate(s.created_at) : '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </ResizableTable>
            )}
          </Card>
        </TabsContent>

        {/* ── Consignment Stock ───────────────────────────────────── */}
        <TabsContent value="consignment">
          <Card>
            <div className="px-0">
              <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search product or supplier…" sortOptions={[{ value: 'product_name', label: 'Product' }, { value: 'quantity_available', label: 'Qty Available' }]} sortKey="product_name" sortDir="asc" onSortKeyChange={() => {}} onSortDirChange={() => {}} />
            </div>
            {csLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : filteredCS.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No consignment stock yet</p>
                <p className="text-sm">Add records manually or receive goods under a consignment PO.</p>
                <Button className="mt-4 gap-2" onClick={() => setShowCSForm(true)}>
                  <Plus className="w-4 h-4" /> Add Consignment Stock
                </Button>
              </div>
            ) : (
              <ResizableTable tableId="consignment-stock" defaultWidths={[160, 140, 110, 100, 100, 100, 80, 100, 100]}>
                <thead>
                  <tr>
                    {['Product', 'Supplier', 'PO Ref', 'Qty Available', 'Qty Withdrawn', 'Unit Price', 'Currency', 'Last Updated', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCS.map(c => (
                    <tr key={c.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2 text-sm font-medium">{c.product_name || c.product_id.slice(0, 12)}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">{c.supplier_name || '—'}</td>
                      <td className="px-3 py-2 text-sm text-blue-600">{c.po_number || '—'}</td>
                      <td className="px-3 py-2 text-sm font-bold text-teal-600">{c.quantity_available}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{c.quantity_withdrawn}</td>
                      <td className="px-3 py-2 text-sm font-medium">{formatCurrency(c.unit_price)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{c.currency}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{c.updated_at ? formatDate(c.updated_at) : '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Withdraw stock"
                            onClick={() => setWithdrawingCS(c)}
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            title="Edit record"
                            onClick={() => setEditingCS(c)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ResizableTable>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
