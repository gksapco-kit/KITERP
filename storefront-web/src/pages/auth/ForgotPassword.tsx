import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useVendor } from '@/contexts/VendorContext'
import { storeApi } from '@/api/store'
import { imgUrl, cn } from '@/lib/utils'
import {
  Store, ShieldCheck, Mail, ArrowLeft, Phone as PhoneIcon,
  Loader2, AlertCircle, Eye, EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  NOT_REGISTERED_EMAIL,
  NOT_REGISTERED_PHONE,
  extractAuthApiDetail,
  resetCodeWasIssued,
} from '@/lib/otpAuth'
import { useAuthStoreTheme } from './authStoreTheme'

type Method = 'email' | 'phone'
type Step = 'request' | 'code'

function MethodTab({
  active, icon: Icon, label, onClick, activeColor,
}: {
  active: boolean
  icon: typeof Mail
  label: string
  onClick: () => void
  activeColor: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all',
        active ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700',
      )}
      style={active ? { color: activeColor } : undefined}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}

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
          className="pr-10 border-gray-300"
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

export default function ForgotPassword() {
  const { vendor, storePath } = useVendor()
  const navigate = useNavigate()
  const { primary, background, linkColor, btnText, panelGradient, fontFamily } = useAuthStoreTheme()

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

  const onRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (method === 'email') {
      if (!email.includes('@')) { setError('Enter a valid email address'); return }
    } else if (!phone || phone.replace(/\D/g, '').length < 7) {
      setError('Enter a valid phone number with country code')
      return
    }

    setLoading(true)
    try {
      if (method === 'email') {
        const emailVal = email.trim().toLowerCase()
        const data = await storeApi.forgotPasswordEmail(emailVal)
        if (!resetCodeWasIssued(data)) {
          setError(NOT_REGISTERED_EMAIL)
          toast.error(NOT_REGISTERED_EMAIL)
          return
        }
        setDevHint(data.dev_hint)
        setMaskedTarget(emailVal)
        toast.success('Reset code sent — check your email')
        setStep('code')
      } else {
        const phoneVal = phone.trim()
        const data = await storeApi.forgotPasswordPhone(phoneVal)
        if (!resetCodeWasIssued(data)) {
          setError(NOT_REGISTERED_PHONE)
          toast.error(NOT_REGISTERED_PHONE)
          return
        }
        setDevHint(data.dev_hint)
        setMaskedTarget(data.to || phoneVal)
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

  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (code.length !== 6) { setError('Enter the 6-digit code'); return }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }

    setLoading(true)
    try {
      await storeApi.resetPassword({
        ...(method === 'email'
          ? { email: email.trim().toLowerCase() }
          : { phone: phone.trim() }),
        code,
        new_password: newPassword,
      })
      toast.success('Password reset successfully — please sign in')
      navigate(storePath('/login'))
    } catch (err: unknown) {
      setError(extractAuthApiDetail(err, 'Invalid or expired code', method))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-3 py-8 sm:px-4 sm:py-10" style={{ backgroundColor: background, fontFamily }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden">
          <div className="px-4 py-6 sm:px-8 sm:py-8 text-center" style={{ background: panelGradient }}>
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-lg ring-4 ring-white/25">
              {vendor?.logo_url ? (
                <img src={imgUrl(vendor.logo_url)} alt={vendor.display_name} className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <Store className="w-8 h-8 text-white" />
              )}
            </div>
            <h1 className="text-xl font-bold text-white">{vendor?.display_name || 'Our Store'}</h1>
          </div>

          <div className="px-4 py-6 sm:px-8 sm:py-8 space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
              <p className="text-sm text-gray-600 mt-1">
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
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {step === 'request' ? (
              <>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  <MethodTab
                    active={method === 'email'}
                    icon={Mail}
                    label="Via Email"
                    onClick={() => switchMethod('email')}
                    activeColor={primary}
                  />
                  <MethodTab
                    active={method === 'phone'}
                    icon={PhoneIcon}
                    label="Via Phone"
                    onClick={() => switchMethod('phone')}
                    activeColor={primary}
                  />
                </div>

                <form onSubmit={onRequestCode} className="space-y-4">
                  {method === 'email' ? (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="h-11 pl-10 border-gray-300"
                          autoFocus
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">
                        We'll send a 6-digit code to this email address.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">Phone number</label>
                      <PhoneInput
                        id="fp-phone"
                        value={phone}
                        onChange={setPhone}
                        defaultCountryIso="IN"
                        placeholder="Mobile number"
                      />
                      <p className="text-xs text-gray-400 mt-1.5">
                        We'll send a 6-digit OTP to this number.
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 font-bold hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: primary, color: btnText }}
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
                {devHint && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800">
                      <span className="font-semibold">Dev mode</span> —{' '}
                      {method === 'email' ? 'no SMTP configured' : 'no SMS provider'}.
                      Your code is{' '}
                      <span className="font-mono font-bold tracking-widest text-amber-900">{devHint}</span>
                      {' '}(for local testing only).
                    </p>
                  </div>
                )}

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
                          code[i]
                            ? 'border-gray-400 bg-gray-50 text-gray-900'
                            : 'border-gray-200 bg-white text-gray-900',
                        )}
                        style={code[i] ? { borderColor: primary } : undefined}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">Valid for 10 minutes.</p>
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
                  className="w-full h-11 font-bold hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: primary, color: btnText }}
                  disabled={loading || code.length !== 6 || newPassword !== confirmPassword}
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Resetting…</>
                    : <><ShieldCheck className="w-4 h-4 mr-2" />Set New Password</>}
                </Button>

                <button
                  type="button"
                  onClick={resetAll}
                  className="w-full text-xs text-gray-500 hover:underline text-center transition-colors"
                >
                  ← Back / resend code
                </button>
              </form>
            )}

            <Link
              to={storePath('/login')}
              className="flex items-center justify-center gap-1.5 mt-2 text-sm font-medium transition-colors"
              style={{ color: linkColor }}
            >
              <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </Link>
          </div>

          <div className="flex items-center justify-center gap-1.5 py-4 border-t text-xs text-gray-500" style={{ backgroundColor: background }}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secured by KITERP</span>
          </div>
        </div>
      </div>
    </div>
  )
}
