import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import {
  useState, useEffect, useRef, useMemo, useCallback,
  type KeyboardEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Search, X, ArrowRight,
  Package, ShoppingCart, Users, FileText,
  ClipboardList, Navigation, LayoutGrid,
  Loader2, AlertCircle, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { vendorApi } from '@/api/vendor'
import type { NavSearchEntry } from '@/lib/appSearchIndex'
import { matchesNavQuery } from '@/lib/appSearchIndex'
import type { Product, Order, Customer, PurchaseOrder } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  navEntries: NavSearchEntry[]
}

type Tab = 'navigate' | 'records'

interface EntityCategory {
  id: string
  label: string
  icon: React.ElementType
  color: string
  bg: string
  description: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ENTITY_CATEGORIES: EntityCategory[] = [
  { id: 'products',   label: 'Products',        icon: Package,       color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-950/40',    description: 'Search products by name or SKU' },
  { id: 'orders',     label: 'Orders',          icon: ShoppingCart,  color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-950/40',  description: 'Find orders by number or customer' },
  { id: 'customers',  label: 'Customers',       icon: Users,         color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40', description: 'Look up customers by name or phone' },
  { id: 'invoices',   label: 'Invoices',        icon: FileText,      color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-950/40', description: 'Find invoices by number or customer' },
  { id: 'purchase-orders', label: 'Purchase Orders', icon: ClipboardList, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/40', description: 'Search POs by number or supplier' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    shipped: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
    delivered: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  }
  const cls = map[status?.toLowerCase()] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
  return (
    <span className={cn('inline-block rounded px-1.5 py-0.5 text-xs font-medium capitalize', cls)}>
      {status}
    </span>
  )
}

// ── Nav Results ───────────────────────────────────────────────────────────────

function NavResults({
  entries, query, activeIdx, onNavigate, listRef,
}: {
  entries: NavSearchEntry[]
  query: string
  activeIdx: number
  onNavigate: (to: string) => void
  listRef: React.RefObject<HTMLDivElement>
}) {
  const filtered = useMemo(() => {
    if (!query.trim()) return entries
    return entries.filter((e) => matchesNavQuery(e, query))
  }, [entries, query])

  const grouped = useMemo(() => {
    const map = new Map<string, { title: string; items: NavSearchEntry[] }>()
    for (const e of filtered) {
      if (!map.has(e.sectionId)) map.set(e.sectionId, { title: e.section, items: [] })
      map.get(e.sectionId)!.items.push(e)
    }
    return [...map.values()]
  }, [filtered])

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-foreground">No pages found</p>
        <p className="text-xs text-muted-foreground mt-1">Try a different term or switch to Records search</p>
      </div>
    )
  }

  let globalIdx = -1

  return (
    <div ref={listRef} className="overflow-y-auto max-h-[380px] divide-y divide-border/50">
      {grouped.map((group) => (
        <div key={group.title} className="py-1">
          <p className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {group.title}
          </p>
          {group.items.map((entry) => {
            globalIdx++
            const isActive = globalIdx === activeIdx
            const Icon = entry.icon
            return (
              <button
                key={entry.id}
                data-result-idx={globalIdx}
                onClick={() => onNavigate(entry.to)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted text-foreground',
                )}
              >
                {Icon ? (
                  <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                ) : (
                  <Navigation className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{entry.label}</span>
                  {entry.description && (
                    <span className={cn('block text-xs truncate', isActive ? 'text-primary/70' : 'text-muted-foreground')}>
                      {entry.description}
                    </span>
                  )}
                </span>
                <ChevronRight className={cn('w-3.5 h-3.5 shrink-0 opacity-0 transition-opacity', isActive && 'opacity-100 text-primary')} />
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Record Results ────────────────────────────────────────────────────────────

function RecordResults({
  query, onNavigate,
}: {
  query: string
  onNavigate: (to: string) => void
}) {
  const dq = useDebounce(query.trim(), 300)
  const active = dq.length >= 2

  const productsQ = useQuery({
    queryKey: ['us-products', dq],
    queryFn: () => vendorApi.listProducts({ search: dq, limit: 5 }),
    enabled: active,
    staleTime: 30_000,
  })
  const ordersQ = useQuery({
    queryKey: ['us-orders', dq],
    queryFn: () => vendorApi.listOrders({ search: dq, limit: 5 }),
    enabled: active,
    staleTime: 30_000,
  })
  const customersQ = useQuery({
    queryKey: ['us-customers', dq],
    queryFn: () => vendorApi.listCustomers({ search: dq, limit: 5 }),
    enabled: active,
    staleTime: 30_000,
  })
  const invoicesQ = useQuery({
    queryKey: ['us-invoices', dq],
    queryFn: () => vendorApi.listInvoices({ search: dq, limit: 5 }),
    enabled: active,
    staleTime: 30_000,
  })
  const posQ = useQuery({
    queryKey: ['us-pos', dq],
    queryFn: () => vendorApi.listPurchaseOrders({ search: dq, limit: 5 }),
    enabled: active,
    staleTime: 30_000,
  })

  const isLoading = productsQ.isLoading || ordersQ.isLoading || customersQ.isLoading || invoicesQ.isLoading || posQ.isLoading

  // Category cards shown before typing
  if (!active) {
    return (
      <div className="p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Browse by category</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ENTITY_CATEGORIES.map((cat) => {
            const Icon = cat.icon
            return (
              <button
                key={cat.id}
                className={cn(
                  'flex flex-col items-start gap-1.5 rounded-xl p-3 text-left transition-all border border-transparent',
                  cat.bg,
                  'hover:border-border hover:shadow-sm',
                )}
                onClick={() => {/* focuses search input with category prefix */}}
              >
                <Icon className={cn('w-5 h-5 shrink-0', cat.color)} />
                <p className="text-xs font-medium text-foreground">{cat.label}</p>
                <p className="text-xs text-muted-foreground leading-snug">{cat.description}</p>
              </button>
            )
          })}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Type 2+ characters to search across all records
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Searching…</span>
      </div>
    )
  }

  const products   = (productsQ.data?.items  ?? []) as Product[]
  const orders     = (ordersQ.data?.items    ?? []) as Order[]
  const customers  = (customersQ.data?.items ?? []) as Customer[]
  const invoices   = (invoicesQ.data?.items  ?? []) as unknown as Array<{ id: string; invoice_number: string; customer_name?: string; status: string; total_amount?: number }>
  const pos        = (posQ.data?.items       ?? []) as PurchaseOrder[]

  const totalResults = products.length + orders.length + customers.length + invoices.length + pos.length

  if (totalResults === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-foreground">No records found for &ldquo;{dq}&rdquo;</p>
        <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto max-h-[380px] divide-y divide-border/50">
      {/* Products */}
      {products.length > 0 && (
        <RecordGroup
          label="Products"
          icon={Package}
          color="text-blue-600"
          count={products.length}
          onViewAll={() => onNavigate('/products')}
        >
          {products.map((p) => (
            <RecordRow
              key={p.id}
              primary={p.name}
              secondary={p.sku ? `SKU: ${p.sku}` : p.category ?? ''}
              badge={<StatusBadge status={p.status} />}
              onClick={() => onNavigate(`/products/${p.id}`)}
            />
          ))}
        </RecordGroup>
      )}

      {/* Orders */}
      {orders.length > 0 && (
        <RecordGroup
          label="Orders"
          icon={ShoppingCart}
          color="text-amber-600"
          count={orders.length}
          onViewAll={() => onNavigate('/orders')}
        >
          {orders.map((o) => (
            <RecordRow
              key={o.id}
              primary={`#${o.order_number}`}
              secondary={o.customer_name ?? ''}
              badge={<StatusBadge status={o.status} />}
              onClick={() => onNavigate(`/orders/${o.id}`)}
            />
          ))}
        </RecordGroup>
      )}

      {/* Customers */}
      {customers.length > 0 && (
        <RecordGroup
          label="Customers"
          icon={Users}
          color="text-emerald-600"
          count={customers.length}
          onViewAll={() => onNavigate('/master-data')}
        >
          {customers.map((c) => (
            <RecordRow
              key={c.id}
              primary={c.full_name}
              secondary={c.phone ?? c.email ?? ''}
              onClick={() => onNavigate(`/customers/${c.id}`)}
            />
          ))}
        </RecordGroup>
      )}

      {/* Invoices */}
      {invoices.length > 0 && (
        <RecordGroup
          label="Invoices"
          icon={FileText}
          color="text-violet-600"
          count={invoices.length}
          onViewAll={() => onNavigate('/invoices')}
        >
          {invoices.map((inv) => (
            <RecordRow
              key={inv.id}
              primary={inv.invoice_number ?? inv.id}
              secondary={inv.customer_name ?? ''}
              badge={<StatusBadge status={inv.status} />}
              onClick={() => onNavigate(`/invoices/${inv.id}`)}
            />
          ))}
        </RecordGroup>
      )}

      {/* Purchase Orders */}
      {pos.length > 0 && (
        <RecordGroup
          label="Purchase Orders"
          icon={ClipboardList}
          color="text-rose-600"
          count={pos.length}
          onViewAll={() => onNavigate('/purchase-orders')}
        >
          {pos.map((po) => (
            <RecordRow
              key={po.id}
              primary={`#${po.po_number}`}
              secondary={po.supplier_name ?? ''}
              badge={<StatusBadge status={po.status} />}
              onClick={() => onNavigate(`/purchase-orders/${po.id}`)}
            />
          ))}
        </RecordGroup>
      )}
    </div>
  )
}

function RecordGroup({
  label, icon: Icon, color, count, onViewAll, children,
}: {
  label: string
  icon: React.ElementType
  color: string
  count: number
  onViewAll: () => void
  children: React.ReactNode
}) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between px-4 py-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className={cn('w-3.5 h-3.5 shrink-0', color)} />
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          <span className="text-xs text-muted-foreground">({count})</span>
        </div>
        <button
          onClick={onViewAll}
          className="text-xs text-primary hover:underline flex items-center gap-0.5"
        >
          View all <ArrowRight className="w-2.5 h-2.5" />
        </button>
      </div>
      {children}
    </div>
  )
}

function RecordRow({
  primary, secondary, badge, onClick,
}: {
  primary: string
  secondary?: string
  badge?: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{primary}</p>
        {secondary && <p className="text-xs text-muted-foreground truncate">{secondary}</p>}
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />
    </button>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function UniversalSearch({
 open, onClose, navEntries }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('navigate')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filteredNavCount = useMemo(
    () => (query.trim() ? navEntries.filter((e) => matchesNavQuery(e, query)).length : navEntries.length),
    [navEntries, query],
  )

  const handleClose = useCallback(() => {
    setQuery('')
    setTab('navigate')
    setActiveIdx(0)
    onClose()
  }, [onClose])

  useEscapeToClose(handleClose, open)

  const handleNavigate = useCallback((to: string) => {
    navigate(to)
    handleClose()
  }, [navigate, handleClose])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Reset active index when query changes
  useEffect(() => {
    setActiveIdx(0)
  }, [query, tab])

  // Keyboard navigation
  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (tab === 'navigate') {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, filteredNavCount - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const btn = listRef.current?.querySelector<HTMLButtonElement>(`[data-result-idx="${activeIdx}"]`)
        btn?.click()
      }
    }
  }, [tab, handleClose, filteredNavCount, activeIdx])

  // Scroll active item into view
  useEffect(() => {
    const btn = listRef.current?.querySelector<HTMLButtonElement>(`[data-result-idx="${activeIdx}"]`)
    btn?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  if (!open) return null

  return (
    <div data-kiterp-modal
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4"
      onKeyDown={onKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">

        {/* Search input row */}
        <div className="flex items-center gap-2 sm:gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 shrink-0 text-muted-foreground" aria-hidden />
          <div
            className={cn(
              'relative min-w-0 flex-1 rounded-lg px-2 py-1 transition-shadow',
              'focus-within:ring-2 focus-within:ring-primary/25 focus-within:ring-offset-0',
            )}
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'navigate' ? 'Search pages, reports, settings…' : 'Search products, orders, customers…'}
              className={cn(
                'w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none',
                'focus-visible:ring-0 focus-visible:ring-offset-0',
                query && 'pr-8',
              )}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className={cn(
                'absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
                query ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="hidden shrink-0 sm:flex items-center gap-1.5">
            <kbd className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
              ⌘K
            </kbd>
            <kbd className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
              Esc
            </kbd>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close search"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-4">
          <button
            onClick={() => setTab('navigate')}
            className={cn(
              'flex items-center gap-1.5 px-1 py-2.5 text-xs font-medium border-b-2 mr-4 transition-colors',
              tab === 'navigate'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Navigation className="w-3.5 h-3.5" />
            Navigate
            {filteredNavCount > 0 && (
              <span className={cn('ml-0.5 rounded px-1.5 py-0.5 text-xs font-bold', tab === 'navigate' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                {filteredNavCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('records')}
            className={cn(
              'flex items-center gap-1.5 px-1 py-2.5 text-xs font-medium border-b-2 transition-colors',
              tab === 'records'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Records
          </button>
        </div>

        {/* Results */}
        <div className="min-h-[200px]">
          {tab === 'navigate' ? (
            <NavResults
              entries={navEntries}
              query={query}
              activeIdx={activeIdx}
              onNavigate={handleNavigate}
              listRef={listRef}
            />
          ) : (
            <RecordResults
              query={query}
              onNavigate={handleNavigate}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted/40 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {tab === 'navigate' && (
              <>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono">↵</kbd>
                  open
                </span>
              </>
            )}
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono">Esc</kbd>
              close
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono">⌘K</kbd>
            {' '}to open anytime
          </span>
        </div>
      </div>
    </div>
  )
}
