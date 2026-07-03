import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Bell,
  BookMarked,
  Boxes,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  ChefHat,
  CircleDollarSign,
  Clock,
  ClipboardList,
  Coins,
  Contact2,
  Database,
  Factory,
  FileCheck,
  FilePlus,
  FileText,
  FolderKanban,
  FolderTree,
  Gauge,
  GitBranch,
  Globe,
  HardDrive,
  Hash,
  Landmark,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  LifeBuoy,
  List,
  MapPin,
  Megaphone,
  MessageSquare,
  Newspaper,
  Package,
  PackageSearch,
  Percent,
  Plane,
  Plug,
  Receipt,
  RefreshCw,
  ScrollText,
  Search,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Settings2,
  Sparkles,
  Star,
  Store,
  Tag,
  Target,
  Truck,
  Workflow,
  UserCog,
  UserPlus,
  Users,
  UsersRound,
  UserCheck,
  UtensilsCrossed,
  Warehouse,
  Wrench,
} from 'lucide-react'

export type LandingApp = {
  id: string
  label: string
  icon: LucideIcon
  color: string
}

/** Per-module accent — shared with orbit pills, apps panel, and mosaic palette. */
export type ModuleAccent = {
  iconBg: string
  iconColor: string
  accent: string
  panelTint: string
  glow: string
}

export type LandingModule = {
  id: string
  title: string
  /** Shorter label for the module tile */
  label: string
  icon: LucideIcon
  color: string
  accent: ModuleAccent
  description: string
  apps: LandingApp[]
}

/** Multi-color accents aligned with the community mosaic tiles. */
export const MODULE_ACCENT_PRESETS = {
  mint: {
    iconBg: 'linear-gradient(145deg, #52b38f 0%, #3d9a7a 100%)',
    iconColor: '#ffffff',
    accent: '#3d9a7a',
    panelTint: 'rgba(100, 195, 160, 0.1)',
    glow: 'rgba(100, 195, 160, 0.28)',
  },
  amber: {
    iconBg: 'linear-gradient(145deg, #f0d080 0%, #d4a840 100%)',
    iconColor: '#ffffff',
    accent: '#c89420',
    panelTint: 'rgba(255, 201, 84, 0.12)',
    glow: 'rgba(255, 201, 84, 0.3)',
  },
  periwinkle: {
    iconBg: 'linear-gradient(145deg, #a8b4f0 0%, #6467f2 100%)',
    iconColor: '#ffffff',
    accent: '#6467f2',
    panelTint: 'rgba(100, 103, 242, 0.1)',
    glow: 'rgba(100, 103, 242, 0.24)',
  },
  forest: {
    iconBg: 'linear-gradient(145deg, #4a9a72 0%, #2d6b52 100%)',
    iconColor: '#ffffff',
    accent: '#2d6b52',
    panelTint: 'rgba(34, 160, 80, 0.1)',
    glow: 'rgba(34, 160, 80, 0.24)',
  },
  peach: {
    iconBg: 'linear-gradient(145deg, #f0c090 0%, #e09060 100%)',
    iconColor: '#ffffff',
    accent: '#d87848',
    panelTint: 'rgba(249, 115, 22, 0.1)',
    glow: 'rgba(249, 115, 22, 0.22)',
  },
  sky: {
    iconBg: 'linear-gradient(145deg, #98d0e8 0%, #3ca8d8 100%)',
    iconColor: '#ffffff',
    accent: '#0da2e7',
    panelTint: 'rgba(13, 162, 231, 0.1)',
    glow: 'rgba(13, 162, 231, 0.22)',
  },
  sage: {
    iconBg: 'linear-gradient(145deg, #98c8b8 0%, #5a9880 100%)',
    iconColor: '#ffffff',
    accent: '#5a9880',
    panelTint: 'rgba(86, 110, 143, 0.08)',
    glow: 'rgba(86, 110, 143, 0.2)',
  },
  ink: {
    iconBg: 'linear-gradient(145deg, #4a6878 0%, #2a4858 100%)',
    iconColor: '#ffffff',
    accent: '#2a4858',
    panelTint: 'rgba(42, 72, 88, 0.08)',
    glow: 'rgba(42, 72, 88, 0.18)',
  },
  rose: {
    iconBg: 'linear-gradient(145deg, #e8b0c0 0%, #c86888 100%)',
    iconColor: '#ffffff',
    accent: '#c86888',
    panelTint: 'rgba(226, 54, 83, 0.08)',
    glow: 'rgba(226, 54, 83, 0.2)',
  },
  lavender: {
    iconBg: 'linear-gradient(145deg, #c0b0e8 0%, #9080c8 100%)',
    iconColor: '#ffffff',
    accent: '#8070b8',
    panelTint: 'rgba(100, 103, 242, 0.08)',
    glow: 'rgba(144, 128, 200, 0.22)',
  },
  teal: {
    iconBg: 'linear-gradient(145deg, #78c8b8 0%, #48a898 100%)',
    iconColor: '#ffffff',
    accent: '#48a898',
    panelTint: 'rgba(72, 168, 152, 0.1)',
    glow: 'rgba(72, 168, 152, 0.22)',
  },
  slate: {
    iconBg: 'linear-gradient(145deg, #98b0c0 0%, #688898 100%)',
    iconColor: '#ffffff',
    accent: '#688898',
    panelTint: 'rgba(104, 136, 152, 0.1)',
    glow: 'rgba(104, 136, 152, 0.2)',
  },
} as const satisfies Record<string, ModuleAccent>

