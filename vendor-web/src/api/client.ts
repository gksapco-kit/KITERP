import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useVendorStore } from '@/stores/vendorStore'
import { normalizeLoopbackInUrl } from '@/lib/loopbackHost'

const API_URL = normalizeLoopbackInUrl(import.meta.env.VITE_API_URL || '/api/v1')

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    const vendorId = useVendorStore.getState().vendor?.id
    if (vendorId) {
      config.headers['X-Vendor-Id'] = vendorId
    }
    return config
  },
  (error) => Promise.reject(error)
)

let isRefreshing = false

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Log error details for debugging
    if (error.response) {
      console.error('API Error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        url: originalRequest?.url,
        method: originalRequest?.method,
        data: error.response.data,
        requestData: originalRequest?.data,
      })
    }

    const url = originalRequest?.url || ''
    // Any /auth/* endpoint — let the caller handle the error, never redirect
    const isAuthEndpoint = url.includes('/auth/')

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true

      if (!isRefreshing) {
        isRefreshing = true
        try {
          const refreshToken = localStorage.getItem('refresh_token')
          if (refreshToken) {
            const response = await axios.post(
              `${API_URL}/auth/refresh`,
              { refresh_token: refreshToken },
              { timeout: 15_000 },
            )
            const { access_token } = response.data
            localStorage.setItem('access_token', access_token)
            originalRequest.headers.Authorization = `Bearer ${access_token}`
            isRefreshing = false
            return apiClient(originalRequest)
          }
        } catch {
          // Refresh failed — fall through to logout redirect
        }
        isRefreshing = false
      }

      // Only redirect if not already on an auth page (login / register / forgot-password)
      const onAuthPage = /\/(login|register|forgot-password|auth\/handoff)/.test(
        window.location.pathname
      )
      if (!onAuthPage) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('vendor-auth-storage')
        localStorage.removeItem('vendor-store-data')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
