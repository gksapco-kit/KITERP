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

function previewErrorMessage(err: unknown): string {
  if (isBuilderPreviewInfraFailure(err)) {
    return 'Draft preview is not available on this server (run alembic upgrade web006 on the database your API uses, then restart the API).'
  }
  return extractApiError(err, 'Browser preview')
}

/** Build a shareable draft-preview URL for the saved site snapshot. */
export async function resolveBuilderSiteDraftPreviewUrl(siteId: string): Promise<string> {
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
  return buildVendorDraftPreviewUrl(preview_token, homePage?.slug)
}

/** Copy the draft preview URL for a site to the clipboard. */
export async function copyBuilderSiteDraftPreviewLink(siteId: string): Promise<void> {
  try {
    const url = await resolveBuilderSiteDraftPreviewUrl(siteId)
    await navigator.clipboard.writeText(url)
    toast.success('Preview link copied!')
  } catch (err) {
    console.error('[DashboardPreviewCopy] failed:', err)
    const message = previewErrorMessage(err)
    toast.error(message)
    broadcastPreviewTabError(message)
  }
}

/** Open saved builder site JSON in the draft browser preview tab (same flow as Builder toolbar). */
export async function openBuilderSiteDraftPreview(siteId: string): Promise<void> {
  clearPendingPreviewTabNavigate()
  clearPendingPreviewTabError()
  const previewTab = prepareDraftPreviewTab()

  try {
    const url = await resolveBuilderSiteDraftPreviewUrl(siteId)
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
    const message = previewErrorMessage(err)
    toast.error(message)
    broadcastPreviewTabError(message)
  }
}
