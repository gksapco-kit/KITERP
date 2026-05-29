import { useState } from 'react'
import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react'
import { CART_DRAWER_DEFAULTS, CART_DRAWER_SIDE_CLASS } from '../../lib/cartDrawerDefaults'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block } from '../../types/builder'

interface CartDrawerBlockProps {
  block: Block
  interactive?: boolean
  onNavigate?: (slug: string) => void
}

export function CartDrawerBlock({ block, interactive = false, onNavigate }: CartDrawerBlockProps) {
  const { props, styles } = block
  const cart = useBuilderStore((s) => s.cart)
  const updateCartQuantity = useBuilderStore((s) => s.updateCartQuantity)
  const removeFromCart = useBuilderStore((s) => s.removeFromCart)
  const side = props.cartDrawerSide ?? CART_DRAWER_DEFAULTS.cartDrawerSide
  const theme = props.cartDrawerTheme ?? 'light'
  const showCheckout = props.showCartDrawerCheckout !== false
  const showSubtotal = props.showCartDrawerSubtotal !== false
  const [open, setOpen] = useState(props.cartDrawerPreviewOpen !== false)

  const count = cart.reduce((sum, item) => sum + item.quantity, 0)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const isDark = theme === 'dark'
  const sideClass = CART_DRAWER_SIDE_CLASS[side]
  const panelClass = isDark
    ? 'bg-gray-950 text-white border-white/10'
    : 'bg-white text-gray-900 border-gray-200 dark:bg-gray-900 dark:text-white dark:border-gray-700'

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md ${
        isDark ? 'bg-gray-800 text-white' : 'bg-brand-600 text-white'
      }`}
    >
      <ShoppingCart className="h-4 w-4" />
      {props.buttonText ?? 'Cart'}
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-brand-600">
          {count}
        </span>
      )}
    </button>
  )

  const panelInner = (
    <aside
      className={`flex h-full w-[min(380px,90vw)] flex-col border shadow-2xl ${panelClass}`}
      style={{ borderRadius: styles.borderRadius }}
    >
      <div className="flex items-center justify-between border-b border-inherit px-5 py-4">
        <div>
          <p className="font-semibold">{props.text ?? 'Your cart'}</p>
          {props.subtitle && <p className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'}`}>{props.subtitle}</p>}
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 opacity-70 hover:opacity-100" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <ShoppingCart className={`mb-3 h-10 w-10 ${isDark ? 'text-white/30' : 'text-gray-300'}`} />
            <p className={`text-sm ${isDark ? 'text-white/70' : 'text-gray-500'}`}>Your cart is empty</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {cart.map((item) => (
              <li key={item.id} className={`flex gap-3 rounded-xl border p-3 ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
                <img src={item.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-sm font-semibold text-brand-600">${item.price.toFixed(2)}</p>
                  {interactive ? (
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="rounded border p-1">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-xs">{item.quantity}</span>
                      <button type="button" onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="rounded border p-1">
                        <Plus className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => removeFromCart(item.id)} className="ml-auto text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <p className={`mt-1 text-xs ${isDark ? 'text-white/50' : 'text-gray-400'}`}>Qty {item.quantity}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cart.length > 0 && (
        <div className="border-t border-inherit p-4">
          {showSubtotal && (
            <div className="mb-3 flex items-center justify-between">
              <span className={`text-sm ${isDark ? 'text-white/70' : 'text-gray-600'}`}>Subtotal</span>
              <span className="text-lg font-bold">${total.toFixed(2)}</span>
            </div>
          )}
          {showCheckout && (
            <button
              type="button"
              onClick={() => {
                if (interactive && onNavigate) onNavigate('checkout')
              }}
              className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white"
            >
              {props.buttonText2 ?? 'Checkout'}
            </button>
          )}
        </div>
      )}
    </aside>
  )

  if (interactive) {
    return (
      <div className="pointer-events-none h-0 overflow-visible">
        <div className="pointer-events-auto">{trigger}</div>
        {open && (
          <>
            <div className="pointer-events-auto fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
            <div className={`pointer-events-auto fixed top-0 z-[95] h-full ${sideClass}`}>{panelInner}</div>
          </>
        )}
      </div>
    )
  }

  return (
    <div
      className="relative min-h-[320px] overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-900/40"
      style={{ margin: styles.margin }}
    >
      <div className="relative z-10 flex items-start p-4">{trigger}</div>
      {open && (
        <>
          <div className="absolute inset-0 z-20 bg-black/30" onClick={() => setOpen(false)} aria-hidden />
          <div className={`absolute top-0 z-30 h-full ${sideClass}`}>{panelInner}</div>
        </>
      )}
      <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-gray-400">Cart drawer slides from {side}</p>
    </div>
  )
}
