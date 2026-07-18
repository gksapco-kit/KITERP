import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'
import { isSuperuserAdmin } from '@/lib/platformAccess'
import {
  usePlatformStaffList,
  useUpdatePlatformStaff,
} from '@/hooks/usePlatformStaff'
import { AddSupportUserModal } from '@/components/platform-team/AddSupportUserModal'
import { ResetPasswordModal } from '@/components/platform-team/ResetPasswordModal'
import { formatPlatformJobRole, isTeamManagerRole } from '@/lib/platformTeam'
import { usePlatformJobRoles } from '@/hooks/usePlatformJobRoles'
import type { PlatformStaffMember } from '@/api/admin.api'
import { Headphones, KeyRound, Loader2, Pencil, Plus, UserMinus, UserX } from 'lucide-react'

export default function PlatformTeam() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: members, isLoading, isError } = usePlatformStaffList()
  const { data: rolesData } = usePlatformJobRoles()
  const updateStaff = useUpdatePlatformStaff()

  const [addOpen, setAddOpen] = useState(false)
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

  const teamManagers = useMemo(
    () => (members ?? []).filter((m) => isTeamManagerRole(m.job_role, roleOptions)),
    [members, roleOptions],
  )

  if (!isSuperuserAdmin(user)) {
    return <Navigate to="/dashboard" replace />
  }

  const openMember = (id: string) => {
    navigate(`/dashboard/platform-team/${id}`)
  }

  const busy = updateStaff.isPending

  return (
    <div className="space-y-5 w-full max-w-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Headphones className="w-7 h-7 text-primary" />
            Platform support team
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Add users by email and/or phone so they can sign in here and help vendors (read-only vendor
            directory; no approvals or global settings). Click a row to open their profile page.
          </p>
        </div>
        <Button type="button" size="sm" className="shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add support user
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current support users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading…
            </div>
          )}
          {isError && (
            <p className="text-sm text-red-600">Could not load list. Are you logged in as a superuser?</p>
          )}
          {!isLoading && !isError && (!members || members.length === 0) && (
            <p className="text-sm text-gray-500">No support users yet.</p>
          )}
          {!isLoading && members && members.length > 0 && (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="px-4 py-2 font-medium text-gray-600">Name</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Email</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Phone</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Role</th>
                    <th className="px-4 py-2 font-medium text-gray-600 text-right whitespace-nowrap">
                      Accounts (RM)
                    </th>
                    <th className="px-4 py-2 font-medium text-gray-600">Manager</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Status</th>
                    <th className="px-4 py-2 font-medium text-gray-600 text-right">Quick actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map((m) => (
                    <tr
                      key={m.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openMember(m.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openMember(m.id)
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open profile for ${m.full_name}`}
                    >
                      <td className="px-4 py-3 font-medium">{m.full_name}</td>
                      <td className="px-4 py-3 text-gray-600">{m.email || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{m.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatPlatformJobRole(m.job_role, roleOptions)}
                      </td>
                      <td className="px-4 py-3 text-gray-800 text-right tabular-nums font-medium">
                        {m.assigned_business_account_count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{m.manager_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            m.is_active
                              ? 'text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs'
                              : 'text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-xs'
                          }
                        >
                          {m.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap w-[1%]">
                        <div
                          className="inline-flex flex-nowrap items-center justify-end gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            disabled={busy}
                            onClick={() => openMember(m.id)}
                            title="Open profile"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            disabled={busy}
                            onClick={() => setResetForMember(m)}
                            title="Reset password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            disabled={busy}
                            onClick={() =>
                              updateStaff.mutate({
                                userId: m.id,
                                data: { is_active: !m.is_active },
                              })
                            }
                            title={m.is_active ? 'Deactivate login' : 'Reactivate'}
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            disabled={busy}
                            onClick={() => {
                              if (
                                confirm(
                                  'Remove platform access? They will no longer be able to open this admin app.',
                                )
                              ) {
                                updateStaff.mutate({ userId: m.id, data: { remove_access: true } })
                              }
                            }}
                            title="Remove admin access"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddSupportUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        teamManagers={teamManagers}
      />
      <ResetPasswordModal member={resetForMember} onClose={() => setResetForMember(null)} />
    </div>
  )
}
