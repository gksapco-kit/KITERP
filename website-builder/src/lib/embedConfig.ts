/** Vendor + storefront context injected when embedded in vendor admin (:3001). */

let cached: {
  vendorSlug: string | null
  storefrontOrigin: string | null
  branchCode: string | null
} | null = null

function readSearchParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

export function getEmbedVendorSlug(): string | null {
  const fromQs = readSearchParams().get('vendorSlug')?.trim()
  if (fromQs) return fromQs
  if (cached?.vendorSlug) return cached.vendorSlug
  return null
}

/** Business unit / outlet code for `?branch=` on the customer store URL. */
export function getEmbedBranchCode(): string | null {
  const fromQs = readSearchParams().get('branch')?.trim()
  if (fromQs) return fromQs
  if (cached?.branchCode) return cached.branchCode
  return null
}

/** Business front origin (port 3002 in local dev). */
export function getStorefrontOrigin(): string {
  if (cached?.storefrontOrigin) return cached.storefrontOrigin

  const fromQs = readSearchParams().get('storefrontOrigin')?.trim()
  if (fromQs) return fromQs.replace(/\/$/, '')

  const fromEnv = (import.meta.env.VITE_STOREFRONT_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (import.meta.env.DEV || isLoopbackHost(hostname)) {
      return `${protocol}//${hostname}:3002`
    }
    return window.location.origin.replace(/\/$/, '')
  }

  return 'http://127.0.0.1:3002'
}

/** Vendor admin origin where the embedded builder app is served (:3001 in local dev). */
export function getVendorAdminOrigin(): string {
  const fromQs = readSearchParams().get('vendorOrigin')?.trim()
  if (fromQs) return fromQs.replace(/\/$/, '')

  const fromEnv = (import.meta.env.VITE_VENDOR_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '')
  }

  return 'http://127.0.0.1:3001'
}

export function setEmbedConfig(patch: {
  vendorSlug?: string
  storefrontOrigin?: string
  branchCode?: string
}) {
  cached = {
    vendorSlug: patch.vendorSlug?.trim() || cached?.vendorSlug || getEmbedVendorSlug(),
    storefrontOrigin:
      patch.storefrontOrigin?.trim() || cached?.storefrontOrigin || getStorefrontOrigin(),
    branchCode: patch.branchCode?.trim() || cached?.branchCode || getEmbedBranchCode(),
  }
}

export function listenForEmbedConfigFromParent(): void {
  if (typeof window === 'undefined' || window.parent === window) return

  const handler = (event: MessageEvent) => {
    if (event.data?.type !== 'kiterp:website-builder-config') return
    const vendorSlug =
      typeof event.data.vendorSlug === 'string' ? event.data.vendorSlug.trim() : undefined
    const storefrontOrigin =
      typeof event.data.storefrontOrigin === 'string' ? event.data.storefrontOrigin.trim() : undefined
    const branchCode =
      typeof event.data.branchCode === 'string' ? event.data.branchCode.trim() : undefined
    if (vendorSlug || storefrontOrigin || branchCode) {
      setEmbedConfig({ vendorSlug, storefrontOrigin, branchCode })
    }
  }

  window.addEventListener('message', handler)
  window.parent.postMessage({ type: 'kiterp:website-builder-ready' }, '*')
}
