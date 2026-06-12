import { toast } from 'sonner'
import { websiteApi } from '@/api/websites'
import { buildBuilderPublicSite } from '@/lib/builderPublicSite'
import {
  broadcastPreviewTabError,
  clearPendingPreviewTabError,
  clearPendingPreviewTabNavigate,
  rememberDraftPreviewSession,
} from '@/lib/draftPreviewSync'
import { extractApiError, isBuilderPreviewInfraFailure } from '@/lib/errorMessages'
import {
  buildVendorDraftPreviewUrl,
  navigateDraftPreviewTab,
  prepareDraftPreviewTab,
} from '@/lib/storefrontPreviewUrl'
import type { StyleConfig, WebsiteBlock, WebsitePage } from '@/types/websites'

/** Open saved builder site JSON in the draft browser preview tab (same flow as Builder toolbar). */
export async function openBuilderSiteDraftPreview(siteId: string): Promise<void> {
  clearPendingPreviewTabNavigate()
  clearPendingPreviewTabError()
  const previewTab = prepareDraftPreviewTab()

  try {
    const site = await websiteApi.getSite(siteId)
    const pages = await websiteApi.listPages(siteId)
    const blocksByPage: Record<string, WebsiteBlock[]> = {}
    await Promise.all(
      pages.map(async page => {
        blocksByPage[page.id] = await websiteApi.listBlocks(siteId, page.id)
      }),
    )
    const localStyle = (site.style_config ?? {}) as StyleConfig
    const payload = buildBuilderPublicSite(site, pages as WebsitePage[], blocksByPage, localStyle)
    const homePage = pages.find(p => p.is_homepage) ?? pages[0]
    const { preview_token } = await websiteApi.createBuilderPreview(siteId, {
      payload: payload as unknown as Record<string, unknown>,
      label: `Preview ${new Date().toLocaleString()}`,
    })
    rememberDraftPreviewSession(siteId, preview_token)
    const url = buildVendorDraftPreviewUrl(preview_token, homePage?.slug)
    const delivered = navigateDraftPreviewTab(url)
    if (!delivered) {
      try {
        await navigator.clipboard.writeText(url)
        toast.error('Pop-up blocked. Preview link copied — paste it into a new tab.', { duration: 8000 })
      } catch {
        toast.error(`Could not open preview tab. Open this URL manually: ${url}`, { duration: 12000 })
      }
    } else if (!previewTab) {
      toast.message('Preview opened in a new tab', { duration: 3000 })
    }
  } catch (err) {
    console.error('[DashboardPreview] failed:', err)
    let message: string
    if (isBuilderPreviewInfraFailure(err)) {
      message =
        'Draft preview is not available on this server (run alembic upgrade web006 on the database your API uses, then restart the API).'
    } else {
      message = extractApiError(err, 'Browser preview')
    }
    toast.error(message)
    broadcastPreviewTabError(message)
  }
}
