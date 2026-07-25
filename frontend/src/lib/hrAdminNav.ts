import type { LucideIcon } from 'lucide-react'
import {
  Award,
  Briefcase,
  Building2,
  Clock,
  DollarSign,
  FileSignature,
  GraduationCap,
  LifeBuoy,
  Megaphone,
  Plane,
  Receipt,
  ShieldAlert,
  Target,
  UserCheck,
  UserCog,
} from 'lucide-react'

/** Mirrors vendor-web HR Management sidebar submenus. */
export type HrAdminNavItem = {
  /** Admin route segment under `/dashboard/hr/...` */
  slug: string
  label: string
  icon: LucideIcon
  /** Vendor-web path opened via handoff (omit for native admin pages). */
  vendorPath?: string
  /** Native admin page — not loaded inside the vendor HR iframe. */
  native?: boolean
}

export const HR_ADMIN_NAV_ITEMS: HrAdminNavItem[] = [
  { slug: 'employees', label: 'Employees', icon: UserCog, vendorPath: '/hr/employees' },
  { slug: 'attendance', label: 'Attendance', icon: Clock, vendorPath: '/hr/attendance' },
  { slug: 'leaves', label: 'Leave Requests', icon: Plane, vendorPath: '/hr/leaves' },
  { slug: 'recruitment', label: 'Recruitment', icon: Briefcase, vendorPath: '/hr/recruitment' },
  { slug: 'onboarding', label: 'Onboarding', icon: UserCheck, vendorPath: '/hr/onboarding' },
  { slug: 'performance', label: 'Performance', icon: Target, vendorPath: '/hr/performance' },
  { slug: 'training', label: 'Training', icon: GraduationCap, vendorPath: '/hr/training' },
  { slug: 'compliance', label: 'Compliance', icon: ShieldAlert, vendorPath: '/hr/compliance' },
  { slug: 'announcements', label: 'Announcements', icon: Megaphone, vendorPath: '/hr/announcements' },
  { slug: 'expenses', label: 'Expense Claims', icon: Receipt, vendorPath: '/hr/expenses' },
  { slug: 'helpdesk', label: 'Helpdesk', icon: LifeBuoy, vendorPath: '/hr/helpdesk' },
  { slug: 'payroll', label: 'Payroll', icon: DollarSign, vendorPath: '/hr/payroll' },
  { slug: 'offers', label: 'Offer Letters', icon: FileSignature, vendorPath: '/hr/offers' },
  { slug: 'departments', label: 'Departments', icon: Building2, vendorPath: '/hr/departments' },
  { slug: 'designations', label: 'Designations', icon: Award, vendorPath: '/hr/designations' },
]

export const HR_ADMIN_BASE = '/dashboard/hr'

export function getHrAdminNavItem(slug: string | undefined | null): HrAdminNavItem | undefined {
  if (!slug) return undefined
  return HR_ADMIN_NAV_ITEMS.find((item) => item.slug === slug)
}

export function hrAdminPath(slug: string): string {
  return `${HR_ADMIN_BASE}/${slug}`
}
