import { isAxiosError } from 'axios'
import { websiteApi } from '@/api/websites'
import {
  recallDraftPreviewToken,
  rememberDraftPreviewToken,
} from '@/lib/draftPreviewNavigation'
import { normalizeLoopbackHostname } from '@/lib/loopbackHost'

const PREVIEW_SITE_KEY = 'kiterp:draft-preview-site-id'
const PREVIEW_CHANNEL = 'kiterp-draft-preview'
const PREVIEW_NAV_CHANNEL = 'kiterp-draft-preview-nav'
export const PREVIEW_NAV_STORAGE_KEY = 'kiterp:pending-preview-navigate'
export const PREVIEW_ERROR_STORAGE_KEY = 'kiterp:pending-preview-error'

/** postMessage type — works in Cursor Simple Browser where BroadcastChannel may not. */
export const PREVIEW_NAV_MESSAGE_TYPE = 'kiterp-preview-navigate'

export type DraftPreviewNavigateMessage = {
  type: 'navigate'
  url: string
}

export type DraftPreviewErrorMessage = {
  type: 'preview-error'
  message: string
}

export type PreviewTabPostMessage = {
  type: typeof PREVIEW_NAV_MESSAGE_TYPE
  url?: string
  /** Catalog segment for /preview/draft?route=… when embedded storefront navigates in preview. */
  route?: string
}

function canonicalizePreviewNavigateUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  try {
    const u = new URL(trimmed)
    u.hostname = normalizeLoopbackHostname(u.hostname)
    if (typeof window !== 'undefined' && window.location.port) {
      u.port = window.location.port
    }
    return u.toString()
  } catch {
    return trimmed
  }
}

/** True when two draft preview shell URLs point at the same token/page/route. */
export function draftPreviewNavigateTargetsMatch(a: string, b: string): boolean {
  try {
    const left = new URL(canonicalizePreviewNavigateUrl(a))
    const right = new URL(canonicalizePreviewNavigateUrl(b))
    const normPath = (p: string) => p.replace(/\/+$/, '') || '/'
    if (normPath(left.pathname) !== normPath(right.pathname)) return false
    for (const key of ['token', 'page', 'route'] as const) {
      if ((left.searchParams.get(key) || '') !== (right.searchParams.get(key) || '')) return false
    }
    return Boolean(left.searchParams.get('token')?.trim())
  } catch {
    return a.trim() === b.trim()
  }
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
  const target = canonicalizePreviewNavigateUrl(url)
  if (!target) return
  // A successful navigate supersedes any earlier error.
  clearPendingPreviewTabError()
  const existing = peekPendingPreviewTabNavigate()
  if (existing && draftPreviewNavigateTargetsMatch(existing, target)) {
    try {
      const channel = new BroadcastChannel(PREVIEW_NAV_CHANNEL)
      channel.postMessage({ type: 'navigate', url: target } satisfies DraftPreviewNavigateMessage)
      channel.close()
    } catch {
      /* BroadcastChannel unavailable */
    }
    return
  }
  // localStorage is shared across tabs on the same origin (canonical 127.0.0.1 in dev).
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

/** Tell the pending preview tab the builder failed to produce a snapshot. */
export function broadcastPreviewTabError(message: string): void {
  const msg = message.trim() || 'Preview could not be prepared.'
  try {
    localStorage.setItem(PREVIEW_ERROR_STORAGE_KEY, msg)
  } catch {
    /* private mode */
  }
  try {
    const channel = new BroadcastChannel(PREVIEW_NAV_CHANNEL)
    channel.postMessage({ type: 'preview-error', message: msg })
    channel.close()
  } catch {
    /* BroadcastChannel unavailable */
  }
}

export function peekPendingPreviewTabError(): string | null {
  try {
    return localStorage.getItem(PREVIEW_ERROR_STORAGE_KEY)?.trim() || null
  } catch {
    return null
  }
}

export function clearPendingPreviewTabError(): void {
  try {
    localStorage.removeItem(PREVIEW_ERROR_STORAGE_KEY)
  } catch {
    /* private mode */
  }
}

export function subscribePreviewTabNavigate(handler: (url: string) => void): () => void {
  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(PREVIEW_NAV_CHANNEL)
    channel.onmessage = (ev: MessageEvent<DraftPreviewNavigateMessage | DraftPreviewErrorMessage>) => {
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

export function subscribePreviewTabError(handler: (message: string) => void): () => void {
  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(PREVIEW_NAV_CHANNEL)
    channel.onmessage = (ev: MessageEvent<DraftPreviewNavigateMessage | DraftPreviewErrorMessage>) => {
      if (ev.data?.type === 'preview-error' && typeof ev.data.message === 'string') {
        handler(ev.data.message)
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
