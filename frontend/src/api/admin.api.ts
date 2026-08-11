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

/** Read-only restaurant ops snapshot for platform support. */
export interface AdminRestaurantSnapshot {
  vendor_id: string
  module_enabled: boolean
  today: {
    open_orders: number
    total_covers: number
    restaurant_revenue: number
    active_kots: number
  }
  kots_by_status: Record<string, number>
  tables_by_status: Record<string, number>
  upcoming_reservations: number
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
  owner_email?: string
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
    email: string | null
    phone: string | null
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
  external_domain_access_status?: 'not_requested' | 'pending' | 'active' | 'revoked'
  show_in_community?: boolean
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

export interface PlatformJobRolePermission {
  key: string
  label: string
}

export interface PlatformJobRole {
  id?: string | null
  slug: string
  name: string
  description?: string | null
  permissions: string[]
  is_builtin: boolean
  is_active: boolean
  assigned_count?: number
}

export interface PlatformJobRoleListResponse {
  roles: PlatformJobRole[]
  builtin_slugs: string[]
}

export interface PlatformJobRolePermissionsResponse {
  permissions: Record<string, PlatformJobRolePermission[]>
  all: string[]
}

export interface PlatformJobRoleCreatePayload {
  name: string
  description?: string | null
  permissions: string[]
}

export interface PlatformJobRoleUpdatePayload {
  name?: string
  description?: string | null
  permissions?: string[]
  is_active?: boolean
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

