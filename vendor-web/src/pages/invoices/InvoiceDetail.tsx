import { useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { useUpdateInvoice, useInvoiceSettings } from '@/hooks/useVendor'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import apiClient from '@/api/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Loader2, Download, FileText, Printer,
  IndianRupee, Calendar, User, Phone, Mail, Building2,
  Hash, MapPin, Pencil, Save, X, Plus, Trash2, CalendarDays, ShoppingBag, Settings2,
  MessageCircle, MessageSquare, Share2,
} from 'lucide-react'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { printInvoice, generateInvoiceHtml, DEFAULT_INVOICE_SETTINGS, loadPosInvoiceSettings } from '@/lib/invoiceTemplates'
import type { InvoiceSettings } from '@/lib/invoiceTemplates'
import { fetchAsDataUrl, downloadAsPdf, shareViaWhatsApp, shareViaSms, buildShareMessage } from '@/lib/printUtils'

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  sent: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Sent' },
  paid: { bg: 'bg-green-50', text: 'text-green-700', label: 'Paid' },
  partially_paid: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Partially Paid' },
  overdue: { bg: 'bg-red-50', text: 'text-red-700', label: 'Overdue' },
  cancelled: { bg: 'bg-gray-50', text: 'text-gray-500', label: 'Cancelled' },
}

const typeBadge: Record<string, { bg: string; text: string; label: string }> = {
  estimate: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Estimate' },
  invoice: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Invoice' },
  receipt: { bg: 'bg-green-50', text: 'text-green-700', label: 'Receipt' },
  credit_note: { bg: 'bg-red-50', text: 'text-red-700', label: 'Credit Note' },
}

interface LineItem {
  name: string
  hsn_sac: string
  qty: number
  rate: number
  tax_rate: number
}

