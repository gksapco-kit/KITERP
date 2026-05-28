import { useCallback, useLayoutEffect, useState, type RefObject } from 'react'
import { measureViewportPanel, type ViewportPanelOptions, type ViewportPanelRect } from '@/lib/viewportPanel'

export function useViewportAnchoredPanel(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  options: Omit<ViewportPanelOptions, 'anchorEl'> = {},
) {
  const [pos, setPos] = useState<ViewportPanelRect | null>(null)

  const updatePos = useCallback(() => {
    setPos(
      measureViewportPanel({
        anchorEl: anchorRef.current,
        ...options,
      }),
    )
  }, [anchorRef, options.panelWidth, options.mobileBreakpoint, options.margin, options.gap, options.mobileTop])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    updatePos()
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [open, updatePos])

  return pos
}
