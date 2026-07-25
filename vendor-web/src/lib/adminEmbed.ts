/** When platform Super Admin embeds vendor-web HR (or other modules) in an iframe. */
const STORAGE_KEY = 'kiterp.admin_embed'

export function setVendorAdminEmbed(enabled: boolean) {
  try {
    if (enabled) sessionStorage.setItem(STORAGE_KEY, '1')
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode */
  }
}

export function isVendorAdminEmbed(): boolean {
  if (typeof window !== 'undefined') {
    try {
      if (new URLSearchParams(window.location.search).get('embed') === '1') {
        // Persist so client-side navigations keep the chrome-free layout.
        try {
          sessionStorage.setItem(STORAGE_KEY, '1')
        } catch {
          /* ignore */
        }
        return true
      }
    } catch {
      /* ignore */
    }
  }
  try {
    if (sessionStorage.getItem(STORAGE_KEY) === '1') return true
  } catch {
    /* ignore */
  }
  return false
}

export function clearVendorAdminEmbed() {
  setVendorAdminEmbed(false)
}
