export type BusinessType = 
  | 'individual'
  | 'partnership'
  | 'llc'
  | 'corporation'
  | 'proprietorship'

export type VendorStatus = 
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'deactivated'

export type VerificationStatus = 
  | 'pending'
  | 'documents_submitted'
  | 'verified'
  | 'rejected'

export type DocumentType = 
  | 'business_registration'
  | 'tax_id'
  | 'id_proof'
  | 'address_proof'
  | 'bank_proof'

export type DocumentStatus = 'pending' | 'approved' | 'rejected'

export type AccountType = 'savings' | 'current'

export interface Address {
  street_address: string
  city: string
  state: string
  postal_code: string
  country: string
  latitude?: number
  longitude?: number
  service_radius_km: number
}

export interface VendorCreate {
  business_name: string
  display_name: string
  slug: string
  business_type: BusinessType
  industry: string
  description?: string
  primary_email: string
  primary_phone: string
  owner_name: string
  logo_url?: string
  banner_url?: string
  address: Address
}

export interface VendorUpdate {
  display_name?: string
  description?: string
  primary_email?: string
  primary_phone?: string
  support_email?: string
  support_phone?: string
  gstin?: string
  pan_number?: string
  is_gst_registered?: boolean
  default_tax_rate?: number
  logo_url?: string
  banner_url?: string
  business_hours?: Record<string, unknown>
  social_links?: Record<string, string>
  settings?: Record<string, unknown>
  latitude?: number
  longitude?: number
  street_address?: string
  city?: string
  state?: string
  postal_code?: string
  service_radius_km?: number
}

export type ExternalDomainAccessStatus = 'not_requested' | 'pending' | 'active' | 'revoked'

export interface Vendor {
  id: string
  business_name: string
  display_name: string
  slug: string
  subdomain: string
  business_type: BusinessType
  offering_type?: string
  industry?: string
  description?: string
  primary_email: string
  primary_phone: string
  support_email?: string
  support_phone?: string
  street_address?: string
  city?: string
  state?: string
  postal_code?: string
  country: string
  latitude?: number
  longitude?: number
  service_radius_km: number
  gstin?: string
  pan_number?: string
  is_gst_registered: boolean
  default_tax_rate?: number
  logo_url?: string
  banner_url?: string
  settings?: Record<string, unknown>
  status: VendorStatus
  verification_status: VerificationStatus
  verified_at?: string
  activated_at?: string
  created_at: string
  updated_at: string
  // External domain
  external_domain_enabled?: boolean
  external_domain_scope?: 'all' | 'per_unit'
  external_domain_name?: string | null
  external_domain_registrar?: string | null
  external_domain_reg_email?: string | null
  external_domain_holder?: string | null
  external_domain_expiry?: string | null
  external_domain_access_status?: ExternalDomainAccessStatus
  external_domain_recovery_contact?: string | null
  external_domain_notes?: string | null
}

export interface VendorDocument {
  id: string
  vendor_id: string
  document_type: DocumentType
  file_url: string
  file_name?: string
  file_size?: number
  mime_type?: string
  status: DocumentStatus
  rejection_reason?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
}

export interface BankAccountCreate {
  bank_name: string
  account_number: string
  account_holder_name: string
  ifsc_code: string
  account_type: AccountType
  is_primary: boolean
}

export interface BankAccount {
  id: string
  vendor_id: string
  bank_name: string
  account_number: string
  account_holder_name: string
  ifsc_code: string
  account_type: AccountType
  is_primary: boolean
  is_verified: boolean
  verified_at?: string
  created_at: string
}

export interface SlugCheckResponse {
  available: boolean
  suggestions?: string[]
}

export interface NearbyVendor {
  id: string
  business_name: string
  display_name: string
  slug: string
  subdomain: string
  offering_type: string
  industry?: string
  description?: string
  logo_url?: string
  city?: string
  state?: string
  latitude?: number
  longitude?: number
  service_radius_km: number
  distance_km: number
  status: VendorStatus
}

export interface NearbyVendorListResponse {
  items: NearbyVendor[]
  total: number
  page: number
  size: number
  pages: number
  user_location: { latitude: number; longitude: number }
}

export interface VendorDistanceResponse {
  vendor_slug: string
  distance_km: number | null
  within_radius: boolean
  service_radius_km: number
  vendor_location?: { latitude: number; longitude: number }
  message?: string
}
