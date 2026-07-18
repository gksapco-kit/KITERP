import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AssignRmToAccountsModal } from '@/components/platform-team/AssignRmToAccountsModal'
import { useAdminVendors, useApproveVendor, useRejectVendor } from '@/hooks/useAdmin'
import { Check, ChevronLeft, ChevronRight, Eye, Loader2, Store, UserPlus, X } from 'lucide-react'

import { askConfirm } from '@/components/common/ConfirmProvider'
const statusStyles: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-orange-100 text-orange-700',
  deactivated: 'bg-gray-100 text-gray-700',
}

type Props = {
  relationshipManagerUserId: string
  rmName: string
}

export function RmAssignedBusinessAccounts({ relationshipManagerUserId, rmName }: Props) {
  const navigate = useNavigate()
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  useEffect(() => {
    setPage(1)
  }, [relationshipManagerUserId])

  const { data, isLoading, isFetching } = useAdminVendors({
    page,
    size: pageSize,
    relationship_manager_user_id: relationshipManagerUserId,
  })

  const approveVendor = useApproveVendor()
  const rejectVendor = useRejectVendor()

  const handleApprove = async (vendorId: string) => {
    if (await askConfirm('Approve this business account?')) {
      approveVendor.mutate(vendorId)
    }
  }

  const handleReject = (vendorId: string) => {
    const reason = prompt('Enter rejection reason (min 10 chars):')
    if (reason && reason.length >= 10) {
      rejectVendor.mutate({ vendorId, reason })
    }
  }

  const items = data?.items ?? []
  const busy = approveVendor.isPending || rejectVendor.isPending

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Assigned business accounts</CardTitle>
          <p className="text-sm text-muted-foreground font-normal mt-1">
            Businesses where <span className="font-medium text-foreground">{rmName}</span> is the relationship
            manager. Use <strong className="font-medium text-foreground">Manage assignments</strong> to add
            accounts, clear RM, or move them to another manager. Open the filtered directory to review their
            portfolio.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={() => setAssignModalOpen(true)}
          >
            <UserPlus className="w-4 h-4" />
            Manage assignments
          </Button>
          <Button variant="outline" size="sm" className="w-fit" asChild>
            <Link
              to={`/dashboard/vendors?relationship_manager_user_id=${encodeURIComponent(relationshipManagerUserId)}`}
            >
              Open full directory
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading assigned accounts…
          </div>
        ) : items.length === 0 ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              No business accounts are assigned to this relationship manager yet.
            </p>
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setAssignModalOpen(true)}>
              <UserPlus className="w-4 h-4" />
              Manage assignments
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground">Business</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Contact</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground text-right w-[1%] whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((v) => (
                    <tr
                      key={v.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => navigate(`/dashboard/vendors/${v.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigate(`/dashboard/vendors/${v.id}`)
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open business account ${v.display_name || v.business_name}`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center shrink-0">
                            <Store className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{v.business_name || v.display_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{v.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <p className="truncate max-w-[14rem] lg:max-w-md">{v.primary_email || '—'}</p>
                        <p className="text-xs truncate max-w-[14rem] lg:max-w-md">{v.primary_phone || ''}</p>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                            statusStyles[v.status] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {v.status?.replace('_', ' ') ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div
                          className="inline-flex flex-nowrap items-center justify-end gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {(v.status === 'pending' || v.status === 'under_review') && (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                disabled={busy}
                                title="Approve"
                                onClick={() => handleApprove(v.id)}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                disabled={busy}
                                title="Reject"
                                onClick={() => handleReject(v.id)}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title="View details"
                            onClick={() => navigate(`/dashboard/vendors/${v.id}`)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data && data.pages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  Page {data.page} of {data.pages} ({data.total} assigned)
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    type="button"
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
          </>
        )}
      </CardContent>

      {assignModalOpen && (
        <AssignRmToAccountsModal
          relationshipManagerUserId={relationshipManagerUserId}
          rmName={rmName}
          onClose={() => setAssignModalOpen(false)}
        />
      )}
    </Card>
  )
}
