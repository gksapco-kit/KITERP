import { useState } from 'react'
import { CalendarClock, ClipboardList, Factory, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { vendorApi } from '@/api/vendor'
import type { ProductionJobCard, ProductionSchedulePlan } from '@/api/vendor'
import { useHasPermission } from '@/hooks/usePermissions'
import {
  useCreateProductionFromSalesOrder,
  useProductionOrdersOfSalesOrder,
  useProductionSchedule,
} from '@/hooks/useProductionOrders'

const card = 'border border-gray-200 dark:border-border rounded-xl overflow-hidden'

const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString() : '—')

/** Sales order page: draft production for the manufactured lines and see what was already raised. */
export function SalesOrderProductionCard({ salesOrderId, closed }: { salesOrderId: string; closed: boolean }) {
  const canManage = useHasPermission('production.manage')
  const { data, isError, isLoading } = useProductionOrdersOfSalesOrder(salesOrderId)
  const create = useCreateProductionFromSalesOrder(salesOrderId)
  const [shortfallOnly, setShortfallOnly] = useState(false)

  // No production access (403) or module off: stay out of the way.
  if (isError || isLoading || !data) return null
  const active = data.items.filter((o) => o.status !== 'cancelled')
  if (active.length === 0 && (closed || !canManage)) return null

  return (
    <div className={`${card} px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap text-sm`}>
      <span className="flex items-center gap-2 font-medium">
        <Factory className="w-4 h-4 text-primary" /> Production
        {active.length > 0 && (
          <span className="flex items-center gap-2 font-normal">
            {active.map((o) => (
              <Link key={o.id} to={`/production/orders/${o.id}`} className="text-primary hover:underline">
                {o.ref} <span className="text-xs text-muted-foreground capitalize">({o.status.replace('_', ' ')})</span>
              </Link>
            ))}
          </span>
        )}
      </span>
      {active.length === 0 && canManage && (
        <span className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={shortfallOnly} onChange={(e) => setShortfallOnly(e.target.checked)} />
            Only what stock can’t cover
          </label>
          <button
            type="button"
            disabled={create.isPending}
            onClick={() =>
              create.mutate(
                { shortfall_only: shortfallOnly },
                {
                  onSuccess: (res) => {
                    if (res.skipped.length) {
                      toast.info(`Skipped: ${res.skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}`)
                    }
                  },
                },
              )
            }
            className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground px-3 py-1.5 disabled:opacity-60"
          >
            {create.isPending ? 'Creating…' : 'Plan production'}
          </button>
        </span>
      )}
    </div>
  )
}

