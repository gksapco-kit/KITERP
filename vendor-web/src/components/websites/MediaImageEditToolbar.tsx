import type { ReactNode } from 'react'
import { Crop, FlipHorizontal, FlipVertical, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hasImageEdits, type ImageEditTransform } from '@/lib/mediaImageEdit'

export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 3
export const ZOOM_STEP = 0.25

export const DEFAULT_IMAGE_TRANSFORM: ImageEditTransform = {
  rotation: 0,
  flipH: false,
  flipV: false,
}

function clampZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))
}

function ToolButton({
  title,
  onClick,
  disabled,
  active,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-white hover:text-gray-900 disabled:opacity-35',
        active && 'bg-white text-primary shadow-sm',
      )}
    >
      {children}
    </button>
  )
}

export function MediaImageEditToolbar({
  zoom,
  onZoomChange,
  transform,
  onTransformChange,
  onCrop,
  onReset,
  className,
}: {
  zoom: number
  onZoomChange: (zoom: number) => void
  transform: ImageEditTransform
  onTransformChange: (
    next: ImageEditTransform | ((prev: ImageEditTransform) => ImageEditTransform),
  ) => void
  onCrop?: () => void
  onReset?: () => void
  className?: string
}) {
  const editsDirty = hasImageEdits(transform)
  const canReset = editsDirty || zoom !== 1

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-0.5 rounded-xl border border-gray-100 bg-gray-50/90 px-1.5 py-1',
        className,
      )}
    >
      <ToolButton
        title="Zoom out"
        disabled={zoom <= ZOOM_MIN}
        onClick={() => onZoomChange(clampZoom(zoom - ZOOM_STEP))}
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </ToolButton>
      <span className="min-w-[2.75rem] select-none text-center text-[10px] font-medium tabular-nums text-gray-500">
        {Math.round(zoom * 100)}%
      </span>
      <ToolButton
        title="Zoom in"
        disabled={zoom >= ZOOM_MAX}
        onClick={() => onZoomChange(clampZoom(zoom + ZOOM_STEP))}
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </ToolButton>

      <div className="mx-0.5 h-5 w-px shrink-0 bg-gray-200" aria-hidden />

      <ToolButton
        title="Rotate left"
        onClick={() => onTransformChange(t => ({ ...t, rotation: t.rotation - 90 }))}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton
        title="Rotate right"
        onClick={() => onTransformChange(t => ({ ...t, rotation: t.rotation + 90 }))}
      >
        <RotateCw className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton
        title="Flip horizontal"
        active={transform.flipH}
        onClick={() => onTransformChange(t => ({ ...t, flipH: !t.flipH }))}
      >
        <FlipHorizontal className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton
        title="Flip vertical"
        active={transform.flipV}
        onClick={() => onTransformChange(t => ({ ...t, flipV: !t.flipV }))}
      >
        <FlipVertical className="h-3.5 w-3.5" />
      </ToolButton>

      {onCrop ? (
        <ToolButton title="Crop" onClick={onCrop}>
          <Crop className="h-3.5 w-3.5" />
        </ToolButton>
      ) : null}

      {onReset ? (
        <ToolButton title="Reset zoom & transforms" disabled={!canReset} onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5 opacity-70" />
        </ToolButton>
      ) : null}
    </div>
  )
}
