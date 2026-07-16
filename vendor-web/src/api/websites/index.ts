import { apiClient } from '@/api/client'
import type {
  WebsiteSite, SiteListItem, WebsitePage, WebsiteBlock, WebsiteMedia,
  PageTrashItem, SiteTrashItem,
  AITextRequest, AITextResponse, AIScreenshotResponse, AIUrlCloneResponse,
  AIUxReviewResponse, AIThemeResponse, MediaAdjustments, WebsiteTemplate,
  StyleConfig, BlockProps, SiteRedirect,
  AIGenerateSiteRequest, AIGenerateSiteResponse,
  LiveResource, LiveItem, FormSubmission,
} from '@/types/websites'

const base = '/vendors/me/websites'

export type WebsiteAnalyticsPageRow = {
  path: string
  views: number
  unique_visitors: number
  active_users: number
}

export type WebsiteAnalyticsProductRow = {
  id: string | null
  name: string
  slug: string
  view_count: number
  image_url: string | null
  source: 'catalog' | 'journey'
}

export type WebsiteAnalyticsReport = {
  summary: {
    total_page_views: number
    unique_visitors: number
    total_product_views: number
    pages_tracked: number
    realtime_active_users: number
  }
  pages: WebsiteAnalyticsPageRow[]
  products: WebsiteAnalyticsProductRow[]
  filters: {
    business_unit_id: string | null
    branch_id: string | null
    days: number
    limit: number
  }
}

