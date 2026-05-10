/** Present on `/me` when the user belongs to a vendor (business dashboard). */
export interface UserVendorRole {
  vendor_id: string
  role: string
  role_id?: string | null
  role_name?: string | null
  permissions?: string[]
  is_active?: boolean
}

export interface User {
  id: string
  email?: string | null
  full_name: string
  phone?: string | null
  avatar_url?: string
  is_email_verified: boolean
  is_phone_verified: boolean
  is_active: boolean
  is_superuser?: boolean
  /** When `"support"`, user may sign in to admin app with limited permissions. */
  platform_staff_role?: string | null
  /** Job function when platform_staff_role is support: sales | crm | consulting | relationship_manager | team_manager */
  platform_staff_job_role?: string | null
  platform_staff_manager_id?: string | null
  vendor_role?: UserVendorRole | null
  created_at: string
  updated_at: string
}

export interface UserCreate {
  email: string
  password: string
  full_name: string
  phone?: string
}

export interface Token {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface LoginRequest {
  email: string
  password: string
}
