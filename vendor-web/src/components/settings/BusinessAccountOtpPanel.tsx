import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { crmApi } from '@/api/crm'
import { extractApiError } from '@/lib/errorMessages'
import { storeIntegrationOtpGrant } from '@/lib/integrationOtpGrant'

export function BusinessAccountOtpPanel({
  onGranted,
  message = 'This stays hidden until you confirm a code sent to the mobile number already on this business account.',
  rememberGrant = true,
  autoSend = false,
}: {
  onGranted: (grant: string, expiresAt: string) => void
  message?: string
  /** When false, this confirmation cannot be reused for a later save. */
  rememberGrant?: boolean
  /** Send the code as soon as this step opens. */
  autoSend?: boolean
}) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    setSending(true)
    setError(null)
    try {
      const res = await crmApi.sendIntegrationOtp()
      setSentTo(res.to)
      setSent(true)
      if (res.dev_hint) {
        setCode(res.dev_hint)
        toast.message(`Dev OTP: ${res.dev_hint}`, { duration: 12_000 })
      } else {
        toast.success(`Code sent to ${res.to}`)
      }
    } catch (err) {
      setError(extractApiError(err, 'Could not send the code'))
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (!autoSend) return
    const lockKey = 'kiterp.businessOtpAutoSend'
    const last = Number(sessionStorage.getItem(lockKey) || 0)
    if (Date.now() - last < 1500) return
    sessionStorage.setItem(lockKey, String(Date.now()))
    void send()
    // Send once when this save step opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend])

  const verify = async () => {
    if (code.trim().length !== 6) return
    setVerifying(true)
    setError(null)
    try {
      const res = await crmApi.verifyIntegrationOtp(code.trim())
      if (rememberGrant) storeIntegrationOtpGrant(res.grant, res.expires_at)
      onGranted(res.grant, res.expires_at)
    } catch (err) {
      setError(extractApiError(err, 'Invalid verification code'))
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {sentTo && (
        <p className="text-sm text-foreground">
          Code sent to <strong>{sentTo}</strong>
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {sent && (
        <div>
          <Label htmlFor="business-otp">Verification code</Label>
          <Input
            id="business-otp"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            maxLength={6}
            autoFocus
            className="mt-1 max-w-xs"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={send} disabled={sending || verifying}>
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          {sent ? 'Resend code' : 'Send OTP'}
        </Button>
        {sent && (
          <Button type="button" onClick={verify} disabled={verifying || code.length !== 6}>
            {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm
          </Button>
        )}
      </div>
    </div>
  )
}
