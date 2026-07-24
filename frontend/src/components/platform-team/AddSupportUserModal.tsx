import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import { useCreatePlatformStaff } from '@/hooks/usePlatformStaff'
import { usePlatformJobRoles } from '@/hooks/usePlatformJobRoles'
import {
  PLATFORM_JOB_ROLES,
  isTeamManagerRole,
  platformTeamSelectClassName,
  type JobRoleOption,
} from '@/lib/platformTeam'
import type { PlatformStaffMember } from '@/api/admin.api'
import { Check, Copy, Eye, EyeOff, Loader2, Wand2, X } from 'lucide-react'
import { toast } from 'sonner'

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

type Props = {
  open: boolean
  onClose: () => void
  teamManagers: PlatformStaffMember[]
}

export function AddSupportUserModal({ open, onClose, teamManagers }: Props) {
  const createStaff = useCreatePlatformStaff()
  const { data: rolesData } = usePlatformJobRoles()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [jobRole, setJobRole] = useState('consulting')
  const [managerId, setManagerId] = useState('')

  const jobRoleOptions: JobRoleOption[] = (rolesData?.roles ?? [])
    .filter((r) => r.is_active)
    .map((r) => ({ value: r.slug, label: r.name, permissions: r.permissions }))
  const roleOptions = jobRoleOptions.length > 0 ? jobRoleOptions : [...PLATFORM_JOB_ROLES]
  const isTeamMgr = isTeamManagerRole(jobRole, roleOptions)

  useEffect(() => {
    if (!open) return
    setFullName('')
    setEmail('')
    setPhone('')
    setPassword('')
    setShowPassword(false)
    setPasswordCopied(false)
    setJobRole('consulting')
    setManagerId('')
  }, [open])

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const em = email.trim()
    const ph = phone.trim()
    if (!em && !ph) {
      toast.error('Enter an email or phone number.')
      return
    }
    createStaff.mutate(
      {
        full_name: fullName.trim(),
        password,
        email: em || undefined,
        phone: ph || undefined,
        job_role: jobRole,
        manager_id: isTeamMgr ? null : managerId || null,
      },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-support-user-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-lg border bg-background p-4 shadow-lg space-y-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="add-support-user-title" className="font-semibold text-lg">
              Add support user
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              They can sign in here with email or phone.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="add-ps-name">Full name</Label>
              <Input
                id="add-ps-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                className="h-9"
                autoComplete="name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-ps-job">Job role</Label>
              <Select
                id="add-ps-job"
                className={cn(platformTeamSelectClassName, 'w-full !h-9 !py-0')}
                value={jobRole}
                onChange={(v) => {
                  setJobRole(v)
                  if (isTeamManagerRole(v, roleOptions)) setManagerId('')
                }}
                options={roleOptions.map((r) => ({ value: r.value, label: r.label }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-ps-manager">Reports to</Label>
              <Select
                id="add-ps-manager"
                className={cn(platformTeamSelectClassName, 'w-full !h-9 !py-0')}
                value={managerId}
                onChange={setManagerId}
                disabled={isTeamMgr}
                options={[
                  { value: '', label: '— None —' },
                  ...teamManagers.map((tm) => ({ value: tm.id, label: tm.full_name })),
                ]}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-ps-email">Email</Label>
              <Input
                id="add-ps-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9"
                placeholder="Optional if phone set"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-ps-phone">Phone</Label>
              <PhoneInput
                id="add-ps-phone"
                value={phone}
                onChange={setPhone}
                defaultCountryIso="IN"
                autoComplete="tel-national"
                compact
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="add-ps-password">Initial password</Label>
              <div className="relative">
                <Input
                  id="add-ps-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-9 pr-[4.75rem] font-mono"
                  autoComplete="new-password"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="p-1 text-muted-foreground hover:text-foreground rounded"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    title="Generate password"
                    aria-label="Generate password"
                    className="p-1 text-muted-foreground hover:text-foreground rounded"
                    onClick={() => {
                      setPassword(generatePassword())
                      setShowPassword(true)
                      setPasswordCopied(false)
                    }}
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    title="Copy password"
                    aria-label="Copy password"
                    disabled={!password}
                    className="p-1 text-muted-foreground hover:text-foreground rounded disabled:opacity-40"
                    onClick={async () => {
                      if (!password) return
                      try {
                        await navigator.clipboard.writeText(password)
                        setPasswordCopied(true)
                        toast.success('Password copied')
                        window.setTimeout(() => setPasswordCopied(false), 1500)
                      } catch {
                        toast.error('Could not copy password')
                      }
                    }}
                  >
                    {passwordCopied ? (
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
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
      </div>
    </div>
  )
}
