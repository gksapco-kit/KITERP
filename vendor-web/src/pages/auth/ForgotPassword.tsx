import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import {
  Loader2, ArrowLeft, Mail, Phone as PhoneIcon,
  ShieldCheck, AlertCircle, Eye, EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import apiClient from '@/api/client'
import {
  NOT_REGISTERED_EMAIL,
  NOT_REGISTERED_PHONE,
  extractAuthApiDetail,
  resetCodeWasIssued,
} from '@/lib/otpAuth'
import { cn } from '@/lib/utils'

const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE as string | undefined
const SUPPORT_CHAT_URL = import.meta.env.VITE_SUPPORT_CHAT_URL as string | undefined

type Method = 'email' | 'phone'
type Step = 'request' | 'code'

// ── Method toggle tab ─────────────────────────────────────────────────────
function MethodTab({
  active, icon: Icon, label, onClick,
}: {
  active: boolean
  icon: typeof Mail
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all',
        active ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700',
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}

// ── Password field with show/hide ─────────────────────────────────────────
function PwField({
  id, label, value, onChange, placeholder,
}: {
  id: string; label: string; value: string
  onChange: (v: string) => void; placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function ForgotPassword() {
  const navigate = useNavigate()

  const [method, setMethod] = useState<Method>('email')
  const [step, setStep] = useState<Step>('request')

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [maskedTarget, setMaskedTarget] = useState('')

  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [devHint, setDevHint] = useState<string | undefined>()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const resetAll = () => {
    setStep('request')
    setCode('')
    setDevHint(undefined)
    setError('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const switchMethod = (m: Method) => {
    setMethod(m)
    resetAll()
    setEmail('')
    setPhone('')
  }

  // ── Step 1: send code ──────────────────────────────────────────────
  const onRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (method === 'email') {
      if (!email.includes('@')) { setError('Enter a valid email address'); return }
    } else {
      if (!phone || phone.replace(/\D/g, '').length < 7) {
        setError('Enter a valid phone number with country code')
        return
      }
    }

    setLoading(true)
    try {
      if (method === 'email') {
        const emailVal = email.trim().toLowerCase()
        const res = await apiClient.post('/auth/forgot-password', {
          email: emailVal,
        })
        if (!resetCodeWasIssued(res.data)) {
          setError(NOT_REGISTERED_EMAIL)
          toast.error(NOT_REGISTERED_EMAIL)
          return
        }
        setDevHint(res.data?.dev_hint ?? undefined)
        if (res.data?.dev_hint) setCode(res.data.dev_hint)
        setMaskedTarget(emailVal)
        toast.success('Reset code sent — check your email')
        setStep('code')
      } else {
        const phoneVal = phone.trim()
        const res = await apiClient.post('/auth/forgot-password-phone', { phone: phoneVal })
        if (!resetCodeWasIssued(res.data)) {
          setError(NOT_REGISTERED_PHONE)
          toast.error(NOT_REGISTERED_PHONE)
          return
        }
        setDevHint(res.data?.dev_hint ?? undefined)
        if (res.data?.dev_hint) setCode(res.data.dev_hint)
        setMaskedTarget(phoneVal)
        toast.success('Reset OTP sent to your phone')
        setStep('code')
      }
    } catch (err: unknown) {
      const message = extractAuthApiDetail(err, 'Could not send reset code', method)
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: verify + set new password ─────────────────────────────
  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (code.length !== 6) { setError('Enter the 6-digit code'); return }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }

    setLoading(true)
    try {
      await apiClient.post('/auth/reset-password', {
        ...(method === 'email'
          ? { email: email.trim().toLowerCase() }
          : { phone: phone.trim() }),
        code,
        new_password: newPassword,
      })
      toast.success('Password reset successfully — please sign in')
      navigate('/login')
    } catch (err: unknown) {
      setError(extractAuthApiDetail(err, 'Invalid or expired code', method))
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Link to="/login" className="text-gray-400 hover:text-gray-600 transition-colors" title="Back to login">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <CardTitle className="text-xl">Reset Password</CardTitle>
        </div>
        <p className="text-sm text-gray-500">
          {step === 'request' ? (
            'Choose how to receive your 6-digit reset code.'
          ) : (
            <>
              Enter the code sent to{' '}
              <span className="font-semibold text-gray-900">{maskedTarget}</span> and set a new
              password.
            </>
          )}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 'request' ? (
          <>
            {/* Method toggle */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              <MethodTab
                active={method === 'email'}
                icon={Mail}
                label="Via Email"
                onClick={() => switchMethod('email')}
              />
              <MethodTab
                active={method === 'phone'}
                icon={PhoneIcon}
                label="Via Phone"
                onClick={() => switchMethod('phone')}
              />
            </div>

            <form onSubmit={onRequestCode} className="space-y-4">
              {method === 'email' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="fp-email">Email address</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      id="fp-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@business.com"
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    We'll send a 6-digit code to this email address.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>Phone number</Label>
                  <PhoneInput
                    id="fp-phone"
                    value={phone}
                    onChange={setPhone}
                    defaultCountryIso="IN"
                    inferCountryFromLocation
                    placeholder="Mobile number"
                  />
                  <p className="text-xs text-gray-400">
                    We'll send a 6-digit OTP to this number.{' '}
                    <span className="text-amber-600 font-medium">
                      Dev mode: OTP shown in-app (no SMS sent).
                    </span>
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 h-11"
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
                ) : method === 'email' ? (
                  <><Mail className="w-4 h-4 mr-2" />Send Reset Code</>
                ) : (
                  <><ShieldCheck className="w-4 h-4 mr-2" />Send OTP to Phone</>
                )}
              </Button>
            </form>
          </>
        ) : (
          <form onSubmit={onResetPassword} className="space-y-4">
            {/* Dev hint */}
            {devHint && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  <span className="font-semibold">Dev mode</span> —{' '}
                  {method === 'email' ? 'no SMTP configured' : 'no SMS provider'}.
                  Your code is{' '}
                  <span className="font-mono font-bold tracking-widest text-amber-900">{devHint}</span>
                  {' '}(auto-filled below).
                </p>
              </div>
            )}

            {/* 6-box OTP input */}
            <div className="space-y-1.5">
              <Label>{method === 'email' ? '6-digit reset code' : '6-digit OTP'}</Label>
              <div className="flex gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={code[i] ?? ''}
                    autoFocus={i === 0}
                    onChange={(e) => {
                      const digit = e.target.value.replace(/\D/g, '').slice(-1)
                      const next = (code.slice(0, i) + digit + code.slice(i + 1)).slice(0, 6)
                      setCode(next)
                      if (digit && i < 5) {
                        const sib = e.target.parentElement?.children[i + 1] as HTMLInputElement
                        sib?.focus()
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !code[i] && i > 0) {
                        const prev = (e.target as HTMLInputElement).parentElement?.children[i - 1] as HTMLInputElement
                        prev?.focus()
                        setCode(code.slice(0, i - 1) + code.slice(i))
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault()
                      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
                      setCode(pasted)
                    }}
                    className={cn(
                      'w-10 h-12 text-center text-xl font-mono font-bold border-2 rounded-lg outline-none transition-all',
                      'focus:border-primary focus:ring-2 focus:ring-ring',
                      code[i]
                        ? 'border-primary/60 bg-accent text-primary'
                        : 'border-gray-200 bg-white text-gray-900',
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400">
                Valid for 10 minutes.
              </p>
            </div>

            <PwField
              id="fp-new-pwd"
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Min. 8 characters"
            />

            <PwField
              id="fp-confirm-pwd"
              label="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Re-enter new password"
            />

            {confirmPassword.length > 0 && (
              <p className={cn(
                'text-xs font-medium',
                newPassword === confirmPassword ? 'text-green-600' : 'text-red-500',
              )}>
                {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 h-11"
              disabled={loading || code.length !== 6 || newPassword !== confirmPassword}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Resetting…</>
                : <><ShieldCheck className="w-4 h-4 mr-2" />Set New Password</>}
            </Button>

            <button
              type="button"
              onClick={resetAll}
              className="w-full text-xs text-gray-500 hover:text-primary text-center transition-colors"
            >
              ← Back / resend code
            </button>
          </form>
        )}

        {/* Help section */}
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Need help?</p>
          <div className="space-y-1.5">
            {SUPPORT_PHONE && (
              <a
                href={`tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-accent hover:border-primary/30 transition-colors"
              >
                <span className="text-base">📞</span>
                <span>Call support</span>
                <span className="ml-auto font-mono text-xs text-gray-400">{SUPPORT_PHONE}</span>
              </a>
            )}
            {SUPPORT_CHAT_URL && (
              <a
                href={SUPPORT_CHAT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-accent hover:border-primary/30 transition-colors"
              >
                <span className="text-base">💬</span>
                <span>Chat with support</span>
              </a>
            )}
            {!SUPPORT_PHONE && !SUPPORT_CHAT_URL && (
              <a
                href="mailto:support@kiterp.com"
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-accent hover:border-primary/30 transition-colors"
              >
                <span className="text-base">✉️</span>
                <span>Email support</span>
                <span className="ml-auto text-xs text-gray-400">support@kiterp.com</span>
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
