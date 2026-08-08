import axios from 'axios'
import Constants from 'expo-constants'

// Prefer explicit env, then app.config extra, then public API.
// Avoid defaulting to 10.0.2.2 — that only works on Android emulator and causes
// failures / proxy 502s on iOS and physical devices when Expo is restarted without env.
const extra = (Constants.expoConfig?.extra || {}) as { apiUrl?: string }
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  extra.apiUrl ||
  'https://kiterp.com/api/v1'

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
})

if (__DEV__) {
  console.log(`[api] baseURL = ${API_URL}`)
}

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
    description?: string; logo_url?: string;     theme_config: Record<string, any>
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
