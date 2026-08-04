/**
 * Access matrix for platform staff job roles.
 * Source of truth for the User Roles screen (Admin nav + vendor-store handoff).
 * Keep aligned with backend `platform_staff.py` / `platform_vendor_access.py`
 * and frontend `DashboardLayout` / vendor directory gating.
 */

export type PlatformAccessTier = 'superuser' | 'support'

export type VendorStoreScope = 'all' | 'assigned_only' | 'none'

export type PlatformJobRoleAccess = {
  /** Job role value, or `superuser` for the Super Admin tier. */
  key: string
  label: string
  tier: PlatformAccessTier
  description: string
  /** Admin sidebar areas this role can open. */
  adminAreas: string[]
  /** Capabilities inside Business Accounts / vendor admin. */
  adminVendorActions: string[]
  /** Opening vendor-web via admin handoff. */
  vendorStoreAccess: {
    scope: VendorStoreScope
    summary: string
    detail: string
  }
  notes?: string[]
}

export const PLATFORM_ACCESS_MATRIX: PlatformJobRoleAccess[] = [
  {
    key: 'superuser',
    label: 'Super Admin',
    tier: 'superuser',
    description: 'Full platform control. Not assigned as a support job role.',
    adminAreas: [
      'Dashboard',
      'Business Accounts',
      'Plans',
      'All Templates',
      'Website Analytics',
      'Support team',
      'User Roles',
      'Account activity',
      'CRM Management',
      'HR Management',
      'Careers',
      'Disputes',
      'Table Data',
      'Settings',
    ],
    adminVendorActions: [
      'Create business accounts',
      'Approve / reject / edit vendors',
      'Assign relationship managers',
      'Open any vendor store via admin handoff',
    ],
    vendorStoreAccess: {
      scope: 'all',
      summary: 'All vendor stores',
      detail:
        'Handoff creates a platform_staff session in vendor-web with full store permissions.',
    },
    notes: ['Can add and manage support users and their job roles.'],
  },
  {
    key: 'sales',
    label: 'Sales',
    tier: 'support',
    description: 'Support staff focused on sales outreach and account follow-up.',
    adminAreas: [
      'Dashboard',
      'Business Accounts',
      'Website Analytics',
      'Account activity',
      'CRM Management',
      'HR Management',
      'Careers',
    ],
    adminVendorActions: [
      'Browse business accounts (read-focused)',
      'Create business accounts',
      'Open vendor stores via admin handoff (all accounts)',
    ],
    vendorStoreAccess: {
      scope: 'all',
      summary: 'All vendor stores',
      detail:
        'May open any vendor dashboard from admin. Cannot approve/reject accounts or change global settings.',
    },
  },
  {
    key: 'crm',
    label: 'CRM',
    tier: 'support',
    description: 'Support staff working leads, contacts, and pipeline in platform CRM.',
    adminAreas: [
      'Dashboard',
      'Business Accounts',
      'Website Analytics',
      'Account activity',
      'CRM Management',
      'HR Management',
      'Careers',
    ],
    adminVendorActions: [
      'Browse business accounts',
      'Create business accounts',
      'Open vendor stores via admin handoff (all accounts)',
    ],
    vendorStoreAccess: {
      scope: 'all',
      summary: 'All vendor stores',
      detail:
        'Same vendor visibility as other non-RM support roles. CRM modules are available in admin.',
    },
  },
  {
    key: 'consulting',
    label: 'Consulting',
    tier: 'support',
    description: 'Default support job role for onboarding and consulting help.',
    adminAreas: [
      'Dashboard',
      'Business Accounts',
      'Website Analytics',
      'Account activity',
      'CRM Management',
      'HR Management',
      'Careers',
    ],
    adminVendorActions: [
      'Browse business accounts',
      'Create business accounts',
      'Open vendor stores via admin handoff (all accounts)',
    ],
    vendorStoreAccess: {
      scope: 'all',
      summary: 'All vendor stores',
      detail:
        'Full handoff access to vendor-web for assistance; no approvals or Support team management.',
    },
  },
  {
    key: 'relationship_manager',
    label: 'Relationship manager',
    tier: 'support',
    description: 'Account owner for assigned business accounts only.',
    adminAreas: [
      'Dashboard',
      'Business Accounts',
      'Website Analytics',
      'Account activity',
      'CRM Management',
      'HR Management',
      'Careers',
    ],
    adminVendorActions: [
      'See only vendors assigned to them',
      'Open assigned vendor stores via admin handoff',
      'Cannot approve / reject vendors',
    ],
    vendorStoreAccess: {
      scope: 'assigned_only',
      summary: 'Assigned stores only',
      detail:
        'Vendor list, detail, and dashboard handoff are limited to accounts where they are the relationship manager.',
    },
    notes: [
      'Must be assigned on each business account before that store appears for them.',
    ],
  },
  {
    key: 'team_manager',
    label: 'Team manager',
    tier: 'support',
    description: 'Manages reporting lines for other support users (Reports to).',
    adminAreas: [
      'Dashboard',
      'Business Accounts',
      'Website Analytics',
      'Account activity',
      'CRM Management',
      'HR Management',
      'Careers',
    ],
    adminVendorActions: [
      'Browse all business accounts',
      'Create business accounts',
      'Open vendor stores via admin handoff (all accounts)',
    ],
    vendorStoreAccess: {
      scope: 'all',
      summary: 'All vendor stores',
      detail:
        'Same store access as Sales/CRM/Consulting. Can be selected as manager for other support users.',
    },
    notes: ['Team managers do not report to another manager.'],
  },
]

export function getPlatformJobRoleAccess(key: string): PlatformJobRoleAccess | undefined {
  return PLATFORM_ACCESS_MATRIX.find((r) => r.key === key)
}
