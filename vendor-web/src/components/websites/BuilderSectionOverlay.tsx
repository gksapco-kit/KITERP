import { type RefObject, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

const SECTION_PADDING_MAX = 320
const SECTION_PADDING_STEP = 4

/** Snap to slider step — used when drag ends. */
function snapSectionPadding(px: number): number {
  return Math.max(0, Math.min(SECTION_PADDING_MAX, Math.round(px / SECTION_PADDING_STEP) * SECTION_PADDING_STEP))
}

/** Smooth 1px steps while dragging (matches slider feel). */
function clampDragPadding(px: number): number {
  return Math.max(0, Math.min(SECTION_PADDING_MAX, Math.round(px)))
}

function findBlockEl(containerRef: RefObject<HTMLElement | null>, blockId: string): HTMLElement | null {
  const root = containerRef.current
  if (!root) return null
  return root.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null
}

function pointerInBlock(
  clientY: number,
  containerRef: RefObject<HTMLElement | null>,
  blockId: string,
): { pointerY: number; height: number } | null {
  const root = containerRef.current
  const el = findBlockEl(containerRef, blockId)
  if (!root || !el) return null
  const measured = measureBlockInRoot(el, root)
  const rootRect = root.getBoundingClientRect()
  const scaleY = root.offsetHeight > 0 ? rootRect.height / root.offsetHeight : 1
  const pointerY = (clientY - rootRect.top) / scaleY - measured.top
  return { pointerY, height: measured.height }
}

export interface BuilderSectionBox {
  top: number
  left: number
  width: number
  height: number
}

/** Local coords inside a scaled canvas root (correct for transform: scale). */
export function measureBlockInRoot(el: HTMLElement, root: HTMLElement): BuilderSectionBox {
  const rootRect = root.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const scaleX = root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1
  const scaleY = root.offsetHeight > 0 ? rootRect.height / root.offsetHeight : 1
  const scale = scaleX || scaleY || 1
  return {
    top: (elRect.top - rootRect.top) / scale,
    left: (elRect.left - rootRect.left) / scale,
    width: el.offsetWidth,
    height: el.offsetHeight,
  }
}

export function getBlockScreenRect(el: HTMLElement): DOMRect {
  return el.getBoundingClientRect()
}

/** Tracks a rendered block's box inside the builder page root (for selection chrome overlays). */
export function useBuilderSectionBox(
  blockId: string,
  containerRef: RefObject<HTMLElement | null>,
  revision?: string,
  scrollRootRef?: RefObject<HTMLElement | null>,
) {
  const [box, setBox] = useState<BuilderSectionBox | null>(null)

  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root) {
      setBox(null)
      return
    }

    const findEl = () =>
      root.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null

    let el = findEl()
    if (!el) {
      setBox(null)
      return
    }

    const update = () => {
      const currentRoot = containerRef.current
      el = currentRoot ? findEl() : null
      if (!currentRoot || !el) {
        setBox(null)
        return
      }
      setBox(measureBlockInRoot(el, currentRoot))
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    ro.observe(root)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    const scrollRoot = scrollRootRef?.current
    scrollRoot?.addEventListener('scroll', update, { passive: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      scrollRoot?.removeEventListener('scroll', update)
    }
  }, [blockId, containerRef, revision, scrollRootRef])

  return box
}

