import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Banknote, ChefHat, CreditCard, Loader2, Plus, Receipt, RefreshCw,
  Search, Send, ShoppingCart, Smartphone, Split, Store, Trash2,
  UtensilsCrossed, Users, X,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import type {
  RestaurantOrder, RestaurantOrderItem, RestaurantOrderAdjustments, SelectedModifier,
} from '@/api/vendor'
import { ModifierPickerModal, type ModifierPickerProduct } from '@/components/products/ModifierPickerModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRestaurantStore } from '@/stores/restaurantStore'

type PayMethod = 'cash' | 'upi' | 'card' | 'split'

interface PosSession {
  id: string
  [key: string]: unknown
}

const STATUS_BADGE: Record<string, string> = {
  open:   'bg-blue-100 text-blue-700',
  billed: 'bg-red-100 text-red-700',
  closed: 'bg-gray-100 text-gray-600',
}

function itemUnitPrice(item: RestaurantOrderItem): number {
  const extra = (item.modifiers ?? []).reduce((s, m) => s + m.price_delta, 0)
  return item.unit_price + extra
}

function lineTotal(item: RestaurantOrderItem): number {
  return itemUnitPrice(item) * item.qty
}

/** Mirror of the POS total computation so the cashier sees the same charge. */
function computeTotals(items: RestaurantOrderItem[], adj: RestaurantOrderAdjustments) {
  const lines = items.map(i => ({ base: lineTotal(i), rate: i.tax_rate ?? 0 }))
  const subtotal = lines.reduce((s, l) => s + l.base, 0)
  const sc = subtotal * (adj.service_charge_pct ?? 0) / 100
  const tip = adj.tip_amount ?? 0
  const discount = adj.discount_pct
    ? subtotal * adj.discount_pct / 100
    : (adj.discount_amount ?? 0)
  const totalTax = lines.reduce((s, l) => {
    const proportion = subtotal > 0 ? l.base / subtotal : (lines.length ? 1 / lines.length : 0)
    const share = discount * proportion
    const taxable = Math.max(0, l.base - share)
    return s + taxable * (l.rate / 100)
  }, 0)
  const grandTotal = Math.max(0, Math.round((subtotal - discount + totalTax + sc + tip) * 100) / 100)
  return { subtotal, sc, tip, discount, totalTax, grandTotal }
}

function mergePendingItem(prev: RestaurantOrderItem[], item: RestaurantOrderItem): RestaurantOrderItem[] {
  const modsKey = JSON.stringify(item.modifiers ?? [])
  const idx = prev.findIndex(
    i => i.product_id === item.product_id && JSON.stringify(i.modifiers ?? []) === modsKey,
  )
  if (idx >= 0) return prev.map((i, n) => (n === idx ? { ...i, qty: i.qty + item.qty } : i))
  return [...prev, item]
}

