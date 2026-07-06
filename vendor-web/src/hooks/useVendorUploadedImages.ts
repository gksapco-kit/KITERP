import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { websiteApi } from '@/api/websites'
import { useCategories, useProducts, useServices, useStores } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { collectVendorStoredImages, type StoredGalleryImage } from '@/lib/galleryPickerImages'

export function useVendorUploadedImages() {
  const queryClient = useQueryClient()
  const vendor = useVendorStore((s) => s.vendor)
  const vendorId = vendor?.id

  const { data: storesData } = useStores()
  const { data: categoriesData } = useCategories()
  const { data: productsData } = useProducts({ size: 100, page: 1 })
  const { data: servicesData } = useServices({ size: 100, page: 1 })

  const {
    data: websiteMedia = [],
    isLoading: mediaLoading,
    isFetching: mediaFetching,
  } = useQuery({
    queryKey: ['websites', vendorId, 'all-media'],
    queryFn: async () => {
      const sites = await websiteApi.listSites()
      if (!sites.length) return []
      const batches = await Promise.all(
        sites.map((site) => websiteApi.listMedia(site.id).catch(() => [])),
      )
      return batches.flat()
    },
    enabled: Boolean(vendorId),
    staleTime: 60_000,
    retry: 1,
  })

  const images: StoredGalleryImage[] = useMemo(
    () =>
      collectVendorStoredImages({
        vendor,
        stores: storesData?.stores,
        categories: categoriesData?.categories,
        websiteMedia,
        products: productsData?.items,
        services: servicesData?.items,
      }),
    [vendor, storesData?.stores, categoriesData?.categories, websiteMedia, productsData?.items, servicesData?.items],
  )

  // Only block the grid when we have nothing to show yet and media is still loading.
  const isLoading = Boolean(vendorId) && mediaLoading && images.length === 0

  const refetch = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['websites', vendorId, 'all-media'] }),
      queryClient.invalidateQueries({ queryKey: ['vendor', 'products'] }),
      queryClient.invalidateQueries({ queryKey: ['vendor', 'services'] }),
      queryClient.invalidateQueries({ queryKey: ['vendor', 'categories'] }),
      queryClient.invalidateQueries({ queryKey: ['vendor', 'stores'] }),
    ])
  }

  return { images, isLoading, isFetching: mediaFetching, count: images.length, refetch }
}
