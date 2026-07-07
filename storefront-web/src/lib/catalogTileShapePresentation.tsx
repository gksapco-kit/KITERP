import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { imageShapeIsClip, type ImageShape } from '@/lib/sectionItemLayout'

export type TileOverlayStyle = 'gradient' | 'none' | 'solid'
export type TileOverlayClip = 'auto' | 'shape' | 'square'
export type TileBackdrop = 'default' | 'transparent' | 'match_section'

export const TILE_OVERLAY_STYLE_OPTIONS: { value: TileOverlayStyle; label: string }[] = [
  { value: 'gradient', label: 'Gradient' },
  { value: 'solid', label: 'Solid tint' },
  { value: 'none', label: 'None' },
]

export const TILE_OVERLAY_CLIP_OPTIONS: { value: TileOverlayClip; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'shape', label: 'To shape' },
  { value: 'square', label: 'Square tile' },
]

export const TILE_BACKDROP_OPTIONS: { value: TileBackdrop; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'transparent', label: 'Transparent' },
  { value: 'match_section', label: 'Match section' },
]

export function parseTileOverlayStyle(raw: unknown): TileOverlayStyle {
  if (raw === 'none' || raw === 'solid') return raw
  return 'gradient'
}

export function parseTileOverlayClip(raw: unknown): TileOverlayClip {
  if (raw === 'shape' || raw === 'square') return raw
  return 'auto'
}

export function parseTileBackdrop(raw: unknown): TileBackdrop {
  if (raw === 'transparent' || raw === 'match_section') return raw
  return 'default'
}

export function readCatalogTileShapeSettings(props: Record<string, unknown>) {
  return {
    overlayStyle: parseTileOverlayStyle(props.tile_overlay_style),
    overlayClip: parseTileOverlayClip(props.tile_overlay_clip),
    backdrop: parseTileBackdrop(props.tile_backdrop),
  }
}

/** Shapes that still fill a rectangular tile — square overlay clipping is acceptable. */
const SQUARE_LIKE_TILE_SHAPES = new Set<ImageShape>(['square', 'rounded', 'soft'])

export function shapeUsesNonSquareMask(shape: ImageShape): boolean {
  return !SQUARE_LIKE_TILE_SHAPES.has(shape)
}

export function shouldClipTileOverlayToShape(shape: ImageShape, clip: TileOverlayClip): boolean {
  if (clip === 'square') return false
  if (clip === 'shape') return true
  return shapeUsesNonSquareMask(shape)
}

export function tileOverlayGradientClass(
  style: TileOverlayStyle,
  direction: 'bottom' | 'right' = 'bottom',
): string | null {
  if (style === 'none') return null
  if (style === 'solid') {
    return 'absolute inset-0 z-[1] bg-black/45 pointer-events-none [border-radius:inherit]'
  }
  return direction === 'right'
    ? 'absolute inset-0 z-[1] bg-gradient-to-r from-black/50 to-transparent pointer-events-none [border-radius:inherit]'
    : 'absolute inset-0 z-[1] bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none [border-radius:inherit]'
}

/** Host padding for category tiles (grid, overlay, banner, editorial). */
export function catalogTileHostAspectStyle(
  imageHeightPct: number,
  shape: ImageShape,
  _clipToShape: boolean,
): CSSProperties | undefined {
  const pct = shape === 'circle' ? 100 : imageHeightPct
  return { paddingBottom: `${pct}%` }
}

/** Backdrop on the image host so corner gaps match the tile (not the white card). */
export function catalogTileHostBackdropClass(
  backdrop: TileBackdrop,
  clipToShape: boolean,
  sectionBg?: string,
): string {
  if (!clipToShape) return ''
  return shapedTileMediaBackdropClass(backdrop, true, sectionBg)
}

export function catalogTileHostBackdropStyle(
  backdrop: TileBackdrop,
  clipToShape: boolean,
  sectionBg?: string,
): CSSProperties | undefined {
  if (!clipToShape) return undefined
  return shapedTileMediaBackdropStyle(backdrop, true, sectionBg)
}

