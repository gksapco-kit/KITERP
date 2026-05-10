import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { isSuperuserAdmin } from '@/lib/platformAccess'
import {
  usePlatformStaffList,
  useCreatePlatformStaff,
  useUpdatePlatformStaff,
} from '@/hooks/usePlatformStaff'
import { ResetPasswordModal } from '@/components/platform-team/ResetPasswordModal'
import { PLATFORM_JOB_ROLES, formatPlatformJobRole, platformTeamSelectClassName } from '@/lib/platformTeam'
import type { PlatformStaffMember } from '@/api/admin.api'
import { Headphones, KeyRound, Loader2, Pencil, UserMinus, UserX } from 'lucide-react'

export default function PlatformTeam() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: members, isLoading, isError } = usePlatformStaffList()
  const createStaff = useCreatePlatformStaff()
  const updateStaff = useUpdatePlatformStaff()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [jobRole, setJobRole] = useState<string>('consulting')
  const [managerIdForCreate, setManagerIdForCreate] = useState<string>('')

  const [resetForMember, setResetForMember] = useState<PlatformStaffMember | null>(null)

  const teamManagers = useMemo(
    () => (members ?? []).filter((m) => m.job_role === 'team_manager'),
    [members],
  )

  if (!isSuperuserAdmin(user)) {
    return <Navigate to="/dashboard" replace />
  }

  const openMember = (id: string) => {
    navigate(`/dashboard/platform-team/${id}`)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const em = email.trim()
    const ph = phone.trim()
    if (!em && !ph) {
      return
    }
    createStaff.mutate(
      {
        full_name: fullName.trim(),
        password,
        email: em || undefined,
        phone: ph || undefined,
        job_role: jobRole,
        manager_id:
          jobRole === 'team_manager'
            ? null
            : managerIdForCreate
              ? managerIdForCreate
              : null,
      },
      {
        onSuccess: () => {
          setFullName('')
          setEmail('')
          setPhone('')
          setPassword('')
          setJobRole('consulting')
          setManagerIdForCreate('')
        },
      },
    )
  }

  const busy = updateStaff.isPending

  return (
    <div className="space-y-8 w-full max-w-none">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Headphones className="w-7 h-7 text-primary" />
          Platform support team
        </h1>
        <p className="text-gray-600 mt-1">
          Add users by email and/or phone so they can sign in here and help vendors (read-only vendor
          directory; no approvals or global settings). Click a row to open their profile page.
        </p>
      </div>

      <Card className="w-full max-w-7xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Add support user</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 items-start">
              <div className="min-w-0">
                <Label htmlFor="ps-name">Full name</Label>
                <Input
                  id="ps-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  minLength={2}
                  className="mt-1 w-full"
                  autoComplete="name"
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="ps-job-role">Job role</Label>
                <select
                  id="ps-job-role"
                  className={cn(platformTeamSelectClassName, 'mt-1 w-full')}
                  value={jobRole}
                  onChange={(e) => {
                    const v = e.target.value
                    setJobRole(v)
                    if (v === 'team_manager') setManagerIdForCreate('')
                  }}
                >
                  {PLATFORM_JOB_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <Label htmlFor="ps-manager">Reports to (team manager)</Label>
                <select
                  id="ps-manager"
                  className={cn(platformTeamSelectClassName, 'mt-1 w-full')}
                  value={managerIdForCreate}
                  onChange={(e) => setManagerIdForCreate(e.target.value)}
                  disabled={jobRole === 'team_manager'}
                >
                  <option value="">— None —</option>
                  {teamManagers.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.full_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">
                  Optional until you have team managers. Only users with role Team manager appear here.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-3 items-start">
              <div className="min-w-0">
                <Label htmlFor="ps-email">Email (optional if phone set)</Label>
                <Input
                  id="ps-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full"
                  autoComplete="off"
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="ps-phone">Phone (optional if email set)</Label>
                <div className="mt-1 min-w-0">
                  <PhoneInput
                    id="ps-phone"
                    value={phone}
                    onChange={setPhone}
                    defaultCountryIso="IN"
                    autoComplete="tel-national"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">
                  Pick country code, then enter the local number (stored as E.164).
                </p>
              </div>
              <div className="min-w-0">
                <Label htmlFor="ps-password">Initial password</Label>
                <Input
                  id="ps-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1 w-full"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-start md:justify-end">
              <Button
                type="submit"
                disabled={createStaff.isPending || (!email.trim() && !phone.trim())}
              >
                {createStaff.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving…
                  </>
                ) : (
                  'Add support user'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
                      <td className="px-4 py-3 text-gray-600">{formatPlatformJobRole(m.job_role)}</td>
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

      <ResetPasswordModal member={resetForMember} onClose={() => setResetForMember(null)} />
    </div>
  )
}
