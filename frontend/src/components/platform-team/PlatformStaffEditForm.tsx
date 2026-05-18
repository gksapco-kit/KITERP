import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlatformStaffMember } from '@/api/admin.api'
import { useUpdatePlatformStaff } from '@/hooks/usePlatformStaff'
import { toast } from 'sonner'
import { Loader2, Pencil } from 'lucide-react'
import { PLATFORM_JOB_ROLES, formatPlatformJobRole, platformTeamSelectClassName } from '@/lib/platformTeam'
import { cn } from '@/lib/utils'

type Props = {
  member: PlatformStaffMember
  teamManagers: PlatformStaffMember[]
}

function syncFromMember(member: PlatformStaffMember) {
  return {
    full_name: member.full_name,
    email: member.email ?? '',
    phone: member.phone ?? '',
    job_role: member.job_role || 'consulting',
    manager_id: member.manager_id || '',
  }
}

export function PlatformStaffEditForm({ member, teamManagers }: Props) {
  const updateStaff = useUpdatePlatformStaff()
  const [isEditing, setIsEditing] = useState(false)
  const [editFullName, setEditFullName] = useState(member.full_name)
  const [editEmail, setEditEmail] = useState(member.email ?? '')
  const [editPhone, setEditPhone] = useState(member.phone ?? '')
  const [editJobRole, setEditJobRole] = useState<string>(member.job_role || 'consulting')
  const [editManagerId, setEditManagerId] = useState<string>(member.manager_id || '')

  useEffect(() => {
    const s = syncFromMember(member)
    setEditFullName(s.full_name)
    setEditEmail(s.email)
    setEditPhone(s.phone)
    setEditJobRole(s.job_role)
    setEditManagerId(s.manager_id)
  }, [
    member.id,
    member.full_name,
    member.email,
    member.phone,
    member.job_role,
    member.manager_id,
  ])

  const handleCancel = () => {
    const s = syncFromMember(member)
    setEditFullName(s.full_name)
    setEditEmail(s.email)
    setEditPhone(s.phone)
    setEditJobRole(s.job_role)
    setEditManagerId(s.manager_id)
    setIsEditing(false)
  }

  const saveEdit = () => {
    const em = editEmail.trim().toLowerCase()
    const ph = editPhone.trim()
    if (!em && !ph) {
      toast.error('Keep at least one of email or phone so the user can sign in.')
      return
    }
    const fn = editFullName.trim()
    if (fn.length < 2) {
      toast.error('Name must be at least 2 characters.')
      return
    }
    const role = editJobRole
    updateStaff.mutate(
      {
        userId: member.id,
        data: {
          full_name: fn,
          email: em || null,
          phone: ph || null,
          job_role: role,
          manager_id: role === 'team_manager' ? null : editManagerId ? editManagerId : null,
        },
      },
      {
        onSuccess: () => setIsEditing(false),
      },
    )
  }

  const reportsToLabel =
    editJobRole === 'team_manager'
      ? '—'
      : teamManagers.find((tm) => tm.id === editManagerId)?.full_name ||
        member.manager_name ||
        '—'

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{isEditing ? 'Edit profile' : 'Profile'}</CardTitle>
        {!isEditing ? (
          <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2 w-fit" onClick={() => setIsEditing(true)}>
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6 w-full max-w-none">
        {!isEditing ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-12 gap-y-5 text-sm w-full">
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Full name</dt>
              <dd className="font-medium text-base mt-1 break-words">{member.full_name}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Email</dt>
              <dd className="font-medium text-base mt-1 break-all">{member.email || '—'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Phone</dt>
              <dd className="font-medium text-base mt-1 break-all">{member.phone || '—'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Job role</dt>
              <dd className="font-medium text-base mt-1">{formatPlatformJobRole(member.job_role)}</dd>
            </div>
            <div className="min-w-0 sm:col-span-2 xl:col-span-1">
              <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Reports to</dt>
              <dd className="font-medium text-base mt-1 break-words">{member.manager_name || '—'}</dd>
            </div>
          </dl>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 w-full lg:grid-cols-2 lg:gap-x-10">
              <div className="min-w-0 lg:col-span-2">
                <Label htmlFor="detail-edit-full-name">Full name</Label>
                <Input
                  id="detail-edit-full-name"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="mt-1 w-full"
                  autoComplete="name"
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="detail-edit-email">Email</Label>
                <Input
                  id="detail-edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1 w-full"
                  autoComplete="off"
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="detail-edit-phone">Phone</Label>
                <div className="mt-1">
                  <PhoneInput
                    id="detail-edit-phone"
                    value={editPhone}
                    onChange={setEditPhone}
                    defaultCountryIso="IN"
                    autoComplete="tel-national"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  E.164 stored (same as when adding a user).
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 w-full lg:grid-cols-2 lg:gap-x-10">
              <div className="min-w-0">
                <Label htmlFor="detail-edit-job-role">Job role</Label>
                <select
                  id="detail-edit-job-role"
                  className={cn(platformTeamSelectClassName, 'mt-1 w-full')}
                  value={editJobRole}
                  onChange={(e) => {
                    const v = e.target.value
                    setEditJobRole(v)
                    if (v === 'team_manager') setEditManagerId('')
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
                <Label htmlFor="detail-edit-manager">Reports to</Label>
                <select
                  id="detail-edit-manager"
                  className={cn(platformTeamSelectClassName, 'mt-1 w-full')}
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                  disabled={editJobRole === 'team_manager'}
                >
                  <option value="">— None —</option>
                  {teamManagers
                    .filter((tm) => tm.id !== member.id)
                    .map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.full_name}
                      </option>
                    ))}
                </select>
                {editJobRole !== 'team_manager' && (
                  <p className="text-xs text-muted-foreground mt-1">Currently: {reportsToLabel}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={saveEdit} disabled={updateStaff.isPending}>
                {updateStaff.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
              <Button type="button" variant="cancel" size="sm" onClick={handleCancel} disabled={updateStaff.isPending}>Cancel</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
