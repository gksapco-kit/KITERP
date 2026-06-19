export type SnapRect = {
  left: number
  top: number
  right: number
  bottom: number
  centerX: number
  centerY: number
}

export type DragGuideLine =
  | { axis: 'x'; value: number; start: number; end: number }
  | { axis: 'y'; value: number; start: number; end: number }

export const FIELD_DRAG_SNAP_THRESHOLD_PX = 6

export function rectRelativeToBlock(
  el: HTMLElement,
  blockRoot: HTMLElement,
  canvasScale: number,
): SnapRect {
  const scale = canvasScale > 0 ? canvasScale : 1
  const er = el.getBoundingClientRect()
  const br = blockRoot.getBoundingClientRect()
  const left = (er.left - br.left) / scale
  const top = (er.top - br.top) / scale
  const width = er.width / scale
  const height = er.height / scale
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  }
}

export function collectFieldSnapTargets(
  blockRoot: HTMLElement,
  excludeEl: HTMLElement,
  canvasScale: number,
): SnapRect[] {
  const targets: SnapRect[] = []
  blockRoot.querySelectorAll('[data-field-layout]').forEach(node => {
    if (!(node instanceof HTMLElement)) return
    if (node === excludeEl || excludeEl.contains(node)) return
    targets.push(rectRelativeToBlock(node, blockRoot, canvasScale))
  })
  return targets
}

function movingRect(startRect: SnapRect, dx: number, dy: number): SnapRect {
  return {
    left: startRect.left + dx,
    top: startRect.top + dy,
    right: startRect.right + dx,
    bottom: startRect.bottom + dy,
    centerX: startRect.centerX + dx,
    centerY: startRect.centerY + dy,
  }
}

type Edge = { value: number }

function rectEdges(r: SnapRect, axis: 'x' | 'y'): Edge[] {
  return axis === 'x'
    ? [{ value: r.left }, { value: r.centerX }, { value: r.right }]
    : [{ value: r.top }, { value: r.centerY }, { value: r.bottom }]
}

function buildGuidesForAxis(
  snappedRect: SnapRect,
  axis: 'x' | 'y',
  targets: SnapRect[],
  threshold: number,
): DragGuideLine[] {
  const guides: DragGuideLine[] = []
  const movingEdges = rectEdges(snappedRect, axis)

  for (const target of targets) {
    const targetEdges = rectEdges(target, axis)
    for (const mv of movingEdges) {
      for (const tg of targetEdges) {
        if (Math.abs(mv.value - tg.value) > threshold) continue
        const extentStart = Math.min(
          axis === 'x' ? snappedRect.top : snappedRect.left,
          axis === 'x' ? target.top : target.left,
        )
        const extentEnd = Math.max(
          axis === 'x' ? snappedRect.bottom : snappedRect.right,
          axis === 'x' ? target.bottom : target.right,
        )
        const guide: DragGuideLine =
          axis === 'x'
            ? { axis: 'x', value: tg.value, start: extentStart, end: extentEnd }
            : { axis: 'y', value: tg.value, start: extentStart, end: extentEnd }
        const exists = guides.some(g =>
          g.axis === guide.axis && Math.abs((g.axis === 'x' ? g.value : g.value) - (guide.axis === 'x' ? guide.value : guide.value)) < 0.5,
        )
        if (!exists) guides.push(guide)
      }
    }
  }

  return guides
}

function snapAxis(
  startRect: SnapRect,
  rawDelta: number,
  axis: 'x' | 'y',
  targets: SnapRect[],
  threshold: number,
): { delta: number; guides: DragGuideLine[] } {
  let bestDelta = rawDelta
  let bestDistance = threshold + 1

  const moving = movingRect(startRect, axis === 'x' ? rawDelta : 0, axis === 'y' ? rawDelta : 0)
  const movingEdges = rectEdges(moving, axis)

  for (const target of targets) {
    const targetEdges = rectEdges(target, axis)
    for (const mv of movingEdges) {
      for (const tg of targetEdges) {
        const distance = Math.abs(mv.value - tg.value)
        if (distance > threshold) continue
        if (distance < bestDistance) {
          bestDistance = distance
          bestDelta = rawDelta + (tg.value - mv.value)
        }
      }
    }
  }

  const snappedRect = movingRect(
    startRect,
    axis === 'x' ? bestDelta : 0,
    axis === 'y' ? bestDelta : 0,
  )
  return {
    delta: bestDelta,
    guides: buildGuidesForAxis(snappedRect, axis, targets, threshold),
  }
}

/** Snap drag delta to sibling field edges / centers; returns alignment guide lines. */
export function snapFieldDragDelta(
  startRect: SnapRect,
  rawDx: number,
  rawDy: number,
  targets: SnapRect[],
  threshold = FIELD_DRAG_SNAP_THRESHOLD_PX,
): { dx: number; dy: number; guides: DragGuideLine[] } {
  const snapX = snapAxis(startRect, rawDx, 'x', targets, threshold)
  const snapY = snapAxis(startRect, rawDy, 'y', targets, threshold)
  return {
    dx: snapX.delta,
    dy: snapY.delta,
    guides: [...snapX.guides, ...snapY.guides],
  }
}

export function resolveFieldDragSnap(
  wrapperEl: HTMLElement,
  startRect: SnapRect,
  rawDelta: { x: number; y: number },
  canvasScale: number,
): { delta: { x: number; y: number }; guides: DragGuideLine[] } {
  const blockRoot = wrapperEl.closest('[data-block-id]') as HTMLElement | null
  if (!blockRoot) return { delta: rawDelta, guides: [] }

  const targets = collectFieldSnapTargets(blockRoot, wrapperEl, canvasScale)
  // Section-relative target so a field can always snap to the section's
  // centre/edges — not just to sibling fields. Prefer an explicit content box if
  // one exists; otherwise fall back to the section root, which is present in
  // every block. (Without this fallback the guides only appeared in sections that
  // happened to have a `.builder-block-content` element — i.e. none of them.)
  const contentEl =
    (blockRoot.querySelector('.builder-block-content') as HTMLElement | null) ?? blockRoot
  targets.push(rectRelativeToBlock(contentEl, blockRoot, canvasScale))

  const snapped = snapFieldDragDelta(startRect, rawDelta.x, rawDelta.y, targets)
  return { delta: { x: snapped.dx, y: snapped.dy }, guides: snapped.guides }
}
