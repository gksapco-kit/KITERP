import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'
import { vendorSlugFromLocation } from '@/lib/vendorScope'
import { safeLocalGet, safeLocalRemove, safeSessionSet } from '@/lib/safeStorage'

const API_URL = getStorefrontApiBaseUrl()

let _vendorSlug: string | null = null
let _vendorId: string | null = null

export function setHrVendorContext(slug: string, id: string) {
  _vendorSlug = slug.trim()
  _vendorId = id.trim()
  safeSessionSet('vendor_slug', _vendorSlug)
  safeSessionSet('vendor_id', _vendorId)
  safeLocalRemove('vendor_slug')
  safeLocalRemove('vendor_id')
}

export const hrApiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

hrApiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

hrApiClient.interceptors.request.use((config) => {
  const token = safeLocalGet('employee_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const urlSlug = vendorSlugFromLocation()
  const vendorSlug = urlSlug || _vendorSlug
  if (vendorSlug) {
    config.headers['X-Vendor-Slug'] = vendorSlug
  }

  // Only send id when it matches this tab's slug (avoid cross-tab localStorage bleed).
  if (_vendorId && _vendorSlug && (!urlSlug || _vendorSlug === urlSlug)) {
    config.headers['X-Vendor-Id'] = _vendorId
  }

  return config
})

function clearHrAuthAndRedirect() {
  safeLocalRemove('employee_access_token')
  safeLocalRemove('employee-hr-auth-storage')
  const slug = vendorSlugFromLocation() || _vendorSlug
  window.location.href = slug ? `/store/${slug}/hr/login` : '/'
}

hrApiClient.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      clearHrAuthAndRedirect()
    }
    return Promise.reject(error)
  },
)

export default hrApiClient
