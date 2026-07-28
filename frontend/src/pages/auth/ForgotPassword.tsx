import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { authApi } from '@/api/auth.api'
import {
  NOT_REGISTERED_EMAIL,
  NOT_REGISTERED_PHONE,
  extractAuthApiDetail,
  resetCodeWasIssued,
} from '@/lib/otpAuth'

const OTP_LENGTH = 6

/** Password input with a show/hide (eye) toggle, wired to react-hook-form. */
function PasswordField({
  id,
  label,
  error,
  registration,
  placeholder,
}: {
  id: string
  label: string
  error?: string
  registration: UseFormRegisterReturn
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder={placeholder}
          {...registration}
          className="pr-10"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
}

/** Segmented 6-box OTP input. `value` is the joined string of digits. */
function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const focusAt = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, i))]
    el?.focus()
    el?.select()
  }

  return (
    <div className="flex justify-between gap-2">
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ''}
          onChange={(e) => {
            const digit = e.target.value.replace(/\D/g, '').slice(-1)
            const next = (value.slice(0, i) + digit + value.slice(i + 1)).slice(0, OTP_LENGTH)
            onChange(next)
            if (digit && i < OTP_LENGTH - 1) focusAt(i + 1)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) {
              onChange(value.slice(0, i - 1) + value.slice(i))
              focusAt(i - 1)
            }
            if (e.key === 'ArrowLeft' && i > 0) focusAt(i - 1)
            if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) focusAt(i + 1)
          }}
          onPaste={(e) => {
            e.preventDefault()
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
            if (!pasted) return
            onChange(pasted)
            focusAt(Math.min(pasted.length, OTP_LENGTH - 1))
          }}
          className={`h-12 w-full rounded-lg border-2 text-center font-mono text-xl font-bold outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50 ${
            value[i]
              ? 'border-primary/60 bg-primary/5 text-primary'
              : 'border-gray-200 bg-white text-gray-900'
          }`}
        />
      ))}
    </div>
  )
}

/** Align with backend auth_service._PHONE_RE */
const PHONE_RE = /^\+?\d{7,15}$/

type Channel = 'email' | 'phone'
type Step = 'request' | 'verify'

function apiError(err: unknown, fallback: string, channel?: Channel): string {
  const ax = err as AxiosError<{ detail?: unknown }>
  if (!ax?.response) return 'Cannot reach the API. Is the backend running on port 8000?'
  return extractAuthApiDetail(err, fallback, channel)
}

const requestSchema = z
  .object({
    channel: z.enum(['email', 'phone']),
    contact: z.string().min(1, 'This field is required'),
  })
  .superRefine((val, ctx) => {
    const trimmed = val.contact.trim()
    if (val.channel === 'email') {
      if (!z.string().email().safeParse(trimmed).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['contact'],
          message: 'Enter a valid email address',
        })
      }
    } else if (!PHONE_RE.test(trimmed.replace(/\s/g, ''))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contact'],
        message: 'Enter a valid phone number (7–15 digits, optional +country code)',
      })
    }
  })

type RequestForm = z.infer<typeof requestSchema>

