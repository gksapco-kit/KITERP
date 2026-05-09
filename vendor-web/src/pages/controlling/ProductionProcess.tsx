/**
 * ProductionProcess — production order lifecycle view.
 * Shows all orders grouped by lifecycle stage (Draft → Released → In Progress
 * → Completed → Closed) with quick-action status transitions and settlement status.
 */
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, ChevronRight, AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react'
import { useCompanies } from '@/hooks/useFinance'
import {
  useManufacturingOrders,
  useTransitionOrderStatus,
} from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

const LIFECYCLE = [
  {
    status: 'draft',
    label: 'Draft',
    color: 'gray',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-600',
    next: 'released',
    nextLabel: 'Release',
    icon: Clock,
  },
  {
    status: 'released',
    label: 'Released',
    color: 'blue',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    next: 'in_progress',
    nextLabel: 'Start',
    icon: Zap,
  },
  {
    status: 'in_progress',
    label: 'In Progress',
    color: 'amber',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    next: 'completed',
    nextLabel: 'Complete',
    icon: AlertTriangle,
  },
  {
    status: 'completed',
    label: 'Completed',
    color: 'emerald',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    next: 'closed',
    nextLabel: 'Close',
    icon: CheckCircle,
  },
  {
    status: 'closed',
    label: 'Closed',
    color: 'indigo',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    badge: 'bg-indigo-100 text-indigo-700',
    next: null,
    nextLabel: null,
    icon: CheckCircle,
  },
]

const settlementColors: Record<string, string> = {
  none: 'bg-gray-100 text-gray-500',
  production_posted: 'bg-blue-100 text-blue-700',
  cogs_partial: 'bg-amber-100 text-amber-700',
  cogs_closed: 'bg-emerald-100 text-emerald-700',
}

interface OrderRow {
  id: string
  order_no: string
  title: string | null
  order_kind: string
  status: string
  priority: string
  qty_planned: string
  qty_delivered: string
  scheduled_start: string | null
  scheduled_end: string | null
  settlement_status: string
  cost_lines: Array<{ amount_planned: string; amount_actual: string }>
}

function orderTotalCost(o: OrderRow) {
  let p = 0, a = 0
  for (const ln of o.cost_lines ?? []) {
    p += parseFloat(ln.amount_planned)
    a += parseFloat(ln.amount_actual)
  }
  return { planned: p, actual: a }
}

