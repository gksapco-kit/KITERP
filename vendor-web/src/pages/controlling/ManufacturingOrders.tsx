import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompanies } from '@/hooks/useFinance'
import { useProducts } from '@/hooks/useVendor'
import {
  useManufacturingOrders,
  useCreateManufacturingOrder,
  useRefreshOrderPlanned,
  useOrderVariance,
} from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { ArrowLeft, Factory, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

const KINDS = [
  { id: 'assembly', label: 'Assembly' },
  { id: 'process', label: 'Process' },
  { id: 'project', label: 'Project' },
  { id: 'internal', label: 'Internal order' },
]

export default function ControllingManufacturingOrdersPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: productsData } = useProducts({ page: 1, size: 300 })
  const products = productsData?.items ?? []

  const { data: orders = [], isLoading, refetch } = useManufacturingOrders(
    activeCo ? { company_id: activeCo } : undefined,
  )

  const createMo = useCreateManufacturingOrder()
  const refreshPlanned = useRefreshOrderPlanned()

  const [showNew, setShowNew] = useState(false)
  const [varianceFor, setVarianceFor] = useState<string | undefined>()
  const { data: variance } = useOrderVariance(varianceFor)

  const [form, setForm] = useState({
    order_kind: 'assembly',
    product_id: '',
    qty_planned: '1',
    status: 'draft',
  })

  const onCreate = async () => {
    if (!activeCo) {
      toast.error('Select a company')
      return
    }
    try {
      await createMo.mutateAsync({
        company_id: activeCo,
        order_kind: form.order_kind,
        qty_planned: form.qty_planned,
        status: form.status,
        cost_lines: [],
        ...(form.product_id ? { product_id: form.product_id } : {}),
      })
      toast.success('Order created')
      setShowNew(false)
      refetch()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  const onRefreshPlanned = async (id: string) => {
    try {
      await refreshPlanned.mutateAsync(id)
      toast.success('Planned lines refreshed from active standard cost')
      refetch()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Refresh failed')
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
            <Factory className="w-7 h-7 text-primary" /> Manufacturing &amp; project orders
          </h1>
          <p className="text-sm text-gray-500 mt-1">Planned vs actual cost lines, variance, WIP on open statuses.</p>
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
            <Plus className="w-4 h-4" /> New order
          </Button>
        </div>
      </div>

      {showNew && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">New CO order</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Kind
              <select
                value={form.order_kind}
                onChange={e => setForm(f => ({ ...f, order_kind: e.target.value }))}
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
              >
                {KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Output product (optional for internal)
              <select
                value={form.product_id}
                onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
              >
                <option value="">—</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Qty planned
              <input
                value={form.qty_planned}
                onChange={e => setForm(f => ({ ...f, qty_planned: e.target.value }))}
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
                <option value="released">released</option>
                <option value="in_progress">in_progress</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={onCreate} disabled={createMo.isPending}>Create</Button>
            <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
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
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-right">Detail</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No orders yet.</td></tr>
              ) : (
                orders.map((o: {
                  id: string
                  order_no: string
                  order_kind: string
                  status: string
                  product_id?: string | null
                  qty_planned: string | number
                }) => {
                  const pname = o.product_id
                    ? products.find(p => p.id === o.product_id)?.name ?? o.product_id.slice(0, 8)
                    : '—'
                  return (
                    <tr key={o.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-mono text-gray-900">{o.order_no}</td>
                      <td className="px-4 py-3 text-gray-700">{o.order_kind}</td>
                      <td className="px-4 py-3 text-gray-700">{o.status}</td>
                      <td className="px-4 py-3 text-gray-700">{pname}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{o.qty_planned}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/controlling/orders/${o.id}`}
                          className="text-sm text-primary hover:underline font-medium"
                        >
                          Open
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setVarianceFor(o.id)}>
                          Variance
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="gap-1"
                          disabled={!o.product_id || refreshPlanned.isPending}
                          onClick={() => onRefreshPlanned(o.id)}
                        >
                          <RefreshCw className="w-3 h-3" /> Std plan
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {variance && (
        <div className="rounded-xl border border-primary/30 bg-accent/70 p-4 space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Variance — {variance.order_no}</h3>
            <Button type="button" size="sm" variant="ghost" onClick={() => setVarianceFor(undefined)}>Close</Button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Planned</p>
              <p className="font-semibold tabular-nums">{formatCurrency(Number(variance.planned_total))}</p>
            </div>
            <div>
              <p className="text-gray-500">Actual</p>
              <p className="font-semibold tabular-nums">{formatCurrency(Number(variance.actual_total))}</p>
            </div>
            <div>
              <p className="text-gray-500">Variance (A − P)</p>
              <p className={`font-semibold tabular-nums ${Number(variance.variance) >= 0 ? 'text-amber-700' : 'text-green-700'}`}>
                {formatCurrency(Number(variance.variance))}
              </p>
            </div>
          </div>
          {variance.by_category && (
            <div className="text-xs text-gray-600 mt-2">
              <p className="font-medium text-gray-700 mb-1">By category</p>
              <ul className="space-y-1">
                {Object.entries(variance.by_category as Record<string, { planned?: string; actual?: string }>).map(
                  ([cat, vals]) => (
                    <li key={cat} className="flex justify-between gap-4">
                      <span>{cat}</span>
                      <span className="tabular-nums">
                        P {formatCurrency(Number(vals.planned ?? 0))} / A {formatCurrency(Number(vals.actual ?? 0))}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
