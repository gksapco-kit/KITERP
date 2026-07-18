import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useAdminVendors,
  useApproveVendor,
  useRejectVendor,
  useDeleteVendor,
  useRelationshipManagerOptions,
} from '@/hooks/useAdmin'
import { useAuthStore } from '@/stores/authStore'
import {
  canCreateBusinessAccounts,
  isPlatformStaff,
  isSuperuserAdmin,
} from '@/lib/platformAccess'
import { platformTeamSelectClassName } from '@/lib/platformTeam'
import { cn } from '@/lib/utils'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Eye,
  Store,
  Loader2,
  Plus,
  Globe,
  Trash2,
} from 'lucide-react'
import { TableToolbar } from '@/components/table/TableToolbar'
import { DeleteBusinessAccountModal } from '@/components/admin/DeleteBusinessAccountModal'
import type { AdminVendor } from '@/api/admin.api'
import { processRows, type SortDir } from '@/lib/tableList'
import { askConfirm } from '@/components/common/ConfirmProvider'
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
  const canCreateVendor = canCreateBusinessAccounts(user)
  const canApproveRejectVendors = isSuperuserAdmin(user)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const rmFilterFromUrl = (searchParams.get('relationship_manager_user_id') || '').trim()

  /** Only superusers get the RM dropdown. Support accounts never see it. */
  const showRmDropdown = isSuperuserAdmin(user) && !rmFilterFromUrl

  /** Deep link / RM profile link: non-superuser support (not an RM) still filters via URL but sees read-only context. */
  const showRmReadOnlyBanner =
    !!rmFilterFromUrl &&
    (isSuperuserAdmin(user) ||
      (isPlatformStaff(user) &&
        !user?.is_superuser &&
        user?.platform_staff_job_role !== 'relationship_manager'))

  const relationshipManagerUserIdForApi =
    !rmFilterFromUrl
      ? undefined
      : user?.is_superuser
        ? rmFilterFromUrl
        : user?.platform_staff_job_role === 'relationship_manager'
          ? undefined
          : rmFilterFromUrl

  const loadRelationshipManagerOptions = isSuperuserAdmin(user) || showRmReadOnlyBanner
  const { data: rmOptions } = useRelationshipManagerOptions(loadRelationshipManagerOptions)

  const { data, isLoading, isFetching } = useAdminVendors({
    page,
    size: 10,
    status: statusFilter || undefined,
    search: search || undefined,
    relationship_manager_user_id: relationshipManagerUserIdForApi,
  })

  useEffect(() => {
    setPage(1)
  }, [relationshipManagerUserIdForApi])

  const approveVendor = useApproveVendor()
  const rejectVendor = useRejectVendor()
  const deleteVendor = useDeleteVendor()
  const [deleteTarget, setDeleteTarget] = useState<AdminVendor | null>(null)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleApprove = async (vendorId: string) => {
    if (await askConfirm('Are you sure you want to approve this business account?')) {
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

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteVendor.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }
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
        relationship_manager: (v: VendorRow) =>
          v.relationship_manager?.full_name || '',
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

  const selectedRmName = useMemo(() => {
    if (!rmFilterFromUrl || !rmOptions?.length) return null
    const o = rmOptions.find((row) => row.id === rmFilterFromUrl)
    if (!o) return null
    const login =
      o.login_display?.trim() || o.email?.trim() || o.phone?.trim() || o.full_name?.trim() || null
    const name = o.full_name?.trim()
    if (login && name && login !== name) return `${login} (${name})`
    return login || name || null
  }, [rmFilterFromUrl, rmOptions])

  const filteredRmOption = useMemo(
    () =>
      rmFilterFromUrl && rmOptions?.length
        ? rmOptions.find((row) => row.id === rmFilterFromUrl)
        : undefined,
    [rmFilterFromUrl, rmOptions],
  )

  /** Plain copy when URL pins an RM: login/email — role (no dropdown). */
  const rmFilteredReadOnlyLine = useMemo(() => {
    if (!rmFilterFromUrl) return null
    const o = filteredRmOption
    if (!o) {
      return 'This manager is not in the current directory list. Use “Show all accounts” below to remove the filter.'
    }
    const mailOrLogin =
      o.email?.trim() ||
      o.login_display?.trim() ||
      o.phone?.trim() ||
      o.full_name?.trim() ||
      ''
    const role = o.role_label?.trim() || 'Relationship manager'
    if (!mailOrLogin) return role
    return `${mailOrLogin} — ${role}`
  }, [rmFilterFromUrl, filteredRmOption])

  const setRmFilter = (userId: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (userId) next.set('relationship_manager_user_id', userId)
        else next.delete('relationship_manager_user_id')
        return next
      },
      { replace: true },
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Business Accounts</h1>
          <p className="text-gray-600 mt-1">
            View and manage accounts; assign a relationship manager from each account&apos;s admin page
            {data?.total !== undefined && (
              <span className="ml-1 text-gray-500">
                ({data.total}
                {relationshipManagerUserIdForApi
                  ? ` assigned${selectedRmName ? ` to ${selectedRmName}` : ''}`
                  : ' total'}
                )
              </span>
            )}
          </p>
        </div>
        {canCreateVendor && (
          <Button
            type="button"
            onClick={() => navigate('/dashboard/vendors/add')}
            className="gap-2 shrink-0 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Create business account
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-end lg:flex-wrap">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 flex gap-2 min-w-[240px]">
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

            {showRmReadOnlyBanner && (
              <div className="w-full sm:max-w-md shrink-0 space-y-1">
                <p className="text-sm font-medium text-gray-900">Relationship manager</p>
                <p className="text-sm text-gray-800">{rmFilteredReadOnlyLine}</p>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline font-medium"
                  onClick={() => setRmFilter('')}
                >
                  Show all accounts
                </button>
                <p className="text-xs text-muted-foreground">
                  Limited to accounts assigned to this manager. Open full directory from an RM&apos;s profile uses
                  the same filter.
                </p>
              </div>
            )}

            {showRmDropdown && (
              <div className="w-full sm:w-72 shrink-0">
                <Label htmlFor="vendor-rm-filter">Relationship manager</Label>
                <select
                  id="vendor-rm-filter"
                  className={cn(platformTeamSelectClassName, 'mt-1')}
                  value={rmFilterFromUrl}
                  onChange={(e) => {
                    setRmFilter(e.target.value)
                  }}
                >
                  <option value="">All managers</option>
                  {(rmOptions ?? []).map((o) => {
                    const login =
                      o.login_display?.trim() ||
                      o.email?.trim() ||
                      o.phone?.trim() ||
                      o.full_name?.trim() ||
                      o.id
                    const name = o.full_name?.trim()
                    const label = name && login !== name ? `${login} — ${name}` : login
                    return (
                      <option key={o.id} value={o.id}>
                        {label}
                      </option>
                    )
                  })}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Limit rows to accounts assigned to this RM. Open full directory from an RM&apos;s profile applies
                  the same filter.
                </p>
              </div>
            )}

            {/* Status filter */}
            <div className="flex gap-1 flex-wrap lg:flex-1 lg:justify-end">
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
              { value: 'relationship_manager', label: 'RM' },
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
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Business
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    RM
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500 mt-2">Loading business accounts...</p>
                    </td>
                  </tr>
                ) : !data?.items?.length ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <Store className="w-10 h-10 mx-auto text-gray-300" />
                      {relationshipManagerUserIdForApi ? (
                        <>
                          <p className="text-sm text-gray-600 mt-2 max-w-lg mx-auto">
                            No accounts are assigned to this relationship manager yet. Use{' '}
                            <strong>View all accounts</strong>, open an existing business, and set{' '}
                            <strong>Relationship manager</strong> on its admin page.
                          </p>
                          {!!relationshipManagerUserIdForApi && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-4"
                              onClick={() => setRmFilter('')}
                            >
                              View all accounts
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-gray-600 mt-2 max-w-lg mx-auto">
                            {search || statusFilter
                              ? 'No business accounts match the current search or status filters.'
                              : user?.platform_staff_job_role === 'relationship_manager' &&
                                  !user?.is_superuser
                                ? "No business accounts are assigned to you yet. Your administrator can assign accounts to you from each account's admin page."
                                : 'No business accounts match this view. Assignments use existing accounts—open one from the list (when available) and set Relationship manager there.'}
                          </p>
                          {(search || statusFilter) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-4"
                              onClick={() => {
                                setSearchInput('')
                                setSearch('')
                                setStatusFilter('')
                                setPage(1)
                              }}
                            >
                              Clear filters
                            </Button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  displayVendors.map((vendor) => (
                    <tr
                      key={vendor.id}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => navigate(`/dashboard/vendors/${vendor.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigate(`/dashboard/vendors/${vendor.id}`)
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open business account ${vendor.display_name || vendor.business_name}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Store className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {vendor.business_name}
                              </p>
                              {vendor.external_domain_access_status === 'pending' && (
                                <span title="Domain request pending KIT ERP approval"
                                  className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 shrink-0">
                                  <Globe className="h-2.5 w-2.5" /> Domain
                                </span>
                              )}
                              {vendor.external_domain_access_status === 'active' && (
                                <span title="External domain is live"
                                  className="inline-flex items-center gap-0.5 rounded-full bg-green-100 border border-green-200 px-1.5 py-0.5 text-[10px] font-medium text-green-700 shrink-0">
                                  <Globe className="h-2.5 w-2.5" /> Live
                                </span>
                              )}
                            </div>
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
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {vendor.relationship_manager?.full_name || (
                          <span className="text-gray-400">—</span>
                        )}
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
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {canApproveRejectVendors &&
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
                          {canApproveRejectVendors && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete business account"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteTarget(vendor)
                              }}
                              disabled={deleteVendor.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
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
            <div className="flex flex-col gap-3 px-4 py-4 border-t bg-gray-50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm text-gray-500">
                Page {data.page} of {data.pages} ({data.total} business accounts)
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

      <DeleteBusinessAccountModal
        vendor={deleteTarget}
        isPending={deleteVendor.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
