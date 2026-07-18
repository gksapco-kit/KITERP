import { cn } from '@/lib/utils'

/** Built-in fallbacks when the roles API has not loaded yet. */
export const PLATFORM_JOB_ROLES = [
  { value: 'sales', label: 'Sales' },
  { value: 'crm', label: 'CRM' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'relationship_manager', label: 'Relationship manager' },
  { value: 'team_manager', label: 'Team manager' },
] as const

export type JobRoleOption = { value: string; label: string; permissions?: string[] }

export function formatPlatformJobRole(
  role: string | null | undefined,
  options?: JobRoleOption[],
): string {
  if (!role) return '—'
  const fromOptions = options?.find((r) => r.value === role)
  if (fromOptions) return fromOptions.label
  const row = PLATFORM_JOB_ROLES.find((r) => r.value === role)
  return row?.label ?? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function isTeamManagerRole(role: string | null | undefined, options?: JobRoleOption[]): boolean {
  if (!role) return false
  if (role === 'team_manager') return true
  const opt = options?.find((r) => r.value === role)
  return !!opt?.permissions?.includes('staff.can_manage_team')
}

export function isRelationshipManagerRole(
  role: string | null | undefined,
  options?: JobRoleOption[],
): boolean {
  if (!role) return false
  if (role === 'relationship_manager') return true
  const opt = options?.find((r) => r.value === role)
  return !!opt?.permissions?.includes('vendors.scope_assigned')
}

export const platformTeamSelectClassName = cn(
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
)
