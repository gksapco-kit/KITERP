import { User, Mail, Phone, MapPin, Truck, ExternalLink } from 'lucide-react'
import type { Order } from '@/types'
import { SectionLabel } from './OrderDetailPrimitives'

interface CustomerShippingPanelProps {
  order: Pick<Order, 'customer_name' | 'customer_email' | 'customer_phone' | 'shipping_address' | 'tracking_number' | 'tracking_url'>
}

/** Customer contact + shipping / tracking details column of the order detail card. */
export function CustomerShippingPanel({ order }: CustomerShippingPanelProps) {
  return (
    <div className="xl:col-span-4 flex flex-col border-t xl:border-t-0">
      <div className="px-4 py-3 border-b bg-muted/20">
        <SectionLabel icon={User}>Customer & shipping</SectionLabel>
      </div>
      <div className="flex-1 px-4 py-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 shrink-0 text-sm font-bold flex items-center justify-center">
            {(order.customer_name || '?')[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">{order.customer_name || 'Unknown Customer'}</p>
            <div className="mt-1.5 space-y-1">
              {order.customer_email && (
                <a href={`mailto:${order.customer_email}`} className="text-xs text-gray-600 flex items-center gap-1.5 hover:text-primary truncate">
                  <Mail className="w-3.5 h-3.5 shrink-0" />{order.customer_email}
                </a>
              )}
              {order.customer_phone && (
                <a href={`tel:${order.customer_phone}`} className="text-xs text-gray-600 flex items-center gap-1.5 hover:text-primary">
                  <Phone className="w-3.5 h-3.5 shrink-0" />{order.customer_phone}
                </a>
              )}
            </div>
          </div>
        </div>
        {(order.shipping_address || order.tracking_number || order.tracking_url) ? (
          <div className="rounded-lg border bg-gray-50/50 p-3 space-y-2">
            {order.shipping_address && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Ship to
                </p>
                <p className="text-sm text-gray-800 leading-relaxed">{order.shipping_address.street_address}</p>
                <p className="text-sm text-gray-700">{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}</p>
                <p className="text-xs text-gray-500">{order.shipping_address.country}</p>
              </div>
            )}
            {(order.tracking_number || order.tracking_url) && (
              <div className={order.shipping_address ? 'pt-2 border-t border-gray-200' : ''}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1">
                  <Truck className="w-3 h-3" /> Tracking
                </p>
                {order.tracking_number && <p className="text-sm font-mono text-gray-800">{order.tracking_number}</p>}
                {order.tracking_url && (
                  <a href={order.tracking_url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-0.5 font-medium">
                    Track shipment <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No shipping details on this order.</p>
        )}
      </div>
    </div>
  )
}
