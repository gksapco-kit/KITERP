import { mediaUrl } from '@/lib/utils'

export type BlockOverlayItem = {
  id: string
  type: 'text' | 'image' | 'button' | 'box' | 'badge' | 'video' | string
  x: number
  y: number
  w: number
  h: number
  text?: string
  description?: string
  src?: string
  href?: string
  linkType?: string
  linkTarget?: string
  linkLabel?: string
  openInNewTab?: boolean
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
  italic?: boolean
  color?: string
  bgColor?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  opacity?: number
  zIndex?: number
  shadow?: boolean
  align?: 'left' | 'center' | 'right'
  objectFit?: 'cover' | 'contain' | 'fill'
  imageScale?: number
  bgFill?: 'solid' | 'none'
  /** Lucide icon id when type is `icon`. */
  iconName?: string
}

const OVERLAY_DEFAULT_FILL: Record<string, string> = {
  text: 'transparent',
  image: '#f3f4f6',
  button: '#64C3A0',
  box: 'rgba(255,255,255,0.9)',
  badge: '#64C3A0',
  icon: 'transparent',
  video: '#000000',
}

export function isOverlayNoFill(item: Pick<BlockOverlayItem, 'bgFill' | 'bgColor'>): boolean {
  return item.bgFill === 'none' || item.bgColor === 'transparent'
}

export function defaultOverlayFillColor(type: string): string {
  return OVERLAY_DEFAULT_FILL[type] || OVERLAY_DEFAULT_FILL.button || '#64C3A0'
}

export function resolveOverlayBackground(item: BlockOverlayItem, fallback: string): string {
  if (isOverlayNoFill(item)) return 'transparent'
  return item.bgColor || fallback
}

export function resolveOverlayBorder(item: BlockOverlayItem): string | undefined {
  const w = item.borderWidth ?? 0
  if (w <= 0) return undefined
  return `${w}px solid ${item.borderColor || '#111827'}`
}

export function overlayMinContainerHeight(overlays: BlockOverlayItem[]): number {
  if (!overlays.length) return 0
  return Math.max(...overlays.map(o => o.y + o.h))
}

/** Resolve overlay link targets for storefront navigation. */
export function resolveOverlayLinkHref(
  item: BlockOverlayItem,
  storePath: (path: string) => string,
): string | null {
  const type = item.linkType || (item.href ? 'url' : 'none')
  const target = (item.linkTarget || item.href || '').trim()
  if (!type || type === 'none' || !target) return null

  const internal = (path: string) => storePath(path.startsWith('/') ? path : `/${path}`)

  // The builder saves a fully-resolved value in `linkTarget` (e.g. "/services/foo",
  // "?branch=code", "/stores?branch=a,b"). Treat that as canonical so overlay links
  // round-trip the same way section data-source links do (which use the item's full
  // `url`). We still tolerate a bare slug/code for backwards compatibility.
  const catalogPath = (collection: string) =>
    internal(target.startsWith('/') ? target : `/${collection}/${target}`)

  // Build a "?branch=..." query and append it to a store path, accepting either the
  // serialized query the builder saves ("?branch=code") or a bare code/list.
  const branchQuery = (codes: string) => {
    const value = codes.replace(/^\??branch=/, '')
    return `?branch=${encodeURIComponent(value)}`
  }

  switch (type) {
    case 'url':
      return target
    case 'page':
      return internal(target)
    case 'scroll':
      return target.startsWith('#') ? target : `#${target}`
    case 'product':
      return catalogPath('products')
    case 'service':
      return catalogPath('services')
    case 'category':
      return catalogPath('categories')
    case 'store':
      return `${storePath('/')}${branchQuery(target)}`
    case 'stores_multi':
      // Builder saves a full path ("/stores?branch=a,b") or just the bare list.
      return target.startsWith('/')
        ? storePath(target)
        : `${storePath('/stores')}${branchQuery(target)}`
    case 'store_locator':
      return internal('/stores')
    case 'email':
      return target.startsWith('mailto:') ? target : `mailto:${target}`
    case 'phone':
      return target.startsWith('tel:') ? target : `tel:${target.replace(/\s/g, '')}`
    case 'whatsapp':
      return `https://wa.me/${target.replace(/\D/g, '')}`
    case 'booking':
      return internal('/booking')
    case 'quote':
      return internal('/quote')
    case 'contact':
      return target.startsWith('#') ? target : internal('/contact')
    case 'login':
      return internal('/login')
    case 'register':
      return internal('/signup')
    case 'account':
      return internal('/account')
    case 'orders':
      return internal('/account/orders')
    case 'cart':
      return internal('/cart')
    case 'checkout':
      return internal('/checkout')
    case 'wishlist':
      return internal('/wishlist')
    case 'search':
      return internal('/search')
    case 'media':
    case 'download':
      return mediaUrl(target)
    default:
      if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:') || target.startsWith('tel:')) {
        return target
      }
      if (target.startsWith('#')) return target
      if (target.startsWith('/')) return storePath(target)
      return null
  }
}

export function overlayHasLink(item: BlockOverlayItem): boolean {
  const type = item.linkType || (item.href ? 'url' : 'none')
  const target = (item.linkTarget || item.href || '').trim()
  return Boolean(type && type !== 'none' && target)
}
