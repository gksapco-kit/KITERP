import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { TableColumnLabel, CheckboxFieldLabel, FormColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useModalScrollLock } from '@/components/ui/Modal'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { vendorApi } from '@/api/vendor'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useInvoiceSettings, useProducts, useServices, useUpdateInvoice } from '@/hooks/useVendor'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import { ResizableTable } from '@/components/table/ResizableTable'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  Plus, Search, Loader2, FileText,
  X, Eye, IndianRupee, ArrowRight, Download, Trash2, Share2,
  MessageCircle, Mail, Smartphone, Copy, Send, Settings2, CalendarDays, Printer, UserPlus,
} from 'lucide-react'
import { QuickCreateCustomerModal } from '@/components/customers/QuickCreateCustomerModal'
import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import { BranchSelect } from '@/components/common/BranchSelect'
import { SalesScopeFilters } from '@/components/common/SalesScopeFilters'
import { QuotationExtraFieldsEditor } from '@/components/quotations/QuotationExtraFieldsEditor'
import { serializeQuotationExtraFields, type QuotationExtraField } from '@/types/quotation'
import apiClient from '@/api/client'
import { TableToolbar } from '@/components/table/TableToolbar'
import { TablePagination } from '@/components/table/TablePagination'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { processRows, type SortDir } from '@/lib/tableList'
import { ThemeSelect } from '@/components/common/ThemeSelect'
import { printInvoice, type InvoiceSettings } from '@/lib/invoiceTemplates'
import {
  invoiceBadgeClass,
  invoiceNumberLinkClass,
  invoiceRefLinkClass,
  invoiceStatusBadge,
  invoiceTypeBadge,
} from '@/lib/invoiceBadges'

