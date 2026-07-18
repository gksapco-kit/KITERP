import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlatformStaffMember } from '@/api/admin.api'
import { useUpdatePlatformStaff } from '@/hooks/usePlatformStaff'
import { usePlatformJobRoles } from '@/hooks/usePlatformJobRoles'
import { toast } from 'sonner'
import { Loader2, Pencil } from 'lucide-react'
import {
  PLATFORM_JOB_ROLES,
  formatPlatformJobRole,
  isTeamManagerRole,
  platformTeamSelectClassName,
  type JobRoleOption,
} from '@/lib/platformTeam'
import { cn } from '@/lib/utils'

type Props = {
  member: PlatformStaffMember
  teamManagers: PlatformStaffMember[]
  compact?: boolean
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

export function PlatformStaffEditForm({ member, teamManagers, compact = false }: Props) {
  const updateStaff = useUpdatePlatformStaff()
  const { data: rolesData } = usePlatformJobRoles()
  const [isEditing, setIsEditing] = useState(false)
  const [editFullName, setEditFullName] = useState(member.full_name)
  const [editEmail, setEditEmail] = useState(member.email ?? '')
  const [editPhone, setEditPhone] = useState(member.phone ?? '')
  const [editJobRole, setEditJobRole] = useState<string>(member.job_role || 'consulting')
  const [editManagerId, setEditManagerId] = useState<string>(member.manager_id || '')

  const jobRoleOptions: JobRoleOption[] = (rolesData?.roles ?? [])
    .filter((r) => r.is_active)
    .map((r) => ({ value: r.slug, label: r.name, permissions: r.permissions }))
  const roleOptions = jobRoleOptions.length > 0 ? jobRoleOptions : [...PLATFORM_JOB_ROLES]
  const isTeamMgr = isTeamManagerRole(editJobRole, roleOptions)

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
          manager_id: isTeamManagerRole(role, roleOptions)
            ? null
            : editManagerId
              ? editManagerId
              : null,
        },
      },
      {
        onSuccess: () => setIsEditing(false),
      },
    )
  }

  const reportsToLabel = isTeamMgr
    ? '—'
    : teamManagers.find((tm) => tm.id === editManagerId)?.full_name ||
      member.manager_name ||
      '—'

  return (
    <Card className="w-full">
      <CardHeader
        className={cn(
          'flex flex-row items-center justify-between gap-2 space-y-0',
          compact ? 'px-4 py-2.5' : 'flex-col gap-4 sm:flex-row',
        )}
      >
        <CardTitle className={compact ? 'text-base' : undefined}>
          {isEditing ? 'Edit profile' : 'Profile'}
        </CardTitle>
        {!isEditing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 h-8"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className={cn('w-full max-w-none', compact ? 'px-4 pb-3 pt-0 space-y-3' : 'space-y-6')}>
        {!isEditing ? (
          <dl
            className={cn(
              'grid text-sm w-full',
              compact
                ? 'grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-2'
                : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-12 gap-y-5',
            )}
          >
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs">Full name</dt>
              <dd className={cn('font-medium break-words', compact ? 'mt-0.5' : 'text-base mt-1')}>
                {member.full_name}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs">Email</dt>
              <dd className={cn('font-medium break-all', compact ? 'mt-0.5' : 'text-base mt-1')}>
                {member.email || '—'}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs">Phone</dt>
              <dd className={cn('font-medium break-all', compact ? 'mt-0.5' : 'text-base mt-1')}>
                {member.phone || '—'}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs">Job role</dt>
              <dd className={cn('font-medium', compact ? 'mt-0.5' : 'text-base mt-1')}>
                {formatPlatformJobRole(member.job_role, roleOptions)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs">Reports to</dt>
              <dd className={cn('font-medium break-words', compact ? 'mt-0.5' : 'text-base mt-1')}>
                {member.manager_name || '—'}
              </dd>
            </div>
            {compact && (
              <div className="min-w-0">
                <dt className="text-muted-foreground text-xs">Accounts (RM)</dt>
                <dd className="font-medium mt-0.5 tabular-nums">
                  {member.assigned_business_account_count ?? 0}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <>
            <div className={cn('grid w-full', compact ? 'grid-cols-1 sm:grid-cols-2 gap-2.5' : 'grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-x-10')}>
              <div className={cn('min-w-0', !compact && 'lg:col-span-2')}>
                <Label htmlFor="detail-edit-full-name">Full name</Label>
                <Input
                  id="detail-edit-full-name"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="mt-1 w-full h-9"
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
                  className="mt-1 w-full h-9"
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
                    compact
                  />
                </div>
              </div>
              <div className="min-w-0">
                <Label htmlFor="detail-edit-job-role">Job role</Label>
                <select
                  id="detail-edit-job-role"
                  className={cn(platformTeamSelectClassName, 'mt-1 w-full !h-9 !py-0')}
                  value={editJobRole}
                  onChange={(e) => {
                    const v = e.target.value
                    setEditJobRole(v)
                    if (isTeamManagerRole(v, roleOptions)) setEditManagerId('')
                  }}
                >
                  {roleOptions.map((r) => (
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
                  className={cn(platformTeamSelectClassName, 'mt-1 w-full !h-9 !py-0')}
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                  disabled={isTeamMgr}
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
                {!compact && !isTeamMgr && (
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
              <Button type="button" variant="cancel" size="sm" onClick={handleCancel} disabled={updateStaff.isPending}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
