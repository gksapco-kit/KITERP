import { Copy, GripVertical, MoveDiagonal, Trash2 } from 'lucide-react'
import { useBlockSizeResize, type BlockSizePatch } from './useBlockSizeResize'

function CornerButton({
  className,
  label,
  onClick,
  onPointerDown,
  children,
}: {
  className: string
  label: string
  onClick?: (e: React.MouseEvent) => void
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`absolute z-30 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition hover:bg-gray-50 hover:text-gray-900 ${className}`}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(e)
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onPointerDown?.(e)
      }}
    >
      {children}
    </button>
  )
}

interface BlockSelectionFrameProps {
  label: string
  containerRef: React.RefObject<HTMLElement | null>
  currentWidth?: string
  currentHeight?: string
  onResizeStart: () => void
  onResize: (size: BlockSizePatch) => void
  onResizeEnd: (size: BlockSizePatch) => void
  onResizeCancel: () => void
  onDelete: () => void
  onDuplicate: () => void
  dragHandleRef?: (element: HTMLElement | null) => void
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
}

export function BlockSelectionFrame({
  label,
  containerRef,
  currentWidth,
  currentHeight,
  onResizeStart,
  onResize,
  onResizeEnd,
  onResizeCancel,
  onDelete,
  onDuplicate,
  dragHandleRef,
  dragHandleProps,
}: BlockSelectionFrameProps) {
  const { onResizePointerDown } = useBlockSizeResize({
    containerRef,
    currentWidth,
    currentHeight,
    onResizeStart,
    onResize,
    onResizeEnd,
    onResizeCancel,
  })

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-20 rounded-sm border-2 border-brand-500/80 ring-1 ring-brand-400/30"
        aria-hidden
      />

      {/* Compact pill in the gap above the block — does not cover content */}
      <div
        className="pointer-events-auto absolute bottom-full left-1/2 z-30 mb-2 flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-full border border-gray-200 bg-white px-1 py-0.5 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          ref={dragHandleRef}
          aria-label="Drag to reorder"
          className="flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          {...dragHandleProps}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="max-w-[8rem] truncate px-1 text-[10px] font-medium text-gray-700 sm:max-w-[10rem]">
          {label}
        </span>
        <button
          type="button"
          aria-label="Duplicate block"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate()
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Delete block"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-600"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <CornerButton
        className="bottom-2 right-2 cursor-nwse-resize"
        label="Resize width and height"
        onPointerDown={onResizePointerDown}
      >
        <MoveDiagonal className="h-3.5 w-3.5" />
      </CornerButton>
    </>
  )
}
