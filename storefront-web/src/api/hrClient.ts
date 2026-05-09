import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'

const API_URL = getStorefrontApiBaseUrl()

let _vendorSlug: string | null = null
let _vendorId: string | null = null

export function setHrVendorContext(slug: string, id: string) {
  _vendorSlug = slug
  _vendorId = id
  localStorage.setItem('vendor_slug', slug)
  localStorage.setItem('vendor_id', id)
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
  const token = localStorage.getItem('employee_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const vendorSlug = _vendorSlug || localStorage.getItem('vendor_slug')
  if (vendorSlug) {
    config.headers['X-Vendor-Slug'] = vendorSlug
  }

  const vendorId = _vendorId || localStorage.getItem('vendor_id')
  if (vendorId) {
    config.headers['X-Vendor-Id'] = vendorId
  }

  return config
})

function clearHrAuthAndRedirect() {
  localStorage.removeItem('employee_access_token')
  localStorage.removeItem('employee-hr-auth-storage')
  const slug = _vendorSlug || localStorage.getItem('vendor_slug')
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
  }
)

export default hrApiClient
