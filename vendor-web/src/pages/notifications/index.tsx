import { useMemo, useRef, useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/api/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, Bell, BellOff, Check, CheckCheck, ShoppingCart,
  Package, Info, CreditCard, Star, Settings2, AlertTriangle,
  Search, X, SlidersHorizontal, ArrowUpDown, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { countBadgeCircleClass, formatBadgeCount } from '@/lib/countBadge'
import { onClickableTableRow } from '@/lib/clickableTableRow'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  reference_id?: string
  reference_type?: string
  created_at?: string
}

interface NotifStats {
  total: number
  unread: number
  by_type: Record<string, { total: number; unread: number }>
}

type SortKey = 'newest' | 'oldest' | 'unread_first' | 'type'

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: React.ElementType; chip: string; active: string; bar: string }> = {
  order:     { label: 'Orders',    icon: ShoppingCart,  chip: 'bg-info/15 text-info', active: 'border-info/35 bg-info/[0.06] shadow-sm', bar: 'bg-info' },
  inventory: { label: 'Inventory', icon: Package,       chip: 'bg-orange-500/12 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300', active: 'border-orange-400/40 bg-orange-500/[0.06] shadow-sm', bar: 'bg-orange-500' },
  payment:   { label: 'Payments',  icon: CreditCard,    chip: 'bg-success/12 text-success', active: 'border-success/35 bg-success/[0.06] shadow-sm', bar: 'bg-success' },
  review:    { label: 'Reviews',   icon: Star,          chip: 'bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300', active: 'border-amber-400/45 bg-amber-500/[0.07] shadow-sm', bar: 'bg-amber-400' },
  system:    { label: 'System',    icon: AlertTriangle, chip: 'bg-primary/12 text-primary', active: 'border-primary/35 bg-primary/[0.06] shadow-sm', bar: 'bg-primary' },
  info:      { label: 'Info',      icon: Info,          chip: 'bg-muted text-muted-foreground', active: 'border-foreground/15 bg-muted/60 shadow-sm', bar: 'bg-muted-foreground/50' },
}

const ALL_TYPES = Object.keys(TYPE_META)

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest',      label: 'Newest first' },
  { value: 'oldest',      label: 'Oldest first' },
  { value: 'unread_first',label: 'Unread first' },
  { value: 'type',        label: 'By type' },
]

function getTypeMeta(type: string) {
  return TYPE_META[type] ?? { label: type, icon: Info, chip: 'bg-muted text-muted-foreground', active: 'border-border bg-muted shadow-sm', bar: 'bg-muted-foreground/40' }
}

