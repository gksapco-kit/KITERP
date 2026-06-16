import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Move } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CONTENT_GROUP_FIELD_KEY,
  FIELD_OFFSET_MAX_PX,
  contentGroupWrapperStyle,
  readFieldOffset,
} from '@/lib/fieldTextStyles'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { mergeDragPreviewTransform, pointerDeltaInCanvas } from '@/lib/canvasPointerDelta'
import {
  rectRelativeToBlock,
  resolveFieldDragSnap,
  type DragGuideLine,
  type SnapRect,
} from '@/lib/canvasFieldDragSnap'
import { BuilderFieldDragGuides } from '@/components/builder/BuilderFieldDragGuides'

/** Wraps editable content in a section — move headline, copy, and CTAs together. */
export function BuilderContentGroup({
  blockId,
  blockProps,
  children,
  className,
  style,
}: {
  blockId?: string
  blockProps?: Record<string, unknown>
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const ctx = useBuilderCanvas()
  const canvasScale = ctx?.canvasScale ?? 1
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number } | null>(null)
  const dragDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragStartRef = useRef<{
    x: number
    y: number
    ox: number
    oy: number
    startRect: SnapRect
    blockRoot: HTMLElement
  } | null>(null)
  const [snapGuides, setSnapGuides] = useState<DragGuideLine[]>([])
  const [guideBlockRoot, setGuideBlockRoot] = useState<HTMLElement | null>(null)

  const isEditor = ctx?.isEditorCanvas && !!blockId
  const isActive = isEditor
    && ctx?.activeBlockId === blockId
    && ((ctx?.activeTextFields ?? []).includes(CONTENT_GROUP_FIELD_KEY) || ctx?.activeTextField === CONTENT_GROUP_FIELD_KEY)

  const storedOffsetX = readFieldOffset(blockProps?.content_offset_x)
  const storedOffsetY = readFieldOffset(blockProps?.content_offset_y)

  const activate = useCallback((additive = false) => {
    if (!isEditor || !blockId) return
    ctx?.onTextFieldActivate?.(blockId, CONTENT_GROUP_FIELD_KEY, { additive: false })
  }, [isEditor, blockId, ctx])

  const finishDrag = useCallback(() => {
    const start = dragStartRef.current
    if (!start) return
    const dx = dragDeltaRef.current.x
    const dy = dragDeltaRef.current.y
    dragStartRef.current = null
    dragDeltaRef.current = { x: 0, y: 0 }
    setDragDelta(null)
    setSnapGuides([])
    setGuideBlockRoot(null)
    if (!blockId || !ctx?.onTextFieldStylePatch) return
    const nextX = Math.max(-FIELD_OFFSET_MAX_PX, Math.min(FIELD_OFFSET_MAX_PX, start.ox + dx))
    const nextY = Math.max(-FIELD_OFFSET_MAX_PX, Math.min(FIELD_OFFSET_MAX_PX, start.oy + dy))
    if (nextX === start.ox && nextY === start.oy) return
    ctx.onTextFieldStylePatch(blockId, CONTENT_GROUP_FIELD_KEY, {
      field_offset_x: nextX === 0 ? null : nextX,
      field_offset_y: nextY === 0 ? null : nextY,
    })
  }, [blockId, ctx])

  useEffect(() => {
    if (!dragStartRef.current) return
    const onUp = () => finishDrag()
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [finishDrag, dragDelta])

  const handleDragPointerDown = (e: ReactPointerEvent) => {
    if (!isActive || !blockId) return
    const el = e.currentTarget.closest('[data-field-layout]') as HTMLElement | null
    const blockRoot = el?.closest('[data-block-id]') as HTMLElement | null
    if (!el || !blockRoot) return
    e.preventDefault()
    e.stopPropagation()
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: storedOffsetX,
      oy: storedOffsetY,
      startRect: rectRelativeToBlock(el, blockRoot, canvasScale),
      blockRoot,
    }
    dragDeltaRef.current = { x: 0, y: 0 }
    setDragDelta({ x: 0, y: 0 })
    setSnapGuides([])
    setGuideBlockRoot(blockRoot)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleDragPointerMove = (e: ReactPointerEvent) => {
    const start = dragStartRef.current
    const el = e.currentTarget.closest('[data-field-layout]') as HTMLElement | null
    if (!start || !el) return
    e.preventDefault()
    e.stopPropagation()
    const raw = pointerDeltaInCanvas(e.clientX, e.clientY, start.x, start.y, canvasScale)
    const snapped = resolveFieldDragSnap(el, start.startRect, raw, canvasScale)
    dragDeltaRef.current = snapped.delta
    setDragDelta(snapped.delta)
    setSnapGuides(snapped.guides)
  }

  const baseWrapperStyle = blockProps
    ? contentGroupWrapperStyle(blockProps, style)
    : style
  const wrapperStyle = mergeDragPreviewTransform(baseWrapperStyle, dragDelta)
  const isDragging = dragDelta != null && (dragDelta.x !== 0 || dragDelta.y !== 0)

  if (!isEditor) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <div
      data-content-group="true"
      data-field-layout={CONTENT_GROUP_FIELD_KEY}
      data-field-drag-preview={isDragging ? 'true' : undefined}
      className={cn(
        className,
        isActive && 'ring-2 ring-primary/50 ring-offset-2 rounded-sm z-[2]',
      )}
      style={wrapperStyle ?? style}
      onMouseDown={(e: React.MouseEvent) => {
        const t = e.target as HTMLElement
        if (t.closest('[data-text-key], [data-builder-cta-shell], button')) return
        e.stopPropagation()
      }}
      onClick={(e: React.MouseEvent) => {
        const t = e.target as HTMLElement
        if (t.closest('[data-text-key], [data-builder-cta-shell], button')) return
        e.stopPropagation()
        activate(false)
      }}
    >
      {isActive && (
        <button
          type="button"
          title="Drag to move all content"
          className={cn(
            'absolute -left-2 -top-2 z-30 flex h-5 w-5 items-center justify-center rounded border border-primary/40 bg-white text-primary shadow-sm',
            'cursor-move opacity-90 hover:bg-primary/5',
            dragStartRef.current && 'ring-2 ring-primary/40',
          )}
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={() => finishDrag()}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <Move className="h-3 w-3" strokeWidth={2.5} />
        </button>
      )}
      {children}
      <BuilderFieldDragGuides blockRoot={guideBlockRoot} guides={snapGuides} />
    </div>
  )
}