async function downloadPdf(id: string, invoiceNumber: string) {
  try {
    const res = await apiClient.get(`/vendors/me/invoices/${id}/pdf`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${(invoiceNumber || id).replace(/\//g, '-')}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch {
    toast.error('Could not download invoice PDF — try again or use Print Invoice instead')
  }
}

async function printWithTemplate(inv: Record<string, unknown>, invSettings: InvoiceSettings) {
  await printInvoice(inv, invSettings)
}

async function downloadInvoicePdf(inv: Record<string, unknown>, invSettings: InvoiceSettings) {
  // Merge with defaults first — same as printInvoice — so template/color are always set.
  const s = { ...DEFAULT_INVOICE_SETTINGS, ...invSettings }
  const rawLogo = (s.logo_url || inv.vendor_logo_url as string) || ''
  const rawSig  = s.signature_url || ''
  const [logoDataUrl, sigDataUrl] = await Promise.all([
    s.show_logo      && rawLogo ? fetchAsDataUrl(rawLogo) : Promise.resolve(''),
    s.show_signature && rawSig  ? fetchAsDataUrl(rawSig)  : Promise.resolve(''),
  ])
  const enriched: InvoiceSettings = { ...s, logo_url: logoDataUrl || undefined, signature_url: sigDataUrl || undefined }
  const html = generateInvoiceHtml({ ...inv, vendor_logo_url: logoDataUrl || inv.vendor_logo_url }, enriched, '')
  const filename = `${String(inv.invoice_number || 'invoice').replace(/\//g, '-')}.pdf`
  await downloadAsPdf(html, filename, { margin: s.pdf_margin ?? 5, orientation: s.pdf_orientation ?? 'portrait', imageQuality: s.pdf_image_quality ?? 0.98 })
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-gray-700">{value}</p>
      </div>
    </div>
  )
}

function AddressBlock({ label, address }: { label: string; address?: Record<string, string> | null }) {
  if (!address) return null
  const parts = [address.street_address, address.city, address.state, address.postal_code, address.country].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {label}</p>
      <p className="text-sm text-gray-700">{parts.join(', ')}</p>
    </div>
  )
}

function parseLineItems(rawItems: Array<Record<string, unknown>>): LineItem[] {
  return rawItems.map(item => ({
    name: String(item.name || item.description || ''),
    hsn_sac: String(item.hsn_sac || item.hsn_code || item.sac_code || ''),
    qty: Number(item.qty || item.quantity || 0),
    rate: Number(item.rate || item.price || 0),
    tax_rate: Number(item.tax_rate || item.gst_rate || 0),
  }))
}

function emptyLineItem(): LineItem {
  return { name: '', hsn_sac: '', qty: 1, rate: 0, tax_rate: 0 }
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const updateInvoice = useUpdateInvoice()
  const { data: rawInvSettings, isLoading: settingsLoading } = useInvoiceSettings()

  // Always merge with defaults so template/color/etc. are never undefined.
  // For POS-originated invoices (notes contain "POS Transaction") we also layer
  // the POS localStorage overrides so Print and PDF use exactly the same
  // settings as the POS page — fixing the classic-vs-modern mismatch.
  const invSettings = useMemo<InvoiceSettings>(() => {
    const base: InvoiceSettings = { ...DEFAULT_INVOICE_SETTINGS, ...(rawInvSettings as Partial<InvoiceSettings> || {}) }
    return base
  }, [rawInvSettings])

  // Effective settings used for print/PDF — layered after inv loads so POS
  // overrides are applied only for POS receipts.
  const effectiveSettings = useCallback((invData?: Record<string, unknown>): InvoiceSettings => {
    const notes  = String((invData || {}).notes || '')
    const num    = String((invData || {}).invoice_number || '')
    const isPOS  = notes.includes('POS Transaction') || /^POS-/i.test(num)
    const pos    = isPOS ? loadPosInvoiceSettings() : {}
    return { ...invSettings, ...pos }
  }, [invSettings])

  const { data: inv, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => vendorApi.getInvoice(id!),
    enabled: !!id,
  })

  const [isEditing, setIsEditing] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerGstin, setCustomerGstin] = useState('')
  const [notes, setNotes] = useState('')
  const [editItems, setEditItems] = useState<LineItem[]>([])

  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const viewSortOptions = useMemo(() => [
    { value: 'name', label: 'Item' },
    { value: 'hsn_sac', label: 'HSN/SAC' },
    { value: 'qty', label: 'Qty' },
    { value: 'rate', label: 'Rate' },
    { value: 'tax_rate', label: 'Tax %' },
    { value: 'amount', label: 'Amount' },
  ], [])

  const viewAccessors = useMemo<Record<string, (r: Record<string, unknown>) => unknown>>(() => ({
    name: (r) => String(r.name || r.description || ''),
    hsn_sac: (r) => String(r.hsn_sac || r.hsn_code || r.sac_code || ''),
    qty: (r) => Number(r.qty || r.quantity || 0),
    rate: (r) => Number(r.rate || r.price || 0),
    tax_rate: (r) => Number(r.tax_rate || r.gst_rate || 0),
    amount: (r) => Number(r.qty || r.quantity || 0) * Number(r.rate || r.price || 0),
  }), [])

  const sortedViewItems = useMemo(
    () => processRows(inv?.items as Record<string, unknown>[] | undefined, '', () => [], sortKey, sortDir, viewAccessors),
    [inv?.items, sortKey, sortDir, viewAccessors],
  )

  const startEditing = useCallback(() => {
    if (!inv) return
    setCustomerName(inv.customer_name || '')
    setCustomerPhone(inv.customer_phone || '')
    setCustomerGstin(inv.customer_gstin || '')
    setNotes(inv.notes || '')
    setEditItems(parseLineItems(inv.items || []))
    setIsEditing(true)
  }, [inv])

  const cancelEditing = useCallback(() => {
    setIsEditing(false)
  }, [])

  const updateItem = useCallback((index: number, field: keyof LineItem, value: string | number) => {
    setEditItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }, [])

  const addItem = useCallback(() => {
    setEditItems(prev => [...prev, emptyLineItem()])
  }, [])

  const removeItem = useCallback((index: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== index))
  }, [])

  const calculatedTotals = useMemo(() => {
    let subtotal = 0
    let totalTax = 0
    for (const item of editItems) {
      const lineTotal = item.qty * item.rate
      subtotal += lineTotal
      totalTax += lineTotal * (item.tax_rate / 100)
    }
    return {
      subtotal,
      totalTax,
      total: subtotal + totalTax,
    }
  }, [editItems])

  const handleSave = useCallback(() => {
    if (!id) return
    const validItems = editItems.filter(item => item.name.trim())
    if (validItems.length === 0) {
      toast.error('Add at least one line item')
      return
    }

    updateInvoice.mutate(
      {
        id,
        data: {
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_gstin: customerGstin,
          notes,
          items: validItems.map(item => ({
            name: item.name,
            hsn_sac: item.hsn_sac || undefined,
            qty: item.qty,
            rate: item.rate,
            tax_rate: item.tax_rate,
          })),
        },
      },
      {
        onSuccess: () => {
          setIsEditing(false)
        },
      },
    )
  }, [id, editItems, customerName, customerPhone, customerGstin, notes, updateInvoice])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    )
  }

  if (!inv) {
    return (
      <div className="text-center py-20">
        <FileText className="w-14 h-14 text-gray-200 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900">Invoice not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/invoices')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Invoices
        </Button>
      </div>
    )
  }

  const sb = statusBadge[inv.status] || statusBadge.draft
  const tb = typeBadge[inv.invoice_type] || typeBadge.invoice
  const items: Array<Record<string, unknown>> = inv.items || []

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{inv.invoice_number}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${tb.bg} ${tb.text}`}>{tb.label}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sb.bg} ${sb.text}`}>{sb.label}</span>
            </div>
            {inv.financial_year && (
              <p className="text-xs text-gray-400 mt-0.5">FY {inv.financial_year}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelEditing} disabled={updateInvoice.isPending}>
                <X className="w-4 h-4 mr-1.5" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateInvoice.isPending}>
                {updateInvoice.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1.5" />
                )}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="w-4 h-4 mr-1.5" /> Edit
              </Button>
              <Button variant="outline" size="sm"
                disabled={settingsLoading}
                onClick={() => printWithTemplate(inv as Record<string, unknown>, effectiveSettings(inv as Record<string, unknown>))}>
                {settingsLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Printer className="w-4 h-4 mr-1.5" />} Print
              </Button>
              <Button variant="outline" size="sm"
                disabled={settingsLoading}
                onClick={() => downloadInvoicePdf(inv as Record<string, unknown>, effectiveSettings(inv as Record<string, unknown>))}>
                {settingsLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5 text-red-500" />} Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const msg = buildShareMessage({
                  type: 'invoice',
                  number: inv.invoice_number as string,
                  vendorName: inv.vendor_name as string || '',
                  customerOrSupplier: inv.customer_name as string || '',
                  total: inv.total as number,
                  date: inv.created_at ? new Date(inv.created_at as string).toLocaleDateString('en-IN') : '',
                  status: inv.status as string,
                  items: (inv.items as Array<Record<string,unknown>>)?.map(i => ({
                    name: String(i.name || ''), qty: Number(i.qty || i.quantity || 0), amount: Number(i.total || 0),
                  })),
                })
                shareViaWhatsApp(msg, inv.customer_phone as string)
              }}>
                <MessageCircle className="w-4 h-4 mr-1.5 text-green-600" /> WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const msg = buildShareMessage({
                  type: 'invoice',
                  number: inv.invoice_number as string,
                  vendorName: inv.vendor_name as string || '',
                  customerOrSupplier: inv.customer_name as string || '',
                  total: inv.total as number,
                  date: inv.created_at ? new Date(inv.created_at as string).toLocaleDateString('en-IN') : '',
                })
                shareViaSms(msg, inv.customer_phone as string)
              }}>
                <MessageSquare className="w-4 h-4 mr-1.5 text-amber-600" /> SMS
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: `Invoice ${inv.invoice_number}`, text: `Invoice ${inv.invoice_number} — Total: ₹${inv.total}` }).catch(() => {})
                } else {
                  navigator.clipboard.writeText(`Invoice: ${inv.invoice_number}\nTotal: ₹${inv.total}\nCustomer: ${inv.customer_name}`)
                  toast.success('Invoice details copied!')
                }
              }}>
                <Share2 className="w-4 h-4 mr-1.5 text-purple-600" /> Share
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/invoices/templates')}>
                <Settings2 className="w-4 h-4 mr-1.5" /> Settings
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Two-column: Customer & Vendor info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" /> Bill To
          </h3>
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="customer_name" className="text-xs text-gray-500">Name</Label>
                <Input
                  id="customer_name"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                />
              </div>
              <div>
                <Label htmlFor="customer_phone" className="text-xs text-gray-500">Phone</Label>
                <PhoneInput
                  value={customerPhone}
                  onChange={setCustomerPhone}
                  defaultCountryIso="IN"
                />
              </div>
              <div>
                <Label htmlFor="customer_gstin" className="text-xs text-gray-500">GSTIN</Label>
                <Input
                  id="customer_gstin"
                  value={customerGstin}
                  onChange={e => setCustomerGstin(e.target.value)}
                  placeholder="GSTIN"
                />
              </div>
            </div>
          ) : (
            <>
              <InfoRow icon={User} label="Name" value={inv.customer_name} />
              <InfoRow icon={Mail} label="Email" value={inv.customer_email} />
              <InfoRow icon={Phone} label="Phone" value={inv.customer_phone} />
              <InfoRow icon={Building2} label="GSTIN" value={inv.customer_gstin} />
              <AddressBlock label="Billing Address" address={inv.billing_address} />
              <AddressBlock label="Shipping Address" address={inv.shipping_address} />
            </>
          )}
        </div>

        {/* Vendor / Meta */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" /> From
          </h3>
          <InfoRow icon={Building2} label="Vendor" value={inv.vendor_name} />
          <InfoRow icon={Hash} label="GSTIN" value={inv.vendor_gstin} />
          <InfoRow icon={Calendar} label="Created" value={formatDate(inv.created_at)} />
          {inv.due_date && <InfoRow icon={Calendar} label="Due Date" value={formatDate(inv.due_date)} />}
          {inv.payment_terms && <InfoRow icon={FileText} label="Payment Terms" value={inv.payment_terms} />}
          {inv.place_of_supply && <InfoRow icon={MapPin} label="Place of Supply" value={inv.place_of_supply} />}
          {inv.is_inter_state && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 w-fit">Inter-state supply (IGST)</p>
          )}
          {/* Booking / Order reference links */}
          {(inv as Record<string, unknown>).booking_id && (
            <div className="pt-2 border-t">
              <p className="text-xs text-gray-400 mb-1.5">Linked Booking</p>
              <button
                onClick={() => navigate(`/bookings/${(inv as Record<string, unknown>).booking_id}`)}
                className="flex items-center gap-1.5 text-sm font-mono text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                <CalendarDays className="w-4 h-4" />
                {String((inv as Record<string, unknown>).booking_number || (inv as Record<string, unknown>).booking_id)}
              </button>
            </div>
          )}
          {(inv as Record<string, unknown>).order_id && !(inv as Record<string, unknown>).booking_id && (
            <div className="pt-2 border-t">
              <p className="text-xs text-gray-400 mb-1.5">Linked Order</p>
              <button
                onClick={() => navigate(`/orders/${(inv as Record<string, unknown>).order_id}`)}
                className="flex items-center gap-1.5 text-sm font-mono text-blue-600 hover:text-blue-800 hover:underline"
              >
                <ShoppingBag className="w-4 h-4" />
                {String((inv as Record<string, unknown>).order_number || (inv as Record<string, unknown>).order_id)}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      {isEditing ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Items ({editItems.length})</h3>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          </div>
          <div className="divide-y">
            {editItems.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No items yet.{' '}
                <button onClick={addItem} className="text-blue-500 hover:underline">Add one</button>
              </div>
            ) : (
              editItems.map((item, idx) => (
                <div key={idx} className="px-5 py-3 grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-12 sm:col-span-3">
                    <Label className="text-xs text-gray-500">Item Name</Label>
                    <Input
                      value={item.name}
                      onChange={e => updateItem(idx, 'name', e.target.value)}
                      placeholder="Item name"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <Label className="text-xs text-gray-500">HSN/SAC</Label>
                    <Input
                      value={item.hsn_sac}
                      onChange={e => updateItem(idx, 'hsn_sac', e.target.value)}
                      placeholder="HSN/SAC"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-1">
                    <Label className="text-xs text-gray-500">Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={item.qty}
                      onChange={e => updateItem(idx, 'qty', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <Label className="text-xs text-gray-500">Rate</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.rate}
                      onChange={e => updateItem(idx, 'rate', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-1">
                    <Label className="text-xs text-gray-500">Tax %</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.tax_rate}
                      onChange={e => updateItem(idx, 'tax_rate', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2 text-right">
                    <Label className="text-xs text-gray-500">Amount</Label>
                    <p className="text-sm font-medium py-2">{formatCurrency(item.qty * item.rate)}</p>
                  </div>
                  <div className="col-span-6 sm:col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Items ({inv.item_count || items.length})</h3>
          </div>
          <TableToolbar
            search=""
            onSearchChange={() => {}}
            hideSearch
            sortOptions={viewSortOptions}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            className="py-2"
          />
          <table className="w-full">
            <thead>
              <tr className="border-b text-xs text-gray-500 uppercase">
                <th className="text-left px-5 py-2.5 font-semibold">#</th>
                <th className="text-left px-5 py-2.5 font-semibold">Item</th>
                <th className="text-left px-5 py-2.5 font-semibold">HSN/SAC</th>
                <th className="text-right px-5 py-2.5 font-semibold">Qty</th>
                <th className="text-right px-5 py-2.5 font-semibold">Rate</th>
                <th className="text-right px-5 py-2.5 font-semibold">Tax %</th>
                <th className="text-right px-5 py-2.5 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedViewItems.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-400">No line items</td></tr>
              ) : sortedViewItems.map((item, idx) => {
                const qty = Number(item.qty || item.quantity || 0)
                const rate = Number(item.rate || item.price || 0)
                const taxRate = Number(item.tax_rate || item.gst_rate || 0)
                const lineTotal = qty * rate
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm text-gray-400">{idx + 1}</td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{String(item.name || item.description || '-')}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{String(item.hsn_sac || item.hsn_code || item.sac_code || '-')}</td>
                    <td className="px-5 py-3 text-sm text-right">{qty}</td>
                    <td className="px-5 py-3 text-sm text-right">{formatCurrency(rate)}</td>
                    <td className="px-5 py-3 text-sm text-right">{taxRate > 0 ? `${taxRate}%` : '-'}</td>
                    <td className="px-5 py-3 text-sm text-right font-medium">{formatCurrency(lineTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div className="flex justify-end">
        <div className="bg-white rounded-xl border p-5 w-full max-w-sm space-y-2">
          {isEditing ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(calculatedTotals.subtotal)}</span>
              </div>
              {calculatedTotals.totalTax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Tax</span>
                  <span>{formatCurrency(calculatedTotals.totalTax)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t">
                <span className="flex items-center gap-1"><IndianRupee className="w-4 h-4" /> Total</span>
                <span>{formatCurrency(calculatedTotals.total)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(inv.subtotal)}</span>
              </div>
              {inv.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount</span>
                  <span className="text-red-500">-{formatCurrency(inv.discount_amount)}</span>
                </div>
              )}
              {inv.is_gst && !inv.is_inter_state && (
                <>
                  {inv.cgst_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">CGST</span>
                      <span>{formatCurrency(inv.cgst_amount)}</span>
                    </div>
                  )}
                  {inv.sgst_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">SGST</span>
                      <span>{formatCurrency(inv.sgst_amount)}</span>
                    </div>
                  )}
                </>
              )}
              {inv.is_gst && inv.is_inter_state && inv.igst_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">IGST</span>
                  <span>{formatCurrency(inv.igst_amount)}</span>
                </div>
              )}
              {inv.total_tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Tax</span>
                  <span>{formatCurrency(inv.total_tax)}</span>
                </div>
              )}
              {inv.round_off !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Round Off</span>
                  <span>{formatCurrency(inv.round_off)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t">
                <span className="flex items-center gap-1"><IndianRupee className="w-4 h-4" /> Total</span>
                <span>{formatCurrency(inv.total)}</span>
              </div>
              {(inv.amount_paid > 0 || inv.balance_due > 0) && (
                <>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-gray-500">Amount Paid</span>
                    <span className="text-green-600 font-medium">{formatCurrency(inv.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Balance Due</span>
                    <span className={`font-bold ${inv.balance_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(inv.balance_due)}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Notes & Terms */}
      {isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border p-5">
            <Label htmlFor="notes" className="text-sm font-semibold text-gray-700 mb-2 block">Notes</Label>
            <textarea
              id="notes"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px] resize-y"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes..."
            />
          </div>
          {inv.terms_and_conditions && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Terms & Conditions</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{inv.terms_and_conditions}</p>
            </div>
          )}
        </div>
      ) : (
        (inv.notes || inv.terms_and_conditions) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {inv.notes && (
              <div className="bg-white rounded-xl border p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{inv.notes}</p>
              </div>
            )}
            {inv.terms_and_conditions && (
              <div className="bg-white rounded-xl border p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Terms & Conditions</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{inv.terms_and_conditions}</p>
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}
