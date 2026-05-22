import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompanies } from '@/hooks/useFinance'
import { useProducts } from '@/hooks/useVendor'
import {
  useProductCosts,
  useCreateProductCost,
  useRollUpBomProductCost,
  useUpdateProductCost,
  useRoutings,
  useSetCostVersionRouting,
  useApplyOverheadToCostVersion,
  useOverheadPools,
} from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { ArrowLeft, Boxes, RefreshCw, Plus, GitBranch, Layers, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ControllingProductCostsPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: productsData } = useProducts({ page: 1, size: 300 })
  const products = productsData?.items ?? []

  const { data: versions = [], isLoading, refetch } = useProductCosts(
    activeCo ? { company_id: activeCo } : undefined,
  )
  const { data: rawRoutings = [] } = useRoutings({ company_id: activeCo || undefined, status: 'active' })
  const routings = rawRoutings as { id: string; code: string; name: string; version: string; product_id?: string }[]
  const { data: rawPools = [] } = useOverheadPools(activeCo || undefined)
  const pools = rawPools as { id: string; code: string; name: string; overhead_type?: string }[]

  const createCost = useCreateProductCost()
  const rollUp = useRollUpBomProductCost()
  const updateVer = useUpdateProductCost()
  const setRouting = useSetCostVersionRouting()
  const applyOverhead = useApplyOverheadToCostVersion()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({
    product_id: '',
    version_code: `STD-${new Date().toISOString().slice(0, 10)}`,
    valid_from: new Date().toISOString().slice(0, 10),
    status: 'draft',
  })

  const onCreate = async () => {
    if (!activeCo || !form.product_id) {
      toast.error('Select company and product')
      return
    }
    try {
      await createCost.mutateAsync({
        company_id: activeCo,
        product_id: form.product_id,
        version_code: form.version_code,
        valid_from: form.valid_from,
        status: form.status,
        lines: [],
      })
      toast.success('Cost version created')
      setShowNew(false)
      refetch()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Failed to create')
    }
  }

  const onRollUp = async (id: string) => {
    try {
      await rollUp.mutateAsync(id)
      toast.success('BOM rolled up into material lines')
      refetch()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Roll-up failed')
    }
  }

  const setActive = async (id: string) => {
    try {
      await updateVer.mutateAsync({ id, data: { status: 'active' } })
      toast.success('Marked active (set others per product as needed)')
      refetch()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Update failed')
    }
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/controlling" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> CO Dashboard
        </Link>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Boxes className="w-7 h-7 text-primary" /> Product Cost Planning
          </h1>
          <p className="text-sm text-gray-500 mt-1">Standard Costs, BOM Explosion, Material / Activity / Overhead Breakdown.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          {companies.length > 0 && (
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Company
              <select
                value={activeCo}
                onChange={e => setCompanyId(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white min-w-[180px]"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.code}</option>
                ))}
              </select>
            </label>
          )}
          <Button type="button" onClick={() => setShowNew(true)} className="gap-1">
            <Plus className="w-4 h-4" /> New version
          </Button>
        </div>
      </div>

      {showNew && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">New cost version</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Product
              <select
                value={form.product_id}
                onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
              >
                <option value="">Select…</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Version code
              <input
                value={form.version_code}
                onChange={e => setForm(f => ({ ...f, version_code: e.target.value }))}
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Valid from
              <input
                type="date"
                value={form.valid_from}
                onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Status
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={onCreate} disabled={createCost.isPending}>Create</Button>
            <Button type="button" variant="cancel" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-gray-500">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium" />
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Material</th>
                <th className="px-4 py-3 font-medium text-right">Activity</th>
                <th className="px-4 py-3 font-medium text-right">Direct OH</th>
                <th className="px-4 py-3 font-medium text-right">Indirect OH</th>
                <th className="px-4 py-3 font-medium text-right">Unit cost</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {versions.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">No cost versions yet.</td></tr>
              ) : (
                (versions as Array<{
                  id: string; version_code: string; product_id: string; status: string
                  rolled_up_unit_cost: string | number; valid_from: string
                  material_total_planned?: string | number
                  activity_total_planned?: string | number
                  direct_overhead_total_planned?: string | number
                  indirect_overhead_total_planned?: string | number
                  routing_id?: string
                  lines?: Array<{ id: string; category: string; description?: string; qty_planned: string; rate_planned: string; amount_planned: string }>
                }>).map(v => {
                  const pname = products.find(p => p.id === v.product_id)?.name ?? v.product_id.slice(0, 8)
                  const isExpanded = expandedId === v.id
                  const linkedRouting = routings.find(r => r.id === v.routing_id)
                  const indirectPools = pools.filter(p => p.overhead_type !== 'direct')
                  return (
                    <>
                      <tr key={v.id} className={`border-t border-gray-100 cursor-pointer ${isExpanded ? 'bg-accent/60' : 'hover:bg-gray-50'}`}
                        onClick={() => setExpandedId(isExpanded ? null : v.id)}>
                        <td className="px-3 py-3 text-gray-400">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-primary/80" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{v.version_code}</td>
                        <td className="px-4 py-3 text-gray-700">{pname}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            v.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                          }`}>{v.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">{formatCurrency(Number(v.material_total_planned ?? 0))}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-primary">{formatCurrency(Number(v.activity_total_planned ?? 0))}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-blue-600">{formatCurrency(Number(v.direct_overhead_total_planned ?? 0))}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-600">{formatCurrency(Number(v.indirect_overhead_total_planned ?? 0))}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                          {formatCurrency(Number(v.rolled_up_unit_cost))}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2" onClick={e => e.stopPropagation()}>
                          {v.status !== 'active' && (
                            <Button type="button" size="sm" variant="outline" onClick={() => setActive(v.id)}>Set active</Button>
                          )}
                          <Button type="button" size="sm" variant="secondary" className="gap-1"
                            disabled={rollUp.isPending} onClick={() => onRollUp(v.id)}>
                            <RefreshCw className="w-3 h-3" /> BOM roll-up
                          </Button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${v.id}-detail`} className="bg-gray-50/60">
                          <td colSpan={10} className="px-6 py-4 space-y-5">

                            {/* ── Routing & Overhead selectors ─────────────────── */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                              {/* Routing selector */}
                              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                  <GitBranch className="w-4 h-4 text-primary/80" />
                                  <h3 className="text-sm font-semibold text-gray-800">Routing selection</h3>
                                </div>
                                <p className="text-xs text-gray-400">
                                  Select an active routing to auto-generate labor, machine and direct overhead lines.
                                </p>
                                <select
                                  defaultValue={v.routing_id ?? ''}
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                                  onChange={async e => {
                                    try {
                                      await setRouting.mutateAsync({ versionId: v.id, routing_id: e.target.value || null })
                                      toast.success('Routing linked — activity cost lines updated')
                                      refetch()
                                    } catch { toast.error('Failed to link routing') }
                                  }}
                                >
                                  <option value="">— no routing —</option>
                                  {routings.map(r => (
                                    <option key={r.id} value={r.id}>{r.code} v{r.version} — {r.name}</option>
                                  ))}
                                </select>
                                {linkedRouting && (
                                  <p className="text-xs text-emerald-600 font-medium">
                                    ✓ Linked: {linkedRouting.code} v{linkedRouting.version}
                                  </p>
                                )}
                              </div>

                              {/* Indirect overhead application */}
                              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-amber-500" />
                                  <h3 className="text-sm font-semibold text-gray-800">Apply indirect overhead</h3>
                                </div>
                                <p className="text-xs text-gray-400">
                                  Apply active indirect overhead pools using their absorption formula.
                                </p>
                                {indirectPools.length === 0 ? (
                                  <p className="text-xs text-gray-400">No indirect overhead pools configured.</p>
                                ) : (
                                  <div className="space-y-1 text-xs text-gray-600 max-h-24 overflow-auto">
                                    {indirectPools.map(p => (
                                      <div key={p.id} className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                                        <span className="font-mono text-amber-700">{p.code}</span>
                                        <span className="text-gray-500">{p.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <Button type="button" size="sm" className="gap-1 w-full" variant="outline"
                                  disabled={applyOverhead.isPending || indirectPools.length === 0}
                                  onClick={async () => {
                                    try {
                                      const res = await applyOverhead.mutateAsync({ versionId: v.id, company_id: activeCo })
                                      toast.success(`Overhead applied — indirect OH: ${formatCurrency(Number(res.indirect_overhead))}`)
                                      refetch()
                                    } catch { toast.error('Failed to apply overhead') }
                                  }}>
                                  <RefreshCw className="w-3 h-3" /> Recalculate &amp; apply
                                </Button>
                              </div>
                            </div>

                            {/* ── Costing sheet ─────────────────────────────────── */}
                            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-800">Standard costing sheet</h3>
                              </div>
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50 text-gray-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium">Category</th>
                                    <th className="px-3 py-2 text-left font-medium">Description</th>
                                    <th className="px-3 py-2 text-right font-medium">Qty plan</th>
                                    <th className="px-3 py-2 text-right font-medium">Rate plan</th>
                                    <th className="px-3 py-2 text-right font-medium">Amount plan</th>
                                    <th className="px-3 py-2 text-right font-medium">% of total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {(v.lines ?? []).length === 0 && (
                                    <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                                      No lines yet — roll-up BOM and/or link a routing.
                                    </td></tr>
                                  )}
                                  {(['material', 'activity', 'direct_overhead', 'indirect_overhead', 'scrap', 'other'] as const).map(cat => {
                                    const catLines = (v.lines ?? []).filter(ln => ln.category === cat)
                                    if (catLines.length === 0) return null
                                    const catTotal = catLines.reduce((s, ln) => s + Number(ln.amount_planned), 0)
                                    const total = Number(v.rolled_up_unit_cost) || 1
                                    const catBadge: Record<string, string> = {
                                      material: 'bg-blue-100 text-blue-700',
                                      activity: 'bg-primary/10 text-primary',
                                      direct_overhead: 'bg-sky-100 text-sky-700',
                                      indirect_overhead: 'bg-amber-100 text-amber-700',
                                      scrap: 'bg-red-100 text-red-500',
                                      other: 'bg-gray-100 text-gray-500',
                                    }
                                    return (
                                      <>
                                        {catLines.map((ln, i) => (
                                          <tr key={ln.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-1.5">
                                              {i === 0 && (
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full uppercase ${catBadge[cat]}`}>
                                                  {cat.replace(/_/g, ' ')}
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-1.5 text-gray-700">{ln.description ?? '—'}</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{Number(ln.qty_planned).toFixed(4)}</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{formatCurrency(Number(ln.rate_planned))}</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums font-medium text-gray-800">{formatCurrency(Number(ln.amount_planned))}</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums text-gray-400">
                                              {((Number(ln.amount_planned) / total) * 100).toFixed(1)}%
                                            </td>
                                          </tr>
                                        ))}
                                        <tr className={`border-t border-dashed border-gray-200 ${catBadge[cat].split(' ')[0]}/10`}>
                                          <td colSpan={4} className={`px-3 py-1 text-right text-xs font-bold uppercase ${catBadge[cat].split(' ')[1]}`}>
                                            {cat.replace(/_/g, ' ')} subtotal
                                          </td>
                                          <td className="px-3 py-1 text-right tabular-nums font-bold text-gray-900">{formatCurrency(catTotal)}</td>
                                          <td className="px-3 py-1 text-right tabular-nums text-gray-500 text-xs">
                                            {((catTotal / total) * 100).toFixed(1)}%
                                          </td>
                                        </tr>
                                      </>
                                    )
                                  })}
                                </tbody>
                                {(v.lines ?? []).length > 0 && (
                                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                    <tr>
                                      <td colSpan={4} className="px-3 py-2 font-bold text-gray-800 text-xs uppercase">
                                        Total standard cost / unit
                                      </td>
                                      <td className="px-3 py-2 text-right font-bold text-gray-900 tabular-nums">
                                        {formatCurrency(Number(v.rolled_up_unit_cost))}
                                      </td>
                                      <td className="px-3 py-2 text-right text-gray-400 text-xs">100%</td>
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
