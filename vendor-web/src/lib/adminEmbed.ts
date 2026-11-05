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

function persistEmbedFlag() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* private mode */
  }
}

export function isVendorAdminEmbed(): boolean {
  if (typeof window !== 'undefined') {
    try {
      if (new URLSearchParams(window.location.search).get('embed') === '1') {
        persistEmbedFlag()
        return true
      }
    } catch {
      /* ignore */
    }
    // Platform admin loads vendor HR in an iframe — hide vendor sidebar/header so content is visible.
    try {
      if (window.self !== window.top) {
        persistEmbedFlag()
        return true
      }
    } catch {
      /* cross-origin access blocked — still treat as embed when flag was set */
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
