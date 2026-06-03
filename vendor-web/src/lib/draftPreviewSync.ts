import { isAxiosError } from 'axios'
import { websiteApi } from '@/api/websites'
import {
  recallDraftPreviewToken,
  rememberDraftPreviewToken,
} from '@/lib/draftPreviewNavigation'

const PREVIEW_SITE_KEY = 'kiterp:draft-preview-site-id'
const PREVIEW_CHANNEL = 'kiterp-draft-preview'

export type DraftPreviewUpdateMessage = {
  type: 'updated'
  token: string
  page?: string | null
  siteId: string
}

export function rememberDraftPreviewSession(siteId: string, token: string): void {
  rememberDraftPreviewToken(token)
  try {
    sessionStorage.setItem(PREVIEW_SITE_KEY, siteId.trim())
  } catch {
    /* private mode */
  }
}

export function recallDraftPreviewSiteId(): string {
  try {
    return sessionStorage.getItem(PREVIEW_SITE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function broadcastDraftPreviewUpdated(msg: DraftPreviewUpdateMessage): void {
  try {
    const channel = new BroadcastChannel(PREVIEW_CHANNEL)
    channel.postMessage(msg)
    channel.close()
  } catch {
    /* BroadcastChannel unavailable */
  }
}

export function subscribeDraftPreviewUpdates(
  handler: (msg: DraftPreviewUpdateMessage) => void,
): () => void {
  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(PREVIEW_CHANNEL)
    channel.onmessage = (ev: MessageEvent<DraftPreviewUpdateMessage>) => {
      if (ev.data?.type === 'updated') handler(ev.data)
    }
  } catch {
    /* noop */
  }
  return () => {
    channel?.close()
  }
}

function isNotFound(err: unknown): boolean {
  return isAxiosError(err) && err.response?.status === 404
}

/** Push latest canvas JSON to the open browser-preview tab (same token when possible). */
export async function pushDraftPreviewUpdate(
  siteId: string,
  payload: Record<string, unknown>,
  pageSlug?: string | null,
): Promise<void> {
  const sessionSiteId = recallDraftPreviewSiteId()
  let token = recallDraftPreviewToken()
  if (!token || sessionSiteId !== siteId) return

  try {
    await websiteApi.updateBuilderPreview(siteId, token, { payload })
  } catch (err) {
    if (!isNotFound(err)) throw err
    const created = await websiteApi.createBuilderPreview(siteId, {
      payload,
      label: 'Preview',
    })
    token = created.preview_token
    rememberDraftPreviewSession(siteId, token)
  }

  broadcastDraftPreviewUpdated({
    type: 'updated',
    token,
    page: pageSlug ?? null,
    siteId,
  })
}
