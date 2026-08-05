import axios from 'axios'

// Release APKs must hit the public API. 10.0.2.2 only works on Android emulator.
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__ ? 'http://10.0.2.2:8000/api/v1' : 'https://kiterp.com/api/v1')

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Token and vendor context set by the auth store
let currentToken: string | null = null
let currentVendorId: string | null = null
let currentVendorSlug: string | null = null

export function setAuthToken(token: string | null) {
  currentToken = token
}

export function setVendorId(vendorId: string | null) {
  currentVendorId = vendorId
}

export function setVendorSlug(slug: string | null) {
  currentVendorSlug = slug
}

/** Resolve a vendor by slug and return its data */
export async function resolveVendorBySlug(slug: string) {
  const res = await apiClient.get(`/catalog/vendor/${slug}`)
  return res.data as {
    id: string; business_name: string; display_name: string; slug: string
    description?: string; logo_url?: string; theme_config: Record<string, string>
    settings: Record<string, unknown>
  }
}

apiClient.interceptors.request.use((config) => {
  if (currentToken) config.headers.Authorization = `Bearer ${currentToken}`
  // SaaS: send both slug and ID for vendor context
  if (currentVendorSlug) config.headers['X-Vendor-Slug'] = currentVendorSlug
  if (currentVendorId) config.headers['X-Vendor-Id'] = currentVendorId
  return config
})

export default apiClient
