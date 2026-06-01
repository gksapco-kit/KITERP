import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ChefHat, Loader2, Minus, Plus, Receipt,
  Search, Send, Trash2, UtensilsCrossed, XCircle,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import type { RestaurantOrderItem, SelectedModifier } from '@/api/vendor'
import { ModifierPickerModal, type ModifierPickerProduct } from '@/components/products/ModifierPickerModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from 'sonner'

const KOT_STATUS_COLOR: Record<string, string> = {
  new:       'bg-blue-100 text-blue-700',
  preparing: 'bg-amber-100 text-amber-800',
  ready:     'bg-emerald-100 text-emerald-800',
  done:      'bg-gray-100 text-gray-600',
}

function lineTotal(item: RestaurantOrderItem): number {
  const extra = (item.modifiers ?? []).reduce((s, m) => s + m.price_delta, 0)
  return (item.unit_price + extra) * item.qty
}

function mergePendingItem(
  prev: RestaurantOrderItem[],
  item: RestaurantOrderItem,
): RestaurantOrderItem[] {
  const modsKey = JSON.stringify(item.modifiers ?? [])
  const idx = prev.findIndex(
    i => i.product_id === item.product_id && JSON.stringify(i.modifiers ?? []) === modsKey,
  )
  if (idx >= 0) {
    return prev.map((i, n) => (n === idx ? { ...i, qty: i.qty + item.qty } : i))
  }
  return [...prev, item]
}

