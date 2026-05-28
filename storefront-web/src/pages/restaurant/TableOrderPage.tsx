import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { ChefHat, CheckCircle, Loader2, Minus, Plus, ShoppingCart, Trash2, UtensilsCrossed } from 'lucide-react'
import { restaurantApi } from '@/api/restaurant'
import type { GuestOrderItem, PublicMenuItem } from '@/api/restaurant'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

export default function TableOrderPage() {
  const { vendorSlug, qrToken } = useParams<{ vendorSlug: string; qrToken: string }>()
  const [cart, setCart] = useState<GuestOrderItem[]>([])
  const [guestName, setGuestName] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-restaurant', vendorSlug, qrToken],
    queryFn: () => restaurantApi.getTableMenu(vendorSlug!, qrToken!),
    enabled: !!vendorSlug && !!qrToken,
    retry: 1,
  })

  const submitOrder = useMutation({
    mutationFn: () => restaurantApi.submitGuestOrder(vendorSlug!, qrToken!, {
      items: cart,
      guest_name: guestName || undefined,
      notes: orderNotes || undefined,
    }),
    onSuccess: (result) => {
      setOrderId(result.order_id)
      setSubmitted(true)
      setCart([])
    },
  })

  function addItem(p: PublicMenuItem) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product_id === p.id)
      if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { product_id: p.id, name: p.name, qty: 1, unit_price: p.price }]
    })
  }

  function changeQty(productId: string, delta: number) {
    setCart(prev => prev.map(i => i.product_id === productId ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0))
  }

  const cartTotal = cart.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const categories = data?.menu ?? []
  const currentCat = activeCategory ?? categories[0]?.category ?? null

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4 p-6 text-center">
        <UtensilsCrossed className="w-12 h-12 text-gray-300" />
        <h1 className="text-xl font-bold text-gray-700">Table not found</h1>
        <p className="text-gray-500 text-sm">This QR code may be invalid or expired. Please ask your server for assistance.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-amber-50 gap-4 p-6 text-center">
        <CheckCircle className="w-16 h-16 text-emerald-500" />
        <h1 className="text-2xl font-bold text-gray-900">Order placed!</h1>
        <p className="text-gray-600">Your order has been sent to the kitchen.</p>
        <p className="text-sm text-gray-500">Table: <strong>{data.table.label}</strong></p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-4 px-6 py-2.5 rounded-full bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors"
        >
          Order more items
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <UtensilsCrossed className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">{data.vendor.name}</h1>
            <p className="text-sm text-gray-500">Table <strong>{data.table.label}</strong> · Dine-in menu</p>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      {categories.length > 1 && (
        <div className="bg-white border-b sticky top-[73px] z-10 overflow-x-auto flex gap-1 px-4 py-2 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat.category}
              type="button"
              onClick={() => setActiveCategory(cat.category)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                (activeCategory ?? categories[0].category) === cat.category
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.category}
            </button>
          ))}
        </div>
      )}

      {/* Menu */}
      <div className="flex-1 overflow-y-auto pb-40">
        {categories
          .filter(cat => !currentCat || cat.category === currentCat)
          .map(cat => (
            <div key={cat.category}>
              {categories.length > 1 && (
                <h2 className="px-4 pt-5 pb-2 text-xs font-bold uppercase tracking-widest text-amber-700">{cat.category}</h2>
              )}
              <div className="divide-y">
                {cat.items.filter(p => p.is_available).map(p => {
                  const cartItem = cart.find(i => i.product_id === p.id)
                  return (
                    <div key={p.id} className="flex items-center gap-3 bg-white px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                        {p.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.description}</p>}
                        <p className="text-sm font-bold text-amber-700 mt-1">{formatCurrency(p.price)}</p>
                      </div>
                      {cartItem ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <button type="button" onClick={() => changeQty(p.id, -1)} className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center hover:bg-amber-200">
                            <Minus className="w-4 h-4 text-amber-700" />
                          </button>
                          <span className="w-5 text-center font-bold text-sm">{cartItem.qty}</span>
                          <button type="button" onClick={() => changeQty(p.id, 1)} className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center hover:bg-amber-600">
                            <Plus className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => addItem(p)}
                          className="shrink-0 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center hover:bg-amber-600 transition-colors">
                          <Plus className="w-4 h-4 text-white" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
      </div>

      {/* Bottom cart */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t shadow-lg z-20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-amber-600" />
              {cartCount} item{cartCount !== 1 ? 's' : ''}
            </span>
            <span className="font-bold text-amber-700">{formatCurrency(cartTotal)}</span>
          </div>

          <input
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={orderNotes}
            onChange={e => setOrderNotes(e.target.value)}
            placeholder="Special instructions (optional)"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />

          <button
            type="button"
            disabled={submitOrder.isPending}
            onClick={() => submitOrder.mutate()}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-base flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {submitOrder.isPending
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Placing order…</>
              : <><ChefHat className="w-5 h-5" /> Place order</>}
          </button>

          {submitOrder.isError && (
            <p className="text-xs text-red-500 text-center">Could not place order. Please try again.</p>
          )}
        </div>
      )}
    </div>
  )
}
