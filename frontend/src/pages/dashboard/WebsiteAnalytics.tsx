import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, ChevronDown, ChevronLeft, ChevronRight, Eye, Loader2, RefreshCw, Users, FileText, Package, Search, Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff } from '@/lib/platformAccess'
import { useAdminVendors } from '@/hooks/useAdmin'
import {
  adminApi,
  PLATFORM_ANALYTICS_SITE_ID,
  type AdminWebsiteAnalyticsReport,
} from '@/api/admin.api'
import { cn } from '@/lib/utils'

const TABLE_PAGE_SIZE = 10

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

const isPlatformSite = (id: string) => id === PLATFORM_ANALYTICS_SITE_ID

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
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-gray-500">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  )
}

function storeLabel(s: { name: string; code?: string | null }) {
  return s.code ? `${s.code} — ${s.name}` : s.name
}

function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    totalPages,
    page: safePage,
  }
}

function TablePager({
  page,
  totalPages,
  total,
  pageSize,
  itemLabel,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  itemLabel: string
  onPageChange: (page: number) => void
}) {
  if (total <= 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-gray-500">
        {from}–{to} of {total} {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[4rem] px-2 text-center text-xs tabular-nums text-gray-500">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function CollapsibleSection({
  title,
  icon: Icon,
  meta,
  open,
  onOpenChange,
  searchSlot,
  children,
}: {
  title: string
  icon?: typeof Package
  meta?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  searchSlot?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50',
          open && 'border-b border-gray-100',
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-primary" /> : null}
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          {meta ? <span className="text-xs text-gray-500">{meta}</span> : null}
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <>
          {searchSlot ? (
            <div className="border-b border-gray-100 px-4 py-2.5">
              {searchSlot}
            </div>
          ) : null}
          {children}
        </>
      ) : null}
    </section>
  )
}

