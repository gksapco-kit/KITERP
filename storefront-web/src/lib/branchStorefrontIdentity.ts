import type { StoreLocation } from '@/api/store'
import type { VendorData } from '@/contexts/VendorContext'
import { resolveBrandingMode, type BrandingMode } from '@/lib/brandingMode'

function settingStr(settings: Record<string, string | unknown> | undefined, key: string): string {
  const v = settings?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

function extraBannerUrls(settings: Record<string, unknown> | undefined): string[] {
  const raw = settings?.extra_banners
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim())
}

/** Public brand label for a business unit on the customer storefront. */
export function branchDisplayName(branch: StoreLocation): string {
  return settingStr(branch.settings, 'display_name') || branch.name
}

export type StorefrontBranding = {
  business_name: string
  display_name: string
  logo_url?: string
  banner_url?: string
  extra_banners: string[]
}

/** Logo, banners, and brand name from Business Profile — shared or per active BU. */
export function resolveStorefrontBranding(
  vendor: VendorData,
  branch: StoreLocation | null,
  mode?: BrandingMode,
): StorefrontBranding {
  const brandingMode = mode ?? resolveBrandingMode(vendor.settings)

  if (brandingMode === 'shared' || !branch) {
    return {
      business_name: vendor.business_name,
      display_name: vendor.display_name,
      logo_url: vendor.logo_url,
      banner_url: vendor.banner_url,
      extra_banners: extraBannerUrls(vendor.theme_config),
    }
  }

  const storeSettings = (branch.settings ?? {}) as Record<string, unknown>
  const storeLogo = settingStr(storeSettings, 'logo_url')
  const storeBanner = settingStr(storeSettings, 'banner_url')
  const storeExtras = extraBannerUrls(storeSettings)
  const vendorExtras = extraBannerUrls(vendor.theme_config)

  return {
    business_name: branch.name,
    display_name: branchDisplayName(branch),
    logo_url: storeLogo || vendor.logo_url,
    banner_url: storeBanner || vendor.banner_url,
    extra_banners: storeExtras.length > 0 ? storeExtras : vendorExtras,
  }
}

/** Apply the active business unit onto vendor catalog data, respecting branding mode. */
export function applyBranchToVendor(vendor: VendorData, branch: StoreLocation | null): VendorData {
  if (!branch) return vendor
  const branding = resolveStorefrontBranding(vendor, branch)
  return {
    ...vendor,
    business_name: branding.business_name,
    display_name: branding.display_name,
    description: branch.description?.trim() || vendor.description,
    logo_url: branding.logo_url,
    banner_url: branding.banner_url,
    theme_config: {
      ...(vendor.theme_config ?? {}),
      extra_banners: branding.extra_banners,
    },
  }
}

/** Default hero headline when a branch is selected in the URL. */
export function branchWelcomeHeadline(branch: StoreLocation, vendor?: VendorData | null): string {
  if (vendor) {
    const branding = resolveStorefrontBranding(vendor, branch)
    return `Welcome to ${branding.display_name}`
  }
  return `Welcome to ${branchDisplayName(branch)}`
}
