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
import { formatPlatformJobRole, isRelationshipManagerRole, isTeamManagerRole } from '@/lib/platformTeam'
import { usePlatformJobRoles } from '@/hooks/usePlatformJobRoles'
import { ArrowLeft, KeyRound, Loader2, UserMinus, UserX } from 'lucide-react'

export default function PlatformTeamMemberDetail() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: members, isLoading, isError } = usePlatformStaffList()
  const { data: rolesData } = usePlatformJobRoles()
  const updateStaff = useUpdatePlatformStaff()
  const [resetForMember, setResetForMember] = useState<PlatformStaffMember | null>(null)

  const roleOptions = useMemo(
    () =>
      (rolesData?.roles ?? []).map((r) => ({
        value: r.slug,
        label: r.name,
        permissions: r.permissions,
      })),
    [rolesData?.roles],
  )

  const member = useMemo(
    () => (members ?? []).find((m) => m.id === userId) ?? null,
    [members, userId],
  )

  const teamManagers = useMemo(
    () => (members ?? []).filter((m) => isTeamManagerRole(m.job_role, roleOptions)),
    [members, roleOptions],
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
  const isRm = isRelationshipManagerRole(member.job_role, roleOptions)

  return (
    <div className="flex flex-col gap-3 w-full max-w-none lg:h-[calc(100vh-5.5rem)] lg:min-h-0 lg:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            to="/dashboard/platform-team"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Support team
          </Link>
          <span className="text-muted-foreground hidden sm:inline">/</span>
          <h1 className="text-xl font-bold text-gray-900 truncate">{member.full_name}</h1>
          <span
            className={
              member.is_active
                ? 'text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs shrink-0'
                : 'text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-xs shrink-0'
            }
          >
            {member.is_active ? 'Active' : 'Inactive'}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatPlatformJobRole(member.job_role, roleOptions)}
            {member.created_at ? ` · Added ${member.created_at.slice(0, 10)}` : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={busy}
            onClick={() => setResetForMember(member)}
          >
            <KeyRound className="w-3.5 h-3.5 mr-1.5" />
            Reset password
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={busy}
            onClick={() =>
              updateStaff.mutate({
                userId: member.id,
                data: { is_active: !member.is_active },
              })
            }
          >
            <UserMinus className="w-3.5 h-3.5 mr-1.5" />
            {member.is_active ? 'Deactivate' : 'Reactivate'}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-8"
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  'Remove platform access? They will no longer be able to open this admin app.',
                )
              ) {
                updateStaff.mutate(
                  { userId: member.id, data: { remove_access: true } },
                  { onSuccess: () => navigate('/dashboard/platform-team') },
                )
              }
            }}
          >
            <UserX className="w-3.5 h-3.5 mr-1.5" />
            Remove access
          </Button>
        </div>
      </div>

      <div
        className={
          isRm
            ? 'grid gap-3 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:flex-1 lg:min-h-0'
            : 'grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:flex-1 lg:min-h-0'
        }
      >
        <div className="min-w-0 shrink-0">
          <PlatformStaffEditForm member={member} teamManagers={teamManagers} compact />
        </div>

        <Card className="min-w-0 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden">
          <CardHeader className="px-4 py-2.5 space-y-0 shrink-0">
            <CardTitle className="text-base">Audit history</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0 lg:flex-1 lg:min-h-0 lg:overflow-hidden lg:flex lg:flex-col">
            <PlatformStaffAuditSection
              scope="member"
              memberUserId={member.id}
              compact
              embedded
            />
          </CardContent>
        </Card>

        {isRm && (
          <div className="min-w-0 lg:col-span-2 lg:min-h-0 lg:overflow-auto">
            <RmAssignedBusinessAccounts
              relationshipManagerUserId={member.id}
              rmName={member.full_name}
            />
          </div>
        )}
      </div>

      <ResetPasswordModal member={resetForMember} onClose={() => setResetForMember(null)} />
    </div>
  )
}
