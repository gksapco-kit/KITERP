export type PanelBox = { top: number; left: number; width: number; height: number }

const DEFAULT_MARGIN = 12
const DEFAULT_PAD = 10

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function panelOverlapsRect(panel: PanelBox, rect: DOMRect, pad = DEFAULT_PAD): boolean {
  return !(
    panel.left + panel.width + pad <= rect.left
    || rect.right + pad <= panel.left
    || panel.top + panel.height + pad <= rect.top
    || rect.bottom + pad <= panel.top
  )
}

/** Live rects of other builder floating panels (toolbars, prompts, context menus). */
export function getFloatingUiObstacleRects(exclude?: Element | null): DOMRect[] {
  if (typeof document === 'undefined') return []
  const rects: DOMRect[] = []
  document.querySelectorAll('[data-builder-floating-ui]').forEach(el => {
    if (exclude && (el === exclude || exclude.contains(el))) return
    const r = el.getBoundingClientRect()
    if (r.width > 1 && r.height > 1) rects.push(r)
  })
  return rects
}

/**
 * Pick a viewport position for a floating panel near an anchor while avoiding
 * overlap with other builder floating UI.
 */
export function placeAnchoredPanel(
  anchor: { x: number; y: number } | null | undefined,
  panelWidth: number,
  panelHeight: number,
  opts?: { exclude?: Element | null; margin?: number },
): { top: number; left: number } {
  const margin = opts?.margin ?? DEFAULT_MARGIN
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const obstacles = getFloatingUiObstacleRects(opts?.exclude)

  const candidates: { top: number; left: number }[] = []

  if (anchor) {
    candidates.push({ left: anchor.x, top: anchor.y + margin })
    candidates.push({ left: anchor.x - panelWidth, top: anchor.y + margin })
    candidates.push({ left: anchor.x - panelWidth - margin, top: anchor.y })
    candidates.push({ left: anchor.x + margin, top: anchor.y })
    candidates.push({ left: anchor.x - panelWidth - margin, top: anchor.y - panelHeight - margin })
    candidates.push({ left: anchor.x, top: anchor.y - panelHeight - margin })
  }

  candidates.push({ left: (vw - panelWidth) / 2, top: Math.min(vh * 0.32, vh - panelHeight - margin) })
  candidates.push({ left: margin, top: margin })
  candidates.push({ left: vw - panelWidth - margin, top: margin })

  for (const c of candidates) {
    const placed: PanelBox = {
      left: clamp(c.left, margin, vw - panelWidth - margin),
      top: clamp(c.top, margin, vh - panelHeight - margin),
      width: panelWidth,
      height: panelHeight,
    }
    if (!obstacles.some(o => panelOverlapsRect(placed, o))) {
      return { top: placed.top, left: placed.left }
    }
  }

  return { left: margin, top: margin }
}

/**
 * Context menus should stay at the click point (with edge flip/clamp only).
 * Do not use obstacle avoidance — that makes the menu jump around the screen.
 */
export function placeContextMenu(
  anchor: { x: number; y: number },
  panelWidth: number,
  panelHeight: number,
  margin = 8,
): { top: number; left: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768

  let left = anchor.x
  let top = anchor.y

  if (left + panelWidth > vw - margin) {
    left = anchor.x - panelWidth
  }
  if (top + panelHeight > vh - margin) {
    top = anchor.y - panelHeight
  }

  return {
    left: clamp(left, margin, vw - panelWidth - margin),
    top: clamp(top, margin, vh - panelHeight - margin),
  }
}
