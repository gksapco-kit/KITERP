import { vendorApi } from '@/api/vendor'
import type { LiveItem } from '@storefront/blocks/registry'
import type { Service, ServiceMediaItem } from '@/types'

function serviceThumbFromVendorRow(service: Service): string | null {
  const media = service.media || []
  const primary = media.find((m: ServiceMediaItem) => m.is_primary && (!m.media_type || m.media_type === 'image'))
    || media.find((m: ServiceMediaItem) => !m.media_type || m.media_type === 'image')
    || media.find((m: ServiceMediaItem) => m.is_primary)
    || media[0]
  if (primary?.url) return primary.url
  if (service.image_url) return service.image_url
  if (service.gallery?.[0]) return service.gallery[0]
  return null
}

/** Builder/preview safety net when live/services omits image_url. */
export async function enrichLiveServiceImages(items: LiveItem[]): Promise<LiveItem[]> {
  if (!items.length || items.every((item) => Boolean(item.image_url))) return items

  try {
    const page = await vendorApi.listServices({ size: 200 })
    const byId = new Map(
      (page.items || []).map((service) => [String(service.id), serviceThumbFromVendorRow(service)]),
    )
    return items.map((item) => {
      if (item.image_url) return item
      const thumb = item.id ? byId.get(String(item.id)) : null
      return thumb ? { ...item, image_url: thumb } : item
    })
  } catch {
    return items
  }
}
