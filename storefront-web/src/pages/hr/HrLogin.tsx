import { useState } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useVendor } from '@/contexts/VendorContext'
import { useHrAuthStore, type HrEmployeePreview } from '@/stores/hrAuthStore'
import { setHrVendorContext } from '@/api/hrClient'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
      const { access_token, employee, branch } = res.data as {
        access_token: string
        employee: HrEmployeePreview
        branch?: { id: string; code: string | null; name: string | null }
      }
      if (!access_token || !employee) {
        setError('Unexpected response from server.')
        return
      }
      setSession(access_token, employee, branch ?? null)
      navigate(from && from.includes('/hr') ? from : storePath('/hr'), { replace: true })
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
        <h1 className="text-2xl font-bold text-gray-900">Employee HR portal</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Sign in with your work account (email or employee code). This is separate from the customer store login.
        </p>
        {branchFromUrl && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            Location filter: <span className="font-mono font-semibold">{branchFromUrl}</span>
            {' '}(must match your assigned outlet if your HR profile is tied to a store)
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="hr-login">Email or employee code</Label>
            <Input
              id="hr-login"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="hr-password">Password</Label>
            <Input
              id="hr-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to={storePath('/')} className="text-blue-600 hover:underline">
            Back to store
          </Link>
        </p>
      </div>
    </div>
  )
}
