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
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number } | null>(null)
  const dragDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

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
    e.preventDefault()
    e.stopPropagation()
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: storedOffsetX,
      oy: storedOffsetY,
    }
    dragDeltaRef.current = { x: 0, y: 0 }
    setDragDelta({ x: 0, y: 0 })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleDragPointerMove = (e: ReactPointerEvent) => {
    const start = dragStartRef.current
    if (!start) return
    e.preventDefault()
    e.stopPropagation()
    const next = { x: e.clientX - start.x, y: e.clientY - start.y }
    dragDeltaRef.current = next
    setDragDelta(next)
  }

  const dragPreviewStyle: CSSProperties | undefined = dragDelta
    ? { left: storedOffsetX + dragDelta.x, top: storedOffsetY + dragDelta.y }
    : undefined

  const wrapperStyle = blockProps
    ? contentGroupWrapperStyle(blockProps, { ...style, ...dragPreviewStyle })
    : { ...style, ...dragPreviewStyle }

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
      className={cn(
        className,
        isActive && 'ring-1 ring-primary/25 ring-offset-2 rounded-sm',
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
    </div>
  )
}
