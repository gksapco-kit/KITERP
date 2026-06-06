import type { LucideIcon } from 'lucide-react'
import {
  Calculator, BookOpen, PenLine, Users, Wrench, RefreshCw, Sparkles,
  Store, MessageCircle, Files, FolderKanban, Clock, Zap, CalendarDays,
  Headphones, ShoppingBag, Globe, Send, CreditCard, Package, Factory,
  BarChart3, LayoutDashboard, UserCircle,
} from 'lucide-react'

export type LandingApp = {
  id: string
  label: string
  icon: LucideIcon
  color: string
  competitor?: string
}

/** Green + amber palette centered on brand #64C3A0 */
const G = {
  main: '#64C3A0',
  dark: '#3d9a7a',
  deep: '#2d7a62',
  hover: '#52b38f',
  mint: '#9ddfc9',
  amber: '#ffc954',
  ink: '#1e3d34',
}

export const LANDING_APPS: LandingApp[] = [
  { id: 'accounting', label: 'Accounting', icon: Calculator, color: G.dark, competitor: 'QuickBooks' },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen, color: G.mint },
  { id: 'sign', label: 'Sign', icon: PenLine, color: G.main },
  { id: 'crm', label: 'CRM', icon: Users, color: G.deep, competitor: 'Salesforce' },
  { id: 'studio', label: 'Studio', icon: Wrench, color: G.amber },
  { id: 'subscriptions', label: 'Subscriptions', icon: RefreshCw, color: G.hover },
  { id: 'ai', label: 'AI', icon: Sparkles, color: G.main },
  { id: 'pos', label: 'Point of Sale', icon: Store, color: G.dark },
  { id: 'discuss', label: 'Discuss', icon: MessageCircle, color: G.mint },
  { id: 'documents', label: 'Documents', icon: Files, color: G.hover },
  { id: 'project', label: 'Project', icon: FolderKanban, color: G.deep },
  { id: 'timesheets', label: 'Timesheets', icon: Clock, color: G.ink },
  { id: 'field', label: 'Field Service', icon: Zap, color: G.amber },
  { id: 'planning', label: 'Planning', icon: CalendarDays, color: G.main },
  { id: 'helpdesk', label: 'Helpdesk', icon: Headphones, color: G.dark },
  { id: 'ecommerce', label: 'eCommerce', icon: ShoppingBag, color: G.hover, competitor: 'Shopify' },
  { id: 'website', label: 'Website', icon: Globe, color: G.mint },
  { id: 'email', label: 'Email Marketing', icon: Send, color: G.deep },
  { id: 'purchase', label: 'Purchase', icon: CreditCard, color: G.ink },
  { id: 'inventory', label: 'Inventory', icon: Package, color: G.main },
  { id: 'manufacturing', label: 'Manufacturing', icon: Factory, color: G.dark, competitor: 'SAP' },
  { id: 'sales', label: 'Sales', icon: BarChart3, color: G.hover, competitor: 'SAP' },
  { id: 'hr', label: 'HR', icon: UserCircle, color: G.deep },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: G.amber },
]

export const MOSAIC_AVATARS = [
  { bg: 'linear-gradient(135deg,#64C3A0,#52b38f)', initials: 'AK' },
  { bg: 'linear-gradient(135deg,#3d9a7a,#64C3A0)', initials: 'RS' },
  { bg: 'linear-gradient(135deg,#52b38f,#b8e8d6)', initials: 'ML' },
  { bg: 'linear-gradient(135deg,#64C3A0,#9ddfc9)', initials: 'JP' },
  { bg: 'linear-gradient(135deg,#3d9a7a,#2d7a62)', initials: 'TN' },
  { bg: 'linear-gradient(135deg,#64C3A0,#ffc954)', initials: 'EV' },
  { bg: 'linear-gradient(135deg,#52b38f,#3d9a7a)', initials: 'HC' },
  { bg: 'linear-gradient(135deg,#1e3d34,#64C3A0)', initials: 'DW' },
]
