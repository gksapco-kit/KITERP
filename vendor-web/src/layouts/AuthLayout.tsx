import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useAuthHydrated } from '@/hooks/useAuthHydrated'
import { marketingHomeUrl } from '@/lib/appUrls'
import { PageLoading } from '@/components/common/Loading'
import { KitErpBrandMark } from '@/components/KitErpBrandMark'

export default function AuthLayout() {
  const hydrated = useAuthHydrated()
  const { isAuthenticated, accessToken } = useAuthStore()
  const location = useLocation()
  const homeHref = marketingHomeUrl()

  // Admin → vendor SSO always uses /auth/handoff?token=… — must run even when a session
  // already exists (e.g. switching to another business). Never redirect away before redeem.
  const isVendorHandoffRoute = location.pathname.replace(/\/+$/, '') === '/auth/handoff'
  /** Vendor login card width (19.05rem base + 15% ≈ 21.91rem). */
  const narrowLoginColumn = location.pathname.replace(/\/+$/, '') === '/login'
  const authPath = location.pathname.replace(/\/+$/, '') || '/'

  useEffect(() => {
    if (authPath === '/login') document.title = 'Login — KITERP'
    else if (authPath === '/forgot-password') document.title = 'Forgot Password — KITERP'
    else if (authPath === '/auth/handoff') document.title = 'Sign In — KITERP'
    else document.title = 'KITERP'
  }, [authPath])

  // Require a real access token so stale `isAuthenticated` from persisted state alone cannot
  // bounce /login ↔ / with ProtectedRoute (blank thrash after localStorage was cleared elsewhere).
  if (!hydrated) return <PageLoading />
  if (isAuthenticated && accessToken && !isVendorHandoffRoute) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      <div className="hidden lg:flex lg:h-screen lg:w-1/2 lg:shrink-0 bg-primary flex-col p-12 xl:p-14">
        <a
          href={homeHref}
          className="inline-flex shrink-0 items-center gap-2 self-start text-white transition-opacity hover:opacity-80"
        >
          <KitErpBrandMark className="h-9 w-9" />
          <span className="text-base font-bold tracking-tight xl:text-lg">KITERP</span>
        </a>
        <div className="flex flex-1 items-center justify-center">
          <div className="mx-auto max-w-md text-center text-white">
            <p className="text-base font-bold uppercase tracking-[0.2em] text-white sm:text-lg sm:tracking-[0.18em]">
              KIT ERP
            </p>
            <div className="mx-auto mt-8 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-white/10 shadow-lg shadow-black/10 ring-1 ring-white/15">
              <KitErpBrandMark className="h-14 w-14 rounded-2xl" />
            </div>
            <h1 className="mt-10 text-4xl font-bold tracking-tight sm:text-5xl">
              Central Application
            </h1>
            <p className="mt-4 text-lg font-light leading-relaxed text-white/70">
              Manage your business with ease
            </p>
          </div>
        </div>
      </div>
      <div className="flex min-h-screen flex-1 flex-col bg-background lg:h-screen lg:min-h-0 lg:overflow-y-auto">
        <header className="shrink-0 border-b border-slate-100 px-4 py-2 sm:px-5 lg:hidden">
          <a
            href={homeHref}
            className="inline-flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <KitErpBrandMark />
            <span className="text-base font-bold text-slate-900">KITERP</span>
          </a>
        </header>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className={narrowLoginColumn ? 'w-full max-w-[min(100%,21.9075rem)]' : 'w-full max-w-md'}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
