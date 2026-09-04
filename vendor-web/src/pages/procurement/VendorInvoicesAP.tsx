import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { onClickableTableRow } from '@/lib/clickableTableRow'

import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import {
  useVendorInvoices, useCreateVendorInvoice, usePostVendorInvoice,
  useMatchVendorInvoice, useCancelVendorInvoice, usePurchaseOrders, useRecordInvoicePayment,
  useRequestInvoiceApproval, useApproveOrRejectInvoice,
} from '@/hooks/useVendor'
import { ProcurementApproverFields } from '@/components/procurement/ProcurementApproverFields'
import { ProcurementSupplierField } from '@/components/procurement/ProcurementSupplierField'
import { formatDate, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import type { VendorInvoice } from '@/types'
import { Loader2, Plus, X, FileText, CheckCircle2, Ban, ArrowRight, Banknote, Printer, Download, CreditCard, Send, ThumbsUp, ThumbsDown, Clock } from 'lucide-react'
import { printInvoice, downloadInvoicePdf } from '@/lib/procurementPrintUtils'

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  draft:         { bg: 'bg-gray-100 dark:bg-gray-800',      text: 'text-gray-700 dark:text-gray-300',    label: 'Draft' },
  posted:        { bg: 'bg-blue-50 dark:bg-blue-950/50',    text: 'text-blue-700 dark:text-blue-300',    label: 'Posted' },
  matched:       { bg: 'bg-green-50 dark:bg-green-950/50',  text: 'text-green-700 dark:text-green-300',  label: 'Matched' },
  partial_match: { bg: 'bg-amber-50 dark:bg-amber-950/50',  text: 'text-amber-700 dark:text-amber-300',  label: 'Partial Match' },
  blocked:       { bg: 'bg-red-50 dark:bg-red-950/50',      text: 'text-red-700 dark:text-red-300',      label: 'Blocked' },
  paid:          { bg: 'bg-purple-50 dark:bg-purple-950/50',text: 'text-purple-700 dark:text-purple-300',label: 'Paid' },
  cancelled:     { bg: 'bg-red-50 dark:bg-red-950/50',      text: 'text-red-700 dark:text-red-300',      label: 'Cancelled' },
}

const MATCH_BADGE: Record<string, string> = {
  unmatched:     'bg-gray-100 text-gray-500',
  matched:       'bg-green-100 text-green-700',
  partial:       'bg-amber-100 text-amber-700',
  blocked_qty:   'bg-red-100 text-red-700',
  blocked_price: 'bg-red-100 text-red-700',
}

const STATUSES = ['', 'draft', 'posted', 'matched', 'partial_match', 'blocked', 'paid', 'cancelled']

