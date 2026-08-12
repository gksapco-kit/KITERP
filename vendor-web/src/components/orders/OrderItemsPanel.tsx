import { useState } from 'react'
import { Package, ChevronRight } from 'lucide-react'
import { formatCurrency, mediaUrl, cn } from '@/lib/utils'
import type { Order, OrderItem, OrderLine } from '@/types'
import { SectionLabel } from './OrderDetailPrimitives'
import { LineDetailPanel } from './LineDetailPanel'

interface OrderItemsPanelProps {
  order: Order
}

const QTY_CHIP = 'inline-flex items-center gap-0.5 rounded px-1 py-0 text-[9px] font-medium'

function LineRow({
  line,
  selected,
  onClick,
}: {
  line: OrderLine
  selected: boolean
  onClick: () => void
}) {
  const hasOpen = (line.ordered_qty ?? 0) - (line.shipped_qty ?? 0) - (line.rejected_qty ?? 0) > 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left border-b border-border/60 last:border-0 py-2.5 px-4 flex items-start gap-3 hover:bg-muted/30 transition-colors',
        selected && 'bg-primary/5 border-l-2 border-l-primary',
      )}
    >
      {line.item_image_url ? (
        <img src={mediaUrl(line.item_image_url)} alt={line.item_name} className="mt-0.5 h-9 w-9 shrink-0 rounded-md border object-cover" />
      ) : (
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Package className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-foreground truncate">{line.item_name}</p>
          <p className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(line.line_total ?? 0)}</p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {line.ordered_qty} {line.unit_of_measure} × {formatCurrency(line.net_price ?? 0)}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {(line.shipped_qty ?? 0) > 0 && (
            <span className={cn(QTY_CHIP, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300')}>Dispatched {line.shipped_qty}</span>
          )}
          {(line.invoiced_qty ?? 0) > 0 && (
            <span className={cn(QTY_CHIP, 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300')}>Invoiced {line.invoiced_qty}</span>
          )}
          {hasOpen && (
            <span className={cn(QTY_CHIP, 'bg-muted text-muted-foreground')}>Open {(line.ordered_qty ?? 0) - (line.shipped_qty ?? 0) - (line.rejected_qty ?? 0)}</span>
          )}
          {(line.rejected_qty ?? 0) > 0 && (
            <span className={cn(QTY_CHIP, 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300')}>Rejected {line.rejected_qty}</span>
          )}
        </div>
      </div>
      <ChevronRight className={cn('h-4 w-4 shrink-0 mt-1.5 transition-transform text-muted-foreground', selected && 'text-primary rotate-90')} />
    </button>
  )
}

/** Line items + pricing summary column of the order detail card. */
export function OrderItemsPanel({ order }: OrderItemsPanelProps) {
  const hasNormalizedLines = (order.order_lines?.length ?? 0) > 0
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const selectedLine = order.order_lines?.find((l) => l.id === selectedLineId) ?? null

  return (
    <div className="flex flex-col">
      {/* ── Section header ── */}
      <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
        <SectionLabel icon={Package}>
          Line items ({order.item_count ?? (order.order_lines?.length ?? order.items?.length ?? 0)})
        </SectionLabel>
        <span className="text-[10px] text-muted-foreground">Click a line to see its details</span>
      </div>

      {/* ── Two-pane layout ── */}
      <div className={cn('flex flex-1 min-h-0', selectedLine ? 'divide-x' : '')}>
        {/* Left: line list */}
        <div className={cn('overflow-y-auto', selectedLine ? 'w-1/2' : 'w-full')}>
          {hasNormalizedLines ? (
            order.order_lines!.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                selected={selectedLineId === line.id}
                onClick={() => setSelectedLineId(selectedLineId === line.id ? null : line.id)}
              />
            ))
          ) : (
            order.items.map((item: OrderItem, i: number) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2.5 px-4 border-b border-border/60 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  {item.image_url ? (
                    <img src={mediaUrl(item.image_url)} alt={item.name} className="w-9 h-9 rounded-md object-cover shrink-0 border" />
                  ) : (
                    <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.qty} × {formatCurrency(item.price)}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground shrink-0">{formatCurrency(item.price * item.qty)}</p>
              </div>
            ))
          )}
        </div>

        {/* Right: line detail panel */}
        {selectedLine && (
          <div className="w-1/2 overflow-y-auto">
            <LineDetailPanel
              order={order}
              line={selectedLine}
              onClose={() => setSelectedLineId(null)}
            />
          </div>
        )}
      </div>

      {/* ── Pricing footer ── */}
      <div className="mt-auto border-t bg-muted/20 px-4 py-3 space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{formatCurrency(order.tax_amount)}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>{formatCurrency(order.shipping_amount)}</span></div>
        {(order.discount_amount ?? 0) > 0 && (
          <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><span>Discount</span><span>−{formatCurrency(order.discount_amount)}</span></div>
        )}
        <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
          <span>Total</span><span>{formatCurrency(order.total)}</span>
        </div>
        {order.notes && (
          <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
            <span className="font-medium text-foreground">Notes:</span> {order.notes}
          </p>
        )}
      </div>
    </div>
  )
}
