import {
  buildLivePreviewState,
  peekLivePreviewPayload,
  type LivePreviewPayload,
} from './livePreviewTransfer'
import { INJECT_LIVE_PREVIEW_MESSAGE } from './livePreviewMessages'
import { useBuilderStore } from '../store/useBuilderStore'

function slugFromLivePreviewPath(): string {
  const path = window.location.pathname
  const marker = '/site/'
  const idx = path.indexOf(marker)
  if (idx === -1) return 'home'
  const rest = path.slice(idx + marker.length).split('/').filter(Boolean)[0]
  return rest ? decodeURIComponent(rest) : 'home'
}

function applyPayload(payload: LivePreviewPayload): void {
  const urlSlug = slugFromLivePreviewPath()
  useBuilderStore.setState(buildLivePreviewState(payload, urlSlug))
  window.dispatchEvent(new CustomEvent('kiterp:live-preview-injected'))
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
}

/** Accept draft site pushed from storefront parent (:3002) when storage is partitioned. */
export function listenForLivePreviewInject(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type !== INJECT_LIVE_PREVIEW_MESSAGE) return
    if (!isLoopbackOrigin(event.origin) && event.origin !== window.location.origin) return

    const payload = event.data.payload as LivePreviewPayload | undefined
    if (!payload?.pages?.length || !payload.siteConfig) return
    applyPayload(payload)
  })
}

export function hydrateLivePreviewFromStorageOrWait(): 'loaded' | 'pending-inject' | 'empty' {
  const params = new URLSearchParams(window.location.search)
  const previewKey = params.get('previewKey')?.trim()
  if (previewKey) {
    const payload = peekLivePreviewPayload(previewKey)
    if (payload) {
      applyPayload(payload)
      return 'loaded'
    }
    return 'pending-inject'
  }

  return 'empty'
}
