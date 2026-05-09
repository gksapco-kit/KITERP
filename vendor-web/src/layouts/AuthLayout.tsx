import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Store } from 'lucide-react'

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore()

  if (isAuthenticated) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center">
        <div className="text-center text-white">
          <Store className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-4xl font-bold">Central Application</h1>
          <p className="mt-2 text-lg opacity-80">Manage your business with ease</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
