import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import { usePersistedPageSize } from '@/hooks/usePersistedPageSize'
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
import { useInvoiceSettings, useQuotationSettings, useProducts, useServices, useUpdateInvoice, useRestoreInvoice } from '@/hooks/useVendor'
import { useHasPermission } from '@/hooks/usePermissions'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { resolveServiceDisplayAmount } from '@/lib/servicePricing'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import { ResizableTable } from '@/components/table/ResizableTable'
import { toast } from 'sonner'
import { extractApiError, isAxiosNetworkError } from '@/lib/errorMessages'
import { createdDocMessage, pickDocNo } from '@/lib/documentToast'
import {
  Plus, Search, Loader2, FileText,
  X, Eye, IndianRupee, ArrowRight, Download, Trash2, Share2, RotateCcw,
  MessageCircle, Mail, Smartphone, Copy, Send, Settings2, CalendarDays, Printer, UserPlus,
} from 'lucide-react'
import { CopyFromDocumentField } from '@/components/procurement/CopyFromDocumentField'
import { SALES_DOC_COPY_FROM_KEY, salesInvoiceToCopyPrefill } from '@/lib/copyDocument'
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
import type { InvoiceSettings } from '@/lib/invoiceTemplates'
import { previewDocumentNumber } from '@/lib/invoiceNumberPreview'
import { useAuthStore } from '@/stores/authStore'
import {
  invoiceBadgeClass,
  invoiceNumberLinkClass,
  invoiceRefLinkClass,
  invoiceStatusBadge,
  invoiceTypeBadge,
} from '@/lib/invoiceBadges'
import { onAuthenticatedAnchorClick } from '@/lib/openAuthenticatedTab'
import { InvoiceCreateTotalsPanel } from '@/components/invoices/InvoiceCreateTotalsPanel'
import { INVOICE_PENDING_CUSTOMER_KEY } from '@/pages/master-data/MasterDataNew'
import {
  invoiceAdditionalChargesForSave,
  normalizeInvoiceAdditionalCharges,
  type InvoiceAdditionalChargeRow,
} from '@/lib/invoiceAdditionalCharges'
import {
  computeInvoiceTotalsPreview,
  discountPctFromLine,
  lineGrossTotal,
  lineTaxTotal,
} from '@/lib/invoiceTotalsPreview'

const TABLE_ICON_BTN =
  'inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/70 dark:hover:text-foreground'

async function downloadInvoicePdf(id: string, invSettings: Partial<InvoiceSettings>) {
  try {
    const inv = await vendorApi.getInvoice(id)
    const { downloadInvoiceWithTemplate } = await import('@/lib/invoiceTemplates')
    await downloadInvoiceWithTemplate(inv as Record<string, unknown>, invSettings)
  } catch {
    toast.error('Could not download invoice PDF — check template settings and try again')
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
  const [pageSize, setPageSize] = usePersistedPageSize('invoices')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [storeFilter, setStoreFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [salesAreaFilter, setSalesAreaFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [copyPrefill, setCopyPrefill] = useState<ReturnType<typeof salesInvoiceToCopyPrefill> | undefined>()
  const [shareOpenId, setShareOpenId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const { data: invSettings } = useInvoiceSettings()
  const canManageInvoice = useHasPermission('invoices.manage')
  const restoreInvoice = useRestoreInvoice()

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    const rawCustomer = sessionStorage.getItem(INVOICE_PENDING_CUSTOMER_KEY)
    if (rawCustomer) {
      sessionStorage.removeItem(INVOICE_PENDING_CUSTOMER_KEY)
      try {
        const c = JSON.parse(rawCustomer) as {
          id?: string
          full_name?: string
          phone?: string
          email?: string
        }
        if (c?.id && c.full_name) {
          setCopyPrefill({
            customer_id: c.id,
            customer_name: c.full_name,
            customer_phone: c.phone,
            customer_email: c.email,
          })
          setShowCreate(true)
          return
        }
      } catch { /* fall through */ }
    }

    const raw = sessionStorage.getItem(SALES_DOC_COPY_FROM_KEY)
    if (!raw) return
    sessionStorage.removeItem(SALES_DOC_COPY_FROM_KEY)
    try {
      const parsed = JSON.parse(raw) as { id?: string }
      if (!parsed?.id) return
      vendorApi.getInvoice(parsed.id).then(inv => {
        setCopyPrefill(salesInvoiceToCopyPrefill(inv as Record<string, unknown>))
        setShowCreate(true)
      }).catch(() => toast.error('Could not copy that invoice'))
    } catch { /* ignore */ }
  }, [])

  const {
    data,
    isPending,
    isFetching,
    isError,
    error,
    refetch,
    failureCount,
  } = useQuery({
    queryKey: ['invoices', page, pageSize, typeFilter, statusFilter, storeFilter, branchFilter, salesAreaFilter, search, showDeleted],
    queryFn: () => vendorApi.listInvoices({
      page,
      size: pageSize,
      invoice_type: typeFilter || undefined,
      exclude_invoice_type: typeFilter ? undefined : 'estimate',
      status: showDeleted ? undefined : (statusFilter || undefined),
      store_id: branchFilter || storeFilter || undefined,
      sales_area_id: salesAreaFilter || undefined,
      search: search || undefined,
      deleted: showDeleted || undefined,
    }),
    enabled: isAuthenticated,
    retry: (count, err) => isAxiosNetworkError(err) && count < 2,
    retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 8_000),
  })
  const listLoading = isAuthenticated && (isPending || (isFetching && data === undefined))
  const { data: trashMeta } = useQuery({
    queryKey: ['invoices', 'trash-count'],
    queryFn: () => vendorApi.listInvoices({ deleted: true, page: 1, size: 1, exclude_invoice_type: 'estimate' }),
    enabled: canManageInvoice,
    retry: (failureCount, err) => isAxiosNetworkError(err) && failureCount < 2,
  })
  const trashCount = trashMeta?.total ?? 0
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">{showDeleted ? 'Deleted invoices' : 'Invoices & Billing'}</h1>
        <div className="flex flex-wrap justify-end gap-2">
          {canManageInvoice ? (
            <Button
              variant={showDeleted ? 'default' : 'outline'}
              onClick={() => { setShowDeleted(v => !v); setPage(1) }}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Deleted
              {!showDeleted && trashCount > 0 ? (
                <span className="rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                  {trashCount}
                </span>
              ) : null}
            </Button>
          ) : null}
          {!showDeleted ? (
            <>
              <Button variant="outline" onClick={() => navigate('/invoices/templates')} className="gap-2"><Settings2 className="w-4 h-4" />Templates</Button>
              <Button onClick={() => { setCopyPrefill(undefined); setShowCreate(true) }} className="gap-2"><Plus className="w-4 h-4" />New Invoice</Button>
            </>
          ) : null}
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
          <ResizableTable tableId="invoices-v2" defaultWidths={[120, 120, 90, 160, 90, 90, 90, 130, 100]}>
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
              {!isAuthenticated ? (
                <tr><td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">Sign in to view invoices.</td></tr>
              ) : listLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    {failureCount > 0 ? (
                      <p className="text-xs">Still trying to reach the server…</p>
                    ) : null}
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground space-y-2">
                    <p className="text-red-600 dark:text-red-400">{extractApiError(error, 'Could not load invoices')}</p>
                    <p className="text-xs">If this persists after a refresh, confirm the API is up (port 8000) or hard-refresh the page after Vite reloads.</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
                  </td>
                </tr>
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
                    <td className="px-5 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(inv.created_at as string)}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {showDeleted && canManageInvoice ? (
                          <button
                            type="button"
                            onClick={() => restoreInvoice.mutate(inv.id as string)}
                            disabled={restoreInvoice.isPending && restoreInvoice.variables === inv.id}
                            title="Restore invoice"
                            className={TABLE_ICON_BTN}
                            aria-label="Restore invoice"
                          >
                            {restoreInvoice.isPending && restoreInvoice.variables === inv.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4 text-emerald-600" />
                            )}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => navigate(`/invoices/${inv.id}`)}
                          title="View invoice"
                          className={TABLE_ICON_BTN}
                          aria-label="View invoice"
                        >
                          <Eye className="w-4 h-4 text-green-600" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const { printInvoice } = await import('@/lib/invoiceTemplates')
                            printInvoice(inv as Record<string, unknown>, (invSettings || {}) as Partial<InvoiceSettings>, window.location.origin)
                          }}
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
              pageSizeOptions={[10, 15, 25, 50, 100, 500, 1000]}
              countSuffix={search ? ` matching "${search}"` : undefined}
            />
          )}
        </CardContent>
      </Card>

      {showCreate && (
        <CreateInvoiceModal
          prefill={copyPrefill}
          onClose={() => { setShowCreate(false); setCopyPrefill(undefined) }}
          onCreated={() => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['reports'] }); setShowCreate(false); setCopyPrefill(undefined) }}
        />
      )}
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
  /** Stable id so description and inputs stay tied to this row when lines are reordered */
  lineKey: string
  name: string
  description: string
  /** Editable variant name (manual entry or from catalogue); merged into API description on save */
  variant_label: string
  /** Shown under Variant; merged into API description on save */
  variant_note: string
  /** Shown under HSN/SAC; merged into API description on save */
  hsn_note: string
  /** Shown under Qty; merged into API description on save */
  qty_note: string
  /** Shown under Rate; merged into API description on save */
  rate_note: string
  /** Shown under Tax %; merged into API description on save */
  tax_note: string
  hsn_sac: string
  qty: number
  rate: number
  discount: number
  /** UI-only; kept in sync when qty/rate/discount changes; API stores flat discount only */
  discount_pct: number
  tax_rate: number
  product_id?: string
  variant_id?: string
  kind?: 'product' | 'service'
}

