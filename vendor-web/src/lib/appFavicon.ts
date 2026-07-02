import { publicAsset } from '@/lib/publicAsset'

/** Bump when favicon artwork changes so browsers reload the tab icon. */
export const APP_FAVICON_VERSION = '8'

export const APP_FAVICON_URL = publicAsset(`favicon.png?v=${APP_FAVICON_VERSION}`)
export const APP_FAVICON_32_URL = publicAsset(`favicon-32.png?v=${APP_FAVICON_VERSION}`)
export const APP_APPLE_TOUCH_ICON_URL = publicAsset(`favicon-192.png?v=${APP_FAVICON_VERSION}`)

/** Force the document favicon to the current KITERP asset (avoids stale browser cache). */
export function ensureAppFavicon(): void {
  if (typeof document === 'undefined') return

  const links: Array<{ rel: string; href: string; sizes?: string }> = [
    { rel: 'icon', href: APP_FAVICON_32_URL, sizes: '32x32' },
    { rel: 'icon', href: APP_FAVICON_URL, sizes: '512x512' },
    { rel: 'shortcut icon', href: APP_FAVICON_URL },
    { rel: 'apple-touch-icon', href: APP_APPLE_TOUCH_ICON_URL, sizes: '192x192' },
  ]

  for (const { rel, href, sizes } of links) {
    const selector = sizes
      ? `link[rel="${rel}"][sizes="${sizes}"]`
      : `link[rel="${rel}"]`
    let link = document.querySelector<HTMLLinkElement>(selector)
    if (!link) {
      link = document.createElement('link')
      link.rel = rel
      if (sizes) link.sizes = sizes
      document.head.appendChild(link)
    }
    link.type = 'image/png'
    link.href = href
  }
}
