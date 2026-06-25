/** Overlay fill / border helpers shared by canvas toolbar and Visual design-bar tab. */

export type OverlayLayerType =
  | 'text'
  | 'image'
  | 'button'
  | 'box'
  | 'badge'
  | 'icon'
  | 'video'
  | 'link'
  | 'db_link'
  | 'store'

export type OverlayLayerItem = {
  id: string
  type: OverlayLayerType | string
  x?: number
  y?: number
  w: number
  h: number
  zIndex?: number
  src?: string
  bgColor?: string
  bgFill?: 'solid' | 'none'
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  linkType?: string
  linkTarget?: string
  linkLabel?: string
  text?: string
  color?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
  italic?: boolean
  align?: 'left' | 'center' | 'right'
  description?: string
  shadow?: boolean
  opacity?: number
  objectFit?: 'cover' | 'contain' | 'fill'
  /** Zoom within layer frame (25–400, default 100). */
  imageScale?: number
  /** Lucide icon id (kebab-case) when type is `icon`. */
  iconName?: string
}

export function overlayHasTextControls(item: Pick<OverlayLayerItem, 'type'>): boolean {
  return item.type === 'text' || item.type === 'button' || item.type === 'badge'
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

export function isOverlayNoFill(item: Pick<OverlayLayerItem, 'bgFill' | 'bgColor'>): boolean {
  return item.bgFill === 'none' || item.bgColor === 'transparent'
}

export function defaultOverlayFillColor(type: string): string {
  return OVERLAY_DEFAULT_FILL[type] || OVERLAY_DEFAULT_FILL.button || '#64C3A0'
}

export function overlayLayerTypeLabel(type: string): string {
  switch (type) {
    case 'text': return 'Text'
    case 'image': return 'Image'
    case 'button': return 'Button'
    case 'box': return 'Box'
    case 'badge': return 'Badge'
    case 'icon': return 'Icon'
    case 'video': return 'Video'
    default: return type.charAt(0).toUpperCase() + type.slice(1)
  }
}

export function overlayHasFillControls(item: Pick<OverlayLayerItem, 'type' | 'src'>): boolean {
  if (item.type === 'image' && item.src) return false
  return true
}

/** Image / video layers — upload, library, and URL sourcing. */
export function overlayHasMediaSourceControls(item: Pick<OverlayLayerItem, 'type'>): boolean {
  return item.type === 'image' || item.type === 'video'
}

export function overlayHasLinkControl(item: Pick<OverlayLayerItem, 'type'>): boolean {
  return item.type === 'button' || item.type === 'badge' || item.type === 'text' || item.type === 'image' || item.type === 'icon'
}
