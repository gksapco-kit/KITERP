import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { isSuperuserAdmin } from '@/lib/platformAccess'
import { usePlatformStaffList, useCreatePlatformStaff, useUpdatePlatformStaff } from '@/hooks/usePlatformStaff'
import type { PlatformStaffMember } from '@/api/admin.api'
import { Headphones, Loader2, Pencil, UserMinus, UserX } from 'lucide-react'

const JOB_ROLES = [
  { value: 'sales', label: 'Sales' },
  { value: 'crm', label: 'CRM' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'relationship_manager', label: 'Relationship manager' },
  { value: 'team_manager', label: 'Team manager' },
] as const

function formatJobRole(role: string | null | undefined): string {
  if (!role) return '—'
  const row = JOB_ROLES.find((r) => r.value === role)
  return row?.label ?? role
}

const selectClassName = cn(
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

export default function PlatformTeam() {
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

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editJobRole, setEditJobRole] = useState<string>('consulting')
  const [editManagerId, setEditManagerId] = useState<string>('')

  const teamManagers = useMemo(
    () => (members ?? []).filter((m) => m.job_role === 'team_manager'),
    [members],
  )

  const editingMember = useMemo(
    () => (members ?? []).find((m) => m.id === editingId) ?? null,
    [members, editingId],
  )

  useEffect(() => {
    if (!editingId || !members) return
    if (!members.some((m) => m.id === editingId)) {
      setEditingId(null)
    }
  }, [editingId, members])

  if (!isSuperuserAdmin(user)) {
    return <Navigate to="/dashboard" replace />
  }

  const openEdit = (m: PlatformStaffMember) => {
    setEditingId(m.id)
    setEditJobRole(m.job_role || 'consulting')
    setEditManagerId(m.manager_id || '')
  }

  const closeEdit = () => {
    setEditingId(null)
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

  const saveEdit = () => {
    if (!editingId) return
    const role = editJobRole
    updateStaff.mutate(
      {
        userId: editingId,
        data: {
          job_role: role,
          manager_id: role === 'team_manager' ? null : editManagerId ? editManagerId : null,
        },
      },
      { onSuccess: () => closeEdit() },
    )
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Headphones className="w-7 h-7 text-primary" />
          Platform support team
        </h1>
        <p className="text-gray-600 mt-1">
          Add users by email and/or phone so they can sign in here and help vendors (read-only vendor
          directory; no approvals or global settings).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add support user</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
            <div>
              <Label htmlFor="ps-name">Full name</Label>
              <Input
                id="ps-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                className="mt-1 max-w-lg"
                autoComplete="name"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 min-[480px]:items-end min-[480px]:gap-x-4">
              <div>
                <Label htmlFor="ps-email">Email (optional if phone set)</Label>
                <Input
                  id="ps-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  autoComplete="off"
                />
              </div>
              <div>
                <Label htmlFor="ps-phone">Phone (optional if email set)</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                  Pick country code, then enter the local number (stored as E.164).
                </p>
                <PhoneInput
                  id="ps-phone"
                  value={phone}
                  onChange={setPhone}
                  defaultCountryIso="IN"
                  autoComplete="tel-national"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 min-[520px]:gap-x-4">
              <div>
                <Label htmlFor="ps-job-role">Job role</Label>
                <select
                  id="ps-job-role"
                  className={cn(selectClassName, 'mt-1 max-w-lg')}
                  value={jobRole}
                  onChange={(e) => {
                    const v = e.target.value
                    setJobRole(v)
                    if (v === 'team_manager') setManagerIdForCreate('')
                  }}
                >
                  {JOB_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="ps-manager">Reports to (team manager)</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                  Optional until you have team managers. Only users with role Team manager appear here.
                </p>
                <select
                  id="ps-manager"
                  className={cn(selectClassName, 'mt-1 max-w-lg')}
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
              </div>
            </div>
            <div>
              <Label htmlFor="ps-password">Initial password</Label>
              <Input
                id="ps-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1 max-w-lg"
                autoComplete="new-password"
              />
            </div>
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
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current support users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingMember && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-sm">
                  Edit <span className="text-foreground">{editingMember.full_name}</span>
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={closeEdit}>
                  Cancel
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                <div>
                  <Label htmlFor="edit-job-role">Job role</Label>
                  <select
                    id="edit-job-role"
                    className={cn(selectClassName, 'mt-1')}
                    value={editJobRole}
                    onChange={(e) => {
                      const v = e.target.value
                      setEditJobRole(v)
                      if (v === 'team_manager') setEditManagerId('')
                    }}
                  >
                    {JOB_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="edit-manager">Reports to</Label>
                  <select
                    id="edit-manager"
                    className={cn(selectClassName, 'mt-1')}
                    value={editManagerId}
                    onChange={(e) => setEditManagerId(e.target.value)}
                    disabled={editJobRole === 'team_manager'}
                  >
                    <option value="">— None —</option>
                    {teamManagers
                      .filter((tm) => tm.id !== editingMember.id)
                      .map((tm) => (
                        <option key={tm.id} value={tm.id}>
                          {tm.full_name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <Button type="button" size="sm" onClick={saveEdit} disabled={updateStaff.isPending}>
                {updateStaff.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving…
                  </>
                ) : (
                  'Save role & manager'
                )}
              </Button>
            </div>
          )}

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
                    <th className="px-4 py-2 font-medium text-gray-600">Manager</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Status</th>
                    <th className="px-4 py-2 font-medium text-gray-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 font-medium">{m.full_name}</td>
                      <td className="px-4 py-3 text-gray-600">{m.email || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{m.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{formatJobRole(m.job_role)}</td>
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
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={updateStaff.isPending}
                          onClick={() => openEdit(m)}
                          title="Edit role and manager"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={updateStaff.isPending}
                          onClick={() =>
                            updateStaff.mutate({
                              userId: m.id,
                              data: { is_active: !m.is_active },
                            })
                          }
                          title={m.is_active ? 'Deactivate login' : 'Reactivate'}
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={updateStaff.isPending}
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
                          <UserX className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
