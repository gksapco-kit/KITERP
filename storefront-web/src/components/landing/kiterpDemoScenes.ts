import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Globe,
  Landmark,
  Package,
  Receipt,
  ShoppingCart,
  Users,
} from 'lucide-react'

export type DemoScene = {
  id: string
  navLabel: string
  navIcon: LucideIcon
  title: string
  subtitle: string
  chips: string[]
  statLabel: string
  statValue: string
  popupTitle: string
  popupPoints: string[]
}

export const KITERP_DEMO_SCENES: DemoScene[] = [
  {
    id: 'dashboard',
    navLabel: 'Dashboard',
    navIcon: BarChart3,
    title: 'Your business at a glance',
    subtitle: 'Orders, revenue, and store activity in one view.',
    chips: ['Today', 'This week', 'Live'],
    statLabel: 'Orders today',
    statValue: '128',
    popupTitle: 'Real-time dashboard',
    popupPoints: [
      'Live KPIs for revenue, orders & visitors',
      'Trend charts update as sales happen',
      'Drill into any metric with one click',
    ],
  },
  {
    id: 'crm',
    navLabel: 'CRM',
    navIcon: Users,
    title: 'Turn leads into customers',
    subtitle: 'Track every lead, follow-up, and deal in one pipeline.',
    chips: ['Leads', 'Pipeline', 'Activities'],
    statLabel: 'Win rate',
    statValue: '32%',
    popupTitle: 'Sales CRM & pipeline',
    popupPoints: [
      'Drag deals across pipeline stages',
      'Schedule calls, emails & reminders',
      'See full customer history & notes',
      'Forecast revenue from open deals',
    ],
  },
  {
    id: 'products',
    navLabel: 'Products',
    navIcon: Package,
    title: 'Manage your catalog',
    subtitle: 'Add products, variants, stock, and pricing in seconds.',
    chips: ['In stock', 'Low stock', 'Draft'],
    statLabel: 'Active SKUs',
    statValue: '342',
    popupTitle: 'Catalog & inventory',
    popupPoints: [
      'Variants, pricing & images in one place',
      'Live stock levels across locations',
      'Low-stock alerts and bulk edits',
    ],
  },
  {
    id: 'orders',
    navLabel: 'Orders',
    navIcon: ShoppingCart,
    title: 'Fulfill orders faster',
    subtitle: 'Track status, invoices, and customer updates together.',
    chips: ['New', 'Packed', 'Delivered'],
    statLabel: 'Open orders',
    statValue: '47',
    popupTitle: 'Order management',
    popupPoints: [
      'One timeline from order to delivery',
      'Auto-generate invoices & receipts',
      'Notify customers at every step',
    ],
  },
  {
    id: 'website',
    navLabel: 'Business Website Builder',
    navIcon: Globe,
    title: 'Launch your storefront',
    subtitle: 'Drag blocks, connect live data, and publish instantly.',
    chips: ['Home', 'Shop', 'Contact'],
    statLabel: 'Live pages',
    statValue: '12',
    popupTitle: 'Drag-and-drop builder',
    popupPoints: [
      'Ready-made blocks & templates',
      'Connect live products & stock',
      'Publish instantly, no code needed',
    ],
  },
  {
    id: 'pos',
    navLabel: 'POS',
    navIcon: Receipt,
    title: 'Sell in-store & online',
    subtitle: 'Unified checkout for counter sales and web orders.',
    chips: ['Register', 'Receipts', 'Payments'],
    statLabel: 'POS sales',
    statValue: '₹84K',
    popupTitle: 'Point of sale',
    popupPoints: [
      'Fast touch checkout for the counter',
      'Shared stock with your online store',
      'Cash, card & UPI in one register',
    ],
  },
  {
    id: 'finance',
    navLabel: 'Finance',
    navIcon: Landmark,
    title: 'Books that stay in sync',
    subtitle: 'Ledger, AR/AP, and reports tied to every sale.',
    chips: ['P&L', 'Balance sheet', 'Tax'],
    statLabel: 'Net margin',
    statValue: '18.4%',
    popupTitle: 'Accounting & finance',
    popupPoints: [
      'Every sale posts to the ledger',
      'P&L, balance sheet & tax reports',
      'Track receivables and payables',
    ],
  },
]

export const DEMO_SCENE_MS = 4200
export const DEMO_TOTAL_MS = KITERP_DEMO_SCENES.length * DEMO_SCENE_MS
