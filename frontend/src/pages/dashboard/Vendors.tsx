import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAdminVendors, useApproveVendor, useRejectVendor } from '@/hooks/useAdmin'
import { useAuthStore } from '@/stores/authStore'
import { isSuperuserAdmin } from '@/lib/platformAccess'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Eye,
  Store,
  Loader2,
} from 'lucide-react'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
const statusStyles: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-orange-100 text-orange-700',
  deactivated: 'bg-gray-100 text-gray-700',
}

const statusFilters: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Suspended', value: 'suspended' },
]

export default function Vendors() {
  const { user } = useAuthStore()
  const canManageVendors = isSuperuserAdmin(user)
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { data, isLoading, isFetching } = useAdminVendors({
    page,
    size: 10,
    status: statusFilter || undefined,
    search: search || undefined,
  })

  const approveVendor = useApproveVendor()
  const rejectVendor = useRejectVendor()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleApprove = (vendorId: string) => {
    if (confirm('Are you sure you want to approve this vendor?')) {
      approveVendor.mutate(vendorId)
    }
  }

  const handleReject = (vendorId: string) => {
    const reason = prompt('Enter rejection reason (min 10 chars):')
    if (reason && reason.length >= 10) {
      rejectVendor.mutate({ vendorId, reason })
    }
  }

  type VendorRow = NonNullable<typeof data>['items'][number]
  const displayVendors = useMemo(() => {
    if (!data?.items?.length) return []
    return processRows(
      data.items,
      '',
      () => [],
      sortKey,
      sortDir,
      {
        business_name: (v: VendorRow) => v.business_name || v.display_name || '',
        primary_email: (v: VendorRow) => v.primary_email || '',
        business_type: (v: VendorRow) => v.business_type || '',
        status: (v: VendorRow) => v.status,
        created_at: (v: VendorRow) => v.created_at,
      },
    )
  }, [data?.items, sortKey, sortDir])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-gray-600 mt-1">
            Manage all vendors on the platform
            {data?.total !== undefined && (
              <span className="ml-1 text-gray-500">({data.total} total)</span>
            )}
          </p>
        </div>
        {canManageVendors && (
          <Button onClick={() => navigate('/dashboard/vendors/add')} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Vendor
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by business name, email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit" variant="outline">
                Search
              </Button>
            </form>

            {/* Status filter */}
            <div className="flex gap-1 flex-wrap">
              {statusFilters.map((filter) => (
                <Button
                  key={filter.value}
                  variant={statusFilter === filter.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setStatusFilter(filter.value)
                    setPage(1)
                  }}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search=""
            onSearchChange={() => {}}
            hideSearch
            hint="Sorting applies to the current page."
            sortOptions={[
              { value: 'created_at', label: 'Created' },
              { value: 'business_name', label: 'Business' },
              { value: 'primary_email', label: 'Email' },
              { value: 'business_type', label: 'Type' },
              { value: 'status', label: 'Status' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Business
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500 mt-2">Loading vendors...</p>
                    </td>
                  </tr>
                ) : !data?.items?.length ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Store className="w-10 h-10 mx-auto text-gray-300" />
                      <p className="text-sm text-gray-500 mt-2">No vendors found</p>
                      {canManageVendors && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => navigate('/dashboard/vendors/add')}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add First Vendor
                        </Button>
                      )}
                    </td>
                  </tr>
                ) : (
                  displayVendors.map((vendor) => (
                    <tr
                      key={vendor.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Store className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {vendor.business_name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{vendor.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{vendor.primary_email}</p>
                        <p className="text-xs text-gray-500">{vendor.primary_phone}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 capitalize">
                          {vendor.business_type?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                            statusStyles[vendor.status] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {vendor.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(vendor.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {canManageVendors &&
                            (vendor.status === 'pending' || vendor.status === 'under_review') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleApprove(vendor.id)}
                                disabled={approveVendor.isPending}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleReject(vendor.id)}
                                disabled={rejectVendor.isPending}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 hover:text-gray-700"
                            title="View details"
                            onClick={() => navigate(`/dashboard/vendors/${vendor.id}`)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
              <p className="text-sm text-gray-500">
                Page {data.page} of {data.pages} ({data.total} vendors)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.pages || isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
