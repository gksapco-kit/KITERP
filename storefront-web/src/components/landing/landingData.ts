import type { LucideIcon } from 'lucide-react'
import {
  ShoppingBag,
  Wrench,
  Package,
  Warehouse,
  ShoppingCart,
  Globe,
  Receipt,
  UsersRound,
  Landmark,
  Briefcase,
  Calendar,
  UtensilsCrossed,
  RefreshCw,
  FolderKanban,
  Percent,
  Gauge,
  Users,
  FileText,
  ClipboardList,
  Factory,
  BarChart3,
  Tag,
  Target,
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

/** Real KITERP vendor modules & features (from vendor-web modules + dashboard nav). */
export const LANDING_APPS: LandingApp[] = [
  { id: 'products', label: 'Products', icon: Package, color: G.main },
  { id: 'services', label: 'Services', icon: Wrench, color: G.mint },
  { id: 'catalog', label: 'Catalog', icon: ShoppingBag, color: G.hover, competitor: 'Shopify' },
  { id: 'orders', label: 'Orders', icon: ShoppingCart, color: G.dark },
  { id: 'inventory', label: 'Inventory', icon: Warehouse, color: G.deep },
  { id: 'website', label: 'Website Builder', icon: Globe, color: G.amber },
  { id: 'pos', label: 'POS', icon: Receipt, color: G.main },
  { id: 'crm', label: 'CRM', icon: UsersRound, color: G.deep, competitor: 'Salesforce' },
  { id: 'finance', label: 'Finance', icon: Landmark, color: G.ink, competitor: 'QuickBooks' },
  { id: 'hr', label: 'HR', icon: Briefcase, color: G.dark },
  { id: 'bookings', label: 'Bookings', icon: Calendar, color: G.hover },
  { id: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed, color: G.amber },
  { id: 'subscriptions', label: 'Subscriptions', icon: RefreshCw, color: G.mint },
  { id: 'projects', label: 'Projects', icon: FolderKanban, color: G.deep },
  { id: 'commission', label: 'Commission', icon: Percent, color: G.main },
  { id: 'controlling', label: 'Controlling', icon: Gauge, color: G.dark, competitor: 'SAP' },
  { id: 'customers', label: 'Customers', icon: Users, color: G.hover },
  { id: 'invoices', label: 'Invoices', icon: FileText, color: G.ink },
  { id: 'purchase', label: 'Purchase Orders', icon: ClipboardList, color: G.mint },
  { id: 'production', label: 'Production', icon: Factory, color: G.deep, competitor: 'SAP' },
  { id: 'reports', label: 'Reports', icon: BarChart3, color: G.amber },
  { id: 'coupons', label: 'Coupons', icon: Tag, color: G.main },
  { id: 'marketplace', label: 'Marketplace', icon: Target, color: G.hover },
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
  { bg: 'linear-gradient(135deg,#64C3A0,#3d9a7a)', initials: 'SK' },
  { bg: 'linear-gradient(135deg,#9ddfc9,#52b38f)', initials: 'PR' },
  { bg: 'linear-gradient(135deg,#2d7a62,#64C3A0)', initials: 'MV' },
  { bg: 'linear-gradient(135deg,#64C3A0,#b8e8d6)', initials: 'AB' },
  { bg: 'linear-gradient(135deg,#3d9a7a,#9ddfc9)', initials: 'NK' },
  { bg: 'linear-gradient(135deg,#52b38f,#1e3d34)', initials: 'GT' },
  { bg: 'linear-gradient(135deg,#64C3A0,#52b38f)', initials: 'RP' },
  { bg: 'linear-gradient(135deg,#3d9a7a,#64C3A0)', initials: 'DV' },
]
