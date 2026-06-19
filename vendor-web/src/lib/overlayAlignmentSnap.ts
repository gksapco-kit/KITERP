// Figma-style alignment snapping for inserted overlay elements (buttons, text,
// images, icons, …) on the website builder canvas.
//
// Overlay items already live in the canvas container's pixel coordinate space
// (item.x / item.y / item.w / item.h), so — unlike the storefront field snapper —
// no scale conversion is needed here. The dragged/resized item snaps to:
//   • every sibling overlay's left / center / right and top / middle / bottom
//   • the container's own edges and center (so items can center on the section)

export type OverlayBox = { x: number; y: number; w: number; h: number }

export type OverlayRect = {
  left: number
  top: number
  right: number
  bottom: number
  centerX: number
  centerY: number
}

export type OverlayGuideLine =
  | { axis: 'x'; value: number; start: number; end: number }
  | { axis: 'y'; value: number; start: number; end: number }

export const OVERLAY_SNAP_THRESHOLD_PX = 6

export function rectFromBox(box: OverlayBox): OverlayRect {
  return {
    left: box.x,
    top: box.y,
    right: box.x + box.w,
    bottom: box.y + box.h,
    centerX: box.x + box.w / 2,
    centerY: box.y + box.h / 2,
  }
}

/** Build snap targets from sibling overlays and the canvas container itself. */
export function collectOverlayTargets(
  siblings: OverlayBox[],
  containerW: number,
  containerH: number,
): OverlayRect[] {
  const targets = siblings.map(rectFromBox)
  if (containerW > 0 && containerH > 0) {
    targets.push({
      left: 0,
      top: 0,
      right: containerW,
      bottom: containerH,
      centerX: containerW / 2,
      centerY: containerH / 2,
    })
  }
  return targets
}

function axisEdges(r: OverlayRect, axis: 'x' | 'y'): number[] {
  return axis === 'x'
    ? [r.left, r.centerX, r.right]
    : [r.top, r.centerY, r.bottom]
}

/** Nearest snap offset for one axis (or 0 when nothing is within threshold). */
function snapOffset(
  moving: OverlayRect,
  targets: OverlayRect[],
  axis: 'x' | 'y',
  threshold: number,
): number {
  const movEdges = axisEdges(moving, axis)
  let bestOffset = 0
  let bestDist = threshold + 1
  for (const t of targets) {
    const tgEdges = axisEdges(t, axis)
    for (const m of movEdges) {
      for (const g of tgEdges) {
        const d = Math.abs(m - g)
        if (d <= threshold && d < bestDist) {
          bestDist = d
          bestOffset = g - m
        }
      }
    }
  }
  return bestDist <= threshold ? bestOffset : 0
}

/** Guide lines for every aligned edge of the (already-snapped) moving rect. */
function buildGuides(
  moving: OverlayRect,
  targets: OverlayRect[],
  threshold: number,
): OverlayGuideLine[] {
  const guides: OverlayGuideLine[] = []
  const pushUnique = (g: OverlayGuideLine) => {
    if (!guides.some(e => e.axis === g.axis && Math.abs(e.value - g.value) < 0.5)) {
      guides.push(g)
    }
  }

  for (const t of targets) {
    // Vertical guides (x alignment)
    for (const m of axisEdges(moving, 'x')) {
      for (const g of axisEdges(t, 'x')) {
        if (Math.abs(m - g) > threshold) continue
        pushUnique({
          axis: 'x',
          value: g,
          start: Math.min(moving.top, t.top),
          end: Math.max(moving.bottom, t.bottom),
        })
      }
    }
    // Horizontal guides (y alignment)
    for (const m of axisEdges(moving, 'y')) {
      for (const g of axisEdges(t, 'y')) {
        if (Math.abs(m - g) > threshold) continue
        pushUnique({
          axis: 'y',
          value: g,
          start: Math.min(moving.left, t.left),
          end: Math.max(moving.right, t.right),
        })
      }
    }
  }
  return guides
}

/** Snap a freely-dragged overlay box; returns the snapped x/y and guide lines. */
export function snapOverlayDrag(
  box: OverlayBox,
  targets: OverlayRect[],
  threshold = OVERLAY_SNAP_THRESHOLD_PX,
): { x: number; y: number; guides: OverlayGuideLine[] } {
  const raw = rectFromBox(box)
  const dx = snapOffset(raw, targets, 'x', threshold)
  const dy = snapOffset(raw, targets, 'y', threshold)
  const snappedBox: OverlayBox = { ...box, x: box.x + dx, y: box.y + dy }
  const snapped = rectFromBox(snappedBox)
  return { x: snappedBox.x, y: snappedBox.y, guides: buildGuides(snapped, targets, threshold) }
}

/** Snap the edge(s) being dragged during a resize; returns snapped box + guides. */
export function snapOverlayResize(
  box: OverlayBox,
  targets: OverlayRect[],
  handle: string,
  minW = 40,
  minH = 20,
  threshold = OVERLAY_SNAP_THRESHOLD_PX,
): { x: number; y: number; w: number; h: number; guides: OverlayGuideLine[] } {
  let { x, y, w, h } = box
  const guides: OverlayGuideLine[] = []
  const pushUnique = (g: OverlayGuideLine) => {
    if (!guides.some(e => e.axis === g.axis && Math.abs(e.value - g.value) < 0.5)) {
      guides.push(g)
    }
  }

  const nearestEdge = (value: number, axis: 'x' | 'y'): number | null => {
    let best: number | null = null
    let bestDist = threshold + 1
    for (const t of targets) {
      for (const g of axisEdges(t, axis)) {
        const d = Math.abs(value - g)
        if (d <= threshold && d < bestDist) {
          bestDist = d
          best = g
        }
      }
    }
    return best
  }

  if (handle.includes('e')) {
    const snap = nearestEdge(x + w, 'x')
    if (snap != null) {
      w = Math.max(minW, snap - x)
      pushUnique({ axis: 'x', value: snap, start: y, end: y + h })
    }
  }
  if (handle.includes('w')) {
    const snap = nearestEdge(x, 'x')
    if (snap != null) {
      const right = x + w
      x = Math.min(snap, right - minW)
      w = right - x
      pushUnique({ axis: 'x', value: x, start: y, end: y + h })
    }
  }
  if (handle.includes('s')) {
    const snap = nearestEdge(y + h, 'y')
    if (snap != null) {
      h = Math.max(minH, snap - y)
      pushUnique({ axis: 'y', value: snap, start: x, end: x + w })
    }
  }
  if (handle.includes('n')) {
    const snap = nearestEdge(y, 'y')
    if (snap != null) {
      const bottom = y + h
      y = Math.min(snap, bottom - minH)
      h = bottom - y
      pushUnique({ axis: 'y', value: y, start: x, end: x + w })
    }
  }

  return { x, y, w, h, guides }
}
