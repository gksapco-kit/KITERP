import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useVendorStore } from '@/stores/vendorStore'
import { resolveApiBaseUrl } from '@/lib/apiBase'
import { isAxiosNetworkError } from '@/lib/errorMessages'
import {
  clearAuthSessionAndRedirectToLogin,
  refreshAuthSessionDeduped,
  shouldSkipTokenRefresh,
} from '@/lib/authSession'
import { getAccessToken } from '@/lib/authTokenStorage'

const API_URL = resolveApiBaseUrl()

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
    const token = getAccessToken()
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
    const skipRefresh = shouldSkipTokenRefresh(url)

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !skipRefresh) {
      originalRequest._retry = true

      try {
        const refreshed = await refreshAuthSessionDeduped()
        if (refreshed) {
          const token = getAccessToken()
          if (token) {
            originalRequest.headers.Authorization = `Bearer ${token}`
          }
          return apiClient(originalRequest)
        }
      } catch (refreshErr) {
        if (isAxiosNetworkError(refreshErr)) {
          return Promise.reject(error)
        }
      }

      clearAuthSessionAndRedirectToLogin()
    }

    // Backend reload / proxy blip — never treat as logout.
    if (isAxiosNetworkError(error)) {
      return Promise.reject(error)
    }
    return Promise.reject(error)
  }
)

export default apiClient
