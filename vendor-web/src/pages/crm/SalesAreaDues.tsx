import { useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ChevronDown, ChevronRight, Search,
  MapPin, Users, FileText, Banknote, AlertCircle, PhoneCall,
  TrendingUp,
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

function AgingBadge({
  value,
  variant,
}: {
  value: number | string | null | undefined
  variant?: 'safe' | 'low' | 'warn' | 'danger'
}) {
  const v = Number(value ?? 0)
  if (v <= 0) return <span className="text-muted-foreground/50 text-xs">—</span>
  const cls =
    variant === 'danger'
      ? 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-800'
      : variant === 'warn'
      ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-800'
      : variant === 'low'
      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-800'
      : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800'
  return (
    <span className={cn('inline-block rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums', cls)}>
      {money(v)}
    </span>
  )
}

function InvoiceStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground/50">—</span>
  const map: Record<string, string> = {
    paid: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    sent: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    draft: 'bg-muted text-muted-foreground ring-1 ring-border',
    overdue: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    partial: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    cancelled: 'bg-muted text-muted-foreground/60 ring-1 ring-border',
  }
  const cls = map[status.toLowerCase()] ?? 'bg-muted text-muted-foreground ring-1 ring-border'
  return (
    <span className={cn('inline-block rounded px-1.5 py-0.5 text-[10px] font-medium capitalize', cls)}>
      {status}
    </span>
  )
}

function formatShortDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function overdueSeverity(pct: number): 'none' | 'low' | 'medium' | 'high' | 'critical' {
  if (pct <= 0) return 'none'
  if (pct < 20) return 'low'
  if (pct < 40) return 'medium'
  if (pct < 70) return 'high'
  return 'critical'
}

const severityBorderCls: Record<string, string> = {
  none: 'border-l-2 border-l-transparent',
  low: 'border-l-2 border-l-blue-400',
  medium: 'border-l-2 border-l-amber-400',
  high: 'border-l-2 border-l-orange-500',
  critical: 'border-l-2 border-l-red-500',
}

