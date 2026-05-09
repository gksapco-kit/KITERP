import type { User } from '@/types/user'

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
