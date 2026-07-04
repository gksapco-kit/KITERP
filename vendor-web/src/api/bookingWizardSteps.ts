import apiClient from './client'

export interface VendorBookingWizardStep {
  id: string
  vendor_id: string
  label: string
  description?: string | null
  sort_order: number
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface VendorBookingWizardStepCreate {
  label: string
  description?: string
  sort_order?: number
  is_active?: boolean
}

export type VendorBookingWizardStepUpdate = Partial<VendorBookingWizardStepCreate>

export interface VendorBookingWizardStepListResponse {
  items: VendorBookingWizardStep[]
  total: number
  page: number
  size: number
  pages: number
}

export const bookingWizardStepsApi = {
  list: async (params?: {
    page?: number
    size?: number
    search?: string
    is_active?: boolean
  }): Promise<VendorBookingWizardStepListResponse> => {
    const res = await apiClient.get('/vendors/me/booking-wizard-steps', { params })
    return res.data
  },

  get: async (id: string): Promise<VendorBookingWizardStep> => {
    const res = await apiClient.get(`/vendors/me/booking-wizard-steps/${id}`)
    return res.data
  },

  create: async (data: VendorBookingWizardStepCreate): Promise<VendorBookingWizardStep> => {
    const res = await apiClient.post('/vendors/me/booking-wizard-steps', data)
    return res.data
  },

  update: async (id: string, data: VendorBookingWizardStepUpdate): Promise<VendorBookingWizardStep> => {
    const res = await apiClient.patch(`/vendors/me/booking-wizard-steps/${id}`, data)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/booking-wizard-steps/${id}`)
  },
}