function timeAgo(iso?: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

/** Deep-link target for a notification's linked entity, if any. */
function getNotificationHref(
  n: Pick<Notification, 'type' | 'reference_type' | 'reference_id'>,
): string | null {
  const id = typeof n.reference_id === 'string' ? n.reference_id.trim() : String(n.reference_id ?? '').trim()
  if (!id) return null
  // Prefer explicit reference_type; fall back to notification type for older rows.
  const kind = (n.reference_type || n.type || '').toLowerCase()
  switch (kind) {
    case 'order':
      return `/orders/${id}`
    case 'product':
      return `/products/${id}`
    case 'lead':
      return '/crm/leads'
    case 'care_reminder':
      return '/crm/care-reminder'
    case 'ticket':
      return `/crm/tickets/${id}`
    default:
      return null
  }
}

// ── Sort dropdown ─────────────────────────────────────────────────────────────

function SortDropdown({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const label = SORT_OPTIONS.find(o => o.value === value)?.label ?? 'Sort'

  useEscapeToClose(() => setOpen(false), open)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2 text-sm text-foreground shadow-sm transition-colors hover:border-input hover:bg-accent/60 dark:hover:bg-secondary/50"
      >
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{label}</span>
        <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-lg">
            {SORT_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={cn(
                  'mx-1 w-full rounded-md px-3 py-2 text-left text-xs transition-all duration-100',
                  value === o.value
                    ? 'bg-primary/15 font-semibold text-primary'
                    : 'text-foreground hover:bg-accent',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [activeType, setActiveType] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [showFilters, setShowFilters] = useState(false)

  // Fetch stats
  const { data: stats } = useQuery<NotifStats>({
    queryKey: ['notifications', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get('/vendors/me/notifications/stats')
      return res.data
    },
    refetchInterval: 30_000,
  })

  // Fetch notification list (always fetch all, filter/sort client-side for snappy UX)
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', { unread_only: unreadOnly, type: activeType }],
    queryFn: async () => {
      const res = await apiClient.get('/vendors/me/notifications', {
        params: { limit: 200, unread_only: unreadOnly, ...(activeType ? { type: activeType } : {}) },
      })
      return res.data as { items: Notification[] }
    },
  })

  // Mark one as read
  const markRead = useMutation({
    mutationFn: async (id: string) => { await apiClient.patch(`/vendors/me/notifications/${id}/read`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Mark all as read
  const markAllRead = useMutation({
    mutationFn: async () => { await apiClient.patch('/vendors/me/notifications/read-all') },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const rawNotifications = data?.items ?? []
  const unreadCount = stats?.unread ?? rawNotifications.filter(n => !n.is_read).length

  // Client-side search + sort
  const notifications = useMemo(() => {
    let list = rawNotifications
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q)
      )
    }
    switch (sort) {
      case 'oldest':
        list = [...list].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
        break
      case 'unread_first':
        list = [...list].sort((a, b) => Number(b.is_read) - Number(a.is_read) === 0
          ? new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
          : Number(a.is_read) - Number(b.is_read))
        break
      case 'type':
        list = [...list].sort((a, b) => a.type.localeCompare(b.type))
        break
      default: // newest
        list = [...list].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    }
    return list
  }, [rawNotifications, search, sort])

  // activeType is shown via stat cards, so don't count it in the filter badge
  const activeFiltersCount = (unreadOnly ? 1 : 0) + (search ? 1 : 0)

  function clearAll() {
    setUnreadOnly(false)
    setActiveType(null)
    setSearch('')
  }

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notifications</h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-rose-600 dark:text-rose-300">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0
              ? 'Review what needs your attention, or clear the queue.'
              : 'All caught up.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              {markAllRead.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Mark all read
            </Button>
          )}
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <Link to="/notifications/settings" className="flex items-center gap-1.5">
              <Settings2 className="h-4 w-4" /> Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Type filters ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {ALL_TYPES.map(t => {
          const meta = getTypeMeta(t)
          const Icon = meta.icon
          const byType = stats?.by_type[t] ?? { total: 0, unread: 0 }
          const isActive = activeType === t
          const hasItems = byType.total > 0
          return (
            <button
              key={t}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveType(isActive ? null : t)}
              className={cn(
                'group relative flex min-h-[6.25rem] flex-col overflow-hidden rounded-2xl border bg-card px-3.5 py-3 text-left transition-all duration-200',
                'hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? meta.active
                  : 'border-border shadow-sm hover:border-foreground/15',
              )}
            >
              <span
                className={cn(
                  'absolute inset-x-3 top-0 h-0.5 rounded-full transition-opacity',
                  meta.bar,
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-70',
                )}
                aria-hidden
              />
              <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-xl', meta.chip)}>
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="mt-auto pt-3">
                <span className="block text-[11px] font-medium tracking-wide text-muted-foreground">{meta.label}</span>
                <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span
                    className={cn(
                      'text-2xl font-semibold leading-none tracking-tight tabular-nums',
                      hasItems ? 'text-foreground' : 'text-muted-foreground/45',
                    )}
                  >
                    {byType.total}
                  </span>
                  {byType.unread > 0 && (
                    <span className="text-[11px] font-semibold tabular-nums text-rose-600 dark:text-rose-300">
                      {formatBadgeCount(byType.unread)} new
                    </span>
                  )}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Search + Sort + Filter bar ───────────────────────────────────── */}
      <div className="space-y-2">
        {/* Search row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-[min(100%,12rem)]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search notifications…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-full border border-input bg-background py-2 pl-9 pr-8 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'relative flex select-none items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-150',
              showFilters || activeFiltersCount > 0
                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {activeFiltersCount > 0 && (
              <span className={cn('absolute -right-1.5 -top-1.5', countBadgeCircleClass(activeFiltersCount, 'primary'))}>
                {formatBadgeCount(activeFiltersCount)}
              </span>
            )}
          </button>
          <SortDropdown value={sort} onChange={setSort} />
        </div>

        {/* Filter panel — Status only (type is filtered via the stat cards above) */}
        {showFilters && (
          <div className="space-y-3 rounded-xl border border-border bg-card p-3">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUnreadOnly(false)}
                  className={cn(
                    'flex select-none items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150',
                    !unreadOnly
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-primary',
                  )}
                >
                  <Bell className="w-3.5 h-3.5" /> All
                </button>
                <button
                  type="button"
                  onClick={() => setUnreadOnly(true)}
                  className={cn(
                    'flex select-none items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150',
                    unreadOnly
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-primary',
                  )}
                >
                  <BellOff className="w-3.5 h-3.5" /> Unread only
                </button>
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <div className="pt-1 border-t">
                <button type="button" onClick={clearAll} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                <X className="w-3 h-3" /> Clear all filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Active filter chips — search and unread only (type shown via stat card highlight) */}
        {!showFilters && activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {unreadOnly && (
              <Badge variant="secondary" className="gap-1 cursor-pointer bg-primary/15 text-primary hover:bg-primary/25 dark:bg-primary/20" onClick={() => setUnreadOnly(false)}>
                Unread only <X className="w-2.5 h-2.5" />
              </Badge>
            )}
            {search && (
              <Badge variant="secondary" className="gap-1 cursor-pointer bg-primary/15 text-primary hover:bg-primary/25 dark:bg-primary/20" onClick={() => setSearch('')}>
                "{search.length > 20 ? search.slice(0, 20) + '…' : search}" <X className="w-2.5 h-2.5" />
              </Badge>
            )}
            <button type="button" onClick={clearAll} className="text-xs text-gray-400 hover:text-red-500 ml-1">Clear all</button>
          </div>
        )}
      </div>

      {/* ── Results count ─────────────────────────────────────────────────── */}
      {!isLoading && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{notifications.length} notification{notifications.length !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ''}</span>
          {sort !== 'newest' && <span className="text-muted-foreground">Sorted: {SORT_OPTIONS.find(o => o.value === sort)?.label}</span>}
        </div>
      )}

      {/* ── List ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Bell className="h-5 w-5 text-muted-foreground" />
          </span>
          <p className="font-medium text-foreground">
            {search ? `No notifications matching "${search}"` : unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || unreadOnly || activeType ? 'Try a different filter.' : 'New activity will show up here.'}
          </p>
          {(search || activeType || unreadOnly) && (
            <button type="button" onClick={clearAll} className="mt-3 text-sm font-medium text-primary hover:underline">Clear filters</button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {notifications.map((n, index) => {
            const meta = getTypeMeta(n.type)
            const Icon = meta.icon
            const href = getNotificationHref(n)
            return (
              <div
                key={n.id}
                role={href ? 'link' : undefined}
                tabIndex={href ? 0 : undefined}
                onClick={href
                  ? onClickableTableRow(() => {
                      if (!n.is_read) markRead.mutate(n.id)
                      navigate(href)
                    })
                  : undefined}
                onKeyDown={href
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        if (!n.is_read) markRead.mutate(n.id)
                        navigate(href)
                      }
                    }
                  : undefined}
                className={cn(
                  'relative flex items-start gap-3 px-4 py-3.5 transition-colors sm:gap-4 sm:px-5',
                  index > 0 && 'border-t border-border/70',
                  !n.is_read && 'bg-primary/[0.045] dark:bg-primary/10',
                  href && 'cursor-pointer hover:bg-accent/50',
                )}
              >
                {!n.is_read && (
                  <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary" aria-hidden />
                )}
                <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', !n.is_read ? meta.chip : 'bg-muted text-muted-foreground')}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn('truncate text-sm', !n.is_read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>{n.title}</p>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.message}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                    <span className="text-muted-foreground/40" aria-hidden>·</span>
                    <span className="text-xs text-muted-foreground">{meta.label}</span>
                  </div>
                </div>
                {!n.is_read && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 rounded-full text-xs text-primary"
                    onClick={(e) => {
                      e.stopPropagation()
                      markRead.mutate(n.id)
                    }}
                    disabled={markRead.isPending}
                  >
                    <Check className="h-3.5 w-3.5" /> Mark read
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
