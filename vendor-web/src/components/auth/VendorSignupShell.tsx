import { Link } from 'react-router-dom'
import { Store } from 'lucide-react'
import { VendorSignupMarketingPanel } from './VendorSignupMarketingPanel'
import { SIGNUP_BRAND, SIGNUP_BRAND_HOVER, SIGNUP_BRAND_LIGHT } from './signupTheme'

type VendorSignupShellProps = {
  children: React.ReactNode
  signInHref?: string
  signInText?: string
  homeHref?: string
}

export function VendorSignupShell({
  children,
  signInHref = '/login',
  signInText = 'Already a vendor? Sign in',
  homeHref = '/register',
}: VendorSignupShellProps) {
  return (
    <div className="flex min-h-dvh w-full flex-col md:flex-row">
      <aside
        className="hidden md:flex md:w-[44%] xl:w-[42%] px-8 py-8 xl:px-14 xl:py-12"
        style={{ backgroundColor: SIGNUP_BRAND_LIGHT }}
      >
        <div className="flex w-full max-w-lg flex-col">
          <VendorSignupMarketingPanel homeHref={homeHref} />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col bg-white">
        <header className="shrink-0 border-b border-slate-100 px-4 py-3.5 sm:px-6">
          <div className="mx-auto flex max-w-xl items-center justify-between lg:max-w-lg xl:max-w-xl">
            <Link to={homeHref} className="flex items-center gap-2 md:hidden">
              <Store className="h-5 w-5" style={{ color: SIGNUP_BRAND }} aria-hidden />
              <span className="text-base font-bold text-slate-900">KITERP</span>
            </Link>
            <span className="hidden md:block" aria-hidden />
            <p className="text-sm text-slate-600">
              {signInText.includes('Sign in') ? (
                <>
                  Already a vendor?{' '}
                  <Link
                    to={signInHref}
                    className="font-semibold hover:underline"
                    style={{ color: SIGNUP_BRAND }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = SIGNUP_BRAND_HOVER }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = SIGNUP_BRAND }}
                  >
                    Sign in
                  </Link>
                </>
              ) : (
                <Link
                  to={signInHref}
                  className="font-semibold hover:underline"
                  style={{ color: SIGNUP_BRAND }}
                >
                  {signInText}
                </Link>
              )}
            </p>
          </div>
        </header>

        <div
          className="border-b px-4 py-6 md:hidden"
          style={{ backgroundColor: SIGNUP_BRAND_LIGHT, borderColor: `${SIGNUP_BRAND}33` }}
        >
          <h1 className="text-2xl font-bold leading-tight text-slate-900">
            Start selling online{' '}
            <span style={{ color: SIGNUP_BRAND }}>in minutes</span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Create your branded store, manage products &amp; services, accept orders, and grow your business.
          </p>
        </div>

        <main className="flex flex-1 items-start justify-center px-4 py-6 sm:px-6 sm:py-8 md:items-center">
          <div className="w-full max-w-xl md:max-w-lg xl:max-w-xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
