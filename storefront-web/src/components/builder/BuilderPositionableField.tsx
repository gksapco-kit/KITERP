import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Move } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CONTENT_GROUP_FIELD_KEY,
  FIELD_MIN_HEIGHT_MAX_PX,
  FIELD_MIN_HEIGHT_MIN_PX,
  FIELD_OFFSET_MAX_PX,
  FIELD_WIDTH_MAX_PCT,
  FIELD_WIDTH_MIN_PCT,
  fieldLayoutWrapperStyle,
  readFieldMinHeight,
  readFieldOffset,
  readFieldWidthPct,
} from '@/lib/fieldTextStyles'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isMultiSelectModifier } from '@/lib/builderMultiSelect'

type ResizeAxis = 'width' | 'height' | 'both'

function clampWidthPct(parentWidth: number, widthPx: number): number {
  if (parentWidth <= 0) return FIELD_WIDTH_MAX_PCT
  const pct = Math.round((widthPx / parentWidth) * 100)
  return Math.max(FIELD_WIDTH_MIN_PCT, Math.min(FIELD_WIDTH_MAX_PCT, pct))
}

/** Drag handle + offset wrapper for canvas fields (text, buttons, etc.). */
export function BuilderPositionableField({
  fieldKey,
  blockId,
  blockProps,
  children,
  className,
  inline = false,
  onClick,
}: {
  fieldKey: string
  blockId?: string
  blockProps?: Record<string, unknown>
  children: ReactNode
  className?: string
  /** Inline layout for buttons/chips in a flex row (no full-width wrapper). */
  inline?: boolean
  onClick?: (e: React.MouseEvent) => void
}) {
  const ctx = useBuilderCanvas()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number } | null>(null)
  const [widthPreviewPx, setWidthPreviewPx] = useState<number | null>(null)
  const [heightPreviewPx, setHeightPreviewPx] = useState<number | null>(null)
  const dragDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const resizeStartRef = useRef<{
    axis: ResizeAxis
    startX: number
    startY: number
    startWidth: number
    startHeight: number
    parentWidth: number
  } | null>(null)

  const isEditor = ctx?.isEditorCanvas && !!blockId
  const isActive = isEditor
    && ctx?.activeBlockId === blockId
    && ((ctx?.activeTextFields ?? []).includes(fieldKey) || ctx?.activeTextField === fieldKey)

  const fieldStyles = (blockProps?._field_styles as Record<string, Record<string, unknown>> | undefined) || {}
  const fieldStyle = fieldStyles[fieldKey] || {}
  const storedOffsetX = readFieldOffset(fieldStyle.field_offset_x)
  const storedOffsetY = readFieldOffset(fieldStyle.field_offset_y)
  const storedWidthPct = readFieldWidthPct(fieldStyle.field_width_pct)
  const storedMinHeight = readFieldMinHeight(fieldStyle.field_min_height)

  const activate = useCallback((additive = false) => {
    if (!isEditor || !blockId) return
    ctx?.onTextFieldActivate?.(blockId, fieldKey, { additive })
  }, [isEditor, blockId, ctx, fieldKey])

  const finishDrag = useCallback(() => {
    const start = dragStartRef.current
    if (!start) return
    const dx = dragDeltaRef.current.x
    const dy = dragDeltaRef.current.y
    dragStartRef.current = null
    dragDeltaRef.current = { x: 0, y: 0 }
    setDragDelta(null)
    if (!blockId || !ctx?.onTextFieldStylePatch) return
    if (dx === 0 && dy === 0) return

    const selected = (ctx.activeTextFields ?? []).filter(k => k !== CONTENT_GROUP_FIELD_KEY)
    const batchKeys =
      selected.length > 1 && selected.includes(fieldKey)
        ? selected
        : [fieldKey]

    const patchOne = (fk: string, ox: number, oy: number) => {
      const nextX = Math.max(-FIELD_OFFSET_MAX_PX, Math.min(FIELD_OFFSET_MAX_PX, ox + dx))
      const nextY = Math.max(-FIELD_OFFSET_MAX_PX, Math.min(FIELD_OFFSET_MAX_PX, oy + dy))
      if (nextX === ox && nextY === oy) return null
      return {
        field_offset_x: nextX === 0 ? null : nextX,
        field_offset_y: nextY === 0 ? null : nextY,
      }
    }

    if (batchKeys.length > 1 && ctx.onTextFieldBatchStylePatch) {
      const styles = (blockProps?._field_styles as Record<string, Record<string, unknown>>) || {}
      const merged: Record<string, Record<string, unknown>> = {}
      batchKeys.forEach(fk => {
        const ox = readFieldOffset(styles[fk]?.field_offset_x)
        const oy = readFieldOffset(styles[fk]?.field_offset_y)
        const p = patchOne(fk, ox, oy)
        if (p) merged[fk] = p
      })
      if (Object.keys(merged).length) {
        ctx.onTextFieldBatchStylePatch(blockId, merged)
      }
      return
    }

    const nextX = Math.max(-FIELD_OFFSET_MAX_PX, Math.min(FIELD_OFFSET_MAX_PX, start.ox + dx))
    const nextY = Math.max(-FIELD_OFFSET_MAX_PX, Math.min(FIELD_OFFSET_MAX_PX, start.oy + dy))
    if (nextX === start.ox && nextY === start.oy) return
    ctx.onTextFieldStylePatch(blockId, fieldKey, {
      field_offset_x: nextX === 0 ? null : nextX,
      field_offset_y: nextY === 0 ? null : nextY,
    })
  }, [blockId, blockProps, ctx, fieldKey])

  const finishResize = useCallback(() => {
    const start = resizeStartRef.current
    const el = wrapperRef.current
    if (!start || !el || !blockId || !ctx?.onTextFieldStylePatch) {
      resizeStartRef.current = null
      setWidthPreviewPx(null)
      setHeightPreviewPx(null)
      return
    }

    const patch: Record<string, unknown> = {}
    if (start.axis === 'width' || start.axis === 'both') {
      const widthPx = widthPreviewPx ?? el.offsetWidth
      const pct = clampWidthPct(start.parentWidth, widthPx)
      patch.field_width_pct = pct
    }
    if (start.axis === 'height' || start.axis === 'both') {
      const heightPx = heightPreviewPx ?? el.offsetHeight
      const minH = Math.max(
        FIELD_MIN_HEIGHT_MIN_PX,
        Math.min(FIELD_MIN_HEIGHT_MAX_PX, Math.round(heightPx)),
      )
      patch.field_min_height = minH
    }

    resizeStartRef.current = null
    setWidthPreviewPx(null)
    setHeightPreviewPx(null)

    if (Object.keys(patch).length) {
      ctx.onTextFieldStylePatch(blockId, fieldKey, patch)
    }
  }, [blockId, ctx, fieldKey, heightPreviewPx, widthPreviewPx])

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

  useEffect(() => {
    if (!resizeStartRef.current) return
    const onUp = () => finishResize()
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [finishResize, widthPreviewPx, heightPreviewPx])

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
    const next = {
      x: e.clientX - start.x,
      y: e.clientY - start.y,
    }
    dragDeltaRef.current = next
    setDragDelta(next)
  }

  const handleResizePointerDown = (axis: ResizeAxis) => (e: ReactPointerEvent) => {
    if (!isActive || !blockId || inline) return
    const el = wrapperRef.current
    const parent = el?.parentElement
    if (!el || !parent) return
    e.preventDefault()
    e.stopPropagation()
    resizeStartRef.current = {
      axis,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: el.offsetWidth,
      startHeight: el.offsetHeight,
      parentWidth: parent.clientWidth,
    }
    setWidthPreviewPx(el.offsetWidth)
    setHeightPreviewPx(el.offsetHeight)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleResizePointerMove = (e: ReactPointerEvent) => {
    const start = resizeStartRef.current
    if (!start) return
    e.preventDefault()
    e.stopPropagation()
    const dx = e.clientX - start.startX
    const dy = e.clientY - start.startY
    if (start.axis === 'width' || start.axis === 'both') {
      const minW = Math.max(80, Math.round(start.parentWidth * (FIELD_WIDTH_MIN_PCT / 100)))
      const maxW = start.parentWidth
      setWidthPreviewPx(Math.max(minW, Math.min(maxW, start.startWidth + dx)))
    }
    if (start.axis === 'height' || start.axis === 'both') {
      setHeightPreviewPx(
        Math.max(
          FIELD_MIN_HEIGHT_MIN_PX,
          Math.min(FIELD_MIN_HEIGHT_MAX_PX, start.startHeight + dy),
        ),
      )
    }
  }

  const dragPreviewStyle: CSSProperties | undefined = dragDelta
    ? {
        left: storedOffsetX + dragDelta.x,
        top: storedOffsetY + dragDelta.y,
      }
    : undefined

  const resizePreviewStyle: CSSProperties = {}
  if (widthPreviewPx != null) {
    resizePreviewStyle.width = widthPreviewPx
    resizePreviewStyle.maxWidth = widthPreviewPx
  } else if (storedWidthPct != null) {
    resizePreviewStyle.width = `${storedWidthPct}%`
    resizePreviewStyle.maxWidth = `${storedWidthPct}%`
  }
  if (heightPreviewPx != null) {
    resizePreviewStyle.minHeight = heightPreviewPx
  } else if (storedMinHeight != null) {
    resizePreviewStyle.minHeight = storedMinHeight
  }

  const wrapperStyle = blockProps
    ? fieldLayoutWrapperStyle(blockProps, fieldKey, { ...dragPreviewStyle, ...resizePreviewStyle }, { inline })
    : { ...dragPreviewStyle, ...resizePreviewStyle }

  const hasCustomWidth = storedWidthPct != null || widthPreviewPx != null

  if (!isEditor) return <>{children}</>

  const resizeHandleClass =
    'absolute z-20 flex items-center justify-center rounded-sm border border-primary/50 bg-white text-primary shadow-sm hover:bg-primary/5'

  return (
    <div
      ref={wrapperRef}
      data-field-layout={fieldKey}
      data-builder-field-selected={isActive ? 'true' : undefined}
      className={cn(
        inline ? 'inline-flex max-w-full' : hasCustomWidth ? 'relative' : 'relative w-fit max-w-full',
        isActive && 'group/field-pos',
        className,
      )}
      style={wrapperStyle ?? (inline ? { position: 'relative' } : { position: 'relative' })}
      onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
      onClick={(e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('[data-text-key], [data-builder-cta-shell], [data-field-resize-handle]')) return
        e.stopPropagation()
        activate(isMultiSelectModifier(e))
        onClick?.(e)
      }}
    >
      {isActive && (
        <button
          type="button"
          title="Drag to move"
          className={cn(
            'absolute -left-2 -top-2 z-20 flex h-5 w-5 items-center justify-center rounded border border-primary/40 bg-white text-primary shadow-sm',
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
      {isActive && !inline && (
        <>
          <button
            type="button"
            data-field-resize-handle="e"
            title="Drag to resize width"
            aria-label="Resize text box width"
            className={cn(resizeHandleClass, 'right-0 top-1/2 h-4 w-3 -translate-y-1/2 translate-x-1/2 cursor-ew-resize')}
            onPointerDown={handleResizePointerDown('width')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={() => finishResize()}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          />
          <button
            type="button"
            data-field-resize-handle="s"
            title="Drag to resize height"
            aria-label="Resize text box height"
            className={cn(resizeHandleClass, 'bottom-0 left-1/2 h-3 w-4 -translate-x-1/2 translate-y-1/2 cursor-ns-resize')}
            onPointerDown={handleResizePointerDown('height')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={() => finishResize()}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          />
          <button
            type="button"
            data-field-resize-handle="se"
            title="Drag to resize width and height"
            aria-label="Resize text box"
            className={cn(resizeHandleClass, 'bottom-0 right-0 h-3.5 w-3.5 translate-x-1/2 translate-y-1/2 cursor-nwse-resize')}
            onPointerDown={handleResizePointerDown('both')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={() => finishResize()}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          />
        </>
      )}
      {children}
    </div>
  )
}
