import { Link } from 'react-router-dom'
import { Layers } from 'lucide-react'
import { useBuilderStore } from '../../store/useBuilderStore'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: React.ReactNode
  footer: React.ReactNode
  homePath: string
  variant?: 'login' | 'signup'
}

export function AuthLayout({ title, subtitle, children, footer, homePath, variant = 'login' }: AuthLayoutProps) {
  const siteName = useBuilderStore((s) => s.siteName)

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-[42%] flex-col justify-between bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900 p-10 text-white lg:flex">
        <Link to={homePath} className="flex items-center gap-2 text-lg font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
            <Layers className="h-5 w-5" />
          </span>
          {siteName || 'My Website'}
        </Link>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            {variant === 'signup' ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mt-3 max-w-sm text-sm text-white/80">
            {variant === 'signup'
              ? 'Register with email and password. Your profile stays on this device for the demo.'
              : 'Secure sign-in for your account. Manage your profile and access your site experience.'}
          </p>
        </div>
        <p className="text-xs text-white/50">Accounts are stored locally in this demo builder.</p>
      </aside>

      <main className="flex flex-1 flex-col justify-center bg-gray-50 px-6 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link to={homePath} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-gray-900 lg:hidden">
            <Layers className="h-5 w-5 text-brand-600" />
            {siteName || 'My Website'}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
          <p className="mt-6 text-center text-sm text-gray-600">{footer}</p>
        </div>
      </main>
    </div>
  )
}
