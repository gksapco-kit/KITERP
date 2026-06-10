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
  const [activeEdge, setActiveEdge] = useState<'top' | 'bottom' | null>(null)
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const dragRef = useRef<{
    edge: 'top' | 'bottom'
    startVal: number
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

  const liveTop = activeEdge === 'top' && dragRef.current
    ? dragRef.current.lastVal
    : clampDragPadding(paddingTop)
  const liveBottom = activeEdge === 'bottom' && dragRef.current
    ? dragRef.current.lastVal
    : clampDragPadding(paddingBottom)
  const topHandleY = activeEdge === 'top' && dragRef.current
    ? dragRef.current.displayY
    : liveTop
  const bottomHandleY = activeEdge === 'bottom' && dragRef.current
    ? dragRef.current.displayY
    : box.height - liveBottom
  const hideBottom = bottomHandleY <= topHandleY + 12

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

    const startVal = clampDragPadding(edge === 'top' ? paddingTop : paddingBottom)
    const startY = edge === 'top' ? startVal : hit.height - startVal

    dragRef.current = {
      edge,
      startVal,
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
      const hitMove = pointerInBlock(ev.clientY, containerRef, blockId)
      if (!hitMove) return
      const { pointerY, height } = hitMove
      const next = drag.edge === 'top'
        ? clampDragPadding(pointerY)
        : clampDragPadding(height - pointerY)
      const displayY = drag.edge === 'top' ? next : height - next

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

  const edges: Array<{ edge: 'top' | 'bottom'; y: number; value: number; label: string }> = [
    { edge: 'top', y: topHandleY, value: liveTop, label: 'Section padding top' },
    { edge: 'bottom', y: bottomHandleY, value: liveBottom, label: 'Section padding bottom' },
  ]

  return (
    <>
      {liveTop > 0 && (
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-[58] bg-primary/10 border-b border-primary/35"
          style={{ height: liveTop }}
          aria-hidden
        />
      )}
      {liveBottom > 0 && (
        <div
          className="pointer-events-none absolute left-0 right-0 bottom-0 z-[58] bg-primary/10 border-t border-primary/35"
          style={{ height: liveBottom }}
          aria-hidden
        />
      )}
      {edges.map(({ edge, y, value, label }) => {
        if (edge === 'bottom' && hideBottom) return null
        const active = activeEdge === edge
        return (
          <div
            key={edge}
            className={cn(
              'pointer-events-none absolute left-0 right-0 z-[60] touch-none select-none -translate-y-1/2',
              active && 'z-[62]',
            )}
            style={{ top: y }}
          >
            <div
              className={cn(
                'absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2',
                active ? 'bg-primary' : 'bg-primary/45',
              )}
              aria-hidden
            />
            <div
              data-section-padding-handle
              role="slider"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={SECTION_PADDING_MAX}
              aria-valuenow={value}
              title={`${edge === 'top' ? 'Space above content' : 'Space below content'} — drag to adjust (${value}px)`}
              className="group/pad pointer-events-auto absolute left-1/2 top-1/2 flex h-8 w-full max-w-[min(100%,280px)] -translate-x-1/2 -translate-y-1/2 cursor-ns-resize items-center justify-center"
              onPointerDown={e => startDrag(edge, e)}
            >
              <div
                className={cn(
                  'flex h-5 min-w-[4.5rem] px-2 items-center justify-center gap-1 rounded-full border-2 bg-white shadow-sm transition-all',
                  active ? 'border-primary ring-2 ring-primary/25 scale-105' : 'border-ring group-hover/pad:border-primary/60',
                )}
              >
                <span className="block h-0.5 w-3 rounded-full bg-primary/70 shrink-0" />
                <span className="text-[9px] font-bold uppercase tracking-wide text-primary/80">
                  {edge === 'top' ? '↑ space' : '↓ space'}
                </span>
              </div>
            </div>
          </div>
        )
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
