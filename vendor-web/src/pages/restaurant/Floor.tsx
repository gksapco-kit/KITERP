import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  UtensilsCrossed, Settings, ChefHat, Loader2, Users, CheckCircle2,
  Calendar, BarChart3, X, RefreshCw, GitMerge, Search, Store, ArrowRight, Clock,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import type { RestaurantOrder } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useRestaurantStore } from '@/stores/restaurantStore'
import type { TeamMember } from '@/types'

type TableStatus = 'free' | 'seated' | 'ordering' | 'billed' | 'dirty'

const STATUS_CONFIG: Record<TableStatus, { label: string; className: string; dot: string }> = {
  free:     { label: 'Free',        className: 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100', dot: 'bg-emerald-500' },
  seated:   { label: 'Seated',      className: 'border-blue-200 bg-blue-50/60 hover:bg-blue-100',          dot: 'bg-blue-500' },
  ordering: { label: 'Ordering',    className: 'border-amber-200 bg-amber-50/60 hover:bg-amber-100',       dot: 'bg-amber-500' },
  billed:   { label: 'Billed',      className: 'border-red-200 bg-red-50/60 hover:bg-red-100',             dot: 'bg-red-500' },
  dirty:    { label: 'Needs clear', className: 'border-gray-200 bg-gray-50/60 hover:bg-gray-100',          dot: 'bg-gray-400' },
}

const ORDER_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  open:   { label: 'Open',           badge: 'bg-blue-100 text-blue-700' },
  billed: { label: 'Bill requested', badge: 'bg-red-100 text-red-700' },
  closed: { label: 'Closed',         badge: 'bg-gray-100 text-gray-600' },
  voided: { label: 'Voided',         badge: 'bg-gray-100 text-gray-400' },
}

const KOT_STATUS_CONFIG: Record<string, { label: string; badge: string; hint?: string }> = {
  new:       { label: 'New',       badge: 'bg-blue-100 text-blue-700',   hint: 'Awaiting kitchen accept' },
  preparing: { label: 'Preparing', badge: 'bg-amber-100 text-amber-800', hint: 'In kitchen' },
  ready:     { label: 'Ready',     badge: 'bg-emerald-100 text-emerald-800', hint: 'Ready to serve' },
  done:      { label: 'Done',      badge: 'bg-gray-100 text-gray-500' },
}

type FloorDisplay = { label: string; labelClass: string; dot: string; cardClass: string }

/** Derive floor card label from table status + active KOT pipeline (overrides generic "Ordering"). */
function deriveFloorDisplay(tableStatus: TableStatus, order?: RestaurantOrder): FloorDisplay {
  const base = STATUS_CONFIG[tableStatus] ?? STATUS_CONFIG.free

  if (!order || tableStatus === 'free' || tableStatus === 'dirty') {
    return {
      label: base.label,
      labelClass: tableStatus === 'free' ? 'text-emerald-600'
        : tableStatus === 'seated' ? 'text-blue-600'
        : tableStatus === 'ordering' ? 'text-amber-700'
        : tableStatus === 'billed' ? 'text-red-600'
        : 'text-gray-500',
      dot: base.dot,
      cardClass: base.className,
    }
  }

  const activeKots = (order.kots ?? []).filter(k => k.status !== 'done')

  if (activeKots.some(k => k.status === 'ready')) {
    return {
      label: 'Ready to serve',
      labelClass: 'text-emerald-700',
      dot: 'bg-emerald-500',
      cardClass: 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100',
    }
  }
  if (activeKots.some(k => k.status === 'preparing')) {
    return {
      label: 'In kitchen',
      labelClass: 'text-orange-700',
      dot: 'bg-orange-500',
      cardClass: 'border-orange-200 bg-orange-50/60 hover:bg-orange-100',
    }
  }
  if (activeKots.some(k => k.status === 'new')) {
    return {
      label: 'Awaiting kitchen',
      labelClass: 'text-blue-700',
      dot: 'bg-blue-500',
      cardClass: 'border-blue-200 bg-blue-50/60 hover:bg-blue-100',
    }
  }

  if (tableStatus === 'seated') {
    return { label: base.label, labelClass: 'text-blue-600', dot: base.dot, cardClass: base.className }
  }
  if (tableStatus === 'billed') {
    return { label: base.label, labelClass: 'text-red-600', dot: base.dot, cardClass: base.className }
  }
  return { label: 'Ordering', labelClass: 'text-amber-700', dot: base.dot, cardClass: base.className }
}