/** Forward-schedule an order's operations on work-center capacity (preview, then save). */
export function ScheduleCard({ orderId, isTerminal }: { orderId: string; isTerminal: boolean }) {
  const canManage = useHasPermission('production.manage')
  const { preview, apply } = useProductionSchedule(orderId)
  const [start, setStart] = useState('')
  const plan: ProductionSchedulePlan | undefined = apply.data ?? preview.data

  if (isTerminal) return null
  return (
    <div className={card}>
      <div className="px-3 py-2 border-b bg-gray-50 dark:bg-muted/40 flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarClock className="w-4 h-4" /> Schedule on capacity
        </span>
        <span className="flex items-center gap-2">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="text-xs border rounded-md px-2 py-1 bg-background"
            aria-label="Start date"
          />
          <button
            type="button"
            onClick={() => preview.mutate(start || undefined)}
            disabled={preview.isPending}
            className="text-xs font-medium border rounded-lg px-3 py-1.5 disabled:opacity-60"
          >
            {preview.isPending ? 'Calculating…' : 'Preview'}
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => apply.mutate(start || undefined)}
              disabled={apply.isPending}
              className="text-xs font-medium rounded-lg bg-primary text-primary-foreground px-3 py-1.5 disabled:opacity-60"
            >
              {apply.isPending ? 'Saving…' : 'Schedule & save'}
            </button>
          )}
        </span>
      </div>
      {!plan ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">
          Lines operations up one after another and queues them behind work already booked on each work center.
        </p>
      ) : plan.steps.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">No open operations to schedule. Add operations first.</p>
      ) : (
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground uppercase">
                <th className="py-2 px-3 text-left font-medium">Operation</th>
                <th className="py-2 px-3 text-left font-medium">Work center</th>
                <th className="py-2 px-3 text-right font-medium">Hours</th>
                <th className="py-2 px-3 text-right font-medium">Start</th>
                <th className="py-2 px-3 text-right font-medium">End</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {plan.steps.map((s) => (
                <tr key={s.operation_id}>
                  <td className="py-2 px-3 font-medium">{s.name}</td>
                  <td className="py-2 px-3">{s.work_center ?? '—'}</td>
                  <td className="py-2 px-3 text-right">{s.planned_hours}</td>
                  <td className="py-2 px-3 text-right">{fmtDate(s.start)}</td>
                  <td className="py-2 px-3 text-right">{fmtDate(s.end)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p
            className={`px-3 py-2 text-xs border-t ${
              plan.late_by_days ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50'
            }`}
          >
            Finishes {fmtDate(plan.finish)}
            {plan.deadline
              ? plan.late_by_days
                ? ` — ${plan.late_by_days} day(s) after the ${fmtDate(plan.deadline)} deadline.`
                : ` — on time for the ${fmtDate(plan.deadline)} deadline.`
              : '.'}
            {plan.applied ? ' Saved.' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

function jobCardHtml(c: ProductionJobCard): string {
  const rows = (items: string[][]) =>
    items.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>Job card ${esc(c.ref)}</title>
<style>
 body{font-family:Arial,sans-serif;font-size:12px;margin:24px;color:#111}
 h1{font-size:18px;margin:0 0 4px} h2{font-size:13px;margin:16px 0 4px;border-bottom:1px solid #999}
 table{width:100%;border-collapse:collapse} td,th{border:1px solid #bbb;padding:4px 6px;text-align:left}
 th{background:#f1f1f1} .meta td{border:none;padding:1px 12px 1px 0}
</style></head><body>
<h1>Job card ${esc(c.ref)}</h1>
<table class="meta"><tr>
 <td><b>Status</b> ${esc(c.status)}</td><td><b>Priority</b> ${esc(c.priority)}</td>
 <td><b>Deadline</b> ${esc(c.deadline ?? '—')}</td><td><b>Customer</b> ${esc(c.customer ?? '—')}</td>
 <td><b>Sales order</b> ${esc(c.sales_order ?? '—')}</td></tr></table>
${c.special_requirements ? `<p><b>Special requirements:</b> ${esc(c.special_requirements)}</p>` : ''}
<h2>To make</h2>
<table><tr><th>Item</th><th>Quantity</th><th>Done</th></tr>${rows(c.items.map((i) => [i.name ?? '', String(i.qty ?? ''), String(i.produced)]))}</table>
<h2>Operations</h2>
<table><tr><th>#</th><th>Operation</th><th>Work center</th><th>Hours</th><th>Planned</th><th>Done / sign</th></tr>
${rows(c.operations.map((o) => [String(o.sequence), o.name, o.work_center ?? '', String(o.planned_hours), `${fmtDate(o.planned_start)} – ${fmtDate(o.planned_end)}`, '']))}</table>
${
  c.materials.length
    ? `<h2>Materials to pick</h2><table><tr><th>Material</th><th>SKU</th><th>Required</th><th>Issued</th><th>To pick</th><th>On hand</th></tr>
${rows(c.materials.map((m) => [m.name, m.sku ?? '', `${m.required} ${m.uom ?? ''}`, String(m.already_issued), String(m.to_pick), String(m.on_hand)]))}</table>`
    : ''
}
${c.notes ? `<h2>Notes</h2><p>${esc(c.notes)}</p>` : ''}
<script>window.onload=function(){window.print()}</script>
</body></html>`
}

/** Opens a printable job card (what to make, routing and materials to pick). */
export function JobCardButton({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false)
  const print = async () => {
    setBusy(true)
    try {
      const card_ = await vendorApi.getProductionJobCard(orderId)
      const w = window.open('', '_blank')
      if (!w) {
        toast.error('Allow pop-ups to print the job card')
        return
      }
      w.document.write(jobCardHtml(card_))
      w.document.close()
    } catch {
      toast.error('Could not load the job card')
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      type="button"
      onClick={print}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 disabled:opacity-60"
    >
      {busy ? <ClipboardList className="w-3.5 h-3.5" /> : <Printer className="w-3.5 h-3.5" />}
      Job card / pick list
    </button>
  )
}
