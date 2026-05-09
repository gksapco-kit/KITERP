/**
 * DragHandle
 *
 * A thin vertical divider with a grab cursor used between resizable panels.
 * Drop it between any two flex children and pass the startResize callback
 * from usePanelResize.
 *
 * Props:
 *   onMouseDown  — pass `e => startResize(panelIdx, e.clientX)`
 *   className    — optional extra classes (e.g. height overrides)
 */

import React from 'react'

interface DragHandleProps {
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
  className?: string
}

export function DragHandle({ onMouseDown, className = '' }: DragHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`group relative shrink-0 flex items-center justify-center z-10 ${className}`}
      style={{ width: 10, cursor: 'col-resize' }}
      title="Drag to resize"
    >
      {/* Visible line */}
      <div
        className="w-px bg-gray-200 group-hover:bg-violet-400 group-active:bg-violet-600 transition-colors"
        style={{ height: '100%' }}
      />
      {/* Grip dots (appear on hover) */}
      <div className="absolute flex flex-col gap-0.5 items-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="w-1 h-1 rounded-full bg-violet-400" />
        ))}
      </div>
    </div>
  )
}
