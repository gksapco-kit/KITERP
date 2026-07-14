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
  Code2,
  Briefcase,
  Factory,
  Truck,
  HardHat,
  Scissors,
  Clapperboard,
  Wheat,
  HeartHandshake,
  Wrench,
  Rocket,
  Plane,
  Shirt,
} from 'lucide-react'
import type { StoreRecord } from '@/api/vendor'
import { resolveBrandingImageUrl } from '@/components/common/MediaUploadPickerModal'
import type { BrandingMode } from '@/lib/brandingMode'
import { COMPANY_TYPES } from '@/data/companyTypes'

const TYPE_GRADIENTS: Record<string, string> = {
  'Retail & Commerce': 'from-violet-500/90 via-fuchsia-500/80 to-pink-500/70',
  Fashion: 'from-fuchsia-500/90 via-pink-500/80 to-rose-400/70',
  'Food & Hospitality': 'from-amber-500/90 via-orange-500/80 to-rose-500/70',
  'Business & Office': 'from-slate-600/90 via-slate-500/80 to-zinc-500/70',
  'Technology & IT': 'from-sky-600/90 via-blue-500/80 to-indigo-500/70',
  'Professional Services': 'from-slate-500/90 via-gray-500/80 to-zinc-500/70',
  'Manufacturing & Industrial': 'from-blue-600/90 via-cyan-600/80 to-teal-500/70',
  'Logistics & Transportation': 'from-cyan-600/90 via-teal-500/80 to-emerald-500/70',
  'Construction & Real Estate': 'from-stone-600/90 via-amber-700/80 to-orange-600/70',
  Healthcare: 'from-rose-500/90 via-red-500/80 to-pink-500/70',
  'Wellness & Lifestyle': 'from-emerald-500/90 via-teal-500/80 to-cyan-500/70',
  'Beauty & Personal Care': 'from-pink-500/90 via-rose-400/80 to-fuchsia-500/70',
  'Education & Training': 'from-indigo-600/90 via-blue-500/80 to-sky-500/70',
  'Finance & Insurance': 'from-amber-600/90 via-yellow-600/80 to-orange-500/70',
  'Media & Entertainment': 'from-purple-600/90 via-violet-500/80 to-fuchsia-500/70',
  Automotive: 'from-stone-600/90 via-neutral-600/80 to-zinc-600/70',
  Agriculture: 'from-lime-600/90 via-green-500/80 to-emerald-500/70',
  'Religious & Non-Profit': 'from-teal-600/90 via-cyan-500/80 to-sky-500/70',
  'Personal & Home Services': 'from-orange-500/90 via-amber-500/80 to-yellow-500/70',
  'Emerging Categories': 'from-violet-600/90 via-indigo-500/80 to-blue-500/70',
  Travel: 'from-sky-500/90 via-cyan-500/80 to-teal-500/70',
  default: 'from-primary/80 via-[hsl(var(--hero-via))] to-[hsl(var(--hero-to))]',
}

const GROUP_ICONS: Record<string, LucideIcon> = {
  'Retail & Commerce': ShoppingBag,
  Fashion: Shirt,
  'Food & Hospitality': UtensilsCrossed,
  'Business & Office': Building2,
  'Technology & IT': Code2,
  'Professional Services': Briefcase,
  'Manufacturing & Industrial': Factory,
  'Logistics & Transportation': Truck,
  'Construction & Real Estate': HardHat,
  Healthcare: Heart,
  'Wellness & Lifestyle': Dumbbell,
  'Beauty & Personal Care': Scissors,
  'Education & Training': GraduationCap,
  'Finance & Insurance': Landmark,
  'Media & Entertainment': Clapperboard,
  Automotive: Car,
  Agriculture: Wheat,
  'Religious & Non-Profit': HeartHandshake,
  'Personal & Home Services': Wrench,
  'Emerging Categories': Rocket,
  Travel: Plane,
  default: Store,
}

function groupForCompanyType(companyType: string): string {
  return COMPANY_TYPES.find((t) => t.value === companyType)?.group ?? 'default'
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

/**
 * Resolve the visual assets for a business unit card / detail panel.
 * When `mode` is `'shared'`, per-unit logo/banner overrides are ignored so the
 * Business Profile (vendor-wide) branding is used everywhere — no data is touched.
 * Defaults to `'per_unit'` (existing behavior) so all callers without the arg work unchanged.
 */
export function getBusinessUnitVisual(
  store: StoreRecord,
  vendor?: { logo_url?: string; banner_url?: string } | null,
  mode: BrandingMode = 'per_unit',
): BusinessUnitVisual {
  const settings = store.settings as Record<string, unknown> | undefined
  const companyType = settingsStr(settings, 'company_type') || 'Business unit'
  const group = groupForCompanyType(companyType)
  const storeLogo = mode === 'shared' ? '' : settingsStr(settings, 'logo_url')
  const storeBanner = mode === 'shared' ? '' : settingsStr(settings, 'banner_url')
  const vendorLogo = vendor?.logo_url?.trim() ?? ''
  const vendorBanner = vendor?.banner_url?.trim() ?? ''

  const logoUrl = resolveBrandingImageUrl(storeLogo || vendorLogo)
  const bannerUrl = resolveBrandingImageUrl(storeBanner || vendorBanner)

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
