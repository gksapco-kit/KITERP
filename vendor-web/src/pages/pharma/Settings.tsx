import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { FlaskConical, Globe, Hash, ShieldCheck, Warehouse, X } from 'lucide-react'
import { pharmaApi } from '@/api/pharma'
import { vendorApi } from '@/api/vendor'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { BusinessUnitSelect, useResolveBuBranch } from '@/components/common/BusinessUnitSelect'
import { BranchSelect } from '@/components/common/BranchSelect'
import { PlantSelect } from '@/components/common/PlantSelect'
import {
  PharmaCard,
  PharmaPageHeader,
  fmtErr,
} from './pharmaShared'

type ProductRow = {
  id: string
  name: string
  sku?: string | null
  batch_managed?: boolean
  serial_managed?: boolean
  shelf_life_days?: number | null
  retest_days?: number | null
  qc_required_on_receipt?: boolean
  qc_required_on_production?: boolean
  gtin?: string | null
  ndc?: string | null
  requires_cold_chain?: boolean
  storage_condition?: string | null
}

const HUB_CARDS = [
  {
    to: '/pharma/settings/batch-numbering',
    icon: Hash,
    title: 'Batch numbering',
    tone: 'bg-emerald-50 border-emerald-200/80 hover:border-emerald-300',
    subtitle: (ctx: { sequences: number }) =>
      `${ctx.sequences} sequence${ctx.sequences === 1 ? '' : 's'}`,
  },
  {
    to: '/pharma/settings/esign',
    icon: ShieldCheck,
    title: 'E-sign & approval policy',
    tone: 'bg-card border-border hover:border-primary/30',
    subtitle: (ctx: { dualSignCount: number }) =>
      ctx.dualSignCount > 0
        ? `${ctx.dualSignCount} dual-sign action${ctx.dualSignCount === 1 ? '' : 's'}`
        : 'single approver',
  },
  {
    to: '/pharma/settings/storage',
    icon: Warehouse,
    title: 'Storage location types',
    tone: 'bg-card border-border hover:border-primary/30',
    subtitle: () => 'Quarantine · rejected · returns',
  },
  {
    to: '/pharma/settings/regulatory',
    icon: Globe,
    title: 'Regulatory integrations',
    tone: 'bg-card border-border hover:border-primary/30',
    subtitle: (ctx: { regulatoryLive: boolean }) =>
      ctx.regulatoryLive ? 'Live credentials set' : 'Stub mode',
    subtitleClass: (ctx: { regulatoryLive: boolean }) =>
      ctx.regulatoryLive ? 'text-emerald-700' : 'text-muted-foreground',
  },
  {
    to: '/pharma/settings/products',
    icon: FlaskConical,
    title: 'Product enrollment',
    tone: 'bg-card border-border hover:border-primary/30',
    subtitle: (ctx: { enrolledCount: number }) =>
      `${ctx.enrolledCount} product${ctx.enrolledCount === 1 ? '' : 's'} enrolled`,
  },
] as const

