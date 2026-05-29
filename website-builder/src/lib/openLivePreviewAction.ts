import { getEmbedVendorSlug } from './embedConfig'
import {
  createLivePreviewKey,
  stashLivePreviewPayload,
} from './livePreviewTransfer'
import { openLivePreviewTab } from './openLivePreviewTab'
import { getLiveSiteUrl, persistSite } from './sitePersistence'
import { useBuilderStore } from '../store/useBuilderStore'

export const TRIGGER_LIVE_PREVIEW_MESSAGE = 'kiterp:trigger-live-preview'

function resolveLivePreviewPageSlug(): string {
  const state = useBuilderStore.getState()
  const pages = state.pages
  return (
    pages.find((p) => p.id === state.activePageId)?.slug?.trim() ||
    pages.find((p) => p.kind === 'home')?.slug?.trim() ||
    pages[0]?.slug?.trim() ||
    'home'
  )
}

let livePreviewOpening = false

/** Open storefront live preview (stash draft, then new tab on :3002). */
export function openLivePreview(): boolean {
  if (livePreviewOpening) return false
  livePreviewOpening = true

  const state = useBuilderStore.getState()
  let vendorSlug = getEmbedVendorSlug()?.trim()
  if (!vendorSlug && window.parent !== window) {
    window.parent.postMessage({ type: 'kiterp:website-builder-request-config' }, '*')
    vendorSlug = getEmbedVendorSlug()?.trim()
  }
  if (!vendorSlug) {
    livePreviewOpening = false
    alert(
      'Vendor store slug is missing. Reload Website Builder from the vendor dashboard (Website → Website Builder).',
    )
    return false
  }
  if (!state.siteConfig || state.pages.length === 0) {
    livePreviewOpening = false
    alert('Finish setup and add at least one page before opening the live preview.')
    return false
  }

  const previewKey = createLivePreviewKey()
  const stashed = stashLivePreviewPayload(previewKey, {
    siteName: state.siteName,
    siteConfig: state.siteConfig,
    pages: state.pages,
    catalog: state.catalog,
  })
  if (!stashed) {
    livePreviewOpening = false
    alert(
      'Could not send the site preview (data may be too large). Try removing very large embedded images, then try again.',
    )
    return false
  }
  persistSite(state, { immediate: true })

  const url = getLiveSiteUrl(resolveLivePreviewPageSlug(), previewKey)
  const tab = openLivePreviewTab(url)

  if (tab === 'delegated-to-parent') {
    window.setTimeout(() => {
      livePreviewOpening = false
    }, 1500)
    return true
  }

  if (!tab) {
    livePreviewOpening = false
    if (window.parent !== window) {
      alert(
        'Could not open the live preview tab. Allow pop-ups for this site, or copy the URL with Copy URL in the toolbar.',
      )
    } else {
      const openHere = confirm(
        'Your browser blocked the new tab.\n\nClick OK to open the live preview in this window instead.',
      )
      if (openHere) {
        window.location.assign(url)
      } else {
        void navigator.clipboard.writeText(url).then(() => {
          alert(`Live preview URL copied:\n${url}`)
        })
      }
    }
    return false
  }

  window.setTimeout(() => {
    livePreviewOpening = false
  }, 1500)
  return true
}

export function listenForLivePreviewTriggerFromParent(): void {
  if (typeof window === 'undefined' || window.parent === window) return

  window.addEventListener('message', (event) => {
    if (event.data?.type !== TRIGGER_LIVE_PREVIEW_MESSAGE) return
    openLivePreview()
  })
}
