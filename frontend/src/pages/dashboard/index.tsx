import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff } from '@/lib/platformAccess'
import { useVendorStore } from '@/stores/vendorStore'
import { useAdminVendors, useAdminVendorStats } from '@/hooks/useAdmin'
import { Package, ShoppingCart, Users, IndianRupee, Store, Clock } from 'lucide-react'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'

function AdminDashboard() {
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErr,
  } = useAdminVendorStats()
  const {
    data,
    isLoading: listLoading,
    isError: listError,
    error: listErr,
  } = useAdminVendors({ page: 1, size: 5 })
  const isLoading = statsLoading || listLoading
  const loadError = statsError || listError
  const errDetail =
    (listErr as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail ??
    (statsErr as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  const errMessage =
    typeof errDetail === 'string'
      ? errDetail
      : errDetail != null
        ? JSON.stringify(errDetail)
        : 'Could not load dashboard data. Is the API running on port 8000?'

  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const vendorSortOptions = [
    { value: 'business_name', label: 'Business Name' },
    { value: 'email', label: 'Email' },
    { value: 'status', label: 'Status' },
    { value: 'created_at', label: 'Created' },
  ]

  const vendorAccessors: Record<string, (r: NonNullable<typeof data>['items'][number]) => unknown> = {
    business_name: (r) => r.business_name,
    email: (r) => r.primary_email,
    status: (r) => r.status,
    created_at: (r) => r.created_at ?? '',
  }

  const sortedVendors = useMemo(
    () =>
      processRows(data?.items?.slice(0, 5), '', () => [], sortKey, sortDir, vendorAccessors),
    [data?.items, sortKey, sortDir],
  )

  const statCards = [
    { name: 'Total business accounts', value: stats?.total ?? 0, icon: Store, color: 'bg-blue-500' },
    { name: 'Active business accounts', value: stats?.approved ?? 0, icon: Users, color: 'bg-green-500' },
    { name: 'Pending Review', value: stats?.pending_review ?? 0, icon: Clock, color: 'bg-yellow-500' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your platform</p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">Failed to load admin data</p>
          <p className="mt-1 text-red-700">{errMessage}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{stat.name}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="w-4 h-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent business accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent business accounts</CardTitle>
        </CardHeader>
        <TableToolbar
          search=""
          onSearchChange={() => {}}
          hideSearch={true}
          sortOptions={vendorSortOptions}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortKeyChange={setSortKey}
          onSortDirChange={setSortDir}
        />
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : sortedVendors.length ? (
            <div className="space-y-3">
              {sortedVendors.map((vendor) => (
                <div key={vendor.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{vendor.business_name}</p>
                    <p className="text-xs text-gray-500">{vendor.primary_email}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    vendor.status === 'approved' ? 'bg-green-100 text-green-700' :
                    vendor.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {vendor.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No business accounts yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function VendorDashboard() {
  const { vendor } = useVendorStore()

  const stats = [
    { name: 'Total Products', value: '0', icon: Package, color: 'bg-blue-500' },
    { name: 'Total Orders', value: '0', icon: ShoppingCart, color: 'bg-green-500' },
    { name: 'Customers', value: '0', icon: Users, color: 'bg-primary' },
    { name: 'Revenue', value: '0', icon: IndianRupee, color: 'bg-orange-500' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {vendor?.display_name}!</p>
      </div>

      {vendor?.status !== 'approved' && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <h3 className="font-medium text-yellow-800">Verification Pending</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Your vendor account is {vendor?.status}. Complete your profile and upload verification documents to get approved.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{stat.name}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="w-4 h-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Recent Orders</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">No orders yet</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-500">Get started by adding your first product</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()
  return isPlatformStaff(user) ? <AdminDashboard /> : <VendorDashboard />
}
