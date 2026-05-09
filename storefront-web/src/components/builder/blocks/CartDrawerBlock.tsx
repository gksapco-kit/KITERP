import { useEffect, useState } from 'react'
import { ShoppingCart, X, Minus, Plus, Trash2 } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { useAuthStore } from '@/stores/authStore'
import { useCart, useUpdateCartItem, useRemoveCartItem } from '@/hooks/useStore'
import { useVendor } from '@/contexts/VendorContext'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
}

/**
 * Cart Drawer — a slide-out panel that mirrors the global cart store.
 *
 * Behaviour:
 *  - Trigger: a small floating cart button at bottom-right that's hidden when
 *    the cart is empty (so we never ship an empty drawer block on a fresh
 *    visitor's first paint).
 *  - Listens for the `kiterp:open-cart` custom event so other blocks
 *    (Add to cart buttons, ProductDetailBlock) can pop it open.
 *  - Quantity changes / removes go through the existing `useStore` mutations
 *    so any cart subtotal reactivity is preserved.
 *  - Optional upsell strip pulls the site's existing live `featured products`
 *    via the `liveItems` prop fed by BlockRenderer's `related_products`-style
 *    auto source (we list the first 3 not already in the cart).
 */
export default function CartDrawerBlock({ style, props, liveItems }: Props) {
  const showUpsells = props.show_upsells !== false
  const title = (props.title as string) || 'Your Cart'

  const { cart } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  useCart()
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveCartItem()
  const { storePath } = useVendor()

  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('kiterp:open-cart', onOpen)
    return () => window.removeEventListener('kiterp:open-cart', onOpen)
  }, [])

  const itemCount = cart?.items?.reduce((acc, i) => acc + i.qty, 0) ?? 0
  const inCartIds = new Set((cart?.items || []).map(i => i.product_id))
  const upsells = showUpsells
    ? liveItems.filter(p => p.id && !inCartIds.has(p.id)).slice(0, 3)
    : []

  if (!isAuthenticated) {
    // We never want to render the drawer floating button for guests — they'll
    // hit the cart on /login first. We still listen for the open event so an
    // upstream "Sign in to view cart" hint can be triggered later.
    return null
  }

  return (
    <>
      {itemCount > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open cart"
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full text-white shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
          style={{ backgroundColor: style.primary_color }}
        >
          <ShoppingCart className="w-6 h-6" aria-hidden="true" />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
            {itemCount}
          </span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-label={title}>
          <button
            type="button"
            aria-label="Close cart"
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <header className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-base font-bold" style={{ color: style.text_color }}>
                {title} {itemCount > 0 && <span className="text-gray-400 font-normal">({itemCount})</span>}
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 rounded-md hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              {!cart || cart.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mb-3" aria-hidden="true" />
                  <p className="text-sm text-gray-500">Your cart is empty.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 list-none p-0 m-0">
                  {cart.items.map((item, idx) => (
                    <li key={`${item.product_id}-${idx}`} className="flex gap-3 px-5 py-4">
                      <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2" style={{ color: style.text_color }}>
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {Number(item.price || 0).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            disabled={item.qty <= 1 || updateItem.isPending}
                            onClick={() => updateItem.mutate({ index: idx, qty: item.qty - 1 })}
                            className="w-7 h-7 inline-flex items-center justify-center border rounded hover:bg-gray-50 disabled:opacity-40"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-sm tabular-nums">{item.qty}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            disabled={updateItem.isPending}
                            onClick={() => updateItem.mutate({ index: idx, qty: item.qty + 1 })}
                            className="w-7 h-7 inline-flex items-center justify-center border rounded hover:bg-gray-50 disabled:opacity-40"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Remove item"
                            disabled={removeItem.isPending}
                            onClick={() => removeItem.mutate(idx)}
                            className="ml-auto p-1.5 rounded hover:bg-red-50 text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {upsells.length > 0 && cart && cart.items.length > 0 && (
                <div className="border-t px-5 py-4">
                  <h3 className="text-xs font-bold tracking-wide text-gray-500 uppercase mb-3">You may also like</h3>
                  <ul className="space-y-3 list-none p-0 m-0">
                    {upsells.map(item => (
                      <li key={item.id || item.title}>
                        <a href={item.url || '#'} className="flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded-md">
                          <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden shrink-0">
                            {item.image_url && <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            {item.price_formatted && <p className="text-xs text-gray-500">{item.price_formatted}</p>}
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {cart && cart.items.length > 0 && (
              <footer className="border-t px-5 py-4 space-y-3 bg-gray-50">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-bold" style={{ color: style.text_color }}>
                    {Number(cart.subtotal || 0).toLocaleString()}
                  </span>
                </div>
                <a
                  href={storePath('/checkout')}
                  className="block w-full py-3 text-sm font-bold rounded-xl text-white text-center"
                  style={{ backgroundColor: style.primary_color }}
                >
                  Checkout
                </a>
                <a
                  href={storePath('/cart')}
                  className="block w-full text-center text-xs text-gray-500 hover:underline"
                >
                  View full cart
                </a>
              </footer>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
