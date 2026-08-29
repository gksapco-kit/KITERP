import { type RefObject, useLayoutEffect, useRef, useState, useCallback, useEffect, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { BUILDER_SECTION_CHROME_Z } from '@/components/websites/builderPanelUi'
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
  layoutScale = 1,
): { pointerY: number; height: number } | null {
  const root = containerRef.current
  const el = findBlockEl(containerRef, blockId)
  if (!root || !el) return null
  const measured = measureBlockInRoot(el, root, layoutScale)
  const rootRect = root.getBoundingClientRect()
  const rootScaleY = root.offsetHeight > 0 ? rootRect.height / root.offsetHeight : 1
  const rootIsScaled = Math.abs(rootScaleY - 1) > 0.02
  const pointerY = rootIsScaled
    ? (clientY - rootRect.top) / rootScaleY - measured.top
    : clientY - rootRect.top - measured.top
  return { pointerY, height: measured.height }
}

export interface BuilderSectionBox {
  top: number
  left: number
  width: number
  height: number
}

function sameSectionBox(a: BuilderSectionBox, b: BuilderSectionBox): boolean {
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}

/** Local coords inside a scaled canvas root (correct for transform: scale). */
export function measureBlockInRoot(
  el: HTMLElement,
  root: HTMLElement,
  layoutScale = 1,
): BuilderSectionBox {
  const rootRect = root.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const rootScaleX = root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1
  const rootScaleY = root.offsetHeight > 0 ? rootRect.height / root.offsetHeight : 1
  const rootIsScaled =
    Math.abs(rootScaleX - 1) > 0.02
    || Math.abs(rootScaleY - 1) > 0.02

  // Overlays sit outside transform while blocks render inside scaled children — use visual px.
  if (!rootIsScaled) {
    return {
      top: elRect.top - rootRect.top,
      left: elRect.left - rootRect.left,
      width: elRect.width,
      height: elRect.height,
    }
  }

  const detectedScale = rootScaleX || rootScaleY || 1
  const scale = Math.abs(detectedScale - 1) > 0.02 ? detectedScale : (layoutScale > 0 ? layoutScale : 1)
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

/** Keep the section hover toolbar fully inside the canvas column (same anchor, no overlap with side panels). */
const SECTION_CHROME_TOOLBAR_HEIGHT_EST = 30
const SECTION_CHROME_TOOLBAR_WIDTH_EST = 420
const SECTION_CHROME_INSET = 6

export function resolveSectionChromePortalFrame(
  anchor: { top: number; left: number; right: number; height: number },
  canvasRect: DOMRect | null,
): { top: number; right: number; transform?: string } {
  const placeAbove = anchor.top >= SECTION_CHROME_TOOLBAR_HEIGHT_EST + SECTION_CHROME_INSET
  const placeBelowInSection =
    !placeAbove && anchor.height > SECTION_CHROME_TOOLBAR_HEIGHT_EST + SECTION_CHROME_INSET * 2

  let top = placeAbove
    ? anchor.top - SECTION_CHROME_INSET
    : placeBelowInSection
      ? anchor.top + SECTION_CHROME_INSET
      : anchor.top + Math.max(SECTION_CHROME_INSET, (anchor.height - SECTION_CHROME_TOOLBAR_HEIGHT_EST) / 2)

  const transform = placeAbove ? 'translateY(-100%)' : undefined

  // Default: align toolbar right edge with block right edge (top-right anchor).
  let toolbarRight = anchor.right
  if (canvasRect) {
    toolbarRight = Math.min(toolbarRight, canvasRect.right - SECTION_CHROME_INSET)
    // Keep the full toolbar width inside the canvas when the block spans edge-to-edge.
    const minRight = canvasRect.left + SECTION_CHROME_INSET + SECTION_CHROME_TOOLBAR_WIDTH_EST
    if (toolbarRight < minRight) {
      toolbarRight = minRight
    }

    if (placeAbove) {
      const visualTop = top - SECTION_CHROME_TOOLBAR_HEIGHT_EST
      if (visualTop < canvasRect.top + SECTION_CHROME_INSET) {
        top = canvasRect.top + SECTION_CHROME_INSET + SECTION_CHROME_TOOLBAR_HEIGHT_EST
      }
    } else if (placeBelowInSection) {
      const visualBottom = top + SECTION_CHROME_TOOLBAR_HEIGHT_EST
      if (visualBottom > canvasRect.bottom - SECTION_CHROME_INSET) {
        top = canvasRect.bottom - SECTION_CHROME_INSET - SECTION_CHROME_TOOLBAR_HEIGHT_EST
      }
    }
  }

  return {
    top,
    right: Math.max(SECTION_CHROME_INSET, window.innerWidth - toolbarRight),
    transform,
  }
}

const SECTION_TOOLBAR_OFFSET_KEY = 'kiterp:builder-section-toolbar-offset'

function readSectionChromeToolbarOffset(blockId: string): { x: number; y: number } {
  try {
    const raw = sessionStorage.getItem(`${SECTION_TOOLBAR_OFFSET_KEY}:${blockId}`)
    if (!raw) return { x: 0, y: 0 }
    const parsed = JSON.parse(raw) as { x?: number; y?: number }
    return {
      x: typeof parsed.x === 'number' && Number.isFinite(parsed.x) ? parsed.x : 0,
      y: typeof parsed.y === 'number' && Number.isFinite(parsed.y) ? parsed.y : 0,
    }
  } catch {
    return { x: 0, y: 0 }
  }
}

function writeSectionChromeToolbarOffset(blockId: string, offset: { x: number; y: number }): void {
  try {
    if (offset.x === 0 && offset.y === 0) {
      sessionStorage.removeItem(`${SECTION_TOOLBAR_OFFSET_KEY}:${blockId}`)
      return
    }
    sessionStorage.setItem(`${SECTION_TOOLBAR_OFFSET_KEY}:${blockId}`, JSON.stringify(offset))
  } catch {
    /* ignore quota / private mode */
  }
}

function composeSectionChromeTransform(
  base: string | undefined,
  offset: { x: number; y: number } | undefined,
): string | undefined {
  const parts: string[] = []
  if (base) parts.push(base)
  if (offset && (offset.x !== 0 || offset.y !== 0)) {
    parts.push(`translate(${offset.x}px, ${offset.y}px)`)
  }
  return parts.length > 0 ? parts.join(' ') : undefined
}

/** Drag reposition for the section hover toolbar — offset is kept per block for the session. */
export function useSectionChromeToolbarDrag(
  blockId: string,
  scrollRootRef?: RefObject<HTMLElement | null>,
) {
  const [dragOffset, setDragOffset] = useState(() => readSectionChromeToolbarOffset(blockId))
  const [dragging, setDragging] = useState(false)
  const portalRef = useRef<HTMLDivElement | null>(null)
  const dragOffsetRef = useRef(dragOffset)
  dragOffsetRef.current = dragOffset

  useEffect(() => {
    setDragOffset(readSectionChromeToolbarOffset(blockId))
  }, [blockId])

  const clampOffset = useCallback((next: { x: number; y: number }, session: {
    baseLeft: number
    baseTop: number
    width: number
    height: number
  }) => {
    let left = session.baseLeft + next.x
    let top = session.baseTop + next.y
    const pad = SECTION_CHROME_INSET
    const canvas = scrollRootRef?.current?.getBoundingClientRect()
    const minLeft = canvas ? canvas.left + pad : pad
    const maxLeft = canvas
      ? canvas.right - session.width - pad
      : window.innerWidth - session.width - pad
    left = Math.max(minLeft, Math.min(left, maxLeft))
    top = Math.max(pad, Math.min(top, window.innerHeight - session.height - pad))
    return { x: left - session.baseLeft, y: top - session.baseTop }
  }, [scrollRootRef])

  const finishDrag = useCallback(() => {
    document.body.style.removeProperty('cursor')
    document.body.style.removeProperty('user-select')
    setDragging(false)
  }, [])

  const beginDrag = useCallback((e: ReactMouseEvent) => {
    if (e.button !== 0) return
    const portal = portalRef.current
    if (!portal) return
    e.preventDefault()
    e.stopPropagation()

    const rect = portal.getBoundingClientRect()
    const offset = dragOffsetRef.current
    const session = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
      baseLeft: rect.left - offset.x,
      baseTop: rect.top - offset.y,
      width: rect.width,
      height: rect.height,
      moved: false,
    }

    setDragging(true)
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - session.startX
      const dy = ev.clientY - session.startY
      if (!session.moved && Math.hypot(dx, dy) < 4) return
      session.moved = true
      const next = clampOffset(
        { x: session.startOffsetX + dx, y: session.startOffsetY + dy },
        session,
      )
      dragOffsetRef.current = next
      setDragOffset(next)
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (session.moved) {
        writeSectionChromeToolbarOffset(blockId, dragOffsetRef.current)
      }
      finishDrag()
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [blockId, clampOffset, finishDrag])

  return { dragOffset, dragging, portalRef, beginDrag }
}

/** Tracks a rendered block's box inside the builder page root (for selection chrome overlays). */
export function useBuilderSectionBox(
  blockId: string,
  containerRef: RefObject<HTMLElement | null>,
  revision?: string,
  scrollRootRef?: RefObject<HTMLElement | null>,
  layoutScale = 1,
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

    let el: HTMLElement | null = null
    let ro: ResizeObserver | null = null

    const update = () => {
      const currentRoot = containerRef.current
      const nextEl = currentRoot ? findEl() : null
      if (!currentRoot || !nextEl) {
        ro?.disconnect()
        el = null
        setBox(null)
        return
      }
      if (nextEl !== el) {
        ro?.disconnect()
        el = nextEl
        ro = new ResizeObserver(update)
        ro.observe(el)
        ro.observe(currentRoot)
      }
      const next = measureBlockInRoot(el, currentRoot, layoutScale)
      setBox(prev => (prev && sameSectionBox(prev, next) ? prev : next))
    }

    update()
    const mo = new MutationObserver(update)
    mo.observe(root, { childList: true, subtree: true })
    window.addEventListener('resize', update)
    return () => {
      mo.disconnect()
      ro?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [blockId, containerRef, revision, layoutScale])

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
        zIndex: BUILDER_SECTION_CHROME_Z,
      }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}

