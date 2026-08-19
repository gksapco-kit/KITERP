import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useResetVendorOwnerPassword } from '@/hooks/useAdmin'

type Props = {
  vendorId: string
  ownerName: string
  ownerEmail?: string
  ownerPhone?: string
  onClose: () => void
}

export function VendorOwnerPasswordModal({
  vendorId,
  ownerName,
  ownerEmail,
  ownerPhone,
  onClose,
}: Props) {
  const resetPassword = useResetVendorOwnerPassword()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    setPassword('')
    setConfirm('')
    setShowPw(false)
    setShowConfirm(false)
  }, [vendorId])

  const submit = () => {
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.')
      return
    }
    resetPassword.mutate({ vendorId, password }, { onSuccess: () => onClose() })
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-owner-pw-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-lg border bg-background p-4 shadow-lg space-y-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="vendor-owner-pw-title" className="font-semibold text-lg">
          Change owner password
        </h3>
        <p className="text-sm text-muted-foreground">
          Set a new login password for <span className="font-medium text-foreground">{ownerName}</span>.
          This same password works for email or phone — no OTP is sent.
        </p>
        {(ownerEmail || ownerPhone) && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1">
            {ownerEmail ? (
              <p>
                <span className="text-muted-foreground">Email: </span>
                <span className="font-mono text-foreground break-all">{ownerEmail}</span>
              </p>
            ) : null}
            {ownerPhone ? (
              <p>
                <span className="text-muted-foreground">Phone: </span>
                <span className="font-mono text-foreground">{ownerPhone}</span>
              </p>
            ) : null}
          </div>
        )}
        <div>
          <Label htmlFor="vendor-owner-pw">New password</Label>
          <div className="relative mt-1">
            <Input
              id="vendor-owner-pw"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          <Label htmlFor="vendor-owner-pw2">Confirm password</Label>
          <div className="relative mt-1">
            <Input
              id="vendor-owner-pw2"
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="pr-10"
              autoComplete="new-password"
              minLength={6}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="cancel" onClick={onClose}>
            Cancel
          </Button>
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