const APPROVAL_BADGE: Record<string, { bg: string; text: string; label: string; icon?: string }> = {
  not_required: { bg: 'bg-gray-100 dark:bg-gray-800',     text: 'text-gray-500',                   label: 'No Approval' },
  pending:      { bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-400', label: 'Pending Approval' },
  approved:     { bg: 'bg-green-50 dark:bg-green-950/50', text: 'text-green-700 dark:text-green-400', label: 'Approved' },
  rejected:     { bg: 'bg-red-50 dark:bg-red-950/50',     text: 'text-red-700 dark:text-red-400',    label: 'Rejected' },
}

interface LineRow { description: string; qty: number; uom: string; unit_price: number; cgst_rate: number; sgst_rate: number; igst_rate: number }
function emptyLine(): LineRow { return { description: '', qty: 1, uom: 'PCS', unit_price: 0, cgst_rate: 0, sgst_rate: 0, igst_rate: 0 } }

function calcLineTotal(l: LineRow) {
  const base = l.qty * l.unit_price
  return base + (base * (l.cgst_rate + l.sgst_rate + l.igst_rate) / 100)
}

// ── Detail Panel ──────────────────────────────────────────────────
function InvoiceDetailPanel({ invoice, onClose }: { invoice: VendorInvoice; onClose: () => void }) {
  const navigate = useNavigate()
  const post = usePostVendorInvoice()
  const match = useMatchVendorInvoice()
  const cancel = useCancelVendorInvoice()
  const recordPayment = useRecordInvoicePayment()
  const requestApproval = useRequestInvoiceApproval()
  const approveReject = useApproveOrRejectInvoice()

  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: String(invoice.total - (invoice.amount_paid ?? 0)),
    payment_date: new Date().toISOString().slice(0, 10),
    payment_reference: '',
    payment_mode: 'bank_transfer',
  })
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalForm, setApprovalForm] = useState({
    primaryApproverId: '',
    secondaryApproverId: '',
    approverMessage: invoice.approver_message ?? '',
  })
  const [rejectComments, setRejectComments] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  const badge = STATUS_BADGE[invoice.status] ?? STATUS_BADGE.draft
  const matchBadge = MATCH_BADGE[invoice.match_status] || 'bg-gray-100 text-gray-500'
  const approvalBadge = APPROVAL_BADGE[(invoice as unknown as Record<string, unknown>).approval_status as string ?? 'not_required'] ?? APPROVAL_BADGE.not_required
  const approvalStatus = (invoice as unknown as Record<string, unknown>).approval_status as string ?? 'not_required'

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-2xl h-full bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-mono">{invoice.invoice_number}</p>
            <h2 className="text-lg font-semibold">{invoice.supplier_name || 'Vendor Invoice'}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${matchBadge}`}>{invoice.match_status.replace(/_/g, ' ')}</span>
            {approvalStatus !== 'not_required' && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${approvalBadge.bg} ${approvalBadge.text}`}>{approvalBadge.label}</span>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><p className="text-gray-500">Invoice Date</p><p className="font-medium">{formatDate(invoice.invoice_date)}</p></div>
            <div><p className="text-gray-500">Due Date</p><p className="font-medium">{invoice.due_date ? formatDate(invoice.due_date) : '—'}</p></div>
            <div>
              <p className="text-gray-500">PO Reference</p>
              {invoice.purchase_order_id && invoice.po_number ? (
                <button
                  className="font-medium text-blue-600 hover:underline text-left"
                  onClick={() => { onClose(); navigate(`/purchase-orders/${invoice.purchase_order_id}`) }}
                >
                  {invoice.po_number}
                </button>
              ) : (
                <p className="font-medium text-gray-400">—</p>
              )}
            </div>
            <div><p className="text-gray-500">Currency</p><p className="font-medium">{invoice.currency}</p></div>
            <div><p className="text-gray-500">Amount Paid</p><p className="font-medium text-green-600">{formatCurrency(invoice.amount_paid)}</p></div>
            <div><p className="text-gray-500">Total</p><p className="font-bold text-lg">{formatCurrency(invoice.total)}</p></div>
            {invoice.pr_number && invoice.requisition_id && (
              <div className="col-span-3">
                <p className="text-gray-500">Purchase Requisition</p>
                <button
                  className="font-medium text-indigo-600 hover:underline text-left text-sm"
                  onClick={() => { onClose(); navigate(`/procurement/requisitions?pr=${invoice.requisition_id}`) }}
                >
                  {invoice.pr_number}
                </button>
              </div>
            )}
          </div>

          {/* Tax summary */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 grid grid-cols-4 gap-3 text-sm">
            <div><p className="text-gray-500 text-xs">Subtotal</p><p className="font-medium">{formatCurrency(invoice.subtotal)}</p></div>
            <div><p className="text-gray-500 text-xs">CGST</p><p className="font-medium">{formatCurrency(invoice.cgst_amount)}</p></div>
            <div><p className="text-gray-500 text-xs">SGST</p><p className="font-medium">{formatCurrency(invoice.sgst_amount)}</p></div>
            <div><p className="text-gray-500 text-xs">IGST</p><p className="font-medium">{formatCurrency(invoice.igst_amount)}</p></div>
          </div>

          {/* Line items */}
          <div>
            <h3 className="font-medium text-sm mb-2">Line Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {['#', 'Description', 'Qty', 'Unit Price', 'GST%', 'Total', 'Match'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map(item => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2 text-gray-400">{item.line_number}</td>
                      <td className="px-3 py-2 font-medium">{item.description}</td>
                      <td className="px-3 py-2">{item.invoiced_qty} {item.uom}</td>
                      <td className="px-3 py-2">{formatCurrency(item.unit_price)}</td>
                      <td className="px-3 py-2 text-gray-500">{item.cgst_rate + item.sgst_rate + item.igst_rate}%</td>
                      <td className="px-3 py-2 font-semibold">{formatCurrency(item.total)}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${MATCH_BADGE[item.match_status] || 'bg-gray-100 text-gray-500'}`}>
                          {item.match_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {/* Approval actions */}
            {invoice.status === 'draft' && approvalStatus === 'not_required' && (
              <Button variant="outline" size="sm" onClick={() => setShowApprovalDialog(true)} className="gap-2 text-amber-700 border-amber-300 hover:bg-amber-50">
                <Send className="w-4 h-4" /> Request Approval
              </Button>
            )}
            {invoice.status === 'draft' && approvalStatus === 'pending' && (
              <>
                <Button size="sm" onClick={() => approveReject.mutate({ id: invoice.id, action: 'approve' })} disabled={approveReject.isPending} className="gap-2 bg-green-600 hover:bg-green-700">
                  {approveReject.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <ThumbsUp className="w-4 h-4" /> Approve
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setShowRejectDialog(true)} className="gap-2">
                  <ThumbsDown className="w-4 h-4" /> Reject
                </Button>
              </>
            )}
            {approvalStatus === 'pending' && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5" /> Awaiting approval
              </span>
            )}

            {/* Standard lifecycle actions */}
            {invoice.status === 'draft' && (approvalStatus === 'not_required' || approvalStatus === 'approved') && (
              <Button onClick={() => post.mutate(invoice.id)} disabled={post.isPending} className="gap-2">
                {post.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <ArrowRight className="w-4 h-4" /> Post Invoice
              </Button>
            )}
            {invoice.status === 'posted' && (
              <Button onClick={() => match.mutate(invoice.id)} disabled={match.isPending} className="gap-2 bg-green-600 hover:bg-green-700">
                {match.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <CheckCircle2 className="w-4 h-4" /> Run 3-Way Match
              </Button>
            )}
            {!['cancelled', 'paid'].includes(invoice.status) && invoice.status !== 'draft' && (
              <Button variant="outline" size="sm" onClick={() => setShowPaymentDialog(true)} className="gap-2 text-green-700 border-green-300 hover:bg-green-50">
                <CreditCard className="w-4 h-4" /> Record Payment
              </Button>
            )}
            {!['cancelled', 'paid'].includes(invoice.status) && (
              <Button variant="destructive" size="sm" onClick={() => cancel.mutate(invoice.id)} disabled={cancel.isPending} className="gap-2">
                <Ban className="w-4 h-4" /> Cancel
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5 ml-auto" onClick={() => printInvoice(invoice as unknown as Record<string, unknown>)}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadInvoicePdf(invoice as unknown as Record<string, unknown>)}>
              <Download className="w-3.5 h-3.5 text-red-500" /> PDF
            </Button>
          </div>

          {/* Request Approval dialog */}
          {showApprovalDialog && (
            <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4" onClick={() => setShowApprovalDialog(false)}>
              <div className="bg-background rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Request Approval</h2>
                  <button onClick={() => setShowApprovalDialog(false)}><X className="w-4 h-4" /></button>
                </div>
                <p className="text-sm text-gray-500">Assign approver(s) and submit this invoice for approval before posting.</p>
                <ProcurementApproverFields
                  primaryApproverId={approvalForm.primaryApproverId}
                  secondaryApproverId={approvalForm.secondaryApproverId}
                  approverMessage={approvalForm.approverMessage}
                  onPrimaryChange={v => setApprovalForm(f => ({ ...f, primaryApproverId: v }))}
                  onSecondaryChange={v => setApprovalForm(f => ({ ...f, secondaryApproverId: v }))}
                  onMessageChange={v => setApprovalForm(f => ({ ...f, approverMessage: v }))}
                />
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      const ids = [approvalForm.primaryApproverId, approvalForm.secondaryApproverId].filter(Boolean)
                      requestApproval.mutate(
                        { id: invoice.id, approver_ids: ids, approver_message: approvalForm.approverMessage || undefined },
                        { onSuccess: () => setShowApprovalDialog(false) },
                      )
                    }}
                    disabled={requestApproval.isPending}
                    className="gap-2"
                  >
                    {requestApproval.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <Send className="w-4 h-4" /> Submit for Approval
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Reject dialog */}
          {showRejectDialog && (
            <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4" onClick={() => setShowRejectDialog(false)}>
              <div className="bg-background rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-red-600">Reject Invoice</h2>
                  <button onClick={() => setShowRejectDialog(false)}><X className="w-4 h-4" /></button>
                </div>
                <div>
                  <Label className="text-xs">Reason for rejection (optional)</Label>
                  <textarea
                    className="mt-1 w-full text-sm border rounded-md px-3 py-2 bg-background min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    value={rejectComments}
                    onChange={e => setRejectComments(e.target.value)}
                    placeholder="Explain why this invoice is being rejected…"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      approveReject.mutate(
                        { id: invoice.id, action: 'reject', comments: rejectComments || undefined },
                        { onSuccess: () => setShowRejectDialog(false) },
                      )
                    }}
                    disabled={approveReject.isPending}
                    className="gap-2"
                  >
                    {approveReject.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <ThumbsDown className="w-4 h-4" /> Confirm Rejection
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Payment dialog */}
          {showPaymentDialog && (
            <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4" onClick={() => setShowPaymentDialog(false)}>
              <div className="bg-background rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Record Payment</h2>
                  <button onClick={() => setShowPaymentDialog(false)}><X className="w-4 h-4" /></button>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Invoice Total</span><span className="font-medium">{formatCurrency(invoice.total)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Already Paid</span><span className="font-medium text-green-600">{formatCurrency(invoice.amount_paid ?? 0)}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1"><span className="font-semibold">Outstanding</span><span className="font-bold text-amber-600">{formatCurrency(invoice.total - (invoice.amount_paid ?? 0))}</span></div>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Payment Amount *</Label>
                    <Input type="number" min={0.01} step="0.01" value={paymentForm.amount}
                      onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Payment Date *</Label>
                    <Input type="date" value={paymentForm.payment_date}
                      onChange={e => setPaymentForm(p => ({ ...p, payment_date: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Payment Mode</Label>
                    <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none"
                      value={paymentForm.payment_mode}
                      onChange={e => setPaymentForm(p => ({ ...p, payment_mode: e.target.value }))}>
                      <option value="bank_transfer">Bank Transfer / NEFT</option>
                      <option value="cheque">Cheque</option>
                      <option value="upi">UPI</option>
                      <option value="cash">Cash</option>
                      <option value="rtgs">RTGS</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Reference / UTR / Cheque No.</Label>
                    <Input value={paymentForm.payment_reference}
                      onChange={e => setPaymentForm(p => ({ ...p, payment_reference: e.target.value }))}
                      placeholder="e.g. UTR12345 or CHQ001" className="mt-1" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="cancel" className="flex-1" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
                  <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                    disabled={recordPayment.isPending || !paymentForm.amount || !paymentForm.payment_date}
                    onClick={() => {
                      recordPayment.mutate(
                        { id: invoice.id, amount: parseFloat(paymentForm.amount), payment_date: paymentForm.payment_date, payment_reference: paymentForm.payment_reference || undefined, payment_mode: paymentForm.payment_mode },
                        { onSuccess: () => { setShowPaymentDialog(false); onClose() } },
                      )
                    }}
                  >
                    {recordPayment.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <CreditCard className="w-4 h-4" /> Confirm Payment
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Create Invoice Modal ──────────────────────────────────────────
function CreateInvoiceModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const create = useCreateVendorInvoice()
  const { data: posData } = usePurchaseOrders({ status: 'sent,partial_received,received', size: 100 })
  const pos = posData?.items ?? []

  const [supplierId, setSupplierId] = useState('')
  const [poId, setPoId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineRow[]>([emptyLine()])

  useEscapeToClose(onClose, true)

  const updateLine = (i: number, field: keyof LineRow, value: any) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))

  const totals = useMemo(() => {
    return lines.reduce((acc, l) => {
      const base = l.qty * l.unit_price
      return {
        subtotal: acc.subtotal + base,
        cgst: acc.cgst + base * l.cgst_rate / 100,
        sgst: acc.sgst + base * l.sgst_rate / 100,
        igst: acc.igst + base * l.igst_rate / 100,
      }
    }, { subtotal: 0, cgst: 0, sgst: 0, igst: 0 })
  }, [lines])

  const handleSave = () => {
    if (!supplierId) { toast.error('Select a supplier'); return }
    if (!invoiceNumber.trim()) { toast.error('Enter invoice number'); return }
    const validLines = lines.filter(l => l.description.trim())
    if (!validLines.length) { toast.error('Add at least one line item'); return }
    create.mutate({
      supplier_id: supplierId,
      purchase_order_id: poId || undefined,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate || undefined,
      currency,
      notes: notes || undefined,
      items: validLines.map((l, i) => ({
        line_number: i + 1,
        description: l.description,
        invoiced_qty: l.qty,
        uom: l.uom,
        unit_price: l.unit_price,
        cgst_rate: l.cgst_rate,
        sgst_rate: l.sgst_rate,
        igst_rate: l.igst_rate,
      })),
    }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Banknote className="w-5 h-5 text-amber-600" /> New Vendor Invoice (AP)
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <ProcurementSupplierField
              value={supplierId}
              onChange={setSupplierId}
              label="Supplier"
              required
              returnTo="procurement/vendor-invoices"
              className="col-span-2"
            />
            <div>
              <Label className="text-xs">Currency</Label>
              <Input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Invoice Number *</Label>
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-2026-001" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Invoice Date *</Label>
              <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1" />
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Link to Purchase Order (optional)</Label>
              <Select
                value={poId}
                onChange={setPoId}
                options={selectOptionsWithBlank(
                  '— No PO link —',
                  pos.map((p: { id: string; po_number: string; supplier_name?: string }) => ({
                    value: p.id,
                    label: `${p.po_number} — ${p.supplier_name ?? ''}`,
                  })),
                )}
                className="mt-1 text-sm"
              />
              {/* PO / PR reference strip — shown once a PO is selected */}
              {poId && (() => {
                const selectedPo = pos.find((p: { id: string; po_number: string; supplier_name?: string; pr_number?: string | null; requisition_id?: string | null }) => p.id === poId)
                if (!selectedPo) return null
                return (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs px-3 py-2 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
                    <span className="text-gray-500">Links:</span>
                    <button
                      type="button"
                      className="font-medium text-blue-700 dark:text-blue-400 hover:underline"
                      onClick={() => { onClose(); navigate(`/purchase-orders/${selectedPo.id}`) }}
                    >
                      PO: {selectedPo.po_number}
                    </button>
                    {selectedPo.pr_number && selectedPo.requisition_id && (
                      <>
                        <span className="text-gray-300">·</span>
                        <button
                          type="button"
                          className="font-medium text-indigo-700 dark:text-indigo-400 hover:underline"
                          onClick={() => { onClose(); navigate(`/procurement/requisitions?pr=${selectedPo.requisition_id}`) }}
                        >
                          PR: {selectedPo.pr_number}
                        </button>
                      </>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">Invoice Lines</h3>
              <Button variant="outline" size="sm" onClick={() => setLines(prev => [...prev, emptyLine()])} className="gap-1.5 h-7 text-xs">
                <Plus className="w-3 h-3" /> Add Line
              </Button>
            </div>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {['Description *', 'Qty', 'UoM', 'Unit Price', 'CGST%', 'SGST%', 'IGST%', 'Line Total', ''].map(h => (
                      <th key={h} className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1.5"><Input value={l.description} onChange={e => updateLine(i, 'description', e.target.value)} className="h-7 text-xs w-40" /></td>
                      <td className="px-2 py-1.5"><Input type="number" min={0} value={l.qty} onChange={e => updateLine(i, 'qty', Number(e.target.value))} className="h-7 text-xs w-16" /></td>
                      <td className="px-2 py-1.5"><Input value={l.uom} onChange={e => updateLine(i, 'uom', e.target.value)} className="h-7 text-xs w-14" /></td>
                      <td className="px-2 py-1.5"><Input type="number" min={0} value={l.unit_price} onChange={e => updateLine(i, 'unit_price', Number(e.target.value))} className="h-7 text-xs w-24" /></td>
                      <td className="px-2 py-1.5"><Input type="number" min={0} max={100} value={l.cgst_rate} onChange={e => updateLine(i, 'cgst_rate', Number(e.target.value))} className="h-7 text-xs w-14" /></td>
                      <td className="px-2 py-1.5"><Input type="number" min={0} max={100} value={l.sgst_rate} onChange={e => updateLine(i, 'sgst_rate', Number(e.target.value))} className="h-7 text-xs w-14" /></td>
                      <td className="px-2 py-1.5"><Input type="number" min={0} max={100} value={l.igst_rate} onChange={e => updateLine(i, 'igst_rate', Number(e.target.value))} className="h-7 text-xs w-14" /></td>
                      <td className="px-2 py-1.5 font-medium text-xs">{formatCurrency(calcLineTotal(l))}</td>
                      <td className="px-2 py-1.5">
                        {lines.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}>
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-6 text-sm mt-3 pr-2">
              <span className="text-gray-500">Subtotal: <strong>{formatCurrency(totals.subtotal)}</strong></span>
              <span className="text-gray-500">Tax: <strong>{formatCurrency(totals.cgst + totals.sgst + totals.igst)}</strong></span>
              <span className="font-semibold">Total: {formatCurrency(totals.subtotal + totals.cgst + totals.sgst + totals.igst)}</span>
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes" className="mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Invoice
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function VendorInvoicesAPPage() {
  const [viewMode, setViewMode] = useState<'all' | 'pending_my_approval'>('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('invoice_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<VendorInvoice | null>(null)

  const params: Record<string, unknown> =
    viewMode === 'pending_my_approval'
      ? { pending_my_approval: true }
      : (statusFilter ? { status: statusFilter } : {})
  const { data, isLoading } = useVendorInvoices(params)
  const items: VendorInvoice[] = data?.items ?? []

  const displayItems = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = q
      ? items.filter(i =>
          i.invoice_number.toLowerCase().includes(q) ||
          (i.supplier_name || '').toLowerCase().includes(q) ||
          (i.po_number || '').toLowerCase().includes(q)
        )
      : items
    return processRows(filtered, '', () => [], sortKey, sortDir, {
      invoice_number: i => i.invoice_number,
      supplier_name: i => i.supplier_name || '',
      invoice_date: i => i.invoice_date,
      total: i => i.total,
      status: i => i.status,
    })
  }, [items, search, sortKey, sortDir])

  const totalUnpaid = items.filter(i => !['paid', 'cancelled'].includes(i.status)).reduce((s, i) => s + (i.total - i.amount_paid), 0)

  const cols = [
    { key: 'invoice_number', label: 'Invoice No.', width: 140 },
    { key: 'supplier_name', label: 'Supplier', width: 180 },
    { key: 'po_number', label: 'PO Ref', width: 110 },
    { key: 'invoice_date', label: 'Date', width: 100 },
    { key: 'due_date', label: 'Due', width: 100 },
    { key: 'total', label: 'Total', width: 110 },
    { key: 'status', label: 'Status', width: 110 },
    { key: 'match_status', label: 'Match', width: 110 },
  ]

  return (
    <div className="space-y-6">
      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} />}
      {selected && <InvoiceDetailPanel invoice={selected} onClose={() => setSelected(null)} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Vendor Invoices (AP)</h1>
          <p className="text-sm text-gray-500 mt-0.5">AP bills from suppliers — post, match, and track payment</p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Invoice
        </Button>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMode('all')}
          className={`text-sm px-4 py-1.5 rounded-full font-medium border transition-all ${
            viewMode === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          All Invoices
        </button>
        <button
          type="button"
          onClick={() => setViewMode('pending_my_approval')}
          className={`text-sm px-4 py-1.5 rounded-full font-medium border transition-all gap-2 inline-flex items-center ${
            viewMode === 'pending_my_approval'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400'
          }`}
        >
          <Clock className="w-3.5 h-3.5" /> Pending My Approval
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', count: items.length, color: 'text-gray-700' },
          { label: 'Pending Match', count: items.filter(i => i.status === 'posted').length, color: 'text-blue-600' },
          { label: 'Blocked', count: items.filter(i => i.status === 'blocked').length, color: 'text-red-600' },
          { label: 'Outstanding AP', value: formatCurrency(totalUnpaid), color: 'text-amber-600' },
        ].map(s => (
          <Card key={s.label} className="py-3 px-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.count !== undefined ? s.count : s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="px-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search invoice number, supplier…"
            sortOptions={[
              { value: 'invoice_date', label: 'Invoice Date' },
              { value: 'total', label: 'Total' },
              { value: 'supplier_name', label: 'Supplier' },
              { value: 'status', label: 'Status' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            leading={
              viewMode === 'all' ? (
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={selectOptionsWithBlank('All Statuses', STATUSES.filter(Boolean).map(s => ({ value: s, label: STATUS_BADGE[s]?.label ?? s })))}
                  className="w-36 text-sm"
                />
              ) : undefined
            }
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : displayItems.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No vendor invoices found</p>
          </div>
        ) : (
          <ResizableTable tableId="vendor-invoices-ap" defaultWidths={cols.map(c => c.width)}>
            <thead>
              <tr>
                {cols.map(c => (
                  <th key={c.key} className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                    <TableColumnLabel>{c.label}</TableColumnLabel>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayItems.map(inv => {
                const badge = STATUS_BADGE[inv.status] ?? STATUS_BADGE.draft
                const matchBadge = MATCH_BADGE[inv.match_status] || 'bg-gray-100 text-gray-500'
                return (
                  <tr key={inv.id} className="border-t cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={onClickableTableRow(() => setSelected(inv))}>
                    <td className="px-3 py-2 font-mono text-xs text-blue-600 font-medium">{inv.invoice_number}</td>
                    <td className="px-3 py-2 text-sm font-medium">{inv.supplier_name || '—'}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{inv.po_number || '—'}</td>
                    <td className="px-3 py-2 text-sm">{formatDate(inv.invoice_date)}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
                    <td className="px-3 py-2 text-sm font-semibold">{formatCurrency(inv.total)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${matchBadge}`}>{inv.match_status.replace(/_/g, ' ')}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </ResizableTable>
        )}
      </Card>
    </div>
  )
}
