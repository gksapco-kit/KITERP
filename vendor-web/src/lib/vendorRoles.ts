import { PERMISSION_MODULE_LABELS } from '@/lib/permissionModules'

/** Words that must stay fully capitalised rather than title-cased. */
const ACRONYMS = new Set(['hr', 'qa', 'crm', 'co', 'pos', 'ar', 'ap'])

/** Turns a backend role slug (`delivery_staff`) into a display label (`Delivery Staff`). */
export function humanizeRoleSlug(slug: string): string {
  return slug
    .split('_')
    .filter(Boolean)
    .map((word) =>
      ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ')
}

/**
 * Plural form of a role label for count headings. "Staff" and "Sales" are already plural or
 * uncountable, so they stay as they are.
 */
export function pluralizeRoleLabel(label: string): string {
  if (/s$/i.test(label) || /staff$/i.test(label)) return label
  return `${label}s`
}

/**
 * Roles the backend never offers in `/team/assignable-roles`, so they must stay out of
 * vendor-facing role lists. `platform_staff` is granted only via the admin handoff flow.
 */
export const INTERNAL_ROLE_SLUGS = ['platform_staff']

/**
 * Badge colours for every built-in role slug, kept in step with BUILTIN_ROLE_STYLES on the
 * Roles page so a member's badge and its role card read as the same colour.
 */
export const ROLE_BADGE_COLORS: Record<string, string> = {
  owner: 'bg-primary/12 text-primary',
  admin: 'bg-blue-100 text-blue-700',
  manager: 'bg-green-100 text-green-700',
  sales: 'bg-orange-100 text-orange-700',
  staff: 'bg-gray-100 text-gray-700',
  support: 'bg-cyan-100 text-cyan-700',
  marketing: 'bg-pink-100 text-pink-700',
  cashier: 'bg-amber-100 text-amber-700',
  technician: 'bg-teal-100 text-teal-700',
  delivery_staff: 'bg-slate-100 text-slate-700',
  accountant: 'bg-violet-100 text-violet-700',
  warehouse: 'bg-yellow-100 text-yellow-800',
  purchaser: 'bg-sky-100 text-sky-700',
  production_planner: 'bg-lime-100 text-lime-800',
  qa_officer: 'bg-emerald-100 text-emerald-700',
  hr_manager: 'bg-purple-100 text-purple-700',
  project_manager: 'bg-indigo-100 text-indigo-700',
  restaurant_manager: 'bg-rose-100 text-rose-700',
  waiter: 'bg-fuchsia-100 text-fuchsia-700',
  kitchen_staff: 'bg-red-100 text-red-700',
  finance_controller: 'bg-green-100 text-green-800',
  // Custom roles reuse the project_manager hue, so the ring keeps the two tellable apart.
  custom: 'bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-400',
}

export function roleBadgeColor(role: string): string {
  return ROLE_BADGE_COLORS[role] ?? ROLE_BADGE_COLORS.custom
}

/**
 * Deep link to a member's permission matrix on the Roles page. Only `custom` roles are keyed
 * by id — every other value in `vendor_user.role` is a built-in slug from
 * DEFAULT_ROLE_PERMISSIONS and is addressed by `?builtin=`.
 */
export function rolePermissionsPath(member: { role: string; role_id?: string | null }): string {
  if (member.role !== 'custom') return `/roles?builtin=${member.role}&from=team`
  return member.role_id ? `/roles?roleId=${member.role_id}&from=team` : '/roles?from=team'
}

export type PermissionModuleSummary = {
  module: string
  label: string
  count: number
}

/** Groups dot-notation permissions by module prefix for compact display, widest module first. */
export function summarizePermissionsByModule(permissions: string[]): PermissionModuleSummary[] {
  const counts = new Map<string, number>()
  for (const perm of permissions) {
    const module = perm.split('.')[0]
    if (!module) continue
    counts.set(module, (counts.get(module) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([module, count]) => ({
      module,
      label: PERMISSION_MODULE_LABELS[module] ?? humanizeRoleSlug(module),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}
