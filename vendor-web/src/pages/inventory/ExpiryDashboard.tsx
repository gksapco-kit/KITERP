import { useState, useMemo } from 'react'
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
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import {
  CalendarDays, AlertTriangle, XCircle, CheckCircle2, Clock,
  Loader2, RefreshCw, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStores } from '@/hooks/useVendor'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpiryItem {
  source: 'product' | 'variant' | 'batch'
  product_id: string
  variant_id: string | null
  batch_id: string | null
  batch_number: string | null
  product_name: string
  sku: string | null
  expiry_date: string
  best_before_date: string | null
  days_remaining: number
  urgency: 'expired' | 'critical' | 'warning' | 'caution'
  quantity_available: number
  storage_location_name: string | null
  store_id: string | null
}

interface ExpiryData {
  items: ExpiryItem[]
  total: number
  summary: { expired: number; critical: number; warning: number; caution: number }
  days_ahead: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const URGENCY_CONFIG = {
  expired: {
    label: 'Expired',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200',
    text: 'text-red-700 dark:text-red-400',
    badge: 'destructive' as const,
    icon: XCircle,
  },
  critical: {
    label: 'Critical (≤7 days)',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200',
    text: 'text-orange-700 dark:text-orange-400',
    badge: 'warning' as const,
    icon: AlertTriangle,
  },
  warning: {
    label: 'Expiring Soon (≤30 days)',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200',
    text: 'text-amber-700 dark:text-amber-400',
    badge: 'secondary' as const,
    icon: Clock,
  },
  caution: {
    label: 'Caution (≤90 days)',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200',
    text: 'text-blue-600 dark:text-blue-400',
    badge: 'soft' as const,
    icon: CalendarDays,
  },
}

const DAYS_OPTIONS = [
  { value: '30', label: 'Next 30 days' },
  { value: '60', label: 'Next 60 days' },
  { value: '90', label: 'Next 90 days' },
  { value: '180', label: 'Next 180 days' },
  { value: '365', label: 'Next 365 days' },
]

type UrgencyFilter = 'all' | 'expired' | 'critical' | 'warning' | 'caution'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function DaysChip({ days }: { days: number }) {
  if (days < 0) return <span className="text-xs font-semibold text-red-600">{Math.abs(days)}d ago</span>
  if (days === 0) return <span className="text-xs font-semibold text-red-600">Today</span>
  return (
    <span className={cn('text-xs font-semibold', days <= 7 ? 'text-orange-600' : days <= 30 ? 'text-amber-600' : 'text-blue-600')}>
      {days}d left
    </span>
  )
}

// ── Write-Off Modal ───────────────────────────────────────────────────────────

function WriteOffModal({ item, onClose, stores }: {
  item: ExpiryItem
  onClose: () => void
  stores: { id: string; name: string }[]
}) {
  const qc = useQueryClient()
  const [qty, setQty] = useState('')
  const [storeId, setStoreId] = useState(item.store_id ?? '')
  const [reason, setReason] = useState('Write-off: expired stock')

  const storeOptions = [
    { value: '', label: 'Global (no store)' },
    ...stores.map((s) => ({ value: s.id, label: s.name })),
  ]

  const mutation = useMutation({
    mutationFn: () => vendorApi.inventoryWriteOff({
      product_id: item.product_id,
      variant_id: item.variant_id ?? undefined,
      batch_id: item.batch_id ?? undefined,
      quantity: parseInt(qty, 10),
      store_id: storeId || undefined,
      reason,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'expiry-alerts'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-summary'] })
      toast.success(`${qty} units written off`)
      onClose()
    },
    onError: apiError('Write off stock'),
  })

  const maxQty = Math.floor(item.quantity_available)

  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className="max-w-md max-h-[calc(100dvh-2rem)]">
        <ModalHeader title="Write Off Stock" onClose={onClose} />
        <ModalBody className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="font-semibold">{item.product_name}</div>
            {item.batch_number && (
              <div className="text-xs text-muted-foreground">Batch: {item.batch_number}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              Expiry: {fmtDate(item.expiry_date)} · Available: {item.quantity_available}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Quantity to Write Off</Label>
            <Input
              type="number"
              min={1}
              max={maxQty}
              placeholder={`Max ${maxQty}`}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>

          {stores.length > 0 && (
            <div className="space-y-1">
              <Label>Business Unit</Label>
              <Select
                value={storeId}
                onChange={setStoreId}
                options={storeOptions}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !qty || parseInt(qty, 10) <= 0}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Write Off
          </Button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({ urgency, count, active, onClick }: {
  urgency: 'expired' | 'critical' | 'warning' | 'caution'
  count: number
  active: boolean
  onClick: () => void
}) {
  const cfg = URGENCY_CONFIG[urgency]
  const Icon = cfg.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg border p-4 text-left transition-all hover:shadow-md w-full',
        cfg.bg, cfg.border,
        active && 'ring-2 ring-primary',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-5 w-5', cfg.text)} />
        <span className={cn('text-sm font-medium', cfg.text)}>{cfg.label}</span>
      </div>
      <div className={cn('text-3xl font-bold mt-1', cfg.text)}>{count}</div>
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExpiryDashboard() {
  const [daysAhead, setDaysAhead] = useState('90')
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all')
  const [search, setSearch] = useState('')
  const [writeOffItem, setWriteOffItem] = useState<ExpiryItem | null>(null)
  const { data: storesData } = useStores()
  const stores = storesData?.stores ?? []

  const { data, isLoading, refetch } = useQuery<ExpiryData>({
    queryKey: ['vendor', 'expiry-alerts', daysAhead],
    queryFn: () => vendorApi.inventoryExpiryAlerts({ days_ahead: parseInt(daysAhead, 10) }),
    staleTime: 2 * 60 * 1000,
  })

  const items = data?.items ?? []
  const summary = data?.summary ?? { expired: 0, critical: 0, warning: 0, caution: 0 }

  const filtered = useMemo(() => {
    let list = urgencyFilter === 'all' ? items : items.filter((i) => i.urgency === urgencyFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((i) =>
        i.product_name.toLowerCase().includes(q) ||
        (i.sku ?? '').toLowerCase().includes(q) ||
        (i.batch_number ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [items, urgencyFilter, search])

  async function handleWriteOff(item: ExpiryItem) {
    const confirmed = await askConfirm(
      `Write off stock for "${item.product_name}"${item.batch_number ? ` (Batch: ${item.batch_number})` : ''}? This action cannot be undone.`
    )
    if (confirmed) setWriteOffItem(item)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            Expiry & Shelf-Life Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor expiring products and batches — write off expired stock
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={daysAhead}
            onChange={setDaysAhead}
            options={DAYS_OPTIONS}
            className="w-40"
          />
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['expired', 'critical', 'warning', 'caution'] as const).map((u) => (
          <SummaryCard
            key={u}
            urgency={u}
            count={summary[u]}
            active={urgencyFilter === u}
            onClick={() => setUrgencyFilter(urgencyFilter === u ? 'all' : u)}
          />
        ))}
      </div>

      {/* Expired alert banner */}
      {summary.expired > 0 && urgencyFilter !== 'expired' && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{summary.expired}</strong> item{summary.expired !== 1 ? 's have' : ' has'} already expired.
          </span>
          <button
            onClick={() => setUrgencyFilter('expired')}
            className="ml-auto underline text-red-600 text-xs hover:opacity-80"
          >
            View expired
          </button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">
            {urgencyFilter === 'all' ? 'All Expiring Items' : URGENCY_CONFIG[urgencyFilter].label}
            {filtered.length > 0 && (
              <span className="ml-2 text-muted-foreground font-normal">({filtered.length})</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {urgencyFilter !== 'all' && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setUrgencyFilter('all')}>
                Show All
              </Button>
            )}
            <Input
              placeholder="Search product, SKU, batch…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-52 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-14 gap-2 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-400 opacity-60" />
              <p className="font-medium text-muted-foreground">
                {items.length === 0
                  ? `No items expiring in the next ${daysAhead} days`
                  : 'No items match this filter'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground text-xs">Product / Batch</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground text-xs">Urgency</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground text-xs">Expiry Date</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground text-xs">Days Left</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground text-xs">Qty Available</th>
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground text-xs">Location</th>
                    <th className="py-2 px-3 text-right font-medium text-muted-foreground text-xs w-28">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => {
                    const cfg = URGENCY_CONFIG[item.urgency]
                    return (
                      <tr
                        key={`${item.product_id}-${item.batch_id ?? idx}`}
                        className={cn(
                          'border-b last:border-0 hover:bg-muted/30 transition-colors',
                          item.urgency === 'expired' && 'bg-red-50/40 dark:bg-red-950/10',
                        )}
                      >
                        <td className="py-2 px-3">
                          <div className="font-medium">{item.product_name}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {item.sku && <span className="font-mono">{item.sku}</span>}
                            {item.batch_number && (
                              <span className="bg-muted px-1.5 py-0.5 rounded">Batch: {item.batch_number}</span>
                            )}
                            <span className="capitalize opacity-60">{item.source}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant={cfg.badge} className="text-xs">
                            {item.urgency === 'expired' ? 'Expired'
                              : item.urgency === 'critical' ? 'Critical'
                              : item.urgency === 'warning' ? 'Warning'
                              : 'Caution'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-center text-sm">{fmtDate(item.expiry_date)}</td>
                        <td className="py-2 px-3 text-center">
                          <DaysChip days={item.days_remaining} />
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-sm">{item.quantity_available}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">
                          {item.storage_location_name ?? '—'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {item.quantity_available > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => handleWriteOff(item)}
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              Write Off
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {writeOffItem && (
        <WriteOffModal
          item={writeOffItem}
          onClose={() => setWriteOffItem(null)}
          stores={stores}
        />
      )}
    </div>
  )
}
