import apiClient from './client'

export interface VendorPlatformAuditEntry {
  id: string
  actor_user_id?: string | null
  actor_email?: string | null
  action: string
  detail?: Record<string, unknown> | null
  ip?: string | null
  created_at: string
}

export interface VendorPlatformAuditListResponse {
  items: VendorPlatformAuditEntry[]
  total: number
}

export async function fetchVendorPlatformAudit(skip = 0, limit = 50) {
  const { data } = await apiClient.get<VendorPlatformAuditListResponse>(
    '/vendors/me/platform-audit',
    { params: { skip, limit } },
  )
  return data
}
