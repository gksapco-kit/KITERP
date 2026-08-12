import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { isDefaultManualVariantName } from '@/lib/productVariants'
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
import { SalesAreaSelect } from '@/components/common/SalesAreaSelect'
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

      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['reports'] }); setShowCreate(false) }} />}
    </div>
  )
}

// ── Item catalogue search row ────────────────────────────────────
interface CatalogueVariant {
  id: string
  name: string
  sku?: string
  price?: number
  tax_rate?: number
  hsn_code?: string
  is_active?: boolean
}

interface CatalogueItem {
  id: string
  name: string
  kind: 'product' | 'service'
  hsn_sac?: string
  price?: number
  tax_rate?: number
  variants?: CatalogueVariant[]
}

type LineItemDraft = {
  name: string
  hsn_sac: string
  qty: number
  rate: number
  discount: number
  tax_rate: number
  product_id?: string
  variant_id?: string
  kind?: 'product' | 'service'
}

function activeVariantsOf(item: CatalogueItem | undefined): CatalogueVariant[] {
  if (!item?.variants?.length) return []
  return item.variants.filter(v => v.is_active !== false)
}

function isSingleDefaultVariant(item: CatalogueItem) {
  const variants = activeVariantsOf(item)
  return variants.length === 1 && isDefaultManualVariantName(variants[0]?.name, false)
}

