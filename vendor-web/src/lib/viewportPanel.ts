export type ViewportPanelRect = { top: number; left: number; width: number }

export type ViewportPanelOptions = {
  anchorEl: HTMLElement | null
  panelWidth?: number
  mobileBreakpoint?: number
  margin?: number
  gap?: number
  /** Below header on narrow screens (px from viewport top). */
  mobileTop?: number
}

/** Position a fixed panel so it stays fully visible on mobile, tablet, and desktop. */
export function measureViewportPanel({
  anchorEl,
  panelWidth = 320,
  mobileBreakpoint = 640,
  margin = 8,
  gap = 6,
  mobileTop = 56 + gap,
}: ViewportPanelOptions): ViewportPanelRect | null {
  if (typeof window === 'undefined') return null

  const vw = window.innerWidth
  const isMobile = vw < mobileBreakpoint

  if (isMobile) {
    return {
      top: mobileTop,
      left: margin,
      width: vw - margin * 2,
    }
  }

  if (!anchorEl) return null

  const rect = anchorEl.getBoundingClientRect()
  const width = Math.min(panelWidth, vw - margin * 2)
  let left = rect.right - width
  left = Math.max(margin, Math.min(left, vw - width - margin))

  return {
    top: rect.bottom + gap,
    left,
    width,
  }
}

export function viewportBreakpointLabel(width: number): string {
  if (width < 640) return 'Mobile'
  if (width < 768) return 'Large phone'
  if (width < 1024) return 'Tablet'
  if (width < 1280) return 'Laptop'
  if (width < 1536) return 'Desktop'
  return 'Wide desktop'
}