const severityPillCls: Record<string, string> = {
  low: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  medium: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  high: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  critical: 'bg-red-50 text-red-700 ring-1 ring-red-200',
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
      <tr className="border-b last:border-0 hover:bg-primary/[0.02] transition-colors group">
        <td className="px-4 py-2.5 pl-14">
          <div className="flex flex-col gap-0.5">
            <a
              href={row.customer_id ? `/invoices?customer_id=${row.customer_id}` : '/invoices'}
              className="font-medium text-foreground hover:text-primary hover:underline transition-colors"
            >
              {row.customer_name}
            </a>
            {row.phone && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <PhoneCall className="h-2.5 w-2.5" />
                {row.phone}
              </span>
            )}
            {row.payment_blocked && (
              <Badge variant="destructive" className="mt-0.5 text-[10px] py-0 h-4 w-fit">Blocked</Badge>
            )}
          </div>
        </td>
        <td className="px-4 py-2.5">
          {row.customer_group
            ? <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium capitalize bg-muted text-muted-foreground">{row.customer_group}</span>
            : <span className="text-muted-foreground/50 text-xs">—</span>
          }
        </td>
        <td className="px-4 py-2.5 text-right text-xs tabular-nums text-muted-foreground font-medium">
          {row.open_invoices}
        </td>
        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
          {money(row.total_due)}
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums">
          <AgingBadge value={row.not_due} variant="safe" />
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums">
          <AgingBadge value={row.days_1_30} variant="low" />
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
            variant="outline"
            className="h-7 gap-1 text-xs border-dashed opacity-0 group-hover:opacity-100 transition-opacity hover:border-solid hover:bg-primary hover:text-primary-foreground"
            onClick={onFollowup}
            disabled={followupPending}
            title="Create payment follow-up"
          >
            <PhoneCall className="h-3 w-3" />
            Follow-up
          </Button>
        </td>
      </tr>
      {invoices.length > 0 && (
        <tr className="border-b last:border-0 bg-muted/10">
          <td colSpan={10} className="px-4 pb-3 pl-14 pt-0">
            <div className="mt-1.5 overflow-hidden rounded-lg border border-border/60 shadow-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground border-b border-border/60">
                    <th className="px-3 py-2 text-left font-medium">Invoice</th>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Due Date</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-border/40 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2">
                        <a href={`/invoices/${inv.id}`} className="font-semibold text-primary hover:underline">
                          {inv.invoice_number}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{formatShortDate(inv.created_at)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatShortDate(inv.due_date)}</td>
                      <td className="px-3 py-2"><InvoiceStatusBadge status={inv.status} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(inv.total)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{money(inv.balance_due)}</td>
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
        <div className="bg-muted/10 border-b">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted-foreground border-b bg-muted/30">
                <th className="px-4 py-2 text-left font-semibold pl-14 uppercase tracking-wide">Customer</th>
                <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide">Group</th>
                <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide">Inv.</th>
                <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide">Total Due</th>
                <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Not Due</th>
                <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">1–30d</th>
                <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">31–60d</th>
                <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">61–90d</th>
                <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">&gt;90d</th>
                <th className="px-4 py-2 text-center font-semibold uppercase tracking-wide">Actions</th>
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
  const severity = overdueSeverity(overduePct)

  return (
    <>
      <tr
        className={cn(
          'hover:bg-muted/50 cursor-pointer select-none border-b transition-colors',
          expanded ? 'bg-muted/40' : 'bg-background',
          severityBorderCls[severity],
        )}
        onClick={onToggle}
      >
        <td className="px-3 py-3 w-9 text-center">
          <span className={cn(
            'inline-flex items-center justify-center w-5 h-5 rounded transition-transform duration-150',
            expanded ? 'rotate-0' : '-rotate-90',
          )}>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </td>
        <td className="px-4 py-3" colSpan={2}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className={cn(
              'flex items-center justify-center w-6 h-6 rounded-full shrink-0',
              severity === 'none' ? 'bg-muted' : severityPillCls[severity]?.replace('ring-1 ring-', 'bg-')?.split(' ')[0] + ' bg-opacity-20',
            )}>
              <MapPin className={cn(
                'h-3 w-3 shrink-0',
                severity === 'none' || severity === 'low' ? 'text-muted-foreground' :
                severity === 'medium' ? 'text-amber-600' :
                severity === 'high' ? 'text-orange-600' : 'text-red-600',
              )} />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-sm text-foreground">
                {area.sales_area_name ?? 'Unassigned'}
              </span>
              {area.business_unit_name && area.sales_area_id && (
                <span className="ml-2 text-xs text-muted-foreground">{area.business_unit_name}</span>
              )}
            </div>
            {area.sales_area_code && (
              <Badge variant="outline" className="text-[10px] py-0 h-4 font-mono shrink-0">
                {area.sales_area_code}
              </Badge>
            )}
            {overduePct > 0 && (
              <span className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0',
                severityPillCls[severity] ?? 'bg-muted text-muted-foreground',
              )}>
                <TrendingUp className="h-2.5 w-2.5" />
                {overduePct}% overdue
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span className="font-medium tabular-nums">{area.customer_count}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span className="font-medium tabular-nums">{area.open_invoice_count}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right font-bold tabular-nums text-foreground">
          {money(area.total_due)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          <AgingBadge value={area.not_due} variant="safe" />
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          <AgingBadge value={area.days_1_30} variant="low" />
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          <AgingBadge value={area.days_31_60} variant="warn" />
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          <AgingBadge value={area.days_90_plus} variant="danger" />
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

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  colorCls,
  borderCls,
}: {
  label: string
  value: number | string | null | undefined
  icon?: React.ElementType | null
  colorCls: string
  borderCls?: string
}) {
  const v = Number(value ?? 0)
  return (
    <Card className={cn('transition-shadow hover:shadow-sm', borderCls)}>
      <CardContent className="p-3.5">
        <div className={cn('flex items-center gap-1.5 text-[11px] font-medium mb-1.5 uppercase tracking-wide', colorCls)}>
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
          {label}
        </div>
        <div className={cn('text-lg font-bold tabular-nums', v > 0 ? colorCls : 'text-muted-foreground')}>
          {v === 0 ? '—' : money(v)}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SalesAreaDues() {
  const scope = useSalesScopeFilter()
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [asOf, setAsOf] = useState(() => new Date().toLocaleDateString('en-CA'))
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">CRM</p>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Sales Area Dues</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Customer payment outstanding grouped by sales area
          </p>
        </div>
      </div>

      {/* KPI strip */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Total Outstanding" value={totals.total_due} icon={Banknote}
            colorCls="text-foreground" borderCls="" />
          <KpiCard label="Not Due" value={totals.not_due} icon={null}
            colorCls="text-emerald-700 dark:text-emerald-400"
            borderCls={Number(totals.not_due) > 0 ? 'border-emerald-200 dark:border-emerald-800' : ''} />
          <KpiCard label="1–30 Days" value={totals.days_1_30} icon={null}
            colorCls="text-blue-700 dark:text-blue-400"
            borderCls={Number(totals.days_1_30) > 0 ? 'border-blue-200 dark:border-blue-800' : ''} />
          <KpiCard label="31–60 Days" value={totals.days_31_60} icon={null}
            colorCls="text-amber-700 dark:text-amber-400"
            borderCls={Number(totals.days_31_60) > 0 ? 'border-amber-200 dark:border-amber-800' : ''} />
          <KpiCard label="61–90 Days" value={totals.days_61_90} icon={null}
            colorCls="text-orange-700 dark:text-orange-400"
            borderCls={Number(totals.days_61_90) > 0 ? 'border-orange-200 dark:border-orange-800' : ''} />
          <KpiCard label=">90 Days" value={totals.days_90_plus} icon={AlertCircle}
            colorCls="text-red-700 dark:text-red-400"
            borderCls={Number(totals.days_90_plus) > 0 ? 'border-red-200 dark:border-red-800' : ''} />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-3.5 pb-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <form onSubmit={handleSearch} className="flex min-w-0 flex-1 items-center gap-1.5" style={{ minWidth: '180px' }}>
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
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
            <div className="flex shrink-0 items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">As of</Label>
              <Input
                type="date"
                className="h-8 w-[8.25rem] px-2 text-xs"
                value={asOf}
                onChange={e => setAsOf(e.target.value)}
              />
            </div>
            <Button
              variant={overdueOnly ? 'destructive' : 'outline'}
              size="sm"
              className="h-8 shrink-0 px-2.5 text-xs gap-1"
              onClick={() => setOverdueOnly(v => !v)}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              Overdue only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grouped table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[11px] text-muted-foreground bg-muted/30 sticky top-0 z-10">
                  <th className="w-9 px-3 py-3" />
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide" colSpan={2}>Sales Area</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide">Customers</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide">Invoices</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide">Total Due</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Not Due</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">1–30d</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">31–60d</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">&gt;90d</th>
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
                  <tr className="border-t-2 border-border bg-muted/40 font-semibold text-sm">
                    <td />
                    <td className="px-4 py-3 text-foreground font-bold" colSpan={2}>Grand Total</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground font-medium">
                      {areas.reduce((s, a) => s + a.customer_count, 0)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground font-medium">
                      {areas.reduce((s, a) => s + a.open_invoice_count, 0)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold">{money(totals.total_due)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{fmt(totals.not_due)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-blue-700">{fmt(totals.days_1_30)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmt(totals.days_31_60)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-700 font-bold">{fmt(totals.days_90_plus)}</td>
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
