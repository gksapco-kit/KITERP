import { Package } from 'lucide-react'
import { formatCurrency, mediaUrl } from '@/lib/utils'
import type { Order, OrderItem } from '@/types'
import { SectionLabel } from './OrderDetailPrimitives'

interface OrderItemsPanelProps {
  order: Pick<Order, 'items' | 'item_count' | 'subtotal' | 'tax_amount' | 'shipping_amount' | 'discount_amount' | 'total' | 'notes'>
}

/** Line items + pricing summary column of the order detail card. */
export function OrderItemsPanel({ order }: OrderItemsPanelProps) {
  return (
    <div className="xl:col-span-5 flex flex-col">
      <div className="px-4 py-3 border-b bg-muted/20">
        <SectionLabel icon={Package}>Items ({order.item_count})</SectionLabel>
      </div>
      <div className="flex-1 px-4 py-2 overflow-y-auto max-h-[320px] xl:max-h-none">
        {order.items.map((item: OrderItem, i: number) => (
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
        ))}
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
