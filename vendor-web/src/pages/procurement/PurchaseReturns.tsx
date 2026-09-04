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
import type { PurchaseOrder, PurchaseOrderItem, PurchaseReturn } from '@/types'
import {
  RotateCcw, Plus, ChevronRight, Clock, CheckCircle2, Truck, AlertCircle, Printer, Download,
} from 'lucide-react'
import { printReturn, downloadReturnPdf, printDebitNote, downloadDebitNotePdf } from '@/lib/procurementPrintUtils'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'

// ─────────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────────

const RETURN_STATUS: Record<string, { label: string; cls: string }> = {
  draft:              { label: 'Draft',          cls: 'bg-gray-100 text-gray-700' },
  approved:           { label: 'Approved',        cls: 'bg-blue-100 text-blue-700' },
  goods_dispatched:   { label: 'Dispatched',      cls: 'bg-yellow-100 text-yellow-700' },
  supplier_confirmed: { label: 'Confirmed',       cls: 'bg-green-100 text-green-700' },
  closed:             { label: 'Closed',          cls: 'bg-green-200 text-green-800' },
  cancelled:          { label: 'Cancelled',       cls: 'bg-red-100 text-red-700' },
}

const RETURN_REASON_LABELS: Record<string, string> = {
  quality_rejection: 'Quality Rejection',
  wrong_item:        'Wrong Item Delivered',
  excess_delivery:   'Excess Delivery',
  damaged:           'Damaged in Transit',
  other:             'Other',
}

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; cls: string }> }) {
  const cfg = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
}

// ─────────────────────────────────────────────────────────────────
// Return line row for form
// ─────────────────────────────────────────────────────────────────
interface ReturnLineEntry {
  po_item_id: string
  product_id: string
  product_name: string
  received_qty: number
  unit_of_measure: string
  unit_price: number
  return_qty: string
  cgst_rate: string
  sgst_rate: string
  igst_rate: string
  reason: string
  include: boolean
}

// ─────────────────────────────────────────────────────────────────
// Create Return Dialog — PO-driven line entry
// ─────────────────────────────────────────────────────────────────

// Per-row validation errors keyed by po_item_id
type LineErrors = Record<string, string>

function CreateReturnDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [poSearch, setPoSearch] = useState('')
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [form, setForm] = useState({
    return_date: new Date().toISOString().slice(0, 10),
    return_reason: 'quality_rejection',
    grn_id: '',
    currency: 'INR',
    notes: '',
  })
  const [lineEntries, setLineEntries] = useState<ReturnLineEntry[]>([])
  const [lineErrors, setLineErrors] = useState<LineErrors>({})

  // Load received POs eligible for return
  const { data: poData } = useQuery({
    queryKey: ['return-po-picker', poSearch],
    queryFn: () => vendorApi.listPurchaseOrders({ status: 'sent,partial_received,received,closed', size: 20, search: poSearch || undefined }),
    enabled: open && !selectedPO,
  })
  const eligiblePOs = (poData?.items ?? []) as PurchaseOrder[]

  function selectPO(po: PurchaseOrder) {
    setSelectedPO(po)
    const entries: ReturnLineEntry[] = (po.items ?? []).map((item: PurchaseOrderItem) => ({
      po_item_id: item.id,
      product_id: item.product_id ?? '',
      product_name: item.product_name ?? item.description ?? item.notes ?? 'Item',
      received_qty: item.quantity_received ?? 0,
      unit_of_measure: item.unit_of_measure ?? 'piece',
      unit_price: item.unit_cost ?? 0,
      return_qty: '0',
      cgst_rate: '0',
      sgst_rate: '0',
      igst_rate: '0',
      reason: '',
      include: false,
    }))
    setLineEntries(entries)
  }

  function updateLine(index: number, field: keyof ReturnLineEntry, value: string | boolean | number) {
    setLineEntries(prev => prev.map((e, i) => {
      if (i !== index) return e
      const updated = { ...e, [field]: value }
      // Auto-clear the row error when the user changes anything
      setLineErrors(errs => {
        const next = { ...errs }
        delete next[e.po_item_id]
        return next
      })
      return updated
    }))
  }

  const create = useMutation({
    mutationFn: () => {
      if (!selectedPO) throw new Error('No PO selected')

      // Last-resort guard: catch empty product_id / po_item_id before hitting the API
      const badLines = lineEntries.filter(
        e => e.include && parseFloat(e.return_qty) > 0 && !e.product_id,
      )
      if (badLines.length > 0) {
        const names = badLines.map(e => `"${e.product_name}"`).join(', ')
        throw new Error(
          `${names} ${badLines.length === 1 ? 'is' : 'are'} not linked to a catalogue product. ` +
          `Deselect ${badLines.length === 1 ? 'it' : 'them'} before creating the return, or contact support to fix the PO item.`,
        )
      }

      let lineNumber = 1
      const lines = lineEntries
        .filter(e => e.include && parseFloat(e.return_qty) > 0)
        .map(e => ({
          po_item_id: e.po_item_id || undefined,   // never send empty string UUID
          product_id: e.product_id || undefined,   // never send empty string UUID
          unit_of_measure: e.unit_of_measure,
          return_qty: parseFloat(e.return_qty),
          unit_price: e.unit_price,
          cgst_rate: parseFloat(e.cgst_rate) || 0,
          sgst_rate: parseFloat(e.sgst_rate) || 0,
          igst_rate: parseFloat(e.igst_rate) || 0,
          line_number: lineNumber++,
          reason: e.reason || undefined,
        }))
      return vendorApi.createPurchaseReturn({
        purchase_order_id: selectedPO.id,
        grn_id: form.grn_id || undefined,
        return_date: form.return_date,
        return_reason: form.return_reason,
        currency: form.currency,
        notes: form.notes || undefined,
        lines,
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] })
      queryClient.invalidateQueries({ queryKey: ['vendor', 'purchase-returns'] })
      toast.success(`Purchase return ${(data as PurchaseReturn).return_number ?? ''} created successfully.`)
      handleClose()
    },
    onError: (err) => {
      // Our own thrown Error has a clean message — show it directly
      if (err instanceof Error && !('response' in err)) {
        toast.error(err.message, { duration: 8000 })
      } else {
        toast.error(extractApiError(err, 'Could not create purchase return'), { duration: 8000 })
      }
    },
  })

  function handleClose() {
    setSelectedPO(null)
    setPoSearch('')
    setLineEntries([])
    setLineErrors({})
    setForm({ return_date: new Date().toISOString().slice(0, 10), return_reason: 'quality_rejection', grn_id: '', currency: 'INR', notes: '' })
    onClose()
  }

  /** Validates selected lines; populates per-row errors and returns overall validity. */
  function validateAndSubmit() {
    const errors: LineErrors = {}
    const activeEntries = lineEntries.filter(e => e.include)

    if (activeEntries.length === 0) {
      toast.warning('No items selected. Tick the checkbox next to at least one item and enter a return quantity.')
      return
    }

    for (const entry of activeEntries) {
      // Check product linkage first — this is a hard blocker regardless of qty
      if (!entry.product_id) {
        errors[entry.po_item_id] =
          `Not linked to a catalogue product — deselect this item. Contact support to fix the PO if needed.`
        continue
      }

      const qty = parseFloat(entry.return_qty || '0')
      if (isNaN(qty) || qty <= 0) {
        errors[entry.po_item_id] = `Enter a return quantity greater than 0.`
      } else if (entry.received_qty > 0 && qty > entry.received_qty) {
        errors[entry.po_item_id] =
          `Return qty (${qty}) exceeds received qty (${entry.received_qty}). Reduce to ${entry.received_qty} or less.`
      }
    }

    setLineErrors(errors)

    if (Object.keys(errors).length > 0) {
      const first = Object.values(errors)[0]
      const count = Object.keys(errors).length
      toast.error(
        count === 1
          ? `Fix the highlighted row: ${first}`
          : `${count} rows have errors — fix the highlighted items before creating the return.`,
        { duration: 6000 },
      )
      return
    }

    create.mutate()
  }

  const activeLinesCount = lineEntries.filter(e => e.include && parseFloat(e.return_qty || '0') > 0).length

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose() }}>
      <DialogContent className="max-w-5xl flex flex-col max-h-[92vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Create Purchase Return</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">

        {!selectedPO ? (
          // Step 1: PO selection
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-500">Select the Purchase Order you want to return goods against.</p>
            <Input
              placeholder="Search by PO number…"
              value={poSearch}
              onChange={e => setPoSearch(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {eligiblePOs.map(po => (
                <button
                  key={po.id}
                  onClick={() => selectPO(po)}
                  className="w-full text-left p-3 border rounded-lg hover:bg-orange-50 hover:border-orange-200 transition-colors text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{po.po_number}</span>
                    <span className="text-xs text-gray-400 capitalize">{po.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{po.supplier_name} · {po.items?.length ?? 0} lines</p>
                </button>
              ))}
              {eligiblePOs.length === 0 && (
                <p className="text-center py-6 text-sm text-gray-400">No eligible POs found (must have received status)</p>
              )}
            </div>
          </div>
        ) : (() => {
          // ── Computed totals ──────────────────────────────────────
          const activeLines = lineEntries.filter(e => e.include)
          const returnSubtotal = activeLines.reduce((sum, e) => {
            const qty = parseFloat(e.return_qty || '0')
            return sum + qty * e.unit_price
          }, 0)
          const returnTax = activeLines.reduce((sum, e) => {
            const qty = parseFloat(e.return_qty || '0')
            const base = qty * e.unit_price
            const cgst = (parseFloat(e.cgst_rate) || 0) / 100
            const sgst = (parseFloat(e.sgst_rate) || 0) / 100
            const igst = (parseFloat(e.igst_rate) || 0) / 100
            return sum + base * (cgst + sgst + igst)
          }, 0)
          const returnTotal = returnSubtotal + returnTax

          return (
          // Step 2: Header + line selection
          <div className="space-y-4 py-2">

            {/* PO summary strip */}
            <div className="flex items-start justify-between p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm gap-4">
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1">
                <div>
                  <p className="text-[10px] text-orange-400 uppercase tracking-wide font-semibold">PO Number</p>
                  <p className="font-semibold text-orange-800">{selectedPO.po_number}</p>
                </div>
                <div>
                  <p className="text-[10px] text-orange-400 uppercase tracking-wide font-semibold">Supplier</p>
                  <p className="font-medium text-orange-700">{selectedPO.supplier_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-orange-400 uppercase tracking-wide font-semibold">Order Date</p>
                  <p className="text-orange-700">{selectedPO.order_date ? formatDate(selectedPO.order_date) : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-orange-400 uppercase tracking-wide font-semibold">PO Total</p>
                  <p className="font-semibold text-orange-800">{selectedPO.currency ?? form.currency} {Number(selectedPO.total ?? 0).toLocaleString()}</p>
                </div>
                {selectedPO.received_at && (
                  <div>
                    <p className="text-[10px] text-orange-400 uppercase tracking-wide font-semibold">Received On</p>
                    <p className="text-orange-700">{formatDate(selectedPO.received_at)}</p>
                  </div>
                )}
                {selectedPO.pr_number && (
                  <div>
                    <p className="text-[10px] text-orange-400 uppercase tracking-wide font-semibold">Source PR</p>
                    <p className="text-orange-700">{selectedPO.pr_number}</p>
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedPO(null)} className="text-xs text-orange-500 hover:underline shrink-0">Change PO</button>
            </div>

            {/* Header fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Return Date *</Label>
                <Input type="date" value={form.return_date} onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))} />
              </div>
              <div>
                <Label>Return Reason *</Label>
                <Select value={form.return_reason} onValueChange={v => setForm(f => ({ ...f, return_reason: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(RETURN_REASON_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
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
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>GRN Reference <span className="text-gray-400 font-normal">(optional — link to a specific Goods Receipt)</span></Label>
                <Input
                  value={form.grn_id}
                  onChange={e => setForm(f => ({ ...f, grn_id: e.target.value }))}
                  placeholder="Leave blank to return against the PO directly"
                />
              </div>
              <div>
                <Label>Internal Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={1} />
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Select Items to Return</h3>
                <span className="text-xs text-gray-400">{activeLinesCount} line{activeLinesCount !== 1 ? 's' : ''} selected</span>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="w-20 text-right">Ordered</TableHead>
                      <TableHead className="w-20 text-right">Received</TableHead>
                      <TableHead className="w-28">Return Qty *</TableHead>
                      <TableHead className="w-24">Unit Price</TableHead>
                      <TableHead className="w-16">CGST%</TableHead>
                      <TableHead className="w-16">SGST%</TableHead>
                      <TableHead className="w-16">IGST%</TableHead>
                      <TableHead className="w-28 text-right">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineEntries.map((entry, i) => {
                      const rowError = lineErrors[entry.po_item_id]
                      const hasError = !!rowError
                      const qty = parseFloat(entry.return_qty || '0')
                      const base = qty * entry.unit_price
                      const taxPct = (parseFloat(entry.cgst_rate) || 0) + (parseFloat(entry.sgst_rate) || 0) + (parseFloat(entry.igst_rate) || 0)
                      const lineTotal = base + base * (taxPct / 100)
                      return (
                        <TableRow
                          key={entry.po_item_id}
                          className={[
                            !entry.include ? 'opacity-40' : '',
                            hasError ? 'bg-red-50 border-l-4 border-l-red-400' : '',
                          ].join(' ')}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={entry.include}
                              onChange={e => updateLine(i, 'include', e.target.checked)}
                              disabled={entry.received_qty <= 0}
                              title={entry.received_qty <= 0 ? 'Cannot return — quantity not yet received' : ''}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{entry.product_name}</div>
                            <div className="text-xs text-gray-400">{entry.unit_of_measure}</div>
                            {entry.received_qty <= 0 && (
                              <div className="text-[10px] text-gray-400 mt-0.5">Not received — cannot return</div>
                            )}
                            {hasError && (
                              <div className="flex items-start gap-1 mt-1 text-xs text-red-600 font-medium">
                                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                {rowError}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-right text-gray-500">
                            {entry.received_qty > 0 ? entry.received_qty.toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-right font-medium">
                            {entry.received_qty > 0
                              ? <span className="text-blue-600">{entry.received_qty.toLocaleString()}</span>
                              : <span className="text-gray-300">—</span>
                            }
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={entry.received_qty}
                              value={entry.return_qty}
                              onChange={e => updateLine(i, 'return_qty', e.target.value)}
                              disabled={!entry.include}
                              className={[
                                'h-7 text-sm',
                                hasError && qty > entry.received_qty ? 'border-red-400 focus-visible:ring-red-300' : '',
                              ].join(' ')}
                            />
                            {entry.include && entry.received_qty > 0 && (
                              <p className="text-[10px] text-gray-400 mt-0.5">Max: {entry.received_qty}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={entry.unit_price}
                              onChange={e => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)}
                              disabled={!entry.include}
                              className="h-7 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={entry.cgst_rate}
                              onChange={e => updateLine(i, 'cgst_rate', e.target.value)}
                              disabled={!entry.include}
                              className="h-7 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={entry.sgst_rate}
                              onChange={e => updateLine(i, 'sgst_rate', e.target.value)}
                              disabled={!entry.include}
                              className="h-7 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={entry.igst_rate}
                              onChange={e => updateLine(i, 'igst_rate', e.target.value)}
                              disabled={!entry.include}
                              className="h-7 text-sm"
                            />
                          </TableCell>
                          <TableCell className="text-sm text-right font-medium tabular-nums">
                            {entry.include && qty > 0
                              ? <span className="text-gray-800">{form.currency} {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              : <span className="text-gray-300">—</span>
                            }
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {lineEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-4 text-sm text-gray-400">No PO lines found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Totals summary */}
              {activeLinesCount > 0 && (
                <div className="mt-3 ml-auto w-fit min-w-[260px] rounded-lg border bg-gray-50 p-3 text-sm space-y-1.5">
                  <div className="flex justify-between gap-8 text-gray-600">
                    <span>Subtotal</span>
                    <span className="tabular-nums font-medium">{form.currency} {returnSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between gap-8 text-gray-500">
                    <span>Tax</span>
                    <span className="tabular-nums">{form.currency} {returnTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between gap-8 font-semibold text-gray-900 border-t pt-1.5">
                    <span>Return Total</span>
                    <span className="tabular-nums">{form.currency} {returnTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              {activeLinesCount === 0 && lineEntries.length > 0 && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Tick the checkbox next to an item and enter a return quantity above 0.
                </p>
              )}
            </div>
          </div>
          )
        })()}

        </div>
        <div className="px-6 py-4 border-t bg-white shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {selectedPO && (
            <Button onClick={validateAndSubmit} disabled={create.isPending}>
              {create.isPending ? 'Creating…' : `Create Return (${activeLinesCount} line${activeLinesCount !== 1 ? 's' : ''})`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────
// Return Detail
// ─────────────────────────────────────────────────────────────────

function ReturnDetail({ returnId, onBack }: { returnId: string; onBack: () => void }) {
  const queryClient = useQueryClient()
  const [showDispatchDialog, setShowDispatchDialog] = useState(false)
  const [dispatch, setDispatch] = useState({ dispatched_via: '', dispatch_date: new Date().toISOString().slice(0, 10), tracking_number: '' })

  const { data: ret, isLoading } = useQuery({
    queryKey: ['purchase-return', returnId],
    queryFn: () => vendorApi.getPurchaseReturn(returnId) as Promise<PurchaseReturn>,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['purchase-return', returnId] })
    queryClient.invalidateQueries({ queryKey: ['purchase-returns'] })
  }

  const approveMut = useMutation({
    mutationFn: () => vendorApi.approvePurchaseReturn(returnId),
    onSuccess: () => { invalidate(); toast.success('Purchase return approved.') },
    onError: (err) => toast.error(extractApiError(err, 'Could not approve return')),
  })
  const dispatchMut = useMutation({
    mutationFn: () => vendorApi.dispatchPurchaseReturn(returnId, {
      dispatched_via: dispatch.dispatched_via || undefined,
      dispatch_date: dispatch.dispatch_date || undefined,
      tracking_number: dispatch.tracking_number || undefined,
    }),
    onSuccess: () => {
      invalidate()
      setShowDispatchDialog(false)
      toast.success('Goods marked as dispatched to supplier.')
    },
    onError: (err) => toast.error(extractApiError(err, 'Could not mark goods dispatched')),
  })
  const confirmMut = useMutation({
    mutationFn: () => vendorApi.confirmPurchaseReturn(returnId),
    onSuccess: () => { invalidate(); toast.success('Supplier confirmation recorded.') },
    onError: (err) => toast.error(extractApiError(err, 'Could not confirm return')),
  })
  const closeMut = useMutation({
    mutationFn: () => vendorApi.closePurchaseReturn(returnId),
    onSuccess: () => { invalidate(); toast.success('Purchase return closed.') },
    onError: (err) => toast.error(extractApiError(err, 'Could not close return')),
  })
  const cancelMut = useMutation({
    mutationFn: () => vendorApi.cancelPurchaseReturn(returnId),
    onSuccess: () => { invalidate(); toast.warning('Purchase return cancelled.') },
    onError: (err) => toast.error(extractApiError(err, 'Could not cancel return')),
  })

  if (isLoading || !ret) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>

  const lines = ret.lines ?? []

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500">← Back</Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">{ret.return_number}</h2>
            <StatusBadge status={ret.status} map={RETURN_STATUS} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {RETURN_REASON_LABELS[ret.return_reason] ?? ret.return_reason}
            {ret.return_date ? ` · ${formatDate(ret.return_date)}` : ''}
            {ret.supplier_name ? ` · ${ret.supplier_name}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {ret.status === 'draft' && (
            <>
              <Button size="sm" onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />{approveMut.isPending ? 'Approving…' : 'Approve'}
              </Button>
              <Button size="sm" variant="outline" className="text-red-500 border-red-200" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
                Cancel
              </Button>
            </>
          )}
          {ret.status === 'approved' && (
            <Button size="sm" onClick={() => setShowDispatchDialog(true)}>
              <Truck className="w-3.5 h-3.5 mr-1.5" />Mark Dispatched
            </Button>
          )}
          {ret.status === 'goods_dispatched' && (
            <Button size="sm" variant="outline" onClick={() => confirmMut.mutate()} disabled={confirmMut.isPending}>
              {confirmMut.isPending ? 'Confirming…' : 'Supplier Confirmed'}
            </Button>
          )}
          {ret.status === 'supplier_confirmed' && (
            <Button size="sm" variant="outline" onClick={() => closeMut.mutate()} disabled={closeMut.isPending}>
              {closeMut.isPending ? 'Closing…' : 'Close Return'}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => printReturn(ret)}>
            <Printer className="w-3.5 h-3.5 mr-1.5" />Print Return
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadReturnPdf(ret)}>
            <Download className="w-3.5 h-3.5 mr-1.5 text-red-500" />Return PDF
          </Button>
          {['closed', 'supplier_confirmed'].includes(ret.status) && (
            <>
              <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => printDebitNote(ret)}>
                <Printer className="w-3.5 h-3.5 mr-1.5" />Debit Note
              </Button>
              <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => downloadDebitNotePdf(ret)}>
                <Download className="w-3.5 h-3.5 mr-1.5" />DN PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
        <Card className="p-3">
          <p className="text-xs text-gray-500">Currency</p>
          <p className="font-medium">{ret.currency}</p>
        </Card>
        {ret.debit_note_reference && (
          <Card className="p-3">
            <p className="text-xs text-gray-500">Debit Note Ref</p>
            <p className="font-medium">{ret.debit_note_reference}</p>
          </Card>
        )}
        {ret.tracking_number && (
          <Card className="p-3">
            <p className="text-xs text-gray-500">Tracking</p>
            <p className="font-medium">{ret.tracking_number}</p>
          </Card>
        )}
      </div>

      <Tabs defaultValue="lines">
        <TabsList className="mb-4">
          <TabsTrigger value="lines">Return Lines ({lines.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="lines">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Return Qty</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map(line => (
                <TableRow key={line.id}>
                  <TableCell className="text-sm text-gray-500">{line.line_number}</TableCell>
                  <TableCell className="text-sm font-medium">{line.product_name ?? line.description ?? '—'}</TableCell>
                  <TableCell className="text-sm text-right font-medium text-orange-600">{Number(line.return_qty ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-gray-500">{line.unit_of_measure ?? '—'}</TableCell>
                  <TableCell className="text-sm text-right">{ret.currency} {Number(line.unit_price ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-right text-gray-500">{ret.currency} {Number(line.tax_amount ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-right font-semibold">{ret.currency} {Number(line.total ?? 0).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {lines.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-sm text-gray-400">No lines</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-2">
            {[...(ret.audit_log ?? [])].reverse().map((entry, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b text-sm">
                <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="capitalize font-medium text-gray-700">{entry.action}</span>
                <span className="text-gray-400">{String(entry.at ?? '').slice(0, 10)}</span>
              </div>
            ))}
            {!ret.audit_log?.length && <p className="text-sm text-gray-400 py-4 text-center">No history yet</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dispatch Dialog */}
      <Dialog open={showDispatchDialog} onOpenChange={setShowDispatchDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark Goods Dispatched</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Dispatched Via</Label><Input value={dispatch.dispatched_via} onChange={e => setDispatch(d => ({ ...d, dispatched_via: e.target.value }))} placeholder="Courier, vehicle, etc." /></div>
            <div><Label>Dispatch Date</Label><Input type="date" value={dispatch.dispatch_date} onChange={e => setDispatch(d => ({ ...d, dispatch_date: e.target.value }))} /></div>
            <div><Label>Tracking Number</Label><Input value={dispatch.tracking_number} onChange={e => setDispatch(d => ({ ...d, tracking_number: e.target.value }))} placeholder="Optional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDispatchDialog(false)}>Cancel</Button>
            <Button onClick={() => dispatchMut.mutate()} disabled={dispatchMut.isPending}>
              {dispatchMut.isPending ? 'Saving…' : 'Confirm Dispatch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────

export default function PurchaseReturnsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['purchase-returns'],
    queryFn: () => vendorApi.listPurchaseReturns({ size: 50 }),
  })

  // Backend may return either a bare array or a paginated `{ items }` payload.
  const returns = (
    Array.isArray(data) ? data : (data?.items ?? [])
  ) as PurchaseReturn[]

  const filtered = returns.filter(r => {
    const matchesSearch = !search ||
      (r.return_number ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (selectedReturnId) {
    return (
      <div className="flex h-[calc(100vh-64px)]">
        <ReturnDetail returnId={selectedReturnId} onBack={() => setSelectedReturnId(null)} />
      </div>
    )
  }

  const stats = {
    pending: returns.filter(r => r.status === 'draft' || r.status === 'approved').length,
    dispatched: returns.filter(r => r.status === 'goods_dispatched').length,
    closed: returns.filter(r => r.status === 'closed').length,
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Returns</h1>
          <p className="text-sm text-gray-500 mt-1">Manage returns of goods back to suppliers</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1.5" />New Return
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-8 h-8 text-orange-500 bg-orange-50 rounded-lg p-1.5" />
            <div>
              <p className="text-xs text-gray-500">Pending Returns</p>
              <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Truck className="w-8 h-8 text-blue-500 bg-blue-50 rounded-lg p-1.5" />
            <div>
              <p className="text-xs text-gray-500">Dispatched</p>
              <p className="text-2xl font-bold text-gray-800">{stats.dispatched}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-500 bg-green-50 rounded-lg p-1.5" />
            <div>
              <p className="text-xs text-gray-500">Closed</p>
              <p className="text-2xl font-bold text-gray-800">{stats.closed}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Search return number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="goods_dispatched">Dispatched</SelectItem>
            <SelectItem value="supplier_confirmed">Confirmed</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-sm text-gray-400">Loading…</p>
      ) : isError ? (
        <div className="text-center py-12 text-gray-500 space-y-3">
          <AlertCircle className="w-10 h-10 mx-auto text-red-400" />
          <p className="text-sm">Could not load purchase returns.</p>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            {(error as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
              ?? (error as Error)?.message
              ?? 'Unknown error'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ret => (
            <button
              key={ret.id}
              onClick={() => setSelectedReturnId(ret.id)}
              className="w-full text-left p-4 border rounded-lg hover:bg-gray-50 hover:border-orange-200 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <RotateCcw className="w-5 h-5 text-orange-400 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{ret.return_number}</span>
                    <StatusBadge status={ret.status} map={RETURN_STATUS} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {RETURN_REASON_LABELS[ret.return_reason] ?? ret.return_reason}
                    {ret.return_date ? ` · ${formatDate(ret.return_date)}` : ''}
                    {ret.supplier_name ? ` · ${ret.supplier_name}` : ''}
                    {ret.lines?.length ? ` · ${ret.lines.length} lines` : ''}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No purchase returns found.</p>
            </div>
          )}
        </div>
      )}

      <CreateReturnDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
