import { Outlet, useLocation } from 'react-router-dom'
import { useDocumentSeo, adminPageTitle } from '@/lib/documentSeo'

export default function AuthLayout() {
  const { pathname } = useLocation()
  const authPath = pathname.replace(/\/+$/, '') || '/'
  const pageLabel =
    authPath === '/login' ? 'Login'
      : authPath === '/forgot-password' ? 'Forgot Password'
        : authPath === '/register' ? 'Register'
          : 'Sign In'

  useDocumentSeo({
    title: adminPageTitle(pageLabel),
    description: 'Sign in to the KIT ERP admin console.',
    noindex: true,
  })
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-bold text-gray-900">
          KIT ERP
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Business Management Platform
        </p>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
