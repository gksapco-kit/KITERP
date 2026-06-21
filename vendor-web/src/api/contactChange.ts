import apiClient from './client'

export type ContactFieldType = 'email' | 'phone'

export interface ContactChangeRequestRow {
  id: string
  field_type: ContactFieldType
  current_value: string
  requested_value: string
  reason?: string | null
  status: string
  review_notes?: string | null
  created_at?: string | null
  resolved_at?: string | null
}

export const contactChangeApi = {
  listMine: async (): Promise<ContactChangeRequestRow[]> => {
    const response = await apiClient.get('/vendors/me/contact-change-requests')
    return response.data
  },

  create: async (payload: {
    field_type: ContactFieldType
    new_value: string
    reason?: string
    password: string
  }): Promise<ContactChangeRequestRow> => {
    const response = await apiClient.post('/vendors/me/contact-change-requests', payload)
    return response.data
  },

  cancel: async (requestId: string): Promise<ContactChangeRequestRow> => {
    const response = await apiClient.post(`/vendors/me/contact-change-requests/${requestId}/cancel`)
    return response.data
  },
}
