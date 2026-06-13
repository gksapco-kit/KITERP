import { useCallback, useMemo, useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { vendorApi } from '@/api/vendor'
import { useOrders, useUpdateOrderStatus, useQuotationSettings } from '@/hooks/useVendor'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TableToolbar } from '@/components/table/TableToolbar'
import { ResizableTable } from '@/components/table/ResizableTable'
import { processRows, type SortDir } from '@/lib/tableList'
import { CreateInvoiceModal } from '@/pages/invoices/index'
import { printInvoice, DEFAULT_QUOTATION_SETTINGS } from '@/lib/invoiceTemplates'
import type { InvoiceSettings } from '@/lib/invoiceTemplates'
import type { Order } from '@/types'
import { toast } from 'sonner'
import {
  Plus, Search, Loader2, MessageSquare, FileText, Eye, Check, Settings2,
  ChevronLeft, ChevronRight, ArrowRight, Printer, Send, Inbox,
  ScrollText, Clock, CheckCircle2, Ban,
} from 'lucide-react'

type QuotationTab = 'all' | 'requests' | 'estimates'

type QuotationRow = {
  id: string
  kind: 'request' | 'estimate'
  number: string
  customer_name: string
  subject: string
  total: number
  status: string
  created_at: string
  notes?: string
  order?: Order
  estimate?: Record<string, unknown>
}

const requestStatusStyle: Record<string, string> = {
  quote_requested: 'bg-primary/10 text-primary',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
}

const requestStatusLabel: Record<string, string> = {
  quote_requested: 'Awaiting Response',
  confirmed: 'Converted',
  cancelled: 'Declined',
}

const estimateStatusStyle: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const tabOptions: { key: QuotationTab; label: string; icon: typeof Inbox }[] = [
  { key: 'all', label: 'All', icon: ScrollText },
  { key: 'requests', label: 'Quote Requests', icon: Inbox },
  { key: 'estimates', label: 'Estimates', icon: FileText },
]

function orderToRow(order: Order): QuotationRow {
  const firstItem = order.items?.[0] as unknown as Record<string, unknown> | undefined
  return {
    id: `req-${order.id}`,
    kind: 'request',
    number: order.order_number,
    customer_name: order.customer_name || 'Unknown',
    subject: String(firstItem?.name || 'Quote request'),
    total: order.total || 0,
    status: order.status,
    created_at: order.created_at,
    notes: order.notes,
    order,
  }
}

function estimateToRow(inv: Record<string, unknown>): QuotationRow {
  const items = (inv.items as Array<Record<string, unknown>>) || []
  return {
    id: `est-${inv.id}`,
    kind: 'estimate',
    number: String(inv.invoice_number || ''),
    customer_name: String(inv.customer_name || '—'),
    subject: String(items[0]?.name || 'Quotation'),
    total: Number(inv.total || 0),
    status: String(inv.status || 'draft'),
    created_at: String(inv.created_at || ''),
    estimate: inv,
  }
}

function buildEstimatePrefill(order: Order) {
  const items = (order.items || []).map((item) => {
    const row = item as unknown as Record<string, unknown>
    return {
      name: String(row.name || 'Item'),
      hsn_sac: String(row.hsn_sac || row.hsn_code || row.sac_code || ''),
      qty: Number(row.qty || row.quantity || 1),
      rate: Number(row.price || row.rate || 0),
      discount: Number(row.discount || 0),
      tax_rate: Number(row.tax_rate || row.gst_rate || 18),
    }
  })
  return {
    order_id: order.id,
    customer_name: order.customer_name || '',
    customer_email: order.customer_email || '',
    customer_phone: order.customer_phone || '',
    notes: order.notes || '',
    items: items.length ? items : undefined,
  }
}

