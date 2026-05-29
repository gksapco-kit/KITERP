import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { useBuilderStore } from '../../store/useBuilderStore'

interface CheckoutWidgetProps {
  title?: string
  subtitle?: string
  interactive?: boolean
}

export function CheckoutWidget({ title = 'Checkout', subtitle, interactive = false }: CheckoutWidgetProps) {
  const cart = useBuilderStore((s) => s.cart)
  const clearCart = useBuilderStore((s) => s.clearCart)
  const [submitted, setSubmitted] = useState(false)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!interactive) return
    setSubmitted(true)
    clearCart()
  }

  if (submitted) {
    return (
      <section className="flex flex-col items-center py-12 text-center">
        <CheckCircle className="mb-4 h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-bold text-gray-900">Order Placed!</h2>
        <p className="mt-2 text-gray-600">Thank you for your order. We'll be in touch shortly.</p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="mb-2 text-3xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="mb-6 text-gray-600">{subtitle}</p>}

      <div className="grid gap-8 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
            <input
              required
              disabled={!interactive}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              required
              type="email"
              disabled={!interactive}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
            <input
              required
              disabled={!interactive}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="123 Main St, City"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Card Number</label>
            <input
              disabled={!interactive}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="•••• •••• •••• ••••"
            />
          </div>
          <button
            type="submit"
            disabled={!interactive || cart.length === 0}
            className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Place Order — ${total.toFixed(2)}
          </button>
        </form>

        <div className="rounded-xl bg-gray-50 p-6">
          <h3 className="mb-4 font-semibold text-gray-900">Order Summary</h3>
          {cart.length === 0 ? (
            <p className="text-sm text-gray-500">No items in cart</p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <hr className="border-gray-200" />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-brand-600">${total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
