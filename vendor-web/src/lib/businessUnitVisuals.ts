import type { LucideIcon } from 'lucide-react'
import {
  Store,
  ShoppingBag,
  UtensilsCrossed,
  Building2,
  Warehouse,
  Heart,
  Dumbbell,
  GraduationCap,
  Landmark,
  Car,
} from 'lucide-react'
import type { StoreRecord } from '@/api/vendor'
import { mediaUrl } from '@/lib/utils'

const TYPE_GRADIENTS: Record<string, string> = {
  Retail: 'from-violet-500/90 via-fuchsia-500/80 to-pink-500/70',
  'Food & Hospitality': 'from-amber-500/90 via-orange-500/80 to-rose-500/70',
  'Business & Office': 'from-slate-600/90 via-slate-500/80 to-zinc-500/70',
  'Industrial & Logistics': 'from-blue-600/90 via-cyan-600/80 to-teal-500/70',
  Healthcare: 'from-rose-500/90 via-red-500/80 to-pink-500/70',
  'Wellness & Lifestyle': 'from-emerald-500/90 via-teal-500/80 to-cyan-500/70',
  Education: 'from-indigo-600/90 via-blue-500/80 to-sky-500/70',
  'Finance & Legal': 'from-amber-600/90 via-yellow-600/80 to-orange-500/70',
  'Automotive & Property': 'from-stone-600/90 via-neutral-600/80 to-zinc-600/70',
  default: 'from-primary/80 via-[hsl(var(--hero-via))] to-[hsl(var(--hero-to))]',
}

const GROUP_BY_TYPE: Record<string, string> = {
  Shop: 'Retail',
  Store: 'Retail',
  Supermarket: 'Retail',
  Restaurant: 'Food & Hospitality',
  'Café': 'Food & Hospitality',
  Hotel: 'Food & Hospitality',
  Office: 'Business & Office',
  Company: 'Business & Office',
  Warehouse: 'Industrial & Logistics',
  Factory: 'Industrial & Logistics',
  Hospital: 'Healthcare',
  Clinic: 'Healthcare',
  Gym: 'Wellness & Lifestyle',
  Salon: 'Wellness & Lifestyle',
  School: 'Education',
  Bank: 'Finance & Legal',
  'Real Estate': 'Automotive & Property',
}

const GROUP_ICONS: Record<string, LucideIcon> = {
  Retail: ShoppingBag,
  'Food & Hospitality': UtensilsCrossed,
  'Business & Office': Building2,
  'Industrial & Logistics': Warehouse,
  Healthcare: Heart,
  'Wellness & Lifestyle': Dumbbell,
  Education: GraduationCap,
  'Finance & Legal': Landmark,
  'Automotive & Property': Car,
  default: Store,
}

export type BusinessUnitVisual = {
  logoUrl: string
  bannerUrl: string
  typeLabel: string
  gradientClass: string
  Icon: LucideIcon
  usesVendorLogo: boolean
  usesVendorBanner: boolean
}

function settingsStr(settings: Record<string, unknown> | undefined, key: string): string {
  const v = settings?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

export function getBusinessUnitVisual(
  store: StoreRecord,
  vendor?: { logo_url?: string; banner_url?: string } | null,
): BusinessUnitVisual {
  const settings = store.settings as Record<string, unknown> | undefined
  const companyType = settingsStr(settings, 'company_type') || 'Business unit'
  const group = GROUP_BY_TYPE[companyType] ?? 'default'
  const storeLogo = settingsStr(settings, 'logo_url')
  const storeBanner = settingsStr(settings, 'banner_url')
  const vendorLogo = vendor?.logo_url?.trim() ?? ''
  const vendorBanner = vendor?.banner_url?.trim() ?? ''

  const logoUrl = mediaUrl(storeLogo || vendorLogo)
  const bannerUrl = mediaUrl(storeBanner || vendorBanner)

  return {
    logoUrl,
    bannerUrl,
    typeLabel: companyType,
    gradientClass: TYPE_GRADIENTS[group] ?? TYPE_GRADIENTS.default,
    Icon: GROUP_ICONS[group] ?? GROUP_ICONS.default,
    usesVendorLogo: !storeLogo && !!vendorLogo,
    usesVendorBanner: !storeBanner && !!vendorBanner,
  }
}
