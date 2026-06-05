import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { vendorApi } from '@/api/vendor'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useInvoiceSettings, useProducts, useServices } from '@/hooks/useVendor'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ResizableTable } from '@/components/table/ResizableTable'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  Plus, Search, Loader2, FileText, ChevronLeft, ChevronRight,
  X, Eye, IndianRupee, ArrowRight, Download, Trash2, Share2,
  MessageCircle, Mail, Smartphone, Copy, Send, Settings2, CalendarDays, Printer, UserPlus,
} from 'lucide-react'
import { QuickCreateCustomerModal } from '@/components/customers/QuickCreateCustomerModal'
import { QuotationExtraFieldsEditor } from '@/components/quotations/QuotationExtraFieldsEditor'
import { serializeQuotationExtraFields, type QuotationExtraField } from '@/types/quotation'
import apiClient from '@/api/client'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { printInvoice } from '@/lib/invoiceTemplates'
import type { InvoiceSettings } from '@/lib/invoiceTemplates'

const statusBadge: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
  sent: { bg: 'bg-blue-50', text: 'text-blue-700' },
  paid: { bg: 'bg-green-50', text: 'text-green-700' },
  partially_paid: { bg: 'bg-amber-50', text: 'text-amber-700' },
  overdue: { bg: 'bg-red-50', text: 'text-red-700' },
  cancelled: { bg: 'bg-gray-50', text: 'text-gray-500' },
}

const typeBadge: Record<string, { bg: string; text: string; label: string }> = {
  estimate: { bg: 'bg-accent', text: 'text-primary', label: 'Estimate' },
  invoice: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Invoice' },
  receipt: { bg: 'bg-green-50', text: 'text-green-700', label: 'Receipt' },
  credit_note: { bg: 'bg-red-50', text: 'text-red-700', label: 'Credit Note' },
}

async function downloadInvoicePdf(id: string, invoiceNumber: string) {
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
    toast.error('Could not download invoice PDF — the invoice may not have been generated yet')
  }
}

function getShareMessage(invoiceNumber: string, total: number) {
  return `Hi! Please find your invoice ${invoiceNumber} for ₹${total.toFixed(2)}. Thank you for your business!`
}

