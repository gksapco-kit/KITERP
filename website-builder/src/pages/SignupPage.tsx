import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { PasswordInput } from '../components/auth/PasswordInput'
import { useAuthStore } from '../store/useAuthStore'

interface SignupPageProps {
  homePath?: string
  loginPath?: string
}

export function SignupPage({ homePath = '/', loginPath = '/login' }: SignupPageProps) {
  const navigate = useNavigate()
  const signup = useAuthStore((s) => s.signup)
  const isSubmitting = useAuthStore((s) => s.isSubmitting)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)
  const user = useAuthStore((s) => s.user)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (user) navigate(homePath, { replace: true })
  }, [user, navigate, homePath])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    const ok = await signup({
      name,
      email,
      phone,
      password,
      confirmPassword,
    })
    if (ok) navigate(homePath, { replace: true })
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Sign up with your details to get started."
      homePath={homePath}
      variant="signup"
      footer={
        <>
          Already have an account?{' '}
          <Link to={loginPath} className="font-semibold text-brand-600 hover:text-brand-700">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">Full name</span>
          <input
            type="text"
            autoComplete="name"
            required
            value={name}
            disabled={isSubmitting}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50"
          />
        </label>

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
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
            Phone number <span className="font-normal text-gray-400">(optional)</span>
          </span>
          <input
            type="tel"
            autoComplete="tel"
            value={phone}
            disabled={isSubmitting}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">Password</span>
          <PasswordInput
            id="signup-password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            disabled={isSubmitting}
            placeholder="At least 8 characters"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">Confirm password</span>
          <PasswordInput
            id="signup-confirm-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            disabled={isSubmitting}
            placeholder="Re-enter password"
          />
        </label>

        <p className="text-xs text-gray-500">
          By signing up, you agree to store your account locally in this browser for demo purposes.
        </p>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  )
}
