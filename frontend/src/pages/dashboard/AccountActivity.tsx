import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff } from '@/lib/platformAccess'
import { PlatformStaffAuditSection } from '@/components/platform-team/PlatformStaffAuditSection'

export default function AccountActivity() {
  const { user } = useAuthStore()
  if (!isPlatformStaff(user)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account activity</h1>
        <p className="text-gray-600 mt-1 text-sm">
          Sign-ins and admin changes recorded for your platform account.
        </p>
      </div>
      <PlatformStaffAuditSection scope="me" title="Your audit history" />
    </div>
  )
}
