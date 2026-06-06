import { isAxiosError } from 'axios'
import { websiteApi } from '@/api/websites'
import {
  recallDraftPreviewToken,
  rememberDraftPreviewToken,
} from '@/lib/draftPreviewNavigation'

const PREVIEW_SITE_KEY = 'kiterp:draft-preview-site-id'
const PREVIEW_CHANNEL = 'kiterp-draft-preview'
const PREVIEW_NAV_CHANNEL = 'kiterp-draft-preview-nav'
const PREVIEW_NAV_STORAGE_KEY = 'kiterp:pending-preview-navigate'

/** postMessage type — works in Cursor Simple Browser where BroadcastChannel may not. */
export const PREVIEW_NAV_MESSAGE_TYPE = 'kiterp-preview-navigate'

export type DraftPreviewNavigateMessage = {
  type: 'navigate'
  url: string
}

export type PreviewTabPostMessage = {
  type: typeof PREVIEW_NAV_MESSAGE_TYPE
  url: string
}

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

/** Tell an open /preview/draft?pending=1 tab to navigate (works after async API calls). */
export function broadcastPreviewTabNavigate(url: string): void {
  const target = url.trim()
  if (!target) return
  // localStorage is shared across tabs; sessionStorage is per-tab (breaks Cursor Simple Browser).
  try {
    localStorage.setItem(PREVIEW_NAV_STORAGE_KEY, target)
  } catch {
    /* private mode */
  }
  try {
    const channel = new BroadcastChannel(PREVIEW_NAV_CHANNEL)
    channel.postMessage({ type: 'navigate', url: target } satisfies DraftPreviewNavigateMessage)
    channel.close()
  } catch {
    /* BroadcastChannel unavailable */
  }
}

export function peekPendingPreviewTabNavigate(): string | null {
  try {
    return localStorage.getItem(PREVIEW_NAV_STORAGE_KEY)?.trim() || null
  } catch {
    return null
  }
}

export function clearPendingPreviewTabNavigate(): void {
  try {
    localStorage.removeItem(PREVIEW_NAV_STORAGE_KEY)
  } catch {
    /* private mode */
  }
}

export function consumePendingPreviewTabNavigate(): string | null {
  const pending = peekPendingPreviewTabNavigate()
  if (!pending) return null
  clearPendingPreviewTabNavigate()
  return pending
}

export function subscribePreviewTabNavigate(handler: (url: string) => void): () => void {
  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(PREVIEW_NAV_CHANNEL)
    channel.onmessage = (ev: MessageEvent<DraftPreviewNavigateMessage>) => {
      if (ev.data?.type === 'navigate' && typeof ev.data.url === 'string') {
        handler(ev.data.url)
      }
    }
  } catch {
    /* noop */
  }
  return () => {
    channel?.close()
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
