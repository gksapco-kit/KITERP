import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { PlatformStaffMember } from '@/api/admin.api'
import { useResetPlatformStaffPassword } from '@/hooks/usePlatformStaff'

type Props = {
  member: PlatformStaffMember | null
  onClose: () => void
}

export function ResetPasswordModal({ member, onClose }: Props) {
  const resetPassword = useResetPlatformStaffPassword()
  const [resetPw, setResetPw] = useState('')
  const [resetPwConfirm, setResetPwConfirm] = useState('')

  useEffect(() => {
    if (member) {
      setResetPw('')
      setResetPwConfirm('')
    }
  }, [member?.id])

  if (!member) return null

  const submit = () => {
    if (resetPw.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }
    if (resetPw !== resetPwConfirm) {
      toast.error('Passwords do not match.')
      return
    }
    resetPassword.mutate(
      { userId: member.id, password: resetPw },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-pw-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-lg border bg-background p-4 shadow-lg space-y-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="reset-pw-title" className="font-semibold text-lg">
          Reset password
        </h3>
        <p className="text-sm text-muted-foreground">
          Set a new password for <span className="font-medium text-foreground">{member.full_name}</span>. They
          will use this with their email or phone on the admin login page.
        </p>
        <div>
          <Label htmlFor="reset-pw">New password</Label>
          <Input
            id="reset-pw"
            type="password"
            value={resetPw}
            onChange={(e) => setResetPw(e.target.value)}
            className="mt-1"
            autoComplete="new-password"
            minLength={6}
          />
        </div>
        <div>
          <Label htmlFor="reset-pw2">Confirm password</Label>
          <Input
            id="reset-pw2"
            type="password"
            value={resetPwConfirm}
            onChange={(e) => setResetPwConfirm(e.target.value)}
            className="mt-1"
            autoComplete="new-password"
            minLength={6}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="cancel" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={resetPassword.isPending}>
            {resetPassword.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              'Save new password'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
