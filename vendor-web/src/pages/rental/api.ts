import apiClient from '@/api/client'
import type { RentalAsset, RentalBooking } from './rentalConstants'

export const rentalApi = {
  dashboard: () => apiClient.get('/vendors/me/rentals/dashboard').then((r) => r.data),
  listAssets: (status?: string) =>
    apiClient.get('/vendors/me/rentals/assets', { params: status ? { status } : {} }).then((r) => r.data),
  getAsset: (id: string) =>
    apiClient.get(`/vendors/me/rentals/assets/${id}`).then((r) => r.data as RentalAsset),
  createAsset: (body: Record<string, unknown>) =>
    apiClient.post('/vendors/me/rentals/assets', body).then((r) => r.data),
  updateAsset: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`/vendors/me/rentals/assets/${id}`, body).then((r) => r.data),
  listBookings: (status?: string) =>
    apiClient.get('/vendors/me/rentals/bookings', { params: status ? { status } : {} }).then((r) => r.data),
  createBooking: (body: Record<string, unknown>) =>
    apiClient.post('/vendors/me/rentals/bookings', body).then((r) => r.data as RentalBooking),
  updateBooking: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`/vendors/me/rentals/bookings/${id}`, body).then((r) => r.data),
  recordPayment: (id: string, body: Record<string, unknown>) =>
    apiClient.post(`/vendors/me/rentals/bookings/${id}/payment`, body).then((r) => r.data),
  updateDelivery: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`/vendors/me/rentals/bookings/${id}/delivery`, body).then((r) => r.data),
  processReturn: (id: string, body: Record<string, unknown>) =>
    apiClient.post(`/vendors/me/rentals/bookings/${id}/return`, body).then((r) => r.data),
  calendar: (assetId: string, from: string, to: string) =>
    apiClient.get(`/vendors/me/rentals/assets/${assetId}/calendar`, { params: { from, to } }).then((r) => r.data),
}