// ── Dining timer ────────────────────────────────────────────────────────────
interface DiningTimerConfig {
  enabled: boolean
  target_minutes: number
  warn_minutes: number
}

/** Returns { text, tone } for a table's dining timer badge. */
function getTimerBadge(
  order: RestaurantOrder | undefined,
  now: number,
  cfg: DiningTimerConfig,
): { text: string; tone: 'green' | 'amber' | 'red' } | null {
  if (!cfg.enabled || !order?.created_at) return null
  const targetMinutes = cfg.target_minutes ?? 60
  const warnMinutes = cfg.warn_minutes ?? 10
  const elapsedMs = now - new Date(order.created_at).getTime()
  if (Number.isNaN(elapsedMs)) return null
  const elapsedMin = elapsedMs / 60000
  const remaining = targetMinutes - elapsedMin
  const over = remaining < 0
  const tone: 'green' | 'amber' | 'red' = over
    ? 'red'
    : remaining <= warnMinutes
      ? 'amber'
      : 'green'
  const absMin = Math.abs(remaining)
  const h = Math.floor(absMin / 60)
  const m = Math.floor(absMin % 60)
  const s = Math.floor((absMin * 60) % 60)
  const formatted = `${h > 0 ? `${h}h ` : ''}${m}:${String(s).padStart(2, '0')}`
  return { text: over ? `+${formatted}` : formatted, tone }
}

function parseDiningTimerConfig(raw: unknown): DiningTimerConfig {
  const cfg = (raw && typeof raw === 'object' ? raw : {}) as Partial<DiningTimerConfig>
  return {
    enabled: cfg.enabled === true,
    target_minutes: cfg.target_minutes ?? 60,
    warn_minutes: cfg.warn_minutes ?? 10,
  }
}

