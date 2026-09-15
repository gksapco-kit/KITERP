import { useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { loadEnabledSectionIds, isPinnedSidebarSection } from '@/layouts/sidebarNavApps'
import type { NavOrderScope } from '@/layouts/sidebarNavOrder'

/**
 * Whether a sidebar app (All Apps install state) is currently installed for this user/role.
 * Pinned apps (e.g. My Kit) are always treated as installed.
 */
export function useSidebarAppInstalled(sectionId: string): boolean {
  const user = useAuthStore((s) => s.user)
  const vendorRole = useAuthStore((s) => s.user?.vendor_role)

  return useMemo(() => {
    if (isPinnedSidebarSection(sectionId)) return true
    if (!user?.id) {
      // Before session resolves, treat as installed so we don't flash empty chrome.
      return true
    }
    const roleKey = vendorRole?.role_id ?? vendorRole?.role ?? vendorRole?.role_name ?? 'member'
    const scope: NavOrderScope = { userId: user.id, roleKey: String(roleKey) }
    return loadEnabledSectionIds(['my-kit', sectionId], scope).includes(sectionId)
  }, [sectionId, user?.id, vendorRole?.role_id, vendorRole?.role, vendorRole?.role_name])
}
