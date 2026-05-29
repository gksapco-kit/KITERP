import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useBuilderStore } from '../../store/useBuilderStore'

interface CartWidgetProps {
  title?: string
  subtitle?: string
  interactive?: boolean
  onCheckout?: () => void
}

export function CartWidget({ title = 'Your Cart', subtitle, interactive = false, onCheckout }: CartWidgetProps) {
  const cart = useBuilderStore((s) => s.cart)
  const updateCartQuantity = useBuilderStore((s) => s.updateCartQuantity)
  const removeFromCart = useBuilderStore((s) => s.removeFromCart)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <section>
      <h2 className="mb-2 text-3xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="mb-6 text-gray-600">{subtitle}</p>}

      {cart.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <ShoppingCart className="mb-4 h-12 w-12 text-gray-300" />
          <p className="font-medium text-gray-500">Your cart is empty</p>
          <p className="mt-1 text-sm text-gray-400">Add products or services to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cart.map((item) => (
            <div key={item.id} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <img src={item.imageUrl} alt={item.name} className="h-16 w-16 rounded-lg object-cover" />
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{item.name}</h3>
                <p className="text-sm capitalize text-gray-500">{item.itemType}</p>
                <p className="mt-1 font-semibold text-brand-600">${item.price}</p>
              </div>
              {interactive ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                    className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                    className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="ml-2 rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <span className="text-sm text-gray-500">×{item.quantity}</span>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
            <span className="text-lg font-semibold text-gray-900">Total</span>
            <span className="text-2xl font-bold text-brand-600">${total.toFixed(2)}</span>
          </div>
          {interactive && (
            <button
              type="button"
              onClick={onCheckout}
              className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Proceed to Checkout
            </button>
          )}
        </div>
      )}
    </section>
  )
}
