import { useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { useOrderInvoice, useInvoiceById, useInvoiceSettings } from '@/hooks/useVendor'
import { formatCurrency, formatDate, formatDateTime, mediaUrl } from '@/lib/utils'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft, CalendarDays, Clock, User, Phone, Mail, CheckCircle, Play,
  Ban, UserX, Check, Loader2, MessageSquare, Paperclip, X,
  FileText, ExternalLink, Upload, Users, StickyNote, ChevronRight,
  Image as ImageIcon, Receipt, Download, Printer, Eye, Share2,
} from 'lucide-react'
import { printInvoice } from '@/lib/invoiceTemplates'
import type { InvoiceSettings } from '@/lib/invoiceTemplates'
import { extractApiError } from '@/lib/errorMessages'
import {
  BOOKING_DOC_TYPES, printBookingDocument, viewBookingDocument, downloadBookingDocument,
  getServiceDocTemplates,
  type BookingDocTypeId,
} from '@/lib/bookingDocuments'

function downloadInvoicePdf(invoice: Record<string, unknown>, bookingNumber: string) {
  const fmt = (n: unknown) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  const items: Array<Record<string, unknown>> = (invoice.items as Array<Record<string, unknown>>) || []
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${invoice.invoice_number}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:13px;color:#222;margin:0;padding:0}
  .page{max-width:760px;margin:0 auto;padding:32px}
  h1{font-size:22px;margin:0 0 4px}
  .meta{color:#666;font-size:12px;margin-bottom:6px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:20px 0}
  .label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  th{background:#f5f5f5;text-align:left;padding:8px 10px;font-size:12px}
  td{padding:8px 10px;border-bottom:1px solid #f0f0f0}
  .total-row td{font-weight:bold;border-top:2px solid #222;border-bottom:none;font-size:14px}
  .right{text-align:right}
  .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;background:#e8f5e9;color:#2e7d32}
  @media print{body{-webkit-print-color-adjust:exact}}
</style></head>
<body><div class="page">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
    <div>
      <h1>TAX INVOICE</h1>
      <div class="meta">Invoice # <strong>${invoice.invoice_number}</strong> &nbsp;|&nbsp; Booking # <strong>${bookingNumber || ''}</strong>${invoice.order_id ? ` &nbsp;|&nbsp; Order # <strong>${invoice.order_id}</strong>` : ''}</div>
      <div class="meta">Date: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>
    </div>
    <span class="badge">${String(invoice.status||'issued').toUpperCase()}</span>
  </div>
  <div class="grid">
    <div><div class="label">From</div><strong>${invoice.vendor_name||''}</strong><br/>${invoice.vendor_gstin?`GSTIN: ${invoice.vendor_gstin}`:''}</div>
    <div><div class="label">Bill To</div><strong>${invoice.customer_name||''}</strong></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Item</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Tax</th><th class="right">Amount</th></tr></thead>
    <tbody>
      ${items.map((it,i)=>`<tr>
        <td>${i+1}</td><td>${it.name||it.description||''}</td>
        <td class="right">${it.qty??it.quantity??1}</td>
        <td class="right">${fmt(it.rate||it.price)}</td>
        <td class="right">${fmt((Number(it.cgst_amount||0)+Number(it.sgst_amount||0)+Number(it.igst_amount||0)))}</td>
        <td class="right">${fmt(it.total_amount||it.total)}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot>
      ${Number(invoice.discount_amount||0)>0?`<tr><td colspan="5" class="right">Discount</td><td class="right">-${fmt(invoice.discount_amount)}</td></tr>`:''}
      ${Number(invoice.cgst_amount||0)>0?`<tr><td colspan="5" class="right">CGST</td><td class="right">${fmt(invoice.cgst_amount)}</td></tr>`:''}
      ${Number(invoice.sgst_amount||0)>0?`<tr><td colspan="5" class="right">SGST</td><td class="right">${fmt(invoice.sgst_amount)}</td></tr>`:''}
      ${Number(invoice.igst_amount||0)>0?`<tr><td colspan="5" class="right">IGST</td><td class="right">${fmt(invoice.igst_amount)}</td></tr>`:''}
      <tr class="total-row"><td colspan="5" class="right">Total</td><td class="right">${fmt(invoice.total)}</td></tr>
    </tfoot>
  </table>
  ${Number(invoice.balance_due||0)>0?`<p style="color:#c62828;font-weight:600">Balance Due: ${fmt(invoice.balance_due)}</p>`:'<p style="color:#2e7d32;font-weight:600">Paid in Full</p>'}
  <p style="font-size:11px;color:#aaa;margin-top:32px;border-top:1px solid #eee;padding-top:12px">Computer-generated invoice. No signature required.</p>
</div></body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  setTimeout(() => { w.focus(); w.print() }, 400)
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  pending:     { bg: 'bg-amber-50',  text: 'text-amber-700',  label: 'Pending' },
  confirmed:   { bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'Confirmed' },
  in_progress: { bg: 'bg-accent', text: 'text-primary', label: 'In Progress' },
  completed:   { bg: 'bg-green-50',  text: 'text-green-700',  label: 'Completed' },
  cancelled:   { bg: 'bg-red-50',    text: 'text-red-700',    label: 'Cancelled' },
  no_show:     { bg: 'bg-gray-100',  text: 'text-gray-600',   label: 'No Show' },
}

const STATUS_TIMELINE = ['pending', 'confirmed', 'in_progress', 'completed']

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-detail', id],
    queryFn: () => vendorApi.getBooking(id!),
    enabled: !!id,
  })

  // Invoice: try direct invoice_id first (set when booking is completed), then fallback to order lookup
  const invoiceId = (booking as Record<string, unknown>)?.invoice_id as string | undefined
  const orderId = (booking as Record<string, unknown>)?.order_id as string | undefined
  const { data: invoiceByInvoiceId } = useInvoiceById(invoiceId || '')
  const { data: invoiceByOrderId } = useOrderInvoice(!invoiceId && orderId ? orderId : '')
  const invoice = invoiceByInvoiceId || invoiceByOrderId
  const { data: invSettings } = useInvoiceSettings()

  // Team members for staff assignment
  const { data: teamData } = useQuery({
    queryKey: ['team-for-booking'],
    queryFn: () => vendorApi.listTeamMembers({ size: 100 }),
  })
  const teamMembers = teamData?.items || []

  // State
  const [statusLoading, setStatusLoading] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [newFollowup, setNewFollowup] = useState('')
  const [followupType, setFollowupType] = useState('note')
  const [addingFollowup, setAddingFollowup] = useState(false)
  const [internalNotes, setInternalNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState('')
  const [assigningStaff, setAssigningStaff] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Print documents — read enabled templates set on the Service page (read-only here)
  const serviceId = (booking as any)?.service_id as string | undefined
  const enabledDocs: BookingDocTypeId[] = serviceId ? getServiceDocTemplates(serviceId) : []

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['booking-detail', id] })
    qc.invalidateQueries({ queryKey: ['bookings'] })
  }

  const handleStatus = async (status: string, extra?: Record<string, unknown>) => {
    if (!booking) return
    setStatusLoading(true)
    try {
      await vendorApi.updateBookingStatus(booking.id, { status, ...extra } as Parameters<typeof vendorApi.updateBookingStatus>[1])
      toast.success(`Booking ${status.replace('_', ' ')}`)
      refresh()
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Could not update booking status — it may already be in this state'))
    } finally {
      setStatusLoading(false)
    }
  }

  const handleAssignStaff = async () => {
    if (!booking || !selectedStaff) return
    const member = teamMembers.find((m: any) => m.id === selectedStaff)
    if (!member) return
    setAssigningStaff(true)
    try {
      await vendorApi.assignBookingStaff(booking.id, {
        staff_id: (member as any).id as string,
        staff_name: ((member as any).full_name || (member as any).name || '') as string,
      })
      toast.success('Staff assigned')
      setSelectedStaff('')
      // Sync the bookings list so the table and modal availability also reflect the new staff
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['overdue-bookings'] })
      refresh()
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Could not assign staff member to this booking'))
    } finally {
      setAssigningStaff(false)
    }
  }

  const handleAddFollowup = async () => {
    if (!booking || !newFollowup.trim()) return
    setAddingFollowup(true)
    try {
      await vendorApi.addBookingFollowup(booking.id, { content: newFollowup.trim(), type: followupType })
      toast.success('Note added')
      setNewFollowup('')
      refresh()
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Could not add note to booking'))
    } finally {
      setAddingFollowup(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!booking) return
    setSavingNotes(true)
    try {
      await vendorApi.updateBookingNotes(booking.id, { internal_notes: internalNotes })
      toast.success('Notes saved')
      refresh()
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Could not save booking notes'))
    } finally {
      setSavingNotes(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length || !booking) return
    setUploading(true)
    let successCount = 0
    try {
      for (const file of Array.from(files)) {
        await vendorApi.uploadBookingAttachment(booking.id, file)
        successCount++
      }
      if (successCount > 0) {
        toast.success(`${successCount} file(s) uploaded`)
        refresh()
      }
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Could not upload file — check file size and format (max 5MB, images/documents)'))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!booking) return
    if (!confirm('Delete this attachment?')) return
    try {
      await vendorApi.deleteBookingAttachment(booking.id, attachmentId)
      toast.success('Attachment removed')
      refresh()
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Could not delete the attachment'))
    }
  }

  if (isLoading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
    </div>
  )
  if (!booking) return <p className="text-center py-20 text-gray-500">Booking not found</p>

  const b = booking as any
  const badge = STATUS_BADGE[b.status as string] || STATUS_BADGE.pending
  const timelineIdx = STATUS_TIMELINE.indexOf(b.status as string)
  const isCancelled = b.status === 'cancelled' || b.status === 'no_show'
  const isDone = b.status === 'completed'
  const followups: Record<string, unknown>[] = (b.followups as Record<string, unknown>[]) || []
  const attachments: Record<string, unknown>[] = (b.attachments as Record<string, unknown>[]) || []
  const statusHistory: any[] = (b.status_history as any[]) || []

  // Init internal notes from booking
  const savedInternalNotes = (b.internal_notes as string) || ''

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/bookings')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{b.booking_number as string}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{b.service_name as string}</p>
          </div>
        </div>
        {b.order_id && (
          <Link to={`/orders/${b.order_id}`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50">
              <ExternalLink className="w-4 h-4" /> View Order
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT: main content */}
        <div className="lg:col-span-2 space-y-5">

          {/* Status Timeline */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Booking Progress</h3>
              {isCancelled ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                  <Ban className="w-6 h-6 text-red-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-red-700 capitalize">{b.status as string === 'no_show' ? 'No Show' : 'Cancelled'}</p>
                    {b.cancel_reason && <p className="text-sm text-red-600 mt-0.5">{b.cancel_reason as string}</p>}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between relative mb-6">
                  <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0">
                    <div className="h-full bg-blue-500 transition-all"
                      style={{ width: `${timelineIdx >= 0 ? (timelineIdx / (STATUS_TIMELINE.length - 1)) * 100 : 0}%` }} />
                  </div>
                  {[
                    { key: 'pending', label: 'Pending', Icon: Clock },
                    { key: 'confirmed', label: 'Confirmed', Icon: Check },
                    { key: 'in_progress', label: 'In Progress', Icon: Play },
                    { key: 'completed', label: 'Completed', Icon: CheckCircle },
                  ].map((step, i) => (
                    <div key={step.key} className="flex flex-col items-center z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm ${
                        i <= timelineIdx ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border-2 border-gray-200 text-gray-400'
                      }`}>
                        <step.Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-xs mt-1.5 font-medium ${i <= timelineIdx ? 'text-blue-600' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              {!isDone && !isCancelled && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {b.status === 'pending' && (
                    <>
                      <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleStatus('confirmed')} disabled={statusLoading}>
                        <Check className="w-3.5 h-3.5" /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-gray-700"
                        onClick={() => handleStatus('no_show')} disabled={statusLoading}>
                        <UserX className="w-3.5 h-3.5" /> Mark No Show
                      </Button>
                    </>
                  )}
                  {b.status === 'confirmed' && (
                    <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90 text-white"
                      onClick={() => handleStatus('in_progress')} disabled={statusLoading}>
                      <Play className="w-3.5 h-3.5" /> Start Service
                    </Button>
                  )}
                  {b.status === 'in_progress' && (
                    <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => setShowCompleteModal(true)} disabled={statusLoading}>
                      <CheckCircle className="w-3.5 h-3.5" /> Complete
                    </Button>
                  )}
                  {['pending', 'confirmed'].includes(b.status as string) && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 ml-auto"
                      onClick={() => setShowCancelModal(true)} disabled={statusLoading}>
                      <Ban className="w-3.5 h-3.5" /> Cancel Booking
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Followups / Communications */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Notes & Followups</h3>
                <span className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-500">{followups.length}</span>
              </div>

              {/* Add new note */}
              <div className="space-y-2 mb-4">
                <div className="flex gap-2">
                  <select
                    className="h-9 px-2 border rounded-lg text-sm text-gray-600 bg-white"
                    value={followupType}
                    onChange={e => setFollowupType(e.target.value)}
                  >
                    <option value="note">Note</option>
                    <option value="followup">Follow-up</option>
                    <option value="reminder">Reminder</option>
                    <option value="update">Update</option>
                  </select>
                  <Input
                    placeholder="Add a note or followup message…"
                    value={newFollowup}
                    onChange={e => setNewFollowup(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddFollowup()}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleAddFollowup} disabled={!newFollowup.trim() || addingFollowup}>
                    {addingFollowup ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                  </Button>
                </div>
              </div>

              {/* Notes list */}
              {followups.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No notes yet. Add the first one.</p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {[...followups].reverse().map((f, i) => {
                    const typeColor: Record<string, string> = {
                      note: 'bg-gray-100 text-gray-600',
                      followup: 'bg-blue-100 text-blue-700',
                      reminder: 'bg-amber-100 text-amber-700',
                      update: 'bg-green-100 text-green-700',
                      assignment: 'bg-indigo-100 text-indigo-700',
                    }
                    return (
                      <div key={i} className="flex gap-3 text-sm">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-xs font-bold text-gray-600">
                          {((f.author as string) || 'V')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-800 text-xs">{f.author as string}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${typeColor[f.type as string] || typeColor.note}`}>
                              {f.type as string}
                            </span>
                            <span className="text-gray-400 text-[11px]">{formatDateTime(f.created_at as string)}</span>
                          </div>
                          <p className="text-gray-700 mt-0.5">{f.content as string}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-700">Attachments</h3>
                  <span className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-500">{attachments.length}</span>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Upload
                </Button>
                <input ref={fileRef} type="file" accept="image/*,video/*,application/pdf" multiple className="hidden" onChange={handleFileUpload} />
              </div>

              {attachments.length === 0 ? (
                <div className="border-2 border-dashed rounded-xl p-8 text-center text-gray-400">
                  <ImageIcon className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">Upload before/after photos, documents, or evidence</p>
                  <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => fileRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5" /> Choose Files
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {attachments.map((a) => (
                    <div key={a.id as string} className="relative group rounded-xl border overflow-hidden bg-gray-50">
                      {(a.kind as string) === 'image' ? (
                        <a href={mediaUrl(a.url as string)} target="_blank" rel="noopener noreferrer">
                          <img src={mediaUrl(a.url as string)} alt="" className="w-full h-28 object-cover" />
                        </a>
                      ) : (a.kind as string) === 'video' ? (
                        <video src={mediaUrl(a.url as string)} className="w-full h-28 object-cover" controls muted />
                      ) : (
                        <a href={mediaUrl(a.url as string)} target="_blank" rel="noopener noreferrer"
                          className="flex flex-col items-center justify-center h-28 gap-2 text-blue-600 hover:bg-blue-50">
                          <FileText className="w-8 h-8" />
                          <span className="text-xs font-medium truncate max-w-full px-2">{a.filename as string}</span>
                        </a>
                      )}
                      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow"
                          onClick={() => handleDeleteAttachment(a.id as string)}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-[11px] text-gray-500 truncate">{a.filename as string}</p>
                        <p className="text-[10px] text-gray-400">{a.uploaded_by as string}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Print / Download / Share Documents — full-width in left column */}
          {(() => {
            const bookingInfo = {
              booking_number:      b.booking_number as string,
              service_name:        b.service_name as string,
              customer_name:       b.customer_name as string,
              customer_phone:      b.customer_phone as string,
              customer_email:      b.customer_email as string,
              booking_date:        b.booking_date as string,
              start_time:          b.start_time as string,
              end_time:            b.end_time as string,
              duration_minutes:    b.duration_minutes as number,
              notes:               b.notes as string,
              assigned_staff_name: b.assigned_staff_name as string,
              total:               b.total as number,
            }
            const enabledTypes = BOOKING_DOC_TYPES.filter(d => enabledDocs.includes(d.id as BookingDocTypeId))
            return (
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Printer className="w-4 h-4 text-gray-400" /> Print Documents
                    </h3>
                    {serviceId && (
                      <a href={`/services/${serviceId}`} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:text-primary font-medium flex items-center gap-1 transition-colors">
                        <Eye className="w-3 h-3" /> Configure in Service
                      </a>
                    )}
                  </div>

                  {enabledTypes.length === 0 ? (
                    <div className="flex items-center gap-4 py-4 px-4 rounded-xl border border-dashed border-gray-200 bg-gray-50">
                      <Printer className="w-7 h-7 text-gray-200 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">No templates enabled</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {serviceId
                            ? <><a href={`/services/${serviceId}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Configure print templates</a> on the service page.</>
                            : 'Enable print templates on the service page.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Document rows — each with Print + Download + Share buttons */}
                      <div className="space-y-2 mb-4">
                        {enabledTypes.map(doc => (
                          <div key={doc.id}
                            className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${doc.bg} ${doc.border}`}>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${doc.color}`}>{doc.label}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{doc.desc}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => viewBookingDocument(doc.id as BookingDocTypeId, bookingInfo)}
                                title="Preview"
                                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors">
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                              <button
                                onClick={() => printBookingDocument(doc.id as BookingDocTypeId, bookingInfo)}
                                title="Print"
                                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors">
                                <Printer className="w-3.5 h-3.5" /> Print
                              </button>
                              <button
                                onClick={() => downloadBookingDocument(doc.id as BookingDocTypeId, bookingInfo)}
                                title="Download as HTML"
                                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors">
                                <Download className="w-3.5 h-3.5" /> Download
                              </button>
                              <button
                                onClick={async () => {
                                  const url = window.location.href
                                  if (navigator.share) {
                                    await navigator.share({ title: doc.label, text: `${doc.label} for ${bookingInfo.booking_number}`, url })
                                  } else {
                                    await navigator.clipboard.writeText(url)
                                    toast.success('Link copied to clipboard')
                                  }
                                }}
                                title="Share"
                                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors">
                                <Share2 className="w-3.5 h-3.5" /> Share
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Bulk actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => enabledTypes.forEach(doc => printBookingDocument(doc.id as BookingDocTypeId, bookingInfo))}
                          className="flex-1 h-10 flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors">
                          <Printer className="w-4 h-4" /> Print All ({enabledTypes.length})
                        </button>
                        <button
                          onClick={() => enabledTypes.forEach(doc => downloadBookingDocument(doc.id as BookingDocTypeId, bookingInfo))}
                          className="flex-1 h-10 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors">
                          <Download className="w-4 h-4" /> Download All
                        </button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })()}

          {/* Status History */}
          {statusHistory.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-700">Status History</h3>
                </div>
                <div className="relative pl-5 space-y-4">
                  <div className="absolute left-[9px] top-1 bottom-1 w-0.5 bg-gray-100" />
                  {[...statusHistory].reverse().map((h, i) => (
                    <div key={i} className="relative flex items-start gap-3">
                      <div className="absolute left-[-14px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-400 border-2 border-white ring-2 ring-blue-100" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {h.from_status && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${STATUS_BADGE[h.from_status as string]?.bg || 'bg-gray-100'} ${STATUS_BADGE[h.from_status as string]?.text || 'text-gray-600'}`}>
                              {STATUS_BADGE[h.from_status as string]?.label || h.from_status as string}
                            </span>
                          )}
                          {h.from_status && <ChevronRight className="w-3 h-3 text-gray-300" />}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${STATUS_BADGE[h.to_status as string]?.bg || 'bg-gray-100'} ${STATUS_BADGE[h.to_status as string]?.text || 'text-gray-600'}`}>
                            {STATUS_BADGE[h.to_status as string]?.label || h.to_status as string}
                          </span>
                          <span className="text-[11px] text-gray-400">{formatDateTime(h.changed_at as string)}</span>
                        </div>
                        {h.changed_by_name && <p className="text-xs text-gray-500 mt-0.5">by {h.changed_by_name as string}</p>}
                        {h.note && <p className="text-xs text-gray-400 mt-0.5 italic">"{h.note as string}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT: sidebar */}
        <div className="space-y-4">
          {/* Booking Info */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-gray-400" /> Booking Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="font-medium">{formatDate(b.booking_date as string)}</span>
                </div>
                {b.start_time && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Time</span>
                    <span className="font-medium">{(b.start_time as string).substring(0, 5)}
                      {b.duration_minutes && <span className="text-gray-400 text-xs"> ({b.duration_minutes as number} min)</span>}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Service</span>
                  <span className="font-medium text-right max-w-[60%]">{b.service_name as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment</span>
                  <span className="capitalize">{b.payment_method as string}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" /> Customer
              </h3>
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-gray-900">{b.customer_name as string}</p>
                {b.customer_email && (
                  <a href={`mailto:${b.customer_email}`} className="flex items-center gap-2 text-gray-500 hover:text-blue-600">
                    <Mail className="w-3.5 h-3.5 shrink-0" /> {b.customer_email as string}
                  </a>
                )}
                {b.customer_phone && (
                  <a href={`tel:${b.customer_phone}`} className="flex items-center gap-2 text-gray-500 hover:text-blue-600">
                    <Phone className="w-3.5 h-3.5 shrink-0" /> {b.customer_phone as string}
                  </a>
                )}
              </div>
              {b.notes && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-1">Customer Notes</p>
                  <p className="text-sm text-gray-700 italic">"{b.notes as string}"</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financial */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>{formatCurrency(b.subtotal as number)}</span>
                </div>
                {Number(b.tax_amount) > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Tax</span><span>{formatCurrency(b.tax_amount as number)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-1.5 border-t text-base">
                  <span>Total</span><span>{formatCurrency(b.total as number)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    b.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {b.payment_status as string}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-gray-400" /> Invoice
              </h3>
              {invoice ? (
                <div className="space-y-2">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm font-mono font-semibold text-green-800">
                      {(invoice as Record<string, string>).invoice_number}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-green-700 capitalize">
                        {(invoice as Record<string, string>).status}
                      </span>
                      <span className="text-sm font-bold text-green-900">
                        {formatCurrency(Number((invoice as Record<string, unknown>).total || 0))}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => printInvoice(invoice as Record<string, unknown>, (invSettings || {}) as Partial<InvoiceSettings>, window.location.origin)}
                    >
                      <Printer className="w-3.5 h-3.5" /> Print / PDF
                    </Button>
                    {orderId && (
                      <Link to={`/invoices/${(invoice as Record<string, string>).id}`} className="flex-1">
                        <Button size="sm" variant="outline" className="w-full gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5" /> View
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Receipt className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">
                    {isDone
                      ? 'Invoice will be generated shortly'
                      : 'Invoice is auto-generated when booking is completed'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Staff Assignment */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" /> Service Provider
              </h3>
              {b.assigned_staff_name ? (
                <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-2.5 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                    {(b.assigned_staff_name as string)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">{b.assigned_staff_name as string}</p>
                    <p className="text-xs text-blue-600">Assigned</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-3">No staff assigned yet</p>
              )}
              {!isDone && !isCancelled && (
                <div className="flex gap-2">
                  <select
                    className="flex-1 h-8 px-2 border rounded-lg text-sm"
                    value={selectedStaff}
                    onChange={e => setSelectedStaff(e.target.value)}
                  >
                    <option value="">Select staff…</option>
                    {teamMembers.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.name}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" onClick={handleAssignStaff} disabled={!selectedStaff || assigningStaff}>
                    {assigningStaff ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Assign'}
                  </Button>
                </div>
              )}
              {b.completed_by_name && (
                <div className="mt-3 pt-3 border-t text-sm">
                  <p className="text-xs text-gray-500">Completed by</p>
                  <p className="font-medium text-gray-800">{b.completed_by_name as string}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Notes (shown after completion) */}
          {b.delivery_notes && (
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Delivery Notes</h3>
                <p className="text-sm text-gray-700">{b.delivery_notes as string}</p>
              </CardContent>
            </Card>
          )}

          {/* Internal Notes */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-gray-400" /> Internal Notes
              </h3>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Private notes visible only to your team…"
                defaultValue={savedInternalNotes}
                onChange={e => setInternalNotes(e.target.value)}
              />
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={handleSaveNotes} disabled={savingNotes}>
                {savingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Save Notes
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Cancel Booking</h3>
            <p className="text-sm text-gray-500 mb-4">Please provide a reason for cancellation.</p>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
              rows={3}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation…"
            />
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowCancelModal(false)}>Keep</Button>
              <Button variant="destructive" className="flex-1" disabled={statusLoading}
                onClick={() => {
                  handleStatus('cancelled', { cancel_reason: cancelReason || undefined })
                  setShowCancelModal(false)
                }}>
                Confirm Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCompleteModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Mark as Completed</h3>
            <p className="text-sm text-gray-500 mb-4">Add optional notes about service delivery.</p>
            <Label className="text-sm">Delivery Notes (optional)</Label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none mt-1"
              rows={3}
              value={deliveryNotes}
              onChange={e => setDeliveryNotes(e.target.value)}
              placeholder="e.g. Service completed successfully, customer was satisfied…"
            />
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowCompleteModal(false)}>Cancel</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" disabled={statusLoading}
                onClick={() => {
                  handleStatus('completed', { delivery_notes: deliveryNotes || undefined })
                  setShowCompleteModal(false)
                }}>
                {statusLoading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Complete Booking
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
