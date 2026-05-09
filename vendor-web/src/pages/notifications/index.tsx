import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/api/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, Bell, BellOff, Check, CheckCheck, ShoppingCart,
  Package, Info, CreditCard, Star, Settings2, AlertTriangle,
  Search, X, SlidersHorizontal, ArrowUpDown, ChevronDown,
} from 'lucide-react'

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

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string; activeRing: string }> = {
  order:     { label: 'Orders',    icon: ShoppingCart, color: 'bg-blue-100 text-blue-600',   activeRing: 'border-blue-500 bg-blue-50 ring-blue-400' },
  inventory: { label: 'Inventory', icon: Package,      color: 'bg-orange-100 text-orange-600', activeRing: 'border-orange-400 bg-orange-50 ring-orange-300' },
  payment:   { label: 'Payments',  icon: CreditCard,   color: 'bg-green-100 text-green-600',  activeRing: 'border-green-500 bg-green-50 ring-green-400' },
  review:    { label: 'Reviews',   icon: Star,         color: 'bg-yellow-100 text-yellow-600', activeRing: 'border-yellow-500 bg-yellow-50 ring-yellow-400' },
  system:    { label: 'System',    icon: AlertTriangle,color: 'bg-purple-100 text-purple-600', activeRing: 'border-purple-500 bg-purple-50 ring-purple-400' },
  info:      { label: 'Info',      icon: Info,         color: 'bg-gray-100 text-gray-500',    activeRing: 'border-gray-400 bg-gray-50 ring-gray-300' },
}

const ALL_TYPES = Object.keys(TYPE_META)

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest',      label: 'Newest first' },
  { value: 'oldest',      label: 'Oldest first' },
  { value: 'unread_first',label: 'Unread first' },
  { value: 'type',        label: 'By type' },
]

function getTypeMeta(type: string) {
  return TYPE_META[type] ?? { label: type, icon: Info, color: 'bg-gray-100 text-gray-500', activeRing: 'border-gray-400 bg-gray-50 ring-gray-300' }
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

// ── Sort dropdown ─────────────────────────────────────────────────────────────

function SortDropdown({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const label = SORT_OPTIONS.find(o => o.value === value)?.label ?? 'Sort'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
      >
        <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs font-medium">{label}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[150px]">
            {SORT_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs rounded-md mx-1 transition-all duration-100 ${
                  value === o.value
                    ? 'font-semibold text-blue-600 bg-blue-50'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
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
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              {markAllRead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
              Mark all read
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link to="/notifications/settings" className="gap-1.5 flex items-center">
              <Settings2 className="w-4 h-4" /> Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Type stat cards — always show ALL types ───────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {ALL_TYPES.map(t => {
          const meta = getTypeMeta(t)
          const Icon = meta.icon
          const byType = stats?.by_type[t] ?? { total: 0, unread: 0 }
          const isActive = activeType === t
          return (
            <button
              key={t}
              onClick={() => setActiveType(isActive ? null : t)}
              className={`rounded-xl border p-3 text-left transition-all ${
                isActive
                  ? `ring-1 ${meta.activeRing}`
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`inline-flex p-1.5 rounded-lg mb-2 ${meta.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-end justify-between gap-1">
                <div>
                  <p className="text-[11px] font-medium text-gray-500 leading-tight">{meta.label}</p>
                  <p className={`text-xl font-bold leading-tight ${byType.total > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                    {byType.total}
                  </p>
                </div>
                {byType.unread > 0 && (
                  <span className="mb-0.5 inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {byType.unread}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Search + Sort + Filter bar ───────────────────────────────────── */}
      <div className="space-y-2">
        {/* Search row */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search notifications…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white placeholder:text-gray-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-150 select-none ${
              showFilters || activeFiltersCount > 0
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filter
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <SortDropdown value={sort} onChange={setSort} />
        </div>

        {/* Filter panel — Status only (type is filtered via the stat cards above) */}
        {showFilters && (
          <div className="border border-gray-200 rounded-xl bg-white p-3 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Status</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUnreadOnly(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 select-none ${
                    !unreadOnly
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" /> All
                </button>
                <button
                  type="button"
                  onClick={() => setUnreadOnly(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 select-none ${
                    unreadOnly
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50'
                  }`}
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
              <Badge variant="secondary" className="gap-1 cursor-pointer bg-blue-100 text-blue-700 hover:bg-blue-200" onClick={() => setUnreadOnly(false)}>
                Unread only <X className="w-2.5 h-2.5" />
              </Badge>
            )}
            {search && (
              <Badge variant="secondary" className="gap-1 cursor-pointer bg-blue-100 text-blue-700 hover:bg-blue-200" onClick={() => setSearch('')}>
                "{search.length > 20 ? search.slice(0, 20) + '…' : search}" <X className="w-2.5 h-2.5" />
              </Badge>
            )}
            <button type="button" onClick={clearAll} className="text-xs text-gray-400 hover:text-red-500 ml-1">Clear all</button>
          </div>
        )}
      </div>

      {/* ── Results count ─────────────────────────────────────────────────── */}
      {!isLoading && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{notifications.length} notification{notifications.length !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ''}</span>
          {sort !== 'newest' && <span className="text-gray-400">Sorted: {SORT_OPTIONS.find(o => o.value === sort)?.label}</span>}
        </div>
      )}

      {/* ── List ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {search ? `No notifications matching "${search}"` : unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}
          </p>
          {(search || activeType || unreadOnly) && (
            <button type="button" onClick={clearAll} className="mt-2 text-sm text-blue-600 hover:underline">Clear filters</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const meta = getTypeMeta(n.type)
            const Icon = meta.icon
            return (
              <Card key={n.id} className={`transition-all duration-150 ${!n.is_read ? 'border-blue-200 bg-blue-50/30 shadow-sm' : 'border-gray-100 bg-white'}`}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className={`mt-0.5 p-2 rounded-full shrink-0 ${!n.is_read ? meta.color : 'bg-gray-100 text-gray-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${!n.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0 border-gray-200 text-gray-500">{meta.label}</Badge>
                    </div>
                  </div>
                  {!n.is_read && (
                    <Button variant="ghost" size="sm" className="text-blue-600 text-xs shrink-0"
                      onClick={() => markRead.mutate(n.id)} disabled={markRead.isPending}>
                      <Check className="w-3.5 h-3.5 mr-1" /> Mark read
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
