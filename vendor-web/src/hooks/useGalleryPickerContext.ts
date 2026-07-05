import { useMemo } from 'react'
import { useCategories, useStores } from '@/hooks/useVendor'
import { useMedia } from '@/hooks/useWebsites'
import { useVendorStore } from '@/stores/vendorStore'
import {
  collectVendorStoredImages,
  resolveGalleryCategoryFromBusinessSettings,
  type StoredGalleryImage,
} from '@/lib/galleryPickerImages'

type Options = {
  /** When set, include this site's media library in stored images. */
  siteId?: string | null
}

export function useGalleryPickerContext({ siteId }: Options = {}) {
  const vendor = useVendorStore((s) => s.vendor)
  const selectedStoreId = useVendorStore((s) => s.selectedStore?.id)

  const { data: storesData } = useStores()
  const { data: categoriesData } = useCategories()
  const { data: websiteMedia = [] } = useMedia(siteId ?? null)

  const activeStore = useMemo(() => {
    const stores = storesData?.stores ?? []
    if (selectedStoreId) {
      return stores.find((s) => s.id === selectedStoreId) ?? stores.find((s) => s.is_default) ?? stores[0]
    }
    return stores.find((s) => s.is_default) ?? stores[0]
  }, [storesData?.stores, selectedStoreId])

  const defaultCategoryId = useMemo(
    () => resolveGalleryCategoryFromBusinessSettings(vendor, activeStore),
    [vendor, activeStore],
  )

  const storedImages: StoredGalleryImage[] = useMemo(
    () =>
      collectVendorStoredImages({
        vendor,
        stores: storesData?.stores,
        categories: categoriesData?.categories,
        websiteMedia,
      }),
    [vendor, storesData?.stores, categoriesData?.categories, websiteMedia],
  )

  return { defaultCategoryId, storedImages, activeStore }
}
