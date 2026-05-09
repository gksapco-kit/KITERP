import { useState } from 'react'
import { useParams, Link, useOutletContext } from 'react-router-dom'
import { ShieldCheck, CreditCard, Banknote, Wallet, ChevronLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { storefrontApi } from '@/api/storefront.api'
import type { StorefrontVendor } from '@/api/storefront.api'

const PAYMENT_METHODS = [
  { id: 'cod', label: 'Cash on Delivery', icon: Banknote, desc: 'Pay when you receive' },
  { id: 'upi', label: 'UPI', icon: Wallet, desc: 'Google Pay, PhonePe, Paytm' },
  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard, desc: 'Visa, Mastercard, RuPay' },
]

export default function StorefrontCheckout() {
  const { vendorSlug } = useParams<{ vendorSlug: string }>()
  const { themeColor } = useOutletContext<{ vendor: StorefrontVendor; themeColor: string }>()
  const qc = useQueryClient()
  const base = `/store/${vendorSlug}`
  const symbol = '\u20B9'

  const [address, setAddress] = useState({
    street_address: '', city: '', state: '', postal_code: '', country: 'India', label: 'home',
  })
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [notes, setNotes] = useState('')
  const [orderId, setOrderId] = useState<string | null>(null)

  const { data: cart, isLoading } = useQuery({
    queryKey: ['storefront', 'cart', vendorSlug],
    queryFn: () => storefrontApi.getCart(vendorSlug || ''),
    enabled: !!vendorSlug,
  })

  const placeOrder = useMutation({
    mutationFn: () => storefrontApi.checkout(vendorSlug || '', {
      shipping_address: address,
      payment_method: paymentMethod,
      notes: notes || undefined,
    }),
    onSuccess: (order) => {
      setOrderId(order.id)
      qc.invalidateQueries({ queryKey: ['storefront', 'cart', vendorSlug] })
      toast.success('Order placed successfully!')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to place order'
      toast.error(msg)
    },
  })

  const canSubmit = address.street_address && address.city && address.state && address.postal_code && paymentMethod

  if (orderId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: `${themeColor}15` }}>
          <CheckCircle2 className="w-10 h-10" style={{ color: themeColor }} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mt-6">Order Placed!</h1>
        <p className="text-gray-500 mt-2">Thank you for your order. You'll receive a confirmation shortly.</p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link to={`${base}/orders/${orderId}`}>
            <Button variant="outline">Track Order</Button>
          </Link>
          <Link to={`${base}/products`}>
            <Button className="text-white" style={{ backgroundColor: themeColor }}>Continue Shopping</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse"><div className="h-8 bg-gray-200 rounded w-1/3 mb-6" /><div className="h-60 bg-gray-200 rounded" /></div>
  }

  const items = cart?.items || []
  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-gray-900">Your cart is empty</h2>
        <Link to={`${base}/products`} className="mt-4 inline-block text-sm hover:underline" style={{ color: themeColor }}>Browse products</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to={`${base}/cart`} className="inline-flex items-center gap-1 text-sm mb-6 hover:underline" style={{ color: themeColor }}>
        <ChevronLeft className="w-4 h-4" /> Back to Cart
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Shipping */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Shipping Address</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Street Address</label>
                <Input value={address.street_address} onChange={(e) => setAddress({ ...address, street_address: e.target.value })} placeholder="House/Flat No, Street, Area" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">City</label>
                  <Input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} placeholder="City" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">State</label>
                  <Input value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} placeholder="State" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Postal Code</label>
                  <Input value={address.postal_code} onChange={(e) => setAddress({ ...address, postal_code: e.target.value })} placeholder="PIN Code" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Label</label>
                  <select value={address.label} onChange={(e) => setAddress({ ...address, label: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="home">Home</option>
                    <option value="work">Work</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Payment Method</h2>
            <div className="space-y-3">
              {PAYMENT_METHODS.map((pm) => (
                <label key={pm.id} className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${paymentMethod === pm.id ? 'border-2' : 'border-gray-200 hover:border-gray-300'}`} style={paymentMethod === pm.id ? { borderColor: themeColor, backgroundColor: `${themeColor}05` } : {}}>
                  <input type="radio" name="payment" value={pm.id} checked={paymentMethod === pm.id} onChange={() => setPaymentMethod(pm.id)} className="sr-only" />
                  <pm.icon className="w-6 h-6 text-gray-500" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{pm.label}</p>
                    <p className="text-xs text-gray-400">{pm.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === pm.id ? '' : 'border-gray-300'}`} style={paymentMethod === pm.id ? { borderColor: themeColor } : {}}>
                    {paymentMethod === pm.id && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: themeColor }} />}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Order Notes (Optional)</h2>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions for your order…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-24 resize-none" maxLength={500} />
          </div>
        </div>

        {/* Right: summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border p-6 sticky top-24">
            <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
            <div className="space-y-3 divide-y divide-gray-100">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between gap-2 pt-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">Qty: {item.qty}</p>
                  </div>
                  <p className="text-sm font-medium text-gray-900 shrink-0">{symbol}{(item.price * item.qty).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="border-t mt-4 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{symbol}{cart?.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Shipping</span>
                <span className="text-green-600">Free</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold text-lg text-gray-900">
                <span>Total</span>
                <span style={{ color: themeColor }}>{symbol}{cart?.subtotal.toLocaleString()}</span>
              </div>
            </div>
            <Button
              className="w-full mt-6 gap-2 text-white"
              size="lg"
              style={{ backgroundColor: themeColor }}
              disabled={!canSubmit || placeOrder.isPending}
              onClick={() => placeOrder.mutate()}
            >
              <ShieldCheck className="w-5 h-5" />
              {placeOrder.isPending ? 'Placing Order…' : 'Place Order'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
