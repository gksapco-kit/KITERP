import {
  broadcastPreviewTabNavigate,
  draftPreviewNavigateTargetsMatch,
  PREVIEW_NAV_MESSAGE_TYPE,
  PREVIEW_SITE_QUERY_PARAM,
} from '@/lib/draftPreviewSync'
import { isSameLoopbackOrigin, normalizeLoopbackHostname, normalizeLoopbackOrigin } from '@/lib/loopbackHost'

/** True when the dashboard is opened on a loopback host (vite dev, vite preview, etc.). */
function isLoopbackDashboardHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

/** Re-export for callers that already import from this module. */
export { normalizeLoopbackHostname }

/** Current vendor panel origin with loopback hostname normalized (port 3001 in local dev). */
export function getVendorPanelOrigin(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3001'
  const host = normalizeLoopbackHostname(window.location.hostname)
  const port = window.location.port
  const portSuffix = port ? `:${port}` : ''
  return `${window.location.protocol}//${host}${portSuffix}`
}

export function shouldUseLocalStorefrontUrls(): boolean {
  return import.meta.env.DEV || isLoopbackDashboardHost()
}

/**
 * Base URL of the business front SPA (no trailing slash).
 * - VITE_STOREFRONT_URL when set
 * - dev: same host, port 3002
 * - prod: current origin
 */
export function getStorefrontAppOrigin(): string {
  const fromEnv = (import.meta.env.VITE_STOREFRONT_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (shouldUseLocalStorefrontUrls()) {
    const host = typeof window !== 'undefined'
      ? normalizeLoopbackHostname(window.location.hostname)
      : '127.0.0.1'
    return `${typeof window !== 'undefined' ? window.location.protocol : 'http:'}//${host}:3002`
  }
  return window.location.origin.replace(/\/$/, '')
}

/**
 * Public customer store URL for this vendor (no trailing slash).
 * - VITE_STOREFRONT_URL: `{env}/{slug}`
 * - local dev/preview on localhost: `{protocol}//{host}:3002/{slug}`
 * - prod without env: `https://{slug}.kiterp.com`
 */
export function getCustomerStorefrontBaseUrl(vendorSlug: string): string {
  const slug = vendorSlug.trim()
  const fromEnv = (import.meta.env.VITE_STOREFRONT_URL as string | undefined)?.trim()
  if (fromEnv) return `${fromEnv.replace(/\/$/, '')}/${encodeURIComponent(slug)}`
  if (shouldUseLocalStorefrontUrls()) {
    const host = normalizeLoopbackHostname(window.location.hostname)
    return `${window.location.protocol}//${host}:3002/${encodeURIComponent(slug)}`
  }
  return `https://${slug}.kiterp.com`
}

/** Router-relative draft preview path (basename applied by React Router in prod). */
export const DRAFT_BROWSER_PREVIEW_PATH = '/preview/draft'

/**
 * Full browser pathname for draft preview, including Vite base (e.g. `/vendor/preview/draft` in prod).
 * Use for window.open, URL(), and window.location.pathname checks — not for React Router `Link to`.
 */
export function getDraftBrowserPreviewAbsolutePath(): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  if (!base || base === '/') return DRAFT_BROWSER_PREVIEW_PATH
  return `${base}${DRAFT_BROWSER_PREVIEW_PATH}`
}

/** True when `pathname` is the vendor-web draft preview shell (includes /vendor base in prod). */
export function matchesDraftPreviewBrowserPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  const draft = getDraftBrowserPreviewAbsolutePath().replace(/\/+$/, '') || '/'
  return path === draft || path.startsWith(`${draft}/`)
}

/** Query flag while the builder awaits the preview API (same-origin loading shell). */
export const DRAFT_PREVIEW_PENDING_PARAM = 'pending'

/**
 * Origin for preview tabs opened from this browser session.
 * Always canonicalize loopback (127.0.0.1) so builder + preview share one origin.
 */
export function getVendorPreviewOrigin(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3001'
  const { protocol, port } = window.location
  const hostname = normalizeLoopbackHostname(window.location.hostname)
  const portSuffix = port ? `:${port}` : ''
  return `${protocol}//${hostname}${portSuffix}`
}