function ShareMenu({ invoice, onClose }: {
  invoice: { id: string; invoice_number: string; total: number; customer_phone?: string; customer_email?: string }
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const msg = getShareMessage(invoice.invoice_number, invoice.total)
  const cleanPhone = (invoice.customer_phone || '').replace(/\D/g, '')
  const pdfUrl = `${window.location.origin}/api/v1/vendors/me/invoices/${invoice.id}/pdf`

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const shareOptions = [
    {
      label: 'WhatsApp',
      icon: MessageCircle,
      color: 'text-green-600 hover:bg-green-50',
      onClick: () => {
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank')
        onClose()
      },
    },
    {
      label: 'Email',
      icon: Mail,
      color: 'text-blue-600 hover:bg-blue-50',
      onClick: () => {
        const subject = encodeURIComponent(`Invoice ${invoice.invoice_number}`)
        const body = encodeURIComponent(msg)
        const to = invoice.customer_email || ''
        window.open(`mailto:${to}?subject=${subject}&body=${body}`, '_self')
        onClose()
      },
    },
    {
      label: 'SMS',
      icon: Smartphone,
      color: 'text-primary hover:bg-accent',
      onClick: () => {
        window.open(`sms:${cleanPhone}?body=${encodeURIComponent(msg)}`, '_self')
        onClose()
      },
    },
    {
      label: 'Copy Text',
      icon: Copy,
      color: 'text-gray-600 hover:bg-gray-50',
      onClick: async () => {
        await navigator.clipboard.writeText(msg)
        toast.success('Invoice message copied to clipboard')
        onClose()
      },
    },
    ...('share' in navigator ? [{
      label: 'More Options',
      icon: Send,
      color: 'text-amber-600 hover:bg-amber-50',
      onClick: async () => {
        try {
          await navigator.share({ title: `Invoice ${invoice.invoice_number}`, text: msg })
        } catch { /* user cancelled */ }
        onClose()
      },
    }] : []),
  ]

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border w-48 py-1 animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
      <p className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase">Share via</p>
      {shareOptions.map((opt) => (
        <button
          key={opt.label}
          onClick={opt.onClick}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${opt.color}`}
        >
          <opt.icon className="w-4 h-4" />
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function InvoicesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [shareOpenId, setShareOpenId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const { data: invSettings } = useInvoiceSettings()

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, typeFilter, statusFilter],
    queryFn: () => vendorApi.listInvoices({
      page,
      size: 15,
      invoice_type: typeFilter || undefined,
      exclude_invoice_type: typeFilter ? undefined : 'estimate',
      status: statusFilter || undefined,
    }),
  })

  type InvRow = Record<string, unknown>
  const displayInvoices = useMemo(() => {
    if (!data?.items?.length) return []
    return processRows(
      data.items as InvRow[],
      '',
      () => [],
      sortKey,
      sortDir,
      {
        invoice_number: (r) => r.invoice_number,
        invoice_type: (r) => r.invoice_type,
        customer_name: (r) => r.customer_name || '',
        total: (r) => Number(r.total),
        balance_due: (r) => Number(r.balance_due),
        status: (r) => r.status,
        created_at: (r) => r.created_at,
      },
    )
  }, [data?.items, sortKey, sortDir])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Invoices & Billing</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/invoices/templates')} className="gap-2"><Settings2 className="w-4 h-4" />Templates</Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="w-4 h-4" />New Invoice</Button>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <select className="text-sm border rounded-lg px-3 py-2" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}>
          <option value="">All Billing Types</option>
          <option value="invoice">Invoices</option>
          <option value="receipt">Receipts</option>
          <option value="credit_note">Credit Notes</option>
        </select>
        <select className="text-sm border rounded-lg px-3 py-2" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="partially_paid">Partial</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search=""
            onSearchChange={() => {}}
            hideSearch
            hint="Sorting applies to the current page."
            sortOptions={[
              { value: 'created_at', label: 'Date' },
              { value: 'invoice_number', label: 'Invoice #' },
              { value: 'customer_name', label: 'Customer' },
              { value: 'total', label: 'Total' },
              { value: 'balance_due', label: 'Balance due' },
              { value: 'status', label: 'Status' },
              { value: 'invoice_type', label: 'Type' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
          />
          <ResizableTable tableId="invoices" defaultWidths={[120, 120, 90, 160, 90, 90, 90, 100, 80]}>
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Reference</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase">Due</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={9} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : !data?.items?.length ? (
                <tr><td colSpan={9} className="py-12 text-center text-sm text-gray-500">No invoices yet</td></tr>
              ) : displayInvoices.map((inv: InvRow) => {
                const tb = typeBadge[(inv.invoice_type as string)] || typeBadge.invoice
                const sb = statusBadge[(inv.status as string)] || statusBadge.draft
                return (
                  <tr key={inv.id as string} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm font-medium">
                      <button
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {inv.invoice_number as string}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      {inv.booking_id ? (
                        <button
                          onClick={() => navigate(`/bookings/${inv.booking_id}`)}
                          className="flex items-center gap-1 text-xs font-mono text-indigo-600 hover:text-indigo-800 hover:underline"
                          title="Open booking"
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          {inv.booking_number as string}
                        </button>
                      ) : inv.order_id ? (
                        <button
                          onClick={() => navigate(`/orders/${inv.order_id}`)}
                          className="flex items-center gap-1 text-xs font-mono text-blue-600 hover:text-blue-800 hover:underline"
                          title="Open order"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {(inv.order_number as string) || (inv.order_id as string)}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tb.bg} ${tb.text}`}>{tb.label}</span></td>
                    <td className="px-5 py-3 text-sm text-gray-600">{(inv.customer_name as string) || '-'}</td>
                    <td className="px-5 py-3 text-sm text-right font-medium">{formatCurrency(inv.total as number)}</td>
                    <td className="px-5 py-3 text-sm text-right">{(inv.balance_due as number) > 0 ? <span className="text-red-600 font-medium">{formatCurrency(inv.balance_due as number)}</span> : <span className="text-green-600">Paid</span>}</td>
                    <td className="px-5 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sb.bg} ${sb.text}`}>{inv.status as string}</span></td>
                    <td className="px-5 py-3 text-sm text-gray-500">{formatDate(inv.created_at as string)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => navigate(`/invoices/${inv.id}`)}
                          title="View invoice"
                          className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => printInvoice(inv as Record<string, unknown>, (invSettings || {}) as Partial<InvoiceSettings>, window.location.origin)}
                          title="Print / Save as PDF"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <div className="relative">
                          <button
                            onClick={() => setShareOpenId(shareOpenId === (inv.id as string) ? null : (inv.id as string))}
                            title="Share invoice"
                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          {shareOpenId === (inv.id as string) && (
                            <ShareMenu
                              invoice={{
                                id: inv.id as string,
                                invoice_number: inv.invoice_number as string,
                                total: inv.total as number,
                                customer_phone: inv.customer_phone as string | undefined,
                                customer_email: inv.customer_email as string | undefined,
                              }}
                              onClose={() => setShareOpenId(null)}
                            />
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </ResizableTable>
        </CardContent>
      </Card>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {page} of {data.pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ['invoices'] }); setShowCreate(false) }} />}
    </div>
  )
}

