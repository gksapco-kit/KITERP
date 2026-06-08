/**
 * Global Escape-to-close registry (single window singleton).
 * Must live in its own module so Vite prod chunks never duplicate the stack.
 */

export type EscapeHandler = () => void

type EscapeState = {
  stack: EscapeHandler[]
  listenerAttached: boolean
}

declare global {
  interface Window {
    __kiterpEscape?: EscapeState
  }
}

function getState(): EscapeState {
  if (typeof window === 'undefined') {
    return { stack: [], listenerAttached: false }
  }
  if (!window.__kiterpEscape) {
    window.__kiterpEscape = { stack: [], listenerAttached: false }
  }
  return window.__kiterpEscape
}

function hasVisibleToasts(): boolean {
  if (typeof document === 'undefined') return false
  for (const el of document.querySelectorAll('[data-sonner-toast]')) {
    if (el.getAttribute('data-removed') === 'true') continue
    if (el.getAttribute('data-visible') === 'false') continue
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return true
  }
  return false
}

function dismissVisibleToasts() {
  document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach(btn => {
    ;(btn as HTMLButtonElement).click()
  })
}

/** Topmost visible modal overlay (fixed full-screen). */
function findTopModalOverlay(): HTMLElement | null {
  if (typeof document === 'undefined') return null

  const tagged = Array.from(document.querySelectorAll<HTMLElement>('[data-kiterp-modal]'))
    .filter(isVisibleOverlay)
  if (tagged.length) {
    const sorted = tagged.sort(overlayZIndex)
    return sorted[sorted.length - 1] ?? null
  }

  const overlays = Array.from(document.querySelectorAll<HTMLElement>('div.fixed.inset-0'))
    .filter(el => isVisibleOverlay(el) && overlayZIndex(el) >= 40)
  const sorted = overlays.sort(overlayZIndex)
  return sorted[sorted.length - 1] ?? null
}

function overlayZIndex(el: HTMLElement): number {
  const z = parseInt(getComputedStyle(el).zIndex, 10)
  return Number.isFinite(z) ? z : 0
}

function isVisibleOverlay(el: HTMLElement): boolean {
  const s = getComputedStyle(el)
  if (s.display === 'none' || s.visibility === 'hidden') return false
  if (parseFloat(s.opacity) === 0) return false
  const r = el.getBoundingClientRect()
  return r.width > 8 && r.height > 8
}

function tryDomModalClose(): boolean {
  const overlay = findTopModalOverlay()
  if (!overlay) return false

  const closeBtn = overlay.querySelector<HTMLButtonElement>(
    'button[data-escape-close], button[aria-label="Close"], button[aria-label="close"]',
  )
  if (closeBtn) {
    closeBtn.click()
    return true
  }

  overlay.click()
  return true
}

function onGlobalKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' && e.code !== 'Escape') return

  if (hasVisibleToasts()) {
    dismissVisibleToasts()
    e.preventDefault()
    e.stopImmediatePropagation()
    return
  }

  const { stack } = getState()
  const close = stack[stack.length - 1]
  if (close) {
    e.preventDefault()
    e.stopImmediatePropagation()
    close()
    return
  }

  if (tryDomModalClose()) {
    e.preventDefault()
    e.stopImmediatePropagation()
  }
}

/** Call once at app startup (main.tsx). */
export function initGlobalEscapeHandler() {
  const state = getState()
  if (state.listenerAttached || typeof window === 'undefined') return
  window.addEventListener('keydown', onGlobalKeyDown, true)
  state.listenerAttached = true
}

export function registerEscapeHandler(onClose: EscapeHandler): () => void {
  initGlobalEscapeHandler()
  const { stack } = getState()
  stack.push(onClose)
  return () => {
    const idx = getState().stack.lastIndexOf(onClose)
    if (idx >= 0) getState().stack.splice(idx, 1)
  }
}
