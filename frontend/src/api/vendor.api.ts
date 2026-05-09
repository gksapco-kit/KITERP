import apiClient from './client'
import type {
  Vendor,
  VendorCreate,
  VendorUpdate,
  VendorDocument,
  BankAccount,
  BankAccountCreate,
  SlugCheckResponse,
  NearbyVendorListResponse,
  VendorDistanceResponse,
} from '@/types/vendor'

export const vendorApi = {
  // Registration
  register: async (data: VendorCreate): Promise<Vendor> => {
    const response = await apiClient.post('/vendors/register', data)
    return response.data
  },

  checkSlug: async (slug: string): Promise<SlugCheckResponse> => {
    const response = await apiClient.post('/vendors/check-slug', { slug })
    return response.data
  },

  // Profile
  getMyVendor: async (): Promise<Vendor> => {
    const response = await apiClient.get('/vendors/me')
    return response.data
  },

  updateMyVendor: async (data: VendorUpdate): Promise<Vendor> => {
    const response = await apiClient.put('/vendors/me', data)
    return response.data
  },

  // Documents
  uploadDocument: async (
    documentType: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<VendorDocument> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', documentType)

    const response = await apiClient.post('/vendors/me/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100))
        }
      },
    })
    return response.data
  },

  getDocuments: async (): Promise<VendorDocument[]> => {
    const response = await apiClient.get('/vendors/me/documents')
    return response.data
  },

  // Bank Account
  addBankAccount: async (data: BankAccountCreate): Promise<BankAccount> => {
    const response = await apiClient.post('/vendors/me/bank-account', data)
    return response.data
  },

  getBankAccounts: async (): Promise<BankAccount[]> => {
    const response = await apiClient.get('/vendors/me/bank-accounts')
    return response.data
  },

  // Submit for review
  submitForReview: async (): Promise<Vendor> => {
    const response = await apiClient.post('/vendors/me/submit-review')
    return response.data
  },

  // Location / Nearby
  getNearbyVendors: async (params: {
    user_lat: number
    user_lon: number
    radius_km?: number
    page?: number
    size?: number
    search?: string
    offering_type?: string
  }): Promise<NearbyVendorListResponse> => {
    const response = await apiClient.get('/catalog/nearby-vendors', { params })
    return response.data
  },

  getVendorDistance: async (
    vendorSlug: string,
    userLat: number,
    userLon: number
  ): Promise<VendorDistanceResponse> => {
    const response = await apiClient.get(`/catalog/vendor/${vendorSlug}/distance`, {
      params: { user_lat: userLat, user_lon: userLon },
    })
    return response.data
  },
}
