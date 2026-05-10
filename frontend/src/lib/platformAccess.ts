import type { User } from '@/types/user'
import { formatPlatformJobRole } from '@/lib/platformTeam'

/** Short label for sidebar / profile (platform job or vendor role). */
export function getDashboardUserRoleLabel(user: User | null | undefined): string | null {
  if (!user) return null
  if (user.is_superuser) return 'Super Admin'
  if (user.platform_staff_role === 'support') {
    const job = formatPlatformJobRole(user.platform_staff_job_role)
    return job !== '—' ? job : 'Support'
  }
  const vr = user.vendor_role
  if (vr?.role_name?.trim()) return vr.role_name.trim()
  if (vr?.role) {
    return vr.role
      .split('_')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
      .join(' ')
  }
  return null
}

/** Can use the platform admin app (port 3000): full superuser or support staff. */
export function isPlatformStaff(user: User | null | undefined): boolean {
  if (!user) return false
  if (user.is_superuser) return true
  return user.platform_staff_role === 'support'
}

/** Full platform control (not support-only). */
export function isSuperuserAdmin(user: User | null | undefined): boolean {
  return !!user?.is_superuser
}

/** Create business accounts from the admin directory (superuser or platform support). */
export function canCreateBusinessAccounts(user: User | null | undefined): boolean {
  return isPlatformStaff(user)
}
