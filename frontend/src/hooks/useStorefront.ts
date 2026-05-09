import { useQuery } from '@tanstack/react-query'
import { storefrontApi } from '@/api/storefront.api'

export const storefrontKeys = {
  vendor: (slug: string) => ['storefront', 'vendor', slug] as const,
  products: (slug: string, params?: Record<string, unknown>) => ['storefront', 'products', slug, params] as const,
  product: (slug: string, productSlug: string) => ['storefront', 'product', slug, productSlug] as const,
  services: (slug: string, params?: Record<string, unknown>) => ['storefront', 'services', slug, params] as const,
  service: (slug: string, serviceSlug: string) => ['storefront', 'service', slug, serviceSlug] as const,
}

export function useStorefrontVendor(slug: string) {
  return useQuery({
    queryKey: storefrontKeys.vendor(slug),
    queryFn: () => storefrontApi.getVendor(slug),
    enabled: !!slug,
    staleTime: 60_000,
  })
}

export function useStorefrontProducts(slug: string, params?: {
  page?: number
  size?: number
  category?: string
  search?: string
}) {
  return useQuery({
    queryKey: storefrontKeys.products(slug, params as Record<string, unknown>),
    queryFn: () => storefrontApi.getProducts(slug, params),
    enabled: !!slug,
    staleTime: 30_000,
  })
}

export function useStorefrontProduct(slug: string, productSlug: string) {
  return useQuery({
    queryKey: storefrontKeys.product(slug, productSlug),
    queryFn: () => storefrontApi.getProduct(slug, productSlug),
    enabled: !!slug && !!productSlug,
  })
}

export function useStorefrontServices(slug: string, params?: {
  page?: number
  size?: number
  category?: string
  search?: string
}) {
  return useQuery({
    queryKey: storefrontKeys.services(slug, params as Record<string, unknown>),
    queryFn: () => storefrontApi.getServices(slug, params),
    enabled: !!slug,
    staleTime: 30_000,
  })
}

export function useStorefrontService(slug: string, serviceSlug: string) {
  return useQuery({
    queryKey: storefrontKeys.service(slug, serviceSlug),
    queryFn: () => storefrontApi.getService(slug, serviceSlug),
    enabled: !!slug && !!serviceSlug,
  })
}
