import { createPortal } from 'react-dom'
import type { DragGuideLine } from '@/lib/canvasFieldDragSnap'

/** Figma-style alignment guides while dragging a positionable field. */
export function BuilderFieldDragGuides({
  blockRoot,
  guides,
}: {
  blockRoot: HTMLElement | null
  guides: DragGuideLine[]
}) {
  if (!blockRoot || guides.length === 0) return null

  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[65] overflow-visible" aria-hidden>
      {guides.map((guide, index) =>
        guide.axis === 'x' ? (
          <div
            key={`x-${index}-${guide.value}`}
            className="absolute w-px bg-fuchsia-500 shadow-[0_0_0_1px_rgba(255,255,255,0.85)]"
            style={{
              left: guide.value,
              top: guide.start,
              height: Math.max(1, guide.end - guide.start),
            }}
          />
        ) : (
          <div
            key={`y-${index}-${guide.value}`}
            className="absolute h-px bg-fuchsia-500 shadow-[0_0_0_1px_rgba(255,255,255,0.85)]"
            style={{
              top: guide.value,
              left: guide.start,
              width: Math.max(1, guide.end - guide.start),
            }}
          />
        ),
      )}
    </div>,
    blockRoot,
  )
}
