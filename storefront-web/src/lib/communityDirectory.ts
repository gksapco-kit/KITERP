import type { StorefrontVendor } from '@/components/landing/landingData'

/** Vendor eligible for the homepage mosaic / store search (admin Community toggle). */
export type CommunityListedVendor = StorefrontVendor & {
  show_in_community?: boolean
}

/** Keep only vendors with Community enabled (``/catalog/vendors`` should already filter). */
export function filterCommunityListedVendors(
  items: CommunityListedVendor[],
): CommunityListedVendor[] {
  if (items.length === 0) return []
  const hasFlag = items.some((v) => typeof v.show_in_community === 'boolean')
  if (!hasFlag) return items
  return items.filter((v) => v.show_in_community === true)
}