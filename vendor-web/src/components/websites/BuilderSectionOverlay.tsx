import { type RefObject, useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

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
