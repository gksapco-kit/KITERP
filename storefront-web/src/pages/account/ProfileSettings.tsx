import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { ProfileEdit, ChangePasswordForm, NotificationPreferencesForm } from '@/kit/account/AccountBlocks'
import { bridgeCustomer } from '@/kit/bridge'
import type { AccountUser } from '@/kit/types'
import { ChevronRight } from 'lucide-react'

export default function ProfileSettings() {
  const { customer } = useAuthStore()
  const { storePath } = useVendor()

  if (!customer) return null

  const kitUser: AccountUser = bridgeCustomer(customer)

  const handleSaveProfile = (_updated: AccountUser) => {
    // TODO: wire to PUT /api/customers/me
    toast.success('Profile updated')
  }

  const handleChangePassword = (_data: { current: string; next: string }) => {
    // TODO: wire to POST /api/customers/me/change-password
    toast.success('Password updated')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-1.5">
        <Link to={storePath('/account')} className="hover:text-primary">Account</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium">Profile & Settings</span>
      </nav>

      <h1 className="text-2xl font-bold mb-8">Profile &amp; Settings</h1>

      <div className="space-y-6">
        <ProfileEdit user={kitUser} onSave={handleSaveProfile} />
        <ChangePasswordForm onSubmit={handleChangePassword} />
        <NotificationPreferencesForm />
      </div>
    </div>
  )
}