/** Fixed-position portal anchored above a block (avoids scaled-canvas overlap bugs). */
export function BuilderDesignBarPortal({
  blockId,
  containerRef,
  revision,
  children,
}: {
  blockId: string
  containerRef: RefObject<HTMLElement | null>
  revision?: string
  children: ReactNode
}) {
  const [frame, setFrame] = useState<{ top: number; left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root) {
      setFrame(null)
      return
    }

    const findEl = () =>
      root.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null

    let el = findEl()
    if (!el) {
      setFrame(null)
      return
    }

    const update = () => {
      el = findEl()
      if (!el) {
        setFrame(null)
        return
      }
      const r = getBlockScreenRect(el)
      setFrame({ top: r.top, left: r.left, width: r.width })
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    ro.observe(root)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [blockId, containerRef, revision])

  if (!frame) return null

  return createPortal(
    <div
      className="pointer-events-auto"
      style={{
        position: 'fixed',
        top: frame.top,
        left: frame.left,
        width: frame.width,
        transform: 'translateY(calc(-100% - 2px))',
        zIndex: 100000,
      }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}

/** Absolute overlay for builder selection — pointer-events-none so page matches preview. */
export function BuilderSectionOverlay({
  blockId,
  containerRef,
  revision,
  selected,
  imageSelected,
  saving,
  visible,
  dropBefore,
  dropAfter,
  dragging,
  interactive,
  className,
  onContextMenu,
  onDragOver,
  onDrop,
  children,
  scrollRootRef,
}: {
  blockId: string
  containerRef: RefObject<HTMLElement | null>
  revision?: string
  selected?: boolean
  /** Section photo is the active target — soften full-section ring so the image highlight reads clearly. */
  imageSelected?: boolean
  saving?: boolean
  visible?: boolean
  dropBefore?: boolean
  dropAfter?: boolean
  dragging?: boolean
  interactive?: boolean
  className?: string
  onContextMenu: (e: React.MouseEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  children?: ReactNode
  /** Canvas scroll container — keeps selection chrome aligned while panning. */
  scrollRootRef?: RefObject<HTMLElement | null>
}) {
  const box = useBuilderSectionBox(blockId, containerRef, revision, scrollRootRef)

  if (!box) return null

  return (
    <div
      className={cn(
        'absolute group pointer-events-none',
        interactive && 'pointer-events-auto cursor-pointer',
        selected
          ? saving
            ? 'ring-2 ring-inset ring-amber-400'
            : imageSelected
              ? 'ring-1 ring-inset ring-primary/30'
              : 'ring-2 ring-inset ring-ring'
          : interactive && 'hover:ring-2 hover:ring-inset hover:ring-ring/60',
        dropBefore && 'border-t-4 border-primary',
        dropAfter && 'border-b-4 border-primary',
        dragging && 'opacity-50',
        !visible && 'opacity-40',
        className,
      )}
      style={{
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        zIndex: selected ? 50 : 40,
      }}
      onContextMenu={interactive ? onContextMenu : undefined}
      onDragOver={interactive ? onDragOver : undefined}
      onDrop={interactive ? onDrop : undefined}
    >
      {children}
    </div>
  )
}

type SectionScreenFrame = {
  top: number
  left: number
  width: number
  height: number
  scaleY: number
}

function measureBlockScreenFrame(
  containerRef: RefObject<HTMLElement | null>,
  blockId: string,
): SectionScreenFrame | null {
  const el = findBlockEl(containerRef, blockId)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const scaleY = el.offsetHeight > 0 ? rect.height / el.offsetHeight : 1
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height, scaleY }
}

/** Drag top/bottom section edges to adjust padding_top / padding_bottom. */
export function BuilderSectionPaddingHandles({
  blockId,
  containerRef,
  scrollRootRef,
  paddingTop,
  paddingBottom,
  canvasScale: _canvasScale,
  suppressed,
  onPaddingPreview,
  onPaddingCommit,
}: {
  blockId: string
  containerRef: RefObject<HTMLElement | null>
  revision?: string
  scrollRootRef?: RefObject<HTMLElement | null>
  paddingTop: number
  paddingBottom: number
  canvasScale: number
  /** Hide while a text or image field is the active target — avoids clashing resize handles. */
  suppressed?: boolean
  onPaddingPreview: (patch: { padding_top?: number; padding_bottom?: number }) => void
  onPaddingCommit: (patch: { padding_top?: number; padding_bottom?: number }) => void
}) {
  // Box tracks ResizeObserver only — skip revision so padding ticks don't reset observers.
  const box = useBuilderSectionBox(blockId, containerRef, undefined, scrollRootRef)
  const hasBox = box != null
  const [screenFrame, setScreenFrame] = useState<SectionScreenFrame | null>(null)
  // Visible canvas bounds — pills live in a body portal (not clipped by the scroll
  // container's overflow), so we clip them manually to avoid floating over the
  // docked toolbar above the canvas or out the bottom.
  const [clip, setClip] = useState<{ top: number; bottom: number } | null>(null)
  const [activeEdge, setActiveEdge] = useState<'top' | 'bottom' | null>(null)
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const dragRef = useRef<{
    edge: 'top' | 'bottom'
    startVal: number
    startHeight: number
    lastVal: number
    displayY: number
    // Screen geometry frozen at drag start — the block's screen top and canvas
    // scale don't change during a vertical padding drag, so re-reading them live
    // only adds reflow lag that makes the handles/tooltip shimmer.
    startTop: number
    startScaleY: number
    startLeft: number
    startWidth: number
    rafId: number | null
    pendingPreview: { padding_top?: number; padding_bottom?: number } | null
  } | null>(null)
  const onPaddingPreviewRef = useRef(onPaddingPreview)
  const onPaddingCommitRef = useRef(onPaddingCommit)
  onPaddingPreviewRef.current = onPaddingPreview
  onPaddingCommitRef.current = onPaddingCommit

  useLayoutEffect(() => {
    if (!hasBox || suppressed) {
      setScreenFrame(null)
      return
    }

    const update = () => {
      setScreenFrame(measureBlockScreenFrame(containerRef, blockId))
      const sr = scrollRootRef?.current
      if (sr) {
        const r = sr.getBoundingClientRect()
        setClip({ top: r.top, bottom: r.bottom })
      } else {
        setClip(null)
      }
    }

    update()
    const el = findBlockEl(containerRef, blockId)
    const root = containerRef.current
    if (!el || !root) return

    const ro = new ResizeObserver(update)
    ro.observe(el)
    ro.observe(root)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    const scrollRoot = scrollRootRef?.current
    scrollRoot?.addEventListener('scroll', update, { passive: true })

    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      scrollRoot?.removeEventListener('scroll', update)
    }
    // Deps are intentionally stable: padding ticks and the drag label change every
    // frame during a drag — keeping them out avoids tearing down / rebuilding the
    // observer on each tick. Live size changes are picked up by the ResizeObserver.
  }, [blockId, hasBox, suppressed, containerRef, scrollRootRef])

  if (!box || suppressed) return null

  const drag = dragRef.current
  const dragging = drag != null && activeEdge != null

  const liveTop = activeEdge === 'top' && drag
    ? drag.lastVal
    : clampDragPadding(paddingTop)
  const liveBottom = activeEdge === 'bottom' && drag
    ? drag.lastVal
    : clampDragPadding(paddingBottom)

  // Section height is derived from the drag ref so it stays in lockstep with the
  // pointer instead of trailing the (one-frame-lagged) ResizeObserver. Content is
  // top-anchored: a top drag pushes the content seam down, a bottom drag keeps the
  // seam fixed (displayY) and grows the section below it by the new bottom padding.
  const liveHeight = dragging
    ? activeEdge === 'top'
      ? drag!.startHeight + (drag!.displayY - drag!.startVal)
      : drag!.displayY + drag!.lastVal
    : box.height

  const topHandleY = activeEdge === 'top' && drag ? drag.displayY : liveTop
  const bottomHandleY = activeEdge === 'bottom' && drag
    ? drag.displayY
    : liveHeight - liveBottom
  const hideBottom = liveHeight < 16 || bottomHandleY - topHandleY < 4

  // While dragging, position against the frozen screen frame captured at drag
  // start; only fall back to the live (ResizeObserver) measurement when idle.
  const frameTop = dragging ? drag!.startTop : screenFrame?.top ?? null
  const frameScaleY = dragging ? drag!.startScaleY : screenFrame?.scaleY ?? null
  const frameLeft = dragging ? drag!.startLeft : screenFrame?.left ?? null
  const frameWidth = dragging ? drag!.startWidth : screenFrame?.width ?? null
  const hasFrame =
    frameTop != null && frameScaleY != null && frameLeft != null && frameWidth != null

  const topHandleScreenY = hasFrame ? frameTop! + topHandleY * frameScaleY! : null
  const bottomHandleScreenY = hasFrame ? frameTop! + bottomHandleY * frameScaleY! : null

  // Only show a handle/tooltip when its seam is inside the visible canvas. The pad
  // keeps the pill from poking past the edge (it's centred on the seam).
  const CLIP_PAD = 10
  const withinClip = (y: number | null): boolean =>
    y != null && (!clip || (y >= clip.top + CLIP_PAD && y <= clip.bottom - CLIP_PAD))

  const flushPreview = () => {
    const drag = dragRef.current
    if (!drag?.pendingPreview) return
    onPaddingPreviewRef.current(drag.pendingPreview)
    drag.pendingPreview = null
    drag.rafId = null
  }

  const scheduleDragFrame = (
    patch: { padding_top?: number; padding_bottom?: number },
    label: string,
  ) => {
    const drag = dragRef.current
    if (!drag) return
    drag.pendingPreview = patch
    if (drag.rafId != null) return
    drag.rafId = window.requestAnimationFrame(() => {
      flushPreview()
      setDragLabel(label)
      const d = dragRef.current
      if (d) d.rafId = null
    })
  }

  const startDrag = (edge: 'top' | 'bottom', e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    const hit = pointerInBlock(e.clientY, containerRef, blockId)
    if (!hit) return

    const frame = measureBlockScreenFrame(containerRef, blockId)
    const startVal = clampDragPadding(edge === 'top' ? paddingTop : paddingBottom)
    const startY = edge === 'top' ? startVal : hit.height - startVal

    dragRef.current = {
      edge,
      startVal,
      startHeight: hit.height,
      lastVal: startVal,
      displayY: startY,
      startTop: frame?.top ?? screenFrame?.top ?? 0,
      startScaleY: frame?.scaleY ?? screenFrame?.scaleY ?? 1,
      startLeft: frame?.left ?? screenFrame?.left ?? 0,
      startWidth: frame?.width ?? screenFrame?.width ?? 0,
      rafId: null,
      pendingPreview: null,
    }
    setActiveEdge(edge)
    setDragLabel(`${edge === 'top' ? 'Top' : 'Bottom'} padding: ${startVal}px`)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'

    const handleEl = e.currentTarget as HTMLElement
    handleEl.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const hitMove = pointerInBlock(ev.clientY, containerRef, blockId)
      if (!hitMove) return
      const { pointerY } = hitMove
      // Bottom edge must use the height captured at drag start, NOT the live
      // height. Growing the bottom padding grows the section, which would feed
      // back into `height - pointerY` and make the boundary run away from the
      // pointer. The top edge is anchored to the (stable) block top, so it is
      // left untouched.
      const next = drag.edge === 'top'
        ? clampDragPadding(pointerY)
        : clampDragPadding(drag.startHeight - pointerY)
      // Handle position: the top handle sits at the content seam, which moves
      // down as top padding grows, so it tracks `next`. The bottom content seam
      // stays fixed (content is top-anchored; only the section's outer edge
      // grows), so pin the bottom handle to that constant seam. This keeps it
      // aligned with the rendered padding band instead of drifting/overlapping.
      const displayY = drag.edge === 'top'
        ? next
        : drag.startHeight - drag.startVal

      if (next === drag.lastVal) return

      drag.lastVal = next
      drag.displayY = displayY
      const label = `${drag.edge === 'top' ? 'Top' : 'Bottom'} padding: ${next}px`
      scheduleDragFrame(
        drag.edge === 'top' ? { padding_top: next } : { padding_bottom: next },
        label,
      )
    }

    const endDrag = (ev: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return

      if (drag.rafId != null) {
        window.cancelAnimationFrame(drag.rafId)
        flushPreview()
      }

      const snapped = snapSectionPadding(drag.lastVal)
      dragRef.current = null
      setActiveEdge(null)
      setDragLabel(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      try {
        handleEl.releasePointerCapture(ev.pointerId)
      } catch { /* already released */ }

      handleEl.removeEventListener('pointermove', onMove)
      handleEl.removeEventListener('pointerup', endDrag)
      handleEl.removeEventListener('pointercancel', endDrag)

      if (snapped !== drag.startVal) {
        onPaddingCommitRef.current(
          drag.edge === 'top' ? { padding_top: snapped } : { padding_bottom: snapped },
        )
      } else if (drag.lastVal !== drag.startVal) {
        // Dragged but landed on same 4px snap — still sync React state.
        onPaddingPreviewRef.current(
          drag.edge === 'top' ? { padding_top: snapped } : { padding_bottom: snapped },
        )
      }
    }

    handleEl.addEventListener('pointermove', onMove)
    handleEl.addEventListener('pointerup', endDrag)
    handleEl.addEventListener('pointercancel', endDrag)
  }

  const edges: Array<{
    edge: 'top' | 'bottom'
    screenY: number | null
    value: number
    label: string
  }> = [
    { edge: 'top', screenY: topHandleScreenY, value: liveTop, label: 'Section padding top' },
    { edge: 'bottom', screenY: bottomHandleScreenY, value: liveBottom, label: 'Section padding bottom' },
  ]

  const renderHandlePill = (
    edge: 'top' | 'bottom',
    screenY: number,
    value: number,
    label: string,
  ) => {
    const active = activeEdge === edge
    return (
      <div
        key={edge}
        className={cn(
          'fixed touch-none select-none pointer-events-none',
          active ? 'z-[99992]' : 'z-[99990]',
        )}
        style={{
          top: screenY,
          left: frameLeft!,
          width: frameWidth!,
          transform: 'translateY(-50%)',
        }}
      >
        <div
          data-section-padding-handle
          role="slider"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={SECTION_PADDING_MAX}
          aria-valuenow={value}
          title={`${edge === 'top' ? 'Space above content' : 'Space below content'} — drag to adjust (${value}px)`}
          className="group/pad pointer-events-auto absolute left-1/2 top-1/2 flex h-6 w-full max-w-[min(100%,200px)] -translate-x-1/2 -translate-y-1/2 cursor-ns-resize items-center justify-center"
          onPointerDown={e => startDrag(edge, e)}
        >
          <div
            className={cn(
              'flex h-3.5 px-1.5 items-center justify-center gap-0.5 rounded-full border bg-white shadow-sm transition-all',
              active
                ? 'border-primary ring-1 ring-primary/25 scale-105 shadow'
                : 'border-ring group-hover/pad:border-primary/60 group-hover/pad:shadow',
            )}
          >
            <span className="block h-px w-2 rounded-full bg-primary/70 shrink-0" />
            <span className="text-[7px] font-bold uppercase tracking-wide text-primary/80 whitespace-nowrap">
              {edge === 'top' ? '↑ space' : '↓ space'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {liveTop > 0 && (
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-[58] bg-primary/10"
          style={{ height: liveTop }}
          aria-hidden
        />
      )}
      {liveBottom > 0 && (
        <div
          className="pointer-events-none absolute left-0 right-0 z-[58] bg-primary/10"
          // Anchor from the (stable) content seam rather than `bottom-0`: the box's
          // bottom is ResizeObserver-driven and lags a frame behind the live drag,
          // which makes the bottom band shimmer while dragging the bottom edge.
          style={{ top: Math.max(0, liveHeight - liveBottom), height: liveBottom }}
          aria-hidden
        />
      )}

      {/* Seam guide lines live in-canvas (below the section toolbar's z-85) so they
          render behind the floating toolbars instead of a body portal painting over
          them. The grabbable pill stays in the portal. */}
      <div
        className={cn(
          'pointer-events-none absolute left-0 right-0 z-[59] h-[2px] -translate-y-1/2',
          activeEdge === 'top' ? 'bg-primary' : 'bg-primary/45',
        )}
        style={{ top: topHandleY }}
        aria-hidden
      />
      {!hideBottom && (
        <div
          className={cn(
            'pointer-events-none absolute left-0 right-0 z-[59] h-[2px] -translate-y-1/2',
            activeEdge === 'bottom' ? 'bg-primary' : 'bg-primary/45',
          )}
          style={{ top: bottomHandleY }}
          aria-hidden
        />
      )}

      {hasFrame && createPortal(
        <>
          {edges.map(({ edge, screenY, value, label }) => {
            if (edge === 'bottom' && hideBottom) return null
            if (!withinClip(screenY)) return null
            return renderHandlePill(edge, screenY!, value, label)
          })}
          {dragLabel && activeEdge && withinClip(activeEdge === 'top' ? topHandleScreenY : bottomHandleScreenY) && (
            <div
              className="pointer-events-none fixed left-1/2 z-[99993] -translate-x-1/2 -translate-y-1/2 rounded-md bg-gray-900 px-2.5 py-1 text-[11px] font-mono text-white shadow-md"
              style={{
                top: activeEdge === 'top' ? topHandleScreenY! : bottomHandleScreenY!,
                left: frameLeft! + frameWidth! / 2,
              }}
            >
              {dragLabel}
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  )
}
