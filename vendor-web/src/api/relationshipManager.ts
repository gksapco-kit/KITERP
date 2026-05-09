import apiClient from './client'

export interface VendorRmQueryRow {
  id: string
  subject: string
  body: string
  status: string
  created_at?: string | null
}

export interface MyRelationshipManagerResponse {
  assigned: boolean
  manager: null | {
    id: string
    full_name: string
    email?: string | null
    phone?: string | null
  }
}

export const relationshipManagerApi = {
  getMine: async (): Promise<MyRelationshipManagerResponse> => {
    const response = await apiClient.get('/vendors/me/relationship-manager')
    return response.data
  },

  listQueries: async (): Promise<VendorRmQueryRow[]> => {
    const response = await apiClient.get('/vendors/me/relationship-manager/queries')
    return response.data
  },

  createQuery: async (payload: { subject: string; body: string }): Promise<VendorRmQueryRow> => {
    const response = await apiClient.post('/vendors/me/relationship-manager/queries', payload)
    return response.data
  },
}