  getRestaurantSnapshot: async (vendorId: string): Promise<AdminRestaurantSnapshot> => {
    const response = await apiClient.get(`/admin/vendors/${vendorId}/restaurant-snapshot`)
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

  deleteVendor: async (vendorId: string): Promise<void> => {
    await apiClient.delete(`/admin/vendors/${vendorId}`)
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

  listPlatformJobRoles: async (params?: {
    include_inactive?: boolean
  }): Promise<PlatformJobRoleListResponse> => {
    const response = await apiClient.get('/admin/platform-job-roles', { params })
    return response.data
  },

  listPlatformJobRolePermissions: async (): Promise<PlatformJobRolePermissionsResponse> => {
    const response = await apiClient.get('/admin/platform-job-roles/permissions')
    return response.data
  },

  createPlatformJobRole: async (data: PlatformJobRoleCreatePayload): Promise<PlatformJobRole> => {
    const response = await apiClient.post('/admin/platform-job-roles', data)
    return response.data
  },

  updatePlatformJobRole: async (
    roleId: string,
    data: PlatformJobRoleUpdatePayload,
  ): Promise<PlatformJobRole> => {
    const response = await apiClient.patch(`/admin/platform-job-roles/${roleId}`, data)
    return response.data
  },

  deletePlatformJobRole: async (roleId: string): Promise<void> => {
    await apiClient.delete(`/admin/platform-job-roles/${roleId}`)
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

  /** Handoff into the internal KIT ERP platform tenant for admin HR (not a customer BU). */
  createPlatformHrDashboardHandoff: async (): Promise<VendorDashboardHandoffResponse> => {
    const response = await apiClient.post('/admin/hr/dashboard-handoff')
    return response.data
  },

  /** Handoff into the internal KIT ERP platform tenant for admin CRM (not a customer BU). */
  createPlatformCrmDashboardHandoff: async (): Promise<VendorDashboardHandoffResponse> => {
    // Use platform-crm path (not /admin/crm/…) so it cannot collide with Admin Platform CRM APIs.
    const response = await apiClient.post('/admin/platform-crm/dashboard-handoff')
    return response.data
  },

  /** Handoff into the internal KIT ERP platform tenant for admin Finance (not a customer BU). */
  createPlatformFinanceDashboardHandoff: async (): Promise<VendorDashboardHandoffResponse> => {
    const response = await apiClient.post('/admin/platform-finance/dashboard-handoff')
    return response.data
  },


  listOrderDisputes: async (params?: {
    status?: string
    dispute_type?: string
    page?: number
    size?: number
  }): Promise<OrderDisputeListResponse> => {
    const response = await apiClient.get('/admin/disputes', { params })
    return response.data
  },

  updateOrderDispute: async (
    disputeId: string,
    data: { status: string; resolution_notes?: string },
  ): Promise<{ ok: boolean; id: string; status: string }> => {
    const response = await apiClient.patch(`/admin/disputes/${disputeId}`, data)
    return response.data
  },

  listContactQueries: async (params?: {
    status?: string
    vendor_id?: string
    /** Only KIT ERP Platform Contact Us (no vendor store). */
    platform_only?: boolean
    page?: number
    size?: number
  }): Promise<ContactQueryListResponse> => {
    const response = await apiClient.get('/admin/contact-queries', { params })
    return response.data
  },

  updateContactQuery: async (
    queryId: string,
    data: { status: string },
  ): Promise<{ ok: boolean; id: string; status: string }> => {
    const response = await apiClient.patch(`/admin/contact-queries/${queryId}`, data)
    return response.data
  },

  listCareerApplications: async (params?: {
    status?: string
    page?: number
    size?: number
  }): Promise<CareerApplicationListResponse> => {
    const response = await apiClient.get('/admin/career-applications', { params })
    return response.data
  },

  updateCareerApplication: async (
    applicationId: string,
    data: {
      status?: string
      admin_note?: string | null
      full_name?: string
      email?: string
      phone?: string | null
      company?: string | null
      current_role?: string | null
      experience_years?: number | null
      city?: string | null
      linkedin_url?: string | null
      position_title?: string | null
      cover_note?: string | null
    },
  ): Promise<{
    ok: boolean
    id: string
    status: string
    admin_note?: string | null
    full_name?: string
    email?: string
    phone?: string | null
    company?: string | null
    current_role?: string | null
    experience_years?: number | null
    city?: string | null
    linkedin_url?: string | null
    position_title?: string | null
    cover_note?: string | null
  }> => {
    const response = await apiClient.patch(`/admin/career-applications/${applicationId}`, data)
    return response.data
  },

  syncCareerApplicationToPipeline: async (
    applicationId: string,
    status: string,
  ): Promise<{
    ok: boolean
    job_posting_id: string
    application_id: string
    candidate_id: string
    current_stage: string
  }> => {
    const syncFromPatch = async () => {
      const response = await apiClient.patch(`/admin/career-applications/${applicationId}`, { status })
      const data = response.data as {
        job_posting_id?: string | null
        pipeline?: {
          job_posting_id: string
          application_id: string
          candidate_id: string
          current_stage: string
        } | null
      }
      const pipeline = data.pipeline
      if (pipeline?.job_posting_id && pipeline?.application_id) {
        return {
          ok: true,
          job_posting_id: pipeline.job_posting_id,
          application_id: pipeline.application_id,
          candidate_id: pipeline.candidate_id,
          current_stage: pipeline.current_stage,
        }
      }
      throw {
        response: {
          data: {
            detail:
              'Could not sync — link this application to a job opening first (use Edit to set the job title)',
          },
        },
      }
    }

    try {
      const response = await apiClient.post(`/admin/career-applications/${applicationId}/sync-pipeline`)
      return response.data
    } catch (err: unknown) {
      const statusCode = (err as { response?: { status?: number } })?.response?.status
      if (statusCode === 404) {
        return syncFromPatch()
      }
      throw err
    }
  },

  deleteCareerApplication: async (applicationId: string): Promise<void> => {
    await apiClient.delete(`/admin/career-applications/${applicationId}`)
  },

  previewCareerApplicationCv: async (
    applicationId: string,
  ): Promise<
    | { mode: 'html'; html: string }
    | { mode: 'pdf'; blob: Blob }
    | { mode: 'image'; blob: Blob }
  > => {
    const response = await apiClient.get(`/admin/career-applications/${applicationId}/cv-preview`, {
      responseType: 'arraybuffer',
      timeout: 120_000,
    })
    const contentType = String(response.headers['content-type'] || '')
    if (contentType.includes('application/pdf')) {
      return {
        mode: 'pdf',
        blob: new Blob([response.data], { type: 'application/pdf' }),
      }
    }
    if (contentType.startsWith('image/')) {
      return {
        mode: 'image',
        blob: new Blob([response.data], { type: contentType.split(';')[0] || 'image/jpeg' }),
      }
    }
    return {
      mode: 'html',
      html: new TextDecoder('utf-8').decode(response.data as ArrayBuffer),
    }
  },

  previewCareerApplicationPhoto: async (applicationId: string): Promise<Blob> => {
    const response = await apiClient.get(
      `/admin/career-applications/${applicationId}/photo-preview`,
      {
        responseType: 'arraybuffer',
        timeout: 60_000,
      },
    )
    const contentType = String(response.headers['content-type'] || 'image/jpeg')
    return new Blob([response.data], { type: contentType.split(';')[0] || 'image/jpeg' })
  },

  listWebsiteTemplates: async (params?: {
    view?: 'assigned' | 'draft' | 'all'
    search?: string
  }): Promise<AdminWebsiteTemplateListResponse> => {
    const response = await apiClient.get('/admin/website-templates', { params })
    return response.data
  },

  getWebsiteAnalytics: async (params?: {
    vendor_id?: string
    /** 'platform' = kiterp.com marketing site */
    site?: string
    business_unit_id?: string
    branch_id?: string
    days?: number
    /** Overrides days when set (e.g. 30 or 60) */
    minutes?: number
    limit?: number
  }): Promise<AdminWebsiteAnalyticsReport> => {
    const response = await apiClient.get('/admin/website-analytics', { params })
    return response.data
  },

  listVendorStores: async (vendorId: string): Promise<AdminVendorStoresResponse> => {
    const response = await apiClient.get(`/admin/vendors/${vendorId}/stores`)
    return response.data
  },

  getWebsiteTemplate: async (siteId: string): Promise<AdminWebsiteTemplateDetail> => {
    const response = await apiClient.get(`/admin/website-templates/${siteId}`)
    return response.data
  },

  publishWebsiteTemplate: async (siteId: string): Promise<AdminWebsiteTemplateDetail> => {
    const response = await apiClient.post(`/admin/website-templates/${siteId}/publish`)
    return response.data
  },

  unpublishWebsiteTemplate: async (siteId: string): Promise<AdminWebsiteTemplateDetail> => {
    const response = await apiClient.post(`/admin/website-templates/${siteId}/unpublish`)
    return response.data
  },

  syncWebsiteTemplate: async (siteId: string): Promise<AdminWebsiteTemplateDetail> => {
    const response = await apiClient.post(`/admin/website-templates/${siteId}/sync`)
    return response.data
  },

  createWebsiteTemplatePreview: async (siteId: string): Promise<AdminWebsiteTemplatePreview> => {
    const response = await apiClient.post(`/admin/website-templates/${siteId}/preview`)
    return response.data
  },

  deleteWebsiteTemplate: async (
    siteId: string,
  ): Promise<{ ok: boolean; site_id: string; message: string }> => {
    const response = await apiClient.delete(`/admin/website-templates/${siteId}`)
    return response.data
  },
}

export type AdminWebsiteTemplateBucket = 'assigned' | 'draft'

export interface AdminWebsiteTemplateStats {
  total: number
  assigned: number
  draft: number
  published: number
  needs_sync: number
}

export interface AdminWebsiteTemplateRow {
  site_id: string
  name: string
  description?: string | null
  thumbnail?: string | null
  vendor_id: string
  vendor_name: string
  vendor_email?: string | null
  site_status: string
  is_published: boolean
  storefront_assigned: boolean
  list_bucket: AdminWebsiteTemplateBucket
  page_count: number
  business_type?: string | null
  site_updated_at?: string | null
  content_updated_at?: string | null
  platform_template_id?: string | null
  platform_slug?: string | null
  catalog_status?: 'draft' | 'published' | null
  catalog_published: boolean
  needs_sync: boolean
  last_synced_at?: string | null
  catalog_published_at?: string | null
}

export interface AdminWebsiteTemplateListResponse {
  items: AdminWebsiteTemplateRow[]
  total: number
  stats: AdminWebsiteTemplateStats
}

export interface AdminWebsiteTemplateDetail extends AdminWebsiteTemplateRow {
  snapshot_preview?: {
    id?: string
    name?: string
    page_count?: number
    pages?: Array<{ title?: string; slug?: string; block_count?: number }>
  } | null
  page_titles: string[]
  note: string
}

export interface AdminWebsiteTemplatePreview {
  site_id: string
  preview_token: string
  vendor_slug?: string | null
  page_slug?: string | null
}

export interface ContactQueryItem {
  id: string
  vendor_id: string | null
  vendor_display_name?: string | null
  name: string
  email?: string | null
  phone?: string | null
  message: string
  status: string
  created_at: string | null
}

export interface ContactQueryListResponse {
  items: ContactQueryItem[]
  total: number
  page: number
  size: number
  pages: number
}

export interface CareerApplicationItem {
  id: string
  full_name: string
  email: string
  phone?: string | null
  company?: string | null
  current_role?: string | null
  experience_years?: number | null
  city?: string | null
  linkedin_url?: string | null
  cover_note?: string | null
  admin_note?: string | null
  cv_url: string
  cv_filename?: string | null
  photo_url?: string | null
  photo_filename?: string | null
  job_posting_id?: string | null
  position_title?: string | null
  status: string
  created_at: string | null
}

export interface CareerApplicationListResponse {
  items: CareerApplicationItem[]
  total: number
  page: number
  size: number
  pages: number
}

export interface OrderDisputeItem {
  id: string
  order_id: string
  order_number: string
  vendor_id: string
  dispute_type: string
  reason: string
  status: string
  amount: number | null
  created_at: string | null
}

export interface OrderDisputeListResponse {
  items: OrderDisputeItem[]
  total: number
  page: number
  size: number
  pages: number
}

export type AdminWebsiteAnalyticsPageRow = {
  path: string
  views: number
  unique_visitors: number
  active_users: number
  vendor_id?: string
  vendor_slug?: string
  vendor_name?: string
}

export type AdminWebsiteAnalyticsProductRow = {
  id: string | null
  name: string
  slug: string
  view_count: number
  image_url: string | null
  source: 'catalog' | 'journey'
  vendor_id?: string
  vendor_slug?: string
  vendor_name?: string
}

export type AdminWebsiteAnalyticsServiceRow = AdminWebsiteAnalyticsProductRow

export type AdminWebsiteAnalyticsReport = {
  summary: {
    total_page_views: number
    unique_visitors: number
    total_product_views: number
    total_service_views: number
    pages_tracked: number
    realtime_active_users: number
  }
  pages: AdminWebsiteAnalyticsPageRow[]
  products: AdminWebsiteAnalyticsProductRow[]
  services: AdminWebsiteAnalyticsServiceRow[]
  filters: {
    vendor_id?: string | null
    vendor_ids?: string[]
    business_unit_id?: string | null
    branch_id?: string | null
    days: number
    limit: number
    site?: string | null
    includes_platform?: boolean
  }
}

/** Sentinel used by Website Analytics Branch filter for kiterp.com */
export const PLATFORM_ANALYTICS_SITE_ID = '__platform__'

export type AdminStoreBrief = {
  id: string
  name: string
  code?: string | null
  unit_type: string
  parent_id?: string | null
  is_default?: boolean
  is_active?: boolean
}

export type AdminVendorStoresResponse = {
  vendor_id: string
  business_units: AdminStoreBrief[]
  branches: AdminStoreBrief[]
}