const verifySchema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type VerifyForm = z.infer<typeof verifySchema>

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('request')
  const [channel, setChannel] = useState<Channel>('email')
  const [contact, setContact] = useState('')
  const [sending, setSending] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [devHint, setDevHint] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)

  const requestForm = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
    defaultValues: { channel: 'email', contact: '' },
  })

  const verifyForm = useForm<VerifyForm>({
    resolver: zodResolver(verifySchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

  const switchChannel = (next: Channel) => {
    setChannel(next)
    requestForm.setValue('channel', next)
    requestForm.setValue('contact', '')
    requestForm.clearErrors()
  }

  const onRequest = async (data: RequestForm) => {
    setSending(true)
    setDevHint(null)
    setCodeError(null)
    setRequestError(null)
    const trimmed = data.contact.trim()
    const emailNorm = trimmed.toLowerCase()
    try {
      const phoneNorm = trimmed.replace(/\s/g, '')
      const res =
        data.channel === 'email'
          ? await authApi.forgotPasswordEmail(emailNorm)
          : await authApi.forgotPasswordPhone(phoneNorm)
      if (!resetCodeWasIssued(res)) {
        const msg = data.channel === 'email' ? NOT_REGISTERED_EMAIL : NOT_REGISTERED_PHONE
        setRequestError(msg)
        toast.error(msg)
        return
      }
      setContact(data.channel === 'email' ? emailNorm : phoneNorm)
      setStep('verify')
      if (res.dev_hint) {
        setDevHint(res.dev_hint)
        setCode(res.dev_hint)
        toast.message(`Dev code: ${res.dev_hint}`)
      } else {
        setCode('')
        toast.success(
          data.channel === 'email'
            ? `A 6-digit code was sent to ${res.to ?? trimmed}.`
            : `A 6-digit code was sent to ${trimmed.replace(/\s/g, '')}.`,
        )
      }
    } catch (err) {
      const msg = apiError(err, 'Could not send the reset code. Try again.', data.channel)
      setRequestError(msg)
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  const onVerify = async (data: VerifyForm) => {
    if (!/^\d{6}$/.test(code)) {
      setCodeError('Enter the 6-digit code')
      return
    }
    setCodeError(null)
    setResetting(true)
    try {
      const res = await authApi.resetPassword({
        ...(channel === 'email' ? { email: contact } : { phone: contact }),
        code,
        new_password: data.newPassword,
      })
      toast.success(res.message || 'Password reset successfully — you can now sign in.')
      navigate('/login')
    } catch (err) {
      toast.error(apiError(err, 'Could not reset the password. Check the code and try again.'))
    } finally {
      setResetting(false)
    }
  }

  if (step === 'verify') {
    return (
      <form onSubmit={verifyForm.handleSubmit(onVerify)} className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-gray-900">Enter code & new password</h2>
          <p className="text-sm text-gray-600">
            Enter the code sent to{' '}
            <span className="font-semibold text-gray-900">{contact}</span> and set a new password.
          </p>
        </div>

        {devHint && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Dev mode code: <span className="font-mono font-semibold">{devHint}</span>
          </p>
        )}

        <div>
          <Label>{channel === 'email' ? '6-digit reset code' : '6-digit OTP'}</Label>
          <div className="mt-2">
            <OtpInput
              value={code}
              onChange={(next) => {
                setCode(next)
                if (codeError) setCodeError(null)
              }}
              disabled={resetting}
            />
          </div>
          {codeError ? (
            <p className="mt-1 text-sm text-red-500">{codeError}</p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">Valid for 10 minutes.</p>
          )}
        </div>

        <PasswordField
          id="newPassword"
          label="New password"
          placeholder="Min. 8 characters"
          registration={verifyForm.register('newPassword')}
          error={verifyForm.formState.errors.newPassword?.message}
        />

        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          placeholder="Re-enter new password"
          registration={verifyForm.register('confirmPassword')}
          error={verifyForm.formState.errors.confirmPassword?.message}
        />

        <Button type="submit" className="w-full" disabled={resetting || code.length !== 6}>
          {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Reset password
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => {
              setStep('request')
              setDevHint(null)
              setCode('')
              setCodeError(null)
              verifyForm.reset()
            }}
          >
            Use a different {channel === 'email' ? 'email' : 'number'}
          </button>
          <button
            type="button"
            className="font-medium text-primary hover:underline disabled:opacity-50"
            disabled={sending}
            onClick={() =>
              onRequest({ channel, contact } as RequestForm)
            }
          >
            {sending ? 'Resending…' : 'Resend code'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={requestForm.handleSubmit(onRequest)} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-900">Reset your password</h2>
        <p className="text-sm text-gray-600">
          We&apos;ll send a 6-digit verification code to confirm it&apos;s you.
        </p>
      </div>

      {requestError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {requestError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => switchChannel('email')}
          className={`rounded-md py-2 text-sm font-medium transition ${
            channel === 'email' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
          }`}
        >
          Email OTP
        </button>
        <button
          type="button"
          onClick={() => switchChannel('phone')}
          className={`rounded-md py-2 text-sm font-medium transition ${
            channel === 'phone' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
          }`}
        >
          Mobile OTP
        </button>
      </div>

      <div>
        <Label htmlFor="contact">{channel === 'email' ? 'Email address' : 'Mobile number'}</Label>
        {channel === 'email' ? (
          <Input
            id="contact"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...requestForm.register('contact')}
            className="mt-1"
          />
        ) : (
          <Controller
            name="contact"
            control={requestForm.control}
            render={({ field }) => (
              <PhoneInput
                id="contact"
                value={field.value ?? ''}
                onChange={field.onChange}
                defaultCountryIso="IN"
                autoComplete="tel"
                name="contact"
                className="mt-1"
              />
            )}
          />
        )}
        {requestForm.formState.errors.contact && (
          <p className="mt-1 text-sm text-red-500">
            {requestForm.formState.errors.contact.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={sending}>
        {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Send code
      </Button>

      <p className="text-center text-sm text-gray-600">
        Remembered your password?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}
