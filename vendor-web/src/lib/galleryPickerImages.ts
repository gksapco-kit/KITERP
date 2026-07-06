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

function galleryUploadEntries(
  settings: Record<string, unknown> | undefined,
): Array<{ url: string; filename?: string; label?: string }> {
  const raw = settings?.gallery_uploads
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (x): x is { url: string; filename?: string; label?: string } =>
      typeof x === 'object' && x !== null && typeof (x as { url?: unknown }).url === 'string',
  )
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
  products?: Array<{ name: string; images?: Array<{ url: string; media_type?: string; alt_text?: string | null }> }>
  services?: Array<{
    name: string
    image_url?: string | null
    gallery?: string[]
    media?: Array<{ url: string; media_type?: string; alt_text?: string | null }>
  }>
}): StoredGalleryImage[] {
  const seen = new Set<string>()
  const out: StoredGalleryImage[] = []

  pushStoredImage(seen, out, input.vendor?.logo_url, 'Account logo')
  pushStoredImage(seen, out, input.vendor?.banner_url, 'Account banner')

  const vendorExtras = extraBannerUrls(input.vendor?.theme_config as Record<string, unknown> | undefined)
  vendorExtras.forEach((url, i) => pushStoredImage(seen, out, url, `Account banner ${i + 1}`))

  for (const item of galleryUploadEntries(input.vendor?.theme_config as Record<string, unknown> | undefined)) {
    const label = item.label?.trim() || item.filename?.trim() || 'Gallery upload'
    pushStoredImage(seen, out, item.url, label)
  }

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

  for (const product of input.products ?? []) {
    const productLabel = product.name?.trim() || 'Product'
    for (const img of product.images ?? []) {
      if (img.media_type && img.media_type !== 'image') continue
      const label = img.alt_text?.trim() || `${productLabel} image`
      pushStoredImage(seen, out, img.url, label)
    }
  }

  for (const service of input.services ?? []) {
    const serviceLabel = service.name?.trim() || 'Service'
    pushStoredImage(seen, out, service.image_url, `${serviceLabel} cover`)
    for (const url of service.gallery ?? []) {
      pushStoredImage(seen, out, url, `${serviceLabel} gallery`)
    }
    for (const item of service.media ?? []) {
      if (item.media_type && item.media_type !== 'image') continue
      const label = item.alt_text?.trim() || `${serviceLabel} media`
      pushStoredImage(seen, out, item.url, label)
    }
  }

  return out
}
