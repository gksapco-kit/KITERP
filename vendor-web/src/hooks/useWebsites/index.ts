import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { websiteApi } from '@/api/websites'
import { useVendorStore } from '@/stores/vendorStore'
import type { WebsiteSite, WebsitePage, WebsiteBlock, WebsiteMedia, LiveResource, LiveItem, SiteListItem } from '@/types/websites'

/** Vendor-scoped list key — avoids showing another vendor's cached sites after switch. */
export function websitesListQueryKey(vendorId?: string | null) {
  return ['websites', vendorId ?? ''] as const
}

export function pruneSiteFromWebsitesListCache(
  qc: QueryClient,
  vendorId: string | undefined,
  siteId: string,
) {
  const listKey = websitesListQueryKey(vendorId)
  qc.setQueryData<SiteListItem[]>(listKey, old => old?.filter(s => s.id !== siteId))
  qc.setQueryData<SiteListItem[]>(['websites'], old => old?.filter(s => s.id !== siteId))
  qc.removeQueries({ queryKey: ['websites', siteId] })
}

// ── Sites ─────────────────────────────────────────────────────────────────────
export function useSiteList() {
  const vendorId = useVendorStore(s => s.vendor?.id)
  return useQuery({
    queryKey: websitesListQueryKey(vendorId),
    queryFn: websiteApi.listSites,
    enabled: Boolean(vendorId),
  })
}

export function useSite(siteId: string | null) {
  return useQuery({
    queryKey: ['websites', siteId],
    queryFn: () => websiteApi.getSite(siteId!),
    enabled: !!siteId,
  })
}

export function useCreateSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WebsiteSite>) => websiteApi.createSite(data),
    onSuccess: (site) => {
      qc.setQueryData(['websites', site.id], site)
      // Only invalidate the site list — do not invalidate ['websites', site.id] or the
      // freshly primed detail cache refetches and can race with template sandbox setup.
      qc.invalidateQueries({ queryKey: ['websites'], exact: true })
    },
  })
}

export function useUpdateSite(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WebsiteSite>) => websiteApi.updateSite(siteId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['websites', siteId] })
      qc.invalidateQueries({ queryKey: ['websites'] })
    },
  })
}

export function useDeleteSite() {
  const qc = useQueryClient()
  const vendorId = useVendorStore(s => s.vendor?.id)
  return useMutation({
    mutationFn: async (siteId: string) => {
      try {
        await websiteApi.deleteSite(siteId)
      } catch (err) {
        // Idempotent — site may already be gone after a successful first delete + stale UI.
        if (isAxiosError(err) && err.response?.status === 404) return
        throw err
      }
    },
    onSuccess: (_data, siteId) => {
      pruneSiteFromWebsitesListCache(qc, vendorId, siteId)
      qc.invalidateQueries({ queryKey: ['websites'] })
      qc.invalidateQueries({ queryKey: ['websites', 'trash'] })
    },
  })
}

export function useTrashedSites(enabled = true) {
  const vendorId = useVendorStore(s => s.vendor?.id)
  return useQuery({
    queryKey: ['websites', 'trash', vendorId ?? ''],
    queryFn: websiteApi.listTrashedSites,
    enabled: Boolean(vendorId) && enabled,
    refetchOnMount: 'always',
    staleTime: 0,
    retry: 1,
  })
}

export function useRestoreSite() {
  const qc = useQueryClient()
  const vendorId = useVendorStore(s => s.vendor?.id)
  return useMutation({
    mutationFn: (siteId: string) => websiteApi.restoreSite(siteId),
    onSuccess: (site) => {
      qc.setQueryData(['websites', site.id], site)
      qc.invalidateQueries({ queryKey: ['websites'] })
      qc.invalidateQueries({ queryKey: ['websites', 'trash'] })
    },
  })
}

export function usePermanentlyDeleteSite() {
  const qc = useQueryClient()
  const vendorId = useVendorStore(s => s.vendor?.id)
  return useMutation({
    mutationFn: (siteId: string) => websiteApi.permanentlyDeleteSite(siteId),
    onSuccess: (_data, siteId) => {
      pruneSiteFromWebsitesListCache(qc, vendorId, siteId)
      qc.invalidateQueries({ queryKey: ['websites', 'trash'] })
    },
  })
}

export function usePublishSite(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => websiteApi.publishSite(siteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['websites', siteId] })
      qc.invalidateQueries({ queryKey: ['websites'] })
    },
  })
}

