import { useParams, Link, useOutletContext } from 'react-router-dom'
import { Package, ChevronLeft, Clock, CheckCircle2, Truck, XCircle, MapPin } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { storefrontApi } from '@/api/storefront.api'
import type { StorefrontVendor } from '@/api/storefront.api'

const STATUS_STEPS = [
  { key: 'pending', label: 'Order Placed', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'processing', label: 'Processing', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: MapPin },
]

const STATUS_INDEX: Record<string, number> = {
  pending: 0, confirmed: 1, processing: 2, shipped: 3, delivered: 4,
  cancelled: -1, refunded: -2,
}

export default function OrderTracking() {
  const { vendorSlug, orderId } = useParams<{ vendorSlug: string; orderId: string }>()
  const { themeColor } = useOutletContext<{ vendor: StorefrontVendor; themeColor: string }>()
  const base = `/store/${vendorSlug}`
  const symbol = '\u20B9'

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['storefront', 'order', vendorSlug, orderId],
    queryFn: () => storefrontApi.getOrder(vendorSlug || '', orderId || ''),
    enabled: !!vendorSlug && !!orderId,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse"><div className="h-8 bg-gray-200 rounded w-1/3 mb-6" /><div className="h-60 bg-gray-200 rounded" /></div>
  }

  if (error || !order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Package className="w-16 h-16 text-gray-300 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900 mt-4">Order Not Found</h2>
        <Link to={base} className="mt-4 inline-block text-sm hover:underline" style={{ color: themeColor }}>Go to store</Link>
      </div>
    )
  }

  const currentStepIndex = STATUS_INDEX[order.status] ?? 0
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded'

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to={base} className="inline-flex items-center gap-1 text-sm mb-6 hover:underline" style={{ color: themeColor }}>
        <ChevronLeft className="w-4 h-4" /> Back to Store
      </Link>

      <div className="bg-white rounded-xl border overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b" style={{ background: `linear-gradient(135deg, ${themeColor}08, ${themeColor}15)` }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Order #{order.order_number}</p>
              <h1 className="text-xl font-bold text-gray-900 mt-1">Order Details</h1>
              <p className="text-sm text-gray-500 mt-1">
                Placed on {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Total</p>
              <p className="text-2xl font-bold" style={{ color: themeColor }}>{symbol}{order.total.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Status tracker */}
        <div className="p-6 border-b">
          {isCancelled ? (
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
              <XCircle className="w-6 h-6 text-red-500" />
              <div>
                <p className="font-medium text-red-700">Order {order.status === 'cancelled' ? 'Cancelled' : 'Refunded'}</p>
                {order.cancel_reason && <p className="text-sm text-red-500 mt-1">{order.cancel_reason}</p>}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              {STATUS_STEPS.map((step, i) => {
                const isActive = i <= currentStepIndex
                const isCurrent = i === currentStepIndex
                return (
                  <div key={step.key} className="flex-1 relative">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                          isActive ? 'text-white' : 'bg-gray-100 text-gray-400'
                        } ${isCurrent ? 'ring-4' : ''}`}
                        style={isActive ? { backgroundColor: themeColor } : {}}
                      >
                        <step.icon className="w-5 h-5" />
                      </div>
                      <p className={`text-xs mt-2 font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                        {step.label}
                      </p>
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div className="absolute top-5 left-1/2 w-full h-0.5 -translate-y-1/2" style={{ backgroundColor: i < currentStepIndex ? themeColor : '#e5e7eb' }} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Items */}
        <div className="p-6 border-b">
          <h3 className="font-semibold text-gray-900 mb-4">Items</h3>
          <div className="space-y-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 shrink-0">
                  <Package className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">Qty: {item.qty} x {symbol}{item.price.toLocaleString()}</p>
                </div>
                <p className="font-medium text-gray-900">{symbol}{(item.qty * item.price).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Shipping Address</h3>
              {order.shipping_address ? (
                <div className="text-sm text-gray-600 space-y-0.5">
                  <p>{order.shipping_address.street_address}</p>
                  <p>{order.shipping_address.city}, {order.shipping_address.state}</p>
                  <p>{order.shipping_address.postal_code}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Not provided</p>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Payment</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Method: <span className="font-medium uppercase">{order.payment_method || 'N/A'}</span></p>
                <p>Status: <span className={`font-medium ${order.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>{order.payment_status}</span></p>
              </div>
              {order.tracking_number && (
                <div className="mt-3">
                  <p className="text-sm text-gray-600">
                    Tracking: <span className="font-medium">{order.tracking_number}</span>
                  </p>
                  {order.tracking_url && (
                    <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline" style={{ color: themeColor }}>
                      Track Shipment
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