export default function QuotationsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const updateStatus = useUpdateOrderStatus()
  const { data: quoteSettings } = useQuotationSettings()
  const mergedQuoteSettings = useMemo<Partial<InvoiceSettings>>(
    () => ({ ...DEFAULT_QUOTATION_SETTINGS, ...(quoteSettings as Partial<InvoiceSettings> || {}) }),
    [quoteSettings],
  )

  const [tab, setTab] = useState<QuotationTab>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showCreate, setShowCreate] = useState(false)
  const [createPrefill, setCreatePrefill] = useState<ReturnType<typeof buildEstimatePrefill> | undefined>()
  const [actingId, setActingId] = useState<string | null>(null)

  const { data: ordersData, isLoading: ordersLoading } = useOrders({
    page: 1,
    size: 100,
    source: 'quote',
    search: search || undefined,
  })

  const { data: estimatesData, isLoading: estimatesLoading } = useQuery({
    queryKey: ['quotations', 'estimates', statusFilter, page],
    queryFn: () => vendorApi.listInvoices({
      page,
      size: 20,
      invoice_type: 'estimate',
      status: statusFilter || undefined,
    }),
  })

  const quoteOrders = useMemo(
    () => ((ordersData?.items || []) as Order[]).map(orderToRow),
    [ordersData?.items],
  )

  const estimates = useMemo(
    () => ((estimatesData?.items || []) as Record<string, unknown>[]).map(estimateToRow),
    [estimatesData?.items],
  )

  const stats = useMemo(() => ({
    pending: quoteOrders.filter(r => r.status === 'quote_requested').length,
    drafts: estimates.filter(r => r.status === 'draft').length,
    sent: estimates.filter(r => r.status === 'sent').length,
    converted: quoteOrders.filter(r => r.status === 'confirmed').length,
  }), [quoteOrders, estimates])

  const mergedRows = useMemo(() => {
    if (tab === 'requests') return quoteOrders
    if (tab === 'estimates') return estimates
    return [...quoteOrders, ...estimates]
  }, [tab, quoteOrders, estimates])

  const displayRows = useMemo(() => {
    const statusKey = statusFilter
      ? (r: QuotationRow) => r.status === statusFilter
      : () => true
    const filtered = mergedRows.filter(statusKey)
    return processRows(
      filtered,
      search,
      (r) => [r.number, r.customer_name, r.subject, r.status, r.notes || ''],
      sortKey,
      sortDir,
      {
        number: (r) => r.number,
        customer_name: (r) => r.customer_name,
        subject: (r) => r.subject,
        total: (r) => r.total,
        status: (r) => r.status,
        created_at: (r) => r.created_at,
        kind: (r) => r.kind,
      },
    )
  }, [mergedRows, search, sortKey, sortDir, statusFilter])

  const isLoading = (tab === 'estimates' ? estimatesLoading : tab === 'requests' ? ordersLoading : ordersLoading || estimatesLoading)

  const openCreate = useCallback((prefill?: ReturnType<typeof buildEstimatePrefill>) => {
    setCreatePrefill(prefill)
    setShowCreate(true)
  }, [])

  const handleAcceptRequest = useCallback(async (order: Order) => {
    setActingId(order.id)
    try {
      await updateStatus.mutateAsync({ id: order.id, data: { status: 'confirmed' } })
      toast.success('Quote accepted — order confirmed')
      qc.invalidateQueries({ queryKey: ['orders'] })
    } catch {
      toast.error('Could not accept quote request')
    } finally {
      setActingId(null)
    }
  }, [updateStatus, qc])

  const handleDeclineRequest = useCallback(async (order: Order) => {
    setActingId(order.id)
    try {
      await updateStatus.mutateAsync({
        id: order.id,
        data: { status: 'cancelled', cancel_reason: 'Quote declined' },
      })
      toast.success('Quote request declined')
      qc.invalidateQueries({ queryKey: ['orders'] })
    } catch {
      toast.error('Could not decline quote request')
    } finally {
      setActingId(null)
    }
  }, [updateStatus, qc])

  const handleSendEstimate = useCallback(async (estimateId: string) => {
    setActingId(estimateId)
    try {
      await vendorApi.updateInvoice(estimateId, { status: 'sent' })
      toast.success('Quotation marked as sent')
      qc.invalidateQueries({ queryKey: ['quotations', 'estimates'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    } catch {
      toast.error('Could not update quotation status')
    } finally {
      setActingId(null)
    }
  }, [qc])

  const handleConvertEstimate = useCallback(async (estimateId: string) => {
    setActingId(estimateId)
    try {
      const invoice = await vendorApi.convertEstimate(estimateId)
      toast.success('Quotation converted to invoice')
      qc.invalidateQueries({ queryKey: ['quotations', 'estimates'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      navigate(`/quotations/${(invoice as { id: string }).id}`)
    } catch {
      toast.error('Could not convert quotation to invoice')
    } finally {
      setActingId(null)
    }
  }, [qc, navigate])

  const openQuotationRow = useCallback((row: QuotationRow) => {
    if (row.kind === 'request' && row.order) {
      navigate(`/orders/${row.order.id}`)
      return
    }
    if (row.estimate) {
      navigate(`/quotations/${row.estimate.id}`)
    }
  }, [navigate])

  const statusOptions = useMemo(() => {
    if (tab === 'estimates') {
      return [
        { label: 'All statuses', value: '' },
        { label: 'Draft', value: 'draft' },
        { label: 'Sent', value: 'sent' },
        { label: 'Cancelled', value: 'cancelled' },
      ]
    }
    if (tab === 'requests') {
      return [
        { label: 'All statuses', value: '' },
        { label: 'Awaiting Response', value: 'quote_requested' },
        { label: 'Converted', value: 'confirmed' },
        { label: 'Declined', value: 'cancelled' },
      ]
    }
    return [{ label: 'All statuses', value: '' }]
  }, [tab])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage customer quote requests and send formal estimates.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/quotations/templates')} className="gap-2">
            <Settings2 className="w-4 h-4" /> Templates
          </Button>
          <Button className="gap-1.5" onClick={() => openCreate()}>
            <Plus className="w-4 h-4" /> New Quotation
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Pending Requests</p>
              <p className="text-xl font-bold text-gray-900">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Draft Estimates</p>
              <p className="text-xl font-bold text-gray-900">{stats.drafts}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Sent</p>
              <p className="text-xl font-bold text-gray-900">{stats.sent}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Converted</p>
              <p className="text-xl font-bold text-gray-900">{stats.converted}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap rounded-xl bg-gray-100 p-1 w-fit">
        {tabOptions.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setStatusFilter(''); setPage(1) }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              tab === t.key ? 'bg-white text-primary shadow-sm ring-1 ring-primary/15' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <form
            onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search quotations, customers, services…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" variant="outline">Search</Button>
            {statusOptions.length > 1 && (
              <select
                className="text-sm border rounded-lg px-3 py-2 bg-white"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              >
                {statusOptions.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search=""
            onSearchChange={() => {}}
            hideSearch
            hint="Sorting applies to loaded quotations."
            sortOptions={[
              { value: 'created_at', label: 'Date' },
              { value: 'number', label: 'Reference #' },
              { value: 'customer_name', label: 'Customer' },
              { value: 'subject', label: 'Subject' },
              { value: 'total', label: 'Amount' },
              { value: 'status', label: 'Status' },
              { value: 'kind', label: 'Type' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
          />
          <ResizableTable
            tableId="quotations"
            defaultWidths={[110, 90, 160, 180, 90, 110, 100, 200]}
          >
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Reference</TableColumnLabel></th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Type</TableColumnLabel></th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Customer</TableColumnLabel></th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Subject</TableColumnLabel></th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Amount</TableColumnLabel></th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Date</TableColumnLabel></th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-gray-500">
                    {tab === 'requests'
                      ? 'No quote requests yet — enable quote requests on your services to receive them.'
                      : tab === 'estimates'
                        ? 'No estimates yet — click New Quotation to create one.'
                        : 'No quotations yet.'}
                  </td>
                </tr>
              ) : displayRows.map((row) => {
                const isRequest = row.kind === 'request'
                const statusClass = isRequest
                  ? (requestStatusStyle[row.status] || 'bg-gray-100 text-gray-700')
                  : (estimateStatusStyle[row.status] || 'bg-gray-100 text-gray-700')
                const statusText = isRequest
                  ? (requestStatusLabel[row.status] || row.status)
                  : row.status.replace(/_/g, ' ')
                const busy = actingId === (isRequest ? row.order?.id : row.estimate?.id as string)

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => openQuotationRow(row)}
                  >
                    <td className="px-5 py-3 text-sm font-medium text-blue-600 font-mono text-xs">
                      {row.number}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        isRequest ? 'bg-primary/10 text-primary' : 'bg-accent text-primary'
                      }`}>
                        {isRequest ? <MessageSquare className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        {isRequest ? 'Request' : 'Estimate'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700">{row.customer_name}</td>
                    <td className="px-5 py-3 text-sm text-gray-600 max-w-[220px] truncate" title={row.subject}>
                      {row.subject}
                    </td>
                    <td className="px-5 py-3 text-sm text-right font-medium">
                      {row.total > 0 ? formatCurrency(row.total) : '—'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusClass}`}>
                        {statusText}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{formatDate(row.created_at)}</td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {isRequest && row.order && (
                          <>
                            <button
                              type="button"
                              title="View request"
                              onClick={() => navigate(`/orders/${row.order!.id}`)}
                              className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {row.status === 'quote_requested' && (
                              <>
                                <button
                                  type="button"
                                  title="Create estimate from request"
                                  onClick={() => openCreate(buildEstimatePrefill(row.order!))}
                                  className="p-1.5 rounded-lg hover:bg-primary/10 text-primary"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  title="Accept & convert to order"
                                  disabled={busy}
                                  onClick={() => handleAcceptRequest(row.order!)}
                                  className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 disabled:opacity-40"
                                >
                                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </button>
                                <button
                                  type="button"
                                  title="Decline request"
                                  disabled={busy}
                                  onClick={() => handleDeclineRequest(row.order!)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-40"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                        {!isRequest && row.estimate && (
                          <>
                            <button
                              type="button"
                              title="View quotation"
                              onClick={() => navigate(`/quotations/${row.estimate!.id}`)}
                              className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title="Print / PDF"
                              onClick={() => printInvoice(
                                row.estimate!,
                                mergedQuoteSettings,
                                window.location.origin,
                              )}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {row.status === 'draft' && (
                              <button
                                type="button"
                                title="Mark as sent"
                                disabled={busy}
                                onClick={() => handleSendEstimate(String(row.estimate!.id))}
                                className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 disabled:opacity-40"
                              >
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              </button>
                            )}
                            {['draft', 'sent'].includes(row.status) && (
                              <button
                                type="button"
                                title="Convert to invoice"
                                disabled={busy}
                                onClick={() => handleConvertEstimate(String(row.estimate!.id))}
                                className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 disabled:opacity-40"
                              >
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </ResizableTable>
        </CardContent>
      </Card>

      {tab === 'estimates' && estimatesData && estimatesData.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {page} of {estimatesData.pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= estimatesData.pages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateInvoiceModal
          defaultType="estimate"
          prefill={createPrefill}
          onClose={() => { setShowCreate(false); setCreatePrefill(undefined) }}
          onCreated={(created) => {
            setShowCreate(false)
            setCreatePrefill(undefined)
            qc.invalidateQueries({ queryKey: ['quotations', 'estimates'] })
            qc.invalidateQueries({ queryKey: ['invoices'] })
            if (created?.id) navigate(`/quotations/${created.id}`)
          }}
        />
      )}
    </div>
  )
}
