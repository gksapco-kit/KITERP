import apiClient from './client'
import type { Vendor } from '@/types/vendor'

export interface RelationshipManagerBrief {
  id: string
  full_name: string
  email?: string | null
  phone?: string | null
}

/** Admin vendor directory row (includes assigned relationship manager). */
export interface AdminVendor extends Vendor {
  relationship_manager_user_id?: string | null
  relationship_manager?: RelationshipManagerBrief | null
}

export interface VendorListResponse {
  items: AdminVendor[]
  total: number
  page: number
  size: number
  pages: number
}

export interface RelationshipManagerOption {
  id: string
  full_name: string
  email?: string | null
  phone?: string | null
  /** Email or phone (login); fallback to name or id */
  login_display?: string
  /** e.g. Super Admin, Relationship manager */
  role_label?: string
}

export interface ListVendorsParams {
  page?: number
  size?: number
  status?: string
  search?: string
  /** Superuser only: filter to vendors assigned to this relationship manager user id */
  relationship_manager_user_id?: string
}

export interface AdminVendorCreatePayload {
  owner_email: string
  owner_password: string
  owner_name: string
  owner_phone?: string
  business_name: string
  display_name: string
  slug: string
  business_type: string
  offering_type: string
  industry: string
  description?: string
  primary_email?: string
  primary_phone: string
  street_address: string
  city: string
  state: string
  postal_code: string
  country: string
  latitude?: number
  longitude?: number
  service_radius_km: number
}

export interface AdminVendorCreateResponse {
  vendor: {
    id: string
    business_name: string
    display_name: string
    slug: string
    subdomain: string
    status: string
  }
  owner_account: {
    user_id: string
    email: string
    password: string
    full_name: string
    user_created: boolean
  }
  message: string
}

export interface AdminVendorUpdatePayload {
  business_name?: string
  display_name?: string
  business_type?: string
  offering_type?: string
  industry?: string
  description?: string
  primary_email?: string
  primary_phone?: string
  support_email?: string
  support_phone?: string
  street_address?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  latitude?: number
  longitude?: number
  service_radius_km?: number
  gstin?: string
  pan_number?: string
  is_gst_registered?: boolean
  default_tax_rate?: number
  status?: string
  relationship_manager_user_id?: string | null
}

export interface VendorRmQueryAdminRow {
  id: string
  vendor_id: string
  vendor_display_name?: string | null
  created_by_user_id: string
  created_by_name?: string | null
  subject: string
  body: string
  status: string
  created_at?: string | null
}

export interface VendorRmQueryListResponse {
  items: VendorRmQueryAdminRow[]
  total: number
  page: number
  size: number
  pages: number
}

export interface AdminVendorStats {
  total: number
  approved: number
  pending_review: number
}

export interface PlatformStaffMember {
  id: string
  email?: string | null
  phone?: string | null
  full_name: string
  is_active: boolean
  created_at?: string | null
  job_role?: string | null
  manager_id?: string | null
  manager_name?: string | null
  /** Vendors where this user is the assigned relationship manager */
  assigned_business_account_count?: number
}

export interface PlatformStaffCreatePayload {
  full_name: string
  password: string
  email?: string | null
  phone?: string | null
  job_role: string
  manager_id?: string | null
}

export interface PlatformStaffUpdatePayload {
  is_active?: boolean
  remove_access?: boolean
  full_name?: string
  email?: string | null
  phone?: string | null
  job_role?: string
  /** Set to `null` to clear assignment */
  manager_id?: string | null
}

export interface PlatformStaffAuditEntry {
  id: string
  action: string
  detail?: Record<string, unknown> | null
  actor_user_id?: string | null
  actor_full_name?: string | null
  ip?: string | null
  created_at: string
}

export interface PlatformStaffAuditListResponse {
  items: PlatformStaffAuditEntry[]
  total: number
  page: number
  size: number
  pages: number
}

export interface VendorDashboardHandoffResponse {
  handoff_token: string
  vendor_id: string
  vendor_slug: string
}

