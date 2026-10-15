/**
 * Open an in-app path in a new tab without forcing login again.
 *
 * Vendor auth lives in sessionStorage, which a freshly opened tab does not share.
 * We seed the new tab's sessionStorage from this tab before navigating.
 */

import type { MouseEvent as ReactMouseEvent } from 'react'

const AUTH_SESSION_KEYS = ['access_token', 'refresh_token', 'vendor-auth-storage'] as const

function resolveAppUrl(path: string): string {
  const trimmed = path.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  const rel = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${base}${rel}` || rel
}

/** Copy current-tab auth into `tab`'s sessionStorage (same-origin about:blank). */
function seedAuthSession(tab: Window): void {
  for (const key of AUTH_SESSION_KEYS) {
    const value = sessionStorage.getItem(key)
    if (value != null) tab.sessionStorage.setItem(key, value)
  }
}

/**
 * Open `path` in a new tab while carrying over the current login session.
 * Returns the opened window, or null if the popup was blocked.
 */
export function openAuthenticatedTab(path: string): Window | null {
  const url = resolveAppUrl(path)
  const tab = window.open('about:blank', '_blank')
  if (!tab) return null

  try {
    seedAuthSession(tab)
  } catch {
    /* storage / cross-origin edge cases — still navigate */
  }

  tab.location.href = url
  return tab
}

/**
 * Click handler for in-app `<a target="_blank">` links.
 * Primary click uses session handoff; modified clicks keep native browser behavior.
 */
export function onAuthenticatedAnchorClick(
  event: ReactMouseEvent<HTMLAnchorElement>,
  path?: string,
): void {
  if (event.defaultPrevented) return
  if (event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

  const href = path || event.currentTarget.getAttribute('href')
  if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
    return
  }

  event.preventDefault()
  openAuthenticatedTab(href)
}
