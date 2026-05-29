/** Parent vendor page opens live preview (iframe popups are often blocked). */
export const OPEN_LIVE_PREVIEW_MESSAGE = 'kiterp:open-live-preview'

export type OpenLivePreviewTabResult = Window | null | 'delegated-to-parent'

/**
 * Open live preview URL.
 * When embedded in vendor iframe, only the parent opens the tab (never window.open here — that causes duplicate tabs).
 */
export function openLivePreviewTab(url: string): OpenLivePreviewTabResult {
  if (typeof window === 'undefined') return null

  if (window.parent !== window) {
    try {
      window.parent.postMessage({ type: OPEN_LIVE_PREVIEW_MESSAGE, url }, '*')
      return 'delegated-to-parent'
    } catch {
      return null
    }
  }

  return window.open(url, '_blank', 'noreferrer')
}
