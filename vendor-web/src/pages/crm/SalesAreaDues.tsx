import { useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ChevronDown, ChevronRight, Loader2, Search,
  MapPin, Users, FileText, Banknote, AlertCircle, Plus,
} from 'lucide-react'
import { useSalesAreaDuesSummary, useSalesAreaDues, useSavePaymentFollowup } from '@/hooks/useCrm'
import type { SalesAreaDuesSummaryRow, SalesAreaDuesCustomerRow } from '@/api/crm'
import { SalesScopeFilters } from '@/components/common/SalesScopeFilters'
import { useSalesScopeFilter } from '@/hooks/useSalesScopeFilter'
import { Pager, LoadingRow, EmptyRow } from './_shared'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

function money(n: number | string | null | undefined) {
  const v = Number(n ?? 0)
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 0,
    }).format(v)
  } catch {
    return `₹${v.toFixed(0)}`
  }
}

function fmt(n: number | string | null | undefined) {
  const v = Number(n ?? 0)
  return v === 0 ? '—' : money(v)
}

function AgingBadge({ value, variant }: { value: number | string | null | undefined; variant?: 'warn' | 'danger' | 'default' }) {
  const v = Number(value ?? 0)
  if (v <= 0) return <span className="text-muted-foreground">—</span>
  const cls = variant === 'danger'
    ? 'bg-destructive/10 text-destructive'
    : variant === 'warn'
    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
    : 'bg-muted text-muted-foreground'
  return <span className={cn('inline-block rounded px-1.5 py-0.5 text-xs font-medium tabular-nums', cls)}>{money(v)}</span>
}

function formatShortDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function CustomerDueBlock({
  row,
  onFollowup,
  followupPending,
}: {
  row: SalesAreaDuesCustomerRow
  onFollowup: () => void
  followupPending: boolean
}) {
  const invoices = row.invoices ?? []
  return (
    <>
      <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
        <td className="px-4 py-2.5 pl-12">
          <a
            href={row.customer_id ? `/invoices?customer_id=${row.customer_id}` : '/invoices'}
            className="font-medium text-foreground hover:underline"
          >
            {row.customer_name}
          </a>
          {row.phone && (
            <div className="text-xs text-muted-foreground">{row.phone}</div>
          )}
          {row.payment_blocked && (
            <Badge variant="destructive" className="mt-0.5 text-[10px] py-0 h-4">Blocked</Badge>
          )}
        </td>
        <td className="px-4 py-2.5 text-muted-foreground capitalize">
          {row.customer_group ?? '—'}
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
          {row.open_invoices}
        </td>
        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
          {money(row.total_due)}
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums">
          <AgingBadge value={row.not_due} />
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums">
          <AgingBadge value={row.days_1_30} variant="default" />
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums">
          <AgingBadge value={row.days_31_60} variant="warn" />
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums">
          <AgingBadge value={row.days_61_90} variant="warn" />
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums">
          <AgingBadge value={row.days_90_plus} variant="danger" />
        </td>
        <td className="px-4 py-2.5 text-center">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
            onClick={onFollowup}
            disabled={followupPending}
            title="Create payment follow-up"
          >
            <Plus className="h-3 w-3" />
            Follow-up
          </Button>
        </td>
      </tr>
      {invoices.length > 0 && (
        <tr className="border-b last:border-0 bg-background/60">
          <td colSpan={10} className="px-4 pb-3 pl-12 pt-0">
            <div className="mt-1 overflow-hidden rounded-md border border-border/70">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="px-3 py-1.5 text-left font-medium">Invoice</th>
                    <th className="px-3 py-1.5 text-left font-medium">Date</th>
                    <th className="px-3 py-1.5 text-left font-medium">Due</th>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                    <th className="px-3 py-1.5 text-right font-medium">Total</th>
                    <th className="px-3 py-1.5 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-border/60">
                      <td className="px-3 py-1.5">
                        <a href={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline">
                          {inv.invoice_number}
                        </a>
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{formatShortDate(inv.created_at)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{formatShortDate(inv.due_date)}</td>
                      <td className="px-3 py-1.5 capitalize text-muted-foreground">{inv.status || '—'}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{money(inv.total)}</td>
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">{money(inv.balance_due)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Expanded customer rows for one sales area ────────────────────────────────

function AreaCustomerRows({
  salesAreaId,
  storeId,
  overduOnly,
  asOf,
  search,
}: {
  salesAreaId: string | null
  storeId?: string
  overduOnly: boolean
  asOf: string
  search: string
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const saveFollowup = useSavePaymentFollowup()

  const params: Record<string, unknown> = {
    sales_area_id: salesAreaId ?? 'unassigned',
    page,
    size: pageSize,
    ...(storeId ? { store_id: storeId } : {}),
    ...(overduOnly ? { overdue_only: true } : {}),
    ...(asOf ? { as_of: asOf } : {}),
    ...(search ? { q: search } : {}),
  }
  const { data, isLoading } = useSalesAreaDues(params, true)

  function handleCreateFollowup(row: SalesAreaDuesCustomerRow) {
    saveFollowup.mutate(
      {
        id: undefined,
        data: {
          party_name: row.customer_name,
          party_phone: row.phone ?? undefined,
          party_email: row.email ?? undefined,
          customer_id: row.customer_id ?? undefined,
          amount_due: row.total_due,
          due_date: row.oldest_due_date ?? undefined,
          status: 'open',
          priority: row.days_overdue && row.days_overdue > 60 ? 'high' : 'normal',
          channel: 'call',
        },
      },
      {
        onSuccess: () => toast.success(`Follow-up created for ${row.customer_name}`),
        onError: () => toast.error('Failed to create follow-up'),
      },
    )
  }

  return (
    <tr>
      <td colSpan={10} className="p-0">
        <div className="bg-muted/20 border-b">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b bg-muted/40">
                <th className="px-4 py-2 text-left font-medium pl-12">Customer</th>
                <th className="px-4 py-2 text-left font-medium">Group</th>
                <th className="px-4 py-2 text-right font-medium">Invoices</th>
                <th className="px-4 py-2 text-right font-medium">Total Due</th>
                <th className="px-4 py-2 text-right font-medium">Not Due</th>
                <th className="px-4 py-2 text-right font-medium">1–30d</th>
                <th className="px-4 py-2 text-right font-medium">31–60d</th>
                <th className="px-4 py-2 text-right font-medium">61–90d</th>
                <th className="px-4 py-2 text-right font-medium">&gt;90d</th>
                <th className="px-4 py-2 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <LoadingRow cols={10} />
              ) : !data?.items?.length ? (
                <EmptyRow cols={10} message="No customers with open dues in this area." />
              ) : (
                (data.items as SalesAreaDuesCustomerRow[]).map((row) => (
                  <CustomerDueBlock
                    key={`${row.sales_area_id ?? 'none'}_${row.customer_id ?? 'anon'}`}
                    row={row}
                    onFollowup={() => handleCreateFollowup(row)}
                    followupPending={saveFollowup.isPending}
                  />
                ))
              )}
            </tbody>
          </table>
          {(data?.pages ?? 0) > 1 && (
            <div className="border-t">
              <Pager
                page={page}
                pages={data?.pages ?? 1}
                total={data?.total ?? 0}
                onPage={(p) => setPage(p)}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                itemLabel="customers"
              />
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Group row (sales area header) ────────────────────────────────────────────

function AreaGroupRow({
  area,
  expanded,
  onToggle,
  storeId,
  overdueOnly,
  asOf,
  search,
}: {
  area: SalesAreaDuesSummaryRow
  expanded: boolean
  onToggle: () => void
  storeId?: string
  overdueOnly: boolean
  asOf: string
  search: string
}) {
  const overduePct = area.total_due > 0
    ? Math.round((area.overdue_due / area.total_due) * 100)
    : 0

  return (
    <>
      <tr
        className="bg-muted/40 hover:bg-muted/60 cursor-pointer select-none border-b transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3 w-8">
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          }
        </td>
        <td className="px-4 py-3" colSpan={2}>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <span className="font-semibold text-sm text-foreground">
                {area.sales_area_name ?? 'Unassigned'}
              </span>
              {area.business_unit_name && area.sales_area_id && (
                <span className="ml-1.5 text-xs text-muted-foreground">{area.business_unit_name}</span>
              )}
            </div>
            {area.sales_area_code && (
              <Badge variant="outline" className="text-[10px] py-0 h-4 font-mono">
                {area.sales_area_code}
              </Badge>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {area.customer_count}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            {area.open_invoice_count}
          </div>
        </td>
        <td className="px-4 py-3 text-right font-semibold tabular-nums">
          {money(area.total_due)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          <AgingBadge value={area.not_due} />
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          <AgingBadge value={area.days_1_30} />
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          <AgingBadge value={area.days_31_60} variant="warn" />
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          <div className="flex flex-col items-end gap-0.5">
            <AgingBadge value={area.days_90_plus} variant="danger" />
            {overduePct >= 30 && (
              <span className="text-[10px] text-destructive">{overduePct}% overdue</span>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <AreaCustomerRows
          salesAreaId={area.sales_area_id}
          storeId={storeId}
          overduOnly={overdueOnly}
          asOf={asOf}
          search={search}
        />
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SalesAreaDues() {
  const scope = useSalesScopeFilter()
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [asOf, setAsOf] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const summaryParams: Record<string, unknown> = {
    ...(scope.apiParams.store_id ? { store_id: scope.apiParams.store_id } : {}),
    ...(scope.apiParams.sales_area_id ? { sales_area_id: scope.apiParams.sales_area_id } : {}),
    ...(overdueOnly ? { overdue_only: true } : {}),
    ...(asOf ? { as_of: asOf } : {}),
  }

  const { data: summary, isLoading: summaryLoading } = useSalesAreaDuesSummary(summaryParams)

  const toggle = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
  }

  const totals = summary?.totals
  const areas = summary?.areas ?? []

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Page header */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">CRM</p>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Sales Area Dues</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Customer payment outstanding grouped by sales area
        </p>
      </div>

      {/* KPI strip */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Total Outstanding', value: totals.total_due, icon: Banknote, danger: false },
            { label: 'Not Due', value: totals.not_due, icon: null, danger: false },
            { label: '1–30 Days', value: totals.days_1_30, icon: null, danger: false },
            { label: '31–60 Days', value: totals.days_31_60, icon: null, danger: false },
            { label: '61–90 Days', value: totals.days_61_90, icon: null, danger: true },
            { label: '>90 Days', value: totals.days_90_plus, icon: AlertCircle, danger: true },
          ].map(({ label, value, icon: Icon, danger }) => (
            <Card key={label} className={cn(danger && Number(value) > 0 ? 'border-destructive/40' : '')}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  {Icon && <Icon className={cn('h-3.5 w-3.5', danger ? 'text-destructive' : '')} />}
                  {label}
                </div>
                <div className={cn('text-base font-bold tabular-nums', danger && Number(value) > 0 ? 'text-destructive' : '')}>
                  {fmt(value)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
            <form onSubmit={handleSearch} className="flex min-w-0 flex-1 items-center gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="flex h-8 w-full rounded-md border border-input bg-transparent py-1 pl-8 pr-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Search customer…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                />
              </div>
              <Button type="submit" variant="outline" size="sm" className="h-8 shrink-0 px-2.5 text-xs">
                Search
              </Button>
            </form>
            <SalesScopeFilters
              className="min-w-0 flex-[2] flex-nowrap gap-1.5"
              itemClassName="min-w-0 flex-1"
              businessUnitId={scope.businessUnitId}
              branchId={scope.branchId}
              salesAreaId={scope.salesAreaId}
              onBusinessUnitChange={(id) => { scope.handleBusinessUnitChange(id) }}
              onBranchChange={(id) => { scope.handleBranchChange(id) }}
              onSalesAreaChange={(id) => { scope.handleSalesAreaChange(id) }}
              size="sm"
            />
            <div className="flex shrink-0 items-center gap-1">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">As of</Label>
              <Input
                type="date"
                className="h-8 w-[8.25rem] px-2 text-xs"
                value={asOf}
                onChange={e => setAsOf(e.target.value)}
              />
            </div>
            <Button
              variant={overdueOnly ? 'default' : 'outline'}
              size="sm"
              className="h-8 shrink-0 px-2 text-xs"
              onClick={() => setOverdueOnly(v => !v)}
            >
              <AlertCircle className="mr-1 h-3.5 w-3.5" />
              Overdue
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grouped table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground bg-muted/30">
                  <th className="w-8 px-4 py-3" />
                  <th className="px-4 py-3 text-left font-medium" colSpan={2}>Sales Area</th>
                  <th className="px-4 py-3 text-right font-medium">Customers</th>
                  <th className="px-4 py-3 text-right font-medium">Invoices</th>
                  <th className="px-4 py-3 text-right font-medium">Total Due</th>
                  <th className="px-4 py-3 text-right font-medium">Not Due</th>
                  <th className="px-4 py-3 text-right font-medium">1–30d</th>
                  <th className="px-4 py-3 text-right font-medium">31–60d</th>
                  <th className="px-4 py-3 text-right font-medium">&gt;90d</th>
                </tr>
              </thead>
              <tbody>
                {summaryLoading ? (
                  <LoadingRow cols={10} />
                ) : areas.length === 0 ? (
                  <EmptyRow
                    cols={10}
                    message="No open dues found. Adjust the filters above."
                  />
                ) : (
                  areas.map((area) => {
                    const key = area.sales_area_id ?? 'unassigned'
                    return (
                      <AreaGroupRow
                        key={key}
                        area={area}
                        expanded={expanded.has(key)}
                        onToggle={() => toggle(key)}
                        storeId={scope.storeId}
                        overdueOnly={overdueOnly}
                        asOf={asOf}
                        search={search}
                      />
                    )
                  })
                )}
              </tbody>
              {areas.length > 0 && totals && (
                <tfoot>
                  <tr className="border-t bg-muted/50 font-semibold text-sm">
                    <td />
                    <td className="px-4 py-3 text-muted-foreground" colSpan={2}>Grand Total</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {areas.reduce((s, a) => s + a.customer_count, 0)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {areas.reduce((s, a) => s + a.open_invoice_count, 0)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(totals.total_due)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.not_due)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.days_1_30)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.days_31_60)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-destructive">{fmt(totals.days_90_plus)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
