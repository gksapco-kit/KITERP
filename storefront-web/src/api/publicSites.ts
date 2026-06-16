/**
 * Public Sites API client — no auth token required.
 * Consumed by the storefront BlockRenderer and VendorContext.
 */
import axios from 'axios'
import type { PublicSite, PublicPage, LiveItem } from '@/blocks/registry'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'

const API_URL = getStorefrontApiBaseUrl().replace(/\/$/, '')

const publicApi = axios.create({
  baseURL: `${API_URL}/public/sites`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

export const publicSitesApi = {
  /**
   * Synthetic site JSON for a catalog template (website builder), for
   * full browser preview on the storefront before the vendor applies the template.
   */
  getWebsiteTemplatePreview: (templateId: string): Promise<PublicSite> =>
    publicApi
      .get<PublicSite>(`/website-template/${encodeURIComponent(templateId)}/preview`)
      .then(r => r.data),

  /**
   * Fetch the published site + all pages + blocks for a subdomain.
   * Pass `branch` (business unit code or id) so each business unit resolves to
   * its own linked storefront site instead of the vendor's latest published one.
   */
  getBySubdomain: (subdomain: string, branch?: string | null): Promise<PublicSite> =>
    publicApi
      .get<PublicSite>(`/by-subdomain/${encodeURIComponent(subdomain)}`, {
        params: branch ? { branch } : undefined,
      })
      .then(r => r.data),

  /** Frozen builder snapshot (opaque token). Same JSON shape as getBySubdomain. */
  getPreviewByToken: (token: string): Promise<PublicSite> =>
    publicApi.get<PublicSite>(`/preview/by-token/${encodeURIComponent(token)}`).then(r => r.data),

  /** Fetch a single published page by slug. */
  getPage: (siteId: string, slug: string): Promise<PublicPage> =>
    publicApi.get<PublicPage>(`/${siteId}/pages/${encodeURIComponent(slug)}`).then(r => r.data),

  /** Lightweight site metadata (no blocks). */
  getSiteInfo: (siteId: string): Promise<PublicSite> =>
    publicApi.get<PublicSite>(`/${siteId}/info`).then(r => r.data),

  /** Live ERP data feed for a block type. */
  getLiveResource: (
    siteId: string,
    resource: string,
    limit = 12,
    params?: Record<string, unknown>,
  ): Promise<{ resource: string; items: LiveItem[]; count: number }> =>
    publicApi.get(`/${siteId}/live/${resource}`, { params: { limit, ...(params || {}) } }).then(r => r.data),

  /** Submit a contact form. */
  submitContact: (siteId: string, body: Record<string, unknown>): Promise<{ ok: boolean }> =>
    publicApi.post(`/${siteId}/live/contact`, body).then(r => r.data),

  /** Subscribe to newsletter. */
  submitNewsletter: (siteId: string, email: string): Promise<{ ok: boolean }> =>
    publicApi.post(`/${siteId}/live/newsletter`, { email }).then(r => r.data),

  getBookingSlots: (siteId: string, serviceId: string, bookingDate: string) =>
    publicApi
      .get(`/${siteId}/live/booking-slots`, { params: { service_id: serviceId, booking_date: bookingDate } })
      .then(r => r.data as { slots: Array<{ start_time: string; available: boolean }>; date: string }),

  createBooking: (siteId: string, body: Record<string, unknown>) =>
    publicApi.post(`/${siteId}/live/booking`, body).then(r => r.data as { ok: boolean; booking_number?: string }),
}