export const adminApi = {
  createVendor: async (data: AdminVendorCreatePayload): Promise<AdminVendorCreateResponse> => {
    const response = await apiClient.post('/admin/vendors/create', data)
    return response.data
  },

  getVendorStats: async (): Promise<AdminVendorStats> => {
    const response = await apiClient.get('/admin/vendors/stats/summary')
    return response.data
  },

  listVendors: async (params?: ListVendorsParams): Promise<VendorListResponse> => {
    const response = await apiClient.get('/admin/vendors', { params })
    return response.data
  },

  listRelationshipManagerOptions: async (): Promise<RelationshipManagerOption[]> => {
    const response = await apiClient.get('/admin/vendors/relationship-manager-options')
    return response.data
  },

  getVendor: async (vendorId: string): Promise<AdminVendor> => {
    const response = await apiClient.get(`/admin/vendors/${vendorId}`)
    return response.data
  },

  updateVendor: async (vendorId: string, data: AdminVendorUpdatePayload): Promise<AdminVendor> => {
    const response = await apiClient.put(`/admin/vendors/${vendorId}`, data)
    return response.data
  },

  listVendorRmQueries: async (params?: {
    vendor_id?: string
    status?: string
    page?: number
    size?: number
  }): Promise<VendorRmQueryListResponse> => {
    const response = await apiClient.get('/admin/vendor-rm-queries', { params })
    return response.data
  },

  patchVendorRmQuery: async (
    queryId: string,
    status: 'open' | 'in_progress' | 'closed',
  ): Promise<VendorRmQueryAdminRow> => {
    const response = await apiClient.patch(`/admin/vendor-rm-queries/${queryId}`, { status })
    return response.data
  },

  approveVendor: async (vendorId: string): Promise<Vendor> => {
    const response = await apiClient.put(`/admin/vendors/${vendorId}/approve`)
    return response.data
  },

  rejectVendor: async (vendorId: string, reason: string): Promise<Vendor> => {
    const response = await apiClient.put(`/admin/vendors/${vendorId}/reject`, null, {
      params: { reason },
    })
    return response.data
  },

  getVendorOwner: async (vendorId: string): Promise<{
    user_id: string
    email: string
    full_name: string
    phone?: string
    is_active: boolean
    is_email_verified: boolean
    created_at?: string
  }> => {
    const response = await apiClient.get(`/admin/vendors/${vendorId}/owner`)
    return response.data
  },

  getPlatformSettings: async (): Promise<Record<string, string>> => {
    const response = await apiClient.get('/admin/platform-settings')
    return response.data
  },

  updatePlatformSettings: async (settings: Record<string, string | null>): Promise<Record<string, string>> => {
    const response = await apiClient.put('/admin/platform-settings', { settings })
    return response.data
  },

  listPlatformStaff: async (): Promise<PlatformStaffMember[]> => {
    const response = await apiClient.get('/admin/platform-staff')
    return response.data
  },

  createPlatformStaff: async (data: PlatformStaffCreatePayload): Promise<PlatformStaffMember> => {
    const response = await apiClient.post('/admin/platform-staff', data)
    return response.data
  },

  updatePlatformStaff: async (
    userId: string,
    data: PlatformStaffUpdatePayload,
  ): Promise<PlatformStaffMember> => {
    const response = await apiClient.patch(`/admin/platform-staff/${userId}`, data)
    return response.data
  },

  resetPlatformStaffPassword: async (
    userId: string,
    password: string,
  ): Promise<PlatformStaffMember> => {
    const response = await apiClient.post(`/admin/platform-staff/${userId}/reset-password`, {
      password,
    })
    return response.data
  },

  listMyPlatformStaffAudit: async (params?: {
    page?: number
    size?: number
  }): Promise<PlatformStaffAuditListResponse> => {
    const response = await apiClient.get('/admin/platform-staff/me/audit-log', { params })
    return response.data
  },

  listPlatformStaffAuditForMember: async (
    userId: string,
    params?: { page?: number; size?: number },
  ): Promise<PlatformStaffAuditListResponse> => {
    const response = await apiClient.get(`/admin/platform-staff/${userId}/audit-log`, { params })
    return response.data
  },

  createVendorDashboardHandoff: async (vendorId: string): Promise<VendorDashboardHandoffResponse> => {
    const response = await apiClient.post(`/admin/vendors/${vendorId}/dashboard-handoff`)
    return response.data
  },
}