export function shapedTileMediaBackdropClass(
  backdrop: TileBackdrop,
  clipToShape: boolean,
  sectionBg?: string,
): string {
  if (!clipToShape) return 'bg-gray-100'
  if (backdrop === 'transparent') return ''
  if (backdrop === 'match_section' && sectionBg) return ''
  return 'bg-gray-100'
}

export function shapedTileMediaBackdropStyle(
  backdrop: TileBackdrop,
  clipToShape: boolean,
  sectionBg?: string,
): CSSProperties | undefined {
  if (clipToShape && backdrop === 'match_section' && sectionBg) {
    return { backgroundColor: sectionBg }
  }
  return undefined
}

export interface CatalogShapedTileFrameOptions {
  shape: ImageShape
  tileWrap: string
  overlayStyle: TileOverlayStyle
  overlayClip: TileOverlayClip
  backdrop?: TileBackdrop
  sectionBg?: string
  overlayDirection?: 'bottom' | 'right'
  maxCircleWidth?: string
  className?: string
  style?: CSSProperties
}

export function resolveCatalogShapedTileFrame(options: CatalogShapedTileFrameOptions) {
  const clipToShape = shouldClipTileOverlayToShape(options.shape, options.overlayClip)
  const isCircle = options.shape === 'circle'
  const usesClipPath = imageShapeIsClip(options.shape)
  const overlayClass = tileOverlayGradientClass(
    options.overlayStyle,
    options.overlayDirection ?? 'bottom',
  )
  const backdrop = options.backdrop ?? 'default'
  const maxCircle = options.maxCircleWidth ?? 'min(100%,280px)'

  return {
    clipToShape,
    overlayClass,
    outerClassName: cn(
      options.className,
      clipToShape ? 'relative w-full' : 'relative isolate w-full overflow-hidden',
      !clipToShape && shapedTileMediaBackdropClass(backdrop, false, options.sectionBg),
    ),
    outerStyle: options.style,
    frameClassName: cn(
      clipToShape
        ? cn(
            'relative overflow-hidden mx-auto',
            isCircle ? 'w-full aspect-square' : 'w-full h-full',
            options.tileWrap,
            usesClipPath && 'isolate',
            shapedTileMediaBackdropClass(backdrop, true, options.sectionBg),
          )
        : cn('absolute inset-0 z-0', options.tileWrap),
    ),
    frameStyle: {
      ...shapedTileMediaBackdropStyle(backdrop, clipToShape, options.sectionBg),
      ...(clipToShape && isCircle ? { maxWidth: maxCircle } : undefined),
    },
    mediaClassName: 'absolute inset-0 z-0 w-full h-full object-cover',
  }
}

export function catalogShapedTileOverlayContentClass(): string {
  return 'absolute bottom-0 left-0 z-[2] text-white'
}

/** Helper for editorial tiles sized with padding-bottom on the outer link/card. */
export function catalogEditorialTileInnerClass(clipToShape: boolean, shape?: ImageShape): string {
  if (!clipToShape) return 'absolute inset-0'
  if (shape === 'circle') return 'absolute inset-0 flex items-center justify-center'
  return 'absolute inset-0'
}

export type CatalogShapedTileSlots = {
  image: ReactNode
  overlayContent?: ReactNode
}

export function buildCatalogShapedTileTree(
  options: CatalogShapedTileFrameOptions,
  slots: CatalogShapedTileSlots,
) {
  const frame = resolveCatalogShapedTileFrame(options)

  if (!frame.clipToShape) {
    return {
      frame,
      node: (
        <>
          <div className={frame.frameClassName} style={frame.frameStyle}>
            {slots.image}
          </div>
          {frame.overlayClass ? <div className={frame.overlayClass} aria-hidden /> : null}
          {slots.overlayContent}
        </>
      ),
    }
  }

  return {
    frame,
    node: (
      <div className={catalogEditorialTileInnerClass(true, options.shape)}>
        <div className={frame.frameClassName} style={frame.frameStyle}>
          {slots.image}
          {frame.overlayClass ? <div className={frame.overlayClass} aria-hidden /> : null}
          {slots.overlayContent}
        </div>
      </div>
    ),
  }
}
