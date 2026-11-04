import { useState } from 'react'
import { AlertTriangle, CheckCircle, PackagePlus, ShoppingCart, Wrench } from 'lucide-react'
import { useHasPermission } from '@/hooks/usePermissions'
import {
  useCreateRequisitionFromShortages,
  useProductionOutputs,
  useProductionReconciliation,
  useProductionShortages,
  useRecordProductionOutput,
  useRepairProductionReconciliation,
  useReverseProductionOutput,
  useWorkCenterLoad,
} from '@/hooks/useProductionOrders'

const card = 'border border-gray-200 dark:border-border rounded-xl overflow-hidden'
const th = 'py-2 px-3 text-xs font-medium text-muted-foreground uppercase'

/** Materials an order is short of, with a one-click draft purchase requisition. */
export function OrderShortagesCard({ orderId, isTerminal }: { orderId: string; isTerminal: boolean }) {
  const canManage = useHasPermission('production.manage')
  const canBuy = useHasPermission('procurement.manage')
  const { data, isLoading } = useProductionShortages(orderId, !isTerminal)
  const createPr = useCreateRequisitionFromShortages(orderId)

  if (isTerminal || isLoading || !data) return null
  if (data.total === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
        <CheckCircle className="w-3.5 h-3.5" /> Stock covers every material this order needs.
      </div>
    )
  }
  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-2 bg-amber-50 px-3 py-2 border-b">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
          <AlertTriangle className="w-4 h-4" /> Material shortages ({data.total})
        </span>
        {canManage && canBuy && (
          <button
            type="button"
            onClick={() => createPr.mutate()}
            disabled={createPr.isPending}
            className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground px-3 py-1.5 disabled:opacity-60"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            {createPr.isPending ? 'Creating…' : 'Create purchase requisition'}
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className={`${th} text-left`}>Material</th>
            <th className={`${th} text-right`}>Required</th>
            <th className={`${th} text-right`}>Available</th>
            <th className={`${th} text-right`}>Short</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.items.map((s) => (
            <tr key={s.component_id}>
              <td className="py-2 px-3 font-medium">{s.component_name}</td>
              <td className="py-2 px-3 text-right">{s.required} {s.uom ?? ''}</td>
              <td className="py-2 px-3 text-right">{s.available}</td>
              <td className="py-2 px-3 text-right font-semibold text-red-600">{s.shortage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Receive part of an order into stock before completion (consumes the matching share of materials). */
export function PartialOutputPanel({ orderId, status }: { orderId: string; status: string }) {
  const canManage = useHasPermission('production.manage')
  const { data } = useProductionOutputs(orderId)
  const record = useRecordProductionOutput(orderId)
  const reverse = useReverseProductionOutput(orderId)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')

  if (!data || data.products.length === 0) return null
  const open = status === 'in_production' || status === 'qc'
  const hasOutputs = data.outputs.length > 0
  if (!open && !hasOutputs) return null

  const lines = data.products
    .map((p) => ({ product_id: p.product_id, qty: Math.floor(Number(qty[p.product_id] || 0)) }))
    .filter((l) => l.qty > 0)
  const submit = () => {
    if (!lines.length) return
    record.mutate({ items: lines, notes: notes.trim() || undefined }, {
      onSuccess: () => { setQty({}); setNotes('') },
    })
  }

  return (
    <div className={card}>
      <div className="px-3 py-2 border-b bg-gray-50 dark:bg-muted/40 text-sm font-semibold flex items-center gap-1.5">
        <PackagePlus className="w-4 h-4" /> Partial output (posts to stock)
      </div>
      <div className="p-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          Receive finished units into stock now; the matching share of materials is consumed. The last units,
          labor cost and the journal are posted when you complete the order.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className={`${th} text-left`}>Product</th>
              <th className={`${th} text-right`}>Ordered</th>
              <th className={`${th} text-right`}>Received</th>
              <th className={`${th} text-right`}>Remaining</th>
              {open && canManage && <th className={`${th} text-right`}>Receive now</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.products.map((p) => (
              <tr key={p.product_id}>
                <td className="py-2 px-3 font-medium">{p.name ?? 'Product'}</td>
                <td className="py-2 px-3 text-right">{p.ordered}</td>
                <td className="py-2 px-3 text-right text-green-700 font-semibold">{p.produced}</td>
                <td className="py-2 px-3 text-right">{p.remaining}</td>
                {open && canManage && (
                  <td className="py-2 px-3 text-right">
                    <input
                      type="number" min={0} max={Math.max(p.remaining - 1, 0)} step={1}
                      value={qty[p.product_id] ?? ''}
                      onChange={(e) => setQty((s) => ({ ...s, [p.product_id]: e.target.value }))}
                      className="w-24 h-8 rounded-md border px-2 text-right bg-background"
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {open && canManage && (
          <div className="flex items-center gap-2">
            <input
              value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (optional)"
              className="flex-1 h-8 rounded-md border px-2 text-sm bg-background"
            />
            <button
              type="button" onClick={submit} disabled={!lines.length || record.isPending}
              className="h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium px-3 disabled:opacity-60"
            >
              {record.isPending ? 'Posting…' : 'Receive into stock'}
            </button>
          </div>
        )}
        {hasOutputs && (
          <ul className="divide-y border rounded-lg">
            {data.outputs.map((o) => (
              <li key={o.id} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                <span>
                  <span className="font-semibold text-green-700">+{o.qty}</span>{' '}
                  <span className="text-muted-foreground text-xs">
                    {o.recorded_at ? new Date(o.recorded_at).toLocaleString('en-IN') : ''}{o.actor ? ` · ${o.actor}` : ''}
                    {o.notes ? ` · ${o.notes}` : ''}
                  </span>
                </span>
                {canManage && status !== 'completed' && (
                  <button
                    type="button"
                    onClick={() => { if (window.confirm('Take this output back out of stock?')) reverse.mutate(o.id) }}
                    disabled={reverse.isPending}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Reverse
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {status === 'completed' && hasOutputs && (
          <p className="text-xs text-muted-foreground">Re-open the order to reverse recorded output.</p>
        )}
      </div>
    </div>
  )
}

/** Open planned hours per work center against daily capacity. */
export function WorkCenterLoadCard() {
  const { data, isLoading } = useWorkCenterLoad()
  return (
    <div className={card}>
      <div className="px-3 py-2 border-b bg-gray-50 dark:bg-muted/40 text-sm font-semibold flex items-center gap-1.5">
        <Wrench className="w-4 h-4" /> Work center load
      </div>
      {isLoading ? (
        <p className="p-3 text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">No active work centers.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className={`${th} text-left`}>Work center</th>
              <th className={`${th} text-right`}>Open ops</th>
              <th className={`${th} text-right`}>Open hours</th>
              <th className={`${th} text-right`}>Capacity / day</th>
              <th className={`${th} text-right`}>Days of work</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.items.map((r) => (
              <tr key={r.work_center_id}>
                <td className="py-2 px-3 font-medium">{r.name}</td>
                <td className="py-2 px-3 text-right">{r.open_operations}</td>
                <td className="py-2 px-3 text-right">{r.open_hours}</td>
                <td className="py-2 px-3 text-right">{r.capacity_per_day ?? '—'}</td>
                <td className={`py-2 px-3 text-right font-semibold ${(r.days_of_work ?? 0) > 10 ? 'text-red-600' : ''}`}>
                  {r.days_of_work ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!!data?.unassigned_hours && (
        <p className="px-3 py-2 text-xs text-muted-foreground border-t">
          {data.unassigned_hours} h of open operations have no work center assigned.
        </p>
      )}
    </div>
  )
}

/** Consistency report between orders, stock, reservations and the ledger. */
export function ReconciliationCard() {
  const canManage = useHasPermission('production.manage')
  const { data, isLoading, refetch, isFetching } = useProductionReconciliation()
  const repair = useRepairProductionReconciliation()

  return (
    <div className={card}>
      <div className="px-3 py-2 border-b bg-gray-50 dark:bg-muted/40 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Data consistency check</span>
        <span className="flex items-center gap-2">
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="text-xs text-primary hover:underline">
            {isFetching ? 'Checking…' : 'Re-check'}
          </button>
          {canManage && !!data?.fixable && (
            <button
              type="button"
              onClick={() => repair.mutate()}
              disabled={repair.isPending}
              className="text-xs font-medium rounded-lg bg-primary text-primary-foreground px-3 py-1 disabled:opacity-60"
            >
              Release {data.fixable} stale reservation{data.fixable === 1 ? '' : 's'}
            </button>
          )}
        </span>
      </div>
      {isLoading || !data ? (
        <p className="p-3 text-sm text-muted-foreground">Checking…</p>
      ) : data.total === 0 ? (
        <p className="p-3 text-sm text-green-700 flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4" /> Orders, stock, reservations and journals agree.
        </p>
      ) : (
        <ul className="divide-y">
          {data.issues.map((i, idx) => (
            <li key={`${i.code}-${i.order_id}-${idx}`} className="px-3 py-2 text-sm flex items-start gap-2">
              <span className={`mt-0.5 text-xs font-bold rounded-full px-2 py-0.5 ${i.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                {i.severity}
              </span>
              <span>
                {i.ref && <span className="font-mono text-xs mr-1.5">{i.ref}</span>}
                {i.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
