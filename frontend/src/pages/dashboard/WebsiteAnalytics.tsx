import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Eye, Loader2, RefreshCw, Users, FileText, Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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

export default function WebsiteAnalytics() {
  const { user } = useAuthStore()
  const [vendorId, setVendorId] = useState('')
  const [businessUnitId, setBusinessUnitId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [periodKey, setPeriodKey] = useState<PeriodKey>('7d')
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
      for (const row of [...(report.pages || []), ...(report.products || [])]) {
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          icon={Users}
          label="Active now"
          value={(summary?.realtime_active_users ?? 0).toLocaleString()}
          hint="Last 30 minutes"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">Realtime pages</h2>
            <span className="text-xs text-gray-500">{report?.pages?.length ?? 0} paths</span>
          </div>
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
                ) : (
                  report.pages.map((row) => (
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
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
              <Package className="h-4 w-4 text-primary" />
              Top products
            </h2>
            <span className="text-xs text-gray-500">
              {businessUnitId || branchId ? 'By branch journey' : 'By view count'}
            </span>
          </div>
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
                ) : (
                  report.products.map((p) => (
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
        </section>
      </div>
    </div>
  )
}
