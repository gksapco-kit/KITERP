import { useMemo, useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
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
import { formatCurrency, cn } from '@/lib/utils'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import { toast } from 'sonner'
import { ArrowLeft, Boxes, RefreshCw, Plus, GitBranch, Layers, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const fieldClass =
  'rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]'
const labelClass = 'flex flex-col gap-1 text-xs text-muted-foreground'
const selectClass = cn(fieldClass, 'min-w-[180px]')
const cardClass = 'rounded-xl border border-border bg-card p-4 space-y-3'

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
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Boxes className="w-7 h-7 text-primary" /> Product Cost Planning
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Standard Costs, BOM Explosion, Material / Activity / Overhead Breakdown.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {companies.length > 0 && (
            <label className={labelClass}>
              Company
              <select
                value={activeCo}
                onChange={e => setCompanyId(e.target.value)}
                className={selectClass}
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
        <div className={cardClass}>
          <h3 className="font-semibold text-foreground">New cost version</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <label className={labelClass}>
              Product
              <select
                value={form.product_id}
                onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                className={fieldClass}
              >
                <option value="">Select…</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Version code
              <input
                value={form.version_code}
                onChange={e => setForm(f => ({ ...f, version_code: e.target.value }))}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Valid from
              <input
                type="date"
                value={form.valid_from}
                onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Status
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className={fieldClass}
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={onCreate} disabled={createCost.isPending}>Create</Button>
            <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="p-8 text-muted-foreground">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium" />
                <th className="px-4 py-3 font-medium"><TableColumnLabel>Version</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium"><TableColumnLabel>Product</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-right"><TableColumnLabel>Material</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-right"><TableColumnLabel>Activity</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-right"><TableColumnLabel>Direct OH</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-right"><TableColumnLabel>Indirect OH</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-right"><TableColumnLabel>Unit cost</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-right"><TableColumnLabel>Actions</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody>
              {versions.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No cost versions yet.</td></tr>
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
                      <tr key={v.id} className={cn(
                        'cursor-pointer border-t border-border',
                        isExpanded ? 'bg-primary/10' : 'hover:bg-muted/30',
                      )}
                        onClick={onClickableTableRow(() => setExpandedId(isExpanded ? null : v.id))}>
                        <td className="px-3 py-3 text-muted-foreground">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">{v.version_code}</td>
                        <td className="px-4 py-3 text-foreground">{pname}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            v.status === 'active'
                              ? 'bg-green-500/15 text-green-700 dark:text-green-300'
                              : 'bg-muted text-muted-foreground',
                          )}>{v.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(Number(v.material_total_planned ?? 0))}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-primary">{formatCurrency(Number(v.activity_total_planned ?? 0))}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-blue-600 dark:text-blue-400">{formatCurrency(Number(v.direct_overhead_total_planned ?? 0))}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(Number(v.indirect_overhead_total_planned ?? 0))}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                          {formatCurrency(Number(v.rolled_up_unit_cost))}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
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
                        <tr key={`${v.id}-detail`} className="bg-muted/20">
                          <td colSpan={10} className="space-y-5 px-6 py-4">

                            {/* ── Routing & Overhead selectors ─────────────────── */}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                              {/* Routing selector */}
                              <div className={cardClass}>
                                <div className="flex items-center gap-2">
                                  <GitBranch className="h-4 w-4 text-primary" />
                                  <h3 className="text-sm font-semibold text-foreground">Routing selection</h3>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Select an active routing to auto-generate labor, machine and direct overhead lines.
                                </p>
                                <select
                                  defaultValue={v.routing_id ?? ''}
                                  className={cn(fieldClass, 'w-full px-3')}
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
                                  <p className="text-xs font-medium text-green-600 dark:text-green-400">
                                    ✓ Linked: {linkedRouting.code} v{linkedRouting.version}
                                  </p>
                                )}
                              </div>

                              {/* Indirect overhead application */}
                              <div className={cardClass}>
                                <div className="flex items-center gap-2">
                                  <Layers className="h-4 w-4 text-amber-500" />
                                  <h3 className="text-sm font-semibold text-foreground">Apply indirect overhead</h3>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Apply active indirect overhead pools using their absorption formula.
                                </p>
                                {indirectPools.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">No indirect overhead pools configured.</p>
                                ) : (
                                  <div className="max-h-24 space-y-1 overflow-auto text-xs text-muted-foreground">
                                    {indirectPools.map(p => (
                                      <div key={p.id} className="flex items-center gap-2">
                                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                                        <span className="font-mono text-amber-600 dark:text-amber-400">{p.code}</span>
                                        <span>{p.name}</span>
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
                            <div className="overflow-hidden rounded-xl border border-border bg-card">
                              <div className="border-b border-border bg-muted/30 px-4 py-3">
                                <h3 className="text-sm font-semibold text-foreground">Standard costing sheet</h3>
                              </div>
                              <table className="w-full text-xs">
                                <thead className="bg-muted/30 text-muted-foreground">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium"><TableColumnLabel>Category</TableColumnLabel></th>
                                    <th className="px-3 py-2 text-left font-medium"><TableColumnLabel>Description</TableColumnLabel></th>
                                    <th className="px-3 py-2 text-right font-medium"><TableColumnLabel>Qty plan</TableColumnLabel></th>
                                    <th className="px-3 py-2 text-right font-medium"><TableColumnLabel>Rate plan</TableColumnLabel></th>
                                    <th className="px-3 py-2 text-right font-medium"><TableColumnLabel>Amount plan</TableColumnLabel></th>
                                    <th className="px-3 py-2 text-right font-medium"><TableColumnLabel>% of total</TableColumnLabel></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {(v.lines ?? []).length === 0 && (
                                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                                      No lines yet — roll-up BOM and/or link a routing.
                                    </td></tr>
                                  )}
                                  {(['material', 'activity', 'direct_overhead', 'indirect_overhead', 'scrap', 'other'] as const).map(cat => {
                                    const catLines = (v.lines ?? []).filter(ln => ln.category === cat)
                                    if (catLines.length === 0) return null
                                    const catTotal = catLines.reduce((s, ln) => s + Number(ln.amount_planned), 0)
                                    const total = Number(v.rolled_up_unit_cost) || 1
                                    const catBadge: Record<string, string> = {
                                      material: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
                                      activity: 'bg-primary/15 text-primary',
                                      direct_overhead: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
                                      indirect_overhead: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
                                      scrap: 'bg-red-500/15 text-red-600 dark:text-red-300',
                                      other: 'bg-muted text-muted-foreground',
                                    }
                                    return (
                                      <>
                                        {catLines.map((ln, i) => (
                                          <tr key={ln.id} className="hover:bg-muted/25">
                                            <td className="px-3 py-1.5">
                                              {i === 0 && (
                                                <span className={cn('rounded-full px-1.5 py-0.5 text-xs font-bold uppercase', catBadge[cat])}>
                                                  {cat.replace(/_/g, ' ')}
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-1.5 text-foreground">{ln.description ?? '—'}</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{Number(ln.qty_planned).toFixed(4)}</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{formatCurrency(Number(ln.rate_planned))}</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums font-medium text-foreground">{formatCurrency(Number(ln.amount_planned))}</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                                              {((Number(ln.amount_planned) / total) * 100).toFixed(1)}%
                                            </td>
                                          </tr>
                                        ))}
                                        <tr className="border-t border-dashed border-border">
                                          <td colSpan={4} className={cn('px-3 py-1 text-right text-xs font-bold uppercase', catBadge[cat].split(' ').slice(1).join(' '))}>
                                            {cat.replace(/_/g, ' ')} subtotal
                                          </td>
                                          <td className="px-3 py-1 text-right tabular-nums font-bold text-foreground">{formatCurrency(catTotal)}</td>
                                          <td className="px-3 py-1 text-right tabular-nums text-xs text-muted-foreground">
                                            {((catTotal / total) * 100).toFixed(1)}%
                                          </td>
                                        </tr>
                                      </>
                                    )
                                  })}
                                </tbody>
                                {(v.lines ?? []).length > 0 && (
                                  <tfoot className="border-t-2 border-border bg-muted/30">
                                    <tr>
                                      <td colSpan={4} className="px-3 py-2 text-xs font-bold uppercase text-foreground">
                                        Total standard cost / unit
                                      </td>
                                      <td className="px-3 py-2 text-right font-bold tabular-nums text-foreground">
                                        {formatCurrency(Number(v.rolled_up_unit_cost))}
                                      </td>
                                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">100%</td>
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
