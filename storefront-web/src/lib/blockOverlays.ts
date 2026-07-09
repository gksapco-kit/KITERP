import type { CSSProperties } from 'react'
import { mediaUrl } from '@/lib/utils'
import { resolveSocialLinkHref } from '@/lib/socialLinkHref'

export type OverlayCoordUnit = 'percent' | 'px'

/** Position/size range for percent-based overlays (0–100 of the section). */
export const OVERLAY_AXIS_MAX = 100
export const OVERLAY_MIN_W_PERCENT = 4
export const OVERLAY_MIN_H_PERCENT = 3

export type BlockOverlayItem = {
  id: string
  type: 'text' | 'image' | 'button' | 'box' | 'badge' | 'video' | string
  /** Horizontal offset — percent of section width when coordUnit is `percent`, else px. */
  x: number
  /** Vertical offset — percent of section height when coordUnit is `percent`, else px. */
  y: number
  w: number
  h: number
  /** When `'percent'`, x/y/w/h are 0–100 and scale with the section on resize. */
  coordUnit?: OverlayCoordUnit
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

function clampOverlay(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function overlayCoordUnit(item: Pick<BlockOverlayItem, 'coordUnit'>): OverlayCoordUnit {
  return item.coordUnit === 'percent' ? 'percent' : 'px'
}

export function overlayUsesPercent(item: Pick<BlockOverlayItem, 'coordUnit'>) {
  return overlayCoordUnit(item) === 'percent'
}

/** CSS position for an overlay layer — percent coords stay sticky to the section. */
export function overlayPositionStyle(
  item: Pick<BlockOverlayItem, 'x' | 'y' | 'w' | 'h' | 'coordUnit'>,
): CSSProperties {
  const x = item.x ?? 0
  const y = item.y ?? 0
  const w = item.w ?? 0
  const h = item.h ?? 0
  if (overlayUsesPercent(item)) {
    return {
      position: 'absolute',
      left: `${x}%`,
      top: `${y}%`,
      width: `${w}%`,
      height: `${h}%`,
    }
  }
  return {
    position: 'absolute',
    left: x,
    top: y,
    width: w,
    height: h,
  }
}

export function pxToOverlayPercent(
  box: Pick<BlockOverlayItem, 'x' | 'y' | 'w' | 'h'>,
  containerW: number,
  containerH: number,
): Pick<BlockOverlayItem, 'x' | 'y' | 'w' | 'h'> {
  if (containerW <= 0 || containerH <= 0) return { x: box.x, y: box.y, w: box.w, h: box.h }
  return {
    x: clampOverlay((box.x / containerW) * 100, 0, OVERLAY_AXIS_MAX),
    y: clampOverlay((box.y / containerH) * 100, 0, OVERLAY_AXIS_MAX),
    w: clampOverlay((box.w / containerW) * 100, OVERLAY_MIN_W_PERCENT, OVERLAY_AXIS_MAX),
    h: clampOverlay((box.h / containerH) * 100, OVERLAY_MIN_H_PERCENT, OVERLAY_AXIS_MAX),
  }
}

export function normalizeOverlayBox(
  item: Pick<BlockOverlayItem, 'x' | 'y' | 'w' | 'h' | 'coordUnit'>,
  containerW: number,
  containerH: number,
): Pick<BlockOverlayItem, 'x' | 'y' | 'w' | 'h'> {
  if (overlayUsesPercent(item)) {
    return { x: item.x, y: item.y, w: item.w, h: item.h }
  }
  return pxToOverlayPercent(item, containerW, containerH)
}

export function overlaySnapContainerSize(item: Pick<BlockOverlayItem, 'coordUnit'>) {
  return overlayUsesPercent(item)
    ? { w: OVERLAY_AXIS_MAX, h: OVERLAY_AXIS_MAX }
    : null
}

export function overlayMinContainerHeight(overlays: BlockOverlayItem[]): number {
  if (!overlays.length) return 0
  if (overlays.every(o => overlayUsesPercent(o))) return 0
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
      return resolveSocialLinkHref('whatsapp', target)
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