export default function PharmaSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlStoreId = searchParams.get('store_id') || ''
  const urlPlantId = searchParams.get('plant_id') || ''
  const resolved = useResolveBuBranch(urlStoreId || null)

  const [products, setProducts] = useState<ProductRow[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [productTotal, setProductTotal] = useState(0)
  const [enrolledCount, setEnrolledCount] = useState(0)
  const [sequences, setSequences] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [esignCfg, setEsignCfg] = useState<Record<string, any>>({})

  // Org-scope filter state (seeded from URL when returning from sub-pages)
  const [buId, setBuId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [plantId, setPlantId] = useState(urlPlantId)
  const [scopeHydrated, setScopeHydrated] = useState(!urlStoreId)

  useEffect(() => {
    if (scopeHydrated) return
    if (!urlStoreId) {
      setScopeHydrated(true)
      return
    }
    if (resolved.buId) {
      setBuId(resolved.buId)
      setBranchId(resolved.branchId)
      setScopeHydrated(true)
    }
  }, [resolved.buId, resolved.branchId, urlStoreId, scopeHydrated])

  const scopeStoreId = branchId || buId
  const hasScope = !!(buId || branchId || plantId)

  useEffect(() => {
    if (!scopeHydrated) return
    const next = new URLSearchParams()
    if (scopeStoreId) next.set('store_id', scopeStoreId)
    if (plantId) next.set('plant_id', plantId)
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeStoreId, plantId, scopeHydrated])

  const loadProducts = async (storeId = scopeStoreId) => {
    const res = await vendorApi.listProducts({
      size: 200,
      product_type: 'physical',
      pharma_managed: true,
      ...(storeId ? { store_id: storeId } : {}),
    })
    const items = (res?.items || []) as ProductRow[]
    setProducts(items)
    setProductTotal(res?.total ?? items.length)
    setEnrolledCount(res?.total ?? items.length)
    // Drop selection if the product is no longer in this scope
    setSelectedProductId((prev) => (prev && !items.some((p) => p.id === prev) ? '' : prev))
  }

  const load = async () => {
    setLoading(true)
    try {
      const [seqRes, settings] = await Promise.all([
        pharmaApi.sequences(plantId ? { plant_id: plantId } : undefined),
        pharmaApi.getSettings(),
      ])
      await loadProducts(scopeStoreId)
      setSequences(seqRes?.sequences || [])
      setEsignCfg(settings || {})
    } catch (e: any) {
      toast.error(fmtErr(e, 'Failed to load foundations'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!scopeHydrated) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeHydrated])

  // Reload everything (including sequence count) when plant scope changes.
  useEffect(() => {
    if (!scopeHydrated) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantId])

  // Reload product list when BU/branch scope changes.
  useEffect(() => {
    if (!scopeHydrated) return
    loadProducts(scopeStoreId).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeStoreId])

  const productOptions = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    const source = !q
      ? products
      : products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q),
        )
    return [
      { value: '', label: 'All products', hint: `${products.length} enrolled` },
      ...source.map((p) => ({
        value: p.id,
        label: p.name,
        hint: p.sku || undefined,
      })),
    ]
  }, [products, productQuery])

  const displayedProducts = useMemo(() => {
    if (selectedProductId) {
      return products.filter((p) => p.id === selectedProductId)
    }
    const q = productQuery.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q),
    )
  }, [products, selectedProductId, productQuery])

  const patchProduct = async (id: string, patch: Record<string, unknown>) => {
    try {
      await vendorApi.updateProduct(id, patch)
      toast.success('Product updated')
      await load()
    } catch (e: any) {
      toast.error(fmtErr(e, 'Update failed'))
    }
  }

  const batchManagedCount = displayedProducts.filter((p) => p.batch_managed).length
  const qcGatedCount = displayedProducts.filter(
    (p) => p.qc_required_on_receipt || p.qc_required_on_production,
  ).length

  const dualSignCount = [
    'min_approvers_release',
    'min_approvers_bpr_complete',
    'min_approvers_capa_close',
    'min_approvers_cc_approve',
  ].filter((key) => Number(esignCfg[key] ?? 1) >= 2).length

  const regulatoryLive = Boolean(esignCfg.vrs_endpoint) || Boolean(esignCfg.nmvs_endpoint)
  const hubCtx = {
    sequences: sequences.length,
    dualSignCount,
    regulatoryLive,
    enrolledCount,
  }

  // Build a query-string that plant-aware sub-pages can read to pre-scope themselves.
  const scopeParams = new URLSearchParams({
    ...(scopeStoreId ? { store_id: scopeStoreId } : {}),
    ...(plantId ? { plant_id: plantId } : {}),
  }).toString()
  const scopedHref = (base: string) => (scopeParams ? `${base}?${scopeParams}` : base)

  const clearScope = () => {
    setBuId('')
    setBranchId('')
    setPlantId('')
  }

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="Foundations"
        subtitle="Batch flags, GTIN/NDC, e-sign & track-and-trace policy, batch number sequences."
      />

      {/* Org scope filter — compact single row */}
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="w-48 shrink-0 space-y-0.5">
          <p className="text-[10px] leading-none text-muted-foreground">Business unit</p>
          <BusinessUnitSelect
            value={buId}
            onChange={(id) => {
              setBuId(id)
              setBranchId('')
              setPlantId('')
            }}
            allowAll
            autoSelectDefault={false}
            className="h-8 text-xs"
          />
        </div>
        <div className="w-48 shrink-0 space-y-0.5">
          <p className="text-[10px] leading-none text-muted-foreground">Branch</p>
          <BranchSelect
            businessUnitId={buId || null}
            value={branchId}
            onChange={setBranchId}
            allowAll
            className="h-8 text-xs"
          />
        </div>
        <div className="w-48 shrink-0 space-y-0.5">
          <p className="text-[10px] leading-none text-muted-foreground">Plant</p>
          <PlantSelect
            value={plantId}
            onChange={setPlantId}
            storeId={buId || null}
            allowAll
            className="h-8 text-xs"
          />
        </div>
        {hasScope && (
          <button
            type="button"
            onClick={clearScope}
            className="flex h-8 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear scope
          </button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-5">
        {HUB_CARDS.map((card) => {
          const Icon = card.icon
          const subtitle =
            card.to === '/pharma/settings/batch-numbering'
              ? card.subtitle({ sequences: hubCtx.sequences })
              : card.to === '/pharma/settings/esign'
                ? card.subtitle({ dualSignCount: hubCtx.dualSignCount })
                : card.to === '/pharma/settings/regulatory'
                  ? card.subtitle({ regulatoryLive: hubCtx.regulatoryLive })
                  : card.to === '/pharma/settings/products'
                    ? card.subtitle({ enrolledCount: hubCtx.enrolledCount })
                    : card.subtitle()
          const subtitleClass =
            'subtitleClass' in card && card.to === '/pharma/settings/regulatory'
              ? card.subtitleClass({ regulatoryLive: hubCtx.regulatoryLive })
              : 'text-muted-foreground'
          return (
            <Link
              key={card.to}
              to={scopedHref(card.to)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-all hover:-translate-y-0.5 hover:shadow-sm',
                card.tone,
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-foreground/70" />
              <span className="flex min-w-0 flex-col items-start leading-tight">
                <span className="truncate text-xs font-medium text-foreground">{card.title}</span>
                <span className={cn('text-[10px]', subtitleClass)}>{subtitle}</span>
              </span>
            </Link>
          )
        })}
      </div>

      <PharmaCard>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Product batch &amp; track-and-trace flags</h2>
          <span className="text-xs text-muted-foreground">
            {productTotal > 0 ? `${productTotal} product${productTotal === 1 ? '' : 's'} · ` : ''}
            {batchManagedCount} batch-managed · {qcGatedCount} QC gated
            {hasScope ? (
              <span className="ml-1">
                {' · '}
                {branchId ? 'branch' : buId ? 'business unit' : plantId ? 'plant' : 'org'} scope
              </span>
            ) : (
              <span className="ml-1"> · all org elements</span>
            )}
          </span>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input
            value={productQuery}
            onChange={(e) => {
              setProductQuery(e.target.value)
              // Typing clears a pinned selection so the dropdown/list can re-filter freely
              if (selectedProductId) setSelectedProductId('')
            }}
            placeholder="Search by name or SKU…"
            className="h-9 max-w-xs text-sm"
          />
          <Select
            className="h-9 max-w-sm"
            value={selectedProductId}
            onChange={(id) => {
              setSelectedProductId(id)
              if (id) setProductQuery('')
            }}
            options={productOptions}
            placeholder="Select product…"
            aria-label="Select product"
          />
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {!loading && products.length === 0 ? (
          <div className="py-8 text-center">
            <FlaskConical className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No products enrolled in pharma manufacturing yet.
            </p>
            <Link
              to="/pharma/settings/products"
              className="mt-2 inline-block text-sm text-primary underline-offset-2 hover:underline"
            >
              Go to Product enrollment →
            </Link>
          </div>
        ) : null}
        {!loading && products.length > 0 && displayedProducts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No products match that search.
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Batch</th>
                <th className="py-2 pr-3">Serial</th>
                <th className="py-2 pr-3">Cold</th>
                <th className="py-2 pr-3">GTIN</th>
                <th className="py-2 pr-3">NDC</th>
                <th className="py-2 pr-3">Storage</th>
                <th className="py-2 pr-3">Shelf life (d)</th>
                <th className="py-2 pr-3">Retest (d)</th>
                <th className="py-2 pr-3">QC on GR</th>
                <th className="py-2 pr-3">QC on Prod</th>
              </tr>
            </thead>
            <tbody>
              {displayedProducts.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.sku || p.id.slice(0, 8)}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={!!p.batch_managed}
                      onChange={(e) => patchProduct(p.id, { batch_managed: e.target.checked })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={!!p.serial_managed}
                      onChange={(e) => patchProduct(p.id, { serial_managed: e.target.checked })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={!!p.requires_cold_chain}
                      onChange={(e) => patchProduct(p.id, { requires_cold_chain: e.target.checked })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      className="h-8 w-28"
                      defaultValue={p.gtin ?? ''}
                      onBlur={(e) => patchProduct(p.id, { gtin: e.target.value.trim() || null })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      className="h-8 w-28"
                      defaultValue={p.ndc ?? ''}
                      onBlur={(e) => patchProduct(p.id, { ndc: e.target.value.trim() || null })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      className="h-8 rounded-md border border-input bg-background px-1 text-xs"
                      value={p.storage_condition || ''}
                      onChange={(e) =>
                        patchProduct(p.id, { storage_condition: e.target.value || null })
                      }
                    >
                      <option value="">—</option>
                      <option value="ambient">Ambient</option>
                      <option value="controlled_room">CRT</option>
                      <option value="refrigerated">2–8°C</option>
                      <option value="frozen">Frozen</option>
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      className="h-8 w-24"
                      type="number"
                      min={1}
                      defaultValue={p.shelf_life_days ?? ''}
                      onBlur={(e) => {
                        const raw = e.target.value.trim()
                        if (raw === '') { patchProduct(p.id, { shelf_life_days: null }); return }
                        const v = Number(raw)
                        if (!Number.isInteger(v) || v < 1) { toast.error('Shelf life must be a positive whole number'); e.target.value = String(p.shelf_life_days ?? ''); return }
                        patchProduct(p.id, { shelf_life_days: v })
                      }}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      className="h-8 w-24"
                      type="number"
                      min={1}
                      defaultValue={p.retest_days ?? ''}
                      onBlur={(e) => {
                        const raw = e.target.value.trim()
                        if (raw === '') { patchProduct(p.id, { retest_days: null }); return }
                        const v = Number(raw)
                        if (!Number.isInteger(v) || v < 1) { toast.error('Retest interval must be a positive whole number'); e.target.value = String(p.retest_days ?? ''); return }
                        if (p.shelf_life_days != null && v > p.shelf_life_days) { toast.error(`Retest interval (${v}) cannot exceed shelf life (${p.shelf_life_days} d)`); e.target.value = String(p.retest_days ?? ''); return }
                        patchProduct(p.id, { retest_days: v })
                      }}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={!!p.qc_required_on_receipt}
                      onChange={(e) => patchProduct(p.id, { qc_required_on_receipt: e.target.checked })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={!!p.qc_required_on_production}
                      onChange={(e) => patchProduct(p.id, { qc_required_on_production: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PharmaCard>
    </div>
  )
}
