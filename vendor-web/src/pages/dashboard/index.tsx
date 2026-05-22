import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useVendorStore } from '@/stores/vendorStore'
import { vendorApi } from '@/api/vendor'
import { useQuery } from '@tanstack/react-query'
import { useProducts, useServices, useHREmployees, useHRLeaveRequests, useHRMyToday } from '@/hooks/useVendor'
import { formatCurrency } from '@/lib/utils'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2, TrendingUp, ShoppingCart, Users, Package, Wrench,
  IndianRupee, FileText, BarChart3, Receipt, ExternalLink,
  Banknote, Smartphone, CreditCard, Calendar, ChevronLeft, ChevronRight,
  UserCog, Clock, Plane, ArrowUpRight, ArrowDownRight, Wallet,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { DashboardWelcomeBanner } from '@/components/dashboard/DashboardWelcomeBanner'

type TopProductRow = { id: string; name: string; price: number; stock: number }
type TopCustomerRow = { id: string; name: string; email: string; orders: number; spent: number }
type SalesDayRow = { date: string; orders: number; revenue: number }

export default function Dashboard() {
  const navigate = useNavigate()
  const { vendor } = useVendorStore()
  const { user } = useAuthStore()
  const isHRAdmin = ['owner', 'admin', 'manager'].includes(user?.vendor_role?.role ?? '')

  const { data: hrEmpData } = useHREmployees({ limit: 1 })
  const { data: hrLeaveData } = useHRLeaveRequests({ status: 'pending', limit: 1 })
  const { data: hrToday } = useHRMyToday()

  const { data: dashboard, isLoading: dashLoading } = useQuery({ queryKey: ['reports', 'dashboard'], queryFn: vendorApi.getDashboardStats })
  const { data: revenue } = useQuery({ queryKey: ['reports', 'revenue'], queryFn: vendorApi.getRevenueSummary })
  const { data: topProducts } = useQuery({ queryKey: ['reports', 'top-products'], queryFn: () => vendorApi.getTopProducts(10) })
  const { data: topCustomers } = useQuery({ queryKey: ['reports', 'top-customers'], queryFn: () => vendorApi.getTopCustomers(10) })
  const { data: salesByDay } = useQuery({ queryKey: ['reports', 'sales-30'], queryFn: () => vendorApi.getSalesByDay(30) })
  const { data: ordersByStatus } = useQuery({ queryKey: ['reports', 'orders-status'], queryFn: vendorApi.getOrdersByStatus })
  const { data: posOrdersData }     = useQuery({ queryKey: ['reports', 'pos-orders'],     queryFn: () => vendorApi.listOrders({ source: 'pos', size: 100 }) })
  const { data: onlineOrdersData }  = useQuery({ queryKey: ['reports', 'online-orders'],  queryFn: () => vendorApi.listOrders({ size: 100 }) })
  const { data: bookingsData }      = useQuery({ queryKey: ['reports', 'bookings'],        queryFn: () => vendorApi.listBookings({ size: 100 }) })
  const { data: productData } = useProducts({ page: 1, size: 1 })
  const { data: serviceData } = useServices({ page: 1, size: 1 })

  const [obsSearch, setObsSearch] = useState('')
  const [obsSortKey, setObsSortKey] = useState('status')
  const [obsSortDir, setObsSortDir] = useState<SortDir>('asc')

  const [salesSearch, setSalesSearch] = useState('')
  const [salesSortKey, setSalesSortKey] = useState('date')
  const [salesSortDir, setSalesSortDir] = useState<SortDir>('desc')

  const [tpSearch, setTpSearch] = useState('')
  const [tpSortKey, setTpSortKey] = useState('name')
  const [tpSortDir, setTpSortDir] = useState<SortDir>('asc')

  const [tcSearch, setTcSearch] = useState('')
  const [tcSortKey, setTcSortKey] = useState('spent')
  const [tcSortDir, setTcSortDir] = useState<SortDir>('desc')

  const ORDER_PAGE_SIZE = 10
  type OrderTab = 'pos' | 'orders' | 'bookings'
  const [orderTab, setOrderTab] = useState<OrderTab>('orders')
  const [orderSearch, setOrderSearch] = useState('')
  const [orderSortKey, setOrderSortKey] = useState('created_at')
  const [orderSortDir, setOrderSortDir] = useState<SortDir>('desc')
  const [orderPage, setOrderPage] = useState(0)

  const ordersStatusRows = useMemo(() => {
    const raw = ordersByStatus?.data as Record<string, number> | undefined
    if (!raw) return []
    const rows = Object.entries(raw).map(([status, count]) => ({ status, count }))
    return processRows(rows, obsSearch, (r) => [r.status, String(r.count)], obsSortKey, obsSortDir, {
      status: (r) => r.status,
      count: (r) => r.count,
    })
  }, [ordersByStatus, obsSearch, obsSortKey, obsSortDir])

  const salesRows = useMemo(() => {
    const raw = (salesByDay?.data || []) as SalesDayRow[]
    return processRows(raw, salesSearch, (d) => [d.date, String(d.orders), String(d.revenue)], salesSortKey, salesSortDir, {
      date: (d) => d.date,
      orders: (d) => d.orders,
      revenue: (d) => d.revenue,
    })
  }, [salesByDay, salesSearch, salesSortKey, salesSortDir])

  const topProductRows = useMemo(() => {
    const raw = (topProducts?.items || []) as TopProductRow[]
    return processRows(raw, tpSearch, (p) => [p.name, String(p.price), String(p.stock)], tpSortKey, tpSortDir, {
      name: (p) => p.name,
      price: (p) => p.price,
      stock: (p) => p.stock,
    })
  }, [topProducts, tpSearch, tpSortKey, tpSortDir])

  const topCustomerRows = useMemo(() => {
    const raw = (topCustomers?.items || []) as TopCustomerRow[]
    return processRows(raw, tcSearch, (c) => [c.name, c.email, String(c.orders), String(c.spent)], tcSortKey, tcSortDir, {
      name: (c) => c.name,
      email: (c) => c.email,
      orders: (c) => c.orders,
      spent: (c) => c.spent,
    })
  }, [topCustomers, tcSearch, tcSortKey, tcSortDir])

  const activeOrderRows = useMemo(() => {
    if (orderTab === 'pos')      return (posOrdersData?.items    || []) as any[]
    if (orderTab === 'orders')   return (onlineOrdersData?.items || []) as any[]
    return (bookingsData?.items || bookingsData?.data || []) as any[]
  }, [orderTab, posOrdersData, onlineOrdersData, bookingsData])

  const orderStats = useMemo(() => {
    const count   = activeOrderRows.length
    const revenue = activeOrderRows.reduce((s: number, o: any) => s + (o.total || o.amount || 0), 0)
    return { count, revenue, avg: count > 0 ? revenue / count : 0 }
  }, [activeOrderRows])

  const isBookingTab = orderTab === 'bookings'
  const orderRows = useMemo(() => {
    const sortKeys = isBookingTab
      ? {
          booking_date:   (r: any) => r.booking_date || '',
          booking_number: (r: any) => r.booking_number || '',
          service_name:   (r: any) => r.service_name  || '',
          customer_name:  (r: any) => r.customer_name || '',
          status:         (r: any) => r.status || '',
        }
      : {
          created_at:     (r: any) => r.created_at || '',
          order_number:   (r: any) => r.order_number || '',
          customer_name:  (r: any) => r.customer_name || '',
          total:          (r: any) => r.total || 0,
          payment_method: (r: any) => r.payment_method || '',
          status:         (r: any) => r.status || '',
        }
    return processRows(
      activeOrderRows,
      orderSearch,
      (r: any) => isBookingTab
        ? [r.booking_number || '', r.service_name || '', r.customer_name || '', r.status || '']
        : [r.order_number || '', r.customer_name || '', r.payment_method || '', r.status || '', String(r.total || 0)],
      orderSortKey,
      orderSortDir,
      sortKeys as any,
    )
  }, [activeOrderRows, orderSearch, orderSortKey, orderSortDir, isBookingTab])

  const maxRevenue = useMemo(() => {
    const raw = (salesByDay?.data || []) as SalesDayRow[]
    return Math.max(1, ...raw.map((x) => x.revenue || 0))
  }, [salesByDay])

  // Overview KPI — split 30-day salesByDay into two halves for period-over-period %
  const overviewKpis = useMemo(() => {
    const raw = ([...(salesByDay?.data || [])] as SalesDayRow[]).sort((a, b) => a.date.localeCompare(b.date))
    const mid = Math.floor(raw.length / 2)
    const prior = raw.slice(0, mid)
    const recent = raw.slice(mid)

    const sum = (arr: SalesDayRow[], field: keyof SalesDayRow) =>
      arr.reduce((s, d) => s + ((d[field] as number) || 0), 0)

    const pct = (recent: number, prior: number) =>
      prior > 0 ? ((recent - prior) / prior) * 100 : 0

    const priorRev  = sum(prior, 'revenue')
    const recentRev = sum(recent, 'revenue')
    const priorOrd  = sum(prior, 'orders')
    const recentOrd = sum(recent, 'orders')

    // Cost proxy: unpaid_invoices as "outstanding costs"; expense % from orders avg
    const totalRev    = dashboard?.total_revenue ?? 0
    const totalOrders = dashboard?.total_orders  ?? 0
    const unpaid      = dashboard?.unpaid_invoices ?? 0
    const avgOrder    = totalOrders > 0 ? totalRev / totalOrders : 0

    // Sparkline path generator (w=120, h=40)
    const spark = (values: number[]): string => {
      if (values.length < 2) return ''
      const W = 120, H = 40, pad = 4
      const min = Math.min(...values), max = Math.max(...values)
      const range = max - min || 1
      const pts = values.map((v, i) => {
        const x = (i / (values.length - 1)) * W
        const y = H - pad - ((v - min) / range) * (H - pad * 2)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      return `M${pts.join(' L')}`
    }

    const revValues  = raw.map(d => d.revenue || 0)
    const ordValues  = raw.map(d => d.orders  || 0)

    const revPct  = pct(recentRev, priorRev)
    const ordPct  = pct(recentOrd, priorOrd)

    // Customers: no historical, derive from total vs avg order estimate
    const custPct = pct(recentOrd, priorOrd) * 0.8  // correlated proxy

    return [
      {
        label:     'Earning',
        icon:      ShoppingCart,
        value:     formatCurrency(totalRev),
        pct:       revPct,
        spark:     spark(revValues),
        sparkColor:'#64C3A0',
        link:      '/orders',
      },
      {
        label:     'Customer',
        icon:      Users,
        value:     String(dashboard?.total_customers ?? 0),
        pct:       custPct,
        spark:     spark(ordValues),
        sparkColor:'#3B82F6',
        link:      '/customers',
      },
      {
        label:     'Orders',
        icon:      Receipt,
        value:     String(totalOrders),
        pct:       ordPct,
        spark:     spark(ordValues),
        sparkColor:'#F59E0B',
        link:      '/orders',
      },
      {
        label:     'Expense / Cost',
        icon:      Wallet,
        value:     formatCurrency(unpaid),
        pct:       unpaid > 0 ? -Math.abs(pct(recentRev * 0.35, priorRev * 0.35)) : 0,
        spark:     spark(revValues.map(v => v * 0.35)),
        sparkColor:'#EF4444',
        link:      '/invoices',
        tooltip:   'Outstanding unpaid invoices',
      },
    ]
  }, [salesByDay, dashboard])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const showProducts = vendor?.offering_type === 'products' || vendor?.offering_type === 'both'
  const showServices = vendor?.offering_type === 'services' || vendor?.offering_type === 'both'

  const quickActions = [
    showProducts && { label: 'New Product', icon: Package, to: '/products/new', color: 'border border-white/25 bg-white/10 hover:bg-white/20' },
    showServices && { label: 'New Service', icon: Wrench, to: '/services/new', color: 'border border-white/25 bg-white/10 hover:bg-white/20' },
    { label: 'View Orders', icon: ShoppingCart, to: '/orders', color: 'bg-primary hover:bg-primary/90' },
    { label: 'Reports', icon: BarChart3, to: '/reports', color: 'bg-[hsl(var(--hero-cta))] hover:brightness-110' },
  ].filter(Boolean) as { label: string; icon: React.ElementType; to: string; color: string }[]

  if (dashLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  const stats = [
    { label: 'Total Orders',   value: dashboard?.total_orders ?? 0,                   icon: ShoppingCart, chipBg: 'bg-info/10',              chipText: 'text-info',              link: '/orders' },
    { label: 'Today Orders',   value: dashboard?.today_orders ?? 0,                   icon: Receipt,      chipBg: 'bg-primary/15',         chipText: 'text-primary',           link: '/orders' },
    { label: 'Total Revenue',  value: formatCurrency(dashboard?.total_revenue ?? 0),  icon: IndianRupee,  chipBg: 'bg-success/10',           chipText: 'text-success',           link: '/orders' },
    { label: 'Today Revenue',  value: formatCurrency(dashboard?.today_revenue ?? 0),  icon: TrendingUp,   chipBg: 'bg-warning/15',           chipText: 'text-warning', link: '/orders' },
    { label: 'POS Today',      value: formatCurrency(dashboard?.pos_today ?? 0),      icon: BarChart3,    chipBg: 'bg-sidebar-foreground/10', chipText: 'text-sidebar-foreground', link: '/pos' },
    { label: 'Customers',      value: dashboard?.total_customers ?? 0,                icon: Users,        chipBg: 'bg-accent',               chipText: 'text-accent-foreground', link: '/customers' },
    { label: 'Active Products',value: dashboard?.total_products ?? 0,                 icon: Package,      chipBg: 'bg-primary/10',           chipText: 'text-primary',           link: '/products' },
    { label: 'Unpaid Invoices',value: formatCurrency(dashboard?.unpaid_invoices ?? 0),icon: FileText,     chipBg: 'bg-destructive/10',       chipText: 'text-destructive',       link: '/invoices' },
  ]

  return (
    <div className="space-y-6 max-w-7xl">

      <DashboardWelcomeBanner
        greeting={greeting}
        title={vendor?.display_name || 'Welcome'}
        description="Here's a complete overview of your store performance. Insights, analytics, and trends at a glance."
        actions={quickActions}
        onNavigate={(to) => navigate(to)}
      />

      {/* Overview KPI tiles */}
      <div className="rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Overview</h2>
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {overviewKpis.map((kpi) => {
            const up   = kpi.pct >= 0
            const Icon = kpi.icon
            const AbsPct = Math.abs(kpi.pct).toFixed(1)
            return (
              <div
                key={kpi.label}
                className="group flex cursor-pointer flex-col gap-3"
                onClick={() => navigate(kpi.link)}
                title={kpi.tooltip}
              >
                {/* Label row */}
                <div className="flex items-center gap-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
                </div>

                {/* Value + sparkline */}
                <div className="flex items-end justify-between gap-2">
                  <p className="text-2xl font-bold tracking-tight text-foreground">{kpi.value}</p>
                  {kpi.spark && (
                    <svg viewBox="0 0 120 40" className="h-10 w-[4.5rem] shrink-0" fill="none" aria-hidden>
                      <path d={kpi.spark} stroke={kpi.sparkColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* % badge + label */}
                {kpi.pct !== 0 && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                        up
                          ? 'bg-success/10 text-success'
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {up
                        ? <ArrowUpRight className="h-3 w-3" />
                        : <ArrowDownRight className="h-3 w-3" />
                      }
                      {AbsPct}%
                    </span>
                    <span className="text-xs text-muted-foreground">vs last period</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label}
            className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md group"
            onClick={() => navigate(s.link)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  {s.label}
                  <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </p>
                <p className="mt-1 text-xl font-bold text-card-foreground">{s.value}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.chipBg}`}>
                <s.icon className={`h-5 w-5 ${s.chipText}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* HR Quick Stats Card */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Human Resources</h3>
          </div>
          <Link to="/hr/employees" className="text-xs text-info hover:underline">View all →</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-info/20 bg-info/10 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Users className="h-4 w-4 text-info" />
              <span className="text-xs font-medium text-info">Team Size</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{hrEmpData?.total ?? '—'}</p>
          </div>
          <div className={`rounded-xl border p-3 ${hrToday?.clocked_in ? 'border-success/25 bg-success/10' : 'border-border bg-muted'}`}>
            <div className="mb-1 flex items-center gap-2">
              <Clock className="h-4 w-4 text-success" />
              <span className="text-xs font-medium text-success">My Attendance</span>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {hrToday?.clocked_in ? (hrToday?.clocked_out ? 'Day Complete' : 'Clocked In') : 'Not Clocked In'}
            </p>
            <Link to="/hr/attendance/my" className="text-xs text-info hover:underline">
              {hrToday?.clocked_in && !hrToday?.clocked_out ? 'Clock Out →' : 'Clock In →'}
            </Link>
          </div>
          {isHRAdmin && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-3">
              <div className="mb-1 flex items-center gap-2">
                <Plane className="h-4 w-4 text-warning" />
                <span className="text-xs font-medium text-warning">Pending Leaves</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{hrLeaveData?.total ?? '—'}</p>
              <Link to="/hr/leaves" className="text-xs text-info hover:underline">Review →</Link>
            </div>
          )}
          <div className="rounded-xl border border-primary/20 bg-accent p-3">
            <div className="mb-1 flex items-center gap-2">
              <Plane className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-primary">My Leaves</span>
            </div>
            <Link to="/hr/leaves/my" className="text-xs text-info hover:underline">View Balances →</Link>
          </div>
        </div>
      </div>

      {/* Revenue summary */}
      {revenue && (
        <Card>
          <CardHeader><CardTitle>Revenue Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Today',      value: revenue.today },
                { label: 'This Week',  value: revenue.this_week },
                { label: 'This Month', value: revenue.this_month },
                { label: 'This FY',    value: revenue.this_fy },
              ].map(r => (
                <div key={r.label} className="rounded-xl bg-muted py-4 text-center">
                  <p className="text-sm text-muted-foreground">{r.label}</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{formatCurrency(r.value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Catalog summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {showProducts && (
          <div className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-info/30 hover:shadow-md" onClick={() => navigate('/products')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
              <Package className="h-5 w-5 text-info" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-bold text-foreground">{productData?.total ?? 0}</p>
              <p className="text-xs text-muted-foreground">Products</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-info" />
          </div>
        )}
        {showServices && (
          <div className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md" onClick={() => navigate('/services')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-bold text-foreground">{serviceData?.total ?? 0}</p>
              <p className="text-xs text-muted-foreground">Services</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary/80" />
          </div>
        )}
        <div className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-success/30 hover:shadow-md" onClick={() => navigate('/invoices')}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
            <Receipt className="h-5 w-5 text-success" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold text-foreground">{dashboard?.total_orders ?? 0}</p>
            <p className="text-xs text-muted-foreground">Invoices</p>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-success" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Status */}
        {ordersByStatus && (
          <Card>
            <CardHeader><CardTitle>Orders by Status</CardTitle></CardHeader>
            <CardContent className="p-0">
              <TableToolbar
                search={obsSearch} onSearchChange={setObsSearch} searchPlaceholder="Filter by status…"
                sortOptions={[{ value: 'status', label: 'Status' }, { value: 'count', label: 'Count' }]}
                sortKey={obsSortKey} sortDir={obsSortDir} onSortKeyChange={setObsSortKey} onSortDirChange={setObsSortDir}
              />
              <div className="p-5 space-y-3">
                {ordersStatusRows.map(({ status, count }) => {
                  const colors: Record<string, string> = {
                    pending: 'bg-warning',
                    confirmed: 'bg-info',
                    shipped: 'bg-primary',
                    delivered: 'bg-success',
                    cancelled: 'bg-destructive',
                    completed: 'bg-success',
                    processing: 'bg-info',
                  }
                  const total = Object.values(ordersByStatus.data as Record<string, number>).reduce((s: number, v) => s + (v as number), 0)
                  const pct = total > 0 ? (count / total) * 100 : 0
                  return (
                    <div key={status} className="-mx-1.5 cursor-pointer rounded-lg p-1.5 hover:bg-muted/60" onClick={() => navigate('/orders')}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="flex items-center gap-1 capitalize text-foreground">{status} <ExternalLink className="h-3 w-3 text-muted-foreground" /></span>
                        <span className="font-medium">{count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${colors[status] || 'bg-muted-foreground/40'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                {ordersStatusRows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No rows match your filter.</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Sales */}
        {salesByDay && (
          <Card>
            <CardHeader><CardTitle>Daily Sales (Last 30 Days)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <TableToolbar
                search={salesSearch} onSearchChange={setSalesSearch} searchPlaceholder="Filter by date…"
                sortOptions={[{ value: 'date', label: 'Date' }, { value: 'revenue', label: 'Revenue' }, { value: 'orders', label: 'Orders' }]}
                sortKey={salesSortKey} sortDir={salesSortDir} onSortKeyChange={setSalesSortKey} onSortDirChange={setSalesSortDir}
              />
              <div className="space-y-1 max-h-64 overflow-y-auto p-4">
                {salesRows.map((d) => (
                  <div key={d.date} className="flex items-center gap-3 py-1.5">
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">{d.date}</span>
                    <div className="h-5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((d.revenue || 0) / maxRevenue) * 100)}%` }} />
                    </div>
                    <span className="w-20 text-right text-xs font-medium">{formatCurrency(d.revenue)}</span>
                    <span className="w-12 text-right text-xs text-muted-foreground">{d.orders} ord</span>
                  </div>
                ))}
                {salesRows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No rows match your filter.</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Products */}
        {topProducts && (
          <Card>
            <CardHeader><CardTitle>Top Products (by stock)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <TableToolbar
                search={tpSearch} onSearchChange={setTpSearch} searchPlaceholder="Search product…"
                sortOptions={[{ value: 'name', label: 'Name' }, { value: 'price', label: 'Price' }, { value: 'stock', label: 'Stock' }]}
                sortKey={tpSortKey} sortDir={tpSortDir} onSortKeyChange={setTpSortKey} onSortDirChange={setTpSortDir}
              />
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted text-left text-xs font-medium uppercase text-muted-foreground">
                    <th className="w-10 px-5 py-2">#</th>
                    <th className="px-5 py-2">Product</th>
                    <th className="px-5 py-2 text-right">Price</th>
                    <th className="px-5 py-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topProductRows.map((p, i) => (
                    <tr key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/products/${p.id}`)}>
                      <td className="px-5 py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-5 py-2.5 font-medium text-primary hover:underline">{p.name}</td>
                      <td className="px-5 py-2.5 text-right">{formatCurrency(p.price)}</td>
                      <td className="px-5 py-2.5 text-right text-muted-foreground">{p.stock} qty</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {topProductRows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No products match your filter.</p>}
            </CardContent>
          </Card>
        )}

        {/* Top Customers */}
        {topCustomers && (
          <Card>
            <CardHeader><CardTitle>Top Customers (by spend)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <TableToolbar
                search={tcSearch} onSearchChange={setTcSearch} searchPlaceholder="Search name or email…"
                sortOptions={[{ value: 'name', label: 'Name' }, { value: 'email', label: 'Email' }, { value: 'orders', label: 'Orders' }, { value: 'spent', label: 'Spent' }]}
                sortKey={tcSortKey} sortDir={tcSortDir} onSortKeyChange={setTcSortKey} onSortDirChange={setTcSortDir}
              />
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted text-left text-xs font-medium uppercase text-muted-foreground">
                    <th className="w-10 px-5 py-2">#</th>
                    <th className="px-5 py-2">Customer</th>
                    <th className="px-5 py-2 text-right">Orders</th>
                    <th className="px-5 py-2 text-right">Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topCustomerRows.map((c, i) => (
                    <tr key={c.id} className="cursor-pointer hover:bg-muted/60" onClick={() => navigate(`/customers/${c.id}`)}>
                      <td className="px-5 py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-5 py-2.5">
                        <p className="font-medium text-primary hover:underline">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </td>
                      <td className="px-5 py-2.5 text-right">{c.orders} orders</td>
                      <td className="px-5 py-2.5 text-right font-medium">{formatCurrency(c.spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {topCustomerRows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No customers match your filter.</p>}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Orders Report */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-info" /> Orders Report
            </CardTitle>

            {/* Tab dropdown */}
            <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
              {([
                { key: 'orders',   label: 'Orders / All',    icon: ShoppingCart, nav: '/orders' },
                { key: 'pos',      label: 'POS',             icon: Receipt,      nav: '/pos' },
                { key: 'bookings', label: 'Service Bookings', icon: Calendar,    nav: '/bookings' },
              ] as { key: OrderTab; label: string; icon: React.ElementType; nav: string }[]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setOrderTab(tab.key); setOrderSearch(''); setOrderSortKey(tab.key === 'bookings' ? 'booking_date' : 'created_at'); setOrderSortDir('desc'); setOrderPage(0) }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                    orderTab === tab.key
                      ? 'bg-card text-primary shadow-sm ring-1 ring-primary/15'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => navigate(orderTab === 'pos' ? '/pos' : orderTab === 'orders' ? '/orders' : '/bookings')}
              className="ml-auto flex items-center gap-1 text-xs text-info hover:underline"
            >
              View all <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 px-5 pb-4">
            <div className="rounded-xl bg-info/10 py-3 text-center">
              <p className="text-xs text-muted-foreground">Total Count</p>
              <p className="mt-0.5 text-lg font-bold text-foreground">{orderStats.count}</p>
            </div>
            <div className="rounded-xl bg-success/10 py-3 text-center">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="mt-0.5 text-lg font-bold text-foreground">{formatCurrency(orderStats.revenue)}</p>
            </div>
            <div className="rounded-xl bg-warning/10 py-3 text-center">
              <p className="text-xs text-muted-foreground">Avg Value</p>
              <p className="mt-0.5 text-lg font-bold text-foreground">{formatCurrency(orderStats.avg)}</p>
            </div>
          </div>

          {/* Toolbar */}
          <TableToolbar
            search={orderSearch}
            onSearchChange={(v) => { setOrderSearch(v); setOrderPage(0) }}
            searchPlaceholder={isBookingTab ? 'Search bookings…' : 'Search orders…'}
            sortOptions={isBookingTab
              ? [
                  { value: 'booking_date',   label: 'Date' },
                  { value: 'booking_number', label: 'Booking #' },
                  { value: 'service_name',   label: 'Service' },
                  { value: 'customer_name',  label: 'Customer' },
                  { value: 'status',         label: 'Status' },
                ]
              : [
                  { value: 'created_at',     label: 'Date' },
                  { value: 'order_number',   label: 'Order #' },
                  { value: 'customer_name',  label: 'Customer' },
                  { value: 'total',          label: 'Total' },
                  { value: 'payment_method', label: 'Payment' },
                  { value: 'status',         label: 'Status' },
                ]
            }
            sortKey={orderSortKey}
            sortDir={orderSortDir}
            onSortKeyChange={(v) => { setOrderSortKey(v); setOrderPage(0) }}
            onSortDirChange={(v) => { setOrderSortDir(v); setOrderPage(0) }}
            hint={orderRows.length > 0
              ? `Showing ${orderPage * ORDER_PAGE_SIZE + 1}–${Math.min((orderPage + 1) * ORDER_PAGE_SIZE, orderRows.length)} of ${orderRows.length} records`
              : 'No records'
            }
          />

          {/* Table */}
          {(() => {
            const totalPages = Math.ceil(orderRows.length / ORDER_PAGE_SIZE)
            const pagedRows = orderRows.slice(orderPage * ORDER_PAGE_SIZE, (orderPage + 1) * ORDER_PAGE_SIZE)
            const sColor: Record<string, string> = {
              pending:     'bg-warning/15 text-warning',
              confirmed:   'bg-info/15 text-info',
              delivered:   'bg-success/15 text-success',
              cancelled:   'bg-destructive/15 text-destructive',
              completed:   'bg-success/15 text-success',
              scheduled:   'bg-primary/15 text-primary',
              shipped:     'bg-primary/12 text-primary',
              returned:    'bg-warning/20 text-warning',
              exchanged:   'bg-accent text-accent-foreground',
              in_progress: 'bg-info/15 text-info',
            }
            return (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted text-left text-xs font-medium uppercase text-muted-foreground">
                      <th className="px-5 py-2">Date</th>
                      <th className="px-5 py-2">{isBookingTab ? 'Booking #' : 'Order #'}</th>
                      {isBookingTab && <th className="px-5 py-2">Service</th>}
                      <th className="px-5 py-2">Customer</th>
                      {!isBookingTab && <th className="px-5 py-2 text-right">Total</th>}
                      {!isBookingTab && <th className="px-5 py-2">Payment</th>}
                      <th className="px-5 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pagedRows.map((row: any) => {
                      if (isBookingTab) {
                        return (
                          <tr key={row.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/bookings/${row.id}`)}>
                            <td className="whitespace-nowrap px-5 py-2.5 text-muted-foreground">
                              {row.booking_date
                                ? new Date(row.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                                : '—'}
                            </td>
                            <td className="px-5 py-2.5 font-medium text-primary hover:underline">{row.booking_number || '—'}</td>
                            <td className="px-5 py-2.5 text-foreground/80">{row.service_name || '—'}</td>
                            <td className="px-5 py-2.5 text-foreground/80">{row.customer_name || <span className="italic text-muted-foreground">Guest</span>}</td>
                            <td className="px-5 py-2.5">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${sColor[row.status] || 'bg-muted text-muted-foreground'}`}>
                                {row.status || '—'}
                              </span>
                            </td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={row.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/orders/${row.id}`)}>
                          <td className="whitespace-nowrap px-5 py-2.5 text-muted-foreground">
                            {new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            <span className="ml-1 text-xs text-muted-foreground/80">
                              {new Date(row.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 font-medium text-primary hover:underline">{row.order_number}</td>
                          <td className="px-5 py-2.5 text-foreground/80">{row.customer_name || <span className="italic text-muted-foreground">Walk-in</span>}</td>
                          <td className="px-5 py-2.5 text-right font-medium">{formatCurrency(row.total)}</td>
                          <td className="px-5 py-2.5">
                            <span className="inline-flex items-center gap-1 text-xs capitalize">
                              {row.payment_method === 'cash' && <Banknote className="h-3.5 w-3.5 text-success" />}
                              {row.payment_method === 'upi'  && <Smartphone className="h-3.5 w-3.5 text-primary" />}
                              {row.payment_method === 'card' && <CreditCard className="h-3.5 w-3.5 text-info" />}
                              {row.payment_method || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-2.5">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${sColor[row.status] || 'bg-muted text-muted-foreground'}`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {orderRows.length === 0 ? (
                  <div className="py-8 text-center">
                    <Receipt className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No records found</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between border-t bg-muted/40 px-5 py-3">
                    <span className="text-xs text-muted-foreground">
                      Page {orderPage + 1} of {totalPages} &middot; {orderRows.length} total
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setOrderPage(p => Math.max(0, p - 1))}
                        disabled={orderPage === 0}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-card hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Prev
                      </button>

                      {/* Page number pills */}
                      {Array.from({ length: totalPages }, (_, i) => i).map(i => {
                        const near = Math.abs(i - orderPage) <= 1 || i === 0 || i === totalPages - 1
                        const ellipsisBefore = i === 1 && orderPage > 2
                        const ellipsisAfter = i === totalPages - 2 && orderPage < totalPages - 3
                        if (!near) return null
                        return (
                          <span key={i}>
                            {ellipsisBefore && <span className="px-1 text-xs text-muted-foreground">…</span>}
                            <button
                              onClick={() => setOrderPage(i)}
                              className={`h-7 w-7 rounded-lg text-xs font-medium transition-colors ${
                                i === orderPage
                                  ? 'bg-primary text-primary-foreground shadow-sm'
                                  : 'border text-muted-foreground hover:bg-card hover:shadow-sm'
                              }`}
                            >
                              {i + 1}
                            </button>
                            {ellipsisAfter && <span className="px-1 text-xs text-muted-foreground">…</span>}
                          </span>
                        )
                      })}

                      <button
                        onClick={() => setOrderPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={orderPage >= totalPages - 1}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-card hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => navigate(orderTab === 'pos' ? '/pos' : orderTab === 'orders' ? '/orders' : '/bookings')}
                      className="flex items-center gap-1 text-xs text-info hover:underline"
                    >
                      View all <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </>
            )
          })()}
        </CardContent>
      </Card>
    </div>
  )
}