/** Rewrite preview URLs to the canonical vendor-web origin (loopback → 127.0.0.1). */
export function alignPreviewUrlWithCurrentHost(previewShellUrl: string): string {
  if (typeof window === 'undefined') return previewShellUrl
  try {
    const url = new URL(previewShellUrl)
    url.protocol = window.location.protocol
    url.hostname = normalizeLoopbackHostname(window.location.hostname)
    if (window.location.port) url.port = window.location.port
    else url.port = ''
    return url.toString()
  } catch {
    return previewShellUrl
  }
}

/** Draft preview URL on vendor-web only: /preview/draft?token=…&page=…&siteId=… */
export function buildVendorDraftPreviewUrl(
  previewToken: string,
  pageSlug?: string | null,
  siteId?: string | null,
): string {
  const url = new URL(getDraftBrowserPreviewAbsolutePath(), getVendorPreviewOrigin())
  url.searchParams.set('token', previewToken)
  const slug = pageSlug?.trim()
  if (slug && slug.length > 0 && slug.toLowerCase() !== 'home') {
    url.searchParams.set('page', slug)
  }
  const scope = siteId?.trim()
  if (scope) url.searchParams.set(PREVIEW_SITE_QUERY_PARAM, scope)
  return url.toString()
}

/** Read siteId from a draft-preview shell URL (pending or token). */
export function extractPreviewSiteIdFromUrl(previewShellUrl: string): string {
  try {
    return new URL(previewShellUrl, typeof window !== 'undefined' ? window.location.href : undefined)
      .searchParams.get(PREVIEW_SITE_QUERY_PARAM)?.trim() ?? ''
  } catch {
    return ''
  }
}

/** Same origin rules as template gallery; path matches storefront draft preview route. */
export function buildBuilderDraftPreviewUrl(
  vendorSlug: string,
  previewToken: string,
  activePageSlug?: string | null,
): string {
  const origin = getStorefrontAppOrigin()
  const slug = activePageSlug?.trim()
  const suffix =
    slug && slug.length > 0 && slug.toLowerCase() !== 'home'
      ? `/${slug.replace(/^\/+/, '')}`
      : ''
  return `${origin}/${encodeURIComponent(vendorSlug)}/preview/${encodeURIComponent(previewToken)}${suffix}`
}

/**
 * Template gallery: wrap business-front template URL in vendor preview shell (iframe).
 * Builder draft preview uses buildVendorDraftPreviewUrl instead.
 */
export function wrapStorefrontPreviewForVendorBrowser(storefrontPreviewUrl: string): string {
  if (typeof window === 'undefined') return storefrontPreviewUrl
  if (!shouldUseLocalStorefrontUrls()) return storefrontPreviewUrl
  const shell = new URL(getDraftBrowserPreviewAbsolutePath(), getVendorPreviewOrigin())
  shell.searchParams.set('target', storefrontPreviewUrl)
  return shell.toString()
}

/**
 * Scope for template-gallery previews (no wb site id).
 * Kept separate from site draft windows so catalog previews cannot steal a site tab.
 */
export const PREVIEW_TEMPLATE_SCOPE = 'template'

/** @deprecated Use previewWindowNameForSite — legacy unscoped name caused cross-site tab reuse. */
export const PREVIEW_WINDOW_NAME = 'kiterp-draft-preview'

