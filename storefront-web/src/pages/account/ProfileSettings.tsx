import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { storeApi } from '@/api/store'
import { ProfileEdit, ChangePasswordForm, NotificationPreferencesForm } from '@/kit/account/AccountBlocks'
import { bridgeCustomer } from '@/kit/bridge'
import type { AccountUser } from '@/kit/types'
import { ChevronRight } from 'lucide-react'
import { extractApiError } from '@/lib/errorMessages'

export default function ProfileSettings() {
  const { customer, setCustomer } = useAuthStore()
  const { storePath } = useVendor()
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({})

  useEffect(() => {
    storeApi.getNotificationPreferences()
      .then(setNotifPrefs)
      .catch(() => {
        if (customer?.notification_preferences) setNotifPrefs(customer.notification_preferences as Record<string, boolean>)
      })
  }, [customer?.id])

  if (!customer) return null

  const kitUser: AccountUser = bridgeCustomer(customer)

  const handleSaveProfile = async (updated: AccountUser) => {
    try {
      const saved = await storeApi.updateMe({
        full_name: updated.name,
        phone: updated.phone || undefined,
        avatar_url: updated.avatarUrl || undefined,
      })
      setCustomer(saved)
      toast.success('Profile updated')
    } catch (err) {
      toast.error(extractApiError(err, 'Could not update profile'))
    }
  }

  const handleChangePassword = async (data: { current: string; next: string }) => {
    try {
      await storeApi.changePassword({
        current_password: data.current,
        new_password: data.next,
      })
      toast.success('Password updated')
    } catch (err) {
      toast.error(extractApiError(err, 'Could not change password'))
    }
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
        <NotificationPreferencesForm
          value={notifPrefs}
          onChange={async (prefs) => {
            setNotifPrefs(prefs)
            try {
              await storeApi.updateNotificationPreferences(prefs)
              toast.success('Notification preferences saved')
            } catch (err) {
              toast.error(extractApiError(err, 'Could not save preferences'))
            }
          }}
        />
      </div>
    </div>
  )
}