const TABLE_ICON_BTN =
  'inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/70 dark:hover:text-foreground'

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
      color: 'text-green-600 hover:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/15',
      onClick: () => {
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank')
        onClose()
      },
    },
    {
      label: 'Email',
      icon: Mail,
      color: 'text-blue-600 hover:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/15',
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
      color: 'text-muted-foreground hover:bg-muted/60',
      onClick: async () => {
        await navigator.clipboard.writeText(msg)
        toast.success('Invoice message copied to clipboard')
        onClose()
      },
    },
    ...('share' in navigator ? [{
      label: 'More Options',
      icon: Send,
      color: 'text-amber-600 hover:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/15',
      onClick: async () => {
        try {
          await navigator.share({ title: `Invoice ${invoice.invoice_number}`, text: msg })
        } catch { /* user cancelled */ }
        onClose()
      },
    }] : []),
  ]

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 bg-popover text-popover-foreground rounded-xl shadow-xl border border-border w-48 py-1 animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
      <FormColumnLabel className="px-3 py-1.5">Share via</FormColumnLabel>
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
  const [pageSize, setPageSize] = useState(15)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [storeFilter, setStoreFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [salesAreaFilter, setSalesAreaFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [shareOpenId, setShareOpenId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const { data: invSettings } = useInvoiceSettings()

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, pageSize, typeFilter, statusFilter, storeFilter, branchFilter, salesAreaFilter, search],
    queryFn: () => vendorApi.listInvoices({
      page,
      size: pageSize,
      invoice_type: typeFilter || undefined,
      exclude_invoice_type: typeFilter ? undefined : 'estimate',
      status: statusFilter || undefined,
      store_id: branchFilter || storeFilter || undefined,
      sales_area_id: salesAreaFilter || undefined,
      search: search || undefined,
    }),
  })
  const updateInvoice = useUpdateInvoice()
  const { savingCellKey, cellKey, patchField: patchInvoiceField } = useInlineFieldPatch({
    mutateAsync: ({ id, data }) => updateInvoice.mutateAsync({ id, data }),
  })
  const isSaving = (id: string, field: string) => savingCellKey === cellKey(id, field)
  const invoiceStatusOptions = Object.entries(invoiceStatusBadge).map(([value, b]) => ({
    value,
    label: b.label,
  }))

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

  const moreOptionsActiveCount = useMemo(() => {
    let count = 0
    if (typeFilter) count++
    if (statusFilter) count++
    if (salesAreaFilter) count++
    if (sortKey !== 'created_at') count++
    if (sortDir !== 'desc') count++
    return count
  }, [typeFilter, statusFilter, sortKey, sortDir])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Invoices & Billing</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/invoices/templates')} className="gap-2"><Settings2 className="w-4 h-4" />Templates</Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="w-4 h-4" />New Invoice</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search customer, invoice #, phone…"
            searchWrapperClassName="min-w-[12rem] flex-1 sm:flex-none lg:w-72 max-w-full"
            hideSort
            hint={INLINE_EDIT_HINT}
            moreOptionsActiveCount={moreOptionsActiveCount}
            leading={(
              <SalesScopeFilters
                businessUnitId={storeFilter}
                branchId={branchFilter}
                salesAreaId={salesAreaFilter}
                onBusinessUnitChange={(id) => { setStoreFilter(id); setBranchFilter(''); setSalesAreaFilter(''); setPage(1) }}
                onBranchChange={(id) => { setBranchFilter(id); setSalesAreaFilter(''); setPage(1) }}
                onSalesAreaChange={(id) => { setSalesAreaFilter(id); setPage(1) }}
              />
            )}
            moreOptions={(
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-[9.5rem] flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Billing type</label>
                  <ThemeSelect
                    value={typeFilter}
                    onChange={(v) => { setTypeFilter(v); setPage(1) }}
                    placeholder="All Billing Types"
                    aria-label="Billing type"
                    wrapperClassName="w-full min-w-[9.5rem]"
                    options={[
                      { value: '', label: 'All Billing Types' },
                      { value: 'invoice', label: 'Invoices' },
                      { value: 'receipt', label: 'Receipts' },
                      { value: 'credit_note', label: 'Credit Notes' },
                    ]}
                  />
                </div>
                <div className="flex min-w-[9.5rem] flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</label>
                  <ThemeSelect
                    value={statusFilter}
                    onChange={(v) => { setStatusFilter(v); setPage(1) }}
                    placeholder="All Status"
                    aria-label="Status"
                    wrapperClassName="w-full min-w-[9.5rem]"
                    options={[
                      { value: '', label: 'All Status' },
                      { value: 'draft', label: 'Draft' },
                      { value: 'sent', label: 'Sent' },
                      { value: 'paid', label: 'Paid' },
                      { value: 'partially_paid', label: 'Partial' },
                      { value: 'overdue', label: 'Overdue' },
                    ]}
                  />
                </div>
                <div className="flex min-w-[9.5rem] flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sort by</label>
                  <ThemeSelect
                    value={sortKey}
                    onChange={setSortKey}
                    options={[
                      { value: 'created_at', label: 'Date' },
                      { value: 'invoice_number', label: 'Invoice #' },
                      { value: 'customer_name', label: 'Customer' },
                      { value: 'total', label: 'Total' },
                      { value: 'balance_due', label: 'Balance due' },
                      { value: 'status', label: 'Status' },
                      { value: 'invoice_type', label: 'Type' },
                    ]}
                    aria-label="Sort by column"
                    wrapperClassName="w-full min-w-[9.5rem]"
                  />
                </div>
                <div className="flex min-w-[9.5rem] flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Direction</label>
                  <ThemeSelect
                    value={sortDir}
                    onChange={(v) => setSortDir(v as SortDir)}
                    options={[
                      { value: 'asc', label: 'Low → High' },
                      { value: 'desc', label: 'High → Low' },
                    ]}
                    aria-label="Sort direction"
                    wrapperClassName="w-full min-w-[9.5rem]"
                  />
                </div>
              </div>
            )}
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
          <ResizableTable tableId="invoices" defaultWidths={[120, 120, 90, 160, 90, 90, 90, 100, 100]}>
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase"><TableColumnLabel>Invoice #</TableColumnLabel></th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase"><TableColumnLabel>Reference</TableColumnLabel></th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase"><TableColumnLabel>Type</TableColumnLabel></th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase"><TableColumnLabel>Customer</TableColumnLabel></th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase"><TableColumnLabel>Total</TableColumnLabel></th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase"><TableColumnLabel>Due</TableColumnLabel></th>
                <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground uppercase"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase"><TableColumnLabel>Date</TableColumnLabel></th>
                <th className="text-center px-2 py-3 text-xs font-medium text-muted-foreground uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={9} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : !data?.items?.length ? (
                <tr><td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">{search ? 'No invoices match your search' : 'No invoices yet'}</td></tr>
              ) : displayInvoices.map((inv: InvRow) => {
                const tb = invoiceTypeBadge[(inv.invoice_type as string)] || invoiceTypeBadge.invoice
                const sb = invoiceStatusBadge[(inv.status as string)] || invoiceStatusBadge.draft
                return (
                  <tr key={inv.id as string} className="transition-colors hover:bg-muted/40 cursor-pointer"
                    onClick={onClickableTableRow(() => navigate(`/invoices/${inv.id}`))}>
                    <td className="px-5 py-3 text-sm">
                      <button
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                        className={invoiceNumberLinkClass}
                      >
                        {inv.invoice_number as string}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      {inv.booking_id ? (
                        <button
                          onClick={() => navigate(`/bookings/${inv.booking_id}`)}
                          className={invoiceRefLinkClass}
                          title="Open booking"
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          {inv.booking_number as string}
                        </button>
                      ) : inv.order_id ? (
                        <button
                          onClick={() => navigate(`/orders/${inv.order_id}`)}
                          className={invoiceRefLinkClass}
                          title="Open order"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {(inv.order_number as string) || (inv.order_id as string)}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3"><span className={invoiceBadgeClass(tb)}>{tb.label}</span></td>
                    <td className="px-5 py-3 text-sm text-foreground">{(inv.customer_name as string) || '-'}</td>
                    <td className="px-5 py-3 text-sm text-right font-medium text-foreground">
                      <InlineEditCell readOnly readOnlyMessage="Invoice total is calculated from line items" value={inv.total as number} onSave={() => {}} className="text-right font-medium">
                        {formatCurrency(inv.total as number)}
                      </InlineEditCell>
                    </td>
                    <td className="px-5 py-3 text-sm text-right">
                      <InlineEditCell readOnly readOnlyMessage="Balance due is calculated from payments" value={inv.balance_due as number} onSave={() => {}} className="text-right">
                        {(inv.balance_due as number) > 0 ? <span className="text-red-600 dark:text-red-400 font-medium">{formatCurrency(inv.balance_due as number)}</span> : <span className="text-emerald-600 dark:text-emerald-400">Paid</span>}
                      </InlineEditCell>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <InlineEditCell
                        type="select"
                        value={inv.status as string}
                        options={invoiceStatusOptions}
                        saving={isSaving(inv.id as string, 'status')}
                        onSave={(v) => patchInvoiceField(inv.id as string, 'status', v)}
                      >
                        <span className={`${invoiceBadgeClass(sb)} capitalize`}>{inv.status as string}</span>
                      </InlineEditCell>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{formatDate(inv.created_at as string)}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/invoices/${inv.id}`)}
                          title="View invoice"
                          className={TABLE_ICON_BTN}
                          aria-label="View invoice"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => printInvoice(inv as Record<string, unknown>, (invSettings || {}) as Partial<InvoiceSettings>, window.location.origin)}
                          title="Print / Save as PDF"
                          className={TABLE_ICON_BTN}
                          aria-label="Print invoice"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <span className="relative inline-flex">
                          <button
                            type="button"
                            onClick={() => setShareOpenId(shareOpenId === (inv.id as string) ? null : (inv.id as string))}
                            title="Share invoice"
                            className={TABLE_ICON_BTN}
                            aria-label="Share invoice"
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
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </ResizableTable>

          {data && (
            <TablePagination
              page={page}
              pages={data.pages || 1}
              total={data.total ?? 0}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="invoices"
              pageSizeOptions={[10, 15, 25, 50, 100]}
              countSuffix={search ? ` matching "${search}"` : undefined}
            />
          )}
        </CardContent>
      </Card>

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
  item, index, onUpdate, onRemove, catalogue, compact = false,
}: {
  item: { name: string; hsn_sac: string; qty: number; rate: number; discount: number; tax_rate: number }
  index: number
  onUpdate: (field: string, value: string | number) => void
  onRemove: () => void
  catalogue: CatalogueItem[]
  compact?: boolean
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

  const fieldClass = compact
    ? 'w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400'
    : 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400'

  return (
    <div className={cn('flex items-start', compact ? 'gap-1.5' : 'gap-2')}>
      {/* Item name with dropdown */}
      <div className="relative min-w-0 flex-1" ref={wrapRef}>
        <div className="relative">
          <Search className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-400', compact ? 'left-2 h-3 w-3' : 'left-2.5 h-3.5 w-3.5')} />
          <input
            className={cn(fieldClass, 'bg-white', compact ? 'pl-7' : 'pl-8')}
            placeholder="Search product or service…"
            value={item.name}
            onChange={e => { onUpdate('name', e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
          />
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
      <div className={cn('shrink-0', compact ? 'w-24' : 'w-32')}>
        <input className={fieldClass}
          placeholder="HSN" value={item.hsn_sac} onChange={e => onUpdate('hsn_sac', e.target.value)} />
      </div>
      {/* Qty */}
      <div className={cn('shrink-0', compact ? 'w-16' : 'w-28')}>
        <input type="number" min={1} className={cn(fieldClass, 'text-center')}
          value={item.qty} onChange={e => onUpdate('qty', Number(e.target.value))} />
      </div>
      {/* Rate */}
      <div className={cn('shrink-0', compact ? 'w-24' : 'w-36')}>
        <input type="number" min={0} placeholder="Rate" className={fieldClass}
          value={item.rate} onChange={e => onUpdate('rate', Number(e.target.value))} />
      </div>
      {/* Tax % */}
      <div className={cn('shrink-0', compact ? 'w-16' : 'w-24')}>
        <input type="number" min={0} max={100} placeholder="Tax%" className={cn(fieldClass, 'text-center')}
          value={item.tax_rate} onChange={e => onUpdate('tax_rate', Number(e.target.value))} />
      </div>
      {/* Remove */}
      <button onClick={onRemove} className={cn('shrink-0 rounded-lg transition-colors hover:bg-red-50', compact ? 'p-1' : 'mt-0.5 p-2')}>
        <Trash2 className={cn('text-red-400', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
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
  useModalScrollLock()

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
  const [storeId, setStoreId] = useState('')
  const [branchId, setBranchId] = useState('')
  const effectiveStoreId = branchId || storeId
  const isQuotation = defaultType === 'estimate'

  // Catalogue — products + services scoped to the selected business unit
  const { data: productsData } = useProducts({ size: 200, store_id: effectiveStoreId || undefined })
  const { data: servicesData } = useServices({ size: 200, store_id: effectiveStoreId || undefined })
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
        store_id: effectiveStoreId || undefined,
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

  // Portal to body so the overlay covers sidebar + header chrome (page content uses
  // overflow-x-clip, which otherwise traps position:fixed inside the main column).
  return createPortal(
    <div
      data-kiterp-modal
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden overscroll-none bg-black/60 p-2"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={defaultType === 'estimate' ? 'Create Quotation' : 'Create Invoice'}
        className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full mx-4 max-w-4xl max-h-[calc(100dvh-1rem)] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0 px-5 py-2.5">
          <h2 className="text-base font-semibold">
            {defaultType === 'estimate' ? 'Create Quotation' : 'Create Invoice'}
          </h2>
          <button type="button" data-escape-close aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-2.5">
          {/* Business unit — scopes the product/service catalog */}
          <div>
            <Label className="text-xs">Business unit</Label>
            <div className="mt-0.5 flex flex-wrap gap-2">
              <BusinessUnitSelect value={storeId} onChange={(id) => { setStoreId(id); setBranchId('') }} className="flex-1 min-w-[10rem]" />
              <BranchSelect businessUnitId={storeId || null} value={branchId} onChange={setBranchId} allowAll className="flex-1 min-w-[10rem]" />
            </div>
          </div>

          {/* Customer picker */}
          <div className="relative">
            <Label className="text-xs">Select Customer (optional)</Label>
            <div className="mt-0.5 flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  placeholder="Search existing customers…"
                  className="pl-9 h-8 text-sm"
                  value={custSearch}
                  onFocus={() => setCustOpen(true)}
                  onChange={e => { setCustSearch(e.target.value); setCustOpen(true) }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-8 gap-1.5 px-2.5 text-xs shrink-0"
                onClick={() => setShowQuickCreate(true)}
              >
                <UserPlus className="w-3.5 h-3.5" /> Create Customer
              </Button>
            </div>
            {form.customer_name && (
              <p className="text-[11px] text-gray-500 mt-1">
                Selected: <span className="font-medium text-gray-700">{form.customer_name}</span>
                {form.customer_phone ? ` · ${form.customer_phone}` : ''}
              </p>
            )}
            {custOpen && (
              <div className="absolute z-30 left-0 right-0 sm:right-auto sm:pr-[9.5rem] bg-white border rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                {customers.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400">No customers found</p>
                ) : customers.map(c => (
                  <button key={c.id} type="button"
                    className="w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors border-b last:border-0"
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

          {isQuotation ? (
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-end">
              <div>
                <Label className="text-xs">Valid Until</Label>
                <Input
                  type="date"
                  className="mt-0.5 h-8 text-sm"
                  value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs" helpKey="invoice customer gstin">GSTIN</Label>
                <Input className="mt-0.5 h-8 text-sm" value={form.customer_gstin} onChange={e => setForm({ ...form, customer_gstin: e.target.value.toUpperCase() })} maxLength={15} />
              </div>
              <CheckboxFieldLabel
                label="Inter-state (IGST)"
                checked={form.is_inter_state}
                onChange={(is_inter_state) => setForm({ ...form, is_inter_state })}
                helpKey="inter-state supply (igst)"
                className="pb-1.5 whitespace-nowrap"
                labelClassName="text-xs"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-end">
              <div className="sm:col-span-2">
                <Label className="text-xs">Type</Label>
                <Select
                  value={form.invoice_type}
                  onChange={v => setForm({ ...form, invoice_type: v as 'invoice' | 'estimate' | 'credit_note' })}
                  options={[
                    { value: 'estimate', label: 'Estimate' },
                    { value: 'invoice', label: 'Invoice' },
                    { value: 'credit_note', label: 'Credit Note' },
                  ]}
                  triggerClassName="h-8 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs" helpKey="invoice customer gstin">GSTIN</Label>
                <Input className="mt-0.5 h-8 text-sm" value={form.customer_gstin} onChange={e => setForm({ ...form, customer_gstin: e.target.value.toUpperCase() })} maxLength={15} />
              </div>
              <div className="sm:col-span-3">
                <Label className="text-xs">Customer Name</Label>
                <Input className="mt-0.5 h-8 text-sm" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
              </div>
              <div className="sm:col-span-3">
                <Label className="text-xs">Phone</Label>
                <PhoneInput
                  className="mt-0.5"
                  compactCountry
                  value={form.customer_phone}
                  onChange={(v) => setForm({ ...form, customer_phone: v })}
                  defaultCountryIso="IN"
                />
              </div>
              <div className="sm:col-span-2 pb-1.5">
                <CheckboxFieldLabel
                  label="Inter-state (IGST)"
                  checked={form.is_inter_state}
                  onChange={(is_inter_state) => setForm({ ...form, is_inter_state })}
                  helpKey="inter-state supply (igst)"
                  className="whitespace-nowrap"
                  labelClassName="text-xs"
                />
              </div>
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs">Line Items</Label>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={addLine}>
                <Plus className="w-3 h-3 mr-1" />Add Line
              </Button>
            </div>
            <div className="mb-1 flex gap-1.5 px-0.5">
              <FormColumnLabel className="flex-1 min-w-0 text-[10px]">Item</FormColumnLabel>
              <FormColumnLabel className="w-24 shrink-0 text-[10px]">HSN/SAC</FormColumnLabel>
              <FormColumnLabel className="w-16 shrink-0 text-center text-[10px]">Qty</FormColumnLabel>
              <FormColumnLabel className="w-24 shrink-0 text-[10px]">Rate (₹)</FormColumnLabel>
              <FormColumnLabel className="w-16 shrink-0 text-center text-[10px]">Tax %</FormColumnLabel>
              <div className="w-7 shrink-0" />
            </div>
            <div className="space-y-1.5">
              {items.map((item, i) => (
                <ItemSearchRow
                  key={i}
                  item={item}
                  index={i}
                  onUpdate={(field, value) => updateLine(i, field, value)}
                  onRemove={() => removeLine(i)}
                  catalogue={catalogue}
                  compact
                />
              ))}
            </div>
          </div>

          {isQuotation ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Notes</Label>
                <textarea
                  rows={2}
                  className="w-full mt-0.5 text-xs border rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Terms &amp; Conditions</Label>
                <textarea
                  rows={2}
                  className="w-full mt-0.5 text-xs border rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.terms_and_conditions}
                  onChange={e => setForm({ ...form, terms_and_conditions: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs">Notes</Label>
              <textarea
                rows={2}
                className="w-full mt-0.5 text-xs border rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          )}

          {defaultType === 'estimate' && (
            <QuotationExtraFieldsEditor fields={extraFields} onChange={setExtraFields} compact />
          )}
        </div>
        <div className="shrink-0 flex items-center gap-3 px-5 py-2.5">
          <div className="mr-auto flex items-baseline gap-3 text-xs">
            <span className="text-gray-500">Subtotal: <span className="font-medium text-gray-700">{formatCurrency(subtotal)}</span></span>
            <span className="text-gray-500">Tax: <span className="font-medium text-gray-700">{formatCurrency(totalTax)}</span></span>
            <span className="text-sm font-bold text-gray-900">Total: {formatCurrency(Math.round(subtotal + totalTax))}</span>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="cancel" onClick={onClose} className="h-8 px-3 text-sm">Cancel</Button>
            <Button onClick={handleCreate} disabled={loading || !items.some(i => i.name && i.rate > 0)} className="h-8 gap-2 px-3 text-sm">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}Create
            </Button>
          </div>
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
    </div>,
    document.body,
  )
}
