import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { PasswordInput } from '../components/auth/PasswordInput'
import { useAuthStore } from '../store/useAuthStore'

interface LoginPageProps {
  /** Where to go after login and for home link */
  homePath?: string
  signupPath?: string
}

export function LoginPage({ homePath = '/', signupPath = '/signup' }: LoginPageProps) {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const isSubmitting = useAuthStore((s) => s.isSubmitting)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)
  const user = useAuthStore((s) => s.user)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)

  useEffect(() => {
    if (user) navigate(homePath, { replace: true })
  }, [user, navigate, homePath])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    const ok = await login({ email, password, rememberMe })
    if (ok) navigate(homePath, { replace: true })
  }

  return (
    <AuthLayout
      title="Log in"
      subtitle="Enter your email and password to continue."
      homePath={homePath}
      variant="login"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to={signupPath} className="font-semibold text-brand-600 hover:text-brand-700">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            disabled={isSubmitting}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">Password</span>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            disabled={isSubmitting}
            placeholder="Your password"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          Remember me for 30 days
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Signing in…' : 'Log in'}
        </button>
      </form>
    </AuthLayout>
  )
}
