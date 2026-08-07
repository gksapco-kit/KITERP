import { Package, Calendar, CheckCircle2, Clock, Truck } from 'lucide-react'
import { formatCurrency, mediaUrl, cn, formatDate } from '@/lib/utils'
import type { Order, OrderItem, OrderLine, OrderLineSchedule } from '@/types'
import { SectionLabel } from './OrderDetailPrimitives'

interface OrderItemsPanelProps {
  order: Pick<Order, 'items' | 'item_count' | 'subtotal' | 'tax_amount' | 'shipping_amount' | 'discount_amount' | 'total' | 'notes' | 'order_lines'>
}

const QTY_BADGE = 'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium'

const SCHEDULE_STATUS_STYLE: Record<string, string> = {
  committed: 'text-emerald-700 dark:text-emerald-400',
  partial:   'text-amber-700 dark:text-amber-400',
  open:      'text-muted-foreground',
  shipped:   'text-blue-700 dark:text-blue-400',
  closed:    'text-muted-foreground line-through',
  cancelled: 'text-destructive line-through',
}

const SCHEDULE_SOURCE_ICON: Record<string, React.ReactNode> = {
  in_stock:       <CheckCircle2 className="h-3 w-3" />,
  purchase_order: <Clock className="h-3 w-3" />,
  lead_time:      <Clock className="h-3 w-3" />,
  manual:         <CheckCircle2 className="h-3 w-3" />,
  none:           <Clock className="h-3 w-3" />,
}

function ScheduleLines({ schedules }: { schedules: OrderLineSchedule[] }) {
  if (!schedules.length) return null
  return (
    <div className="mt-1.5 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5 space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Calendar className="h-3 w-3" /> Delivery schedule
      </p>
      {schedules.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-2 text-[11px]">
          <span className={cn('flex items-center gap-1', SCHEDULE_STATUS_STYLE[s.status] || 'text-muted-foreground')}>
            {SCHEDULE_SOURCE_ICON[s.commitment_source] ?? <Clock className="h-3 w-3" />}
            <span className="capitalize">{s.status}</span>
            {s.confirmed_date && (
              <span className="font-medium">— {formatDate(s.confirmed_date)}</span>
            )}
            {!s.confirmed_date && s.requested_date && (
              <span className="text-muted-foreground">requested {formatDate(s.requested_date)}</span>
            )}
          </span>
          <span className="shrink-0 tabular-nums text-foreground">
            {s.confirmed_qty > 0 ? `${s.confirmed_qty} committed` : `${s.requested_qty} open`}
            {s.shipped_qty > 0 && ` · ${s.shipped_qty} shipped`}
          </span>
        </div>
      ))}
    </div>
  )
}