function ItemSearchRow({
  item, index, onUpdate, onPatch, onRemove, catalogue, compact = false,
}: {
  item: LineItemDraft
  index: number
  onUpdate: (field: string, value: string | number) => void
  onPatch: (patch: Partial<LineItemDraft>) => void
  onRemove: () => void
  catalogue: CatalogueItem[]
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'product' | 'service'>('all')
  const [variantPickFor, setVariantPickFor] = useState<CatalogueItem | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputWrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selectedProduct = useMemo(
    () => (item.product_id ? catalogue.find(c => c.id === item.product_id) : undefined),
    [catalogue, item.product_id],
  )
  const rowVariants = activeVariantsOf(selectedProduct)

  const filtered = useMemo(() => {
    const q = item.name.trim().toLowerCase()
    // When searching after a product was selected, strip the " — Variant" suffix for matching
    const baseQ = q.includes(' — ') ? q.split(' — ')[0] : q
    return catalogue
      .filter(c => tab === 'all' || c.kind === tab)
      .filter(c => !baseQ || c.name.toLowerCase().includes(baseQ) || c.name.toLowerCase().includes(q))
      .slice(0, 12)
  }, [catalogue, item.name, tab])

  const updateMenuPos = useCallback(() => {
    const el = inputWrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 4
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8
    const spaceAbove = rect.top - gap - 8
    const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove
    const maxHeight = Math.max(160, Math.min(320, preferBelow ? spaceBelow : spaceAbove))
    setMenuPos({
      top: preferBelow ? rect.bottom + gap : Math.max(8, rect.top - gap - maxHeight),
      left: rect.left,
      width: Math.max(rect.width, 280),
      maxHeight,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPos()
  }, [open, filtered.length, tab, variantPickFor, updateMenuPos])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => updateMenuPos()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, updateMenuPos])

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const target = e.target
      if (!(target instanceof Node)) return
      if (wrapRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
      setVariantPickFor(null)
    }
    // Capture phase so we beat modal/overlay handlers and still allow row clicks.
    document.addEventListener('mousedown', handle, true)
    return () => document.removeEventListener('mousedown', handle, true)
  }, [open])

  function applyCatalogue(c: CatalogueItem, variant?: CatalogueVariant) {
    const variants = activeVariantsOf(c)
    // Multi-variant products: fill the product on the row, then ask for a variant.
    if (c.kind === 'product' && variants.length > 1 && !variant) {
      onPatch({
        name: c.name,
        hsn_sac: c.hsn_sac || '',
        rate: c.price ?? 0,
        tax_rate: c.tax_rate ?? 18,
        product_id: c.id,
        variant_id: undefined,
        kind: 'product',
      })
      setVariantPickFor(c)
      return
    }
    const chosen = variant ?? (variants.length === 1 ? variants[0] : undefined)
    const collapseDefault = Boolean(
      chosen && isSingleDefaultVariant(c) && variants[0]?.id === chosen.id,
    )
    const displayName =
      chosen && chosen.name && !collapseDefault ? `${c.name} — ${chosen.name}` : c.name
    onPatch({
      name: displayName,
      hsn_sac: chosen?.hsn_code || c.hsn_sac || '',
      rate: chosen?.price ?? c.price ?? 0,
      tax_rate: chosen?.tax_rate ?? c.tax_rate ?? 18,
      product_id: c.kind === 'product' ? c.id : undefined,
      variant_id: chosen?.id,
      kind: c.kind,
    })
    setVariantPickFor(null)
    setOpen(false)
  }

  function applyVariantId(variantId: string) {
    if (!selectedProduct) return
    const variant = rowVariants.find(v => v.id === variantId)
    if (!variant) return
    applyCatalogue(selectedProduct, variant)
  }

  const fieldClass = compact
    ? 'h-8 w-full rounded-md border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400'
    : 'h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

  const menu =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[220] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            {variantPickFor ? (
              <div className="flex max-h-full flex-col" style={{ maxHeight: menuPos.maxHeight }}>
                <div className="flex shrink-0 items-center gap-2 border-b bg-gray-50 px-3 py-2">
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => setVariantPickFor(null)}
                  >
                    ← Back
                  </button>
                  <p className="min-w-0 flex-1 truncate text-xs font-medium text-gray-700">
                    Select variant — {variantPickFor.name}
                  </p>
                  <button
                    type="button"
                    aria-label="Close"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setOpen(false); setVariantPickFor(null) }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <ul className="divide-y divide-gray-50 overflow-y-auto">
                  {activeVariantsOf(variantPickFor).map(v => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => applyCatalogue(variantPickFor, v)}
                        className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-blue-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">{v.name}</p>
                          <p className="text-xs text-gray-400">
                            {v.sku && <span className="mr-2 font-mono">{v.sku}</span>}
                            {v.price != null && <span className="mr-2">₹{Number(v.price).toFixed(2)}</span>}
                            {v.tax_rate != null && <span>{v.tax_rate}% tax</span>}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex max-h-full flex-col" style={{ maxHeight: menuPos.maxHeight }}>
                <div className="flex shrink-0 gap-1 border-b bg-gray-50 px-2 pt-1.5">
                  {(['all', 'product', 'service'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => setTab(t)}
                      className={`rounded-t-lg px-3 py-1 text-xs font-medium capitalize transition-colors ${tab === t ? 'border border-b-white border-gray-200 bg-white text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {t === 'all' ? 'All' : t === 'product' ? '📦 Products' : '⚙️ Services'}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Close"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => setOpen(false)}
                    className="ml-auto p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {filtered.length === 0 ? (
                  <p className="py-4 text-center text-xs text-gray-400">
                    {item.name.trim() ? `No matches for "${item.name}"` : 'Start typing to search…'}
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-50 overflow-y-auto">
                    {filtered.map(c => {
                      const vCount = activeVariantsOf(c).length
                      const needsVariantPick = c.kind === 'product' && vCount > 1
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => applyCatalogue(c)}
                            className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-blue-50"
                          >
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${c.kind === 'product' ? 'bg-blue-100 text-blue-700' : 'bg-primary/12 text-primary'}`}>
                              {c.kind === 'product' ? '📦' : '⚙️'}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-gray-800">{c.name}</p>
                              <p className="text-xs text-gray-400">
                                {c.hsn_sac && <span className="mr-2">HSN {c.hsn_sac}</span>}
                                {c.price != null && <span className="mr-2">₹{c.price.toFixed(2)}</span>}
                                {c.tax_rate != null && <span className="mr-2">{c.tax_rate}% tax</span>}
                                {vCount > 0 && <span className="text-blue-600">{vCount} variant{vCount === 1 ? '' : 's'}</span>}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs capitalize text-gray-300">
                              {needsVariantPick ? 'Choose →' : c.kind}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <div className="shrink-0 border-t bg-gray-50 px-3 py-2 text-xs text-gray-400">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''} · Click a row to select
                </div>
              </div>
            )}
          </div>,
          document.body,
        )
      : null

  return (
    <div className={cn('flex items-start', compact ? 'gap-1.5' : 'gap-2')}>
      <div className={cn('shrink-0 text-center text-gray-400 font-medium', compact ? 'w-6 pt-1.5 text-[10px]' : 'w-7 pt-2.5 text-xs')}>
        {index + 1}
      </div>
      <div className="relative min-w-0 flex-[2.4]" ref={wrapRef}>
        <div className="relative" ref={inputWrapRef}>
          <Search className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-400', compact ? 'left-2 h-3 w-3' : 'left-2.5 h-3.5 w-3.5')} />
          <input
            className={cn(fieldClass, 'bg-white', compact ? 'pl-7' : 'pl-8')}
            placeholder="Search product or service…"
            value={item.name}
            onChange={e => {
              onPatch({
                name: e.target.value,
                product_id: undefined,
                variant_id: undefined,
                kind: undefined,
              })
              setVariantPickFor(null)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
          />
        </div>
        {menu}
      </div>

      {/* Variant (when product has multiple) */}
      <div className="min-w-0 flex-1">
        {rowVariants.length > 1 ? (
          <Select
            className={cn(fieldClass, 'bg-white')}
            triggerClassName={compact ? 'h-8 px-2 text-xs' : 'h-10 px-3 text-sm'}
            value={item.variant_id || ''}
            onChange={applyVariantId}
            placeholder="Select variant…"
            options={rowVariants.map(v => ({
              value: v.id,
              label: `${v.name}${v.price != null ? ` · ₹${Number(v.price).toFixed(0)}` : ''}`,
            }))}
          />
        ) : (
          <input
            className={cn(fieldClass, 'bg-gray-50 text-gray-400')}
            value={rowVariants[0]?.name || (item.kind === 'service' ? '—' : '')}
            readOnly
            tabIndex={-1}
            placeholder="Variant"
            title={rowVariants[0]?.name || 'No variants'}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <input className={fieldClass}
          placeholder="HSN" value={item.hsn_sac} onChange={e => onUpdate('hsn_sac', e.target.value)} />
      </div>
      <div className="w-14 shrink-0">
        <input type="number" min={1} className={cn(fieldClass, 'text-center')}
          value={item.qty} onChange={e => onUpdate('qty', Number(e.target.value))} />
      </div>
      <div className="min-w-0 flex-1">
        <input type="number" min={0} placeholder="Rate" className={fieldClass}
          value={item.rate} onChange={e => onUpdate('rate', Number(e.target.value))} />
      </div>
      <div className="w-14 shrink-0">
        <input type="number" min={0} max={100} placeholder="Tax%" className={cn(fieldClass, 'text-center')}
          value={item.tax_rate} onChange={e => onUpdate('tax_rate', Number(e.target.value))} />
      </div>
      <button type="button" onClick={onRemove} className={cn('shrink-0 rounded-lg transition-colors hover:bg-red-50', compact ? 'p-1' : 'mt-0.5 p-2')}>
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
    items?: LineItemDraft[]
  }
}) {
  useEscapeToClose(onClose)
  useModalScrollLock()

  const [form, setForm] = useState({
    invoice_type: defaultType,
    order_id: prefill?.order_id || '',
    customer_id: '',
    sales_area_id: '',
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
  const [items, setItems] = useState<LineItemDraft[]>(
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
      id: p.id,
      name: p.name,
      kind: 'product' as const,
      hsn_sac: p.hsn_code || '',
      price: p.price ?? p.selling_price ?? 0,
      tax_rate: p.tax_rate ?? p.gst_rate ?? 18,
      variants: (p.variants || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        price: v.price ?? 0,
        tax_rate: v.tax_rate ?? v.gst_rate ?? p.tax_rate ?? p.gst_rate ?? 18,
        hsn_code: v.hsn_code || p.hsn_code || '',
        is_active: v.is_active !== false,
      })),
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
  const customers: Array<{
    id: string
    full_name: string
    phone?: string
    email?: string
    gstin?: string
    sales_area_id?: string | null
  }> = custData ?? []

  const applyCustomer = (c: {
    id?: string
    full_name: string
    phone?: string
    email?: string
    gstin?: string
    sales_area_id?: string | null
  }) => {
    setForm(f => ({
      ...f,
      customer_id: c.id || f.customer_id,
      customer_name: c.full_name,
      customer_phone: c.phone || f.customer_phone,
      customer_email: c.email || f.customer_email,
      customer_gstin: c.gstin || f.customer_gstin,
      // Prefill from customer master; leave the current pick if the customer has none.
      sales_area_id: c.sales_area_id || f.sales_area_id,
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
  const patchLine = useCallback((i: number, patch: Partial<LineItemDraft>) => {
    setItems(prev => {
      const updated = [...prev]
      updated[i] = { ...updated[i], ...patch }
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
        customer_id: form.customer_id || undefined,
        sales_area_id: form.sales_area_id || undefined,
        items: items.map(({ name, hsn_sac, qty, rate, discount, tax_rate }) => ({
          name, hsn_sac, qty, rate, discount, tax_rate,
        })),
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
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-2.5">
          <h2 className="text-base font-semibold">
            {defaultType === 'estimate' ? 'Create Quotation' : 'Create Invoice'}
          </h2>
          <button type="button" data-escape-close aria-label="Close" onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-2.5">
          {/* Header: 3-column grid so labels and controls share one right edge */}
          <div className="relative">
            <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-3">
              <div className="min-w-0">
                <Label className="text-xs">Business unit</Label>
                <BusinessUnitSelect
                  value={storeId}
                  onChange={(id) => { setStoreId(id); setBranchId('') }}
                  className="mt-0.5 min-w-0 w-full"
                  triggerClassName="h-8"
                />
              </div>
              <div className="min-w-0">
                <Label className="text-xs">Branch</Label>
                <BranchSelect
                  businessUnitId={storeId || null}
                  value={branchId}
                  onChange={setBranchId}
                  allowAll
                  className="mt-0.5 min-w-0 w-full"
                  triggerClassName="h-8"
                />
              </div>
              <div className="min-w-0">
                <Label className="text-xs">Sales Area</Label>
                <SalesAreaSelect
                  businessUnitId={storeId || null}
                  branchId={branchId || null}
                  value={form.sales_area_id}
                  onChange={(sales_area_id) => setForm((f) => ({ ...f, sales_area_id }))}
                  allowAll={false}
                  requireBusinessUnit={false}
                  className="mt-0.5 min-w-0 w-full"
                  triggerClassName="h-8"
                />
              </div>

              <div className="relative min-w-0 sm:col-span-2">
                <Label className="text-xs">{isQuotation ? 'Select Customer (optional)' : 'Customer'}</Label>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={isQuotation ? 'Search customers…' : 'Search or create a customer…'}
                      className="h-8 w-full pl-8 pr-8 text-sm"
                      value={custSearch}
                      onFocus={() => setCustOpen(true)}
                      onChange={e => {
                        const v = e.target.value
                        setCustSearch(v)
                        setCustOpen(true)
                        if (!isQuotation && !v.trim()) {
                          setForm(f => ({
                            ...f,
                            customer_id: '',
                            customer_name: '',
                            customer_phone: '',
                            customer_email: '',
                            customer_gstin: '',
                          }))
                        }
                      }}
                    />
                    {custSearch ? (
                      <button
                        type="button"
                        aria-label="Clear customer"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setCustSearch('')
                          setCustOpen(false)
                          if (!isQuotation) {
                            setForm(f => ({
                              ...f,
                              customer_id: '',
                              customer_name: '',
                              customer_phone: '',
                              customer_email: '',
                              customer_gstin: '',
                            }))
                          }
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 shrink-0 gap-1 px-2.5 text-xs"
                    onClick={() => setShowQuickCreate(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Create</span>
                  </Button>
                </div>
                {custOpen && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                    {customers.length === 0 ? (
                      <p className="px-3 py-2.5 text-sm text-muted-foreground">No customers found</p>
                    ) : customers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full border-b border-border px-3 py-2 text-left transition-colors last:border-0 hover:bg-muted/60"
                        onClick={() => applyCustomer(c)}
                      >
                        <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                        <p className="text-xs text-muted-foreground">{[c.phone, c.gstin].filter(Boolean).join(' · ')}</p>
                      </button>
                    ))}
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40"
                      onClick={() => setCustOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>

              {isQuotation ? (
                <div className="min-w-0">
                  <Label className="text-xs">Valid Until</Label>
                  <Input
                    type="date"
                    className="mt-0.5 h-8 w-full text-sm"
                    value={form.due_date}
                    onChange={e => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
              ) : (
                <div className="min-w-0">
                  <Label className="text-xs" helpKey="invoice customer gstin">GSTIN</Label>
                  <Input
                    className="mt-0.5 h-8 w-full font-mono text-sm tracking-wide"
                    value={form.customer_gstin}
                    onChange={e => setForm({ ...form, customer_gstin: e.target.value.toUpperCase() })}
                    maxLength={15}
                    placeholder="Optional"
                  />
                </div>
              )}

              {isQuotation ? (
                <div className="min-w-0">
                  <Label className="text-xs" helpKey="invoice customer gstin">GSTIN</Label>
                  <Input
                    className="mt-0.5 h-8 w-full font-mono text-sm tracking-wide"
                    value={form.customer_gstin}
                    onChange={e => setForm({ ...form, customer_gstin: e.target.value.toUpperCase() })}
                    maxLength={15}
                    placeholder="Optional"
                  />
                </div>
              ) : (
                <div className="min-w-0">
                  <Label className="text-xs">Phone</Label>
                  <PhoneInput
                    className="mt-0.5 [&_[data-phone-input]]:h-8 [&_[data-phone-input]]:sm:h-8"
                    compact
                    compactCountry
                    value={form.customer_phone}
                    onChange={(v) => setForm({ ...form, customer_phone: v })}
                    defaultCountryIso="IN"
                  />
                </div>
              )}

              {!isQuotation && (
                <div className="min-w-0">
                  <Label className="text-xs">Due date</Label>
                  <Input
                    type="date"
                    className="mt-0.5 h-8 w-full text-sm"
                    value={form.due_date}
                    onChange={e => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
              )}

              <div className={cn('min-w-0', isQuotation && 'sm:col-span-2')}>
                <Label className="text-xs">GST</Label>
                <div className="mt-0.5 flex h-8 items-center">
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
            </div>
            {isQuotation && form.customer_name && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{form.customer_name}</span>
                {form.customer_phone ? ` · ${form.customer_phone}` : ''}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/20 px-2.5 py-2">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <Label className="text-xs">Line items</Label>
              <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1 px-2.5 text-xs" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" />Add line
              </Button>
            </div>
            <div className="mb-1 flex gap-1.5 px-0.5">
              <FormColumnLabel className="w-6 shrink-0 text-center text-[10px]">#</FormColumnLabel>
              <FormColumnLabel className="min-w-0 flex-[2.4] text-[10px]">Item</FormColumnLabel>
              <FormColumnLabel className="min-w-0 flex-1 text-[10px]">Variant</FormColumnLabel>
              <FormColumnLabel className="min-w-0 flex-1 text-[10px]">HSN/SAC</FormColumnLabel>
              <FormColumnLabel className="w-14 shrink-0 text-center text-[10px]">Qty</FormColumnLabel>
              <FormColumnLabel className="min-w-0 flex-1 text-[10px]">Rate (₹)</FormColumnLabel>
              <FormColumnLabel className="w-14 shrink-0 text-center text-[10px]">Tax %</FormColumnLabel>
              <div className="w-7 shrink-0" />
            </div>
            <div className="space-y-1.5">
              {items.map((item, i) => (
                <ItemSearchRow
                  key={i}
                  item={item}
                  index={i}
                  onUpdate={(field, value) => updateLine(i, field, value)}
                  onPatch={(patch) => patchLine(i, patch)}
                  onRemove={() => removeLine(i)}
                  catalogue={catalogue}
                  compact
                />
              ))}
            </div>
          </div>

          {isQuotation ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="min-w-0">
                <Label className="text-xs">Notes</Label>
                <textarea
                  rows={2}
                  className="mt-0.5 w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Internal or customer-facing notes…"
                />
              </div>
              <div className="min-w-0">
                <Label className="text-xs">Terms &amp; Conditions</Label>
                <textarea
                  rows={2}
                  className="mt-0.5 w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
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
                className="mt-0.5 w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Payment notes, delivery instructions…"
              />
            </div>
          )}

          {defaultType === 'estimate' && (
            <QuotationExtraFieldsEditor fields={extraFields} onChange={setExtraFields} compact />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 border-t border-border px-5 py-2.5">
          <div className="mr-auto flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
            <span className="text-muted-foreground">Subtotal: <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span></span>
            <span className="text-muted-foreground">Tax: <span className="font-medium text-foreground">{formatCurrency(totalTax)}</span></span>
            <span className="text-sm font-semibold text-foreground">Total: {formatCurrency(Math.round(subtotal + totalTax))}</span>
          </div>
          <div className="flex shrink-0 gap-2">
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
              id: c.id,
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
