import apiClient from './client'

export interface AppConfig {
  app_name?: string
  primary_color?: string
  icon_url?: string
  splash_color?: string
  bundle_id_suffix?: string
}

export interface AppBuild {
  id: string
  vendor_id: string
  platform: string
  build_profile: string
  status: string
  eas_build_id_android?: string
  eas_build_id_ios?: string
  artifact_url_android?: string
  artifact_url_ios?: string
  play_store_status?: string
  app_store_status?: string
  config_snapshot: Record<string, unknown>
  error_message?: string
  created_at?: string
  updated_at?: string
  built_at?: string
  published_at?: string
}

export interface AppBuildListResponse {
  items: AppBuild[]
  total: number
}

export const appBuildApi = {
  getAppConfig: async (vendorId: string): Promise<AppConfig> => {
    const res = await apiClient.get(`/admin/vendors/${vendorId}/app-config`)
    return res.data
  },

  updateAppConfig: async (vendorId: string, data: AppConfig): Promise<AppConfig> => {
    const res = await apiClient.put(`/admin/vendors/${vendorId}/app-config`, data)
    return res.data
  },

  triggerBuild: async (vendorId: string, platform: string = 'all'): Promise<AppBuild> => {
    const res = await apiClient.post(`/admin/vendors/${vendorId}/app-builds`, { platform })
    return res.data
  },

  listBuilds: async (params?: {
    vendor_id?: string
    status?: string
  }): Promise<AppBuildListResponse> => {
    const res = await apiClient.get('/admin/app-builds', { params })
    return res.data
  },

  getBuild: async (buildId: string): Promise<AppBuild> => {
    const res = await apiClient.get(`/admin/app-builds/${buildId}`)
    return res.data
  },

  listVendorBuilds: async (vendorId: string): Promise<AppBuildListResponse> => {
    const res = await apiClient.get('/admin/app-builds', {
      params: { vendor_id: vendorId },
    })
    return res.data
  },
}
