import { ShoppingCart } from 'lucide-react'
import { useBuilderStore } from '../../store/useBuilderStore'

export function MiniCartWidget() {
  const cart = useBuilderStore((s) => s.cart)
  const count = cart.reduce((sum, item) => sum + item.quantity, 0)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm">
      <div className="relative">
        <ShoppingCart className="h-5 w-5 text-gray-700" />
        {count > 0 && (
          <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </div>
      <span className="text-sm font-medium text-gray-700">
        {count === 0 ? 'Cart empty' : `$${total.toFixed(2)}`}
      </span>
    </div>
  )
}
