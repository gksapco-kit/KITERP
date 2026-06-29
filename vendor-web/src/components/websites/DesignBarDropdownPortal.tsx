import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/** Portals design-bar dropdowns to body so they aren't clipped by overflow-x-auto / section overflow. */
export function DesignBarDropdownPortal({
  open,
  anchorRef,
  menuRef,
  className,
  onClose,
  children,
}: {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  menuRef: RefObject<HTMLDivElement | null>
  className?: string
  /** Called when the user clicks outside the trigger and menu panel. */
  onClose?: () => void
  children: ReactNode
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open || !anchorRef.current) return
    const update = () => {
      const rect = anchorRef.current!.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, anchorRef])

  useEffect(() => {
    if (!open || !onClose) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (menuRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', handlePointerDown, true)
    return () => document.removeEventListener('mousedown', handlePointerDown, true)
  }, [open, onClose, anchorRef, menuRef])

  if (!open) return null

  return createPortal(
    <div
      ref={menuRef}
      data-block-design-bar
      data-block-design-bar-dropdown
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 100000 }}
      className={className}
      onMouseDown={e => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}