export function useUnpublishSite(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => websiteApi.unpublishSite(siteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['websites', siteId] })
    },
  })
}

// ── Templates ─────────────────────────────────────────────────────────────────
export function useWebsiteTemplates() {
  return useQuery({
    queryKey: ['website-templates'],
    queryFn: websiteApi.listTemplates,
    staleTime: 5 * 60 * 1000,
  })
}

export function useApplyTemplate(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (templateId: string) => websiteApi.applyTemplate(siteId, templateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId] }),
  })
}

// ── Pages ─────────────────────────────────────────────────────────────────────
export function usePages(siteId: string | null) {
  return useQuery({
    queryKey: ['websites', siteId, 'pages'],
    queryFn: () => websiteApi.listPages(siteId!),
    enabled: !!siteId,
  })
}

export function useCreatePage(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WebsitePage>) => websiteApi.createPage(siteId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId] }),
  })
}

export function useUpdatePage(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pageId, data }: { pageId: string; data: Partial<WebsitePage> }) =>
      websiteApi.updatePage(siteId, pageId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId] }),
  })
}

export function useDeletePage(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pageId: string) => websiteApi.deletePage(siteId, pageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId] }),
  })
}

// ── Blocks ────────────────────────────────────────────────────────────────────
export function useCreateBlock(siteId: string, pageId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WebsiteBlock>) => websiteApi.createBlock(siteId, pageId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId] }),
  })
}

export function useUpdateBlock(siteId: string, pageId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ blockId, data }: { blockId: string; data: Partial<WebsiteBlock> }) =>
      websiteApi.updateBlock(siteId, pageId, blockId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId] }),
  })
}

export function useDeleteBlock(siteId: string, pageId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (blockId: string) => websiteApi.deleteBlock(siteId, pageId, blockId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId] }),
  })
}

export function useReorderBlocks(siteId: string, pageId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      websiteApi.reorderBlocks(siteId, pageId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId] }),
  })
}

export function useDuplicateBlock(siteId: string, pageId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (blockId: string) => websiteApi.duplicateBlock(siteId, pageId, blockId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId] }),
  })
}

// ── Live data feeds ──────────────────────────────────────────────────────────
//
// Unified read-only binding so any builder block can consume real KITERP data
// (products, services, testimonials, team, kpis, profile, pages, ...).

export function useLiveResource(
  siteId: string | null,
  resource: LiveResource | null | undefined,
  opts?: { limit?: number; enabled?: boolean; staleTime?: number },
) {
  const enabled = !!siteId && !!resource && (opts?.enabled ?? true)
  return useQuery<{ resource: LiveResource; items: LiveItem[]; count: number }>({
    queryKey: ['websites', siteId, 'live', resource, opts?.limit],
    queryFn: () => websiteApi.getLive(siteId!, resource!, { limit: opts?.limit }),
    enabled,
    staleTime: opts?.staleTime ?? 30_000,
  })
}

export function useSubmitLiveContact(siteId: string) {
  return useMutation({
    mutationFn: (data: Parameters<typeof websiteApi.submitLiveContact>[1]) =>
      websiteApi.submitLiveContact(siteId, data),
  })
}

export function useSubmitLiveNewsletter(siteId: string) {
  return useMutation({
    mutationFn: (email: string) => websiteApi.submitLiveNewsletter(siteId, email),
  })
}

// ── Media ─────────────────────────────────────────────────────────────────────
export function useMedia(siteId: string | null) {
  return useQuery({
    queryKey: ['websites', siteId, 'media'],
    queryFn: () => websiteApi.listMedia(siteId!),
    enabled: !!siteId,
  })
}

export function useUploadMedia(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => websiteApi.uploadMedia(siteId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId, 'media'] }),
  })
}

export function useUpdateMedia(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ mediaId, filename }: { mediaId: string; filename: string }) =>
      websiteApi.updateMedia(siteId, mediaId, { filename }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId, 'media'] }),
  })
}

export function useDeleteMedia(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mediaId: string) => websiteApi.deleteMedia(siteId, mediaId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId, 'media'] }),
  })
}

// ── AI ────────────────────────────────────────────────────────────────────────
export function useAIGenerateText(siteId: string) {
  return useMutation({
    mutationFn: (data: Parameters<typeof websiteApi.aiGenerateText>[1]) =>
      websiteApi.aiGenerateText(siteId, data),
  })
}

