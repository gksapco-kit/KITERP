import type { StoreLocation } from '@/api/store'
import type { VendorData } from '@/contexts/VendorContext'

function settingStr(settings: Record<string, string> | undefined, key: string): string {
  const v = settings?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

/** Public brand label for a business unit on the customer storefront. */
export function branchDisplayName(branch: StoreLocation): string {
  return settingStr(branch.settings, 'display_name') || branch.name
}

/** Apply the active business unit's name, description, and branding onto vendor catalog data. */
export function applyBranchToVendor(vendor: VendorData, branch: StoreLocation | null): VendorData {
  if (!branch) return vendor
  const settings = branch.settings ?? {}
  const storeLogo = settingStr(settings, 'logo_url')
  const storeBanner = settingStr(settings, 'banner_url')
  return {
    ...vendor,
    business_name: branch.name,
    display_name: branchDisplayName(branch),
    description: branch.description?.trim() || vendor.description,
    logo_url: storeLogo || vendor.logo_url,
    banner_url: storeBanner || vendor.banner_url,
  }
}

/** Default hero headline when a branch is selected in the URL. */
export function branchWelcomeHeadline(branch: StoreLocation): string {
  return `Welcome to ${branchDisplayName(branch)}`
}
