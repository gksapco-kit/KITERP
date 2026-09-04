import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { vendorApi } from '@/api/vendor'
import { apiError } from '@/lib/errorMessages'
import { askConfirm } from '@/components/common/ConfirmProvider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import {
  ArrowRightLeft, Plus, ArrowLeft, Loader2, RefreshCw,
  ChevronRight, Send, Truck, PackageCheck, XCircle, CheckCircle2,
  Minus, Search, Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStores } from '@/hooks/useVendor'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TransferLine {
  id: string
  product_id: string
  variant_id: string | null
  product_name: string
  sku: string
  requested_qty: number
  dispatched_qty: number | null
  received_qty: number | null
  notes: string | null
}

interface TransferOrder {
  id: string
  reference_number: string
  status: string
  from_store_id: string
  to_store_id: string
  notes: string | null
  expected_date: string | null
  dispatched_at: string | null
  received_at: string | null
  created_at: string
  lines?: TransferLine[]
}

interface InventoryItem {
  product_id: string
  product_name: string
  sku?: string | null
  current_quantity: number
  variant_id?: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, {
  label: string
  variant: 'default' | 'secondary' | 'outline' | 'destructive'
  icon: React.ElementType
}> = {
  draft: { label: 'Draft', variant: 'outline', icon: ArrowRightLeft },
  submitted: { label: 'Submitted', variant: 'secondary', icon: Send },
  dispatched: { label: 'Dispatched (In-Transit)', variant: 'default', icon: Truck },
  received: { label: 'Received', variant: 'success' as 'default', icon: PackageCheck },
  cancelled: { label: 'Cancelled', variant: 'destructive', icon: XCircle },
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  ...Object.entries(STATUS_CFG).map(([v, c]) => ({ value: v, label: c.label })),
]

const KEYS = {
  list: (p?: Record<string, unknown>) => ['vendor', 'transfer-orders', p] as const,
  detail: (id: string) => ['vendor', 'transfer-order', id] as const,
  inventory: (storeId: string) => ['vendor', 'inventory-summary', { storeId }] as const,
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Product Search Row ─────────────────────────────────────────────────────────

interface DraftLine {
  product_id: string
  product_name: string
  sku: string
  qty: number
  available: number
}

function ProductSearchRow({
  line,
  index,
  inventory,
  onUpdate,
  onRemove,
  canRemove,
}: {
  line: DraftLine
  index: number
  inventory: InventoryItem[]
  onUpdate: (i: number, patch: Partial<DraftLine>) => void
  onRemove: (i: number) => void
  canRemove: boolean
}) {
  const [query, setQuery] = useState(line.product_name)
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    if (!query.trim()) return inventory.slice(0, 12)
    const q = query.toLowerCase()
    return inventory.filter(
      (p) =>
        p.product_name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q),
    ).slice(0, 10)
  }, [query, inventory])

  const select = useCallback((item: InventoryItem) => {
    onUpdate(index, {
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku ?? '',
      available: item.current_quantity,
    })
    setQuery(item.product_name)
    setOpen(false)
  }, [index, onUpdate])

  return (
    <div className="flex items-start gap-2">
      <div className="relative flex-1 min-w-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search product by name or SKU…"
            className="h-9 text-sm pl-8"
          />
        </div>
        {open && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover shadow-lg">
            {results.map((item) => (
              <button
                key={`${item.product_id}-${item.variant_id ?? ''}`}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary hover:text-primary-foreground"
                onMouseDown={() => select(item)}
              >
                <Package className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="flex-1 font-medium truncate">{item.product_name}</span>
                {item.sku && <span className="text-xs opacity-60 font-mono shrink-0">{item.sku}</span>}
                <span className="text-xs shrink-0 ml-1 opacity-70">({item.current_quantity})</span>
              </button>
            ))}
          </div>
        )}
        {line.product_id && (
          <div className="flex items-center gap-2 mt-0.5">
            {line.sku && <span className="text-xs text-muted-foreground font-mono">{line.sku}</span>}
            <span className="text-xs text-muted-foreground">Available: {line.available}</span>
          </div>
        )}
      </div>
      <Input
        type="number"
        min={1}
        max={line.available || undefined}
        placeholder="Qty"
        value={line.qty}
        onChange={(e) => onUpdate(index, { qty: parseInt(e.target.value, 10) || 1 })}
        className="w-20 h-9 text-sm shrink-0"
      />
      {canRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive shrink-0"
          onClick={() => onRemove(index)}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateModal({ open, onClose, stores }: {
  open: boolean
  onClose: () => void
  stores: { id: string; name: string }[]
}) {
  const qc = useQueryClient()
  const [fromStore, setFromStore] = useState('')
  const [toStore, setToStore] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([
    { product_id: '', product_name: '', sku: '', qty: 1, available: 0 },
  ])

  const storeOptions = stores.map((s) => ({ value: s.id, label: s.name }))
  const toStoreOptions = storeOptions.filter((s) => s.value !== fromStore)

  const { data: invData } = useQuery({
    queryKey: KEYS.inventory(fromStore),
    queryFn: () => vendorApi.inventorySummary({ store_id: fromStore }),
    enabled: !!fromStore,
    staleTime: 60_000,
  })
  const inventory: InventoryItem[] = invData?.items ?? []

  function addLine() {
    setLines((l) => [...l, { product_id: '', product_name: '', sku: '', qty: 1, available: 0 }])
  }
  function removeLine(i: number) {
    setLines((l) => l.filter((_, idx) => idx !== i))
  }
  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((l) => l.map((x, idx) => idx === i ? { ...x, ...patch } : x))
  }

  const create = useMutation({
    mutationFn: () => vendorApi.createTransferOrder({
      from_store_id: fromStore,
      to_store_id: toStore,
      notes: notes || undefined,
      lines: lines
        .filter((l) => l.product_id && l.qty > 0)
        .map((l) => ({ product_id: l.product_id, requested_qty: l.qty })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'transfer-orders'] })
      toast.success('Transfer order created')
      onClose()
      setFromStore('')
      setToStore('')
      setNotes('')
      setLines([{ product_id: '', product_name: '', sku: '', qty: 1, available: 0 }])
    },
    onError: apiError('Create transfer order'),
  })

  if (!open) return null

  const validLines = lines.filter((l) => l.product_id && l.qty > 0)

  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className="max-w-xl max-h-[calc(100dvh-2rem)]">
        <ModalHeader title="New Stock Transfer Order" onClose={onClose} />
        <ModalBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From Store *</Label>
              <Select
                value={fromStore}
                onChange={(v) => { setFromStore(v); setLines([{ product_id: '', product_name: '', sku: '', qty: 1, available: 0 }]) }}
                options={[{ value: '', label: 'Select source…' }, ...storeOptions]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>To Store *</Label>
              <Select
                value={toStore}
                onChange={setToStore}
                options={[{ value: '', label: 'Select destination…' }, ...toStoreOptions]}
                disabled={!fromStore}
              />
            </div>
          </div>

          {/* Product lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Transfer Lines</Label>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addLine} disabled={!fromStore}>
                <Plus className="mr-1 h-3 w-3" /> Add Line
              </Button>
            </div>
            {!fromStore ? (
              <p className="text-xs text-muted-foreground">Select a source store to search products.</p>
            ) : inventory.length === 0 ? (
              <p className="text-xs text-muted-foreground">No inventory found in the selected store.</p>
            ) : (
              lines.map((line, i) => (
                <ProductSearchRow
                  key={i}
                  line={line}
                  index={i}
                  inventory={inventory}
                  onUpdate={updateLine}
                  onRemove={removeLine}
                  canRemove={lines.length > 1}
                />
              ))
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !fromStore || !toStore || validLines.length === 0}
          >
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Transfer Order
          </Button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}

// ── Detail View ───────────────────────────────────────────────────────────────

function TransferDetail({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const qc = useQueryClient()
  const { data: storesData } = useStores()
  const storeMap = useMemo(() => {
    const m: Record<string, string> = {}
    ;(storesData?.stores ?? []).forEach((s: { id: string; name: string }) => { m[s.id] = s.name })
    return m
  }, [storesData])

  const { data: order, isLoading } = useQuery<TransferOrder>({
    queryKey: KEYS.detail(orderId),
    queryFn: () => vendorApi.getTransferOrder(orderId),
  })

  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({})

  const submit = useMutation({
    mutationFn: () => vendorApi.submitTransferOrder(orderId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEYS.detail(orderId) }); toast.success('Order submitted') },
    onError: apiError('Submit transfer order'),
  })

  const dispatch = useMutation({
    mutationFn: () => vendorApi.dispatchTransferOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.detail(orderId) })
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-summary'] })
      toast.success('Stock dispatched — in transit')
    },
    onError: apiError('Dispatch transfer order'),
  })

  const receive = useMutation({
    mutationFn: () => vendorApi.receiveTransferOrder(orderId, {
      lines: (order?.lines ?? []).map((l) => ({
        line_id: l.id,
        received_qty: receiveQtys[l.id] ?? l.dispatched_qty ?? l.requested_qty,
      })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.detail(orderId) })
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-summary'] })
      toast.success('Stock received at destination')
    },
    onError: apiError('Receive transfer order'),
  })

  const cancel = useMutation({
    mutationFn: () => vendorApi.cancelTransferOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.detail(orderId) })
      qc.invalidateQueries({ queryKey: ['vendor', 'transfer-orders'] })
      onBack()
    },
    onError: apiError('Cancel transfer order'),
  })

  async function handleDispatch() {
    const ok = await askConfirm(`Dispatch transfer order ${order?.reference_number}? Stock will be deducted from the source store immediately.`)
    if (ok) dispatch.mutate()
  }

  async function handleCancel() {
    const ok = await askConfirm(`Cancel transfer order ${order?.reference_number}? This cannot be undone.`)
    if (ok) cancel.mutate()
  }

  if (isLoading || !order) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.draft
  const Icon = cfg.icon

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">{order.reference_number}</h2>
            <Badge variant={cfg.variant} className="text-xs flex items-center gap-1">
              <Icon className="h-3 w-3" />{cfg.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {storeMap[order.from_store_id] ?? 'Source'} → {storeMap[order.to_store_id] ?? 'Destination'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {order.status === 'draft' && (
            <Button size="sm" variant="outline" onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
              Submit
            </Button>
          )}
          {(order.status === 'draft' || order.status === 'submitted') && (
            <Button size="sm" onClick={handleDispatch} disabled={dispatch.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
              {dispatch.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Truck className="mr-1 h-3.5 w-3.5" />}
              Dispatch
            </Button>
          )}
          {order.status === 'dispatched' && (
            <Button size="sm" onClick={() => receive.mutate()} disabled={receive.isPending} className="bg-green-600 hover:bg-green-700 text-white">
              {receive.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="mr-1 h-3.5 w-3.5" />}
              Confirm Receipt
            </Button>
          )}
          {!['received', 'cancelled', 'dispatched'].includes(order.status) && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={handleCancel} disabled={cancel.isPending}>
              <XCircle className="mr-1 h-3.5 w-3.5" />Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Status banners */}
      {order.status === 'dispatched' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <Truck className="h-4 w-4 shrink-0" />
          Stock dispatched on {fmtDate(order.dispatched_at)}. It is currently in-transit. Update received quantities below then click "Confirm Receipt".
        </div>
      )}
      {order.status === 'received' && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 px-4 py-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Received at destination on {fmtDate(order.received_at)}. Inventory has been updated.
        </div>
      )}

      {/* Info row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          { label: 'From', value: storeMap[order.from_store_id] ?? '—' },
          { label: 'To', value: storeMap[order.to_store_id] ?? '—' },
          { label: 'Expected', value: fmtDate(order.expected_date) },
          { label: 'Notes', value: order.notes ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-medium truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* Lines */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Transfer Lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground text-xs">Product</th>
                  <th className="py-2 px-3 text-center font-medium text-muted-foreground text-xs">Requested</th>
                  <th className="py-2 px-3 text-center font-medium text-muted-foreground text-xs">Dispatched</th>
                  <th className="py-2 px-3 text-center font-medium text-muted-foreground text-xs">Received</th>
                </tr>
              </thead>
              <tbody>
                {(order.lines ?? []).map((line) => (
                  <tr key={line.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3">
                      <div className="font-medium">{line.product_name}</div>
                      {line.sku && <div className="text-xs text-muted-foreground font-mono">{line.sku}</div>}
                    </td>
                    <td className="py-2 px-3 text-center font-mono">{line.requested_qty}</td>
                    <td className="py-2 px-3 text-center font-mono">{line.dispatched_qty ?? '—'}</td>
                    <td className="py-2 px-3 text-center">
                      {order.status === 'dispatched' ? (
                        <Input
                          type="number"
                          min={0}
                          defaultValue={line.dispatched_qty ?? line.requested_qty}
                          onChange={(e) => setReceiveQtys((q) => ({ ...q, [line.id]: parseInt(e.target.value, 10) || 0 }))}
                          className="w-20 h-7 text-center text-sm font-mono mx-auto block"
                        />
                      ) : (
                        <span className="font-mono">{line.received_qty ?? '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TransferOrdersPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const { data: storesData } = useStores()
  const stores = storesData?.stores ?? []

  const storeMap = useMemo(() => {
    const m: Record<string, string> = {}
    stores.forEach((s: { id: string; name: string }) => { m[s.id] = s.name })
    return m
  }, [stores])

  const { data, isLoading, refetch } = useQuery({
    queryKey: KEYS.list(statusFilter ? { status: statusFilter } : undefined),
    queryFn: () => vendorApi.listTransferOrders(statusFilter ? { status: statusFilter } : undefined),
  })
  const orders: TransferOrder[] = data?.items ?? []

  if (selectedId) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <TransferDetail orderId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6" />
            Stock Transfer Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Formal inter-store transfers with dispatch and receipt confirmation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            className="w-48"
          />
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Transfer
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 gap-3 text-center">
            <ArrowRightLeft className="h-10 w-10 text-muted-foreground opacity-30" />
            <p className="font-medium text-muted-foreground">No transfer orders yet</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Transfer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const cfg = STATUS_CFG[o.status] ?? STATUS_CFG.draft
            const Icon = cfg.icon
            return (
              <Card key={o.id} className="hover:shadow-sm cursor-pointer" onClick={() => setSelectedId(o.id)}>
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <ArrowRightLeft className="h-8 w-8 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{o.reference_number}</span>
                      <Badge variant={cfg.variant} className="text-xs flex items-center gap-1">
                        <Icon className="h-3 w-3" />{cfg.label}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {storeMap[o.from_store_id] ?? '—'} → {storeMap[o.to_store_id] ?? '—'}
                      {o.notes && <span className="ml-2 opacity-70">· {o.notes}</span>}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <div>{fmtDate(o.created_at)}</div>
                    {o.dispatched_at && <div className="text-amber-600">Dispatched {fmtDate(o.dispatched_at)}</div>}
                    {o.received_at && <div className="text-green-600">Received {fmtDate(o.received_at)}</div>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateModal open={showCreate} onClose={() => setShowCreate(false)} stores={stores} />
      )}
    </div>
  )
}
