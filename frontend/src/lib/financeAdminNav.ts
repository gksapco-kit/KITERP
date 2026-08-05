import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  BookMarked,
  BookOpen,
  Calculator,
  CircleDollarSign,
  ClipboardCheck,
  Coins,
  FileBarChart,
  FilePieChart,
  HardDrive,
  Landmark,
  LineChart,
  ListChecks,
  Lock,
  Scale,
  ScrollText,
  ShieldCheck,
  Shuffle,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

/** Mirrors vendor-web Finance Management sidebar (advanced mode). */
export type FinanceAdminNavItem = {
  /** Admin route segment under `/dashboard/finance/...` */
  slug: string
  label: string
  icon: LucideIcon
  /** Vendor-web path opened via handoff. */
  vendorPath: string
}

export const FINANCE_ADMIN_NAV_ITEMS: FinanceAdminNavItem[] = [
  { slug: 'dashboard', label: 'Finance Dashboard', icon: Landmark, vendorPath: '/finance' },
  { slug: 'coa', label: 'Chart of Accounts', icon: BookMarked, vendorPath: '/finance/coa' },
  { slug: 'journal', label: 'Journal Entries', icon: ScrollText, vendorPath: '/finance/journal' },
  { slug: 'trial-balance', label: 'Trial Balance', icon: Scale, vendorPath: '/finance/trial-balance' },
  { slug: 'statement-versions', label: 'Statement Versions (FSV)', icon: BarChart3, vendorPath: '/finance/statement-versions' },
  { slug: 'posting-controls', label: 'Posting Controls', icon: ShieldCheck, vendorPath: '/finance/posting-controls' },
  { slug: 'profit-centers', label: 'Profit Centers & Segments', icon: TrendingUp, vendorPath: '/finance/profit-centers' },
  { slug: 'fx-revaluation', label: 'FX Reval & Year-End Close', icon: ArrowLeftRight, vendorPath: '/finance/fx-revaluation' },
  { slug: 'posting-rules', label: 'Posting Rules & Number Ranges', icon: ListChecks, vendorPath: '/finance/posting-rules' },
  { slug: 'parallel-ledgers', label: 'Parallel Ledgers / Multi-GAAP', icon: BookMarked, vendorPath: '/finance/parallel-ledgers' },
  { slug: 'periods', label: 'Posting Periods', icon: Lock, vendorPath: '/finance/periods' },
  { slug: 'field-rules', label: 'GL Field Rules', icon: ListChecks, vendorPath: '/finance/field-rules' },
  { slug: 'ar', label: 'Accounts Receivable', icon: ArrowLeftRight, vendorPath: '/finance/ar' },
  { slug: 'open-items', label: 'Open-Item Clearing', icon: ListChecks, vendorPath: '/finance/open-items' },
  { slug: 'ap', label: 'Accounts Payable', icon: Banknote, vendorPath: '/finance/ap' },
  { slug: 'bank', label: 'Bank & Cash', icon: Coins, vendorPath: '/finance/bank' },
  { slug: 'assets', label: 'Fixed Assets', icon: HardDrive, vendorPath: '/finance/assets' },
  { slug: 'assets-reports', label: 'Asset Register', icon: FileBarChart, vendorPath: '/finance/assets/reports' },
  { slug: 'assets-depreciation', label: 'Depreciation Schedule', icon: TrendingDown, vendorPath: '/finance/assets/depreciation-schedule' },
  { slug: 'assets-gl-reconciliation', label: 'GL Reconciliation', icon: Scale, vendorPath: '/finance/assets/gl-reconciliation' },
  { slug: 'budgets', label: 'Budgets & Forecasts', icon: Calculator, vendorPath: '/finance/budgets' },
  { slug: 'capital', label: 'Loans & Investments', icon: Shuffle, vendorPath: '/finance/capital' },
  { slug: 'reports-pnl', label: 'P&L Statement', icon: LineChart, vendorPath: '/finance/reports/pnl' },
  { slug: 'reports-balance-sheet', label: 'Balance Sheet', icon: FilePieChart, vendorPath: '/finance/reports/balance-sheet' },
  { slug: 'reports-cash-flow', label: 'Cash Flow', icon: TrendingUp, vendorPath: '/finance/reports/cash-flow' },
  { slug: 'reports-cost-analysis', label: 'Cost Analysis', icon: BarChart3, vendorPath: '/finance/reports/cost-analysis' },
  { slug: 'reports-gl', label: 'GL Line Item Report', icon: BookOpen, vendorPath: '/finance/reports/gl' },
  { slug: 'approvals', label: 'Approvals', icon: ClipboardCheck, vendorPath: '/finance/approvals' },
  { slug: 'audit', label: 'Audit Log', icon: ShieldCheck, vendorPath: '/finance/audit' },
  { slug: 'tax', label: 'Tax Returns', icon: CircleDollarSign, vendorPath: '/finance/tax' },
]

export const FINANCE_ADMIN_BASE = '/dashboard/finance'

export function getFinanceAdminNavItem(slug: string | undefined | null): FinanceAdminNavItem | undefined {
  if (!slug) return undefined
  return FINANCE_ADMIN_NAV_ITEMS.find((item) => item.slug === slug)
}

export function financeAdminPath(slug: string): string {
  return `${FINANCE_ADMIN_BASE}/${slug}`
}