// ── Payment panel ───────────────────────────────────────────────────────────
function PaymentPanel({
  grandTotal,
  disabled,
  charging,
  onCharge,
}: {
  grandTotal: number
  disabled?: boolean
  charging: boolean
  onCharge: (payments: { method: string; amount: number }[], cashReceived: number) => void
}) {
  const [method, setMethod] = useState<PayMethod>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [splitCash, setSplitCash] = useState('')
  const [splitUpi, setSplitUpi] = useState('')
  const [splitCard, setSplitCard] = useState('')

  const cash = parseFloat(cashReceived) || 0
  const changeDue = method === 'cash' ? Math.max(0, cash - grandTotal) : 0
  const splitSum = (parseFloat(splitCash) || 0) + (parseFloat(splitUpi) || 0) + (parseFloat(splitCard) || 0)

  const methods: { key: PayMethod; icon: typeof Banknote; label: string; color: string }[] = [
    { key: 'cash', icon: Banknote, label: 'Cash', color: 'text-green-600' },
    { key: 'upi', icon: Smartphone, label: 'UPI', color: 'text-primary' },
    { key: 'card', icon: CreditCard, label: 'Card', color: 'text-blue-600' },
    { key: 'split', icon: Split, label: 'Split', color: 'text-amber-600' },
  ]

  function handleCharge() {
    let payments: { method: string; amount: number }[]
    let cashRcvd = 0
    if (method === 'split') {
      payments = []
      if (parseFloat(splitCash) > 0) payments.push({ method: 'cash', amount: parseFloat(splitCash) })
      if (parseFloat(splitUpi) > 0) payments.push({ method: 'upi', amount: parseFloat(splitUpi) })
      if (parseFloat(splitCard) > 0) payments.push({ method: 'card', amount: parseFloat(splitCard) })
      cashRcvd = parseFloat(splitCash) || 0
    } else {
      payments = [{ method, amount: grandTotal }]
      cashRcvd = method === 'cash' ? cash : 0
    }
    onCharge(payments, cashRcvd)
  }

  const cannotCharge =
    disabled ||
    charging ||
    grandTotal <= 0 ||
    (method === 'split' && Math.round(splitSum * 100) < Math.round(grandTotal * 100)) ||
    (method === 'cash' && cash > 0 && cash < grandTotal)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {methods.map(m => {
          const Icon = m.icon
          const active = method === m.key
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMethod(m.key)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border py-2 text-xs font-medium transition-colors',
                active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted',
              )}
            >
              <Icon className={cn('w-4 h-4', active ? 'text-primary' : m.color)} />
              {m.label}
            </button>
          )
        })}
      </div>

      {method === 'cash' && (
        <div>
          <label className="text-xs text-muted-foreground font-semibold uppercase block mb-1">Cash received</label>
          <Input
            type="number" min={0} inputMode="decimal"
            placeholder={formatCurrency(grandTotal)}
            value={cashReceived}
            onChange={e => setCashReceived(e.target.value)}
            className="h-9"
          />
          {cash > 0 && (
            <p className={cn('text-xs mt-1', cash >= grandTotal ? 'text-emerald-600' : 'text-red-500')}>
              {cash >= grandTotal ? `Change due: ${formatCurrency(changeDue)}` : `Short by ${formatCurrency(grandTotal - cash)}`}
            </p>
          )}
        </div>
      )}

      {method === 'split' && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground font-semibold uppercase block mb-1">Cash</label>
            <Input type="number" min={0} value={splitCash} onChange={e => setSplitCash(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-semibold uppercase block mb-1">UPI</label>
            <Input type="number" min={0} value={splitUpi} onChange={e => setSplitUpi(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-semibold uppercase block mb-1">Card</label>
            <Input type="number" min={0} value={splitCard} onChange={e => setSplitCard(e.target.value)} className="h-8 text-sm" />
          </div>
          <p className={cn('col-span-3 text-xs font-medium', splitSum >= grandTotal ? 'text-emerald-600' : 'text-red-500')}>
            Split: {formatCurrency(splitSum)} / {formatCurrency(grandTotal)}
          </p>
        </div>
      )}

      <Button className="w-full gap-2 h-11" disabled={cannotCharge} onClick={handleCharge}>
        {charging ? <Loader2 className="w-5 h-5 animate-spin" /> : <Receipt className="w-5 h-5" />}
        Charge {formatCurrency(grandTotal)}
      </Button>
    </div>
  )
}

// ── Add-items product search (shared) ─────────────────────────────────────────
function ProductSearch({ onPick }: { onPick: (p: { id: string; name: string; price: number; tax_rate: number; item_type: string }) => void }) {
  const [search, setSearch] = useState('')
  const productsQ = useQuery({
    queryKey: ['restaurant', 'dine-in-products'],
    queryFn: () => vendorApi.restaurantListDineInProducts(),
    staleTime: 60_000,
  })
  const items = useMemo(() => {
    const all = productsQ.data?.items ?? []
    const q = search.trim().toLowerCase()
    if (!q) return all.slice(0, 50)
    return all.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q),
    ).slice(0, 50)
  }, [productsQ.data, search])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu…" className="pl-9 h-9 text-sm" />
      </div>
      {productsQ.isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      <ul className="divide-y rounded-lg border max-h-64 overflow-y-auto">
        {items.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground text-center">No products found.</li>}
        {items.map(p => (
          <li key={p.id}>
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-amber-50 active:bg-amber-100 text-left"
              onClick={() => onPick({
                id: p.id, name: p.name, price: Number(p.price ?? 0),
                tax_rate: Number(p.tax_rate ?? 0), item_type: p.item_type ?? 'product',
              })}
            >
              <span className="text-foreground flex-1 min-w-0 truncate">{p.name}</span>
              <span className="text-muted-foreground shrink-0 ml-3 font-medium">{formatCurrency(Number(p.price ?? 0))}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function RestaurantPOSPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { selectedRestaurant } = useRestaurantStore()
  const rid = selectedRestaurant?.id

  const [tab, setTab] = useState<'tables' | 'walkin'>('tables')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(searchParams.get('order'))
  const [session, setSession] = useState<PosSession | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [modifierPending, setModifierPending] = useState<ModifierPickerProduct | null>(null)
  const [pendingItems, setPendingItems] = useState<RestaurantOrderItem[]>([])
  const [walkinCart, setWalkinCart] = useState<RestaurantOrderItem[]>([])

  // POS session bootstrap
  useEffect(() => {
    vendorApi.posGetCurrentSession()
      .then(d => setSession(d.session))
      .catch(() => setSession(null))
      .finally(() => setSessionLoading(false))
  }, [])

  // Live list of open / billed orders for the outlet
  const ordersQ = useQuery({
    queryKey: ['restaurant', 'pos-orders', rid],
    queryFn: async () => {
      const [open, billed] = await Promise.all([
        vendorApi.restaurantListOrders({ status: 'open', ...(rid ? { restaurant_id: rid } : {}) }),
        vendorApi.restaurantListOrders({ status: 'billed', ...(rid ? { restaurant_id: rid } : {}) }),
      ])
      return [...billed.items, ...open.items]
    },
    refetchInterval: 5_000,
  })
  const orders = ordersQ.data ?? []

  const orderQ = useQuery({
    queryKey: ['restaurant', 'order', selectedOrderId],
    queryFn: () => vendorApi.restaurantGetOrder(selectedOrderId!),
    enabled: !!selectedOrderId && tab === 'tables',
    refetchInterval: 5_000,
  })
  const order = orderQ.data

  function selectOrder(id: string) {
    setSelectedOrderId(id)
    setPendingItems([])
    setTab('tables')
    const next = new URLSearchParams(searchParams)
    next.set('order', id)
    setSearchParams(next, { replace: true })
  }

  function clearSelection() {
    setSelectedOrderId(null)
    setPendingItems([])
    const next = new URLSearchParams(searchParams)
    next.delete('order')
    setSearchParams(next, { replace: true })
  }

  const openSession = useMutation({
    mutationFn: () => vendorApi.posOpenSession({ opening_cash: 0 }),
    onSuccess: (s) => { setSession(s as PosSession); toast.success('POS session opened') },
    onError: () => toast.error('Could not open POS session — one may already be active for another register'),
  })

  const sendKOT = useMutation({
    mutationFn: () => vendorApi.restaurantSendKOT(selectedOrderId!, { items: pendingItems }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'order', selectedOrderId] })
      qc.invalidateQueries({ queryKey: ['restaurant', 'kots'] })
      qc.invalidateQueries({ queryKey: ['restaurant', 'pos-orders'] })
      setPendingItems([])
      toast.success('Sent to kitchen')
    },
    onError: () => toast.error('Could not send to kitchen'),
  })

  // ── Charge handlers ────────────────────────────────────────────────────────
  const [charging, setCharging] = useState(false)

  async function ensureSession(): Promise<string | null> {
    if (session?.id) return session.id
    try {
      const s = await vendorApi.posOpenSession({ opening_cash: 0 }) as PosSession
      setSession(s)
      return s.id
    } catch {
      toast.error('Open a POS session before charging')
      return null
    }
  }

  async function chargeTableOrder(payments: { method: string; amount: number }[], cashReceived: number) {
    if (!order) return
    setCharging(true)
    try {
      const sessionId = await ensureSession()
      if (!sessionId) { setCharging(false); return }
      const adj = order.adjustments ?? {}
      const result = await vendorApi.posCreateTransaction({
        session_id: sessionId,
        transaction_type: 'sale',
        items: order.items.map(i => ({
          product_id: i.product_id,
          name: i.name,
          qty: i.qty,
          price: itemUnitPrice(i),
          discount: 0,
          tax_rate: i.tax_rate ?? 0,
          item_type: i.item_type === 'service' ? 'service' : 'product',
        })),
        discount_type: adj.discount_pct ? 'percentage' : 'flat',
        discount_value: adj.discount_pct ?? adj.discount_amount ?? 0,
        payment_methods: payments,
        cash_received: cashReceived,
        restaurant_table_id: order.table_id || undefined,
        tip_amount: adj.tip_amount ?? 0,
        service_charge_amount: (order.items.reduce((s, i) => s + lineTotal(i), 0)) * (adj.service_charge_pct ?? 0) / 100,
        notes: `Restaurant POS · Table ${order.table_label ?? ''}`.trim(),
      }) as { id: string }
      await vendorApi.restaurantCloseOrder(order.id, String(result.id))
      qc.invalidateQueries({ queryKey: ['restaurant'] })
      toast.success(`Table ${order.table_label ?? ''} paid & closed`)
      clearSelection()
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Could not complete payment')
    } finally {
      setCharging(false)
    }
  }

  async function chargeWalkin(payments: { method: string; amount: number }[], cashReceived: number) {
    if (walkinCart.length === 0) return
    setCharging(true)
    try {
      const sessionId = await ensureSession()
      if (!sessionId) { setCharging(false); return }
      await vendorApi.posCreateTransaction({
        session_id: sessionId,
        transaction_type: 'sale',
        items: walkinCart.map(i => ({
          product_id: i.product_id,
          name: i.name,
          qty: i.qty,
          price: itemUnitPrice(i),
          discount: 0,
          tax_rate: i.tax_rate ?? 0,
          item_type: i.item_type === 'service' ? 'service' : 'product',
        })),
        payment_methods: payments,
        cash_received: cashReceived,
        notes: 'Restaurant POS · Walk-in',
      })
      toast.success('Walk-in sale completed')
      setWalkinCart([])
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Could not complete sale')
    } finally {
      setCharging(false)
    }
  }

  // ── Product picker (modifiers) ───────────────────────────────────────────────
  function handlePick(p: { id: string; name: string; price: number; tax_rate: number; item_type: string }) {
    setModifierPending({
      id: p.id,
      name: p.name,
      price: p.price,
      tax_rate: p.tax_rate,
      item_type: (p.item_type === 'service' ? 'service' : 'product') as 'product' | 'service',
    })
  }

  function onModifierConfirm(item: ModifierPickerProduct & { modifiers: SelectedModifier[] }) {
    const line: RestaurantOrderItem = {
      product_id: item.id,
      name: item.name,
      qty: 1,
      unit_price: item.price,
      tax_rate: item.tax_rate ?? 0,
      item_type: item.item_type,
      modifiers: item.modifiers.length ? item.modifiers : undefined,
    }
    if (tab === 'walkin') setWalkinCart(prev => mergePendingItem(prev, line))
    else setPendingItems(prev => mergePendingItem(prev, line))
    setModifierPending(null)
  }

  // ── Derived totals ───────────────────────────────────────────────────────────
  const tableTotals = order ? computeTotals(order.items, order.adjustments ?? {}) : null
  const walkinTotals = computeTotals(walkinCart, {})

  return (
    <div className="space-y-4">
      {/* Header / session bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Store className="w-5 h-5 text-amber-600" />
            Restaurant POS
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedRestaurant ? selectedRestaurant.name : 'All outlets'} · pull a table order or ring up a walk-in
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sessionLoading ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking session…</span>
          ) : session ? (
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Session open
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={() => openSession.mutate()} disabled={openSession.isPending}>
              {openSession.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Open session'}
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <Link to="/restaurant/floor"><UtensilsCrossed className="w-4 h-4 mr-1" /> Floor</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/restaurant/kitchen"><ChefHat className="w-4 h-4 mr-1" /> Kitchen</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* Left: tables / orders to pull */}
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Open & billed tables</h2>
            <button
              type="button"
              onClick={() => ordersQ.refetch()}
              className="text-muted-foreground hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', ordersQ.isFetching && 'animate-spin')} />
            </button>
          </div>
          {ordersQ.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 border rounded-xl bg-card">
              No open tables right now.
            </p>
          ) : (
            <ul className="space-y-2">
              {orders.map(o => {
                const t = computeTotals(o.items, o.adjustments ?? {})
                const itemCount = o.items.reduce((s, i) => s + i.qty, 0)
                const active = o.id === selectedOrderId && tab === 'tables'
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => selectOrder(o.id)}
                      className={cn(
                        'w-full text-left rounded-xl border p-3 transition-colors',
                        active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card hover:bg-muted',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <UtensilsCrossed className="w-4 h-4 text-amber-600" />
                          {o.table_label ?? 'Table'}
                        </span>
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase', STATUS_BADGE[o.status] ?? 'bg-gray-100')}>
                          {o.status === 'billed' ? 'Bill requested' : o.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {o.covers} · {itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                        <span className="font-medium text-foreground">{formatCurrency(t.grandTotal)}</span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <Button
            variant={tab === 'walkin' ? 'default' : 'outline'}
            className="w-full gap-2"
            onClick={() => { setTab('walkin'); clearSelection() }}
          >
            <ShoppingCart className="w-4 h-4" /> Walk-in / Quick sale
          </Button>
        </aside>

        {/* Right: checkout */}
        <section>
          {tab === 'tables' && !selectedOrderId && (
            <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
              <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Select a table on the left to pull its order</p>
              <p className="text-sm mt-1">Bill-requested tables appear at the top.</p>
            </div>
          )}

          {tab === 'tables' && selectedOrderId && orderQ.isLoading && (
            <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          )}

          {tab === 'tables' && order && tableTotals && (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
              {/* Items + add */}
              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-foreground flex items-center gap-2">
                      <UtensilsCrossed className="w-5 h-5 text-amber-600" />
                      {order.table_label ?? 'Table'}
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase', STATUS_BADGE[order.status] ?? 'bg-gray-100')}>
                        {order.status === 'billed' ? 'Bill requested' : order.status}
                      </span>
                    </h2>
                    <button type="button" onClick={clearSelection} className="text-muted-foreground hover:text-foreground" title="Close">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {order.items.length === 0 && pendingItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No items on this order yet.</p>
                  ) : (
                    <ul className="divide-y text-sm">
                      {order.items.map((item, i) => (
                        <li key={i} className="flex justify-between py-1.5 text-foreground">
                          <span>
                            {item.qty}× {item.name}
                            {(item.modifiers ?? []).length > 0 && (
                              <span className="block text-xs text-muted-foreground">{(item.modifiers ?? []).map(m => m.option_name).join(', ')}</span>
                            )}
                          </span>
                          <span>{formatCurrency(lineTotal(item))}</span>
                        </li>
                      ))}
                      {pendingItems.map((item, i) => (
                        <li key={`p-${i}`} className="flex justify-between py-1.5 text-amber-700">
                          <span className="italic flex items-center gap-2">
                            {item.qty}× {item.name} (unsent)
                            <button type="button" onClick={() => setPendingItems(p => p.filter((_, n) => n !== i))} className="text-muted-foreground hover:text-red-500">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </span>
                          <span>{formatCurrency(lineTotal(item))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {pendingItems.length > 0 && (
                    <Button size="sm" className="w-full gap-2 mt-3" disabled={sendKOT.isPending} onClick={() => sendKOT.mutate()}>
                      {sendKOT.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send {pendingItems.reduce((s, i) => s + i.qty, 0)} item(s) to kitchen
                    </Button>
                  )}
                </div>

                <div className="rounded-xl border bg-card p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Plus className="w-4 h-4 text-amber-600" /> Add items</h3>
                  <ProductSearch onPick={handlePick} />
                </div>
              </div>

              {/* Bill + payment */}
              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4 space-y-3 sticky top-4">
                  <h2 className="text-sm font-semibold text-foreground">Bill</h2>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(tableTotals.subtotal)}</span></div>
                    {tableTotals.sc > 0 && <div className="flex justify-between text-muted-foreground text-xs"><span>Service charge</span><span>+ {formatCurrency(tableTotals.sc)}</span></div>}
                    {tableTotals.tip > 0 && <div className="flex justify-between text-muted-foreground text-xs"><span>Tip</span><span>+ {formatCurrency(tableTotals.tip)}</span></div>}
                    {tableTotals.discount > 0 && <div className="flex justify-between text-emerald-600 text-xs"><span>Discount</span><span>− {formatCurrency(tableTotals.discount)}</span></div>}
                    {tableTotals.totalTax > 0 && <div className="flex justify-between text-muted-foreground text-xs"><span>Tax</span><span>+ {formatCurrency(tableTotals.totalTax)}</span></div>}
                    <div className="flex justify-between font-bold text-foreground pt-1 border-t text-base"><span>Total</span><span>{formatCurrency(tableTotals.grandTotal)}</span></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Adjustments (service charge / tip / discount) are set on the{' '}
                    <Link to={`/restaurant/order/${order.id}`} className="text-primary underline">order screen</Link>.
                  </p>
                  <PaymentPanel
                    grandTotal={tableTotals.grandTotal}
                    disabled={order.items.length === 0}
                    charging={charging}
                    onCharge={chargeTableOrder}
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'walkin' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-amber-600" /> Walk-in cart</h2>
                {walkinCart.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Tap menu items below to build a quick sale.</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {walkinCart.map((item, i) => (
                      <li key={i} className="flex justify-between items-center py-1.5 text-foreground">
                        <span>
                          {item.qty}× {item.name}
                          {(item.modifiers ?? []).length > 0 && (
                            <span className="block text-xs text-muted-foreground">{(item.modifiers ?? []).map(m => m.option_name).join(', ')}</span>
                          )}
                        </span>
                        <span className="flex items-center gap-3">
                          {formatCurrency(lineTotal(item))}
                          <button type="button" onClick={() => setWalkinCart(p => p.filter((_, n) => n !== i))} className="text-muted-foreground hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="pt-2 border-t">
                  <ProductSearch onPick={handlePick} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4 space-y-3 sticky top-4">
                  <h2 className="text-sm font-semibold text-foreground">Bill</h2>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(walkinTotals.subtotal)}</span></div>
                    {walkinTotals.totalTax > 0 && <div className="flex justify-between text-muted-foreground text-xs"><span>Tax</span><span>+ {formatCurrency(walkinTotals.totalTax)}</span></div>}
                    <div className="flex justify-between font-bold text-foreground pt-1 border-t text-base"><span>Total</span><span>{formatCurrency(walkinTotals.grandTotal)}</span></div>
                  </div>
                  <PaymentPanel
                    grandTotal={walkinTotals.grandTotal}
                    disabled={walkinCart.length === 0}
                    charging={charging}
                    onCharge={chargeWalkin}
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {modifierPending && (
        <ModifierPickerModal
          item={modifierPending}
          confirmLabel="Add"
          onConfirm={onModifierConfirm}
          onClose={() => setModifierPending(null)}
        />
      )}
    </div>
  )
}
