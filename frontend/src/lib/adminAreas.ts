import type { User } from '@/types/user'
import { hasPlatformPermission } from '@/lib/platformAccess'
import { CRM_ADMIN_BASE, CRM_ADMIN_NAV_ITEMS } from '@/lib/crmAdminNav'
import { FINANCE_ADMIN_BASE, FINANCE_ADMIN_NAV_ITEMS } from '@/lib/financeAdminNav'
import { HR_ADMIN_BASE, HR_ADMIN_NAV_ITEMS } from '@/lib/hrAdminNav'

/**
 * Admin sidebar areas that support staff can be granted through a job role.
 * The permission keys must match `PLATFORM_ROLE_PERMISSIONS` in
 * `backend/app/models/platform_job_role.py`.
 *
 * CRM / Finance / HR are granted per sub-module as `<module>.<slug>.view|manage`
 * (catalog: `backend/app/core/platform_modules.py`). `admin.crm|finance|hr` are derived by
 * the backend and mean "at least one sub-module is viewable".
 *
 * Everything else in the admin sidebar (Plans, All Templates, Support team, User Roles,
 * Disputes, Table Data, Settings, Vendor App Builds) is Super Admin only.
 */
export type AdminModule = 'crm' | 'finance' | 'hr'

export const ADMIN_MODULES: Record<
  AdminModule,
  { base: string; permission: string; slugs: string[] }
> = {
  crm: {
    base: CRM_ADMIN_BASE,
    permission: 'admin.crm',
    slugs: CRM_ADMIN_NAV_ITEMS.map((i) => i.slug),
  },
  finance: {
    base: FINANCE_ADMIN_BASE,
    permission: 'admin.finance',
    slugs: FINANCE_ADMIN_NAV_ITEMS.map((i) => i.slug),
  },
  hr: {
    base: HR_ADMIN_BASE,
    permission: 'admin.hr',
    slugs: HR_ADMIN_NAV_ITEMS.map((i) => i.slug),
  },
}

/** Top-level (non-module) areas with a single permission each. */
export const SUPPORT_ADMIN_AREAS = [
  { path: '/dashboard', permission: 'admin.dashboard', exact: true },
  { path: '/dashboard/vendors', permission: 'admin.vendors' },
  { path: '/dashboard/website-analytics', permission: 'admin.website_analytics' },
  { path: '/dashboard/account-activity', permission: 'admin.account_activity' },
] as const

/** True when the user may open a CRM / Finance / HR sub-module (view or manage). */
export function hasSubmoduleAccess(
  user: User | null | undefined,
  module: AdminModule,
  slug: string,
): boolean {
  return (
    hasPlatformPermission(user, `${module}.${slug}.view`) ||
    hasPlatformPermission(user, `${module}.${slug}.manage`)
  )
}

/** True when the user may change data in a sub-module. */
export function canManageSubmodule(
  user: User | null | undefined,
  module: AdminModule,
  slug: string,
): boolean {
  return hasPlatformPermission(user, `${module}.${slug}.manage`)
}

export function firstAllowedSubmodulePath(
  user: User | null | undefined,
  module: AdminModule,
): string | null {
  const { base, slugs } = ADMIN_MODULES[module]
  const slug = slugs.find((s) => hasSubmoduleAccess(user, module, s))
  return slug ? `${base}/${slug}` : null
}

/** First top-level admin area (or module sub-module) this user may open. */
export function firstAllowedAdminPath(user: User | null | undefined): string | null {
  const area = SUPPORT_ADMIN_AREAS.find((a) => hasPlatformPermission(user, a.permission))
  if (area) return area.path
  for (const module of Object.keys(ADMIN_MODULES) as AdminModule[]) {
    const path = firstAllowedSubmodulePath(user, module)
    if (path) return path
  }
  return null
}

function moduleForPath(pathname: string): { module: AdminModule; section?: string } | null {
  for (const module of Object.keys(ADMIN_MODULES) as AdminModule[]) {
    const { base } = ADMIN_MODULES[module]
    if (pathname === base || pathname === `${base}/`) return { module }
    if (pathname.startsWith(`${base}/`)) {
      return { module, section: pathname.slice(base.length + 1).split('/')[0] }
    }
  }
  return null
}

export type AdminPathAccess = { allowed: true } | { allowed: false; redirectTo: string | null }

/**
 * Access decision for support staff. Paths outside the gated areas are not decided here
 * (their pages enforce Super Admin themselves).
 */
export function adminPathAccess(user: User | null | undefined, pathname: string): AdminPathAccess {
  const mod = moduleForPath(pathname)
  if (mod) {
    const { permission, slugs } = ADMIN_MODULES[mod.module]
    const moduleAllowed = hasPlatformPermission(user, permission)
    const sectionKnown = mod.section ? slugs.includes(mod.section) : false
    const sectionAllowed = !mod.section || !sectionKnown || hasSubmoduleAccess(user, mod.module, mod.section)
    if (moduleAllowed && sectionAllowed) return { allowed: true }
    const sibling = moduleAllowed ? firstAllowedSubmodulePath(user, mod.module) : null
    return { allowed: false, redirectTo: sibling ?? firstAllowedAdminPath(user) }
  }

  const area = SUPPORT_ADMIN_AREAS.find((a) =>
    'exact' in a && a.exact
      ? pathname === a.path || pathname === `${a.path}/`
      : pathname === a.path || pathname.startsWith(`${a.path}/`),
  )
  if (!area || hasPlatformPermission(user, area.permission)) return { allowed: true }
  return { allowed: false, redirectTo: firstAllowedAdminPath(user) }
}
