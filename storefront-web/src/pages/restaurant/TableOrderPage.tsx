import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ChefHat, CheckCircle, Loader2, Minus, Plus, ShoppingCart, Trash2, UtensilsCrossed, X } from 'lucide-react'
import {
  restaurantApi,
  type GuestOrderItem,
  type GuestOrderModifier,
  type PublicMenuItem,
  type PublicModifierGroup,
} from '@/api/restaurant'
import { PhoneInput } from '@/components/ui/PhoneInput'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

function lineUnitPrice(base: number, modifiers: GuestOrderModifier[]): number {
  return base + modifiers.reduce((s, m) => s + m.price_delta, 0)
}

function GuestModifierModal({
  product,
  onConfirm,
  onClose,
}: {
  product: PublicMenuItem
  onConfirm: (item: GuestOrderItem) => void
  onClose: () => void
}) {
  const groups = (product.modifier_groups ?? []).filter(g => g.options?.length)
  const [selected, setSelected] = useState<Record<string, Set<string>>>({})

  useEffect(() => {
    const defaults: Record<string, Set<string>> = {}
    for (const g of groups) {
      const defs = g.options.filter(o => o.is_default)
      if (defs.length) defaults[g.id] = new Set(defs.map(o => o.id))
    }
    setSelected(defaults)
  }, [product.id])

  function toggle(g: PublicModifierGroup, optionId: string) {
    setSelected(prev => {
      const cur = new Set(prev[g.id] ?? [])
      if (g.selection_type === 'single') return { ...prev, [g.id]: new Set([optionId]) }
      if (cur.has(optionId)) cur.delete(optionId)
      else cur.add(optionId)
      return { ...prev, [g.id]: cur }
    })
  }

  function buildModifiers(): GuestOrderModifier[] {
    const out: GuestOrderModifier[] = []
    for (const g of groups) {
      const ids = selected[g.id] ?? new Set()
      for (const opt of g.options) {
        if (ids.has(opt.id)) {
          out.push({
            group_id: g.id,
            group_name: g.name,
            option_id: opt.id,
            option_name: opt.name,
            price_delta: opt.price_delta,
          })
        }
      }
    }
    return out
  }

  function isValid() {
    for (const g of groups) {
      if (g.is_required) {
        const count = selected[g.id]?.size ?? 0
        if (count < (g.min_select || 1)) return false
      }
    }
    return true
  }

  const mods = buildModifiers()
  const total = lineUnitPrice(product.price, mods)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">{product.name}</h3>
            <p className="text-xs text-gray-500">Customise your order</p>
          </div>
          <button type="button" onClick={onClose} className="p-1"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {groups.map(g => (
            <div key={g.id}>
              <p className="text-sm font-semibold text-gray-800 mb-2">
                {g.name}
                <span className="text-xs font-normal text-gray-400 ml-1">
                  {g.is_required ? '(required)' : '(optional)'}
                </span>
              </p>
              <div className="space-y-1.5">
                {g.options.map(opt => {
                  const checked = selected[g.id]?.has(opt.id) ?? false
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggle(g, opt.id)}
                      className={`w-full flex justify-between px-3 py-2 rounded-lg border text-sm ${
                        checked ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-gray-200'
                      }`}
                    >
                      <span>{opt.name}</span>
                      <span className="text-xs">
                        {opt.price_delta > 0 ? `+${formatCurrency(opt.price_delta)}` : 'free'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t p-4">
          <button
            type="button"
            disabled={!isValid()}
            onClick={() =>
              onConfirm({
                product_id: product.id,
                name: product.name,
                qty: 1,
                unit_price: total,
                modifiers: mods.length ? mods : undefined,
              })
            }
            className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold disabled:opacity-50"
          >
            Add · {formatCurrency(total)}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TableOrderPage() {
  const { vendorSlug, qrToken } = useParams<{ vendorSlug: string; qrToken: string }>()
  const [cart, setCart] = useState<GuestOrderItem[]>([])
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [modifierProduct, setModifierProduct] = useState<PublicMenuItem | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-restaurant', vendorSlug, qrToken],
    queryFn: () => restaurantApi.getTableMenu(vendorSlug!, qrToken!),
    enabled: !!vendorSlug && !!qrToken,
    retry: 1,
  })

  const submitOrder = useMutation({
    mutationFn: () =>
      restaurantApi.submitGuestOrder(vendorSlug!, qrToken!, {
        items: cart,
        guest_name: guestName || undefined,
        guest_phone: guestPhone || undefined,
        notes: orderNotes || undefined,
      }),
    onSuccess: () => {
      setSubmitted(true)
      setCart([])
    },
  })

  function cartKey(item: GuestOrderItem): string {
    return `${item.product_id}:${JSON.stringify(item.modifiers ?? [])}`
  }

  function addToCart(item: GuestOrderItem) {
    setCart(prev => {
      const key = cartKey(item)
      const idx = prev.findIndex(i => cartKey(i) === key)
      if (idx >= 0) {
        return prev.map((i, n) => (n === idx ? { ...i, qty: i.qty + 1 } : i))
      }
      return [...prev, item]
    })
  }

  function handleProductTap(p: PublicMenuItem) {
    const hasMods = (p.modifier_groups ?? []).some(g => g.options?.length)
    if (hasMods) {
      setModifierProduct(p)
    } else {
      addToCart({ product_id: p.id, name: p.name, qty: 1, unit_price: p.price })
    }
  }

  function changeQty(key: string, delta: number) {
    setCart(prev =>
      prev
        .map(i => (cartKey(i) === key ? { ...i, qty: i.qty + delta } : i))
        .filter(i => i.qty > 0),
    )
  }

  const cartTotal = cart.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const categories = data?.menu ?? []
  const currentCat = activeCategory ?? categories[0]?.category ?? null

  const DIET_LABELS: Record<string, { icon: string; label: string; className: string }> = {
    veg: { icon: '🟢', label: 'Veg', className: 'bg-green-50 text-green-700 border-green-200' },
    vegan: { icon: '🌱', label: 'Vegan', className: 'bg-green-50 text-green-700 border-green-200' },
    'gluten-free': { icon: 'GF', label: 'Gluten-free', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    gf: { icon: 'GF', label: 'Gluten-free', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    spicy: { icon: '🌶', label: 'Spicy', className: 'bg-red-50 text-red-600 border-red-200' },
    nuts: { icon: 'N', label: 'Contains nuts', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    dairy: { icon: 'D', label: 'Contains dairy', className: 'bg-blue-50 text-blue-600 border-blue-200' },
    halal: { icon: 'H', label: 'Halal', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    jain: { icon: 'J', label: 'Jain', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  }

  function renderMenuItems(items: PublicMenuItem[]) {
    return items.map(p => {
      const unavailable = !p.is_available
      const lowStock = p.stock_status === 'low_stock'
      const cartItem = cart.find(i => i.product_id === p.id && !(i.modifiers?.length))
      const qtyInCart = cart.filter(i => i.product_id === p.id).reduce((s, i) => s + i.qty, 0)
      const knownDietTags = (p.tags ?? []).map(t => t.toLowerCase()).filter(t => t in DIET_LABELS)
      return (
        <div key={p.id} className={`flex items-center gap-3 bg-white px-4 py-3 ${unavailable ? 'opacity-50' : ''}`}>
          {p.image_url && (
            <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-gray-100">
              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-medium text-gray-900 text-sm">{p.name}</p>
              {knownDietTags.map(tag => {
                const info = DIET_LABELS[tag]
                return (
                  <span key={tag} title={info.label} className={`text-[10px] font-semibold border rounded px-1 py-0.5 leading-none ${info.className}`}>
                    {info.icon}
                  </span>
                )
              })}
              {lowStock && !unavailable && (
                <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">
                  Low stock
                </span>
              )}
              {unavailable && (
                <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded px-1 py-0.5 leading-none">
                  Unavailable
                </span>
              )}
            </div>
            {p.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.description}</p>}
            <p className="text-sm font-bold text-amber-700 mt-1">
              {formatCurrency(p.price)}
              {(p.modifier_groups?.length ?? 0) > 0 && (
                <span className="text-xs font-normal text-gray-400 ml-1">· options</span>
              )}
            </p>
          </div>
          {!unavailable && (
            qtyInCart > 0 && !cartItem ? (
              <span className="text-xs font-semibold text-amber-700 shrink-0">{qtyInCart} in cart</span>
            ) : cartItem ? (
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => changeQty(cartKey(cartItem), -1)} className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <Minus className="w-4 h-4 text-amber-700" />
                </button>
                <span className="w-5 text-center font-bold text-sm">{cartItem.qty}</span>
                <button type="button" onClick={() => changeQty(cartKey(cartItem), 1)} className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => handleProductTap(p)} className="shrink-0 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center hover:bg-amber-600">
                <Plus className="w-4 h-4 text-white" />
              </button>
            )
          )}
        </div>
      )
    })
  }

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
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <UtensilsCrossed className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">{data.vendor.name}</h1>
            <p className="text-sm text-gray-500">Table <strong>{data.table.label}</strong> · Dine-in menu</p>
          </div>
        </div>
      </div>

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

      <div className="flex-1 overflow-y-auto pb-40">
        {categories
          .filter(cat => !currentCat || cat.category === currentCat)
          .map(cat => (
            <div key={cat.category}>
              {categories.length > 1 && (
                <h2 className="px-4 pt-5 pb-2 text-xs font-bold uppercase tracking-widest text-amber-700">{cat.category}</h2>
              )}
              {(cat.subcategories || []).map(sub => (
                <div key={`${cat.category}-${sub.name}`}>
                  <h3 className="px-4 pt-4 pb-1 text-sm font-semibold text-gray-800">{sub.name}</h3>
                  <div className="divide-y">{renderMenuItems(sub.items)}</div>
                </div>
              ))}
              {cat.items.length > 0 && (
                <div className="divide-y">{renderMenuItems(cat.items)}</div>
              )}
            </div>
          ))}
      </div>

      {cartCount > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t shadow-lg z-20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-amber-600" />
              {cartCount} item{cartCount !== 1 ? 's' : ''}
            </span>
            <span className="font-bold text-amber-700">{formatCurrency(cartTotal)}</span>
          </div>
          <ul className="text-xs text-gray-600 max-h-20 overflow-y-auto space-y-0.5">
            {cart.map(i => (
              <li key={cartKey(i)} className="flex justify-between gap-2">
                <span className="truncate">{i.qty}× {i.name}</span>
                <span>{formatCurrency(i.qty * i.unit_price)}</span>
              </li>
            ))}
          </ul>
          <input
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <PhoneInput
            value={guestPhone}
            onChange={setGuestPhone}
            defaultCountryIso="IN"
            autoComplete="tel"
            name="guest_phone"
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
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitOrder.isPending ? <><Loader2 className="w-5 h-5 animate-spin" /> Placing order…</> : <><ChefHat className="w-5 h-5" /> Place order</>}
          </button>
          {submitOrder.isError && (
            <p className="text-xs text-red-500 text-center">Could not place order. Please try again.</p>
          )}
        </div>
      )}

      {modifierProduct && (
        <GuestModifierModal
          product={modifierProduct}
          onConfirm={item => {
            addToCart(item)
            setModifierProduct(null)
          }}
          onClose={() => setModifierProduct(null)}
        />
      )}
    </div>
  )
}