// ── Sites ─────────────────────────────────────────────────────────────────────
export const websiteApi = {
  // Analytics
  getAnalytics: (params?: {
    business_unit_id?: string
    branch_id?: string
    days?: number
    limit?: number
  }) =>
    apiClient
      .get<WebsiteAnalyticsReport>(`${base}/analytics`, { params })
      .then(r => r.data),

  // Sites
  listSites: () => apiClient.get<SiteListItem[]>(`${base}/`).then(r => r.data),
  createSite: (data: Partial<WebsiteSite>) => apiClient.post<WebsiteSite>(`${base}/`, data).then(r => r.data),
  getSite: (siteId: string) => apiClient.get<WebsiteSite>(`${base}/${siteId}`).then(r => r.data),
  updateSite: (siteId: string, data: Partial<WebsiteSite>) => apiClient.patch<WebsiteSite>(`${base}/${siteId}`, data).then(r => r.data),
  deleteSite: (siteId: string) => apiClient.delete(`${base}/${siteId}`),
  listTrashedSites: () => apiClient.get<SiteTrashItem[]>(`${base}/trash`).then(r => r.data),
  restoreSite: (siteId: string) => apiClient.post<WebsiteSite>(`${base}/${siteId}/restore`).then(r => r.data),
  permanentlyDeleteSite: (siteId: string) => apiClient.delete(`${base}/${siteId}/permanent`),
  publishSite: (siteId: string) => apiClient.post<WebsiteSite>(`${base}/${siteId}/publish`).then(r => r.data),
  unpublishSite: (siteId: string) => apiClient.post<WebsiteSite>(`${base}/${siteId}/unpublish`).then(r => r.data),

  // Templates
  listTemplates: () => apiClient.get<WebsiteTemplate[]>(`${base}/templates/all`).then(r => r.data),
  applyTemplate: (siteId: string, templateId: string, opts?: { pagesOnly?: boolean }) =>
    apiClient
      .post<WebsiteSite>(
        `${base}/${siteId}/apply-template/${templateId}${opts?.pagesOnly ? '?pages_only=true' : ''}`,
      )
      .then(r => r.data),
  ensureBlankSite: (siteId: string) =>
    apiClient.post<WebsiteSite>(`${base}/${siteId}/ensure-blank`).then(r => r.data),
  importSite: (payload: { export_version: number; exported_at: string; site: Record<string, unknown> }) =>
    apiClient.post<WebsiteSite>(`${base}/import`, payload).then(r => r.data),
  exportSite: (siteId: string, mode: 'static' | 'dynamic' = 'dynamic') =>
    apiClient
      .get<{ export_version: number; export_mode?: 'static' | 'dynamic'; exported_at: string; site: Record<string, unknown> }>(
        `${base}/${siteId}/export`,
        { params: { mode } },
      )
      .then(r => r.data),

  // Pages
  listPages: (siteId: string) => apiClient.get<WebsitePage[]>(`${base}/${siteId}/pages`).then(r => r.data),
  createPage: (siteId: string, data: Partial<WebsitePage>) =>
    apiClient.post<WebsitePage>(`${base}/${siteId}/pages`, data).then(r => r.data),
  updatePage: (siteId: string, pageId: string, data: Partial<WebsitePage>) =>
    apiClient.patch<WebsitePage>(`${base}/${siteId}/pages/${pageId}`, data).then(r => r.data),
  deletePage: (siteId: string, pageId: string) =>
    apiClient.delete(`${base}/${siteId}/pages/${pageId}`),
  listTrashedPages: (siteId: string) =>
    apiClient
      .get<PageTrashItem[]>(`${base}/${siteId}/pages/trash`, { timeout: 30_000 })
      .then(r => r.data),
  restorePage: (siteId: string, pageId: string) =>
    apiClient.post<WebsitePage>(`${base}/${siteId}/pages/${pageId}/restore`).then(r => r.data),
  reorderPages: (siteId: string, items: { id: string; sort_order: number }[]) =>
    apiClient.post(`${base}/${siteId}/pages/reorder`, { items }),

  // Blocks
  listBlocks: (siteId: string, pageId: string) =>
    apiClient.get<WebsiteBlock[]>(`${base}/${siteId}/pages/${pageId}/blocks`).then(r => r.data),
  createBlock: (siteId: string, pageId: string, data: Partial<WebsiteBlock>) =>
    apiClient.post<WebsiteBlock>(`${base}/${siteId}/pages/${pageId}/blocks`, data).then(r => r.data),
  updateBlock: (siteId: string, pageId: string, blockId: string, data: Partial<WebsiteBlock>) =>
    apiClient.patch<WebsiteBlock>(`${base}/${siteId}/pages/${pageId}/blocks/${blockId}`, data).then(r => r.data),
  deleteBlock: (siteId: string, pageId: string, blockId: string) =>
    apiClient.delete(`${base}/${siteId}/pages/${pageId}/blocks/${blockId}`),
  reorderBlocks: (siteId: string, pageId: string, items: { id: string; sort_order: number }[]) =>
    apiClient.post(`${base}/${siteId}/pages/${pageId}/blocks/reorder`, { items }),
  duplicateBlock: (siteId: string, pageId: string, blockId: string) =>
    apiClient.post<WebsiteBlock>(`${base}/${siteId}/pages/${pageId}/blocks/${blockId}/duplicate`).then(r => r.data),

  // AI
  aiGenerateText: (siteId: string, data: AITextRequest) =>
    apiClient.post<AITextResponse>(`${base}/${siteId}/ai/text`, data).then(r => r.data),

  aiScreenshotToUI: (siteId: string, imageBase64: string, websiteType?: string) =>
    apiClient.post<AIScreenshotResponse>(`${base}/${siteId}/ai/screenshot-to-ui`, { image_base64: imageBase64, website_type: websiteType }).then(r => r.data),

  aiUrlClone: (siteId: string, url: string, cloneMode = 'style') =>
    apiClient.post<AIUrlCloneResponse>(`${base}/${siteId}/ai/url-clone`, { url, clone_mode: cloneMode }).then(r => r.data),

  aiUxReview: (siteId: string, pageId?: string) =>
    apiClient.post<AIUxReviewResponse>(`${base}/${siteId}/ai/ux-review`, { site_id: siteId, page_id: pageId }).then(r => r.data),

  aiGenerateImage: (siteId: string, prompt: string, style = 'photorealistic', aspectRatio = '16:9') =>
    apiClient.post<{ url: string; prompt: string; style: string }>(`${base}/${siteId}/ai/generate-image`, {
      prompt, style, aspect_ratio: aspectRatio,
    }).then(r => r.data),

  aiGenerateTheme: (siteId: string, data: { brand_description: string; industry?: string; mood?: string; logo_url?: string }) =>
    apiClient.post<AIThemeResponse>(`${base}/${siteId}/ai/generate-theme`, data).then(r => r.data),

  aiMediaAdjust: (siteId: string, imageUrl: string, adjustments: MediaAdjustments) =>
    apiClient.post<{ adjusted_url: string; adjustments_applied: MediaAdjustments }>(`${base}/${siteId}/ai/media-adjust`, {
      image_url: imageUrl, adjustments,
    }).then(r => r.data),

  aiEnhancePrompt: (siteId: string, data: {
    prompt: string; style?: string; block_context?: string; site_description?: string
  }) => apiClient.post<{
    enhanced_prompt: string; negative_prompt: string; style_suggestion: string; tips: string[]
  }>(`${base}/${siteId}/ai/enhance-prompt`, data).then(r => r.data),

  aiGenerateSEO: (siteId: string, data: {
    page_title: string; page_type?: string; site_description?: string; keywords_hint?: string
  }) => apiClient.post<{
    seo_title: string; seo_description: string; seo_keywords: string
    og_title: string; og_description: string; focus_keyword: string; readability_tips: string[]
  }>(`${base}/${siteId}/ai/seo`, data).then(r => r.data),

  aiSuggestBlocks: (siteId: string, data: {
    page_type: string; industry?: string; goal?: string
  }) => apiClient.post<{
    blocks: { block_type: string; label: string; reason: string }[]
    reasoning: string; estimated_sections: number
  }>(`${base}/${siteId}/ai/suggest-blocks`, data).then(r => r.data),

  // Backend may call OpenAI with up to ~90s; default axios timeout (15s) would abort and leave the builder empty.
  aiGenerateSite: (siteId: string, data: AIGenerateSiteRequest) =>
    apiClient.post<AIGenerateSiteResponse>(`${base}/${siteId}/ai/generate-site`, data, { timeout: 120_000 }).then(r => r.data),

  aiApplyGeneratedSite: (siteId: string, data: AIGenerateSiteResponse) =>
    apiClient.post<WebsiteSite>(`${base}/${siteId}/ai/apply-generated-site`, data, { timeout: 90_000 }).then(r => r.data),

  // Sitemap
  getSitemap: (siteId: string) =>
    apiClient.get<string>(`${base}/${siteId}/sitemap.xml`, { responseType: 'text' }).then(r => r.data),

  // Redirects
  listRedirects: (siteId: string) =>
    apiClient.get<SiteRedirect[]>(`${base}/${siteId}/redirects`).then(r => r.data),
  createRedirect: (siteId: string, data: Omit<SiteRedirect, 'id' | 'site_id' | 'hit_count' | 'created_at'>) =>
    apiClient.post<SiteRedirect>(`${base}/${siteId}/redirects`, data).then(r => r.data),
  updateRedirect: (siteId: string, redirectId: string, data: Partial<SiteRedirect>) =>
    apiClient.patch<SiteRedirect>(`${base}/${siteId}/redirects/${redirectId}`, data).then(r => r.data),
  deleteRedirect: (siteId: string, redirectId: string) =>
    apiClient.delete(`${base}/${siteId}/redirects/${redirectId}`),

  // Headless
  enableHeadless: (siteId: string) =>
    apiClient.post<WebsiteSite>(`${base}/${siteId}/headless/enable`).then(r => r.data),
  disableHeadless: (siteId: string) =>
    apiClient.post<WebsiteSite>(`${base}/${siteId}/headless/disable`).then(r => r.data),

  // Live data feeds (unified read-only endpoint the builder's blocks bind to).
  getLive: <T = LiveItem>(siteId: string, resource: LiveResource, params?: { limit?: number }) =>
    apiClient.get<{ resource: LiveResource; items: T[]; count: number; site_id: string; vendor_id: string }>(
      `${base}/${siteId}/live/${resource}`,
      { params },
    ).then(r => r.data),

  submitLiveContact: (siteId: string, data: { name?: string; email?: string; phone?: string; message?: string; [k: string]: unknown }) =>
    apiClient.post<{ ok: boolean; lead_id?: string | null }>(`${base}/${siteId}/live/contact`, data).then(r => r.data),

  submitLiveNewsletter: (siteId: string, email: string) =>
    apiClient.post<{ ok: boolean; email: string; subscribed_at: string }>(`${base}/${siteId}/live/newsletter`, { email }).then(r => r.data),

  // Form Submissions inbox
  listFormSubmissions: (siteId: string, params?: { form_type?: string; limit?: number; offset?: number }) =>
    apiClient.get<{ submissions: FormSubmission[]; total: number }>(`${base}/${siteId}/forms/submissions`, { params }).then(r => r.data),
  deleteFormSubmission: (siteId: string, submissionId: string) =>
    apiClient.delete(`${base}/${siteId}/forms/submissions/${submissionId}`),

  // Media
  listMedia: (siteId: string) => apiClient.get<WebsiteMedia[]>(`${base}/${siteId}/media`).then(r => r.data),
  uploadMedia: (siteId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient.post<WebsiteMedia>(`${base}/${siteId}/media`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  saveExternalUrl: (siteId: string, url: string, label?: string) =>
    apiClient.post<WebsiteMedia>(`${base}/${siteId}/media/save-url`, { url, label }).then(r => r.data),
  updateMedia: (siteId: string, mediaId: string, data: { filename: string }) =>
    apiClient.patch<WebsiteMedia>(`${base}/${siteId}/media/${mediaId}`, data).then(r => r.data),
  deleteMedia: (siteId: string, mediaId: string) =>
    apiClient.delete(`${base}/${siteId}/media/${mediaId}`),

  /** Full-site JSON snapshot for storefront draft preview (tokened public read). */
  createBuilderPreview: (siteId: string, body: { payload: Record<string, unknown>; label?: string }) =>
    apiClient
      .post<{ id: string; preview_token: string; label: string | null; created_at: string | null }>(
        `${base}/${siteId}/builder-previews`,
        body,
        { timeout: 120_000 },
      )
      .then(r => r.data),
  updateBuilderPreview: (
    siteId: string,
    token: string,
    body: { payload: Record<string, unknown>; label?: string },
  ) =>
    apiClient
      .put<{ id: string; preview_token: string; label: string | null; created_at: string | null }>(
        `${base}/${siteId}/builder-previews/${encodeURIComponent(token)}`,
        body,
        { timeout: 120_000 },
      )
      .then(r => r.data),
  listBuilderPreviews: (siteId: string) =>
    apiClient
      .get<{ id: string; preview_token: string; label: string | null; created_at: string | null }[]>(
        `${base}/${siteId}/builder-previews`,
      )
      .then(r => r.data),

  domainVerifyInit: (siteId: string, customDomain: string) =>
    apiClient
      .post<{
        custom_domain: string
        verification_token: string
        dns_record_type: string
        dns_record_name: string
        dns_record_value: string
        instructions: string
      }>(`${base}/${siteId}/domains/verify-init`, { custom_domain: customDomain })
      .then(r => r.data),

  domainVerifyCheck: (siteId: string) =>
    apiClient
      .post<{
        verified: boolean
        custom_domain?: string
        dns_record_name?: string
        message?: string
      }>(`${base}/${siteId}/domains/verify-check`)
      .then(r => r.data),
}
