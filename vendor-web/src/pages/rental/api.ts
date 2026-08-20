import apiClient from '@/api/client'
import type { RentalAsset, RentalAssetUnit, RentalBooking, RentalBookingUnit, RentalReturn, RentalMediaItem } from './rentalConstants'

export const rentalApi = {
  dashboard: () => apiClient.get('/vendors/me/rentals/dashboard').then((r) => r.data),

  listAssets: (params?: {
    status?: string
    category?: string
    category_id?: string
    q?: string
    is_active?: boolean
  }) =>
    apiClient
      .get('/vendors/me/rentals/assets', { params: params || {} })
      .then((r) => r.data as RentalAsset[]),

  getAsset: (id: string) =>
    apiClient.get(`/vendors/me/rentals/assets/${id}`).then((r) => r.data as RentalAsset),

  createAsset: (body: Record<string, unknown>) =>
    apiClient.post('/vendors/me/rentals/assets', body).then((r) => r.data as RentalAsset),

  updateAsset: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`/vendors/me/rentals/assets/${id}`, body).then((r) => r.data as RentalAsset),

  deleteAsset: (id: string) =>
    apiClient.delete(`/vendors/me/rentals/assets/${id}`).then((r) => r.data),

  // ── Media gallery ────────────────────────────────────────────────────────
  uploadAssetMedia: (assetId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient
      .post(`/uploads/rentals/${assetId}/media`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data as { media: RentalMediaItem[]; item: RentalMediaItem })
  },

  deleteAssetMedia: (assetId: string, mediaId: string) =>
    apiClient
      .delete(`/uploads/rentals/${assetId}/media/${mediaId}`)
      .then((r) => r.data as { media: RentalMediaItem[] }),

  setAssetMediaPrimary: (assetId: string, mediaId: string) =>
    apiClient
      .put(`/uploads/rentals/${assetId}/media/${mediaId}/primary`)
      .then((r) => r.data as { media: RentalMediaItem[] }),

  reorderAssetMedia: (assetId: string, mediaIds: string[]) =>
    apiClient
      .put(`/uploads/rentals/${assetId}/media/reorder`, { media_ids: mediaIds })
      .then((r) => r.data as { media: RentalMediaItem[] }),

  // ── Bookings ─────────────────────────────────────────────────────────────
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
    apiClient.get(`/vendors/me/rentals/assets/${assetId}/calendar`, { params: { from, to } }).then((r) => r.data as {
      days: Array<{ date: string; status: string; reserved_qty: number; available_capacity: number; detail?: string | null }>
      resources: Array<{
        id: string
        kind: 'child' | 'unit'
        label: string
        code?: string | null
        highlight?: boolean
        selectable?: boolean
        days: Array<{ date: string; status: string; reserved_qty: number; available_capacity: number; detail?: string | null }>
      }>
      resource_kind?: 'child' | 'unit' | null
    }),

  /** Flat availability for every asset/unit on a single day (date-browse mode). */
  dayAvailability: (date: string) =>
    apiClient.get('/vendors/me/rentals/availability', { params: { date } }).then((r) => r.data as {
      date: string
      items: Array<{
        id: string
        asset_id: string
        parent_asset_id?: string | null
        unit_id?: string | null
        kind: 'asset' | 'child' | 'unit'
        label: string
        code?: string | null
        status: 'available' | 'partial' | 'booked' | 'unavailable'
        reserved_qty: number
        available_capacity: number
        next_available_date?: string | null
        next_available_time?: string | null
      }>
      counts: { all: number; available: number; partial: number; booked: number; unavailable: number }
    }),

  // ── Sub-asset children (hierarchy mode) ────────────────────────────────
  listAssetChildren: (assetId: string) =>
    apiClient.get(`/vendors/me/rentals/assets/${assetId}/children`).then((r) => r.data as RentalAsset[]),

  // ── Serialized units ─────────────────────────────────────────────────────
  listAssetUnits: (assetId: string) =>
    apiClient.get(`/vendors/me/rentals/assets/${assetId}/units`).then((r) => r.data as RentalAssetUnit[]),
  createAssetUnit: (assetId: string, body: Record<string, unknown>) =>
    apiClient.post(`/vendors/me/rentals/assets/${assetId}/units`, body).then((r) => r.data as RentalAssetUnit),
  updateAssetUnit: (assetId: string, unitId: string, body: Record<string, unknown>) =>
    apiClient.patch(`/vendors/me/rentals/assets/${assetId}/units/${unitId}`, body).then((r) => r.data as RentalAssetUnit),
  deleteAssetUnit: (assetId: string, unitId: string) =>
    apiClient.delete(`/vendors/me/rentals/assets/${assetId}/units/${unitId}`).then((r) => r.data),
  bulkCreateAssetUnits: (assetId: string, body: Record<string, unknown>) =>
    apiClient.post(`/vendors/me/rentals/assets/${assetId}/units/bulk`, body).then((r) => r.data as RentalAssetUnit[]),

  // ── Booking unit assignments ──────────────────────────────────────────────
  getBookingUnits: (bookingId: string) =>
    apiClient.get(`/vendors/me/rentals/bookings/${bookingId}/units`).then((r) => r.data as RentalBookingUnit[]),
  assignUnitsToBooking: (bookingId: string, body: Record<string, unknown>) =>
    apiClient.post(`/vendors/me/rentals/bookings/${bookingId}/assign-units`, body).then((r) => r.data as RentalBookingUnit[]),
  reassignBookingUnit: (bookingId: string, fromUnitId: string, body: Record<string, unknown>) =>
    apiClient.post(`/vendors/me/rentals/bookings/${bookingId}/units/${fromUnitId}/reassign`, body).then((r) => r.data as RentalBookingUnit[]),

  // ── Return history ────────────────────────────────────────────────────────
  listReturnHistory: (bookingId: string) =>
    apiClient.get(`/vendors/me/rentals/bookings/${bookingId}/returns`).then((r) => r.data as RentalReturn[]),

  listRegistrationForms: () =>
    apiClient.get('/vendors/me/rentals/registration-forms').then((r) => r.data),
  getActiveRegistrationForm: (channel: 'staff' | 'storefront' = 'staff') =>
    apiClient
      .get('/vendors/me/rentals/registration-forms/active', { params: { channel } })
      .then((r) => r.data as { enabled: boolean; form: Record<string, unknown> | null }),
  getRegistrationForm: (id: string) =>
    apiClient.get(`/vendors/me/rentals/registration-forms/${id}`).then((r) => r.data),
  createRegistrationForm: (body: Record<string, unknown>) =>
    apiClient.post('/vendors/me/rentals/registration-forms', body).then((r) => r.data),
  updateRegistrationForm: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`/vendors/me/rentals/registration-forms/${id}`, body).then((r) => r.data),
  deleteRegistrationForm: (id: string) =>
    apiClient.delete(`/vendors/me/rentals/registration-forms/${id}`),
  listRegistrationSubmissions: (formId?: string) =>
    apiClient
      .get('/vendors/me/rentals/registration-forms/submissions', { params: formId ? { form_id: formId } : {} })
      .then((r) => r.data),
  createRegistrationSubmission: (body: Record<string, unknown>) =>
    apiClient.post('/vendors/me/rentals/registration-forms/submissions', body).then((r) => r.data),
  uploadRegistrationImage: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient
      .post('/vendors/me/rentals/registration-forms/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data as { url: string })
  },

  // ── Product linking ───────────────────────────────────────────────────────
  listProductsForRental: (search?: string) =>
    apiClient
      .get('/vendors/me/products', { params: { limit: 100, ...(search ? { search } : {}) } })
      .then((r) => (r.data?.items ?? r.data) as Array<{ id: string; name: string; sku?: string | null }>),
}
