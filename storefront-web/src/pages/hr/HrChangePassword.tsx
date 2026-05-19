import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVendor } from '@/contexts/VendorContext'
import { useHrAuthStore } from '@/stores/hrAuthStore'
import { hrApiClient } from '@/api/hrClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldCheck, Eye, EyeOff } from 'lucide-react'

export default function HrChangePassword() {
  const { storePath } = useVendor()
  const navigate = useNavigate()
  const employee = useHrAuthStore((s) => s.employee)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (next !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await hrApiClient.post('/store/hr/change-password', {
        current_password: current,
        new_password: next,
      })
      navigate(storePath('/hr'), { replace: true })
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } }
      const detail = ax.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to change password. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Set your password</h1>
            <p className="text-sm text-gray-500">
              {employee?.full_name ? `Welcome, ${employee.full_name}!` : 'Welcome!'}
            </p>
          </div>
        </div>

        <div className="mt-4 mb-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          You signed in with a temporary one-time password. Please set a new permanent password before continuing.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="current-pw">Current (one-time) password</Label>
            <div className="relative mt-1">
              <Input
                id="current-pw"
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="new-pw">New password</Label>
            <div className="relative mt-1">
              <Input
                id="new-pw"
                type={showNext ? 'text' : 'password'}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                className="pr-10"
                placeholder="Minimum 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowNext(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirm-pw">Confirm new password</Label>
            <Input
              id="confirm-pw"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="mt-1"
              placeholder="Re-enter new password"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Saving…' : 'Set password & continue'}
          </Button>
        </form>
      </div>
    </div>
  )
}