/** Fixed portal at a block's top-right — sits above the section so it does not cover short blocks. */
export function BuilderSectionChromePortal({
  blockId,
  containerRef,
  revision,
  scrollRootRef,
  visible,
  dragOffset,
  portalRef,
  children,
}: {
  blockId: string
  containerRef: RefObject<HTMLElement | null>
  revision?: string
  scrollRootRef?: RefObject<HTMLElement | null>
  visible: boolean
  dragOffset?: { x: number; y: number }
  portalRef?: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  const [anchor, setAnchor] = useState<{ top: number; left: number; right: number; height: number } | null>(null)

  useLayoutEffect(() => {
    if (!visible) {
      setAnchor(null)
      return
    }

    const root = containerRef.current
    if (!root) {
      setAnchor(null)
      return
    }

    const findEl = () =>
      root.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null

    let el = findEl()
    if (!el) {
      setAnchor(null)
      return
    }

    const update = () => {
      const currentRoot = containerRef.current
      el = currentRoot ? findEl() : null
      if (!el) {
        setAnchor(null)
        return
      }
      const r = getBlockScreenRect(el)
      setAnchor({ top: r.top, left: r.left, right: r.right, height: r.height })
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    ro.observe(root)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    const scrollRoot = scrollRootRef?.current
    scrollRoot?.addEventListener('scroll', update, { passive: true })
    scrollRoot && ro.observe(scrollRoot)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      scrollRoot?.removeEventListener('scroll', update)
    }
  }, [blockId, containerRef, revision, scrollRootRef, visible])

  if (!visible || !anchor) return null

  const canvasRect = scrollRootRef?.current?.getBoundingClientRect() ?? null
  const frame = resolveSectionChromePortalFrame(anchor, canvasRect)

  return createPortal(
    <div
      ref={portalRef}
      className="pointer-events-auto"
      style={{
        position: 'fixed',
        top: frame.top,
        right: frame.right,
        transform: composeSectionChromeTransform(frame.transform, dragOffset),
        zIndex: BUILDER_SECTION_CHROME_Z,
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
  label,
  className,
  onContextMenu,
  onDragOver,
  onDrop,
  children,
  scrollRootRef,
  shellHeader,
  layoutScale = 1,
}: {
  blockId: string
  containerRef: RefObject<HTMLElement | null>
  revision?: string
  selected?: boolean
  /** Section photo is the active target — soften full-section ring so the image highlight reads clearly. */
  imageSelected?: boolean
  saving?: boolean
  /** False when section is hidden from the live site (still shown in builder). */
  visible?: boolean
  dropBefore?: boolean
  dropAfter?: boolean
  dragging?: boolean
  interactive?: boolean
  /** Shown on the canvas when this section is selected. */
  label?: string
  className?: string
  onContextMenu: (e: React.MouseEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  /** Nav / announcement bar live in a sticky z-50 shell — chrome must stack above it. */
  shellHeader?: boolean
  children?: ReactNode
  /** Canvas scroll container — keeps selection chrome aligned while panning. */
  scrollRootRef?: RefObject<HTMLElement | null>
  layoutScale?: number
}) {
  const box = useBuilderSectionBox(blockId, containerRef, revision, scrollRootRef, layoutScale)
  const isHidden = !visible

  if (!box) return null

  const overlayZIndex = shellHeader
    ? (selected ? 100 : 90)
    : (selected ? 50 : 40)

  return (
    <div
      className={cn(
        'absolute group pointer-events-none overflow-visible',
        interactive && 'pointer-events-auto cursor-pointer',
        isHidden
          ? 'ring-2 ring-inset ring-amber-400/80'
          : selected
            ? saving
              ? 'ring-[3px] ring-inset ring-amber-400'
              : imageSelected
                ? 'shadow-[inset_0_0_0_2px_rgba(156,163,175,0.7)]'
                : 'shadow-[inset_0_0_0_2px_#9ca3af]'
            : interactive && 'hover:shadow-[inset_0_0_0_2px_#d1d5db]',
        dropBefore && 'border-t-4 border-primary',
        dropAfter && 'border-b-4 border-primary',
        dragging && 'opacity-50',
        className,
      )}
      style={{
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        zIndex: overlayZIndex,
      }}
      onContextMenu={interactive ? onContextMenu : undefined}
      onDragOver={interactive ? onDragOver : undefined}
      onDrop={interactive ? onDrop : undefined}
    >
      {selected && label ? (
        <div
          className="pointer-events-none absolute left-0 top-0 z-[80] max-w-[min(100%,280px)] truncate rounded-br-md bg-primary px-2 py-0.5 text-[11px] font-semibold leading-tight text-white shadow-sm"
          title={label}
        >
          {label}
        </div>
      ) : null}
      {children}
    </div>
  )
}

/** Drag top/bottom section edges to adjust padding_top / padding_bottom. */
export function BuilderSectionPaddingHandles({
  blockId,
  containerRef,
  scrollRootRef,
  paddingTop,
  paddingBottom,
  canvasScale,
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
  /** Hide while a text/image field is active or a builder modal is open. */
  suppressed?: boolean
  onPaddingPreview: (patch: { padding_top?: number; padding_bottom?: number }) => void
  onPaddingCommit: (patch: { padding_top?: number; padding_bottom?: number }) => void
}) {
  // Box tracks ResizeObserver only — skip revision so padding ticks don't reset observers.
  const layoutScale = canvasScale > 0 ? canvasScale : 1
  const box = useBuilderSectionBox(blockId, containerRef, undefined, scrollRootRef, layoutScale)
  const [activeEdge, setActiveEdge] = useState<'top' | 'bottom' | null>(null)
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const dragRef = useRef<{
    edge: 'top' | 'bottom'
    startVal: number
    startHeight: number
    lastVal: number
    displayY: number
    rafId: number | null
    pendingPreview: { padding_top?: number; padding_bottom?: number } | null
  } | null>(null)
  const onPaddingPreviewRef = useRef(onPaddingPreview)
  const onPaddingCommitRef = useRef(onPaddingCommit)
  onPaddingPreviewRef.current = onPaddingPreview
  onPaddingCommitRef.current = onPaddingCommit

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

  // Keep drag pills inside the padding bands (not on the outer seam) so they do not
  // collide with the "+ Section" insert control between adjacent blocks.
  const topPillY = liveTop > 32
    ? liveTop / 2
    : Math.max(12, liveTop > 0 ? liveTop * 0.5 : 12)
  const bottomPillY = liveBottom > 32
    ? liveHeight - liveBottom / 2
    : liveHeight - Math.max(12, liveBottom > 0 ? liveBottom * 0.5 : 12)

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

    const hit = pointerInBlock(e.clientY, containerRef, blockId, layoutScale)
    if (!hit) return

    const startVal = clampDragPadding(edge === 'top' ? paddingTop : paddingBottom)
    const startY = edge === 'top' ? startVal : hit.height - startVal

    dragRef.current = {
      edge,
      startVal,
      startHeight: hit.height,
      lastVal: startVal,
      displayY: startY,
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
      const hitMove = pointerInBlock(ev.clientY, containerRef, blockId, layoutScale)
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
    value: number
    label: string
  }> = [
    { edge: 'top', value: liveTop, label: 'Section padding top' },
    { edge: 'bottom', value: liveBottom, label: 'Section padding bottom' },
  ]

  const renderHandlePill = (
    edge: 'top' | 'bottom',
    handleY: number,
    value: number,
    label: string,
  ) => {
    const active = activeEdge === edge

    return (
      <div
        key={edge}
        className={cn(
          'absolute left-0 right-0 touch-none select-none pointer-events-none',
          active ? 'z-[62]' : 'z-[61]',
        )}
        style={{
          top: handleY,
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
              {edge === 'top' ? '↑' : '↓'} {value}px
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

      {/* Seam guide lines and handle pills stay in-canvas (absolute) so they scroll
          with the section and never float over builder modals via a body portal. */}
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

      {edges.map(({ edge, value, label }) => {
        if (edge === 'bottom' && hideBottom) return null
        const pillY = edge === 'top' ? topPillY : bottomPillY
        return renderHandlePill(edge, pillY, value, label)
      })}

      {dragLabel && activeEdge && (
        <div
          className="pointer-events-none absolute left-1/2 z-[63] -translate-x-1/2 -translate-y-1/2 rounded-md bg-gray-900 px-2.5 py-1 text-[11px] font-mono text-white shadow-md"
          style={{ top: activeEdge === 'top' ? topHandleY : bottomHandleY }}
        >
          {dragLabel}
        </div>
      )}
    </>
  )
}
