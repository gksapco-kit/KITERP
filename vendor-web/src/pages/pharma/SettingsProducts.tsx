import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, FlaskConical, Package, Search, X } from 'lucide-react'
import { pharmaApi } from '@/api/pharma'
import { vendorApi } from '@/api/vendor'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BusinessUnitSelect, useResolveBuBranch } from '@/components/common/BusinessUnitSelect'
import { BranchSelect } from '@/components/common/BranchSelect'
import { PlantSelect } from '@/components/common/PlantSelect'
import { PharmaCard, PharmaPageHeader } from './pharmaShared'

type ProductRow = {
  id: string
  name: string
  sku?: string | null
  product_type?: string | null
  category?: string | null
  quantity?: number
  stock_status?: string | null
  pharma_managed: boolean
  batch_managed: boolean
}

type StockMap = Record<string, { on_hand: number; plant?: string }>

export default function PharmaSettingsProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlStoreId = searchParams.get('store_id') || ''
  const urlPlantId = searchParams.get('plant_id') || ''
  const resolved = useResolveBuBranch(urlStoreId || null)

  const [buId, setBuId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [plantId, setPlantId] = useState(urlPlantId)
  const [scopeHydrated, setScopeHydrated] = useState(!urlStoreId)

  // Seed BU/Branch from Foundations query params once stores are loaded.
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

  const foundationsHref = (() => {
    const q = new URLSearchParams({
      ...(scopeStoreId ? { store_id: scopeStoreId } : {}),
      ...(plantId ? { plant_id: plantId } : {}),
    }).toString()
    return q ? `/pharma/settings?${q}` : '/pharma/settings'
  })()

  const clearScope = () => {
    setBuId('')
    setBranchId('')
    setPlantId('')
  }

  // Keep the URL in sync so refresh / back to Foundations preserves scope.
  useEffect(() => {
    if (!scopeHydrated) return
    const next = new URLSearchParams()
    if (scopeStoreId) next.set('store_id', scopeStoreId)
    if (plantId) next.set('plant_id', plantId)
    const nextStr = next.toString()
    const curStr = searchParams.toString()
    if (nextStr !== curStr) setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeStoreId, plantId, scopeHydrated])

  const [enrolled, setEnrolled] = useState<ProductRow[]>([])
  const [candidates, setCandidates] = useState<ProductRow[]>([])
  const [stockMap, setStockMap] = useState<StockMap>({})
  const [loading, setLoading] = useState(true)
  const [enrolledSearch, setEnrolledSearch] = useState('')
  const [candidateSearch, setCandidateSearch] = useState('')
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set())
  const [selectedEnrolled, setSelectedEnrolled] = useState<Set<string>>(new Set())
  const [enrolling, setEnrolling] = useState(false)
  const [unenrolling, setUnenrolling] = useState(false)

  const load = async (storeId = scopeStoreId) => {
    setLoading(true)
    try {
      const scope = storeId ? { store_id: storeId } : {}
      const [enrolledRes, candidatesRes, stockRes] = await Promise.all([
        vendorApi.listProducts({ limit: 500, product_type: 'physical', pharma_managed: true, ...scope }),
        vendorApi.listProducts({ limit: 500, product_type: 'physical', pharma_managed: false, ...scope }),
        vendorApi.inventorySummary().catch(() => ({ items: [] })),
      ])

      setEnrolled((enrolledRes?.items || []) as ProductRow[])
      setCandidates((candidatesRes?.items || []) as ProductRow[])
      setSelectedCandidates(new Set())
      setSelectedEnrolled(new Set())

      const sm: StockMap = {}
      for (const item of stockRes?.items || []) {
        sm[item.product_id] = { on_hand: item.total_quantity ?? 0, plant: item.plant_name }
      }
      setStockMap(sm)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!scopeHydrated) return
    load(scopeStoreId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeStoreId, scopeHydrated])

  const handleEnroll = async () => {
    if (selectedCandidates.size === 0) return
    setEnrolling(true)
    try {
      const ids = [...selectedCandidates]
      await pharmaApi.enrollProducts(ids)
      toast.success(`${ids.length} product${ids.length > 1 ? 's' : ''} enrolled in pharma manufacturing`)
      setSelectedCandidates(new Set())
      await load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Enrollment failed')
    } finally {
      setEnrolling(false)
    }
  }

  const handleUnenroll = async () => {
    if (selectedEnrolled.size === 0) return
    setUnenrolling(true)
    try {
      const ids = [...selectedEnrolled]
      await pharmaApi.unenrollProducts(ids)
      toast.success(`${ids.length} product${ids.length > 1 ? 's' : ''} removed from pharma manufacturing`)
      setSelectedEnrolled(new Set())
      await load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Unenroll failed')
    } finally {
      setUnenrolling(false)
    }
  }

  const toggleCandidate = (id: string) => {
    setSelectedCandidates((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleEnrolled = (id: string) => {
    setSelectedEnrolled((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filteredCandidates = candidates.filter((p) => {
    if (!candidateSearch) return true
    const q = candidateSearch.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
  })

  const filteredEnrolled = enrolled.filter((p) => {
    if (!enrolledSearch) return true
    const q = enrolledSearch.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
  })

  const stockLabel = (id: string) => {
    const s = stockMap[id]
    if (!s) return null
    return s.on_hand > 0 ? `${s.on_hand} on hand${s.plant ? ` · ${s.plant}` : ''}` : 'no stock'
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          to={foundationsHref}
          className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Foundations
        </Link>
      </div>

      <PharmaPageHeader
        title="Pharma product enrollment"
        subtitle="Select which inventory products participate in pharmaceutical manufacturing. Only enrolled products appear in Batch &amp; track-and-trace flags."
      />

      {/* Org scope — same compact bar as Foundations */}
      <div className="mb-4 mt-4 flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 px-3 py-2">
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Candidates ── */}
        <PharmaCard>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-medium">Available products</h2>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {candidates.length}
              </span>
            </div>
            {selectedCandidates.size > 0 && (
              <Button
                size="sm"
                onClick={handleEnroll}
                disabled={enrolling}
                className="h-7 gap-1.5 text-xs"
              >
                <FlaskConical className="h-3 w-3" />
                {enrolling ? 'Enrolling…' : `Enroll ${selectedCandidates.size} selected`}
              </Button>
            )}
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              className="h-8 pl-8 text-sm"
            />
            {candidateSearch && (
              <button
                onClick={() => setCandidateSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : filteredCandidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {candidateSearch ? 'No matches' : 'All physical products are already enrolled.'}
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {filteredCandidates.map((p) => {
                const stock = stockLabel(p.id)
                const checked = selectedCandidates.has(p.id)
                return (
                  <li
                    key={p.id}
                    onClick={() => toggleCandidate(p.id)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-1 py-2.5 text-sm transition-colors hover:bg-muted/40',
                      checked && 'bg-emerald-50/60',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCandidate(p.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 shrink-0 accent-emerald-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {p.sku && <span>{p.sku}</span>}
                        {p.category && <span>{p.category}</span>}
                        {stock && (
                          <span
                            className={cn(
                              stock === 'no stock' ? 'text-amber-600' : 'text-emerald-700',
                            )}
                          >
                            {stock}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </PharmaCard>

        {/* ── Enrolled ── */}
        <PharmaCard>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-emerald-600" />
              <h2 className="font-medium">Enrolled in pharma</h2>
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                {enrolled.length}
              </span>
            </div>
            {selectedEnrolled.size > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleUnenroll}
                disabled={unenrolling}
                className="h-7 gap-1.5 text-xs text-destructive hover:border-destructive/50 hover:text-destructive"
              >
                <X className="h-3 w-3" />
                {unenrolling ? 'Removing…' : `Remove ${selectedEnrolled.size} selected`}
              </Button>
            )}
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={enrolledSearch}
              onChange={(e) => setEnrolledSearch(e.target.value)}
              placeholder="Search enrolled products…"
              className="h-8 pl-8 text-sm"
            />
            {enrolledSearch && (
              <button
                onClick={() => setEnrolledSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : filteredEnrolled.length === 0 ? (
            <div className="py-8 text-center">
              <FlaskConical className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {enrolledSearch
                  ? 'No matches'
                  : 'No products enrolled yet. Select from the left panel.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {filteredEnrolled.map((p) => {
                const stock = stockLabel(p.id)
                const checked = selectedEnrolled.has(p.id)
                return (
                  <li
                    key={p.id}
                    onClick={() => toggleEnrolled(p.id)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-1 py-2.5 text-sm transition-colors hover:bg-muted/40',
                      checked && 'bg-red-50/60',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEnrolled(p.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 shrink-0 accent-red-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{p.name}</span>
                        {p.batch_managed && (
                          <span className="shrink-0 rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-medium text-emerald-800">
                            Batch
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {p.sku && <span>{p.sku}</span>}
                        {p.category && <span>{p.category}</span>}
                        {stock && (
                          <span
                            className={cn(
                              stock === 'no stock' ? 'text-amber-600' : 'text-emerald-700',
                            )}
                          >
                            {stock}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {enrolled.length > 0 && (
            <p className="mt-3 text-right text-xs text-muted-foreground">
              Configure batch flags, GTIN/NDC and QC gates in{' '}
              <Link to={foundationsHref} className="text-primary underline-offset-2 hover:underline">
                Foundations
              </Link>
            </p>
          )}
        </PharmaCard>
      </div>
    </div>
  )
}
