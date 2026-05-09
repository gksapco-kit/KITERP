import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { vendorApi } from '@/api/vendor.api'
import { useVendorStore } from '@/stores/vendorStore'
import type { VendorCreate, VendorUpdate, BankAccountCreate } from '@/types/vendor'

export const vendorKeys = {
  all: ['vendor'] as const,
  me: () => [...vendorKeys.all, 'me'] as const,
  documents: () => [...vendorKeys.all, 'documents'] as const,
  bankAccounts: () => [...vendorKeys.all, 'bank-accounts'] as const,
  nearby: (lat: number, lon: number, radius?: number) =>
    [...vendorKeys.all, 'nearby', lat, lon, radius] as const,
}

export function useMyVendor(options?: { enabled?: boolean }) {
  const { setVendor } = useVendorStore()

  return useQuery({
    queryKey: vendorKeys.me(),
    queryFn: async () => {
      const vendor = await vendorApi.getMyVendor()
      setVendor(vendor)
      return vendor
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: options?.enabled ?? true,
  })
}

export function useVendorDocuments() {
  return useQuery({
    queryKey: vendorKeys.documents(),
    queryFn: vendorApi.getDocuments,
  })
}

export function useBankAccounts() {
  return useQuery({
    queryKey: vendorKeys.bankAccounts(),
    queryFn: vendorApi.getBankAccounts,
  })
}

export function useRegisterVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: VendorCreate) => vendorApi.register(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.me() })
      toast.success('Vendor registered successfully!')
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Registration failed'
      toast.error(message)
    },
  })
}

export function useUpdateVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: VendorUpdate) => vendorApi.updateMyVendor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.me() })
      toast.success('Vendor updated successfully!')
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Update failed'
      toast.error(message)
    },
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ documentType, file }: { documentType: string; file: File }) =>
      vendorApi.uploadDocument(documentType, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.documents() })
      toast.success('Document uploaded successfully!')
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Upload failed'
      toast.error(message)
    },
  })
}

export function useAddBankAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BankAccountCreate) => vendorApi.addBankAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.bankAccounts() })
      toast.success('Bank account added successfully!')
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to add bank account'
      toast.error(message)
    },
  })
}

export function useSubmitForReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: vendorApi.submitForReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.me() })
      toast.success('Submitted for review!')
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Submission failed'
      toast.error(message)
    },
  })
}

export function useCheckSlug() {
  return useMutation({
    mutationFn: (slug: string) => vendorApi.checkSlug(slug),
  })
}

/**
 * Hook that resolves the user's browser geolocation.
 * Returns { lat, lng, loading, error, refresh }.
 */
export function useUserLocation() {
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const resolve = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported')
      setLoading(false)
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
      { enableHighAccuracy: true }
    )
  }, [])

  useEffect(() => {
    resolve()
  }, [resolve])

  return { lat, lng, loading, error, refresh: resolve }
}

/**
 * Fetch vendors near a given location.
 */
export function useNearbyVendors(params: {
  lat: number | null
  lng: number | null
  radiusKm?: number
  page?: number
  size?: number
  search?: string
  offeringType?: string
  enabled?: boolean
}) {
  return useQuery({
    queryKey: vendorKeys.nearby(params.lat ?? 0, params.lng ?? 0, params.radiusKm),
    queryFn: () =>
      vendorApi.getNearbyVendors({
        user_lat: params.lat!,
        user_lon: params.lng!,
        radius_km: params.radiusKm,
        page: params.page,
        size: params.size,
        search: params.search,
        offering_type: params.offeringType,
      }),
    enabled: (params.enabled ?? true) && params.lat != null && params.lng != null,
    staleTime: 60 * 1000,
  })
}

/**
 * Check distance from user to a specific vendor.
 */
export function useVendorDistance(vendorSlug: string, userLat: number | null, userLng: number | null) {
  return useQuery({
    queryKey: ['vendor-distance', vendorSlug, userLat, userLng],
    queryFn: () => vendorApi.getVendorDistance(vendorSlug, userLat!, userLng!),
    enabled: !!vendorSlug && userLat != null && userLng != null,
    staleTime: 60 * 1000,
  })
}
