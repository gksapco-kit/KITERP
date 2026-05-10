import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'
import { isSuperuserAdmin } from '@/lib/platformAccess'
import type { PlatformStaffMember } from '@/api/admin.api'
import { usePlatformStaffList, useUpdatePlatformStaff } from '@/hooks/usePlatformStaff'
import { PlatformStaffEditForm } from '@/components/platform-team/PlatformStaffEditForm'
import { RmAssignedBusinessAccounts } from '@/components/platform-team/RmAssignedBusinessAccounts'
import { ResetPasswordModal } from '@/components/platform-team/ResetPasswordModal'
import { PlatformStaffAuditSection } from '@/components/platform-team/PlatformStaffAuditSection'
import { formatPlatformJobRole } from '@/lib/platformTeam'
import { ArrowLeft, KeyRound, Loader2, UserMinus, UserX } from 'lucide-react'

export default function PlatformTeamMemberDetail() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: members, isLoading, isError } = usePlatformStaffList()
  const updateStaff = useUpdatePlatformStaff()
  const [resetForMember, setResetForMember] = useState<PlatformStaffMember | null>(null)

  const member = useMemo(
    () => (members ?? []).find((m) => m.id === userId) ?? null,
    [members, userId],
  )

  const teamManagers = useMemo(
    () => (members ?? []).filter((m) => m.job_role === 'team_manager'),
    [members],
  )

  if (!isSuperuserAdmin(user)) {
    return <Navigate to="/dashboard" replace />
  }

  if (!userId) {
    return <Navigate to="/dashboard/platform-team" replace />
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
        Loading…
      </div>
    )
  }

  if (isError || !member) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Link
          to="/dashboard/platform-team"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to support team
        </Link>
        <p className="text-sm text-destructive">
          User not found or no longer has support access.
        </p>
      </div>
    )
  }

  const busy = updateStaff.isPending

  return (
    <div className="space-y-6 w-full max-w-none">
      <Link
        to="/dashboard/platform-team"
        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to support team
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
        <div className="space-y-6 min-w-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{member.full_name}</h1>
            <p className="text-sm text-muted-foreground mt-1">Support team member</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="font-medium">{member.email || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="font-medium">{member.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="font-medium">{formatPlatformJobRole(member.job_role)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Manager</dt>
                  <dd className="font-medium">{member.manager_name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <span
                      className={
                        member.is_active
                          ? 'text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs'
                          : 'text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-xs'
                      }
                    >
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Added</dt>
                  <dd className="font-medium">{member.created_at ? member.created_at.slice(0, 10) : '—'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <PlatformStaffEditForm member={member} teamManagers={teamManagers} />

          <PlatformStaffAuditSection scope="member" memberUserId={member.id} />

          {member.job_role === 'relationship_manager' && (
            <RmAssignedBusinessAccounts
              relationshipManagerUserId={member.id}
              rmName={member.full_name}
            />
          )}
        </div>

        <aside className="lg:sticky lg:top-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                disabled={busy}
                onClick={() => setResetForMember(member)}
              >
                <KeyRound className="w-4 h-4 mr-2 shrink-0" />
                Reset password
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                disabled={busy}
                onClick={() =>
                  updateStaff.mutate({
                    userId: member.id,
                    data: { is_active: !member.is_active },
                  })
                }
              >
                <UserMinus className="w-4 h-4 mr-2 shrink-0" />
                {member.is_active ? 'Deactivate login' : 'Reactivate login'}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="justify-start"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      'Remove platform access? They will no longer be able to open this admin app.',
                    )
                  ) {
                    updateStaff.mutate(
                      { userId: member.id, data: { remove_access: true } },
                      {
                        onSuccess: () => navigate('/dashboard/platform-team'),
                      },
                    )
                  }
                }}
              >
                <UserX className="w-4 h-4 mr-2 shrink-0" />
                Remove platform access
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <ResetPasswordModal member={resetForMember} onClose={() => setResetForMember(null)} />
    </div>
  )
}