/** Searchable team-member picker for assigning a server/waiter when seating a table. */
function RestaurantServerPicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (name: string) => void
  disabled?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['team-for-restaurant-seat'],
    queryFn: () => vendorApi.listTeamMembers({ size: 100 }),
    staleTime: 5 * 60_000,
  })

  // Dedupe by user_id so duplicate membership rows don't repeat the same name
  const members = (() => {
    const seen = new Set<string>()
    return (data?.items ?? []).filter((m: TeamMember) => {
      if (!m.is_active) return false
      const key = m.user_id || m.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  })()

  const q = query.trim().toLowerCase()
  const filtered = members.filter((m: TeamMember) => {
    const name = m.user?.full_name || m.role_name || ''
    const email = m.user?.email || ''
    const phone = m.user?.phone || ''
    if (!q) return true
    return (
      name.toLowerCase().includes(q) ||
      email.toLowerCase().includes(q) ||
      phone.includes(q)
    )
  })

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function pick(m: TeamMember) {
    const name = m.user?.full_name || m.role_name || 'Team member'
    onChange(name)
    setQuery('')
    setFocused(false)
  }

  function clear() {
    onChange('')
    setQuery('')
    setFocused(true)
  }

  const showList = focused && !value

  return (
    <div ref={wrapRef} className="space-y-2">
      {/* Selected server shown outside the search box */}
      {value ? (
        <div className="flex items-center gap-2 px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-blue-200 flex items-center justify-center text-xs font-semibold text-blue-700 shrink-0">
            {value.charAt(0).toUpperCase()}
          </div>
          <span className="flex-1 text-sm font-medium text-gray-900 truncate">{value}</span>
          {!disabled && (
            <button type="button" onClick={clear} className="text-gray-400 hover:text-red-500 shrink-0">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 h-9">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              placeholder={isLoading ? 'Loading team…' : 'Search server by name…'}
              disabled={disabled || isLoading}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
            />
            {query && !disabled && (
              <button type="button" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Team list rendered below the input — not clipped inside it */}
          {showList && !isLoading && filtered.length > 0 && (
            <div className="rounded-lg border border-border bg-background max-h-36 overflow-y-auto divide-y">
              {filtered.slice(0, 25).map((m: TeamMember) => {
                const name = m.user?.full_name || m.role_name || 'Team member'
                const sub = [m.user?.phone, m.user?.email].filter(Boolean).join(' · ')
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => pick(m)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                  >
                    <div className="font-medium truncate">{name}</div>
                    {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
                  </button>
                )
              })}
            </div>
          )}
          {showList && !isLoading && members.length === 0 && (
            <p className="text-xs text-amber-600 px-1">No team members — add staff under Settings → Team</p>
          )}
          {showList && !isLoading && members.length > 0 && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-1">No matches found</p>
          )}
        </>
      )}
    </div>
  )
}

/** Small modal to capture covers + optional server name before seating a table */
function SeatTableDialog({
  tableLabel,
  onConfirm,
  onCancel,
  loading,
}: {
  tableLabel: string
  onConfirm: (covers: number, serverName: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [covers, setCovers] = useState(2)
  const [serverName, setServerName] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-card border border-border text-foreground rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-lg">Seat Table {tableLabel}</h2>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
              Covers (guests)
            </label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 8, 10].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCovers(n)}
                  className={cn(
                    'w-10 h-10 rounded-xl border text-sm font-bold transition-colors',
                    covers === n
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Server / waiter (optional)
            </label>
            <RestaurantServerPicker
              value={serverName}
              onChange={setServerName}
              disabled={loading}
            />
          </div>
        </div>

        <Button
          className="w-full gap-2"
          disabled={loading}
          onClick={() => onConfirm(covers, serverName.trim())}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UtensilsCrossed className="w-4 h-4" />}
          Seat table
        </Button>
      </div>
    </div>
  )
}

// ── Merge tables dialog ─────────────────────────────────────────────────────
interface MergeCandidate {
  orderId: string
  label: string
  zoneName?: string | null
  covers: number
  itemCount: number
}

function MergeTablesDialog({
  candidates,
  onConfirm,
  onClose,
  loading,
}: {
  candidates: MergeCandidate[]
  onConfirm: (sourceOrderId: string, targetOrderId: string) => void
  onClose: () => void
  loading: boolean
}) {
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const source = candidates.find(c => c.orderId === sourceId) ?? null
  const target = candidates.find(c => c.orderId === targetId) ?? null
  const notEnough = candidates.length < 2

  function ChipList({ tone, selectedId, excludeId, onPick }: {
    tone: 'source' | 'target'
    selectedId: string | null
    excludeId?: string | null
    onPick: (orderId: string) => void
  }) {
    return (
      <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
        {candidates.map(c => {
          const isExcluded = excludeId === c.orderId
          const selected = selectedId === c.orderId
          return (
            <li key={c.orderId}>
              <button
                type="button"
                disabled={isExcluded || loading}
                onClick={() => onPick(c.orderId)}
                className={cn(
                  'w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm text-left transition-colors',
                  isExcluded && 'opacity-30 cursor-not-allowed',
                  !isExcluded && !selected && 'border-border hover:bg-muted',
                  selected && tone === 'source' && 'border-red-400 bg-red-50 ring-1 ring-red-400',
                  selected && tone === 'target' && 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400',
                )}
              >
                <span className="font-semibold text-gray-900">{c.label}</span>
                <span className="text-xs text-gray-400">
                  {c.zoneName || '—'} · {c.covers} cov · {c.itemCount} item{c.itemCount !== 1 ? 's' : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border text-foreground rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-amber-600" /> Merge table orders
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Combine two open tables into one bill.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {notEnough ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
            You need at least two occupied tables to merge.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-red-600 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 inline-flex items-center justify-center text-[11px]">1</span>
                  Move order from
                </p>
                <p className="text-[11px] text-gray-400 -mt-1">This table will be emptied &amp; freed.</p>
                <ChipList
                  tone="source"
                  selectedId={sourceId}
                  onPick={(id) => {
                    setSourceId(id)
                    if (targetId === id) setTargetId(null)
                  }}
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-600 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center text-[11px]">2</span>
                  Merge into
                </p>
                <p className="text-[11px] text-gray-400 -mt-1">This table keeps the combined bill.</p>
                <ChipList
                  tone="target"
                  selectedId={targetId}
                  excludeId={sourceId}
                  onPick={setTargetId}
                />
              </div>
            </div>

            {source && target && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-center gap-3 text-sm">
                <span className="font-bold text-gray-900">{source.label}</span>
                <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-bold text-gray-900">{target.label}</span>
                <span className="text-gray-500 hidden sm:inline">
                  · {source.label} freed, all items move to {target.label}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700"
                disabled={!source || !target || loading}
                onClick={() => source && target && onConfirm(source.orderId, target.orderId)}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
                Merge tables
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function RestaurantFloorPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [seatDialog, setSeatDialog] = useState<{ tableId: string; tableLabel: string } | null>(null)
  const [showMerge, setShowMerge] = useState(false)
  const [now, setNow] = useState(Date.now())
  const { selectedRestaurant } = useRestaurantStore()
  const rid = selectedRestaurant?.id

  // Fresh outlet settings from API — zustand store can be stale after Setup saves
  const outletQ = useQuery({
    queryKey: ['restaurant', 'outlet', rid],
    queryFn: () => vendorApi.getRestaurant(rid!),
    enabled: !!rid,
    staleTime: 15_000,
  })

  const timerCfg = parseDiningTimerConfig(
    outletQ.data?.settings?.dining_timer ?? selectedRestaurant?.settings?.dining_timer,
  )

  useEffect(() => {
    if (!timerCfg.enabled) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [timerCfg.enabled])

  const tablesQ = useQuery({
    queryKey: ['restaurant', 'tables', rid],
    queryFn: () => vendorApi.restaurantListTables(rid ? { restaurant_id: rid } : undefined),
    refetchInterval: 5_000,
  })

  const zonesQ = useQuery({
    queryKey: ['restaurant', 'zones', rid],
    queryFn: () => vendorApi.restaurantListZones(rid ? { restaurant_id: rid } : undefined),
    staleTime: 30_000,
  })

  const ordersQ = useQuery({
    queryKey: ['restaurant', 'orders', 'open', rid],
    queryFn: () => vendorApi.restaurantListOrders(rid ? { restaurant_id: rid } : undefined),
    refetchInterval: 5_000,
  })

  const createOrder = useMutation({
    mutationFn: ({ tableId, covers, serverName }: { tableId: string; covers: number; serverName: string }) =>
      vendorApi.restaurantCreateOrder({
        table_id: tableId,
        covers,
        server_name: serverName || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant'] })
      setSeatDialog(null)
      toast.success('Table seated')
    },
    onError: () => {
      setSeatDialog(null)
      toast.error('Could not seat table')
    },
  })

  const clearTable = useMutation({
    mutationFn: (tableId: string) => vendorApi.restaurantSetTableStatus(tableId, 'free'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] })
      toast.success('Table cleared')
    },
    onError: () => toast.error('Could not clear table'),
  })

  const mergeOrders = useMutation({
    mutationFn: ({ sourceOrderId, targetOrderId }: { sourceOrderId: string; targetOrderId: string }) =>
      vendorApi.restaurantMergeOrders(sourceOrderId, targetOrderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant'] })
      setShowMerge(false)
      toast.success('Tables merged')
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Could not merge tables')
    },
  })

  const tables = (tablesQ.data?.items ?? []).filter(t => t.is_active !== false)
  const openOrders = ordersQ.data?.items ?? []
  const zones = zonesQ.data?.items ?? []

  // Build a zone-name → floor map so we can group tables by floor
  const zoneFloorMap = zones.reduce<Record<string, string>>((acc, z) => {
    if (z.floor) acc[z.name] = z.floor
    return acc
  }, {})

  const tableOrderByTableId = openOrders.reduce<Map<string, RestaurantOrder>>((acc, o) => {
    if (o.table_id && !acc.has(o.table_id)) acc.set(o.table_id, o)
    return acc
  }, new Map())

  // Occupied tables that can take part in a merge (have an open order)
  const mergeCandidates: MergeCandidate[] = tables
    .map((t): MergeCandidate | null => {
      const o = tableOrderByTableId.get(t.id)
      if (!o) return null
      return {
        orderId: o.id,
        label: t.label,
        zoneName: t.zone_name,
        covers: o.covers ?? 0,
        itemCount: o.items?.length ?? 0,
      }
    })
    .filter((c): c is MergeCandidate => c !== null)

  function handleTableClick(table: (typeof tables)[0]) {
    const status = (table.status as TableStatus) || 'free'
    const order = tableOrderByTableId.get(table.id)
    const orderId = order?.id

    if (orderId) {
      navigate(`/restaurant/order/${orderId}`)
      return
    }
    if (status === 'dirty') {
      clearTable.mutate(table.id)
      return
    }
    if (status === 'free') {
      setSeatDialog({ tableId: table.id, tableLabel: table.label })
      return
    }
    navigate(`/pos?table=${encodeURIComponent(table.id)}`)
  }

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] })
    qc.invalidateQueries({ queryKey: ['restaurant', 'orders'] })
  }

  // Group by floor (derived from zone), then by zone within each floor
  type TableItem = (typeof tables)[0]
  const groupedByFloor = tables.reduce<Record<string, Record<string, TableItem[]>>>((acc, t) => {
    const floor = (t.zone_name ? zoneFloorMap[t.zone_name] : undefined) || '—'
    const zone = t.zone_name || '—'
    ;((acc[floor] ??= {})[zone] ??= []).push(t)
    return acc
  }, {})

  // Only render floor-level headers when at least one zone has a floor set
  const hasFloors = Object.keys(zoneFloorMap).length > 0

  const isLoading = tablesQ.isLoading

  function TableCard({ t }: { t: TableItem }) {
    const status = (t.status as TableStatus) || 'free'
    const order = tableOrderByTableId.get(t.id)
    const display = deriveFloorDisplay(status, order)
    const orderId = order?.id
    const orderCfg = order ? (ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.open) : null
    const itemCount = order?.items?.length ?? 0
    const activeKots = (order?.kots ?? []).filter(k => k.status !== 'done')
    const isClearing = clearTable.isPending
    const timerBadge = getTimerBadge(order, now, timerCfg)

    return (
      <button
        type="button"
        disabled={isClearing}
        onClick={() => handleTableClick(t)}
        className={cn(
          'rounded-xl border p-4 text-left shadow-sm transition-colors relative',
          display.cardClass,
          isClearing && 'opacity-60 cursor-wait',
        )}
      >
        <span className={cn('absolute top-3 right-3 w-2.5 h-2.5 rounded-full', display.dot)} />

        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 pr-4">
          {t.zone_name || 'Floor'}
        </p>
        <p className="text-lg font-bold text-gray-900 mt-1">{t.label}</p>

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Users className="w-3 h-3" /> {t.capacity} seats
          </span>
          <span className={cn('text-xs font-semibold', display.labelClass)}>
            {display.label}
          </span>
        </div>

        {/* Dining timer badge */}
        {timerBadge && (
          <div className={cn(
            'mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-mono font-semibold',
            timerBadge.tone === 'green' && 'bg-emerald-50 text-emerald-700',
            timerBadge.tone === 'amber' && 'bg-amber-50 text-amber-700',
            timerBadge.tone === 'red' && 'bg-red-50 text-red-700 animate-pulse',
          )}>
            <Clock className="w-3 h-3 shrink-0" />
            {timerBadge.text}
            {timerBadge.tone === 'red' && <span className="text-[10px] font-sans font-medium ml-0.5">over</span>}
          </div>
        )}

        {order && orderCfg && (
          <div className="mt-2 pt-2 border-t border-current/10 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full', orderCfg.badge)}>
                {orderCfg.label}
              </span>
              <span className="text-xs text-gray-500">{order.covers} covers</span>
            </div>
            {activeKots.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {activeKots.map(kot => {
                  const kotCfg = KOT_STATUS_CONFIG[kot.status] ?? KOT_STATUS_CONFIG.new
                  return (
                    <span
                      key={kot.id}
                      className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', kotCfg.badge)}
                      title={kotCfg.hint}
                    >
                      KOT #{kot.kot_number} · {kotCfg.label}
                    </span>
                  )
                })}
              </div>
            )}
            {activeKots.some(k => k.status === 'new') && (
              <p className="text-[10px] text-blue-600 font-medium">Kitchen can accept on Kitchen board</p>
            )}
            {order.server_name && (
              <p className="text-xs text-gray-500 truncate">Server: {order.server_name}</p>
            )}
            {itemCount > 0 && (
              <p className="text-xs text-gray-400">{itemCount} item{itemCount !== 1 ? 's' : ''} on order</p>
            )}
            {itemCount === 0 && order.status === 'open' && (
              <p className="text-xs text-gray-400 italic">No items yet</p>
            )}
          </div>
        )}
        {status === 'dirty' && !orderId && (
          <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Tap to mark free
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Seat dialog */}
      {seatDialog && (
        <SeatTableDialog
          tableLabel={seatDialog.tableLabel}
          loading={createOrder.isPending}
          onConfirm={(covers, serverName) =>
            createOrder.mutate({ tableId: seatDialog.tableId, covers, serverName })
          }
          onCancel={() => setSeatDialog(null)}
        />
      )}

      {/* Merge dialog */}
      {showMerge && (
        <MergeTablesDialog
          candidates={mergeCandidates}
          loading={mergeOrders.isPending}
          onConfirm={(sourceOrderId, targetOrderId) =>
            mergeOrders.mutate({ sourceOrderId, targetOrderId })
          }
          onClose={() => setShowMerge(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-amber-600" /> Restaurant Floor
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tap a free table to seat guests · tap an occupied table to manage the order.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} title="Refresh floor">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMerge(true)}
            disabled={mergeCandidates.length < 2}
            title={mergeCandidates.length < 2 ? 'Need at least two occupied tables' : 'Merge two table orders'}
          >
            <GitMerge className="w-4 h-4 mr-1" /> Merge tables
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/pos" className="gap-1"><Store className="w-4 h-4" /> POS</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/kitchen" className="gap-1"><ChefHat className="w-4 h-4" /> Kitchen</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/reservations" className="gap-1"><Calendar className="w-4 h-4" /> Reservations</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/reports" className="gap-1"><BarChart3 className="w-4 h-4" /> Reports</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/setup" className="gap-1"><Settings className="w-4 h-4" /> Setup</Link>
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        {(Object.entries(STATUS_CONFIG) as [TableStatus, typeof STATUS_CONFIG[TableStatus]][]).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
            {cfg.label}
          </span>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
      )}
      {tablesQ.isError && (
        <p className="text-sm text-red-600">Could not load tables. Configure zones and tables first.</p>
      )}
      {!isLoading && !tables.length && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-gray-500 text-sm">
          No tables yet.&nbsp;
          <Link to="/restaurant/setup" className="text-primary font-medium hover:underline">Add tables in Setup</Link>
        </div>
      )}

      {/* Floor → Zone → Tables grouped layout */}
      {Object.entries(groupedByFloor).map(([floor, zoneMap]) => (
        <div key={floor} className="space-y-4">
          {hasFloors && (
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">
                {floor === '—' ? 'Other' : floor}
              </h2>
              <div className="flex-1 border-t border-gray-100" />
            </div>
          )}
          {Object.entries(zoneMap).map(([zone, zoneTables]) => (
            <section key={zone} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{zone}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {zoneTables.map(t => <TableCard key={t.id} t={t} />)}
              </div>
            </section>
          ))}
        </div>
      ))}
    </div>
  )
}
