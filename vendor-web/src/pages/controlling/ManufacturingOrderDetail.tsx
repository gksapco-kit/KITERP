import { useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Label } from '@/components/ui/label'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Link, useParams } from 'react-router-dom'
import {
  useManufacturingOrder,
  useOrderVarianceDetailed,
  useRefreshOrderPlanned,
  useGenerateOperationsFromStandard,
  useSyncActivityActualsFromOperations,
  useRecalculateOverheadActual,
  usePatchOrderCostLine,
  useUpdateOrderOperation,
  usePostProductionCompletion,
  usePostCogsIssue,
  useTransitionOrderStatus,
  useBudgetVsActual,
  useBudgetLines,
  useCreateBudgetLine,
  useDeleteBudgetLine,
  useGoodsMovements,
  useActivityConfirmations,
} from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { ArrowLeft, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Tab = 'summary' | 'routing' | 'costs' | 'variance' | 'budget' | 'movements' | 'confirmations'

export default function ManufacturingOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: order, isLoading, refetch } = useManufacturingOrder(id)
  const { data: varDetail, refetch: refetchVar } = useOrderVarianceDetailed(id)

  const refreshStd = useRefreshOrderPlanned()
  const genOps = useGenerateOperationsFromStandard()
  const syncAct = useSyncActivityActualsFromOperations()
  const recalcOh = useRecalculateOverheadActual()
  const patchLine = usePatchOrderCostLine()
  const patchOp = useUpdateOrderOperation()
  const postPc = usePostProductionCompletion()
  const postCogs = usePostCogsIssue()

  const [tab, setTab] = useState<Tab>('summary')
  const [showTransition, setShowTransition] = useState(false)
  const [transitionStatus, setTransitionStatus] = useState('')
  const [transitionNotes, setTransitionNotes] = useState('')

  useEscapeToClose(() => setShowTransition(false), showTransition)

  const transitionMut = useTransitionOrderStatus()
  const { data: bva } = useBudgetVsActual(id)
  const { data: budgetLines = [] } = useBudgetLines(id)
  const createBl = useCreateBudgetLine()
  const deleteBl = useDeleteBudgetLine()
  const { data: goodsMovements = [] } = useGoodsMovements({ order_id: id })
  const { data: actConfirmations = [] } = useActivityConfirmations({ order_id: id })

  const [blForm, setBlForm] = useState({ category: 'material', amount_budgeted: '', description: '', budget_type: 'original' })
  const [showBlForm, setShowBlForm] = useState(false)

  const handleTransition = async () => {
    if (!id || !transitionStatus) return
    try {
      await transitionMut.mutateAsync({ orderId: id, status: transitionStatus, notes: transitionNotes || undefined })
      setShowTransition(false)
      setTransitionStatus('')
      setTransitionNotes('')
      toast.success('Order status updated')
      refetch()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e?.response?.data?.detail ?? 'Transition failed')
    }
  }

  const handleAddBl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      await createBl.mutateAsync({
        orderId: id,
        data: {
          company_id: order.company_id,
          order_id: id,
          category: blForm.category,
          amount_budgeted: parseFloat(blForm.amount_budgeted || '0'),
          description: blForm.description,
          budget_type: blForm.budget_type,
        },
      })
      setShowBlForm(false)
      setBlForm({ category: 'material', amount_budgeted: '', description: '', budget_type: 'original' })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e?.response?.data?.detail ?? 'Failed to add budget line')
    }
  }

  const fmt = (n: string | number) => formatCurrency(typeof n === 'string' ? parseFloat(n) : n)

  if (!id) {
    return <div className="p-6 text-gray-500">Missing order id</div>
  }
  if (isLoading || !order) {
    return <div className="p-6 text-gray-500">Loading order…</div>
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'routing', label: 'Routing & activity' },
    { id: 'costs', label: 'Cost lines' },
    { id: 'variance', label: 'Variance' },
    { id: 'budget', label: 'Budget' },
    { id: 'movements', label: `Goods movements (${(goodsMovements as unknown[]).length})` },
    { id: 'confirmations', label: `Activity confirmations (${(actConfirmations as unknown[]).length})` },
  ]

  return (
    <div className="p-6 max-w-6xl space-y-4">
      <div className="flex items-center gap-4">
        <Link to="/controlling/orders" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> All orders
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{order.order_no}</h1>
          {order.title && <p className="text-gray-700 mt-1">{order.title}</p>}
          <p className="text-sm text-gray-500 mt-1">
            {order.order_kind} · {order.status}
            {order.priority ? ` · ${order.priority}` : ''}
            {order.project_id ? ` · project ${String(order.project_id).slice(0, 8)}…` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setShowTransition(true)}
          >
            Transition Status
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1"
            disabled={refreshStd.isPending}
            onClick={async () => {
              try {
                await refreshStd.mutateAsync(id)
                toast.success('Planned costs refreshed from standard')
                refetch()
                refetchVar()
              } catch (e: unknown) {
                const err = e as { response?: { data?: { detail?: string } } }
                toast.error(err.response?.data?.detail || 'Failed')
              }
            }}
          >
            <RefreshCw className="w-3 h-3" /> Std planned
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={genOps.isPending}
            onClick={async () => {
              try {
                await genOps.mutateAsync(id)
                toast.success('Operations generated from standard')
                refetch()
              } catch (e: unknown) {
                const err = e as { response?: { data?: { detail?: string } } }
                toast.error(err.response?.data?.detail || 'Failed')
              }
            }}
          >
            Gen routing
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={syncAct.isPending}
            onClick={async () => {
              try {
                await syncAct.mutateAsync(id)
                toast.success('Activity actuals synced from operations')
                refetch()
                refetchVar()
              } catch (e: unknown) {
                const err = e as { response?: { data?: { detail?: string } } }
                toast.error(err.response?.data?.detail || 'Failed')
              }
            }}
          >
            Sync activity
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={recalcOh.isPending}
            onClick={async () => {
              try {
                await recalcOh.mutateAsync({ orderId: id })
                toast.success('Overhead actuals recalculated')
                refetch()
                refetchVar()
              } catch (e: unknown) {
                const err = e as { response?: { data?: { detail?: string } } }
                toast.error(err.response?.data?.detail || 'Failed')
              }
            }}
          >
            Recalc OH
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="sm:col-span-2 rounded-lg border border-primary/20 bg-accent/70 p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">GL settlement</h3>
            <p className="text-xs text-gray-600">
              Configure accounts under Controlling → Setup. Posting uses sum of actual cost lines (production) and
              delivered qty × unit actual cost (COGS).
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-gray-700">
              <span>
                Status: <strong>{'settlement_status' in order ? String(order.settlement_status) : 'none'}</strong>
              </span>
              {'production_completion_journal_id' in order && order.production_completion_journal_id ? (
                <span className="text-emerald-700">Production JE posted</span>
              ) : (
                <span className="text-amber-700">Production JE not posted</span>
              )}
              {'cogs_issue_journal_id' in order && order.cogs_issue_journal_id ? (
                <span className="text-emerald-700">COGS JE (latest) posted</span>
              ) : (
                <span className="text-gray-500">No COGS JE yet</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={postPc.isPending}
                onClick={async () => {
                  try {
                    await postPc.mutateAsync({ orderId: id })
                    toast.success('Production completion posted')
                    refetch()
                  } catch (e: unknown) {
                    const err = e as { response?: { data?: { detail?: string } } }
                    toast.error(err.response?.data?.detail || 'Failed')
                  }
                }}
              >
                Post production completion
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={postCogs.isPending}
                onClick={async () => {
                  try {
                    await postCogs.mutateAsync({ orderId: id })
                    toast.success('COGS issue posted')
                    refetch()
                  } catch (e: unknown) {
                    const err = e as { response?: { data?: { detail?: string } } }
                    toast.error(err.response?.data?.detail || 'Failed')
                  }
                }}
              >
                Post COGS issue
              </Button>
            </div>
            {'cost_bookings' in order &&
              Array.isArray(order.cost_bookings) &&
              order.cost_bookings.length > 0 && (
                <div className="border-t border-primary/20 pt-2">
                  <p className="text-xs font-medium text-gray-600 mb-1">Cost bookings</p>
                  <ul className="text-xs space-y-1 font-mono text-gray-700">
                    {(order.cost_bookings as { id: string; booking_type: string; amount: string; journal_entry_id?: string | null }[]).map(
                      cb => (
                        <li key={cb.id} className="flex flex-wrap justify-between gap-2">
                          <span>{cb.booking_type}</span>
                          <span className="tabular-nums">{cb.amount}</span>
                          <span className="text-gray-500">{cb.journal_entry_id ? 'JE ✓' : '—'}</span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}
          </div>
          <div>
            <p className="text-gray-500">Qty planned / delivered</p>
            <p className="font-semibold">{order.qty_planned} / {order.qty_delivered}</p>
          </div>
          <div>
            <p className="text-gray-500">Product</p>
            <p className="font-semibold">{order.product_id ? String(order.product_id).slice(0, 8) + '…' : '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Schedule</p>
            <p className="font-semibold">{order.scheduled_start ?? '—'} → {order.scheduled_end ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Reference</p>
            <p className="font-semibold">
              {order.ref_doc_type || '—'} {order.ref_doc_id ? String(order.ref_doc_id).slice(0, 8) + '…' : ''}
            </p>
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <p className="text-gray-500">Notes</p>
              <p className="text-gray-800 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'routing' && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2"><TableColumnLabel>#</TableColumnLabel></th>
                <th className="px-3 py-2"><TableColumnLabel>Name</TableColumnLabel></th>
                <th className="px-3 py-2 text-right"><TableColumnLabel>Pln hrs</TableColumnLabel></th>
                <th className="px-3 py-2 text-right"><TableColumnLabel>Act hrs</TableColumnLabel></th>
                <th className="px-3 py-2 text-right"><TableColumnLabel>Rate</TableColumnLabel></th>
                <th className="px-3 py-2"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(order.operations ?? []).length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">No operations — use Gen routing or add manually via API.</td></tr>
              ) : (
                (order.operations ?? []).map((op: {
                  id: string
                  sequence: number
                  name: string
                  planned_hours: string | number
                  actual_hours: string | number
                  planned_rate: string | number
                  actual_rate: string | number
                  status: string
                }) => (
                  <tr key={op.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{op.sequence}</td>
                    <td className="px-3 py-2 font-medium">{op.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{op.planned_hours}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        defaultValue={op.actual_hours}
                        className="w-20 rounded border border-gray-200 px-1 py-0.5 text-right text-sm"
                        onBlur={e => {
                          const v = e.target.value
                          if (v === String(op.actual_hours)) return
                          patchOp.mutate(
                            { orderId: id, opId: op.id, data: { actual_hours: v } },
                            {
                              onSuccess: () => {
                                toast.success('Saved')
                                refetch()
                              },
                              onError: () => toast.error('Save failed'),
                            },
                          )
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{op.planned_rate}</td>
                    <td className="px-3 py-2 text-xs">{op.status}</td>
                    <td className="px-3 py-2" />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'costs' && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2"><TableColumnLabel>Cat</TableColumnLabel></th>
                <th className="px-3 py-2"><TableColumnLabel>Description</TableColumnLabel></th>
                <th className="px-3 py-2 text-right"><TableColumnLabel>Qty P</TableColumnLabel></th>
                <th className="px-3 py-2 text-right"><TableColumnLabel>Qty A</TableColumnLabel></th>
                <th className="px-3 py-2 text-right"><TableColumnLabel>Amt P</TableColumnLabel></th>
                <th className="px-3 py-2 text-right"><TableColumnLabel>Amt A</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody>
              {(order.cost_lines ?? []).map((ln: {
                id: string
                category: string
                description?: string
                qty_planned: string | number
                qty_actual: string | number
                amount_planned: string | number
                amount_actual: string | number
              }) => (
                <tr key={ln.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-xs font-medium">{ln.category}</td>
                  <td className="px-3 py-2">{ln.description ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{ln.qty_planned}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      defaultValue={ln.qty_actual}
                      className="w-24 rounded border border-gray-200 px-1 py-0.5 text-right text-sm"
                      onBlur={e => {
                        const v = e.target.value
                        if (v === String(ln.qty_actual)) return
                        patchLine.mutate(
                          { orderId: id, lineId: ln.id, data: { qty_actual: v } },
                          {
                            onSuccess: () => {
                              toast.success('Updated')
                              refetch()
                              refetchVar()
                            },
                            onError: () => toast.error('Failed'),
                          },
                        )
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(ln.amount_planned)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(ln.amount_actual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'variance' && varDetail && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-gray-500">Planned</p>
              <p className="font-bold">{fmt(varDetail.planned_total)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-gray-500">Actual</p>
              <p className="font-bold">{fmt(varDetail.actual_total)}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-amber-800">Price variance</p>
              <p className="font-bold text-amber-900">{fmt(varDetail.price_variance_total)}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-blue-800">Usage variance</p>
              <p className="font-bold text-blue-900">{fmt(varDetail.usage_variance_total)}</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-2 py-2"><TableColumnLabel>Cat</TableColumnLabel></th>
                  <th className="px-2 py-2"><TableColumnLabel>Description</TableColumnLabel></th>
                  <th className="px-2 py-2 text-right"><TableColumnLabel>Price var</TableColumnLabel></th>
                  <th className="px-2 py-2 text-right"><TableColumnLabel>Usage var</TableColumnLabel></th>
                  <th className="px-2 py-2 text-right"><TableColumnLabel>Total</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody>
                {(varDetail.lines ?? []).map((row: {
                  line_id: string
                  category: string
                  description?: string
                  price_variance: string | number
                  usage_variance: string | number
                  total_variance: string | number
                }) => (
                  <tr key={row.line_id} className="border-t border-gray-100">
                    <td className="px-2 py-2">{row.category}</td>
                    <td className="px-2 py-2">{row.description ?? '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmt(row.price_variance)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmt(row.usage_variance)}</td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums">{fmt(row.total_variance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'budget' && (
        <div className="space-y-4">
          {bva && (
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-center">
                <p className="text-xs text-blue-600 mb-1">Total Budgeted</p>
                <p className="text-xl font-bold text-blue-800">{fmt(bva.total_budgeted)}</p>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-center">
                <p className="text-xs text-amber-600 mb-1">Actual Cost</p>
                <p className="text-xl font-bold text-amber-800">{fmt(bva.total_actual)}</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-center">
                <p className="text-xs text-emerald-600 mb-1">Remaining Budget</p>
                <p className={`text-xl font-bold ${parseFloat(bva.total_variance) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {parseFloat(bva.total_variance) >= 0 ? '+' : ''}{fmt(bva.total_variance)}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-800">Budget Lines</h3>
            <Button size="sm" variant="secondary" onClick={() => setShowBlForm(s => !s)}>+ Add Line</Button>
          </div>
          {showBlForm && (
            <form onSubmit={handleAddBl} className="rounded-lg border border-primary/30 bg-accent p-4 space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <select value={blForm.category} onChange={e => setBlForm(f => ({ ...f, category: e.target.value }))}
                  className="rounded border border-gray-200 px-2 py-1.5 text-sm">
                  {['material', 'labor', 'overhead', 'other'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={blForm.budget_type} onChange={e => setBlForm(f => ({ ...f, budget_type: e.target.value }))}
                  className="rounded border border-gray-200 px-2 py-1.5 text-sm">
                  <option value="original">Original</option>
                  <option value="revised">Revised</option>
                  <option value="supplement">Supplement</option>
                </select>
                <input type="number" step="0.01" placeholder="Amount" value={blForm.amount_budgeted}
                  onChange={e => setBlForm(f => ({ ...f, amount_budgeted: e.target.value }))}
                  className="rounded border border-gray-200 px-2 py-1.5 text-sm" required />
                <input placeholder="Description" value={blForm.description}
                  onChange={e => setBlForm(f => ({ ...f, description: e.target.value }))}
                  className="rounded border border-gray-200 px-2 py-1.5 text-sm" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowBlForm(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                <button type="submit" disabled={createBl.isPending}
                  className="text-sm text-primary font-medium">
                  {createBl.isPending ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          )}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Category</TableColumnLabel></th>
                  <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Type</TableColumnLabel></th>
                  <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Description</TableColumnLabel></th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Budgeted</TableColumnLabel></th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {budgetLines.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">No budget lines. Add one above.</td></tr>
                )}
                {budgetLines.map(bl => (
                  <tr key={bl.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{bl.category}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{bl.budget_type}</td>
                    <td className="px-4 py-3 text-gray-600">{bl.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(bl.amount_budgeted)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => id && deleteBl.mutate({ orderId: id, blId: bl.id })}
                        className="text-red-400 hover:text-red-600 text-xs">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'movements' && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-medium text-gray-800">Goods Movements</h3>
            <Link to="/controlling/goods-movements" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Doc No</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Type</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Date</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Description</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Qty</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Total Cost</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Status</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(goodsMovements as unknown[]).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">No goods movements for this order.</td></tr>
              )}
              {(goodsMovements as Array<{
                id: string; document_no: string | null; movement_type: string; posting_date: string
                description: string | null; qty: string; total_cost: string; status: string
              }>).map(gm => (
                <tr key={gm.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{gm.document_no}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{gm.movement_type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{gm.posting_date}</td>
                  <td className="px-4 py-3 text-gray-700">{gm.description ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{parseFloat(gm.qty).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(gm.total_cost)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${gm.status === 'reversed' ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>{gm.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'confirmations' && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-medium text-gray-800">Activity Confirmations (Time Entries)</h3>
            <Link to="/controlling/activity-confirmations" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Date</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Type</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Hours</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Rate/h</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Total Cost</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Yield %</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Status</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(actConfirmations as unknown[]).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">No activity confirmations for this order.</td></tr>
              )}
              {(actConfirmations as Array<{
                id: string; confirmation_date: string; confirmation_type: string
                hours_confirmed: string; rate_per_hour: string; total_cost: string; yield_pct: string; status: string
              }>).map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{c.confirmation_date}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{c.confirmation_type}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{parseFloat(c.hours_confirmed).toFixed(3)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmt(c.rate_per_hour)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(c.total_cost)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{parseFloat(c.yield_pct).toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'reversed' ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Status transition modal */}
      {showTransition && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowTransition(false)}>
          <div className="bg-card border border-border text-foreground rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between gap-3 mb-4">

              <div className="min-w-0"><h2 className="text-lg font-semibold text-gray-900">Change Order Status</h2></div>

              <button type="button" aria-label="Close"
                type="button"
                onClick={() => setShowTransition(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

            </div>
            <p className="text-sm text-gray-500">Current status: <strong>{order.status}</strong></p>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">New Status</Label>
              <select value={transitionStatus} onChange={e => setTransitionStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="">— select —</option>
                {(['released', 'in_progress', 'completed', 'closed', 'cancelled'] as const).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</Label>
              <textarea value={transitionNotes} onChange={e => setTransitionNotes(e.target.value)}
                rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowTransition(false)}
                className="btn-cancel flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium">Cancel</button>
              <button onClick={handleTransition} disabled={!transitionStatus || transitionMut.isPending}
                className="flex-1 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                {transitionMut.isPending ? 'Updating…' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
