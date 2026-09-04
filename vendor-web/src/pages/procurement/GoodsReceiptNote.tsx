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
import type { PurchaseOrder, PurchaseOrderItem, GoodsReceiptNote, GRNLine } from '@/types'
import {
  PackageCheck, Plus, ChevronRight, ClipboardCheck, CheckCircle2,
  Clock, Truck, RotateCcw, AlertCircle, Printer, Download,
} from 'lucide-react'
import { printGRN, downloadGRNPdf } from '@/lib/procurementPrintUtils'

// ─────────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────────

const GRN_STATUS: Record<string, { label: string; cls: string }> = {
  draft:              { label: 'Draft',       cls: 'bg-gray-100 text-gray-700' },
  posted:             { label: 'Posted',      cls: 'bg-blue-100 text-blue-700' },
  qc_pending:         { label: 'QC Pending',  cls: 'bg-orange-100 text-orange-700' },
  qc_done:            { label: 'QC Done',     cls: 'bg-yellow-100 text-yellow-700' },
  closed:             { label: 'Closed',      cls: 'bg-green-100 text-green-700' },
  partially_reversed: { label: 'Partial Rev.',cls: 'bg-orange-100 text-orange-700' },
  reversed:           { label: 'Reversed',    cls: 'bg-red-100 text-red-700' },
}

const QC_STATUS: Record<string, { label: string; cls: string }> = {
  not_required: { label: 'N/A',         cls: 'bg-gray-50 text-gray-400' },
  pending:      { label: 'Pending',     cls: 'bg-gray-100 text-gray-600' },
  passed:       { label: 'Passed',      cls: 'bg-green-100 text-green-700' },
  failed:       { label: 'Failed',      cls: 'bg-red-100 text-red-700' },
  partial_pass: { label: 'Partial',     cls: 'bg-yellow-100 text-yellow-700' },
  hold:         { label: 'Hold',        cls: 'bg-orange-100 text-orange-700' },
}

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; cls: string }> }) {
  const cfg = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
}

// ─────────────────────────────────────────────────────────────────
// GRN line row used in the create form
// ─────────────────────────────────────────────────────────────────
interface GRNLineEntry {
  po_item_id: string
  product_id: string
  product_name: string
  ordered_qty: number
  remaining_qty: number
  unit_of_measure: string
  unit_price: number
  received_qty: string
  batch_number: string
  expiry_date: string
  notes: string
  include: boolean
}

// ─────────────────────────────────────────────────────────────────
// Create GRN Dialog — PO-driven line entry
// ─────────────────────────────────────────────────────────────────

function CreateGRNDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [poSearch, setPoSearch] = useState('')
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [header, setHeader] = useState({
    posting_date: new Date().toISOString().slice(0, 10),
    supplier_delivery_number: '',
    supplier_invoice_reference: '',
    requires_qc: false,
    notes: '',
  })
  const [lineEntries, setLineEntries] = useState<GRNLineEntry[]>([])

  // Load POs eligible for GRN (draft, sent, partial_received)
  const { data: poData } = useQuery({
    queryKey: ['grn-po-picker', poSearch],
    queryFn: () => vendorApi.listPurchaseOrders({ status: 'sent,draft,partial_received', size: 20, search: poSearch || undefined }),
    enabled: open && !selectedPO,
  })
  const eligiblePOs = (poData?.items ?? []) as PurchaseOrder[]

  function selectPO(po: PurchaseOrder) {
    setSelectedPO(po)
    const entries: GRNLineEntry[] = (po.items ?? []).map((item: PurchaseOrderItem) => {
      const ordered = item.quantity_ordered ?? item.quantity ?? 0
      const remaining = ordered - (item.quantity_received ?? 0)
      return {
        po_item_id: item.id,
        product_id: item.product_id ?? '',
        product_name: item.product_name ?? item.description ?? item.notes ?? 'Item',
        ordered_qty: ordered,
        remaining_qty: Math.max(0, remaining),
        unit_of_measure: item.unit_of_measure ?? 'piece',
        unit_price: item.unit_cost ?? 0,
        received_qty: String(Math.max(0, remaining)),
        batch_number: '',
        expiry_date: '',
        notes: '',
        include: remaining > 0,
      }
    })
    setLineEntries(entries)
  }

  function updateLine(index: number, field: keyof GRNLineEntry, value: string | boolean) {
    setLineEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e))
  }

  const create = useMutation({
    mutationFn: () => {
      if (!selectedPO) throw new Error('No PO selected')
      const lines = lineEntries
        .filter(e => e.include && parseFloat(e.received_qty) > 0)
        .map(e => ({
          po_item_id: e.po_item_id,
          product_id: e.product_id,
          received_qty: parseFloat(e.received_qty),
          unit_of_measure: e.unit_of_measure,
          unit_price: e.unit_price || undefined,
          batch_number: e.batch_number || undefined,
          expiry_date: e.expiry_date || undefined,
          notes: e.notes || undefined,
        }))
      return vendorApi.createGRN({
        purchase_order_id: selectedPO.id,
        posting_date: header.posting_date || undefined,
        supplier_delivery_number: header.supplier_delivery_number || undefined,
        supplier_invoice_reference: header.supplier_invoice_reference || undefined,
        requires_qc: header.requires_qc,
        notes: header.notes || undefined,
        lines,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grns'] })
      queryClient.invalidateQueries({ queryKey: ['vendor', 'grns'] })
      handleClose()
    },
  })

  function handleClose() {
    setSelectedPO(null)
    setPoSearch('')
    setLineEntries([])
    setHeader({ posting_date: new Date().toISOString().slice(0, 10), supplier_delivery_number: '', supplier_invoice_reference: '', requires_qc: false, notes: '' })
    onClose()
  }

  const activeLinesCount = lineEntries.filter(e => e.include && parseFloat(e.received_qty || '0') > 0).length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Goods Receipt Note</DialogTitle>
        </DialogHeader>

        {!selectedPO ? (
          // Step 1: PO selection
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-500">Select a Purchase Order to receive against.</p>
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
                  className="w-full text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{po.po_number}</span>
                    <span className="text-xs text-gray-400 capitalize">{po.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{po.supplier_name} · {po.items?.length ?? 0} lines</p>
                </button>
              ))}
              {eligiblePOs.length === 0 && (
                <p className="text-center py-6 text-sm text-gray-400">No eligible POs found (must be in draft, sent, or partial received status)</p>
              )}
            </div>
          </div>
        ) : (
          // Step 2: Header + line entry
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg text-sm">
              <div>
                <span className="font-medium text-blue-800">{selectedPO.po_number}</span>
                <span className="text-blue-600 ml-2">— {selectedPO.supplier_name}</span>
              </div>
              <button onClick={() => setSelectedPO(null)} className="text-xs text-blue-500 hover:underline">Change PO</button>
            </div>

            {/* Header fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Posting Date *</Label>
                <Input type="date" value={header.posting_date} onChange={e => setHeader(h => ({ ...h, posting_date: e.target.value }))} />
              </div>
              <div>
                <Label>Supplier Delivery Note #</Label>
                <Input value={header.supplier_delivery_number} onChange={e => setHeader(h => ({ ...h, supplier_delivery_number: e.target.value }))} placeholder="DN-001" />
              </div>
              <div>
                <Label>Supplier Invoice Reference</Label>
                <Input value={header.supplier_invoice_reference} onChange={e => setHeader(h => ({ ...h, supplier_invoice_reference: e.target.value }))} placeholder="INV-XXXX" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={header.requires_qc} onChange={e => setHeader(h => ({ ...h, requires_qc: e.target.checked }))} />
                  Requires QC Inspection
                </label>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} rows={2} />
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Receipt Lines</h3>
                <span className="text-xs text-gray-400">{activeLinesCount} of {lineEntries.length} lines included</span>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="w-24 text-right">Ordered</TableHead>
                      <TableHead className="w-24 text-right">Remaining</TableHead>
                      <TableHead className="w-28">Receive Qty *</TableHead>
                      <TableHead className="w-32">Batch #</TableHead>
                      <TableHead className="w-32">Expiry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineEntries.map((entry, i) => (
                      <TableRow key={entry.po_item_id} className={!entry.include ? 'opacity-40' : ''}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={entry.include}
                            onChange={e => updateLine(i, 'include', e.target.checked)}
                          />
                        </TableCell>
                        <TableCell className="text-sm font-medium">{entry.product_name}</TableCell>
                        <TableCell className="text-sm text-right text-gray-500">{entry.ordered_qty.toLocaleString()} {entry.unit_of_measure}</TableCell>
                        <TableCell className="text-sm text-right font-medium">
                          {entry.remaining_qty > 0
                            ? <span className="text-blue-600">{entry.remaining_qty.toLocaleString()}</span>
                            : <span className="text-green-600">Fully received</span>
                          }
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={entry.remaining_qty}
                            value={entry.received_qty}
                            onChange={e => updateLine(i, 'received_qty', e.target.value)}
                            disabled={!entry.include}
                            className="h-7 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={entry.batch_number}
                            onChange={e => updateLine(i, 'batch_number', e.target.value)}
                            disabled={!entry.include}
                            placeholder="Batch #"
                            className="h-7 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={entry.expiry_date}
                            onChange={e => updateLine(i, 'expiry_date', e.target.value)}
                            disabled={!entry.include}
                            className="h-7 text-sm"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {lineEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4 text-sm text-gray-400">No PO lines found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {activeLinesCount === 0 && lineEntries.length > 0 && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Check at least one line with a quantity to receive.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {selectedPO && (
            <Button
              onClick={() => create.mutate()}
              disabled={activeLinesCount === 0 || create.isPending}
            >
              {create.isPending ? 'Creating…' : `Create GRN (${activeLinesCount} line${activeLinesCount !== 1 ? 's' : ''})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────
// QC Dialog
// ─────────────────────────────────────────────────────────────────

function QCDialog({
  open, onClose, grnId, line,
}: {
  open: boolean
  onClose: () => void
  grnId: string
  line: GRNLine
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    result: 'passed',
    accepted_qty: String(line.received_qty ?? 0),
    rejected_qty: '0',
    defect_code: '',
    defect_description: '',
    notes: '',
  })

  const record = useMutation({
    mutationFn: () =>
      vendorApi.recordGRNQC(grnId, line.id, {
        result: form.result,
        accepted_qty: parseFloat(form.accepted_qty) || 0,
        rejected_qty: parseFloat(form.rejected_qty) || 0,
        defect_code: form.defect_code || undefined,
        defect_description: form.defect_description || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn', grnId] })
      queryClient.invalidateQueries({ queryKey: ['vendor', 'grn', grnId] })
      onClose()
    },
  })

  const totalQty = (parseFloat(form.accepted_qty) || 0) + (parseFloat(form.rejected_qty) || 0)
  const qtyMismatch = totalQty > (line.received_qty ?? 0)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>QC Inspection — Line {line.line_number}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <p className="text-gray-600 font-medium">{line.product_name ?? line.description ?? 'Item'}</p>
          <p className="text-gray-500">Received: <span className="font-medium">{Number(line.received_qty).toLocaleString()} {line.unit_of_measure}</span></p>
          <div>
            <Label>QC Result *</Label>
            <Select value={form.result} onValueChange={v => setForm(f => ({ ...f, result: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="partial_pass">Partial Pass</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="hold">Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Accepted Qty</Label>
              <Input
                type="number"
                min={0}
                value={form.accepted_qty}
                onChange={e => setForm(f => ({ ...f, accepted_qty: e.target.value }))}
                className={qtyMismatch ? 'border-red-300' : ''}
              />
            </div>
            <div>
              <Label>Rejected Qty</Label>
              <Input
                type="number"
                min={0}
                value={form.rejected_qty}
                onChange={e => setForm(f => ({ ...f, rejected_qty: e.target.value }))}
                className={qtyMismatch ? 'border-red-300' : ''}
              />
            </div>
          </div>
          {qtyMismatch && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Accepted + Rejected ({totalQty}) exceeds received qty ({line.received_qty})
            </p>
          )}
          <div><Label>Defect Code</Label><Input value={form.defect_code} onChange={e => setForm(f => ({ ...f, defect_code: e.target.value }))} placeholder="Optional" /></div>
          <div><Label>Defect Description</Label><Input value={form.defect_description} onChange={e => setForm(f => ({ ...f, defect_description: e.target.value }))} placeholder="Optional" /></div>
          <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => record.mutate()} disabled={qtyMismatch || record.isPending}>
            {record.isPending ? 'Saving…' : 'Record QC'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────
// Reverse GRN Dialog
// ─────────────────────────────────────────────────────────────────

function ReverseGRNDialog({
  open, onClose, grnId, lines,
}: {
  open: boolean
  onClose: () => void
  grnId: string
  lines: GRNLine[]
}) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [reverseQtys, setReverseQtys] = useState<Record<string, string>>(
    Object.fromEntries(lines.map(l => [l.id, String(l.accepted_qty ?? l.received_qty ?? 0)]))
  )

  const reverse = useMutation({
    mutationFn: () => vendorApi.reverseGRN(grnId, {
      reversal_type: 'partial',
      reversal_date: new Date().toISOString().slice(0, 10),
      reason: reason || undefined,
      lines: lines
        .filter(l => parseFloat(reverseQtys[l.id] || '0') > 0)
        .map(l => ({
          grn_line_id: l.id,
          reversed_qty: parseFloat(reverseQtys[l.id] || '0'),
          reason: reason || undefined,
        })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn', grnId] })
      queryClient.invalidateQueries({ queryKey: ['grns'] })
      queryClient.invalidateQueries({ queryKey: ['vendor', 'grns'] })
      onClose()
    },
  })

  const activeLines = lines.filter(l => parseFloat(reverseQtys[l.id] || '0') > 0)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Reverse GRN</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Reversing a GRN will deduct the reversed quantities from inventory. This cannot be undone.
          </p>
          <div>
            <Label>Reversal Reason</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Reason for reversal…" />
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Item</TableHead>
                  <TableHead className="w-24 text-right">Accepted</TableHead>
                  <TableHead className="w-28">Reverse Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map(line => {
                  const maxReversible = line.accepted_qty ?? line.received_qty ?? 0
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="text-sm font-medium">{line.product_name ?? line.description ?? '—'}</TableCell>
                      <TableCell className="text-sm text-right text-gray-500">{Number(maxReversible).toLocaleString()}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={maxReversible}
                          value={reverseQtys[line.id] ?? '0'}
                          onChange={e => setReverseQtys(prev => ({ ...prev, [line.id]: e.target.value }))}
                          className="h-7 text-sm"
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => reverse.mutate()}
            disabled={activeLines.length === 0 || reverse.isPending}
          >
            {reverse.isPending ? 'Reversing…' : `Reverse (${activeLines.length} line${activeLines.length !== 1 ? 's' : ''})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────
// GRN Detail
// ─────────────────────────────────────────────────────────────────

function GRNDetail({ grnId, onBack }: { grnId: string; onBack: () => void }) {
  const queryClient = useQueryClient()
  const [qcLine, setQcLine] = useState<GRNLine | null>(null)
  const [showReverse, setShowReverse] = useState(false)

  const { data: grn, isLoading } = useQuery({
    queryKey: ['grn', grnId],
    queryFn: () => vendorApi.getGRN(grnId) as Promise<GoodsReceiptNote>,
  })

  const postMut = useMutation({
    mutationFn: () => vendorApi.postGRN(grnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn', grnId] })
      queryClient.invalidateQueries({ queryKey: ['grns'] })
    },
  })
  const closeQCMut = useMutation({
    mutationFn: () => vendorApi.closeGRNQC(grnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn', grnId] })
      queryClient.invalidateQueries({ queryKey: ['grns'] })
    },
  })
  const closeMut = useMutation({
    mutationFn: () => vendorApi.closeGRN(grnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn', grnId] })
      queryClient.invalidateQueries({ queryKey: ['grns'] })
    },
  })

  if (isLoading || !grn) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>

  const lines = (grn.lines ?? []) as GRNLine[]
  const allQCDone = lines.length > 0 && lines.every(l => l.qc_status && l.qc_status !== 'pending')
  const canReverse = grn.status === 'posted' || grn.status === 'qc_done' || grn.status === 'closed'

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500">← Back</Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">{grn.grn_number}</h2>
            <StatusBadge status={grn.status} map={GRN_STATUS} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {grn.posting_date ? formatDate(grn.posting_date) : '—'}
            {grn.po_number ? ` · PO: ${grn.po_number}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {grn.status === 'draft' && (
            <Button size="sm" onClick={() => postMut.mutate()} disabled={postMut.isPending}>
              <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />{postMut.isPending ? 'Posting…' : 'Post GRN'}
            </Button>
          )}
          {grn.status === 'qc_pending' && allQCDone && (
            <Button size="sm" variant="outline" onClick={() => closeQCMut.mutate()} disabled={closeQCMut.isPending}>
              {closeQCMut.isPending ? 'Saving…' : 'Close QC'}
            </Button>
          )}
          {grn.status === 'qc_done' && (
            <Button size="sm" variant="outline" onClick={() => closeMut.mutate()} disabled={closeMut.isPending}>
              {closeMut.isPending ? 'Closing…' : 'Close GRN'}
            </Button>
          )}
          {grn.status === 'posted' && (
            <Button size="sm" variant="outline" onClick={() => closeMut.mutate()} disabled={closeMut.isPending}>
              {closeMut.isPending ? 'Closing…' : 'Close GRN'}
            </Button>
          )}
          {canReverse && (
            <Button size="sm" variant="outline" className="text-red-500 border-red-200" onClick={() => setShowReverse(true)}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reverse
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => printGRN(grn)}>
            <Printer className="w-3.5 h-3.5 mr-1.5" />Print
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadGRNPdf(grn)}>
            <Download className="w-3.5 h-3.5 mr-1.5 text-red-500" />PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6 text-sm">
        {grn.supplier_delivery_number && (
          <Card className="p-3">
            <p className="text-xs text-gray-500">Delivery Note</p>
            <p className="font-medium">{grn.supplier_delivery_number}</p>
          </Card>
        )}
        {grn.supplier_invoice_reference && (
          <Card className="p-3">
            <p className="text-xs text-gray-500">Supplier Invoice Ref</p>
            <p className="font-medium">{grn.supplier_invoice_reference}</p>
          </Card>
        )}
        {grn.requires_qc && (
          <Card className="p-3 border-yellow-200 bg-yellow-50">
            <p className="text-xs text-yellow-700">QC Required</p>
          </Card>
        )}
        <Card className="p-3">
          <p className="text-xs text-gray-500">Total Received</p>
          <p className="font-medium">{Number(grn.total_received_qty ?? 0).toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-500">Total Accepted</p>
          <p className="font-medium text-green-600">{Number(grn.total_accepted_qty ?? 0).toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-500">Total Rejected</p>
          <p className="font-medium text-red-500">{Number(grn.total_rejected_qty ?? 0).toLocaleString()}</p>
        </Card>
      </div>

      <Tabs defaultValue="lines">
        <TabsList className="mb-4">
          <TabsTrigger value="lines">Receipt Lines ({lines.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="lines">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead>QC Status</TableHead>
                <TableHead className="text-right">Accepted</TableHead>
                <TableHead className="text-right">Rejected</TableHead>
                {(grn.status === 'qc_pending') && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map(line => (
                <TableRow key={line.id}>
                  <TableCell className="text-sm text-gray-500">{line.line_number}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{line.product_name ?? line.description ?? '—'}</div>
                    {line.batch_number && <div className="text-xs text-gray-400">Batch: {line.batch_number}</div>}
                  </TableCell>
                  <TableCell className="text-sm text-right text-gray-500">{line.ordered_qty != null ? Number(line.ordered_qty).toLocaleString() : '—'}</TableCell>
                  <TableCell className="text-sm text-right font-medium">{Number(line.received_qty ?? 0).toLocaleString()} {line.unit_of_measure}</TableCell>
                  <TableCell><StatusBadge status={line.qc_status ?? 'not_required'} map={QC_STATUS} /></TableCell>
                  <TableCell className="text-sm text-right text-green-600">{line.accepted_qty != null ? Number(line.accepted_qty).toLocaleString() : '—'}</TableCell>
                  <TableCell className="text-sm text-right text-red-500">{line.rejected_qty != null && Number(line.rejected_qty) > 0 ? Number(line.rejected_qty).toLocaleString() : '—'}</TableCell>
                  {grn.status === 'qc_pending' && (
                    <TableCell>
                      {(!line.qc_status || line.qc_status === 'pending') && (
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setQcLine(line)}>
                          <ClipboardCheck className="w-3 h-3 mr-1" />QC
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {lines.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-6 text-sm text-gray-400">No lines</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-2">
            {[...(grn.audit_log ?? [])].reverse().map((entry, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b text-sm">
                <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="capitalize font-medium text-gray-700">{entry.action}</span>
                <span className="text-gray-400">{String(entry.at ?? '').slice(0, 10)}</span>
              </div>
            ))}
            {!grn.audit_log?.length && <p className="text-sm text-gray-400 py-4 text-center">No history yet</p>}
          </div>
        </TabsContent>
      </Tabs>

      {qcLine && (
        <QCDialog
          open
          onClose={() => setQcLine(null)}
          grnId={grnId}
          line={qcLine}
        />
      )}

      {showReverse && lines.length > 0 && (
        <ReverseGRNDialog
          open
          onClose={() => setShowReverse(false)}
          grnId={grnId}
          lines={lines.filter(l => (l.accepted_qty ?? l.received_qty ?? 0) > 0)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────

export default function GoodsReceiptNotePage() {
  const [showCreate, setShowCreate] = useState(false)
  const [selectedGRNId, setSelectedGRNId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['grns'],
    queryFn: () => vendorApi.listGRNs({ size: 50 }),
  })

  const grns = (data?.items ?? []) as GoodsReceiptNote[]

  const filtered = grns.filter(g => {
    const matchesSearch = !search || g.grn_number.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || g.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (selectedGRNId) {
    return (
      <div className="flex h-[calc(100vh-64px)]">
        <GRNDetail grnId={selectedGRNId} onBack={() => setSelectedGRNId(null)} />
      </div>
    )
  }

  const stats = {
    pending: grns.filter(g => g.status === 'draft' || g.status === 'posted').length,
    qcPending: grns.filter(g => g.status === 'qc_pending').length,
    closed: grns.filter(g => g.status === 'closed').length,
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goods Receipt Notes</h1>
          <p className="text-sm text-gray-500 mt-1">Record and track goods received from suppliers</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1.5" />New GRN
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <PackageCheck className="w-8 h-8 text-blue-500 bg-blue-50 rounded-lg p-1.5" />
            <div>
              <p className="text-xs text-gray-500">Pending GRNs</p>
              <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-yellow-500 bg-yellow-50 rounded-lg p-1.5" />
            <div>
              <p className="text-xs text-gray-500">Under QC</p>
              <p className="text-2xl font-bold text-gray-800">{stats.qcPending}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-500 bg-green-50 rounded-lg p-1.5" />
            <div>
              <p className="text-xs text-gray-500">Closed GRNs</p>
              <p className="text-2xl font-bold text-gray-800">{stats.closed}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Search GRN number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="qc_pending">QC Pending</SelectItem>
            <SelectItem value="qc_done">QC Done</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="reversed">Reversed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(grn => (
            <button
              key={grn.id}
              onClick={() => setSelectedGRNId(grn.id)}
              className="w-full text-left p-4 border rounded-lg hover:bg-gray-50 hover:border-blue-200 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <Truck className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{grn.grn_number}</span>
                    <StatusBadge status={grn.status} map={GRN_STATUS} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {grn.posting_date ? formatDate(grn.posting_date) : '—'}
                    {grn.supplier_delivery_number ? ` · DN: ${grn.supplier_delivery_number}` : ''}
                    {grn.po_number ? ` · PO: ${grn.po_number}` : ''}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <PackageCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No GRNs found. Create one when goods arrive.</p>
            </div>
          )}
        </div>
      )}

      <CreateGRNDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