export default function WebsiteAnalytics() {
  const { user } = useAuthStore()
  const [vendorId, setVendorId] = useState('')
  const [businessUnitId, setBusinessUnitId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [periodKey, setPeriodKey] = useState<PeriodKey>('7d')
  const [pagesSearch, setPagesSearch] = useState('')
  const [productsSearch, setProductsSearch] = useState('')
  const [servicesSearch, setServicesSearch] = useState('')
  const [pagesPage, setPagesPage] = useState(1)
  const [productsPage, setProductsPage] = useState(1)
  const [servicesPage, setServicesPage] = useState(1)
  const [pagesOpen, setPagesOpen] = useState(true)
  const [productsOpen, setProductsOpen] = useState(true)
  const [servicesOpen, setServicesOpen] = useState(true)
  const period = PERIOD_PRESETS.find((p) => p.key === periodKey) ?? PERIOD_PRESETS[3]

  // Admin vendors API allows size <= 100 (422 if larger) — that left Branch empty.
  const { data: vendorsData } = useAdminVendors(
    { page: 1, size: 100 },
    { enabled: isPlatformStaff(user) },
  )
  const vendors = vendorsData?.items ?? []

  const vendorScoped = !!vendorId && !isPlatformSite(vendorId)

  const { data: storesData, isLoading: storesLoading } = useQuery({
    queryKey: ['admin', 'vendor-stores', vendorId],
    queryFn: () => adminApi.listVendorStores(vendorId),
    enabled: isPlatformStaff(user) && vendorScoped,
  })

  const businessUnits = storesData?.business_units ?? []
  const branches = useMemo(() => {
    const all = storesData?.branches ?? []
    if (!businessUnitId) return all
    return all.filter((b) => b.parent_id === businessUnitId)
  }, [storesData?.branches, businessUnitId])

  const params = useMemo(
    () => ({
      site: isPlatformSite(vendorId) ? 'platform' : undefined,
      vendor_id: vendorScoped ? vendorId : undefined,
      business_unit_id: vendorScoped && businessUnitId ? businessUnitId : undefined,
      branch_id: vendorScoped && branchId ? branchId : undefined,
      days: 'minutes' in period && period.minutes != null ? undefined : ('days' in period ? period.days : 7),
      minutes: 'minutes' in period ? period.minutes : undefined,
      limit: 50,
    }),
    [vendorId, vendorScoped, businessUnitId, branchId, period],
  )

  const { data, isLoading, isFetching, refetch, error, isError } = useQuery({
    queryKey: ['admin', 'website-analytics', params],
    queryFn: () => adminApi.getWebsiteAnalytics(params),
    enabled: isPlatformStaff(user),
    refetchInterval: 60_000,
  })

  /** Businesses for Branch: KITERP.com + admin vendors + names from the open report. */
  const businessChoices = useMemo(() => {
    const map = new Map<string, string>()
    map.set(PLATFORM_ANALYTICS_SITE_ID, 'KITERP.com')
    for (const v of vendors) {
      const label = v.display_name || v.business_name || v.slug || v.id
      if (v.id) map.set(v.id, label)
    }
    const report = data
    if (report) {
      for (const row of [...(report.pages || []), ...(report.products || []), ...(report.services || [])]) {
        const id = row.vendor_id
        if (!id || map.has(id)) continue
        map.set(id, row.vendor_name || row.vendor_slug || id)
      }
    }
    const rest = Array.from(map.entries())
      .filter(([id]) => id !== PLATFORM_ANALYTICS_SITE_ID)
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    return [{ id: PLATFORM_ANALYTICS_SITE_ID, label: 'KITERP.com' }, ...rest]
  }, [vendors, data])

  /** Business unit dropdown: vendor list when All, else that vendor's BUs. */
  const buOptions = useMemo(() => {
    if (!vendorScoped) {
      return [
        { value: '', label: 'All businesses' },
        ...businessChoices.map((v) => ({
          value: v.id,
          label: v.label,
        })),
      ]
    }
    return [
      {
        value: `__vendor__:${vendorId}`,
        label: storesLoading ? 'Loading…' : 'All units for this business',
      },
      ...businessUnits.map((bu) => ({
        value: bu.id,
        label: `${storeLabel(bu)}${bu.is_default ? ' (default)' : ''}`,
      })),
    ]
  }, [vendorScoped, vendorId, businessChoices, storesLoading, businessUnits])

  const buSelectValue = !vendorScoped ? '' : businessUnitId || `__vendor__:${vendorId}`

  /**
   * Branch dropdown: All, KITERP.com (platform site), then businesses.
   */
  const branchOptions = useMemo(
    () => [
      { value: '', label: 'All businesses' },
      ...businessChoices.map((v) => ({
        value: v.id,
        label: v.label,
      })),
    ],
    [businessChoices],
  )

  const selectedVendorLabel = useMemo(() => {
    if (!vendorId) return 'All businesses'
    if (isPlatformSite(vendorId)) return 'KITERP.com'
    const v = businessChoices.find((x) => x.id === vendorId)
    return v?.label || 'Selected business'
  }, [vendorId, businessChoices])

  const storeBranchOptions = useMemo(
    () => [
      { value: '', label: storesLoading ? 'Loading…' : 'All store branches' },
      ...branches.map((b) => ({
        value: b.id,
        label: `${storeLabel(b)}${b.is_default ? ' (default)' : ''}`,
      })),
    ],
    [storesLoading, branches],
  )

  const filteredPages = useMemo(() => {
    const rows = data?.pages ?? []
    const q = pagesSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const business = `${row.vendor_name || ''} ${row.vendor_slug || ''}`.toLowerCase()
      return row.path.toLowerCase().includes(q) || business.includes(q)
    })
  }, [data?.pages, pagesSearch])

  const filteredProducts = useMemo(() => {
    const rows = data?.products ?? []
    const q = productsSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((p) => {
      const business = `${p.vendor_name || ''} ${p.vendor_slug || ''}`.toLowerCase()
      const product = `${p.name || ''} ${p.slug || ''}`.toLowerCase()
      return product.includes(q) || business.includes(q)
    })
  }, [data?.products, productsSearch])

  const filteredServices = useMemo(() => {
    const rows = data?.services ?? []
    const q = servicesSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((s) => {
      const business = `${s.vendor_name || ''} ${s.vendor_slug || ''}`.toLowerCase()
      const service = `${s.name || ''} ${s.slug || ''}`.toLowerCase()
      return service.includes(q) || business.includes(q)
    })
  }, [data?.services, servicesSearch])

  useEffect(() => {
    setPagesPage(1)
  }, [pagesSearch, vendorId, businessUnitId, branchId, periodKey])

  useEffect(() => {
    setProductsPage(1)
  }, [productsSearch, vendorId, businessUnitId, branchId, periodKey])

  useEffect(() => {
    setServicesPage(1)
  }, [servicesSearch, vendorId, businessUnitId, branchId, periodKey])

  const pagedPages = useMemo(
    () => paginateRows(filteredPages, pagesPage, TABLE_PAGE_SIZE),
    [filteredPages, pagesPage],
  )
  const pagedProducts = useMemo(
    () => paginateRows(filteredProducts, productsPage, TABLE_PAGE_SIZE),
    [filteredProducts, productsPage],
  )
  const pagedServices = useMemo(
    () => paginateRows(filteredServices, servicesPage, TABLE_PAGE_SIZE),
    [filteredServices, servicesPage],
  )

  if (!isPlatformStaff(user)) {
    return <Navigate to="/dashboard" replace />
  }

  const report: AdminWebsiteAnalyticsReport | undefined = data
  const summary = report?.summary
  const showVendorCol = !vendorId
  const scopeHint = !vendorId
    ? 'All businesses + KITERP.com'
    : isPlatformSite(vendorId)
      ? 'KITERP.com'
      : branchId
        ? 'Selected branch'
        : businessUnitId
          ? 'Selected business unit'
          : selectedVendorLabel

  const errorDetail =
    isError && error && typeof error === 'object' && 'response' in error
      ? String((error as { response?: { data?: { detail?: string }; status?: number } }).response?.data?.detail
        || (error as { response?: { status?: number } }).response?.status
        || 'Request failed')
      : isError
        ? 'Request failed'
        : null

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BarChart3 className="h-6 w-6 text-primary" />
            Website Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Open <strong>Branch</strong> and pick <strong>KITERP.com</strong> for the platform
            site, or a business (testotp, VRK, RK Mart, …) for that storefront only.
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

      <div className="relative z-20 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <FilterSelect
          label="Branch"
          value={vendorId}
          options={branchOptions}
          onChange={(id) => {
            setVendorId(id)
            setBusinessUnitId('')
            setBranchId('')
          }}
          className="sm:w-[18rem]"
        />

        {vendorScoped ? (
          <FilterSelect
            label="Store branch"
            value={branchId}
            options={storeBranchOptions}
            onChange={setBranchId}
            className="sm:w-[14rem]"
          />
        ) : null}

        {vendorScoped ? (
          <FilterSelect
            label="Store unit (optional)"
            value={buSelectValue}
            options={buOptions}
            onChange={(id) => {
              if (!id || id.startsWith('__vendor__:')) {
                setBusinessUnitId('')
                setBranchId('')
                return
              }
              setBusinessUnitId(id)
              setBranchId('')
            }}
            className="sm:w-[16rem]"
          />
        ) : null}

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">Period</span>
          <div className="flex flex-wrap gap-1">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodKey(p.key)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  periodKey === p.key
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {errorDetail ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load website analytics. {errorDetail}
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
          hint={scopeHint}
        />
        <KpiCard
          icon={Wrench}
          label="Service visits"
          value={(summary?.total_service_views ?? 0).toLocaleString()}
          hint={scopeHint}
        />
        <KpiCard
          icon={Users}
          label="Active now"
          value={(summary?.realtime_active_users ?? 0).toLocaleString()}
          hint="Last 30 minutes"
        />
      </div>

      <div className="flex flex-col gap-6">
        <CollapsibleSection
          title="Realtime pages"
          meta={
            pagesSearch.trim()
              ? `${filteredPages.length} of ${report?.pages?.length ?? 0}`
              : `${report?.pages?.length ?? 0} paths`
          }
          open={pagesOpen}
          onOpenChange={setPagesOpen}
          searchSlot={
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                value={pagesSearch}
                onChange={(e) => setPagesSearch(e.target.value)}
                placeholder={showVendorCol ? 'Search path or business…' : 'Search page path…'}
                className="h-8 pl-8 text-xs focus-visible:border-primary focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  {showVendorCol ? <th className="px-4 py-2.5 font-medium">Business</th> : null}
                  <th className="px-4 py-2.5 font-medium">Page path</th>
                  <th className="px-4 py-2.5 font-medium text-right">Active</th>
                  <th className="px-4 py-2.5 font-medium text-right">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={showVendorCol ? 4 : 3} className="px-4 py-12 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                    </td>
                  </tr>
                ) : !report?.pages?.length ? (
                  <tr>
                    <td colSpan={showVendorCol ? 4 : 3} className="px-4 py-12 text-center text-gray-500">
                      No page views in this period
                      {businessUnitId || branchId ? ' for the selected scope' : ''}.
                    </td>
                  </tr>
                ) : !filteredPages.length ? (
                  <tr>
                    <td colSpan={showVendorCol ? 4 : 3} className="px-4 py-12 text-center text-gray-500">
                      No pages match “{pagesSearch.trim()}”.
                    </td>
                  </tr>
                ) : (
                  pagedPages.rows.map((row) => (
                    <tr key={`${row.vendor_id || ''}:${row.path}`} className="hover:bg-gray-50">
                      {showVendorCol ? (
                        <td className="max-w-[8rem] truncate px-4 py-2.5 text-xs text-gray-600" title={row.vendor_name || ''}>
                          {row.vendor_name || row.vendor_slug || '—'}
                        </td>
                      ) : null}
                      <td className="max-w-[16rem] truncate px-4 py-2.5 font-mono text-xs text-gray-900" title={row.path}>
                        {row.path}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">
                        {row.active_users}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">
                        {row.views.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePager
            page={pagedPages.page}
            totalPages={pagedPages.totalPages}
            total={pagedPages.total}
            pageSize={TABLE_PAGE_SIZE}
            itemLabel="paths"
            onPageChange={setPagesPage}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Top products"
          icon={Package}
          meta={
            productsSearch.trim()
              ? `${filteredProducts.length} of ${report?.products?.length ?? 0}`
              : businessUnitId || branchId
                ? 'By branch journey'
                : 'By view count'
          }
          open={productsOpen}
          onOpenChange={setProductsOpen}
          searchSlot={
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                value={productsSearch}
                onChange={(e) => setProductsSearch(e.target.value)}
                placeholder={showVendorCol ? 'Search product or business…' : 'Search products…'}
                className="h-8 pl-8 text-xs focus-visible:border-primary focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  {showVendorCol ? <th className="px-4 py-2.5 font-medium">Business</th> : null}
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" /> Views
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={showVendorCol ? 3 : 2} className="px-4 py-12 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                    </td>
                  </tr>
                ) : !report?.products?.length ? (
                  <tr>
                    <td colSpan={showVendorCol ? 3 : 2} className="px-4 py-12 text-center text-gray-500">
                      No product views yet
                      {businessUnitId || branchId ? ' for this scope' : ''}.
                    </td>
                  </tr>
                ) : !filteredProducts.length ? (
                  <tr>
                    <td colSpan={showVendorCol ? 3 : 2} className="px-4 py-12 text-center text-gray-500">
                      No products match “{productsSearch.trim()}”.
                    </td>
                  </tr>
                ) : (
                  pagedProducts.rows.map((p) => (
                    <tr key={`${p.vendor_id || ''}:${p.slug}`} className="hover:bg-gray-50">
                      {showVendorCol ? (
                        <td className="max-w-[8rem] truncate px-4 py-2.5 text-xs text-gray-600" title={p.vendor_name || ''}>
                          {p.vendor_name || p.vendor_slug || '—'}
                        </td>
                      ) : null}
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-lg bg-gray-100 object-cover"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                              <Package className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">{p.name}</p>
                            <p className="truncate font-mono text-[11px] text-gray-400">{p.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">
                        {p.view_count.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePager
            page={pagedProducts.page}
            totalPages={pagedProducts.totalPages}
            total={pagedProducts.total}
            pageSize={TABLE_PAGE_SIZE}
            itemLabel="products"
            onPageChange={setProductsPage}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Top services"
          icon={Wrench}
          meta={
            servicesSearch.trim()
              ? `${filteredServices.length} of ${report?.services?.length ?? 0}`
              : businessUnitId || branchId
                ? 'By branch journey'
                : 'By view count'
          }
          open={servicesOpen}
          onOpenChange={setServicesOpen}
          searchSlot={
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                value={servicesSearch}
                onChange={(e) => setServicesSearch(e.target.value)}
                placeholder={showVendorCol ? 'Search service or business…' : 'Search services…'}
                className="h-8 pl-8 text-xs focus-visible:border-primary focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  {showVendorCol ? <th className="px-4 py-2.5 font-medium">Business</th> : null}
                  <th className="px-4 py-2.5 font-medium">Service</th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" /> Visits
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={showVendorCol ? 3 : 2} className="px-4 py-12 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                    </td>
                  </tr>
                ) : !report?.services?.length ? (
                  <tr>
                    <td colSpan={showVendorCol ? 3 : 2} className="px-4 py-12 text-center text-gray-500">
                      No service visits yet
                      {businessUnitId || branchId ? ' for this scope' : ''}.
                    </td>
                  </tr>
                ) : !filteredServices.length ? (
                  <tr>
                    <td colSpan={showVendorCol ? 3 : 2} className="px-4 py-12 text-center text-gray-500">
                      No services match “{servicesSearch.trim()}”.
                    </td>
                  </tr>
                ) : (
                  pagedServices.rows.map((s) => (
                    <tr key={`${s.vendor_id || ''}:${s.slug}`} className="hover:bg-gray-50">
                      {showVendorCol ? (
                        <td className="max-w-[8rem] truncate px-4 py-2.5 text-xs text-gray-600" title={s.vendor_name || ''}>
                          {s.vendor_name || s.vendor_slug || '—'}
                        </td>
                      ) : null}
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {s.image_url ? (
                            <img
                              src={s.image_url}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-lg bg-gray-100 object-cover"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                              <Wrench className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">{s.name}</p>
                            <p className="truncate font-mono text-[11px] text-gray-400">{s.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">
                        {s.view_count.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePager
            page={pagedServices.page}
            totalPages={pagedServices.totalPages}
            total={pagedServices.total}
            pageSize={TABLE_PAGE_SIZE}
            itemLabel="services"
            onPageChange={setServicesPage}
          />
        </CollapsibleSection>
      </div>
    </div>
  )
}
