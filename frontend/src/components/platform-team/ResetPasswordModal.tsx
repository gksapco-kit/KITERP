import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Eye, EyeOff } from 'lucide-react'
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
  const [showPw, setShowPw] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)

  useEffect(() => {
    if (member) {
      setResetPw('')
      setResetPwConfirm('')
      setShowPw(false)
      setShowPwConfirm(false)
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
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
          <div className="relative mt-1">
            <Input
              id="reset-pw"
              type={showPw ? 'text' : 'password'}
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              className="pr-10"
              autoComplete="new-password"
              minLength={6}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="reset-pw2">Confirm password</Label>
          <div className="relative mt-1">
            <Input
              id="reset-pw2"
              type={showPwConfirm ? 'text' : 'password'}
              value={resetPwConfirm}
              onChange={(e) => setResetPwConfirm(e.target.value)}
              className="pr-10"
              autoComplete="new-password"
              minLength={6}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPwConfirm((v) => !v)}
              aria-label={showPwConfirm ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPwConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
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
