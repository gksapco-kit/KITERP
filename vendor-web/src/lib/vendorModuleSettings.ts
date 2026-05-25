import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  Calendar,
  Gauge,
  Landmark,
  Percent,
  Receipt,
  RefreshCw,
  ShoppingBag,
  UtensilsCrossed,
  UsersRound,
} from 'lucide-react'
import { readHrModuleSettings } from '@/lib/hrModuleSettings'

export type VendorModuleId =
  | 'catalog'
  | 'hr'
  | 'finance'
  | 'crm'
  | 'commission'
  | 'controlling'
  | 'pos'
  | 'restaurant'
  | 'bookings'
  | 'subscriptions'

export type VendorModuleTile = {
  id: VendorModuleId
  label: string
  description: string
  icon: LucideIcon
  /** Settings can be saved from the panel */
  configurable: boolean
}

export const VENDOR_MODULE_TILES: VendorModuleTile[] = [
  {
    id: 'catalog',
    label: 'Catalog',
    description: 'Products and services in inventory, business front, and sidebar.',
    icon: ShoppingBag,
    configurable: true,
  },
  {
    id: 'hr',
    label: 'HR',
    description: 'Employees, payroll, attendance, recruitment, and ESS.',
    icon: Briefcase,
    configurable: true,
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'Ledger, AR/AP, reports, and business units (advanced mode).',
    icon: Landmark,
    configurable: true,
  },
  {
    id: 'crm',
    label: 'CRM',
    description: 'Contacts, pipeline, tickets, campaigns, and inbox.',
    icon: UsersRound,
    configurable: true,
  },
  {
    id: 'commission',
    label: 'Commission',
    description: 'Payee plans, accruals, and payout runs.',
    icon: Percent,
    configurable: true,
  },
  {
    id: 'controlling',
    label: 'Controlling',
    description: 'CO production orders, costing, and variance analysis.',
    icon: Gauge,
    configurable: true,
  },
  {
    id: 'pos',
    label: 'POS',
    description: 'Point-of-sale checkout and register flows.',
    icon: Receipt,
    configurable: true,
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    description: 'Floor plans, kitchen board, and table service.',
    icon: UtensilsCrossed,
    configurable: true,
  },
  {
    id: 'bookings',
    label: 'Bookings',
    description: 'Service appointments and calendar bookings.',
    icon: Calendar,
    configurable: true,
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    description: 'Recurring billing and subscription schedules.',
    icon: RefreshCw,
    configurable: true,
  },
]

export function offeringIncludes(
  offeringType: string | undefined,
  modes: Array<'products' | 'services' | 'both'>,
): boolean {
  const t = offeringType || 'both'
  return modes.includes(t as 'products' | 'services' | 'both')
}

function flagEnabled(settings: Record<string, unknown> | undefined | null, key: string): boolean {
  return (settings as Record<string, unknown> | undefined)?.[key] !== false
}

export function isFinanceNavVisible(settings: Record<string, unknown> | undefined | null): boolean {
  return flagEnabled(settings, 'finance_enabled')
}

export function isCrmNavVisible(settings: Record<string, unknown> | undefined | null): boolean {
  return flagEnabled(settings, 'crm_enabled')
}

export function isCommissionNavVisible(settings: Record<string, unknown> | undefined | null): boolean {
  return flagEnabled(settings, 'commission_enabled')
}

export function isControllingNavVisible(settings: Record<string, unknown> | undefined | null): boolean {
  return flagEnabled(settings, 'controlling_enabled')
}

export function isPosNavVisible(
  settings: Record<string, unknown> | undefined | null,
  offeringType?: string,
): boolean {
  return offeringIncludes(offeringType, ['products', 'both']) && flagEnabled(settings, 'pos_enabled')
}

export function isRestaurantNavVisible(
  settings: Record<string, unknown> | undefined | null,
  offeringType?: string,
): boolean {
  return offeringIncludes(offeringType, ['products', 'both']) && flagEnabled(settings, 'restaurant_enabled')
}

export function isBookingsNavVisible(
  settings: Record<string, unknown> | undefined | null,
  offeringType?: string,
): boolean {
  return offeringIncludes(offeringType, ['services', 'both']) && flagEnabled(settings, 'bookings_enabled')
}

export function isSubscriptionsNavVisible(settings: Record<string, unknown> | undefined | null): boolean {
  return flagEnabled(settings, 'subscriptions_enabled')
}

/** Short status line for module tiles */
export function moduleEnabledStatus(
  moduleId: VendorModuleId,
  vendor: {
    offering_type?: string
    settings?: Record<string, unknown> | null
  } | null | undefined,
): { enabled: boolean; detail?: string } {
  if (!vendor) return { enabled: false }
  const settings = vendor.settings as Record<string, unknown> | undefined

  switch (moduleId) {
    case 'catalog': {
      const t = vendor.offering_type || 'both'
      const labels: Record<string, string> = {
        products: 'Products',
        services: 'Services',
        both: 'Products & services',
      }
      return { enabled: true, detail: labels[t] ?? 'Both' }
    }
    case 'hr': {
      const hr = readHrModuleSettings(settings)
      if (!hr.hr_enabled) return { enabled: false }
      return {
        enabled: true,
        detail: hr.hr_scope === 'central' ? 'All units' : `${hr.hr_business_unit_ids.length || 0} units`,
      }
    }
    case 'finance': {
      if (!isFinanceNavVisible(settings)) return { enabled: false }
      const mode = (settings?.finance_mode as string) || 'advanced'
      return { enabled: true, detail: mode === 'basic' ? 'Basic' : 'Advanced' }
    }
    case 'crm':
      return { enabled: isCrmNavVisible(settings) }
    case 'commission':
      return { enabled: isCommissionNavVisible(settings) }
    case 'controlling':
      return { enabled: isControllingNavVisible(settings) }
    case 'pos': {
      if (!offeringIncludes(vendor.offering_type, ['products', 'both'])) {
        return { enabled: false, detail: 'Needs products catalog' }
      }
      if (!flagEnabled(settings, 'pos_enabled')) return { enabled: false }
      return { enabled: true, detail: 'Point of sale' }
    }
    case 'restaurant': {
      if (!offeringIncludes(vendor.offering_type, ['products', 'both'])) {
        return { enabled: false, detail: 'Needs products catalog' }
      }
      if (!flagEnabled(settings, 'restaurant_enabled')) return { enabled: false }
      return { enabled: true, detail: 'Floor & kitchen' }
    }
    case 'bookings': {
      if (!offeringIncludes(vendor.offering_type, ['services', 'both'])) {
        return { enabled: false, detail: 'Needs services catalog' }
      }
      if (!flagEnabled(settings, 'bookings_enabled')) return { enabled: false }
      return { enabled: true, detail: 'Appointments' }
    }
    case 'subscriptions': {
      if (!flagEnabled(settings, 'subscriptions_enabled')) return { enabled: false }
      return { enabled: true, detail: 'Recurring sales' }
    }
    default:
      return { enabled: false }
  }
}