// ── Item catalogue search row ────────────────────────────────────
interface CatalogueItem {
  id: string; name: string; kind: 'product' | 'service'
  hsn_sac?: string; price?: number; tax_rate?: number
}

function ItemSearchRow({
  item, index, onUpdate, onRemove, catalogue,
}: {
  item: { name: string; hsn_sac: string; qty: number; rate: number; discount: number; tax_rate: number }
  index: number
  onUpdate: (field: string, value: string | number) => void
  onRemove: () => void
  catalogue: CatalogueItem[]
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'product' | 'service'>('all')
  const wrapRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = item.name.trim().toLowerCase()
    return catalogue
      .filter(c => tab === 'all' || c.kind === tab)
      .filter(c => !q || c.name.toLowerCase().includes(q))
      .slice(0, 12)
  }, [catalogue, item.name, tab])

  // close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function apply(c: CatalogueItem) {
    onUpdate('name', c.name)
    onUpdate('hsn_sac', c.hsn_sac || '')
    onUpdate('rate', c.price ?? 0)
    onUpdate('tax_rate', c.tax_rate ?? 18)
    setOpen(false)
  }

  return (
    <div className="flex gap-2 items-start">
      {/* Item name with dropdown */}
      <div className="flex-1 relative" ref={wrapRef}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            placeholder="Search product or service…"
            value={item.name}
            onChange={e => { onUpdate('name', e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
          />
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Tabs */}
            <div className="flex border-b bg-gray-50 px-2 pt-1.5 gap-1">
              {(['all', 'product', 'service'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded-t-lg text-xs font-medium capitalize transition-colors ${tab === t ? 'bg-white border border-b-white border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t === 'all' ? 'All' : t === 'product' ? '📦 Products' : '⚙️ Services'}
                </button>
              ))}
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="ml-auto p-1 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" /></button>
            </div>

            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                {item.name.trim() ? `No matches for "${item.name}"` : 'Start typing to search…'}
              </p>
            ) : (
              <ul className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                {filtered.map(c => (
                  <li key={c.id}>
                    <button
                      onMouseDown={e => { e.preventDefault(); apply(c) }}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-3"
                    >
                      <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${c.kind === 'product' ? 'bg-blue-100 text-blue-700' : 'bg-primary/12 text-primary'}`}>
                        {c.kind === 'product' ? '📦' : '⚙️'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400">
                          {c.hsn_sac && <span className="mr-2">HSN {c.hsn_sac}</span>}
                          {c.price != null && <span className="mr-2">₹{c.price.toFixed(2)}</span>}
                          {c.tax_rate != null && <span>{c.tax_rate}% tax</span>}
                        </p>
                      </div>
                      <span className="text-xs text-gray-300 capitalize shrink-0">{c.kind}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-400">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} · Select to auto-fill details
            </div>
          </div>
        )}
      </div>

      {/* HSN */}
      <div className="w-32 shrink-0">
        <input className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="HSN" value={item.hsn_sac} onChange={e => onUpdate('hsn_sac', e.target.value)} />
      </div>
      {/* Qty */}
      <div className="w-28 shrink-0">
        <input type="number" min={1} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-center"
          value={item.qty} onChange={e => onUpdate('qty', Number(e.target.value))} />
      </div>
      {/* Rate */}
      <div className="w-36 shrink-0">
        <input type="number" min={0} placeholder="Rate" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={item.rate} onChange={e => onUpdate('rate', Number(e.target.value))} />
      </div>
      {/* Tax % */}
      <div className="w-24 shrink-0">
        <input type="number" min={0} max={100} placeholder="Tax%" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-center"
          value={item.tax_rate} onChange={e => onUpdate('tax_rate', Number(e.target.value))} />
      </div>
      {/* Remove */}
      <button onClick={onRemove} className="p-2 mt-0.5 rounded-lg hover:bg-red-50 transition-colors shrink-0">
        <Trash2 className="w-4 h-4 text-red-400" />
      </button>
    </div>
  )
}

export function CreateInvoiceModal({
  onClose,
  onCreated,
  defaultType = 'invoice',
  prefill,
}: {
  onClose: () => void
  onCreated: (created?: Record<string, unknown>) => void
  defaultType?: 'invoice' | 'estimate' | 'credit_note'
  prefill?: {
    customer_name?: string
    customer_email?: string
    customer_phone?: string
    customer_gstin?: string
    notes?: string
    order_id?: string
    items?: Array<{ name: string; hsn_sac: string; qty: number; rate: number; discount: number; tax_rate: number }>
  }
}) {
  useEscapeToClose(onClose)

  const [form, setForm] = useState({
    invoice_type: defaultType,
    order_id: prefill?.order_id || '',
    customer_name: prefill?.customer_name || '',
    customer_email: prefill?.customer_email || '',
    customer_phone: prefill?.customer_phone || '',
    customer_gstin: prefill?.customer_gstin || '',
    place_of_supply: '',
    is_inter_state: false,
    notes: prefill?.notes || '',
    due_date: '',
    terms_and_conditions: defaultType === 'estimate'
      ? 'This quotation is valid until the date shown above. Prices are subject to change after expiry.'
      : '',
  })
  const [items, setItems] = useState(
    prefill?.items?.length
      ? prefill.items
      : [{ name: '', hsn_sac: '', qty: 1, rate: 0, discount: 0, tax_rate: 18 }],
  )
  const [loading, setLoading] = useState(false)
  const [custSearch, setCustSearch] = useState('')
  const [custOpen, setCustOpen] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [extraFields, setExtraFields] = useState<QuotationExtraField[]>([])
  const isQuotation = defaultType === 'estimate'

  // Catalogue — load products + services once
  const { data: productsData } = useProducts({ size: 200 })
  const { data: servicesData } = useServices({ size: 200 })
  const catalogue = useMemo<CatalogueItem[]>(() => {
    const prods = (productsData?.items ?? []).map((p: any) => ({
      id: p.id, name: p.name, kind: 'product' as const,
      hsn_sac: p.hsn_code || '', price: p.price ?? p.selling_price ?? 0,
      tax_rate: p.tax_rate ?? p.gst_rate ?? 18,
    }))
    const svcs = (servicesData?.items ?? []).map((s: any) => ({
      id: s.id, name: s.name, kind: 'service' as const,
      hsn_sac: s.sac_code || s.hsn_sac || '', price: s.price ?? s.base_price ?? 0,
      tax_rate: s.tax_rate ?? s.gst_rate ?? 18,
    }))
    return [...prods, ...svcs]
  }, [productsData, servicesData])

  const { data: custData } = useQuery({
    queryKey: ['customers-lookup', custSearch],
    queryFn: () => vendorApi.listCustomers({ search: custSearch || undefined, size: 10 }).then(r => r.items ?? []),
    enabled: custOpen,
    staleTime: 30_000,
  })
  const customers: Array<{ id: string; full_name: string; phone?: string; email?: string; gstin?: string }> = custData ?? []

  const applyCustomer = (c: {
    full_name: string
    phone?: string
    email?: string
    gstin?: string
  }) => {
    setForm(f => ({
      ...f,
      customer_name: c.full_name,
      customer_phone: c.phone || f.customer_phone,
      customer_email: c.email || f.customer_email,
      customer_gstin: c.gstin || f.customer_gstin,
    }))
    setCustOpen(false)
    setCustSearch(c.full_name)
  }

  const addLine = () => setItems([...items, { name: '', hsn_sac: '', qty: 1, rate: 0, discount: 0, tax_rate: 18 }])
  const removeLine = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const updateLine = useCallback((i: number, field: string, value: string | number) => {
    setItems(prev => {
      const updated = [...prev]
      updated[i] = { ...updated[i], [field]: value }
      return updated
    })
  }, [])

  const subtotal = items.reduce((s, i) => s + i.qty * i.rate, 0)
  const totalTax = items.reduce((s, i) => {
    const taxable = i.qty * i.rate - i.discount
    return s + taxable * i.tax_rate / 100
  }, 0)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const payload = {
        ...form,
        order_id: form.order_id || undefined,
        items,
        ...(isQuotation ? { extra_fields: serializeQuotationExtraFields(extraFields) } : {}),
      }
      const created = await vendorApi.createInvoice(payload)
      toast.success(defaultType === 'estimate' ? 'Quotation created!' : 'Invoice created!')
      onCreated(created as Record<string, unknown>)
    } catch (err) {
      toast.error(extractApiError(err, 'Could not create document — check customer and line item details'))
    }
    setLoading(false)
  }

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8" onClick={onClose}>
      <div
        className={`bg-white rounded-xl shadow-xl w-full mx-4 max-h-[90vh] overflow-y-auto ${isQuotation ? 'max-w-5xl' : 'max-w-3xl'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {defaultType === 'estimate' ? 'Create Quotation' : 'Create Invoice'}
          </h2>
          <button type="button" data-escape-close aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Customer picker */}
          <div className="relative">
            <Label>Select Customer (optional)</Label>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search existing customers…"
                  className="pl-9"
                  value={custSearch}
                  onFocus={() => setCustOpen(true)}
                  onChange={e => { setCustSearch(e.target.value); setCustOpen(true) }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 shrink-0"
                onClick={() => setShowQuickCreate(true)}
              >
                <UserPlus className="w-4 h-4" /> Create Customer
              </Button>
            </div>
            {form.customer_name && (
              <p className="text-xs text-gray-500 mt-1.5">
                Selected: <span className="font-medium text-gray-700">{form.customer_name}</span>
                {form.customer_phone ? ` · ${form.customer_phone}` : ''}
              </p>
            )}
            {custOpen && (
              <div className="absolute z-30 left-0 right-0 sm:right-auto sm:pr-[9.5rem] bg-white border rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                {customers.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400">No customers found</p>
                ) : customers.map(c => (
                  <button key={c.id} type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors border-b last:border-0"
                    onClick={() => applyCustomer(c)}
                  >
                    <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                    <p className="text-xs text-gray-500">{[c.phone, c.gstin].filter(Boolean).join(' · ')}</p>
                  </button>
                ))}
                <button type="button" className="w-full px-4 py-2 text-xs text-gray-400 hover:bg-gray-50" onClick={() => setCustOpen(false)}>
                  Close
                </button>
              </div>
            )}
          </div>

          <div className={`grid grid-cols-1 gap-4 ${isQuotation ? 'sm:grid-cols-2' : 'sm:grid-cols-12'}`}>
            {defaultType === 'invoice' ? (
              <div className="sm:col-span-3">
                <Label>Type</Label>
                <select className="w-full mt-1 text-sm border rounded-lg px-3 py-2" value={form.invoice_type} onChange={e => setForm({ ...form, invoice_type: e.target.value as 'invoice' | 'estimate' | 'credit_note' })}>
                  <option value="estimate">Estimate</option><option value="invoice">Invoice</option><option value="credit_note">Credit Note</option>
                </select>
              </div>
            ) : (
              <div>
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            )}
            <div className={isQuotation ? undefined : 'sm:col-span-3'}>
              <Label>GSTIN</Label>
              <Input className="mt-1" value={form.customer_gstin} onChange={e => setForm({ ...form, customer_gstin: e.target.value.toUpperCase() })} maxLength={15} />
            </div>
            {!isQuotation && (
              <>
                <div className="sm:col-span-4">
                  <Label>Customer Name</Label>
                  <Input className="mt-1" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
                </div>
                <div className="sm:col-span-5">
                  <Label>Phone</Label>
                  <PhoneInput
                    className="mt-1"
                    compactCountry
                    value={form.customer_phone}
                    onChange={(v) => setForm({ ...form, customer_phone: v })}
                    defaultCountryIso="IN"
                  />
                </div>
              </>
            )}
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_inter_state} onChange={e => setForm({ ...form, is_inter_state: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-sm">Inter-state supply (IGST)</span></label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <Label>Line Items</Label>
                <p className="text-xs text-gray-400 mt-0.5">Type to search your products &amp; services — select to auto-fill details</p>
              </div>
              <Button variant="outline" size="sm" onClick={addLine}><Plus className="w-3 h-3 mr-1" />Add Line</Button>
            </div>
            {/* Column headers */}
            <div className="flex gap-2 mb-1 px-0.5">
              <p className="flex-1 min-w-0 text-xs font-medium text-gray-400 uppercase">Item</p>
              <p className="w-32 shrink-0 text-xs font-medium text-gray-400 uppercase">HSN/SAC</p>
              <p className="w-28 shrink-0 text-xs font-medium text-gray-400 uppercase text-center">Qty</p>
              <p className="w-36 shrink-0 text-xs font-medium text-gray-400 uppercase">Rate (₹)</p>
              <p className="w-24 shrink-0 text-xs font-medium text-gray-400 uppercase text-center">Tax %</p>
              <div className="w-10 shrink-0" />
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <ItemSearchRow
                  key={i}
                  item={item}
                  index={i}
                  onUpdate={(field, value) => updateLine(i, field, value)}
                  onRemove={() => removeLine(i)}
                  catalogue={catalogue}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end"><div className="text-right space-y-1">
            <p className="text-sm text-gray-500">Subtotal: {formatCurrency(subtotal)}</p>
            <p className="text-sm text-gray-500">Tax: {formatCurrency(totalTax)}</p>
            <p className="text-lg font-bold">Total: {formatCurrency(Math.round(subtotal + totalTax))}</p>
          </div></div>

          <div><Label>Notes</Label><textarea className="w-full mt-1 text-sm border rounded-lg px-3 py-2 min-h-[60px]" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          {defaultType === 'estimate' && (
            <>
              <QuotationExtraFieldsEditor fields={extraFields} onChange={setExtraFields} />
              <div>
                <Label>Terms &amp; Conditions</Label>
                <textarea
                  className="w-full mt-1 text-sm border rounded-lg px-3 py-2 min-h-[60px]"
                  value={form.terms_and_conditions}
                  onChange={e => setForm({ ...form, terms_and_conditions: e.target.value })}
                />
              </div>
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <Button variant="cancel" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading || !items.some(i => i.name && i.rate > 0)} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}Create
          </Button>
        </div>
      </div>

      {showQuickCreate && (
        <QuickCreateCustomerModal
          onSelect={(c) => {
            applyCustomer({
              full_name: c.full_name,
              phone: c.phone,
              email: c.email,
            })
            setShowQuickCreate(false)
          }}
          onClose={() => setShowQuickCreate(false)}
          returnTo="?returnTo=quotations"
        />
      )}
    </div>
  )
}