const VARIANT_NOTE_TAG = '[Variant note]'
const HSN_NOTE_TAG = '[HSN note]'
const QTY_NOTE_TAG = '[Qty note]'
const RATE_NOTE_TAG = '[Rate note]'
const TAX_NOTE_TAG = '[Tax note]'

const LINE_NOTE_TAGS: Array<{
  key: 'variant_note' | 'hsn_note' | 'qty_note' | 'rate_note' | 'tax_note'
  tag: string
}> = [
  { key: 'variant_note', tag: VARIANT_NOTE_TAG },
  { key: 'hsn_note', tag: HSN_NOTE_TAG },
  { key: 'qty_note', tag: QTY_NOTE_TAG },
  { key: 'rate_note', tag: RATE_NOTE_TAG },
  { key: 'tax_note', tag: TAX_NOTE_TAG },
]

/** Split stored API description into main + per-column notes */
function parseLineDescription(raw?: string): Pick<
  LineItemDraft,
  'description' | 'variant_label' | 'variant_note' | 'hsn_note' | 'qty_note' | 'rate_note' | 'tax_note'
> {
  const s = String(raw || '')
  const hits = LINE_NOTE_TAGS.map(({ key, tag }) => ({ key, tag, idx: s.indexOf(tag) }))
    .filter(h => h.idx >= 0)
  const empty = {
    description: s,
    variant_label: '',
    variant_note: '',
    hsn_note: '',
    qty_note: '',
    rate_note: '',
    tax_note: '',
  }
  if (hits.length === 0) return empty

  hits.sort((a, b) => a.idx - b.idx)
  const description = s.slice(0, hits[0].idx).trimEnd()
  const stripLead = (t: string) => t.replace(/^\s*\n?/, '').trim()
  const out = { ...empty, description }
  for (let i = 0; i < hits.length; i++) {
    const { key, tag, idx } = hits[i]
    const start = idx + tag.length
    const end = i + 1 < hits.length ? hits[i + 1].idx : s.length
    out[key] = stripLead(s.slice(start, end))
  }
  if (out.variant_note && !out.variant_label) {
    const lines = out.variant_note.split('\n')
    out.variant_label = lines[0] || ''
    out.variant_note = lines.slice(1).join('\n').trim()
  }
  return out
}

function mergeLineDescriptionForApi(row: LineItemDraft): string | undefined {
  const main = (row.description || '').trim()
  const blocks: string[] = []
  if (main) blocks.push(main)
  const variantCombined = [(row.variant_label || '').trim(), (row.variant_note || '').trim()]
    .filter(Boolean)
    .join('\n')
  if (variantCombined) blocks.push(`${VARIANT_NOTE_TAG}\n${variantCombined}`)
  for (const { key, tag } of LINE_NOTE_TAGS) {
    if (key === 'variant_note') continue
    const t = (row[key] || '').trim()
    if (t) blocks.push(`${tag}\n${t}`)
  }
  const out = blocks.join('\n\n').trim()
  return out || undefined
}

function newLineKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `li-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function emptySalesLine(): LineItemDraft {
  return {
    lineKey: newLineKey(),
    name: '',
    description: '',
    variant_label: '',
    variant_note: '',
    hsn_note: '',
    qty_note: '',
    rate_note: '',
    tax_note: '',
    hsn_sac: '',
    qty: 1,
    rate: 0,
    discount: 0,
    discount_pct: 0,
    tax_rate: 18,
  }
}

function syncLineDiscountFromPct(row: LineItemDraft, qty?: number, rate?: number): LineItemDraft {
  const q = qty ?? row.qty
  const r = rate ?? row.rate
  const base = Number(q) * Number(r)
  const pct = Math.max(0, Math.min(100, Number(row.discount_pct) || 0))
  if (pct > 0 && base > 0) {
    return { ...row, qty: q, rate: r, discount: Math.round(base * pct) / 100, discount_pct: pct }
  }
  const disc = Math.max(0, Math.min(base, Number(row.discount) || 0))
  return {
    ...row,
    qty: q,
    rate: r,
    discount: disc,
    discount_pct: base > 0 ? Math.round((disc / base) * 10000) / 100 : 0,
  }
}

/** Top Rate field must be a number > 0 (text in the note row does not count). */
function isValidInvoiceLine(row: LineItemDraft): boolean {
  const name = (row.name || '').trim()
  const rate = Number(row.rate)
  const qty = Number(row.qty)
  return (
    name.length > 0
    && Number.isFinite(rate)
    && rate > 0
    && Number.isFinite(qty)
    && qty > 0
  )
}

function createInvoiceBlockReason(
  items: LineItemDraft[],
  opts: {
    isQuotation: boolean
    customerId: string
    customerName: string
    invoiceNumberAvailable?: boolean
  },
): string | null {
  if (!opts.isQuotation) {
    const hasCustomer = Boolean(opts.customerId) || Boolean((opts.customerName || '').trim())
    if (!hasCustomer) return 'Select or create a customer.'
  }
  if (opts.invoiceNumberAvailable === false) {
    return 'This invoice number is already used — change the sequence or prefix.'
  }
  if (items.some(isValidInvoiceLine)) return null
  if (!items.some(i => (i.name || '').trim())) {
    return 'Add at least one line item with an item name.'
  }
  if (!items.some(i => Number(i.qty) > 0)) {
    return 'Enter quantity greater than 0.'
  }
  return 'Enter a unit rate greater than 0 in the top Rate box (not the “Rate note” line below).'
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
  item, index, onUpdate, onPatch, onRemove, catalogue, compact = false, isInterState = false,
}: {
  item: LineItemDraft
  index: number
  onUpdate: (field: string, value: string | number) => void
  onPatch: (patch: Partial<LineItemDraft>) => void
  onRemove: () => void
  catalogue: CatalogueItem[]
  compact?: boolean
  isInterState?: boolean
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
        description: '',
        variant_label: '',
        variant_note: '',
        hsn_note: '',
        qty_note: '',
        rate_note: '',
        tax_note: '',
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
      description: '',
      variant_label: chosen?.name || '',
      variant_note: '',
      hsn_note: '',
      qty_note: '',
      rate_note: '',
      tax_note: '',
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
    ? 'h-7 w-full rounded-md border border-gray-200 px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400'
    : 'h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

  const taxRateOptions = useMemo(() => {
    const rates = new Set([0, 5, 12, 18, 28, Number(item.tax_rate) || 0])
    return [...rates].sort((a, b) => a - b).map(v => ({ value: String(v), label: `${v}%` }))
  }, [item.tax_rate])

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
                  <div className="px-3 py-4 text-center text-xs text-gray-400">
                    <p>{item.name.trim() ? `No matches for "${item.name}"` : 'Start typing to search…'}</p>
                    <p className="mt-2">
                      <a
                        href="/products/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        onMouseDown={e => e.preventDefault()}
                        onClick={onAuthenticatedAnchorClick}
                      >
                        Add product
                      </a>
                      {' / '}
                      <a
                        href="/services/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        onMouseDown={e => e.preventDefault()}
                        onClick={onAuthenticatedAnchorClick}
                      >
                        service
                      </a>
                    </p>
                  </div>
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

  const noteFieldClass = compact
    ? 'h-6 w-full rounded border border-gray-200 px-1.5 text-[10px] leading-tight text-muted-foreground placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400'
    : 'h-9 w-full rounded-lg border border-gray-200 px-2 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-400'

  return (
    <div
      className={cn(
        compact ? 'rounded-md border border-border/60 bg-background px-1 py-1' : 'space-y-1',
      )}
    >
    <div className={cn('flex items-start', compact ? 'gap-1' : 'gap-2')}>
      <div className={cn('shrink-0 text-center text-gray-400 font-medium', compact ? 'w-5 pt-1 text-[9px]' : 'w-7 pt-2.5 text-xs')}>
        {index + 1}
      </div>
      {/* Item + line description (stacked) */}
      <div className={cn('flex min-w-0 flex-col gap-0.5', compact ? 'min-w-[5rem] flex-[1.15]' : 'flex-[1.5]')} ref={wrapRef}>
        <div className="relative" ref={inputWrapRef}>
          <Search className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-400', compact ? 'left-1.5 h-3 w-3' : 'left-2.5 h-3.5 w-3.5')} />
          <input
            className={cn(fieldClass, 'bg-white', compact ? 'pl-6' : 'pl-8')}
            placeholder="Search product or service…"
            value={item.name}
            onChange={e => {
              // Only clearing identity when the search text changes — keep per-line description
              onPatch({
                name: e.target.value,
                product_id: undefined,
                variant_id: undefined,
                variant_label: '',
                kind: undefined,
              })
              setVariantPickFor(null)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
          />
        {menu}
        </div>
        <input
          className={noteFieldClass}
          placeholder={compact ? 'Item description' : 'Description (optional)'}
          aria-label={`Line ${index + 1} item description`}
          value={item.description}
          onChange={e => onUpdate('description', e.target.value)}
        />
      </div>

      {/* Variant + note under it */}
      <div className={cn('flex min-w-0 shrink-0 flex-col gap-0.5', compact ? 'w-[6.25rem] sm:w-24' : 'w-36')}>
        {rowVariants.length > 1 ? (
          <Select
            className={cn(fieldClass, 'bg-white')}
            triggerClassName={compact ? 'h-7 px-1.5 text-[11px]' : 'h-10 px-3 text-sm'}
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
            className={cn(fieldClass, 'bg-white')}
            placeholder="Variant"
            aria-label={`Line ${index + 1} variant`}
            value={item.variant_label || rowVariants[0]?.name || ''}
            onChange={e => onUpdate('variant_label', e.target.value)}
          />
        )}
        <input
          className={noteFieldClass}
          placeholder="Variant note"
          aria-label={`Line ${index + 1} variant note`}
          value={item.variant_note}
          onChange={e => onUpdate('variant_note', e.target.value)}
        />
      </div>

      {/* HSN + HSN note under it */}
      <div className={cn('flex min-w-0 shrink-0 flex-col gap-0.5', compact ? 'w-20 sm:w-[5.25rem]' : 'w-28')}>
        <input
          className={fieldClass}
          placeholder="HSN"
          value={item.hsn_sac}
          onChange={e => onUpdate('hsn_sac', e.target.value)}
        />
        <input
          className={noteFieldClass}
          placeholder="HSN note"
          aria-label={`Line ${index + 1} HSN note`}
          value={item.hsn_note}
          onChange={e => onUpdate('hsn_note', e.target.value)}
        />
      </div>

      <div className="flex w-[4.25rem] shrink-0 flex-col gap-0.5 sm:w-24">
        <input type="number" min={1} className={cn(fieldClass, 'text-center')}
          value={item.qty} onChange={e => onUpdate('qty', Number(e.target.value))} />
        <input
          className={noteFieldClass}
          placeholder="Qty note"
          aria-label={`Line ${index + 1} quantity note`}
          value={item.qty_note}
          onChange={e => onUpdate('qty_note', e.target.value)}
        />
      </div>
      <div className="flex w-[6.5rem] shrink-0 flex-col gap-0.5 sm:w-[7.25rem]">
        <div className="relative">
          <span className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-400', compact ? 'left-1 text-[10px]' : 'left-2 text-xs')}>₹</span>
          <input
            type="number"
            min={0}
            step="any"
            placeholder="0.00"
            title="Price per item"
            className={cn(fieldClass, compact ? 'pl-4' : 'pl-6')}
            value={Number.isFinite(item.rate) ? item.rate : ''}
            onChange={e => {
              const n = parseFloat(e.target.value)
              onUpdate('rate', Number.isFinite(n) ? n : 0)
            }}
          />
        </div>
        <input
          className={noteFieldClass}
          placeholder="Rate note"
          aria-label={`Line ${index + 1} rate note`}
          value={item.rate_note}
          onChange={e => onUpdate('rate_note', e.target.value)}
        />
      </div>
      <div className="flex w-[5.25rem] shrink-0 flex-col gap-0.5 sm:w-24">
        <div className="relative">
          <span className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-400', compact ? 'left-1 text-[10px]' : 'left-2 text-xs')}>₹</span>
          <input
            type="number"
            min={0}
            step="any"
            title="Discount amount"
            className={cn(fieldClass, compact ? 'pl-4' : 'pl-6')}
            value={Number.isFinite(item.discount) ? item.discount : ''}
            onChange={e => {
              const n = parseFloat(e.target.value)
              const disc = Number.isFinite(n) ? Math.max(0, n) : 0
              const base = item.qty * item.rate
              const capped = Math.min(disc, base)
              const pct = base > 0 ? Math.round((capped / base) * 10000) / 100 : 0
              onPatch({ discount: capped, discount_pct: pct })
            }}
          />
        </div>
        <div className="relative">
          <input
            type="number"
            min={0}
            max={100}
            step="any"
            title="Discount %"
            placeholder="%"
            className={cn(fieldClass, 'pr-4 text-center')}
            value={Number.isFinite(item.discount_pct) ? item.discount_pct : ''}
            onChange={e => {
              const n = parseFloat(e.target.value)
              const pct = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0
              const base = item.qty * item.rate
              onPatch({ discount_pct: pct, discount: base > 0 ? Math.round(base * pct) / 100 : 0 })
            }}
          />
          <span className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-400', compact ? 'right-1 text-[10px]' : 'right-2 text-xs')}>%</span>
        </div>
      </div>
      <div className="flex w-[4.75rem] shrink-0 flex-col gap-0.5 sm:w-[5.25rem]">
        <Select
          className={cn(fieldClass, 'bg-white px-0.5')}
          triggerClassName={compact ? 'h-7 px-1 text-[11px]' : 'h-10 px-2 text-sm'}
          value={String(item.tax_rate)}
          onChange={v => onUpdate('tax_rate', Number(v))}
          options={taxRateOptions}
          aria-label={`Line ${index + 1} tax rate`}
        />
        <p className={cn('text-center text-gray-500 leading-tight', compact ? 'text-[9px]' : 'text-[10px]')}>
          ({formatCurrency(lineTaxTotal(item, isInterState))})
        </p>
      </div>
      <div className={cn('flex shrink-0 flex-col justify-start', compact ? 'w-[5.5rem] sm:w-24' : 'w-28')}>
        <div
          className={cn(
            'flex w-full items-center justify-end rounded-md border border-gray-200 bg-gray-50 font-medium text-gray-800',
            compact ? 'h-7 px-1 text-[11px]' : 'h-10 px-2 text-sm',
          )}
          title="Line total (after discount + tax)"
        >
          {formatCurrency(lineGrossTotal(item, isInterState))}
        </div>
        <input
          className={noteFieldClass}
          placeholder="Tax note"
          aria-label={`Line ${index + 1} tax note`}
          value={item.tax_note}
          onChange={e => onUpdate('tax_note', e.target.value)}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className={cn(
          'shrink-0 self-start rounded-md transition-colors hover:bg-red-50',
          compact ? 'p-0.5 pt-1' : 'mt-0.5 p-2',
        )}
      >
        <Trash2 className={cn('text-red-400', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      </button>
    </div>
    </div>
  )
}

function parseNetDaysFromTerms(terms: string): number | null {
  const t = terms.trim()
  if (!t) return null
  if (/due\s+on\s+receipt/i.test(t)) return 0
  const m = t.match(/(\d+)\s*days?/i)
  return m ? parseInt(m[1], 10) : null
}

function formatNetTerms(days: number): string {
  if (days === 0) return 'Due on receipt'
  return `Net ${days} day${days === 1 ? '' : 's'}`
}

function addDaysToDateString(isoDate: string, days: number): string {
  const d = new Date(isoDate.slice(0, 10))
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetweenInvoiceAndDue(invoiceDate: string, dueDate: string): number | null {
  if (!invoiceDate || !dueDate) return null
  const a = new Date(invoiceDate.slice(0, 10))
  const b = new Date(dueDate.slice(0, 10))
  const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000)
  return diff >= 0 ? diff : null
}

type PoPickRow = { id: string; po_number: string; supplier_name?: string; status?: string }

function PurchaseOrderRefPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (poNumber: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open) setQuery(value)
  }, [value, open])

  const canPickPo = useHasPermission('procurement.view')
  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['invoice-create-po-picker', debounced],
    queryFn: () => vendorApi.listPurchaseOrders({ size: 100, search: debounced || undefined }),
    enabled: open && canPickPo,
    staleTime: 20_000,
  })
  const rows = (data?.items ?? []) as PoPickRow[]

  return (
    <div className="relative min-w-0">
      <Label className="text-xs">PO / order ref (on print)</Label>
      <div className="relative mt-0.5">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 w-full pl-8 pr-8 font-mono text-sm"
          placeholder="Search or select a purchase order…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => {
            setQuery(e.target.value)
            onChange(e.target.value)
            setOpen(true)
          }}
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear PO reference"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setQuery('')
              onChange('')
              setOpen(false)
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">Shown in the invoice meta box with due date.</p>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {!canPickPo ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              You need procurement view access to pick a PO. You can still type a reference manually above.
            </p>
          ) : isFetching ? (
            <p className="flex items-center justify-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading POs…
            </p>
          ) : isError ? (
            <p className="px-3 py-3 text-xs text-red-600">{extractApiError(error, 'Could not load purchase orders')}</p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">No purchase orders found.</p>
          ) : (
            rows.map(po => (
              <button
                key={po.id}
                type="button"
                className="w-full border-b border-border px-3 py-2 text-left transition-colors last:border-0 hover:bg-muted/60"
                onClick={() => {
                  const num = po.po_number || ''
                  setQuery(num)
                  onChange(num)
                  setOpen(false)
                }}
              >
                <p className="font-mono text-sm font-medium text-foreground">{po.po_number}</p>
                <p className="text-xs text-muted-foreground">
                  {[po.supplier_name, po.status?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
                </p>
              </button>
            ))
          )}
          <button
            type="button"
            className="w-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      ) : null}
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
    customer_id?: string
    customer_name?: string
    customer_email?: string
    customer_phone?: string
    customer_gstin?: string
    notes?: string
    terms_and_conditions?: string
    place_of_supply?: string
    is_inter_state?: boolean
    sales_area_id?: string
    store_id?: string
    order_id?: string
    items?: LineItemDraft[]
  }
}) {
  useEscapeToClose(onClose)
  useModalScrollLock()

  const todayIso = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    invoice_type: defaultType,
    order_id: prefill?.order_id || '',
    order_number: '',
    customer_id: prefill?.customer_id || '',
    sales_area_id: prefill?.sales_area_id || '',
    customer_name: prefill?.customer_name || '',
    customer_email: prefill?.customer_email || '',
    customer_phone: prefill?.customer_phone || '',
    customer_gstin: prefill?.customer_gstin || '',
    place_of_supply: prefill?.place_of_supply || '',
    is_inter_state: prefill?.is_inter_state || false,
    notes: prefill?.notes || '',
    invoice_date: todayIso,
    posting_date: todayIso,
    due_date: '',
    payment_terms: '',
    terms_and_conditions: prefill?.terms_and_conditions || (defaultType === 'estimate'
      ? 'This quotation is valid until the date shown above. Prices are subject to change after expiry.'
      : ''),
    number_prefix: '',
    number_suffix: '',
    number_sequence: '',
  })
  const [items, setItems] = useState<LineItemDraft[]>(
    prefill?.items?.length
      ? prefill.items.map((row) => {
        const fromApi = parseLineDescription(row.description ?? '')
        return ({
          lineKey: row.lineKey ?? newLineKey(),
          name: row.name ?? '',
          description: fromApi.description,
          variant_label: fromApi.variant_label,
          variant_note: fromApi.variant_note,
          hsn_note: fromApi.hsn_note,
          qty_note: fromApi.qty_note,
          rate_note: fromApi.rate_note,
          tax_note: fromApi.tax_note,
          hsn_sac: row.hsn_sac ?? '',
          qty: row.qty ?? 1,
          rate: row.rate ?? 0,
          discount: row.discount ?? 0,
          discount_pct: discountPctFromLine({
            qty: row.qty ?? 1,
            rate: row.rate ?? 0,
            discount: row.discount ?? 0,
            tax_rate: row.tax_rate ?? 18,
          }),
          tax_rate: row.tax_rate ?? 18,
          product_id: row.product_id,
          variant_id: row.variant_id,
          kind: row.kind,
        })
      })
      : [emptySalesLine()],
  )
  const [loading, setLoading] = useState(false)
  const [copyLoading, setCopyLoading] = useState(false)
  const [copiedFromNumber, setCopiedFromNumber] = useState<string | null>(null)
  const [custSearch, setCustSearch] = useState(prefill?.customer_name || '')
  const [custOpen, setCustOpen] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [extraFields, setExtraFields] = useState<QuotationExtraField[]>([])
  const [additionalCharges, setAdditionalCharges] = useState<InvoiceAdditionalChargeRow[]>([])
  const [discountAmount, setDiscountAmount] = useState(0)
  const [paymentReceived, setPaymentReceived] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [markFullyPaid, setMarkFullyPaid] = useState(false)
  const [storeId, setStoreId] = useState(prefill?.store_id || '')
  const [branchId, setBranchId] = useState('')
  const effectiveStoreId = branchId || storeId
  const isQuotation = defaultType === 'estimate'
  const { data: invSettings } = useInvoiceSettings()
  const { data: quoteSettings } = useQuotationSettings()
  const savedNumbering = isQuotation ? quoteSettings : invSettings
  const defaultDocPrefix = defaultType === 'estimate' ? 'EST' : defaultType === 'credit_note' ? 'CN' : 'INV'
  const parsedSequence = form.number_sequence.trim()
    ? Math.max(1, parseInt(form.number_sequence, 10) || 1)
    : undefined

  const { data: numberPreview, isFetching: numberPreviewLoading } = useQuery({
    queryKey: [
      'invoice-number-preview',
      defaultType,
      form.number_prefix,
      form.number_suffix,
      parsedSequence,
    ],
    queryFn: () => vendorApi.previewInvoiceNumber({
      invoice_type: defaultType,
      number_prefix: form.number_prefix,
      number_suffix: form.number_suffix,
      number_sequence: parsedSequence,
    }),
    staleTime: 4_000,
  })

  const docNumberPreview = numberPreview?.invoice_number
    ?? previewDocumentNumber(
      form.number_prefix,
      form.number_suffix,
      defaultDocPrefix,
      parsedSequence ?? 1,
    )

  const numberAvailable = numberPreview?.available !== false

  useEffect(() => {
    if (!savedNumbering) return
    setForm((f) => {
      if (f.number_prefix !== '' || f.number_suffix !== '') return f
      return {
        ...f,
        number_prefix: String(savedNumbering.number_prefix || ''),
        number_suffix: String(savedNumbering.number_suffix || ''),
      }
    })
  }, [savedNumbering])

  const sequenceBootstrapped = useRef(false)
  useEffect(() => {
    if (sequenceBootstrapped.current || !numberPreview?.suggested_sequence) return
    sequenceBootstrapped.current = true
    setForm((f) => (
      f.number_sequence.trim()
        ? f
        : { ...f, number_sequence: String(numberPreview.suggested_sequence) }
    ))
  }, [numberPreview?.suggested_sequence])

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
      hsn_sac: s.sac_code || s.hsn_sac || '',
      // Match Services list: resolve from price / range / plans (not only top-level price)
      price: resolveServiceDisplayAmount(s),
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
  const { data: copyDocs, isLoading: copyDocsLoading } = useQuery({
    queryKey: ['invoices-copy-suggestions', defaultType],
    queryFn: () => vendorApi.listInvoices({ invoice_type: defaultType, size: 100 }),
    staleTime: 30_000,
  })
  const { data: linkableOrdersData } = useQuery({
    queryKey: ['invoice-create-orders', effectiveStoreId, form.customer_id],
    queryFn: () => vendorApi.listOrders({
      size: 50,
      store_id: effectiveStoreId || undefined,
      customer_id: form.customer_id || undefined,
    }),
    enabled: !isQuotation,
    staleTime: 30_000,
  })
  const linkableOrders = (linkableOrdersData?.items ?? []) as Array<{
    id: string
    order_number?: string
    customer_id?: string
    customer_name?: string
    status?: string
  }>
  const copySuggestions = useMemo(() => {
    const items = (copyDocs?.items ?? []) as Array<Record<string, unknown>>
    return items.map(inv => ({
      number: String(inv.invoice_number || ''),
      title: String(inv.customer_name || '') || undefined,
      hint: String(inv.status || '').replace(/_/g, ' ') || undefined,
    })).filter(s => s.number)
  }, [copyDocs])
  const customers: Array<{
    id: string
    full_name: string
    phone?: string
    email?: string
    gstin?: string
    sales_area_id?: string | null
    payment_terms_days?: number | null
  }> = custData ?? []

  const applyCustomer = (c: {
    id?: string
    full_name: string
    phone?: string
    email?: string
    gstin?: string
    sales_area_id?: string | null
    payment_terms_days?: number | null
  }) => {
    setForm(f => {
      // Build payment terms label + auto-compute due date from customer master
      let payment_terms = f.payment_terms
      let due_date = f.due_date
      if (c.payment_terms_days != null && c.payment_terms_days >= 0) {
        payment_terms = formatNetTerms(c.payment_terms_days)
        const base = f.invoice_date || new Date().toISOString().slice(0, 10)
        due_date = addDaysToDateString(base, c.payment_terms_days)
      }
      return {
        ...f,
        customer_id: c.id || f.customer_id,
        customer_name: c.full_name,
        customer_phone: c.phone || f.customer_phone,
        customer_email: c.email || f.customer_email,
        customer_gstin: c.gstin || f.customer_gstin,
        // Prefill from customer master; leave the current pick if the customer has none.
        sales_area_id: c.sales_area_id || f.sales_area_id,
        payment_terms,
        due_date,
      }
    })
    setCustOpen(false)
    setCustSearch(c.full_name)
  }

  const addLine = () => setItems([...items, emptySalesLine()])
  const removeLine = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const updateLine = useCallback((i: number, field: string, value: string | number) => {
    setItems(prev => {
      const updated = [...prev]
      let row = { ...updated[i], [field]: value }
      if (field === 'qty' || field === 'rate') {
        row = syncLineDiscountFromPct(row)
      }
      updated[i] = row
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

  const handleCopyFromNumber = async (number: string) => {
    setCopyLoading(true)
    try {
      const inv = await vendorApi.lookupSalesInvoice(number, defaultType) as Record<string, unknown>
      const copied = salesInvoiceToCopyPrefill(inv)
      setForm(f => ({
        ...f,
        order_id: '',
        customer_id: copied.customer_id || '',
        sales_area_id: copied.sales_area_id || f.sales_area_id,
        customer_name: copied.customer_name,
        customer_email: copied.customer_email,
        customer_phone: copied.customer_phone,
        customer_gstin: copied.customer_gstin,
        place_of_supply: copied.place_of_supply,
        is_inter_state: copied.is_inter_state,
        notes: copied.notes,
        terms_and_conditions: copied.terms_and_conditions || f.terms_and_conditions,
      }))
      setCustSearch(copied.customer_name)
      if (copied.store_id) setStoreId(copied.store_id)
      if (copied.items?.length) {
        setItems(
          copied.items.map((it) => {
            const parsed = parseLineDescription(it.description)
            return {
              lineKey: it.lineKey ?? newLineKey(),
              name: it.name ?? '',
              description: parsed.description,
              variant_label: parsed.variant_label,
              variant_note: parsed.variant_note,
              hsn_note: parsed.hsn_note,
              qty_note: parsed.qty_note,
              rate_note: parsed.rate_note,
              tax_note: parsed.tax_note,
              hsn_sac: it.hsn_sac ?? '',
              qty: it.qty ?? 1,
              rate: it.rate ?? 0,
              discount: it.discount ?? 0,
              discount_pct: discountPctFromLine({
                qty: it.qty ?? 1,
                rate: it.rate ?? 0,
                discount: it.discount ?? 0,
                tax_rate: it.tax_rate ?? 18,
              }),
              tax_rate: it.tax_rate ?? 18,
              product_id: it.product_id,
              variant_id: it.variant_id,
              kind: it.kind,
            }
          }),
        )
      }
      setDiscountAmount(Number(inv.discount_amount) || 0)
      setAdditionalCharges(
        normalizeInvoiceAdditionalCharges(inv.additional_charges).map((c) => ({
          id: c.id,
          name: c.name,
          amount: String(c.amount),
          tax_rate: String(c.tax_rate),
        })),
      )
      setCopiedFromNumber(String(inv.invoice_number || number))
      toast.success(`Copied from ${String(inv.invoice_number || number)}. A new number is assigned when you save.`)
    } catch (err) {
      toast.error(extractApiError(err, 'No document found with that number'))
      throw err
    } finally {
      setCopyLoading(false)
    }
  }

  const totalsPreview = useMemo(
    () => computeInvoiceTotalsPreview(items, additionalCharges, discountAmount, form.is_inter_state),
    [items, additionalCharges, discountAmount, form.is_inter_state],
  )

  useEffect(() => {
    if (markFullyPaid) {
      setPaymentReceived(totalsPreview.grandTotal)
    }
  }, [markFullyPaid, totalsPreview.grandTotal])

  const createBlockReason = useMemo(
    () => createInvoiceBlockReason(items, {
      isQuotation,
      customerId: form.customer_id,
      customerName: form.customer_name,
      invoiceNumberAvailable: numberAvailable,
    }),
    [items, isQuotation, form.customer_id, form.customer_name, numberAvailable],
  )
  const canCreate = createBlockReason === null

  const handleCreate = async () => {
    setLoading(true)
    try {
      const payload = {
        ...form,
        store_id: effectiveStoreId || undefined,
        order_id: form.order_id || undefined,
        order_number: form.order_number?.trim() || undefined,
        customer_id: form.customer_id || undefined,
        sales_area_id: form.sales_area_id || undefined,
        items: items.map((row) => ({
          name: row.name,
          description: mergeLineDescriptionForApi(row),
          hsn_sac: row.hsn_sac,
          qty: row.qty,
          rate: row.rate,
          discount: row.discount,
          tax_rate: row.tax_rate,
        })),
        additional_charges: invoiceAdditionalChargesForSave(additionalCharges),
        discount_amount: discountAmount,
        ...(isQuotation ? { extra_fields: serializeQuotationExtraFields(extraFields) } : {}),
        number_prefix: form.number_prefix,
        number_suffix: form.number_suffix,
        ...(parsedSequence ? { number_sequence: parsedSequence } : {}),
        ...(!isQuotation && paymentReceived > 0
          ? {
            initial_payment: {
              amount: Math.min(paymentReceived, totalsPreview.grandTotal),
              payment_method: paymentMethod,
            },
          }
          : {}),
      }
      const created = await vendorApi.createInvoice(payload)
      const kind = defaultType === 'estimate' ? 'Quotation' : 'Invoice'
      toast.success(createdDocMessage(kind, pickDocNo(created, 'invoice_number')))
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
        className="flex max-h-[min(92dvh,calc(100dvh-0.5rem))] w-[min(96vw,56rem)] flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl"
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-1.5">
          <h2 className="text-[14px] font-semibold tracking-tight">
            {copiedFromNumber
              ? `Copy of ${copiedFromNumber}`
              : defaultType === 'estimate' ? 'Create Quotation' : 'Create Invoice'}
          </h2>
          <button type="button" data-escape-close aria-label="Close" onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-1.5 space-y-2 [scrollbar-gutter:stable]">
          {/* Header: 3-column grid so labels and controls share one right edge */}
          <div className="relative">
            <div className="grid grid-cols-1 gap-x-2.5 gap-y-2 sm:grid-cols-6">
              <div className="min-w-0 sm:col-span-2">
                <Label className="text-xs">Business unit</Label>
                <BusinessUnitSelect
                  value={storeId}
                  onChange={(id) => { setStoreId(id); setBranchId('') }}
                  className="mt-0.5 min-w-0 w-full"
                  triggerClassName="h-8"
                />
              </div>
              <div className="min-w-0 sm:col-span-2">
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
              <div className="min-w-0 sm:col-span-2">
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

              <div className="min-w-0 sm:col-span-6 rounded-md border border-border bg-muted/40 px-3 py-2.5">
                <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-12">
                  <div className="flex min-w-0 flex-col sm:col-span-3">
                    <Label className="h-4 text-xs leading-4">
                      {isQuotation ? 'Quotation prefix' : 'Invoice prefix'}
                    </Label>
                    <Input
                      className="mt-1 h-8 font-mono text-sm"
                      placeholder={defaultDocPrefix}
                      value={form.number_prefix}
                      onChange={e => setForm(f => ({ ...f, number_prefix: e.target.value }))}
                    />
                    <p className="mt-0.5 h-4 text-[10px] leading-4 text-transparent select-none" aria-hidden>
                      –
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-col sm:col-span-3">
                    <Label className="h-4 text-xs leading-4">Invoice number</Label>
                    <Input
                      type="number"
                      min={1}
                      max={999999}
                      className="mt-1 h-8 font-mono text-sm"
                      placeholder="Auto"
                      value={form.number_sequence}
                      onChange={e => setForm(f => ({ ...f, number_sequence: e.target.value }))}
                    />
                    <p className="mt-0.5 h-4 text-[10px] leading-4 text-muted-foreground">
                      Next free: {numberPreview?.suggested_sequence ?? '…'}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-col sm:col-span-3">
                    <Label className="h-4 text-xs leading-4">Suffix (optional)</Label>
                    <Input
                      className="mt-1 h-8 font-mono text-sm"
                      placeholder="e.g. BR01"
                      value={form.number_suffix}
                      onChange={e => setForm(f => ({ ...f, number_suffix: e.target.value }))}
                    />
                    <p className="mt-0.5 h-4 text-[10px] leading-4 text-transparent select-none" aria-hidden>
                      –
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-col sm:col-span-3">
                    <Label className="h-4 text-xs leading-4">
                      Preview{numberPreviewLoading ? '…' : ''}
                    </Label>
                    <div
                      className={cn(
                        'mt-1 flex h-8 min-w-0 items-center rounded-md border border-border bg-background px-2',
                        !numberAvailable && 'border-destructive/50 bg-destructive/5',
                      )}
                      title={docNumberPreview}
                    >
                      <span
                        className={cn(
                          'truncate font-mono text-[11px] font-medium',
                          numberAvailable ? 'text-foreground' : 'text-destructive',
                        )}
                      >
                        {docNumberPreview}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'mt-0.5 h-4 text-[10px] leading-4',
                        numberAvailable ? 'text-muted-foreground' : 'text-destructive',
                      )}
                    >
                      {numberAvailable ? 'Available' : 'Already in use'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative min-w-0 sm:col-span-2">
                <Label className="text-xs">{isQuotation ? 'Select Customer (optional)' : 'Customer'}</Label>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={isQuotation ? 'Search customers…' : 'Search or create a customer…'}
                      className="h-8 w-full max-w-full pl-8 pr-8 text-sm"
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
                <div className="min-w-0 sm:col-span-2">
                  <Label className="text-xs">Valid Until</Label>
                  <Input
                    type="date"
                    className="mt-0.5 h-8 w-full min-w-0 text-sm"
                    value={form.due_date}
                    onChange={e => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
              ) : (
                <div className="min-w-0 sm:col-span-2">
                  <Label className="text-xs" helpKey="invoice customer gstin">GSTIN</Label>
                  <Input
                    className="mt-0.5 h-8 w-full max-w-full font-mono text-sm tracking-wide"
                    value={form.customer_gstin}
                    onChange={e => setForm({ ...form, customer_gstin: e.target.value.toUpperCase() })}
                    maxLength={15}
                    placeholder="Optional"
                  />
                </div>
              )}

              {isQuotation ? (
                <div className="min-w-0 sm:col-span-2">
                  <Label className="text-xs" helpKey="invoice customer gstin">GSTIN</Label>
                  <Input
                    className="mt-0.5 h-8 w-full max-w-full font-mono text-sm tracking-wide"
                    value={form.customer_gstin}
                    onChange={e => setForm({ ...form, customer_gstin: e.target.value.toUpperCase() })}
                    maxLength={15}
                    placeholder="Optional"
                  />
                </div>
              ) : (
                <div className="min-w-0 sm:col-span-2">
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
                <div className="min-w-0 sm:col-span-4">
                  <Label className="text-xs">Link sales order (optional)</Label>
                  <Select
                    className="mt-0.5 w-full"
                    triggerClassName="h-8 text-sm"
                    value={form.order_id || ''}
                    placeholder="Optional — pick an open order"
                    onChange={(orderId) => {
                      const hit = linkableOrders.find(o => o.id === orderId)
                      setForm(f => ({
                        ...f,
                        order_id: orderId,
                        order_number: hit?.order_number || f.order_number,
                        ...(hit?.customer_id ? { customer_id: hit.customer_id } : {}),
                        ...(hit?.customer_name
                          ? { customer_name: hit.customer_name }
                          : {}),
                      }))
                      if (hit?.customer_name) setCustSearch(hit.customer_name)
                    }}
                    options={[
                      { value: '', label: '— None —' },
                      ...linkableOrders.map(o => ({
                        value: o.id,
                        label: `${o.order_number || o.id}${o.customer_name ? ` · ${o.customer_name}` : ''}`,
                      })),
                    ]}
                  />
                </div>
              )}

              {!isQuotation && (
                <div className="min-w-0 sm:col-span-2">
                  <PurchaseOrderRefPicker
                    value={form.order_number}
                    onChange={order_number => setForm(f => ({ ...f, order_number }))}
                  />
                </div>
              )}

              {!isQuotation && (
                <div className="min-w-0 sm:col-span-2">
                  <Label className="text-xs">Invoice date</Label>
                  <Input
                    type="date"
                    className="mt-0.5 h-8 w-full min-w-0 text-sm"
                    value={form.invoice_date}
                    onChange={e => {
                      const invoice_date = e.target.value
                      setForm(f => {
                        let due_date = f.due_date
                        let payment_terms = f.payment_terms
                        const netDays = parseNetDaysFromTerms(f.payment_terms || '')
                        if (netDays != null && invoice_date) {
                          due_date = addDaysToDateString(invoice_date, netDays)
                        } else if (f.due_date && invoice_date) {
                          const gap = daysBetweenInvoiceAndDue(invoice_date, f.due_date)
                          if (gap != null) payment_terms = formatNetTerms(gap)
                        }
                        return { ...f, invoice_date, due_date, payment_terms }
                      })
                    }}
                  />
                </div>
              )}

              {!isQuotation && (
                <div className="min-w-0 sm:col-span-2">
                  <Label className="text-xs">Posting date</Label>
                  <Input
                    type="date"
                    className="mt-0.5 h-8 w-full min-w-0 text-sm"
                    value={form.posting_date}
                    onChange={e => setForm({ ...form, posting_date: e.target.value })}
                  />
                </div>
              )}

              {!isQuotation && (
                <div className="min-w-0 sm:col-span-2">
                  <Label className="text-xs">Due date</Label>
                  <Input
                    type="date"
                    className="mt-0.5 h-8 w-full min-w-0 text-sm"
                    value={form.due_date}
                    onChange={e => {
                      const due_date = e.target.value
                      setForm(f => {
                        let payment_terms = f.payment_terms
                        if (f.invoice_date && due_date) {
                          const gap = daysBetweenInvoiceAndDue(f.invoice_date, due_date)
                          if (gap != null) payment_terms = formatNetTerms(gap)
                        }
                        return { ...f, due_date, payment_terms }
                      })
                    }}
                  />
                </div>
              )}

              {!isQuotation && (
                <div className="min-w-0 sm:col-span-4">
                  <Label className="text-xs">Payment terms</Label>
                  <Input
                    className="mt-0.5 h-8 w-full max-w-full text-sm"
                    placeholder="e.g. Net 30 days"
                    value={form.payment_terms}
                    onChange={e => {
                      const payment_terms = e.target.value
                      setForm(f => {
                        let due_date = f.due_date
                        const netDays = parseNetDaysFromTerms(payment_terms)
                        if (netDays != null && f.invoice_date) {
                          due_date = addDaysToDateString(f.invoice_date, netDays)
                        }
                        return { ...f, payment_terms, due_date }
                      })
                    }}
                  />
                </div>
              )}

              <div className="min-w-0 sm:col-span-2">
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
              <p className="mt-1 text-[11px] text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{form.customer_name}</span>
                {form.customer_phone ? ` · ${form.customer_phone}` : ''}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/25 px-1.5 py-1 shadow-sm">
            <div className="mb-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0">
                <Label className="text-xs font-medium">Line items</Label>
                <span className="text-[11px] text-muted-foreground">
                  <a
                    href="/products/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    onClick={onAuthenticatedAnchorClick}
                  >
                    Add product
                  </a>
                  {' / '}
                  <a
                    href="/services/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    onClick={onAuthenticatedAnchorClick}
                  >
                    service
                  </a>
                </span>
              </div>
              <Button variant="outline" size="sm" className="h-7 shrink-0 gap-1 px-2.5 text-[11px]" onClick={addLine} type="button">
                <Plus className="h-3 w-3" />
                Add line
              </Button>
            </div>
            <div className="mb-0 flex gap-1 px-0.5 pb-0.5">
              <FormColumnLabel className="w-5 shrink-0 text-center text-[9px]">#</FormColumnLabel>
              <FormColumnLabel className="min-w-0 flex-[1.15] text-[9px]">Item</FormColumnLabel>
              <FormColumnLabel className="w-[6.25rem] shrink-0 text-[9px] sm:w-24">Variant</FormColumnLabel>
              <FormColumnLabel className="w-20 shrink-0 text-[9px] sm:w-[5.25rem]">HSN</FormColumnLabel>
              <FormColumnLabel className="w-[4.25rem] shrink-0 text-center text-[9px] sm:w-24">Qty</FormColumnLabel>
              <FormColumnLabel className="w-[6.5rem] shrink-0 text-[9px] sm:w-[7.25rem]">Price/item</FormColumnLabel>
              <FormColumnLabel className="w-[5.25rem] shrink-0 text-center text-[9px] sm:w-24">Discount</FormColumnLabel>
              <FormColumnLabel className="w-[4.75rem] shrink-0 text-center text-[9px] sm:w-[5.25rem]">Tax</FormColumnLabel>
              <FormColumnLabel className="w-[5.5rem] shrink-0 text-right text-[9px] sm:w-24">Amount</FormColumnLabel>
              <div className="w-6 shrink-0" />
            </div>
            <div className="max-h-[min(40vh,22rem)] space-y-1 overflow-y-auto overflow-x-auto pr-0.5 [scrollbar-gutter:stable]">
              {items.map((item, i) => (
                <ItemSearchRow
                  key={item.lineKey}
                  item={item}
                  index={i}
                  onUpdate={(field, value) => updateLine(i, field, value)}
                  onPatch={(patch) => patchLine(i, patch)}
                  onRemove={() => removeLine(i)}
                  catalogue={catalogue}
                  compact
                  isInterState={form.is_inter_state}
                />
              ))}
            </div>
          </div>

          {isQuotation ? (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <div className="min-w-0">
                <Label className="text-xs">Notes</Label>
                <textarea
                  rows={1}
                  className="mt-0.5 min-h-[2.25rem] w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Internal or customer-facing notes…"
                />
              </div>
              <div className="min-w-0">
                <Label className="text-xs">Terms &amp; Conditions</Label>
                <textarea
                  rows={1}
                  className="mt-0.5 min-h-[2.25rem] w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                  value={form.terms_and_conditions}
                  onChange={e => setForm({ ...form, terms_and_conditions: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <div className="min-w-0">
                <Label className="text-xs">Notes</Label>
                <textarea
                  rows={1}
                  className="mt-0.5 min-h-[2.25rem] w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Payment notes, delivery instructions…"
                />
              </div>
              <div className="min-w-0">
                <Label className="text-xs">Terms &amp; Conditions</Label>
                <textarea
                  rows={1}
                  className="mt-0.5 min-h-[2.25rem] w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                  value={form.terms_and_conditions}
                  onChange={e => setForm({ ...form, terms_and_conditions: e.target.value })}
                  placeholder="Printed on invoice…"
                />
              </div>
            </div>
          )}

          {!isQuotation && (invSettings?.bank_name || invSettings?.account_number) ? (
            <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Bank details (on print)</p>
              <p className="mt-0.5 font-mono text-[11px]">
                {[invSettings?.bank_name, invSettings?.account_number, invSettings?.ifsc_code]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="mt-1 text-[10px]">
                From invoice template settings — edit under Invoices → Templates.
              </p>
            </div>
          ) : null}

          {defaultType === 'estimate' && (
            <QuotationExtraFieldsEditor fields={extraFields} onChange={setExtraFields} compact />
          )}

          <div className="flex justify-stretch sm:justify-end">
            <InvoiceCreateTotalsPanel
              totals={totalsPreview}
              isInterState={form.is_inter_state}
              additionalCharges={additionalCharges}
              onAdditionalChargesChange={setAdditionalCharges}
              discountAmount={discountAmount}
              onDiscountAmountChange={setDiscountAmount}
              showPaymentSection={!isQuotation}
              paymentReceived={paymentReceived}
              onPaymentReceivedChange={setPaymentReceived}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              markFullyPaid={markFullyPaid}
              onMarkFullyPaidChange={setMarkFullyPaid}
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-muted/15 px-3 py-1.5 sm:gap-3">
          <div className="mr-auto flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
            <span className="text-muted-foreground">Subtotal: <span className="font-medium text-foreground">{formatCurrency(totalsPreview.lineTaxable)}</span></span>
            {totalsPreview.chargesTotal > 0 && (
              <span className="text-muted-foreground">Charges: <span className="font-medium text-foreground">{formatCurrency(totalsPreview.chargesTotal)}</span></span>
            )}
            <span className="text-muted-foreground">Tax: <span className="font-medium text-foreground">{formatCurrency(totalsPreview.totalTax)}</span></span>
            <span className="text-sm font-semibold text-foreground">Total: {formatCurrency(totalsPreview.grandTotal)}</span>
          </div>
          <div className="flex shrink-0 gap-2">
            <CopyFromDocumentField
              placeholder={isQuotation ? 'Search quotation number or customer…' : 'Search invoice number or customer…'}
              onCopy={handleCopyFromNumber}
              loading={copyLoading}
              copiedFrom={copiedFromNumber}
              suggestions={copySuggestions}
              suggestionsLoading={copyDocsLoading}
            />
            <Button variant="cancel" onClick={onClose} className="h-8 px-3 text-sm">Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={loading || !canCreate}
              title={createBlockReason ?? undefined}
              className="h-8 gap-2 px-3 text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}Create
            </Button>
          </div>
          {createBlockReason ? (
            <p className="w-full text-[11px] text-amber-700 dark:text-amber-400" role="status">
              {createBlockReason}
            </p>
          ) : null}
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
          onNavigateAway={onClose}
          returnTo="invoices"
        />
      )}
    </div>,
    document.body,
  )
}
