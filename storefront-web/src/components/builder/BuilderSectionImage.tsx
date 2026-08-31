import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isCanvasImageSlotSelected } from '@/lib/canvasImageTarget'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import {
  focalFromPointerDelta,
  patchArrayItemImageStyle,
  readArrayItemFromBlockProps,
  readArrayItemImageStyleProps,
  readSectionImageFocal,
  readSectionImageOverlay,
  sectionImageDecorStyle,
  sectionImageObjectStyle,
  sectionImageOverlayCss,
  sectionImageStyleKeys,
} from '@/lib/sectionImageStyle'

const CORNER_CLASS =
  'pointer-events-none absolute z-[32] h-2.5 w-2.5 border-2 border-primary bg-white shadow-sm'

/** Clickable hero / section image in the builder canvas. */
export function BuilderSectionImage({
  blockId,
  field,
  blockProps,
  src,
  alt = '',
  className,
  style,
  frameClassName,
  frameStyle,
  arrayKey,
  index,
  itemField,
  empty = false,
}: {
  blockId?: string
  field: string
  blockProps?: Record<string, unknown>
  src: string
  alt?: string
  className?: string
  style?: CSSProperties
  /**
   * Optional outer-frame sizing (e.g. nav logos). When set, replaces the default
   * `h-full w-full` fill so intrinsic width/height controls actually apply.
   */
  frameClassName?: string
  frameStyle?: CSSProperties
  /** Array-item slot (categories[i].image_url, images[i].src, …). */
  arrayKey?: string
  index?: number
  itemField?: string
  /** Editor placeholder when the slot has no image yet. */
  empty?: boolean
}) {
  const canvas = useBuilderCanvas()
  const isEditor = canvas?.isEditorCanvas && !!blockId
  const isArraySlot = arrayKey != null && index != null && itemField
  const isActive = isEditor
    && isCanvasImageSlotSelected(
      canvas?.activeCanvasImageTarget,
      blockId!,
      isArraySlot
        ? { arrayKey, index, itemField }
        : { field },
    )
  const multiCount = isEditor && isActive
    ? canvas?.activeCanvasImageTarget?.slots.length ?? 1
    : 0

  // The "Photo selected" label floats just ABOVE the frame so it never covers the
  // image (small avatars / logos were fully hidden under it). In the builder it is
  // portaled into `.builder-canvas-scroll` with scroll-content coordinates so it
  // tracks the image while scrolling and stays inside the canvas (not over side
  // panels). Other contexts fall back to a fixed body portal.
  const frameRef = useRef<HTMLDivElement>(null)
  type LabelAnchor = {
    top: number
    left: number
    below: boolean
    portalRoot: HTMLElement
    mode: 'canvas' | 'viewport'
  }
  const [labelAnchor, setLabelAnchor] = useState<LabelAnchor | null>(null)
  useEffect(() => {
    if (!isActive || typeof window === 'undefined') {
      setLabelAnchor(null)
      return
    }
    const el = frameRef.current
    if (!el) return
    let raf = 0
    const BADGE_HALF_W = 72
    const BADGE_H = 24
    const GAP = 6
    const EDGE_PAD = 8

    const update = () => {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 && r.height <= 0) {
        setLabelAnchor(null)
        return
      }

      const scrollRoot = el.closest('.builder-canvas-scroll') as HTMLElement | null
      const pageCanvas = el.closest('[data-page-canvas]') as HTMLElement | null

      if (scrollRoot) {
        const rootRect = scrollRoot.getBoundingClientRect()
        let centerX = r.left - rootRect.left + scrollRoot.scrollLeft + r.width / 2

        if (pageCanvas) {
          const pageRect = pageCanvas.getBoundingClientRect()
          const pageLeft = pageRect.left - rootRect.left + scrollRoot.scrollLeft
          const pageRight = pageLeft + pageCanvas.offsetWidth
          centerX = Math.min(
            pageRight - BADGE_HALF_W - EDGE_PAD,
            Math.max(pageLeft + BADGE_HALF_W + EDGE_PAD, centerX),
          )
        }

        const contentTop = r.top - rootRect.top + scrollRoot.scrollTop
        const placeBelow = contentTop < BADGE_H + GAP + EDGE_PAD
        const top = placeBelow ? contentTop + r.height + GAP : contentTop - GAP

        setLabelAnchor({
          top,
          left: centerX,
          below: placeBelow,
          portalRoot: scrollRoot,
          mode: 'canvas',
        })
        return
      }

      let left = r.left + r.width / 2
      const topEdge = r.top - GAP
      const placeBelow = topEdge - BADGE_H < EDGE_PAD
      setLabelAnchor({
        top: placeBelow ? r.bottom + GAP : topEdge,
        left,
        below: placeBelow,
        portalRoot: document.body,
        mode: 'viewport',
      })
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('resize', schedule)
    const scrollRoot = el.closest('.builder-canvas-scroll') as HTMLElement | null
    scrollRoot?.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('scroll', schedule, true)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
    ro?.observe(el)
    scrollRoot && ro?.observe(scrollRoot)
    const pageCanvas = el.closest('[data-page-canvas]') as HTMLElement | null
    pageCanvas && ro?.observe(pageCanvas)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', schedule)
      scrollRoot?.removeEventListener('scroll', schedule)
      window.removeEventListener('scroll', schedule, true)
      ro?.disconnect()
    }
  }, [isActive, multiCount])

  const styleField = isArraySlot && (itemField === 'src' || itemField === 'avatar_url')
    ? 'image_url'
    : field
  // Nav/brand logos use dedicated logo_size / logo_fit / logo_shape controls — do not
  // inherit hero-style image_fit / image_scale keys (those default to cover and can
  // shrink or crop the mark).
  const isLogoField = styleField === 'brand_logo' || styleField === 'logo_url'
  const styleProps = canvas?.blockPropsForImage ?? blockProps ?? {}
  const arrayItem = isArraySlot ? readArrayItemFromBlockProps(styleProps, arrayKey!, index!) : null
  const objectStyle = isLogoField
    ? undefined
    : isArraySlot
      ? sectionImageObjectStyle(
          'image_url',
          readArrayItemImageStyleProps(arrayItem!, styleProps, styleField),
        )
      : sectionImageObjectStyle(styleField, styleProps)

  // Corners + opacity apply to per-card images too (read from the item). Shadow and the
  // gradient overlay stay whole-section only — per-card frames use `overflow-hidden`,
  // which clips drop shadows and gradient layers.
  const decorStyle = isLogoField
    ? undefined
    : isArraySlot
      ? sectionImageDecorStyle('image_url', arrayItem!)
      : sectionImageDecorStyle(styleField, styleProps)
  const overlayCss = isLogoField || isArraySlot
    ? undefined
    : sectionImageOverlayCss(readSectionImageOverlay(styleField, styleProps))

  const hasFrameSize = frameClassName != null || frameStyle != null
  const canPan = isEditor && !empty && !isLogoField && !!canvas?.onSectionImageStylePatch
  const [dragFocal, setDragFocal] = useState<{ x: number; y: number } | null>(null)
  const [panning, setPanning] = useState(false)
  const panRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    moved: boolean
  } | null>(null)

  const liveObjectStyle = dragFocal
    ? {
        ...objectStyle,
        objectPosition: `${dragFocal.x}% ${dragFocal.y}%`,
        ...(objectStyle?.transform
          ? { transformOrigin: `${dragFocal.x}% ${dragFocal.y}%` }
          : {}),
      }
    : objectStyle

  const persistFocal = (x: number, y: number) => {
    if (!blockId || !canvas?.onSectionImageStylePatch) return
    const keys = sectionImageStyleKeys(styleField)
    const focalPatch = { [keys.focalX]: x, [keys.focalY]: y }
    const patch = isArraySlot
      ? patchArrayItemImageStyle(styleProps, arrayKey!, index!, focalPatch)
      : focalPatch
    canvas.onSectionImageStylePatch(blockId, patch)
  }

  const endPan = (el: HTMLDivElement, pointerId: number) => {
    const drag = panRef.current
    if (!drag || drag.pointerId !== pointerId) return
    panRef.current = null
    setPanning(false)
    if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId)
    if (drag.moved) persistFocal(drag.lastX, drag.lastY)
    setDragFocal(null)
  }

  const onPanPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canPan || e.button !== 0 || e.shiftKey || e.metaKey || e.ctrlKey) return
    // Default drag moves the frame on the page; Alt-drag pans the crop inside the shape.
    if (!e.altKey) return
    if (multiCount > 1) return
    if (!isActive) {
      canvas?.onSectionImageActivate?.(blockId!, field, isArraySlot
        ? { arrayKey, index, itemField }
        : undefined)
    }
    const el = frameRef.current
    if (!el) return
    const start = readSectionImageFocal(styleField, isArraySlot
      ? readArrayItemImageStyleProps(arrayItem!, styleProps, styleField)
      : styleProps)
    panRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: start.x,
      startY: start.y,
      lastX: start.x,
      lastY: start.y,
      moved: false,
    }
    el.setPointerCapture(e.pointerId)
  }

  const onPanPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = panRef.current
    const el = frameRef.current
    if (!drag || drag.pointerId !== e.pointerId || !el) return
    const scale = canvas?.canvasScale && canvas.canvasScale > 0 ? canvas.canvasScale : 1
    const dx = (e.clientX - drag.startClientX) / scale
    const dy = (e.clientY - drag.startClientY) / scale
    if (!drag.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return
    drag.moved = true
    e.preventDefault()
    if (!panning) setPanning(true)
    const rect = el.getBoundingClientRect()
    const next = focalFromPointerDelta(
      { x: drag.startX, y: drag.startY },
      dx,
      dy,
      rect.width / scale,
      rect.height / scale,
    )
    drag.lastX = next.x
    drag.lastY = next.y
    setDragFocal(next)
  }

  const onPanPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = frameRef.current
    if (el) endPan(el, e.pointerId)
  }

  return (
    <div
      ref={frameRef}
      className={cn(
        'group/builder-section-img relative z-0 overflow-hidden',
        hasFrameSize ? frameClassName : 'h-full w-full',
        isEditor && 'cursor-pointer pointer-events-auto',
        canPan && (panning ? 'cursor-grabbing select-none' : isActive && 'cursor-grab'),
        isEditor && isActive && 'z-[20]',
      )}
      onPointerDown={canPan ? onPanPointerDown : undefined}
      onPointerMove={canPan ? onPanPointerMove : undefined}
      onPointerUp={canPan ? onPanPointerUp : undefined}
      onPointerCancel={canPan ? onPanPointerUp : undefined}
      style={{
        ...(hasFrameSize
          ? (decorStyle ? { ...frameStyle, ...decorStyle } : frameStyle)
          : decorStyle),
        ...(canPan && isActive ? { touchAction: 'none' } : null),
      }}
      data-builder-section-image={field}
      {...(isArraySlot ? {
        'data-builder-image-array-key': arrayKey,
        'data-builder-image-index': String(index),
        'data-builder-image-item-field': itemField,
      } : {})}
      data-builder-section-image-active={isActive ? 'true' : undefined}
      data-builder-field-selected={isActive ? 'true' : undefined}
      aria-selected={isActive}
      title={canPan ? 'Drag to move · corner handles to resize · Alt-drag to pan inside the shape' : undefined}
    >
      <img
        src={src}
        alt={alt}
        className={cn('block min-h-0 min-w-0', className, empty && 'opacity-0')}
        style={liveObjectStyle ? { ...liveObjectStyle, ...style } : style}
        loading="lazy"
        draggable={false}
      />
      {overlayCss ? (
        <div
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{ background: overlayCss }}
          aria-hidden
        />
      ) : null}
      {empty && isEditor ? (
        <div
          className="pointer-events-none absolute inset-0 z-[10] flex flex-col items-center justify-center gap-1 border-2 border-dashed border-primary/35 bg-primary/5 text-primary/70"
          aria-hidden
        >
          <ImageIcon className="h-5 w-5 opacity-60" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">Add photo</span>
        </div>
      ) : null}
      {isEditor && !isActive ? (
        <div
          className="pointer-events-none absolute inset-0 z-[15] border-2 border-dashed border-transparent bg-primary/0 transition-colors group-hover/builder-section-img:border-primary/55 group-hover/builder-section-img:bg-primary/8"
          aria-hidden
        />
      ) : null}
      {isActive ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-[30] border-[3px] border-primary bg-primary/12 shadow-[inset_0_0_32px_rgba(100,195,160,0.28)]"
            aria-hidden
          />
          <span className={cn(CORNER_CLASS, 'left-0 top-0 -translate-x-px -translate-y-px')} aria-hidden />
          <span className={cn(CORNER_CLASS, 'right-0 top-0 translate-x-px -translate-y-px')} aria-hidden />
          <span className={cn(CORNER_CLASS, 'bottom-0 left-0 -translate-x-px translate-y-px')} aria-hidden />
          <span className={cn(CORNER_CLASS, 'right-0 bottom-0 translate-x-px translate-y-px')} aria-hidden />
        </>
      ) : null}
      {isActive && labelAnchor && typeof document !== 'undefined'
        ? createPortal(
            <div
              className={cn(
                'pointer-events-none z-[90] flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-md',
                labelAnchor.mode === 'canvas' ? 'absolute' : 'fixed',
                !labelAnchor.below && '-translate-y-full',
              )}
              style={{ top: labelAnchor.top, left: labelAnchor.left }}
            >
              <ImageIcon className="h-3 w-3 shrink-0" aria-hidden />
              {multiCount > 1 ? `${multiCount} selected` : panning ? 'Release to save' : 'Drag to move · handles to resize'}
            </div>,
            labelAnchor.portalRoot,
          )
        : null}
    </div>
  )
}
