import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Eye, Loader2, RefreshCw, Users, FileText, Package, Search, Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import { BranchSelect } from '@/components/common/BranchSelect'
import { websiteApi, type WebsiteAnalyticsReport } from '@/api/websites'
import { cn } from '@/lib/utils'

const PERIOD_PRESETS = [
  { key: '30m', label: '30m', minutes: 30 },
  { key: '1h', label: '1h', minutes: 60 },
  { key: '1d', label: '1d', days: 1 },
  { key: '7d', label: '7d', days: 7 },
  { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 },
] as const

type PeriodKey = (typeof PERIOD_PRESETS)[number]['key']

function periodHint(key: PeriodKey): string {
  const p = PERIOD_PRESETS.find((x) => x.key === key)
  if (!p) return 'Selected period'
  if ('minutes' in p && p.minutes != null) {
    return p.minutes === 60 ? 'Last 1 hour' : `Last ${p.minutes} minutes`
  }
  const d = 'days' in p ? p.days : 7
  return d === 1 ? 'Last 1 day' : `Last ${d} days`
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Eye
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export default function WebsiteAnalyticsPage() {
  const [businessUnitId, setBusinessUnitId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [periodKey, setPeriodKey] = useState<PeriodKey>('7d')
  const [pagesSearch, setPagesSearch] = useState('')
  const [productsSearch, setProductsSearch] = useState('')
  const [servicesSearch, setServicesSearch] = useState('')
  const period = PERIOD_PRESETS.find((p) => p.key === periodKey) ?? PERIOD_PRESETS[3]

  const params = useMemo(
    () => ({
      business_unit_id: businessUnitId || undefined,
      branch_id: branchId || undefined,
      days: 'minutes' in period && period.minutes != null ? undefined : ('days' in period ? period.days : 7),
      minutes: 'minutes' in period ? period.minutes : undefined,
      limit: 50,
    }),
    [businessUnitId, branchId, period],
  )

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['website-analytics', params],
    queryFn: () => websiteApi.getAnalytics(params),
    refetchInterval: 60_000,
  })

  const report: WebsiteAnalyticsReport | undefined = data
  const summary = report?.summary
  const scoped = Boolean(businessUnitId || branchId)

  const filteredPages = useMemo(() => {
    const rows = report?.pages ?? []
    const q = pagesSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => row.path.toLowerCase().includes(q))
  }, [report?.pages, pagesSearch])

  const filteredProducts = useMemo(() => {
    const rows = report?.products ?? []
    const q = productsSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((p) => {
      const product = `${p.name || ''} ${p.slug || ''}`.toLowerCase()
      return product.includes(q)
    })
  }, [report?.products, productsSearch])

  const filteredServices = useMemo(() => {
    const rows = report?.services ?? []
    const q = servicesSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((s) => {
      const service = `${s.name || ''} ${s.slug || ''}`.toLowerCase()
      return service.includes(q)
    })
  }, [report?.services, servicesSearch])

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <BarChart3 className="h-5 w-5 text-primary" />
            Website Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Storefront page views from visitor journeys, plus product and service view counts.
            {scoped
              ? ' Branch filter uses ?branch= on storefront URLs.'
              : ' Showing all business units.'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="shrink-0 gap-1.5"
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="w-full min-w-[10rem] sm:w-[11rem]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Business unit</label>
          <BusinessUnitSelect
            value={businessUnitId}
            onChange={(id) => {
              setBusinessUnitId(id)
              setBranchId('')
            }}
            allowAll
            autoSelectDefault={false}
          />
        </div>
        <div className="w-full min-w-[10rem] sm:w-[11rem]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Branch</label>
          <BranchSelect
            businessUnitId={businessUnitId || null}
            value={branchId}
            onChange={setBranchId}
            allowAll
            autoSelectDefault={false}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Period</span>
          <div className="flex flex-wrap gap-1">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodKey(p.key)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  periodKey === p.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load website analytics. Try refreshing.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          icon={FileText}
          label="Page views"
          value={(summary?.total_page_views ?? 0).toLocaleString()}
          hint={periodHint(periodKey)}
        />
        <KpiCard
          icon={Users}
          label="Unique visitors"
          value={(summary?.unique_visitors ?? 0).toLocaleString()}
        />
        <KpiCard
          icon={Eye}
          label="Product views"
          value={(summary?.total_product_views ?? 0).toLocaleString()}
          hint={scoped ? 'From journey (branch-scoped)' : 'Catalog totals'}
        />
        <KpiCard
          icon={Wrench}
          label="Service visits"
          value={(summary?.total_service_views ?? 0).toLocaleString()}
          hint={scoped ? 'From journey (branch-scoped)' : 'Catalog totals'}
        />
        <KpiCard
          icon={Users}
          label="Active now"
          value={(summary?.realtime_active_users ?? 0).toLocaleString()}
          hint="Last 30 minutes"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <h2 className="text-sm font-bold text-foreground">Realtime pages</h2>
              <span className="text-xs text-muted-foreground">
                {pagesSearch.trim()
                  ? `${filteredPages.length} of ${report?.pages?.length ?? 0}`
                  : `${report?.pages?.length ?? 0} paths`}
              </span>
            </div>
            <div className="relative w-full sm:w-52">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={pagesSearch}
                onChange={(e) => setPagesSearch(e.target.value)}
                placeholder="Search page path…"
                className="h-8 pl-8 text-xs focus-visible:border-primary focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Page path</th>
                  <th className="px-4 py-2.5 font-medium text-right">Active</th>
                  <th className="px-4 py-2.5 font-medium text-right">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </td>
                  </tr>
                ) : !report?.pages?.length ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                      No page views in this period
                      {scoped ? ' for the selected scope' : ''}.
                    </td>
                  </tr>
                ) : !filteredPages.length ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                      No pages match “{pagesSearch.trim()}”.
                    </td>
                  </tr>
                ) : (
                  filteredPages.map((row) => (
                    <tr key={row.path} className="hover:bg-muted/30">
                      <td className="max-w-[18rem] truncate px-4 py-2.5 font-mono text-xs text-foreground" title={row.path}>
                        {row.path}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-foreground">
                        {row.active_users}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {row.views.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Package className="h-4 w-4 text-primary" />
                Top products
              </h2>
              <span className="text-xs text-muted-foreground">
                {productsSearch.trim()
                  ? `${filteredProducts.length} of ${report?.products?.length ?? 0}`
                  : scoped
                    ? 'By branch journey'
                    : 'By catalog view count'}
              </span>
            </div>
            <div className="relative w-full sm:w-52">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={productsSearch}
                onChange={(e) => setProductsSearch(e.target.value)}
                placeholder="Search products…"
                className="h-8 pl-8 text-xs focus-visible:border-primary focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" /> Views
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-12 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </td>
                  </tr>
                ) : !report?.products?.length ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-12 text-center text-muted-foreground">
                      No product views yet
                      {scoped ? ' for this branch' : ''}.
                    </td>
                  </tr>
                ) : !filteredProducts.length ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-12 text-center text-muted-foreground">
                      No products match “{productsSearch.trim()}”.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.slug} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-lg object-cover bg-muted"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{p.name}</p>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">{p.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-foreground">
                        {p.view_count.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Wrench className="h-4 w-4 text-primary" />
                Top services
              </h2>
              <span className="text-xs text-muted-foreground">
                {servicesSearch.trim()
                  ? `${filteredServices.length} of ${report?.services?.length ?? 0}`
                  : scoped
                    ? 'By branch journey'
                    : 'By catalog view count'}
              </span>
            </div>
            <div className="relative w-full sm:w-52">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={servicesSearch}
                onChange={(e) => setServicesSearch(e.target.value)}
                placeholder="Search services…"
                className="h-8 pl-8 text-xs focus-visible:border-primary focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Service</th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" /> Visits
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-12 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </td>
                  </tr>
                ) : !report?.services?.length ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-12 text-center text-muted-foreground">
                      No service visits yet
                      {scoped ? ' for this branch' : ''}.
                    </td>
                  </tr>
                ) : !filteredServices.length ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-12 text-center text-muted-foreground">
                      No services match “{servicesSearch.trim()}”.
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((s) => (
                    <tr key={s.slug} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {s.image_url ? (
                            <img
                              src={s.image_url}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-lg object-cover bg-muted"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <Wrench className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{s.name}</p>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">{s.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-foreground">
                        {s.view_count.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