export default function RestaurantOrderPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [productSearch, setProductSearch] = useState('')
  const [pendingItems, setPendingItems] = useState<RestaurantOrderItem[]>([])
  const [kotNotes, setKotNotes] = useState('')
  const [modifierPending, setModifierPending] = useState<ModifierPickerProduct | null>(null)

  const orderQ = useQuery({
    queryKey: ['restaurant', 'order', orderId],
    queryFn: () => vendorApi.restaurantGetOrder(orderId!),
    enabled: !!orderId,
    refetchInterval: 5_000,
  })

  const productsQ = useQuery({
    queryKey: ['restaurant', 'dine-in-products', productSearch],
    queryFn: async () => {
      const all = await vendorApi.restaurantListDineInProducts()
      const q = productSearch.trim().toLowerCase()
      if (!q) return all
      return {
        items: all.items.filter(
          p =>
            p.name?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q),
        ),
      }
    },
    staleTime: 60_000,
  })

  const order = orderQ.data

  const allItems = [...(order?.items ?? []), ...pendingItems]
  const subtotal = allItems.reduce((s, i) => s + lineTotal(i), 0)

  function addProductLine(line: RestaurantOrderItem) {
    setPendingItems(prev => mergePendingItem(prev, line))
    setProductSearch('')
  }

  function handleProductTap(p: {
    id: string
    name: string
    price?: number
    tax_rate?: number
    item_type?: string
  }) {
    const base: ModifierPickerProduct = {
      id: p.id,
      name: p.name,
      price: Number(p.price ?? 0),
      tax_rate: Number(p.tax_rate ?? 0),
      item_type: (p.item_type === 'service' ? 'service' : 'product') as 'product' | 'service',
    }
    setModifierPending(base)
  }

  function onModifierConfirm(
    item: ModifierPickerProduct & { modifiers: SelectedModifier[] },
  ) {
    const extra = item.modifiers.reduce((s, m) => s + m.price_delta, 0)
    addProductLine({
      product_id: item.id,
      name: item.name,
      qty: 1,
      unit_price: item.price,
      tax_rate: item.tax_rate ?? 0,
      item_type: item.item_type,
      modifiers: item.modifiers.length ? item.modifiers : undefined,
    })
    if (extra > 0) {
      toast.success(`Added with ${formatCurrency(extra)} in extras`)
    }
    setModifierPending(null)
  }

  function changePendingQty(idx: number, delta: number) {
    setPendingItems(prev => {
      const updated = prev.map((item, i) => (i === idx ? { ...item, qty: item.qty + delta } : item))
      return updated.filter(i => i.qty > 0)
    })
  }

  const sendKOT = useMutation({
    mutationFn: () =>
      vendorApi.restaurantSendKOT(orderId!, {
        items: pendingItems,
        notes: kotNotes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'order', orderId] })
      qc.invalidateQueries({ queryKey: ['restaurant', 'kots'] })
      setPendingItems([])
      setKotNotes('')
      toast.success('KOT sent to kitchen')
    },
    onError: () => toast.error('Could not send KOT'),
  })

  const requestBill = useMutation({
    mutationFn: () => vendorApi.restaurantRequestBill(orderId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'order', orderId] })
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] })
      if (order) {
        const params = new URLSearchParams({
          table: order.table_id ?? '',
          order: orderId!,
        })
        navigate(`/pos?${params.toString()}`)
      }
    },
    onError: () => toast.error('Could not request bill'),
  })

  const voidOrder = useMutation({
    mutationFn: () => vendorApi.restaurantVoidOrder(orderId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant'] })
      toast.success('Order voided')
      navigate('/restaurant/floor')
    },
    onError: () => toast.error('Could not void order'),
  })

  if (orderQ.isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 text-gray-500">
        Order not found.{' '}
        <Link to="/restaurant/floor" className="text-primary underline">Back to floor</Link>
      </div>
    )
  }

  const isClosed = order.status === 'closed' || order.status === 'voided'
  const pendingQty = pendingItems.reduce((s, i) => s + i.qty, 0)

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/restaurant/floor"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-amber-600" />
              Table {order.table_label ?? '—'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {order.covers} cover{order.covers !== 1 ? 's' : ''}
              {order.server_name ? ` · ${order.server_name}` : ''}
              <span className={cn('ml-2 px-2 py-0.5 rounded-full text-xs font-semibold inline-block', {
                'bg-blue-100 text-blue-700': order.status === 'open',
                'bg-red-100 text-red-700': order.status === 'billed',
                'bg-gray-100 text-gray-600': isClosed,
              })}>
                {order.status}
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/kitchen"><ChefHat className="w-4 h-4 mr-1" />Kitchen</Link>
          </Button>
          {!isClosed && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700"
              disabled={voidOrder.isPending}
              onClick={() => { if (confirm('Void this order?')) voidOrder.mutate() }}
            >
              <XCircle className="w-4 h-4 mr-1" /> Void
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
        <div className="space-y-4">
          {!isClosed && (
            <section className="rounded-xl border bg-white p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">Add items</h2>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Search products…"
                  className="pl-9 h-9 text-sm"
                />
              </div>

              {productsQ.isLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
              {productsQ.data && (
                <ul className="divide-y rounded-lg border max-h-56 overflow-y-auto">
                  {productsQ.data.items.length === 0 && (
                    <li className="px-3 py-4 text-sm text-gray-400 text-center">No active products found.</li>
                  )}
                  {productsQ.data.items.map(p => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-amber-50 active:bg-amber-100 text-left"
                        onClick={() => handleProductTap({
                          id: p.id,
                          name: p.name,
                          price: Number(p.price ?? 0),
                          tax_rate: Number(p.tax_rate ?? 0),
                          item_type: 'product',
                        })}
                      >
                        <span className="text-gray-800 flex-1 min-w-0 truncate">{p.name}</span>
                        <span className="text-gray-500 shrink-0 ml-3 font-medium">{formatCurrency(Number(p.price ?? 0))}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-2 pt-1">
                <h3 className="text-xs text-amber-700 font-semibold uppercase tracking-wide">
                  Pending (not yet sent)
                </h3>
                {pendingItems.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">Tap a product above to add items.</p>
                ) : (
                  pendingItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <div className="flex-1 text-gray-800">
                        {item.name}
                        {(item.modifiers ?? []).length > 0 && (
                          <span className="block text-xs text-gray-500">
                            {(item.modifiers ?? []).map(m => m.option_name).join(', ')}
                          </span>
                        )}
                      </div>
                      <div className="text-gray-500 text-xs">{formatCurrency(lineTotal(item) / item.qty)}/ea</div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => changePendingQty(idx, -1)} className="p-1 text-gray-400 hover:text-gray-700">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center font-semibold">{item.qty}</span>
                        <button type="button" onClick={() => changePendingQty(idx, 1)} className="p-1 text-gray-400 hover:text-gray-700">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={() => setPendingItems(p => p.filter((_, i) => i !== idx))} className="p-1 text-gray-400 hover:text-red-500 ml-1">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
                <Input
                  value={kotNotes}
                  onChange={e => setKotNotes(e.target.value)}
                  placeholder="KOT notes (optional)"
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  className="w-full gap-2"
                  disabled={pendingQty === 0 || sendKOT.isPending}
                  title={pendingQty === 0 ? 'Add items before sending to kitchen' : undefined}
                  onClick={() => sendKOT.mutate()}
                >
                  {sendKOT.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send to Kitchen ({pendingQty} item{pendingQty !== 1 ? 's' : ''})
                </Button>
              </div>
            </section>
          )}

          {order.kots.length > 0 && (
            <section className="rounded-xl border bg-white p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">Kitchen Orders</h2>
              {order.kots.map(kot => (
                <div key={kot.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-gray-500">KOT #{kot.kot_number}</span>
                    <span className={cn('px-2 py-0.5 rounded-full font-semibold uppercase', KOT_STATUS_COLOR[kot.status] ?? 'bg-gray-100')}>
                      {kot.status}
                    </span>
                  </div>
                  <ul className="text-sm text-gray-700 space-y-0.5">
                    {kot.items.map((item, i) => (
                      <li key={i} className="flex justify-between">
                        <span>{item.qty}× {item.name}</span>
                        <span className="text-gray-400">{formatCurrency(lineTotal(item))}</span>
                      </li>
                    ))}
                  </ul>
                  {kot.notes && <p className="text-xs text-gray-500 italic">{kot.notes}</p>}
                </div>
              ))}
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border bg-white p-4 space-y-3 sticky top-4">
            <h2 className="text-sm font-semibold text-gray-700">Order Summary</h2>

            {order.items.length === 0 && pendingItems.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No items yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {order.items.map((item, i) => (
                  <li key={i} className="flex justify-between py-1.5 text-gray-700">
                    <span>
                      {item.qty}× {item.name}
                      {(item.modifiers ?? []).length > 0 && (
                        <span className="block text-xs text-gray-400">
                          {(item.modifiers ?? []).map(m => m.option_name).join(', ')}
                        </span>
                      )}
                    </span>
                    <span>{formatCurrency(lineTotal(item))}</span>
                  </li>
                ))}
                {pendingItems.map((item, i) => (
                  <li key={`p-${i}`} className="flex justify-between py-1.5 text-amber-700">
                    <span className="italic">{item.qty}× {item.name} (unsent)</span>
                    <span>{formatCurrency(lineTotal(item))}</span>
                  </li>
                ))}
              </ul>
            )}

            {(order.items.length > 0 || pendingItems.length > 0) && (
              <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t">
                <span>Total</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
            )}

            {!isClosed && order.status !== 'billed' && (
              <Button
                className="w-full gap-2"
                disabled={requestBill.isPending || (order.items.length === 0 && order.kots.length === 0)}
                onClick={() => requestBill.mutate()}
              >
                {requestBill.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                Request Bill & Checkout
              </Button>
            )}

            {order.status === 'billed' && (
              <Button
                className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
                onClick={() => {
                  const params = new URLSearchParams({ table: order.table_id ?? '', order: orderId! })
                  navigate(`/pos?${params.toString()}`)
                }}
              >
                <Receipt className="w-4 h-4" /> Open POS for checkout
              </Button>
            )}

            {isClosed && (
              <div className="text-center text-sm text-gray-500 py-2">
                Order {order.status}.
              </div>
            )}
          </section>
        </div>
      </div>

      {modifierPending && (
        <ModifierPickerModal
          item={modifierPending}
          confirmLabel="Add to order"
          onConfirm={onModifierConfirm}
          onClose={() => setModifierPending(null)}
        />
      )}
    </div>
  )
}