/** Live storefront vendor — used by landing hero + community mosaic. */
export type StorefrontVendor = {
  slug: string
  display_name: string
  business_name: string
  logo_url?: string | null
}

export function vendorInitials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, ' ').trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
  }
  return (cleaned.slice(0, 2).toUpperCase() || 'ST')
}

export function vendorDisplayName(v: StorefrontVendor): string {
  return v.display_name || v.business_name || v.slug
}

/** Light tile background when showing a store logo. */
export const MOSAIC_STORE_TILE_BG =
  'linear-gradient(145deg, #ffffff 0%, #eef9f4 100%)'

/** How often mosaic store tiles rotate (ms). */
export const MOSAIC_VENDOR_ROTATE_MS = 10_000

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

/** Vendor sidebar modules — matches vendor-web DashboardLayout sections. */
export const LANDING_MODULES: LandingModule[] = [
  {
    id: 'my-kit',
    title: 'My Kit',
    label: 'My Kit',
    icon: Sparkles,
    color: G.main,
    accent: MODULE_ACCENT_PRESETS.mint,
    description: 'Dashboard, inbox, notifications, workspace shortcuts, and store settings.',
    apps: [
      { id: 'notifications', label: 'Notifications', icon: Bell, color: G.main },
      { id: 'inbox', label: 'Inbox', icon: MessageSquare, color: G.mint },
      { id: 'relationship-manager', label: 'Relationship Manager', icon: UsersRound, color: G.hover },
      { id: 'workspace', label: 'Workspace Apps', icon: LayoutGrid, color: G.dark },
    ],
  },
  {
    id: 'website-management',
    title: 'Website Management',
    label: 'Website',
    icon: Globe,
    color: G.amber,
    accent: MODULE_ACCENT_PRESETS.amber,
    description: 'Business Website Builder, SEO, templates, business front, and blog.',
    apps: [
      { id: 'website', label: 'Business Website Builder', icon: Globe, color: G.amber },
      { id: 'website-templates', label: 'Website Templates', icon: Sparkles, color: G.main },
      { id: 'storefront-display', label: 'Business Front Display', icon: SlidersHorizontal, color: G.mint },
      { id: 'blog', label: 'Blog Manager', icon: Newspaper, color: G.hover },
      { id: 'seo', label: 'SEO Management', icon: Search, color: G.deep },
    ],
  },
  {
    id: 'sales',
    title: 'Sales Management',
    label: 'Sales',
    icon: ShoppingCart,
    color: G.dark,
    accent: MODULE_ACCENT_PRESETS.periwinkle,
    description: 'Orders, quotations, POS, bookings, projects, invoices, and marketplace.',
    apps: [
      { id: 'orders', label: 'Orders', icon: ShoppingCart, color: G.dark },
      { id: 'quotations', label: 'Quotations', icon: ScrollText, color: G.main },
      { id: 'bookings', label: 'Bookings', icon: Calendar, color: G.hover },
      { id: 'projects', label: 'Projects', icon: FolderKanban, color: G.deep },
      { id: 'pos', label: 'POS', icon: Receipt, color: G.main },
      { id: 'subscriptions', label: 'Subscriptions', icon: RefreshCw, color: G.mint },
      { id: 'pricing-plans', label: 'Pricing Plans', icon: Hash, color: G.amber },
      { id: 'marketplace', label: 'Marketplace', icon: Target, color: G.hover },
      { id: 'store-coverage', label: 'Store Coverage', icon: MapPin, color: G.dark },
      { id: 'sales-area', label: 'Sales Area', icon: LayoutGrid, color: G.mint },
      { id: 'rentals', label: 'Rentals', icon: Truck, color: G.deep },
      { id: 'invoices', label: 'Invoices', icon: FileText, color: G.ink },
      { id: 'memos', label: 'Credit Memos', icon: FilePlus, color: G.main },
      { id: 'coupons', label: 'Coupons', icon: Tag, color: G.hover },
      { id: 'sales-reports', label: 'Sales Reports', icon: BarChart3, color: G.amber },
    ],
  },
  {
    id: 'production',
    title: 'Production Management',
    label: 'Production',
    icon: Factory,
    color: G.deep,
    accent: MODULE_ACCENT_PRESETS.forest,
    description: 'Manufacturing orders, schedule, work centers, and MRP.',
    apps: [
      { id: 'production', label: 'Production', icon: Factory, color: G.deep },
      { id: 'schedule', label: 'Schedule', icon: Calendar, color: G.mint },
      { id: 'work-centers', label: 'Work Centers', icon: GitBranch, color: G.main },
      { id: 'mrp', label: 'MRP', icon: Layers, color: G.hover },
    ],
  },
  {
    id: 'restaurant',
    title: 'Restaurant',
    label: 'Restaurant',
    icon: UtensilsCrossed,
    color: G.amber,
    accent: MODULE_ACCENT_PRESETS.peach,
    description: 'Floor service, kitchen board, dine-in menu, reservations, and reports.',
    apps: [
      { id: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed, color: G.amber },
      { id: 'kitchen-board', label: 'Kitchen Board', icon: ChefHat, color: G.dark },
      { id: 'dine-in-menu', label: 'Dine-in Menu', icon: List, color: G.main },
      { id: 'reservations', label: 'Reservations', icon: Calendar, color: G.mint },
      { id: 'restaurant-pos', label: 'Restaurant POS', icon: Store, color: G.hover },
    ],
  },
  {
    id: 'commission',
    title: 'Commission Management',
    label: 'Commission',
    icon: Percent,
    color: G.main,
    accent: MODULE_ACCENT_PRESETS.teal,
    description: 'Payees, plans, accruals, payouts, and commission reporting.',
    apps: [
      { id: 'commission', label: 'Commission', icon: Percent, color: G.main },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory Management',
    label: 'Inventory',
    icon: Warehouse,
    color: G.deep,
    accent: MODULE_ACCENT_PRESETS.sky,
    description: 'Products, services, stock, plants, storage locations, and purchasing.',
    apps: [
      { id: 'products', label: 'Products', icon: Package, color: G.main },
      { id: 'services', label: 'Services', icon: Wrench, color: G.mint },
      { id: 'categories', label: 'Categories', icon: FolderTree, color: G.hover },
      { id: 'catalog', label: 'Catalog', icon: ShoppingBag, color: G.dark },
      { id: 'inventory', label: 'Inventory', icon: Warehouse, color: G.deep },
      { id: 'plants', label: 'Plants', icon: Building2, color: G.amber },
      { id: 'storage-locations', label: 'Storage Locations', icon: Boxes, color: G.mint },
      { id: 'purchase', label: 'Purchase Orders', icon: ClipboardList, color: G.main },
    ],
  },
  {
    id: 'procurement',
    title: 'Procurement Management',
    label: 'Procurement',
    icon: Truck,
    color: G.hover,
    accent: MODULE_ACCENT_PRESETS.sage,
    description: 'Purchase orders, requisitions, vendor invoices, and goods management.',
    apps: [
      { id: 'requisitions', label: 'Purchase Requisitions', icon: FileText, color: G.hover },
      { id: 'sourcing', label: 'Sourcing Setup', icon: Database, color: G.deep },
      { id: 'vendor-invoices', label: 'Vendor Invoices', icon: Banknote, color: G.amber },
      { id: 'goods', label: 'Goods Management', icon: PackageSearch, color: G.mint },
      { id: 'special-procurement', label: 'Special Procurement', icon: FileCheck, color: G.dark },
    ],
  },
  {
    id: 'finance',
    title: 'Finance Management',
    label: 'Finance',
    icon: Landmark,
    color: G.ink,
    accent: MODULE_ACCENT_PRESETS.ink,
    description: 'Accounting, AR/AP, bank, assets, budgets, tax, and financial reports.',
    apps: [
      { id: 'finance', label: 'Finance', icon: Landmark, color: G.ink },
      { id: 'business-units', label: 'Business Units', icon: Building2, color: G.main },
      { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: BookMarked, color: G.mint },
      { id: 'ar', label: 'Accounts Receivable', icon: ArrowLeftRight, color: G.hover },
      { id: 'ap', label: 'Accounts Payable', icon: Banknote, color: G.amber },
      { id: 'bank-cash', label: 'Bank & Cash', icon: Coins, color: G.deep },
      { id: 'fixed-assets', label: 'Fixed Assets', icon: HardDrive, color: G.dark },
      { id: 'budgets', label: 'Budgets & Forecasts', icon: Calculator, color: G.main },
      { id: 'tax-returns', label: 'Tax Returns', icon: CircleDollarSign, color: G.mint },
      { id: 'reports', label: 'Reports', icon: BarChart3, color: G.amber },
    ],
  },
  {
    id: 'controlling',
    title: 'Controlling Management',
    label: 'Controlling',
    icon: Gauge,
    color: G.dark,
    accent: MODULE_ACCENT_PRESETS.rose,
    description: 'Product costing, production orders, variance analysis, and period end.',
    apps: [
      { id: 'controlling', label: 'CO Dashboard', icon: Gauge, color: G.dark },
      { id: 'controlling-areas', label: 'Controlling Areas', icon: Building2, color: G.main },
      { id: 'finance-integration', label: 'Finance Integration', icon: Landmark, color: G.ink },
      { id: 'cost-centers', label: 'Cost Centers', icon: Layers, color: G.mint },
      { id: 'product-costs', label: 'Product Cost Planning', icon: Boxes, color: G.hover },
      { id: 'activity-types', label: 'Activity Types', icon: Activity, color: G.deep },
      { id: 'overhead-setup', label: 'Overhead Setup', icon: Percent, color: G.amber },
      { id: 'manufacturing-orders', label: 'Manufacturing Orders', icon: Factory, color: G.main },
      { id: 'internal-orders', label: 'Internal & Project Orders', icon: Workflow, color: G.mint },
      { id: 'goods-movements', label: 'Goods Movements', icon: Package, color: G.hover },
      { id: 'activity-confirmations', label: 'Activity Confirmations', icon: Clock, color: G.deep },
      { id: 'wip', label: 'WIP Report', icon: ClipboardList, color: G.dark },
      { id: 'variance-analysis', label: 'Variance Analysis', icon: BarChart3, color: G.amber },
      { id: 'cost-allocations', label: 'Cost Allocations', icon: GitBranch, color: G.main },
      { id: 'period-end', label: 'Period-End Closing', icon: Calendar, color: G.ink },
    ],
  },
  {
    id: 'master-data',
    title: 'Master Data Management',
    label: 'Master Data',
    icon: Database,
    color: G.hover,
    accent: MODULE_ACCENT_PRESETS.lavender,
    description: 'Customers, suppliers, and review management.',
    apps: [
      { id: 'master-data', label: 'Master Data', icon: Database, color: G.hover },
      { id: 'customers', label: 'Customers', icon: Users, color: G.main },
      { id: 'reviews', label: 'Reviews', icon: Star, color: G.amber },
    ],
  },
  {
    id: 'crm',
    title: 'CRM Management',
    label: 'CRM',
    icon: UsersRound,
    color: G.deep,
    accent: MODULE_ACCENT_PRESETS.periwinkle,
    description: 'Contacts, pipeline, tickets, campaigns, workflows, and CRM reports.',
    apps: [
      { id: 'crm', label: 'CRM', icon: UsersRound, color: G.deep },
      { id: 'contacts', label: 'Contacts', icon: Contact2, color: G.mint },
      { id: 'leads', label: 'Leads', icon: UserPlus, color: G.hover },
      { id: 'pipeline', label: 'Pipeline', icon: GitBranch, color: G.main },
      { id: 'tickets', label: 'Tickets', icon: LifeBuoy, color: G.dark },
      { id: 'campaigns', label: 'Campaigns', icon: Megaphone, color: G.amber },
    ],
  },
  {
    id: 'hr',
    title: 'HR Management',
    label: 'HR',
    icon: Briefcase,
    color: G.dark,
    accent: MODULE_ACCENT_PRESETS.mint,
    description: 'Employees, attendance, payroll, recruitment, training, and compliance.',
    apps: [
      { id: 'hr', label: 'HR', icon: Briefcase, color: G.dark },
      { id: 'employees', label: 'Employees', icon: UserCog, color: G.main },
      { id: 'attendance', label: 'Attendance', icon: Activity, color: G.mint },
      { id: 'leaves', label: 'Leave Requests', icon: Plane, color: G.hover },
      { id: 'recruitment', label: 'Recruitment', icon: UserCheck, color: G.deep },
      { id: 'payroll', label: 'Payroll', icon: Coins, color: G.amber },
    ],
  },
  {
    id: 'system',
    title: 'System Configuration',
    label: 'System',
    icon: Settings2,
    color: G.main,
    accent: MODULE_ACCENT_PRESETS.slate,
    description: 'Integrations, document templates, module settings, and access control.',
    apps: [
      { id: 'document-templates', label: 'Document Templates', icon: LayoutTemplate, color: G.main },
      { id: 'integrations', label: 'Integrations', icon: Plug, color: G.mint },
      { id: 'module-settings', label: 'Module Settings', icon: Layers, color: G.hover },
    ],
  },
]

/** Flat list of all apps (e.g. search). */
export const LANDING_APPS: LandingApp[] = LANDING_MODULES.flatMap((m) => m.apps)

/**
 * Soft mosaic fills — vibrant multi-color pastels (mint, sky, lavender, peach, sage…).
 */
export const MOSAIC_PALETTE = [
  'linear-gradient(145deg, #B8E8DC 0%, #98D8C8 100%)',
  'linear-gradient(145deg, #C8CAF4 0%, #A8B0EC 100%)',
  'linear-gradient(145deg, #B8DCF0 0%, #98C8E8 100%)',
  'linear-gradient(145deg, #F5E4C0 0%, #F0D898 100%)',
  'linear-gradient(145deg, #F0D0D8 0%, #E8B0C0 100%)',
  'linear-gradient(145deg, #D4E8E0 0%, #B8DCC8 100%)',
  'linear-gradient(145deg, #C0E8D4 0%, #98D8B8 100%)',
  'linear-gradient(145deg, #DCD8F4 0%, #C0B0E8 100%)',
  'linear-gradient(145deg, #E7F3EF 0%, #C8E8DC 100%)',
  'linear-gradient(145deg, #C8E0EC 0%, #A8C4E8 100%)',
  'linear-gradient(145deg, #F0E8DC 0%, #F0C898 100%)',
  'linear-gradient(145deg, #D8ECE4 0%, #B8D8C8 100%)',
] as const

/** Subtle brand mint (#64C3A0) — exactly 5 fixed mosaic tiles. */
export const MOSAIC_BRAND_SHAPE =
  'linear-gradient(145deg, rgba(100, 195, 160, 0.48) 0%, #A8E0CC 100%)'
export const MOSAIC_BRAND_AVATAR = {
  bg: 'linear-gradient(135deg, #90D4B8 0%, #64C3A0 100%)',
  ink: '#2d6854',
  glow: 'rgba(100, 195, 160, 0.3)',
}
export const MOSAIC_BRAND_GLOW = 'rgba(100, 195, 160, 0.28)'

/** Five spread-out positions per grid (away from center headline). */
export const MOSAIC_BRAND_DESKTOP = [0, 10, 22, 43, 54] as const
export const MOSAIC_BRAND_MOBILE = [0, 5, 14, 22, 29] as const

/** Per-tile highlight glow — palette families (brand tiles use MOSAIC_BRAND_GLOW). */
export const MOSAIC_GLOW = [
  'rgba(100, 195, 160, 0.22)',
  'rgba(100, 103, 242, 0.16)',
  'rgba(100, 195, 160, 0.18)',
  'rgba(255, 201, 84, 0.2)',
  'rgba(226, 54, 83, 0.14)',
  'rgba(100, 195, 160, 0.16)',
  'rgba(34, 160, 80, 0.16)',
  'rgba(100, 103, 242, 0.14)',
  'rgba(100, 195, 160, 0.2)',
  'rgba(13, 162, 231, 0.14)',
  'rgba(255, 201, 84, 0.16)',
  'rgba(82, 179, 143, 0.18)',
] as const

/**
 * Avatar tiles — muted mid-tone gradients (readable without harsh contrast).
 * ink = initials color; kept darker but not pure white on neon fills.
 */
export const MOSAIC_AVATARS = [
  { bg: 'linear-gradient(135deg, #98D0E8 0%, #78B8DC 100%)', initials: 'AK', glow: 'rgba(13, 162, 231, 0.22)', ink: '#356070' },
  { bg: 'linear-gradient(135deg, #B8C0F4 0%, #98A8E8 100%)', initials: 'RS', glow: 'rgba(100, 103, 242, 0.22)', ink: '#424880' },
  { bg: 'linear-gradient(135deg, #98D0E8 0%, #78B8DC 100%)', initials: 'ML', glow: 'rgba(13, 162, 231, 0.22)', ink: '#356070' },
  { bg: 'linear-gradient(135deg, #F0D898 0%, #E0C078 100%)', initials: 'JP', glow: 'rgba(255, 201, 84, 0.24)', ink: '#7A6038' },
  { bg: 'linear-gradient(135deg, #A8C4E8 0%, #88B0DC 100%)', initials: 'TN', glow: 'rgba(60, 131, 246, 0.22)', ink: '#405870' },
  { bg: 'linear-gradient(135deg, #E8B0C0 0%, #C8A0D8 100%)', initials: 'EV', glow: 'rgba(226, 54, 83, 0.18)', ink: '#704858' },
  { bg: 'linear-gradient(135deg, #98D8B8 0%, #88C8A8 100%)', initials: 'HC', glow: 'rgba(34, 160, 80, 0.22)', ink: '#356850' },
  { bg: 'linear-gradient(135deg, #A8C4E8 0%, #90B0DC 100%)', initials: 'DW', glow: 'rgba(60, 131, 246, 0.22)', ink: '#405870' },
  { bg: 'linear-gradient(135deg, #C0B0E8 0%, #D8A8C0 100%)', initials: 'SK', glow: 'rgba(100, 103, 242, 0.2)', ink: '#585070' },
  { bg: 'linear-gradient(135deg, #F0C898 0%, #F0D0A0 100%)', initials: 'PR', glow: 'rgba(249, 115, 22, 0.2)', ink: '#7A5838' },
  { bg: 'linear-gradient(135deg, #98C8B8 0%, #98B0C0 100%)', initials: 'MV', glow: 'rgba(86, 110, 143, 0.2)', ink: '#405058' },
  { bg: 'linear-gradient(135deg, #E8D088 0%, #E0C070 100%)', initials: 'AB', glow: 'rgba(234, 179, 8, 0.2)', ink: '#706030' },
  { bg: 'linear-gradient(135deg, #98C8B8 0%, #88B8A8 100%)', initials: 'NK', glow: 'rgba(34, 160, 80, 0.2)', ink: '#405850' },
  { bg: 'linear-gradient(135deg, #B0B8EC 0%, #90C0E0 100%)', initials: 'GT', glow: 'rgba(100, 103, 242, 0.22)', ink: '#405070' },
  { bg: 'linear-gradient(135deg, #E8A0A8 0%, #E090A0 100%)', initials: 'RP', glow: 'rgba(226, 54, 54, 0.18)', ink: '#784048' },
  { bg: 'linear-gradient(135deg, #98B8E8 0%, #A8A8EC 100%)', initials: 'DV', glow: 'rgba(59, 130, 246, 0.2)', ink: '#405078' },
] as const
