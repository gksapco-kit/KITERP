import { useAuthStore } from '@/stores/authStore'

/**
 * Check if the current vendor user has a specific permission.
 */
export function useHasPermission(permission: string): boolean {
  const { user } = useAuthStore()
  const perms = user?.vendor_role?.permissions || []
  return perms.includes(permission)
}

/**
 * Check if the current vendor user has ALL of the listed permissions.
 */
export function useHasAllPermissions(...permissions: string[]): boolean {
  const { user } = useAuthStore()
  const perms = user?.vendor_role?.permissions || []
  return permissions.every((p) => perms.includes(p))
}

/**
 * Check if the current vendor user has ANY of the listed permissions.
 */
export function useHasAnyPermission(...permissions: string[]): boolean {
  const { user } = useAuthStore()
  const perms = user?.vendor_role?.permissions || []
  return permissions.some((p) => perms.includes(p))
}

/**
 * Get the current user's vendor role name (e.g., "owner", "admin", "custom").
 */
export function useVendorRole(): string | null {
  const { user } = useAuthStore()
  return user?.vendor_role?.role || null
}

/**
 * Check if the current user is a vendor owner.
 */
export function useIsVendorOwner(): boolean {
  return useVendorRole() === 'owner'
}

/**
 * Check if the current user is a vendor owner or admin.
 */
export function useIsVendorAdmin(): boolean {
  const { user } = useAuthStore()
  const role = user?.vendor_role?.role
  const roleName = user?.vendor_role?.role_name?.toLowerCase()
  return role === 'owner' || role === 'admin' || roleName === 'owner' || roleName === 'admin'
}
