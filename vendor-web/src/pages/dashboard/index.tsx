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
  UserCog, Clock, Plane, LogIn, LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

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

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const showProducts = vendor?.offering_type === 'products' || vendor?.offering_type === 'both'
  const showServices = vendor?.offering_type === 'services' || vendor?.offering_type === 'both'

  const quickActions = [
    showProducts && { label: 'New Product', icon: Package, to: '/products/new', color: 'bg-blue-600 hover:bg-blue-700' },
    showServices && { label: 'New Service', icon: Wrench, to: '/services/new', color: 'bg-violet-600 hover:bg-violet-700' },
    { label: 'View Orders', icon: ShoppingCart, to: '/orders', color: 'bg-emerald-600 hover:bg-emerald-700' },
    { label: 'Reports', icon: BarChart3, to: '/reports', color: 'bg-gray-700 hover:bg-gray-800' },
  ].filter(Boolean) as { label: string; icon: React.ElementType; to: string; color: string }[]

  if (dashLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>

  const stats = [
    { label: 'Total Orders',   value: dashboard?.total_orders ?? 0,                   icon: ShoppingCart, color: 'bg-blue-500',    link: '/orders' },
    { label: 'Today Orders',   value: dashboard?.today_orders ?? 0,                   icon: Receipt,      color: 'bg-purple-500',  link: '/orders' },
    { label: 'Total Revenue',  value: formatCurrency(dashboard?.total_revenue ?? 0),  icon: IndianRupee,  color: 'bg-emerald-500', link: '/orders' },
    { label: 'Today Revenue',  value: formatCurrency(dashboard?.today_revenue ?? 0),  icon: TrendingUp,   color: 'bg-amber-500',   link: '/orders' },
    { label: 'POS Today',      value: formatCurrency(dashboard?.pos_today ?? 0),      icon: BarChart3,    color: 'bg-indigo-500',  link: '/pos' },
    { label: 'Customers',      value: dashboard?.total_customers ?? 0,                icon: Users,        color: 'bg-pink-500',    link: '/customers' },
    { label: 'Active Products',value: dashboard?.total_products ?? 0,                 icon: Package,      color: 'bg-teal-500',    link: '/products' },
    { label: 'Unpaid Invoices',value: formatCurrency(dashboard?.unpaid_invoices ?? 0),icon: FileText,     color: 'bg-red-500',     link: '/invoices' },
  ]

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-blue-600 to-blue-700 p-6 lg:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative">
          <p className="text-blue-100 text-sm font-medium">{greeting}</p>
          <h1 className="text-2xl lg:text-3xl font-bold mt-1">{vendor?.display_name || 'Welcome'}</h1>
          <p className="text-blue-200 mt-2 text-sm max-w-lg">
            Here's a complete overview of your store performance. Insights, analytics, and trends at a glance.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {quickActions.map(action => (
              <Button
                key={action.to}
                size="sm"
                className={`${action.color} text-white gap-1.5 shadow-lg shadow-black/10`}
                onClick={() => navigate(action.to)}
              >
                <action.icon className="w-3.5 h-3.5" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label}
            className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigate(s.link)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  {s.label}
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
                <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${s.color} bg-opacity-10 flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.color.replace('bg-', 'text-')}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* HR Quick Stats Card */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Human Resources</h3>
          </div>
          <Link to="/hr/employees" className="text-xs text-blue-600 hover:underline">View all →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-blue-600 font-medium">Team Size</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{hrEmpData?.total ?? '—'}</p>
          </div>
          <div className={`rounded-xl p-3 border ${hrToday?.clocked_in ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-green-600" />
              <span className="text-xs text-green-600 font-medium">My Attendance</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {hrToday?.clocked_in ? (hrToday?.clocked_out ? 'Day Complete' : 'Clocked In') : 'Not Clocked In'}
            </p>
            <Link to="/hr/attendance/my" className="text-xs text-blue-500 hover:underline">
              {hrToday?.clocked_in && !hrToday?.clocked_out ? 'Clock Out →' : 'Clock In →'}
            </Link>
          </div>
          {isHRAdmin && (
            <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100">
              <div className="flex items-center gap-2 mb-1">
                <Plane className="w-4 h-4 text-yellow-600" />
                <span className="text-xs text-yellow-600 font-medium">Pending Leaves</span>
              </div>
              <p className="text-2xl font-bold text-yellow-900">{hrLeaveData?.total ?? '—'}</p>
              <Link to="/hr/leaves" className="text-xs text-blue-500 hover:underline">Review →</Link>
            </div>
          )}
          <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
            <div className="flex items-center gap-2 mb-1">
              <Plane className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-purple-600 font-medium">My Leaves</span>
            </div>
            <Link to="/hr/leaves/my" className="text-xs text-blue-500 hover:underline">View Balances →</Link>
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
                <div key={r.label} className="text-center py-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">{r.label}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(r.value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Catalog summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {showProducts && (
          <div className="group flex items-center gap-4 bg-white rounded-xl border border-gray-200/80 p-4 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer" onClick={() => navigate('/products')}>
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold text-gray-900">{productData?.total ?? 0}</p>
              <p className="text-xs text-gray-500">Products</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </div>
        )}
        {showServices && (
          <div className="group flex items-center gap-4 bg-white rounded-xl border border-gray-200/80 p-4 hover:shadow-md hover:border-violet-200 transition-all cursor-pointer" onClick={() => navigate('/services')}>
            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold text-gray-900">{serviceData?.total ?? 0}</p>
              <p className="text-xs text-gray-500">Services</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-violet-500 transition-colors" />
          </div>
        )}
        <div className="group flex items-center gap-4 bg-white rounded-xl border border-gray-200/80 p-4 hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer" onClick={() => navigate('/invoices')}>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold text-gray-900">{dashboard?.total_orders ?? 0}</p>
            <p className="text-xs text-gray-500">Invoices</p>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors" />
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
                  const colors: Record<string, string> = { pending: 'bg-yellow-500', confirmed: 'bg-blue-500', shipped: 'bg-purple-500', delivered: 'bg-green-500', cancelled: 'bg-red-500' }
                  const total = Object.values(ordersByStatus.data as Record<string, number>).reduce((s: number, v) => s + (v as number), 0)
                  const pct = total > 0 ? (count / total) * 100 : 0
                  return (
                    <div key={status} className="cursor-pointer hover:bg-gray-50 rounded-lg p-1.5 -mx-1.5" onClick={() => navigate('/orders')}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize text-gray-700 flex items-center gap-1">{status} <ExternalLink className="w-3 h-3 text-gray-300" /></span>
                        <span className="font-medium">{count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors[status] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                {ordersStatusRows.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No rows match your filter.</p>}
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
                    <span className="text-xs text-gray-500 w-24 shrink-0">{d.date}</span>
                    <div className="flex-1 h-5 bg-gray-50 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, ((d.revenue || 0) / maxRevenue) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium w-20 text-right">{formatCurrency(d.revenue)}</span>
                    <span className="text-xs text-gray-400 w-12 text-right">{d.orders} ord</span>
                  </div>
                ))}
                {salesRows.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No rows match your filter.</p>}
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
                  <tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="px-5 py-2 w-10">#</th>
                    <th className="px-5 py-2">Product</th>
                    <th className="px-5 py-2 text-right">Price</th>
                    <th className="px-5 py-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topProductRows.map((p, i) => (
                    <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/products/${p.id}`)}>
                      <td className="px-5 py-2.5 text-gray-400">{i + 1}</td>
                      <td className="px-5 py-2.5 font-medium text-blue-600 hover:underline">{p.name}</td>
                      <td className="px-5 py-2.5 text-right">{formatCurrency(p.price)}</td>
                      <td className="px-5 py-2.5 text-right text-gray-500">{p.stock} qty</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {topProductRows.length === 0 && <p className="text-sm text-gray-500 text-center py-6">No products match your filter.</p>}
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
                  <tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="px-5 py-2 w-10">#</th>
                    <th className="px-5 py-2">Customer</th>
                    <th className="px-5 py-2 text-right">Orders</th>
                    <th className="px-5 py-2 text-right">Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topCustomerRows.map((c, i) => (
                    <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                      <td className="px-5 py-2.5 text-gray-400">{i + 1}</td>
                      <td className="px-5 py-2.5">
                        <p className="font-medium text-blue-600 hover:underline">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.email}</p>
                      </td>
                      <td className="px-5 py-2.5 text-right">{c.orders} orders</td>
                      <td className="px-5 py-2.5 text-right font-medium">{formatCurrency(c.spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {topCustomerRows.length === 0 && <p className="text-sm text-gray-500 text-center py-6">No customers match your filter.</p>}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Orders Report */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" /> Orders Report
            </CardTitle>

            {/* Tab dropdown */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              {([
                { key: 'orders',   label: 'Orders / All',    icon: ShoppingCart, nav: '/orders' },
                { key: 'pos',      label: 'POS',             icon: Receipt,      nav: '/pos' },
                { key: 'bookings', label: 'Service Bookings', icon: Calendar,    nav: '/bookings' },
              ] as { key: OrderTab; label: string; icon: React.ElementType; nav: string }[]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setOrderTab(tab.key); setOrderSearch(''); setOrderSortKey(tab.key === 'bookings' ? 'booking_date' : 'created_at'); setOrderSortDir('desc'); setOrderPage(0) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    orderTab === tab.key
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => navigate(orderTab === 'pos' ? '/pos' : orderTab === 'orders' ? '/orders' : '/bookings')}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 ml-auto"
            >
              View all <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 px-5 pb-4">
            <div className="text-center py-3 bg-indigo-50 rounded-xl">
              <p className="text-xs text-gray-500">Total Count</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{orderStats.count}</p>
            </div>
            <div className="text-center py-3 bg-emerald-50 rounded-xl">
              <p className="text-xs text-gray-500">Total Revenue</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{formatCurrency(orderStats.revenue)}</p>
            </div>
            <div className="text-center py-3 bg-amber-50 rounded-xl">
              <p className="text-xs text-gray-500">Avg Value</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{formatCurrency(orderStats.avg)}</p>
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
              pending:     'bg-yellow-100 text-yellow-800',
              confirmed:   'bg-blue-100 text-blue-800',
              delivered:   'bg-green-100 text-green-800',
              cancelled:   'bg-red-100 text-red-800',
              completed:   'bg-green-100 text-green-800',
              scheduled:   'bg-purple-100 text-purple-800',
              shipped:     'bg-indigo-100 text-indigo-800',
              returned:    'bg-orange-100 text-orange-800',
              exchanged:   'bg-teal-100 text-teal-800',
              in_progress: 'bg-blue-100 text-blue-800',
            }
            return (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
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
                          <tr key={row.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/bookings/${row.id}`)}>
                            <td className="px-5 py-2.5 text-gray-500 whitespace-nowrap">
                              {row.booking_date
                                ? new Date(row.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                                : '—'}
                            </td>
                            <td className="px-5 py-2.5 font-medium text-blue-600 hover:underline">{row.booking_number || '—'}</td>
                            <td className="px-5 py-2.5 text-gray-600">{row.service_name || '—'}</td>
                            <td className="px-5 py-2.5 text-gray-600">{row.customer_name || <span className="text-gray-400 italic">Guest</span>}</td>
                            <td className="px-5 py-2.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${sColor[row.status] || 'bg-gray-100 text-gray-700'}`}>
                                {row.status || '—'}
                              </span>
                            </td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={row.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/orders/${row.id}`)}>
                          <td className="px-5 py-2.5 text-gray-500 whitespace-nowrap">
                            {new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            <span className="text-gray-400 ml-1 text-xs">
                              {new Date(row.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 font-medium text-blue-600 hover:underline">{row.order_number}</td>
                          <td className="px-5 py-2.5 text-gray-600">{row.customer_name || <span className="text-gray-400 italic">Walk-in</span>}</td>
                          <td className="px-5 py-2.5 text-right font-medium">{formatCurrency(row.total)}</td>
                          <td className="px-5 py-2.5">
                            <span className="inline-flex items-center gap-1 text-xs capitalize">
                              {row.payment_method === 'cash' && <Banknote className="w-3.5 h-3.5 text-green-600" />}
                              {row.payment_method === 'upi'  && <Smartphone className="w-3.5 h-3.5 text-purple-600" />}
                              {row.payment_method === 'card' && <CreditCard className="w-3.5 h-3.5 text-blue-600" />}
                              {row.payment_method || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${sColor[row.status] || 'bg-gray-100 text-gray-700'}`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {orderRows.length === 0 ? (
                  <div className="text-center py-8">
                    <Receipt className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No records found</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50/60">
                    <span className="text-xs text-gray-500">
                      Page {orderPage + 1} of {totalPages} &middot; {orderRows.length} total
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setOrderPage(p => Math.max(0, p - 1))}
                        disabled={orderPage === 0}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white hover:shadow-sm"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                      </button>

                      {/* Page number pills */}
                      {Array.from({ length: totalPages }, (_, i) => i).map(i => {
                        const near = Math.abs(i - orderPage) <= 1 || i === 0 || i === totalPages - 1
                        const ellipsisBefore = i === 1 && orderPage > 2
                        const ellipsisAfter = i === totalPages - 2 && orderPage < totalPages - 3
                        if (!near) return null
                        return (
                          <span key={i}>
                            {ellipsisBefore && <span className="px-1 text-xs text-gray-400">…</span>}
                            <button
                              onClick={() => setOrderPage(i)}
                              className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                                i === orderPage
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'hover:bg-white hover:shadow-sm text-gray-600 border'
                              }`}
                            >
                              {i + 1}
                            </button>
                            {ellipsisAfter && <span className="px-1 text-xs text-gray-400">…</span>}
                          </span>
                        )
                      })}

                      <button
                        onClick={() => setOrderPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={orderPage >= totalPages - 1}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white hover:shadow-sm"
                      >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => navigate(orderTab === 'pos' ? '/pos' : orderTab === 'orders' ? '/orders' : '/bookings')}
                      className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      View all <ExternalLink className="w-3 h-3" />
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
