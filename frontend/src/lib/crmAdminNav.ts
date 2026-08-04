import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Contact2,
  GitBranch,
  Hash,
  Heart,
  History,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Megaphone,
  Target,
  UsersRound,
  Workflow,
} from 'lucide-react'

/** Mirrors vendor-web CRM Management sidebar, without Payment Follow-ups / Credit Control. */
export type CrmAdminNavItem = {
  /** Admin route segment under `/dashboard/crm/...` */
  slug: string
  label: string
  icon: LucideIcon
  /** Vendor-web path opened via handoff. */
  vendorPath: string
}

export const CRM_ADMIN_NAV_ITEMS: CrmAdminNavItem[] = [
  { slug: 'dashboard', label: 'CRM Dashboard', icon: LayoutDashboard, vendorPath: '/crm' },
  { slug: 'contacts', label: 'Contacts', icon: Contact2, vendorPath: '/crm/contacts' },
  { slug: 'leads', label: 'Leads', icon: Target, vendorPath: '/crm/leads' },
  { slug: 'pipeline', label: 'Pipeline', icon: GitBranch, vendorPath: '/crm/pipeline' },
  { slug: 'activities', label: 'Tasks', icon: Activity, vendorPath: '/crm/activities' },
  { slug: 'tickets', label: 'Tickets', icon: LifeBuoy, vendorPath: '/crm/tickets' },
  { slug: 'kb', label: 'Knowledge Base', icon: BookOpen, vendorPath: '/crm/kb' },
  { slug: 'segments', label: 'Segments', icon: UsersRound, vendorPath: '/crm/segments' },
  { slug: 'templates', label: 'Email Templates', icon: Mail, vendorPath: '/crm/templates' },
  { slug: 'campaigns', label: 'Campaigns', icon: Megaphone, vendorPath: '/crm/campaigns' },
  { slug: 'care-reminder', label: 'Care & Reminders', icon: Heart, vendorPath: '/crm/care-reminder' },
  { slug: 'workflows', label: 'Workflows', icon: Workflow, vendorPath: '/crm/workflows' },
  { slug: 'ai', label: 'AI Insights', icon: Bot, vendorPath: '/crm/ai' },
  { slug: 'reports', label: 'CRM Reports', icon: BarChart3, vendorPath: '/crm/reports' },
  { slug: 'audit', label: 'Audit Log', icon: History, vendorPath: '/crm/audit' },
  { slug: 'number-ranges', label: 'Number Ranges', icon: Hash, vendorPath: '/crm/number-ranges' },
]

export const CRM_ADMIN_BASE = '/dashboard/crm'

export function getCrmAdminNavItem(slug: string | undefined | null): CrmAdminNavItem | undefined {
  if (!slug) return undefined
  return CRM_ADMIN_NAV_ITEMS.find((item) => item.slug === slug)
}

export function crmAdminPath(slug: string): string {
  return `${CRM_ADMIN_BASE}/${slug}`
}
