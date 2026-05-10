import { cn } from '@/lib/utils'

export const PLATFORM_JOB_ROLES = [
  { value: 'sales', label: 'Sales' },
  { value: 'crm', label: 'CRM' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'relationship_manager', label: 'Relationship manager' },
  { value: 'team_manager', label: 'Team manager' },
] as const

export function formatPlatformJobRole(role: string | null | undefined): string {
  if (!role) return '—'
  const row = PLATFORM_JOB_ROLES.find((r) => r.value === role)
  return row?.label ?? role
}

export const platformTeamSelectClassName = cn(
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
)