export default function ProductionProcessPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const [kindFilter, setKindFilter] = useState('')

  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: ordersRaw = [], isLoading } = useManufacturingOrders({
    company_id: activeCo || undefined,
    order_kind: kindFilter || undefined,
  })

  const orders = ordersRaw as OrderRow[]
  const transitionMut = useTransitionOrderStatus()

  const grouped = useMemo(() => {
    const m: Record<string, OrderRow[]> = {}
    for (const s of LIFECYCLE) m[s.status] = []
    for (const o of orders) {
      if (!m[o.status]) m[o.status] = []
      m[o.status].push(o)
    }
    return m
  }, [orders])

  const handleTransition = async (orderId: string, status: string) => {
    try {
      await transitionMut.mutateAsync({ orderId, status })
      toast.success(`Order moved to ${status}`)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e?.response?.data?.detail ?? 'Transition failed')
    }
  }

  const totalOrders = orders.length
  const openOrders = orders.filter(o => ['draft', 'released', 'in_progress'].includes(o.status)).length
  const wipCost = orders
    .filter(o => ['draft', 'released', 'in_progress'].includes(o.status))
    .reduce((s, o) => s + orderTotalCost(o).actual, 0)

  return (
    <div className="p-6 max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Production Process</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kanban-style production lifecycle — from draft through release, confirmation, completion and COGS settlement.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Total orders</p>
          <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs text-amber-600 mb-1">Open (WIP)</p>
          <p className="text-2xl font-bold text-amber-700">{openOrders}</p>
        </div>
        <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
          <p className="text-xs text-violet-600 mb-1">WIP actual cost</p>
          <p className="text-2xl font-bold text-violet-700">{formatCurrency(wipCost)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {companies.length > 1 && (
          <select value={activeCo} onChange={e => setCompanyId(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
            {companies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        )}
        <select value={kindFilter} onChange={e => setKindFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          <option value="">All kinds</option>
          {['assembly', 'process', 'project', 'internal'].map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      {isLoading && <div className="text-gray-400 text-sm">Loading production orders…</div>}

      {/* Kanban board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {LIFECYCLE.map(stage => {
            const stageOrders = grouped[stage.status] ?? []
            const Icon = stage.icon
            return (
              <div key={stage.status} className="w-72 shrink-0">
                {/* Column header */}
                <div className={`rounded-t-xl border ${stage.border} ${stage.bg} px-4 py-3 flex items-center gap-2 mb-2`}>
                  <Icon className={`w-4 h-4 text-${stage.color}-600`} />
                  <span className="font-semibold text-gray-800 text-sm">{stage.label}</span>
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${stage.badge}`}>
                    {stageOrders.length}
                  </span>
                </div>

                {/* Order cards */}
                <div className="space-y-2">
                  {stageOrders.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
                      No orders in {stage.label}
                    </div>
                  )}
                  {stageOrders.map(o => {
                    const { planned, actual } = orderTotalCost(o)
                    const variance = actual - planned
                    const isLate = o.scheduled_end && new Date(o.scheduled_end) < new Date() && o.status !== 'completed' && o.status !== 'closed'
                    return (
                      <div key={o.id} className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-bold text-gray-900">{o.order_no}</p>
                            {o.title && (
                              <p className="text-[11px] text-gray-500 truncate mt-0.5">{o.title}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              o.priority === 'urgent' ? 'bg-red-500 text-white' :
                              o.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                              o.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>{o.priority}</span>
                            <span className="text-[9px] text-gray-400 uppercase">{o.order_kind}</span>
                          </div>
                        </div>

                        {/* Dates */}
                        {(o.scheduled_start || o.scheduled_end) && (
                          <div className={`flex items-center gap-1 text-[10px] ${isLate ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                            <Clock className="w-3 h-3 shrink-0" />
                            {o.scheduled_start} → {o.scheduled_end}
                            {isLate && <AlertTriangle className="w-3 h-3" />}
                          </div>
                        )}

                        {/* Qty */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded-md bg-gray-50 p-2">
                            <p className="text-gray-400">Qty planned</p>
                            <p className="font-semibold text-gray-700">{parseFloat(o.qty_planned).toLocaleString()}</p>
                          </div>
                          <div className="rounded-md bg-gray-50 p-2">
                            <p className="text-gray-400">Qty delivered</p>
                            <p className="font-semibold text-gray-700">{parseFloat(o.qty_delivered).toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Cost bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-gray-500">
                            <span>Planned: {formatCurrency(planned)}</span>
                            <span>Actual: {formatCurrency(actual)}</span>
                          </div>
                          {planned > 0 && (
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${actual > planned ? 'bg-red-400' : 'bg-emerald-400'}`}
                                style={{ width: `${Math.min(100, (actual / planned) * 100)}%` }}
                              />
                            </div>
                          )}
                          {actual !== 0 && (
                            <p className={`text-[10px] font-medium ${variance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                              Variance: {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                            </p>
                          )}
                        </div>

                        {/* Settlement status */}
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${settlementColors[o.settlement_status] ?? 'bg-gray-100 text-gray-400'}`}>
                            {o.settlement_status?.replace(/_/g, ' ') ?? 'none'}
                          </span>
                          <div className="flex items-center gap-2">
                            {stage.next && (
                              <button
                                onClick={() => handleTransition(o.id, stage.next!)}
                                disabled={transitionMut.isPending}
                                className="text-[10px] font-medium text-violet-600 hover:text-violet-800 flex items-center gap-0.5"
                              >
                                {stage.nextLabel} <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                            <Link
                              to={`/controlling/orders/${o.id}`}
                              className="text-gray-400 hover:text-violet-600"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cancelled orders footer */}
      {(grouped['cancelled'] ?? []).length > 0 && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700 mb-2">Cancelled Orders ({(grouped['cancelled'] ?? []).length})</p>
          <div className="flex flex-wrap gap-2">
            {(grouped['cancelled'] ?? []).map(o => (
              <Link key={o.id} to={`/controlling/orders/${o.id}`}
                className="text-xs font-mono text-red-600 hover:underline bg-white px-2 py-1 rounded border border-red-200">
                {o.order_no}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
