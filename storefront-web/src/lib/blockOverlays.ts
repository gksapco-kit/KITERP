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

  switch (type) {
    case 'url':
      return target
    case 'page':
      return internal(target)
    case 'scroll':
      return target.startsWith('#') ? target : `#${target}`
    case 'product':
      return internal(`/products/${target}`)
    case 'service':
      return internal(`/services/${target}`)
    case 'category':
      return internal(`/categories/${target}`)
    case 'store':
      return `${storePath('/')}?branch=${encodeURIComponent(target)}`
    case 'stores_multi':
      return `${storePath('/stores')}?branch=${encodeURIComponent(target)}`
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
