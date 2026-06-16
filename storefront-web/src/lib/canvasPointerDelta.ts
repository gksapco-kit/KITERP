import type { CSSProperties } from 'react'

/** Screen pointer delta → canvas-local px (undo CSS scale on the builder preview). */
export function pointerDeltaInCanvas(
  clientX: number,
  clientY: number,
  startX: number,
  startY: number,
  canvasScale: number,
): { x: number; y: number } {
  const scale = canvasScale > 0 ? canvasScale : 1
  return {
    x: (clientX - startX) / scale,
    y: (clientY - startY) / scale,
  }
}

/** Live drag preview — translate avoids fighting stored left/top rules with !important. */
export function mergeDragPreviewTransform(
  base: CSSProperties | undefined,
  delta: { x: number; y: number } | null,
): CSSProperties | undefined {
  if (!delta || (delta.x === 0 && delta.y === 0)) return base
  const drag = `translate(${delta.x}px, ${delta.y}px)`
  const existing = base?.transform
  return {
    ...(base ?? {}),
    transform: existing && existing !== 'none' ? `${existing} ${drag}` : drag,
  }
}
