import type { StoreRecord } from '@/api/vendor'
import type { Vendor, VendorCategory } from '@/types'
import {
  imageCategoryForBusinessType,
  resolveWebsiteSetupFromBusinessSettings,
} from '@/lib/businessSitePresets'
import { normalizeGalleryCategoryId } from '@/data/categoryStockImages'

export type StoredGalleryImage = {
  id: string
  url: string
  label: string
}

function settingsStr(settings: Record<string, unknown> | undefined, key: string): string {
  const v = settings?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

function extraBannerUrls(settings: Record<string, unknown> | undefined): string[] {
  const raw = settings?.extra_banners
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

/** True for paths the vendor uploaded — not stock gallery packs or Unsplash fallbacks. */
export function isUserStoredImageUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url.trim()) return false
  const trimmed = url.trim()
  if (trimmed.startsWith('/business-images')) return false
  if (trimmed.includes('images.unsplash.com')) return false
  return (
    trimmed.startsWith('/uploads/')
    || trimmed.startsWith('http://')
    || trimmed.startsWith('https://')
    || trimmed.startsWith('data:image/')
  )
}

function pushStoredImage(
  seen: Set<string>,
  out: StoredGalleryImage[],
  url: string | undefined | null,
  label: string,
) {
  if (!isUserStoredImageUrl(url)) return
  const key = url.trim().toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  out.push({ id: `stored-${out.length}-${key.slice(-32)}`, url: url.trim(), label })
}

function flattenCategories(categories: VendorCategory[]): VendorCategory[] {
  const out: VendorCategory[] = []
  const walk = (list: VendorCategory[]) => {
    for (const cat of list) {
      out.push(cat)
      if (cat.children?.length) walk(cat.children)
    }
  }
  walk(categories)
  return out
}

/** Default stock gallery category from the active business unit (or vendor) profile. */
export function resolveGalleryCategoryFromBusinessSettings(
  vendor?: Pick<Vendor, 'business_type' | 'offering_type'> | null,
  store?: Pick<StoreRecord, 'settings'> | null,
): string {
  const { businessTypeId } = resolveWebsiteSetupFromBusinessSettings(vendor, store)
  return normalizeGalleryCategoryId(imageCategoryForBusinessType(businessTypeId))
}

export function collectVendorStoredImages(input: {
  vendor?: Pick<Vendor, 'logo_url' | 'banner_url' | 'theme_config'> | null
  stores?: Pick<StoreRecord, 'name' | 'settings'>[]
  categories?: VendorCategory[]
  websiteMedia?: Array<{ id: string; original_url: string; filename?: string | null; label?: string | null }>
}): StoredGalleryImage[] {
  const seen = new Set<string>()
  const out: StoredGalleryImage[] = []

  pushStoredImage(seen, out, input.vendor?.logo_url, 'Account logo')
  pushStoredImage(seen, out, input.vendor?.banner_url, 'Account banner')

  const vendorExtras = extraBannerUrls(input.vendor?.theme_config as Record<string, unknown> | undefined)
  vendorExtras.forEach((url, i) => pushStoredImage(seen, out, url, `Account banner ${i + 1}`))

  for (const store of input.stores ?? []) {
    const settings = (store.settings ?? {}) as Record<string, unknown>
    const unitLabel = store.name?.trim() || 'Business unit'
    pushStoredImage(seen, out, settingsStr(settings, 'logo_url'), `${unitLabel} logo`)
    pushStoredImage(seen, out, settingsStr(settings, 'banner_url'), `${unitLabel} banner`)
    extraBannerUrls(settings).forEach((url, i) => {
      pushStoredImage(seen, out, url, `${unitLabel} banner ${i + 1}`)
    })
  }

  for (const cat of flattenCategories(input.categories ?? [])) {
    if (!cat.image_url) continue
    pushStoredImage(seen, out, cat.image_url, cat.name?.trim() || 'Category image')
  }

  for (const item of input.websiteMedia ?? []) {
    const label = item.label?.trim() || item.filename?.trim() || 'Site media'
    pushStoredImage(seen, out, item.original_url, label)
  }

  return out
}
