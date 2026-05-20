import { useState } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useVendor } from '@/contexts/VendorContext'
import { useHrAuthStore, type HrEmployeePreview } from '@/stores/hrAuthStore'
import { setHrVendorContext } from '@/api/hrClient'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, ChevronLeft } from 'lucide-react'

export default function HrLogin() {
  const { storePath, vendorSlug, vendor } = useVendor()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: { pathname?: string } } }
  const [searchParams] = useSearchParams()
  const branchFromUrl = searchParams.get('branch')?.trim() || ''
  const setSession = useHrAuthStore((s) => s.setSession)

  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [showForgot, setShowForgot] = useState(false)
  const [forgotLogin, setForgotLogin] = useState('')
  const [forgotResult, setForgotResult] = useState<{ found: boolean; employee_name?: string | null } | null>(null)
  const [forgotLoading, setForgotLoading] = useState(false)

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setForgotLoading(true)
    setForgotResult(null)
    try {
      const headers: Record<string, string> = {}
      if (vendorSlug) headers['X-Vendor-Slug'] = vendorSlug
      if (vendor?.id) headers['X-Vendor-Id'] = vendor.id
      const res = await axios.post(`${getStorefrontApiBaseUrl()}/store/hr/forgot-password`, { login: forgotLogin.trim() }, { headers })
      setForgotResult(res.data)
    } catch {
      setForgotResult({ found: false })
    } finally {
      setForgotLoading(false)
    }
  }

  const from = location.state?.from?.pathname

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // Never send a stale X-Vendor-Id from localStorage when vendor fetch failed — it overrides slug on the
      // backend and HR login resolves the wrong tenant (“no employee profile”).
      if (vendorSlug && vendor?.id) {
        setHrVendorContext(vendorSlug, vendor.id)
      } else if (vendorSlug) {
        localStorage.setItem('vendor_slug', vendorSlug)
        localStorage.removeItem('vendor_id')
      }
      const headers: Record<string, string> = {}
      if (vendorSlug) headers['X-Vendor-Slug'] = vendorSlug
      if (vendor?.id) headers['X-Vendor-Id'] = vendor.id

      const payload: { login: string; password: string; branch?: string } = {
        login: login.trim(),
        password,
      }
      if (branchFromUrl) payload.branch = branchFromUrl

      const res = await axios.post(`${getStorefrontApiBaseUrl()}/store/hr/login`, payload, { headers })
      const { access_token, employee, branch, must_change_password } = res.data as {
        access_token: string
        employee: HrEmployeePreview
        branch?: { id: string; code: string | null; name: string | null }
        must_change_password?: boolean
      }
      if (!access_token || !employee) {
        setError('Unexpected response from server.')
        return
      }
      setSession(access_token, employee, branch ?? null)
      if (must_change_password) {
        navigate(storePath('/hr/change-password'), { replace: true })
      } else {
        navigate(from && from.includes('/hr') ? from : storePath('/hr'), { replace: true })
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } }
      const detail = ax.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Invalid email/code or password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">

        {showForgot ? (
          <>
            <button type="button" onClick={() => { setShowForgot(false); setForgotResult(null) }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-4">
              <ChevronLeft className="w-3.5 h-3.5" /> Back to sign in
            </button>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Forgot password?</h1>
            <p className="text-sm text-gray-500 mb-5">
              Enter your email or employee code and we'll look up your account.
            </p>
            {!forgotResult ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <Label htmlFor="forgot-login">Email or employee code</Label>
                  <Input id="forgot-login" autoComplete="username" className="mt-1" required
                    value={forgotLogin} onChange={e => setForgotLogin(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={forgotLoading}>
                  {forgotLoading ? 'Looking up…' : 'Find my account'}
                </Button>
              </form>
            ) : forgotResult.found ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-900">
                <p className="font-semibold mb-1">Account found{forgotResult.employee_name ? ` — ${forgotResult.employee_name}` : ''}</p>
                <p>Your password can only be reset by your HR administrator. Please contact HR and ask them to generate a new one-time password from your employee profile in the Credentials tab.</p>
                <p className="mt-2 text-xs text-green-700">Once they share the new temporary password with you, sign in and you'll be prompted to set a new permanent password.</p>
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>No employee profile found for that email or code on this portal. Please check the value or contact your HR administrator.</p>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Employee HR portal</h1>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              Sign in with your work account (email or employee code).
            </p>
            {branchFromUrl && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                Location filter: <span className="font-mono font-semibold">{branchFromUrl}</span>
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="hr-login">Email or employee code</Label>
                <Input id="hr-login" autoComplete="username" className="mt-1" required
                  value={login} onChange={(e) => setLogin(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="hr-password">Password</Label>
                <Input id="hr-password" type="password" autoComplete="current-password" required
                  className="mt-1"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
              <p className="text-center">
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </p>
            </form>
            <p className="text-center text-xs text-gray-400 mt-6">
              Access is managed by your HR administrator. Contact HR if you need an account.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