function NormalizedLines({ lines }: { lines: OrderLine[] }) {
  return (
    <>
      {/* Column header */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_auto] items-center gap-2 px-1 pb-1 text-[10px] font-medium uppercase text-muted-foreground">
        <span>Item</span>
        <span className="text-right">Amount</span>
      </div>
      {lines.map((line) => {
        const hasShipped = line.shipped_qty > 0
        const hasOpen = line.ordered_qty - line.shipped_qty - line.rejected_qty > 0
        return (
          <div
            key={line.id}
            className="border-b border-border/60 last:border-0 py-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              {/* Thumbnail + name */}
              <div className="flex items-start gap-3 min-w-0">
                {line.item_image_url ? (
                  <img
                    src={mediaUrl(line.item_image_url)}
                    alt={line.item_name}
                    className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover"
                  />
                ) : (
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{line.item_name}</p>
                  {line.item_sku && (
                    <p className="text-[11px] text-muted-foreground">SKU: {line.item_sku}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {line.ordered_qty} {line.unit_of_measure} × {formatCurrency(line.net_price)}
                    {line.discount_amount > 0 && (
                      <span className="ml-1 text-green-700">
                        (−{formatCurrency(line.discount_amount)} each)
                      </span>
                    )}
                  </p>
                  {/* Qty ladder badges */}
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className={cn(QTY_BADGE, 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300')}>
                      Ordered {line.ordered_qty}
                    </span>
                    {line.committed_qty > 0 && (
                      <span className={cn(QTY_BADGE, 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300')}>
                        Committed {line.committed_qty}
                      </span>
                    )}
                    {hasShipped && (
                      <span className={cn(QTY_BADGE, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300')}>
                        Shipped {line.shipped_qty}
                      </span>
                    )}
                    {line.invoiced_qty > 0 && (
                      <span className={cn(QTY_BADGE, 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300')}>
                        Invoiced {line.invoiced_qty}
                      </span>
                    )}
                    {line.returned_qty > 0 && (
                      <span className={cn(QTY_BADGE, 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300')}>
                        Returned {line.returned_qty}
                      </span>
                    )}
                    {line.rejected_qty > 0 && (
                      <span className={cn(QTY_BADGE, 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300')}>
                        Rejected {line.rejected_qty}
                        {line.rejection_reason ? ` — ${line.rejection_reason}` : ''}
                      </span>
                    )}
                    {hasOpen && (
                      <span className={cn(QTY_BADGE, 'bg-muted text-muted-foreground')}>
                        Open {line.ordered_qty - line.shipped_qty - line.rejected_qty}
                      </span>
                    )}
                  </div>
                  {line.batch_number && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Batch: {line.batch_number}</p>
                  )}
                  {line.line_notes && (
                    <p className="mt-0.5 text-[11px] italic text-muted-foreground">{line.line_notes}</p>
                  )}
                  {(line.schedules?.length ?? 0) > 0 && (
                    <ScheduleLines schedules={line.schedules!} />
                  )}
                </div>
              </div>
              <p className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(line.line_total)}</p>
            </div>
          </div>
        )
      })}
    </>
  )
}

/** Line items + pricing summary column of the order detail card. */
export function OrderItemsPanel({ order }: OrderItemsPanelProps) {
  const hasNormalizedLines = (order.order_lines?.length ?? 0) > 0

  return (
    <div className="xl:col-span-5 flex flex-col">
      <div className="px-4 py-3 border-b bg-muted/20">
        <SectionLabel icon={Package}>Items ({order.item_count})</SectionLabel>
      </div>
      <div className="flex-1 px-4 py-2 overflow-y-auto max-h-[320px] xl:max-h-none">
        {hasNormalizedLines ? (
          <NormalizedLines lines={order.order_lines!} />
        ) : (
          /* Legacy JSONB fallback */
          order.items.map((item: OrderItem, i: number) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                {item.image_url ? (
                  <img src={mediaUrl(item.image_url)} alt={item.name} className="w-11 h-11 rounded-md object-cover shrink-0 border" />
                ) : (
                  <div className="w-11 h-11 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.qty} × {formatCurrency(item.price)}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-900 shrink-0">{formatCurrency(item.price * item.qty)}</p>
            </div>
          ))
        )}
      </div>
      <div className="mt-auto border-t bg-muted/20 px-4 py-3 space-y-1 text-sm">
        <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
        <div className="flex justify-between text-gray-600"><span>Tax</span><span>{formatCurrency(order.tax_amount)}</span></div>
        <div className="flex justify-between text-gray-600"><span>Shipping</span><span>{formatCurrency(order.shipping_amount)}</span></div>
        {order.discount_amount > 0 && (
          <div className="flex justify-between text-green-700"><span>Discount</span><span>-{formatCurrency(order.discount_amount)}</span></div>
        )}
        <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
          <span>Total</span><span>{formatCurrency(order.total)}</span>
        </div>
        {order.notes && (
          <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
            <span className="font-medium text-gray-700">Notes:</span> {order.notes}
          </p>
        )}
      </div>
    </div>
  )
}
