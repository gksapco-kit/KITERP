import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { Store } from 'lucide-react'
import { VendorSignupMarketingPanel } from './VendorSignupMarketingPanel'
import { SIGNUP_BRAND, SIGNUP_BRAND_HOVER, SIGNUP_BRAND_LIGHT } from './signupTheme'
import { marketingHomeUrl } from '@/lib/appUrls'

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
  homeHref = marketingHomeUrl(),
}: VendorSignupShellProps) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden flex-col md:flex-row">
      <aside
        className="hidden h-[100dvh] md:flex md:w-[44%] xl:w-[42%] overflow-hidden px-6 py-5 xl:px-10 xl:py-6"
        style={{ backgroundColor: SIGNUP_BRAND_LIGHT }}
      >
        <div className="flex h-full w-full max-w-lg flex-col min-h-0">
          <VendorSignupMarketingPanel homeHref={homeHref} />
        </div>
      </aside>

      <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <header className="shrink-0 border-b border-slate-100 px-4 py-2 sm:px-5">
          <div className="mx-auto flex max-w-xl items-center justify-between md:max-w-lg xl:max-w-xl">
            <a href={homeHref} className="flex items-center gap-2 transition-opacity hover:opacity-80 md:hidden">
              <Store className="h-5 w-5" style={{ color: SIGNUP_BRAND }} aria-hidden />
              <span className="text-base font-bold text-slate-900">KITERP</span>
            </a>
            <span className="hidden md:block" aria-hidden />
            <p className="text-xs sm:text-sm text-slate-600">
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
          className="shrink-0 border-b px-4 py-3 md:hidden"
          style={{ backgroundColor: SIGNUP_BRAND_LIGHT, borderColor: `${SIGNUP_BRAND}33` }}
        >
          <h1 className="text-xl font-bold leading-tight text-slate-900">
            Start selling online{' '}
            <span style={{ color: SIGNUP_BRAND }}>in minutes</span>
          </h1>
          <p className="mt-1 text-xs leading-snug text-slate-600">
            Create your branded store, manage products &amp; services, accept orders, and grow your business.
          </p>
        </div>

        <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 py-2 sm:px-4 md:py-3">
          <div className="h-full w-full max-w-xl md:max-w-lg xl:max-w-xl flex items-center min-h-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