export function useAIScreenshotToUI(siteId: string) {
  return useMutation({
    mutationFn: ({ imageBase64, websiteType }: { imageBase64: string; websiteType?: string }) =>
      websiteApi.aiScreenshotToUI(siteId, imageBase64, websiteType),
  })
}

export function useAIUrlClone(siteId: string) {
  return useMutation({
    mutationFn: ({ url, mode }: { url: string; mode?: string }) =>
      websiteApi.aiUrlClone(siteId, url, mode),
  })
}

export function useAIUxReview(siteId: string) {
  return useMutation({
    mutationFn: (pageId?: string) => websiteApi.aiUxReview(siteId, pageId),
  })
}

export function useAIGenerateImage(siteId: string) {
  return useMutation({
    mutationFn: ({ prompt, style, aspectRatio }: { prompt: string; style?: string; aspectRatio?: string }) =>
      websiteApi.aiGenerateImage(siteId, prompt, style, aspectRatio),
  })
}

export function useAIGenerateTheme(siteId: string) {
  return useMutation({
    mutationFn: (data: { brand_description: string; industry?: string; mood?: string }) =>
      websiteApi.aiGenerateTheme(siteId, data),
  })
}

export function useAIMediaAdjust(siteId: string) {
  return useMutation({
    mutationFn: ({ imageUrl, adjustments }: { imageUrl: string; adjustments: Parameters<typeof websiteApi.aiMediaAdjust>[2] }) =>
      websiteApi.aiMediaAdjust(siteId, imageUrl, adjustments),
  })
}

export function useSaveExternalUrl(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ url, label }: { url: string; label?: string }) =>
      websiteApi.saveExternalUrl(siteId, url, label),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media', siteId] }),
  })
}

export function useAIEnhancePrompt(siteId: string) {
  return useMutation({
    mutationFn: (data: Parameters<typeof websiteApi.aiEnhancePrompt>[1]) =>
      websiteApi.aiEnhancePrompt(siteId, data),
  })
}

export function useAIGenerateSEO(siteId: string) {
  return useMutation({
    mutationFn: (data: Parameters<typeof websiteApi.aiGenerateSEO>[1]) =>
      websiteApi.aiGenerateSEO(siteId, data),
  })
}

export function useAISuggestBlocks(siteId: string) {
  return useMutation({
    mutationFn: (data: Parameters<typeof websiteApi.aiSuggestBlocks>[1]) =>
      websiteApi.aiSuggestBlocks(siteId, data),
  })
}

export function useAIGenerateSite(siteId: string) {
  return useMutation({
    mutationFn: (data: Parameters<typeof websiteApi.aiGenerateSite>[1]) =>
      websiteApi.aiGenerateSite(siteId, data),
  })
}

export function useAIApplyGeneratedSite(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof websiteApi.aiApplyGeneratedSite>[1]) =>
      websiteApi.aiApplyGeneratedSite(siteId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId] }),
  })
}

// ── Redirects ─────────────────────────────────────────────────────────────────
export function useRedirects(siteId: string) {
  return useQuery({
    queryKey: ['websites', siteId, 'redirects'],
    queryFn: () => websiteApi.listRedirects(siteId),
  })
}

export function useCreateRedirect(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof websiteApi.createRedirect>[1]) =>
      websiteApi.createRedirect(siteId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId, 'redirects'] }),
  })
}

export function useUpdateRedirect(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof websiteApi.updateRedirect>[2] }) =>
      websiteApi.updateRedirect(siteId, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId, 'redirects'] }),
  })
}

export function useDeleteRedirect(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (redirectId: string) => websiteApi.deleteRedirect(siteId, redirectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId, 'redirects'] }),
  })
}

// ── Headless ──────────────────────────────────────────────────────────────────
export function useEnableHeadless(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => websiteApi.enableHeadless(siteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId] }),
  })
}

export function useDisableHeadless(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => websiteApi.disableHeadless(siteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId] }),
  })
}

// ── Form Submissions ───────────────────────────────────────────────────────────
export function useFormSubmissions(siteId: string, params?: { form_type?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['websites', siteId, 'submissions', params],
    queryFn: () => websiteApi.listFormSubmissions(siteId, params),
    enabled: !!siteId,
  })
}

export function useDeleteFormSubmission(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (submissionId: string) => websiteApi.deleteFormSubmission(siteId, submissionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites', siteId, 'submissions'] }),
  })
}
