import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Store, Loader2, ShieldCheck, MailCheck, ArrowRight, CheckCircle2 } from 'lucide-react'
import axios from 'axios'
import { vendorAppUrl } from '@/lib/appUrls'

const API_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '')

export default function VerifyEmail() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as {
    email?: string
    access_token?: string
    refresh_token?: string
    vendor_slug?: string
    vendor_id?: string
    verification_code_hint?: string
  } | null

  const [code, setCode] = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!state?.email) {
      navigate('/vendor/signup', { replace: true })
    }
  }, [state, navigate])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setCode(pasted.split(''))
      inputRefs.current[5]?.focus()
    }
  }

  const handleVerify = async () => {
    const fullCode = code.join('')
    if (fullCode.length !== 6) {
      setError('Please enter the 6-digit code')
      return
    }

    setLoading(true)
    setError('')
    try {
      await axios.post(`${API_URL}/auth/verify-email`, {
        email: state!.email,
        code: fullCode,
      })
      setVerified(true)
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setError(typeof err.response.data.detail === 'string' ? err.response.data.detail : 'Verification failed — the code may have expired, try requesting a new one')
      } else {
        setError('Could not verify — please check your internet connection and try again')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoToDashboard = () => {
    if (state?.access_token) {
      const url = new URL(vendorAppUrl)
      url.searchParams.set('token', state.access_token)
      if (state.refresh_token) url.searchParams.set('refresh', state.refresh_token)
      window.location.href = url.toString()
    } else {
      window.location.href = vendorAppUrl
    }
  }

  const handleSkip = () => {
    handleGoToDashboard()
  }

  if (!state?.email) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <a href="/" className="flex items-center gap-2">
            <Store className="w-7 h-7 text-blue-600" />
            <span className="font-bold text-lg text-gray-900">KITERP</span>
          </a>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {verified ? (
            /* Success State */
            <div className="bg-white rounded-2xl border shadow-xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
              <p className="text-gray-500 mb-6">
                Your store is ready. Head to the vendor dashboard to start adding products and services.
              </p>
              <Button
                onClick={handleGoToDashboard}
                className="w-full h-12 font-bold text-base bg-blue-600 hover:bg-blue-700"
              >
                Go to Vendor Dashboard <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          ) : (
            /* Verification Form */
            <div className="bg-white rounded-2xl border shadow-xl p-8">
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                  <MailCheck className="w-7 h-7 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Verify Your Email</h2>
                <p className="text-sm text-gray-500 mt-2">
                  We've sent a 6-digit verification code to
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{state.email}</p>
              </div>

              {/* Dev mode hint */}
              {state.verification_code_hint && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <span className="font-semibold">Dev Mode:</span> Your verification code is{' '}
                  <span className="font-mono font-bold text-lg">{state.verification_code_hint}</span>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Code Input */}
              <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className="w-12 h-14 text-center text-xl font-bold border-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  />
                ))}
              </div>

              <Button
                onClick={handleVerify}
                className="w-full h-12 font-bold text-base bg-blue-600 hover:bg-blue-700 mb-3"
                disabled={loading || code.join('').length !== 6}
              >
                {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
                Verify Email
              </Button>

              <Button
                variant="ghost"
                onClick={handleSkip}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Skip for now — Go to Dashboard
              </Button>
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5" /> Secured by KITERP
          </div>
        </div>
      </div>
    </div>
  )
}