/** Stable window.name per site so Nursery / Sweet Mohona keep separate preview tabs. */
export function previewWindowNameForSite(siteId: string): string {
  const scope = siteId.trim() || PREVIEW_TEMPLATE_SCOPE
  return `kiterp-draft-preview-${scope.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

/** Pending shell asks the builder tab to re-deliver the preview URL (handles load race). */
export const PREVIEW_PENDING_READY_TYPE = 'kiterp-preview-pending-ready'

type PreviewSlot = {
  windowRef: Window | null
  prepareActive: boolean
  lastNavigateUrl: string | null
  retryIntervalId: ReturnType<typeof setInterval> | null
}

const previewSlots = new Map<string, PreviewSlot>()

function getPreviewSlot(siteId: string): PreviewSlot {
  const scope = siteId.trim() || PREVIEW_TEMPLATE_SCOPE
  let slot = previewSlots.get(scope)
  if (!slot) {
    slot = {
      windowRef: null,
      prepareActive: false,
      lastNavigateUrl: null,
      retryIntervalId: null,
    }
    previewSlots.set(scope, slot)
  }
  return slot
}

function stopPreviewDeliveryRetries(siteId: string): void {
  const slot = getPreviewSlot(siteId)
  if (slot.retryIntervalId != null) {
    window.clearInterval(slot.retryIntervalId)
    slot.retryIntervalId = null
  }
}

function previewTabShowsUrl(tab: Window, url: string): boolean {
  try {
    return draftPreviewNavigateTargetsMatch(tab.location.href, url)
  } catch {
    return false
  }
}

function deliverPreviewNavigateUrl(url: string, siteId: string): void {
  const scope = siteId.trim()
  if (!scope) return
  const target = alignPreviewUrlWithCurrentHost(url)
  const slot = getPreviewSlot(scope)
  broadcastPreviewTabNavigate(target, scope)
  if (slot.windowRef && !slot.windowRef.closed) {
    try {
      const targetOrigin = new URL(target).origin
      if (isSameLoopbackOrigin(window.location.origin, targetOrigin)) {
        if (previewTabShowsUrl(slot.windowRef, target)) {
          stopPreviewDeliveryRetries(scope)
          postMessageToPreviewTabLoopback(scope, target)
          return
        }
        slot.windowRef.location.replace(target)
        slot.windowRef.focus()
      }
    } catch {
      /* localStorage poll + postMessage remain the fallback */
    }
    postMessageToPreviewTabLoopback(scope, target)
  }
}

function retryLastPreviewNavigateDelivery(siteId: string): void {
  const scope = siteId.trim()
  if (!scope) return
  const slot = getPreviewSlot(scope)
  if (!slot.lastNavigateUrl) return
  deliverPreviewNavigateUrl(slot.lastNavigateUrl, scope)
}

/** Pending tab may mount after the first handoff — retry only until the tab arrives. */
function schedulePreviewDeliveryRetries(url: string, siteId: string, durationMs = 12_000): void {
  const scope = siteId.trim()
  if (!scope) return
  stopPreviewDeliveryRetries(scope)
  const target = alignPreviewUrlWithCurrentHost(url)
  const slot = getPreviewSlot(scope)
  deliverPreviewNavigateUrl(target, scope)
  const startedAt = Date.now()
  slot.retryIntervalId = window.setInterval(() => {
    if (Date.now() - startedAt > durationMs) {
      stopPreviewDeliveryRetries(scope)
      return
    }
    if (slot.windowRef && !slot.windowRef.closed && previewTabShowsUrl(slot.windowRef, target)) {
      stopPreviewDeliveryRetries(scope)
      return
    }
    deliverPreviewNavigateUrl(target, scope)
  }, 750)
}

/** Listen for the pending preview tab signalling it is ready to receive the token URL. */
export function initPreviewTabOpenerBridge(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('message', (ev: MessageEvent<{ type?: string; siteId?: string }>) => {
    if (ev.data?.type !== PREVIEW_PENDING_READY_TYPE) return
    const siteId = ev.data.siteId?.trim()
    if (!siteId) return
    retryLastPreviewNavigateDelivery(siteId)
  })
}

function closePreviewWindowRef(siteId: string): void {
  const slot = getPreviewSlot(siteId)
  if (!slot.windowRef || slot.windowRef.closed) {
    slot.windowRef = null
    return
  }
  try {
    slot.windowRef.close()
  } catch {
    /* cross-origin or already gone */
  }
  slot.windowRef = null
}

function postMessageToPreviewTab(siteId: string, url: string, targetOrigin: string): boolean {
  const slot = getPreviewSlot(siteId)
  if (!slot.windowRef || slot.windowRef.closed) return false
  try {
    slot.windowRef.postMessage(
      { type: PREVIEW_NAV_MESSAGE_TYPE, url, siteId: siteId.trim() },
      targetOrigin,
    )
    slot.windowRef.focus()
    return true
  } catch {
    slot.windowRef = null
    return false
  }
}

function postMessageToPreviewTabLoopback(siteId: string, url: string): boolean {
  const slot = getPreviewSlot(siteId)
  if (!slot.windowRef || slot.windowRef.closed) return false
  const targetOrigin = new URL(url).origin
  if (postMessageToPreviewTab(siteId, url, targetOrigin)) return true
  if (typeof window !== 'undefined' && isSameLoopbackOrigin(window.location.origin, targetOrigin)) {
    return postMessageToPreviewTab(siteId, url, normalizeLoopbackOrigin(window.location.origin))
      || postMessageToPreviewTab(siteId, url, '*')
  }
  return false
}

function buildVendorDraftPreviewPendingUrl(siteId: string): string {
  const url = new URL(getDraftBrowserPreviewAbsolutePath(), getVendorPreviewOrigin())
  url.searchParams.set(DRAFT_PREVIEW_PENDING_PARAM, '1')
  url.searchParams.set(PREVIEW_SITE_QUERY_PARAM, siteId.trim())
  return url.toString()
}

/**
 * Call synchronously from a click handler (before any `await`).
 * Opens a same-origin loading shell the builder can target after the preview API returns.
 * Each siteId gets its own named window so multi-tab builders do not overwrite each other.
 */
export function prepareDraftPreviewTab(siteId: string): Window | null {
  const scope = siteId.trim()
  if (!scope) return null
  const pendingUrl = buildVendorDraftPreviewPendingUrl(scope)
  const slot = getPreviewSlot(scope)
  slot.prepareActive = true
  try {
    if (slot.windowRef && !slot.windowRef.closed) {
      const targetOrigin = new URL(pendingUrl).origin
      try {
        if (isSameLoopbackOrigin(window.location.origin, targetOrigin)) {
          slot.windowRef.location.replace(pendingUrl)
        } else if (!postMessageToPreviewTabLoopback(scope, pendingUrl)) {
          closePreviewWindowRef(scope)
        } else {
          slot.windowRef.focus()
          return slot.windowRef
        }
        if (slot.windowRef && !slot.windowRef.closed) {
          slot.windowRef.focus()
          return slot.windowRef
        }
      } catch {
        closePreviewWindowRef(scope)
      }
    }
    const tab = window.open(pendingUrl, previewWindowNameForSite(scope))
    if (tab) {
      slot.windowRef = tab
      tab.focus()
    }
    return tab
  } catch {
    slot.prepareActive = false
    return null
  }
}

/** Navigate the prepared preview tab (safe to call after async work). */
export function navigateDraftPreviewTab(previewShellUrl: string, siteId: string): boolean {
  const scope = siteId.trim() || extractPreviewSiteIdFromUrl(previewShellUrl)
  if (!scope) return false
  const url = alignPreviewUrlWithCurrentHost(previewShellUrl)
  // Ensure siteId stays on the URL so the shell keeps filtering after handoff.
  let finalUrl = url
  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.get(PREVIEW_SITE_QUERY_PARAM)) {
      parsed.searchParams.set(PREVIEW_SITE_QUERY_PARAM, scope)
      finalUrl = parsed.toString()
    }
  } catch {
    /* keep url */
  }
  const slot = getPreviewSlot(scope)
  slot.lastNavigateUrl = finalUrl
  let locationNavigated = false
  try {
    const targetOrigin = new URL(finalUrl).origin

    // Always persist for the pending tab to poll — never clear from the builder side.
    deliverPreviewNavigateUrl(finalUrl, scope)
    if (slot.windowRef && !slot.windowRef.closed && isSameLoopbackOrigin(window.location.origin, targetOrigin)) {
      locationNavigated = true
    }
    schedulePreviewDeliveryRetries(finalUrl, scope)

    // Only open a new tab when prepare did not run and we have no live preview window.
    if (!locationNavigated && !slot.prepareActive && (!slot.windowRef || slot.windowRef.closed)) {
      try {
        const tab = window.open(finalUrl, previewWindowNameForSite(scope))
        if (tab) {
          slot.windowRef = tab
          tab.focus()
          locationNavigated = true
        }
      } catch {
        /* popup blocked */
      }
    }

    const delivered = locationNavigated || slot.prepareActive
    slot.prepareActive = false
    return delivered
  } catch {
    slot.prepareActive = false
    return false
  }
}

/**
 * Open a preview URL once in the site-scoped preview tab.
 * Do not use `navigateDraftPreviewTab` here — its retry loop calls `location.replace`
 * every ~750ms, which aborts lazy chunks (e.g. FashionTemplate) on same-origin previews
 * and looks like a continuous reload + "Failed to fetch dynamically imported module".
 */
function openPreviewTabOnce(url: string, siteId: string): boolean {
  const scope = siteId.trim() || PREVIEW_TEMPLATE_SCOPE
  stopPreviewDeliveryRetries(scope)
  const slot = getPreviewSlot(scope)
  slot.lastNavigateUrl = null
  if (slot.windowRef && !slot.windowRef.closed) {
    try {
      if (previewTabShowsUrl(slot.windowRef, url)) {
        slot.windowRef.focus()
        return true
      }
      slot.windowRef.location.replace(url)
      slot.windowRef.focus()
      return true
    } catch {
      /* fall through to open */
    }
  }
  const tab = window.open(url, previewWindowNameForSite(scope))
  if (tab) {
    slot.windowRef = tab
    tab.focus()
    return true
  }
  return false
}

/** Open preview in one browser tab (sync callers only — no preceding `await`). */
export function openDraftPreviewInBrowser(
  previewShellUrl: string,
  siteId?: string | null,
): boolean {
  const scope = siteId?.trim()
    || extractPreviewSiteIdFromUrl(previewShellUrl)
    || PREVIEW_TEMPLATE_SCOPE
  try {
    const parsed = new URL(previewShellUrl, typeof window !== 'undefined' ? window.location.href : undefined)
    const hasTarget = Boolean(parsed.searchParams.get('target')?.trim())
    const hasToken = Boolean(parsed.searchParams.get('token')?.trim())
    const isPendingShell = parsed.searchParams.get(DRAFT_PREVIEW_PENDING_PARAM) === '1'
    const isDraftShell = matchesDraftPreviewBrowserPath(parsed.pathname)

    // Catalog / template-browser previews (and legacy ?target= shell): open once.
    // Draft-token handoff still uses navigateDraftPreviewTab below.
    if ((hasTarget && !hasToken) || (!isDraftShell && !hasToken && !isPendingShell)) {
      // Align only vendor draft-shell hosts (loopback port quirks). Keep absolute
      // storefront origins (VITE_STOREFRONT_URL) unchanged.
      const url = isDraftShell || hasTarget
        ? alignPreviewUrlWithCurrentHost(previewShellUrl)
        : previewShellUrl
      return openPreviewTabOnce(url, scope)
    }
  } catch {
    /* fall through to token/pending path */
  }
  return navigateDraftPreviewTab(previewShellUrl, scope)
}

/** Crisp labels on dense builder toolbars (avoids muddy 12px extrabold on Windows). */
export const BUILDER_CRISP_LABEL =
  'text-[13px] font-semibold leading-none tracking-[0.01em] antialiased subpixel-antialiased shrink-0 whitespace-nowrap'

/** Preview-in-browser control (builder toolbar + template gallery). */
export const STOREFRONT_PREVIEW_IN_BROWSER_BTN_CLASS =
  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${BUILDER_CRISP_LABEL} text-primary bg-accent/95 border-primary/40 hover:bg-primary/10`

/** @deprecated use STOREFRONT_PREVIEW_IN_BROWSER_BTN_CLASS */
export const STOREFRONT_OPEN_IN_BROWSER_BTN_CLASS = STOREFRONT_PREVIEW_IN_BROWSER_BTN_CLASS
