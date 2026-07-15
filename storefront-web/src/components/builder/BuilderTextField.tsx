import { useCallback, useEffect, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type CSSProperties, type ElementType, type FocusEvent as ReactFocusEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { cn } from '@/lib/utils'
import {
  fieldTextStyle,
  hasInlineHtml,
  isInlineEditTag,
  isMultilineCanvasField,
  mergeFieldTypographyClassName,
} from '@/lib/fieldTextStyles'
import { isMultiSelectModifier } from '@/lib/builderMultiSelect'
import {
  hasActiveInlineTextSelection,
  isBuilderTypographyToolbarElement,
  rememberInlineTextSelection,
  restoreSavedInlineSelection,
} from '@/lib/builderInlineTextSelection'
import {
  insertPlainTextInElement,
  normalizeClipboardPlainText,
  readPlainTextFromClipboardEvent,
  type CanvasTextClipboardAction,
} from '@/lib/builderCanvasPaste'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { BuilderPositionableField } from '@/components/builder/BuilderPositionableField'

export function BuilderTextField({
  fieldKey,
  blockId,
  blockProps,
  value,
  as: Tag = 'span',
  className,
  style,
  placeholder,
  multiline,
  skipPositionWrapper = false,
  embeddedInControl = false,
}: {
  fieldKey: string
  blockId?: string
  /** Block props — enables per-field align/wrap/vertical layout from `_field_styles`. */
  blockProps?: Record<string, unknown>
  value: string
  as?: keyof JSX.IntrinsicElements
  className?: string
  style?: CSSProperties
  placeholder?: string
  /** When omitted, inferred from field key (headline, subtitle, etc.). */
  multiline?: boolean
  /** When true, parent handles position wrapper (e.g. CTA button shell). */
  skipPositionWrapper?: boolean
  /** Label inside a button/chip — selection chrome lives on the parent control. */
  embeddedInControl?: boolean
}) {
  const ctx = useBuilderCanvas()
  const ref = useRef<HTMLElement | null>(null)
  const [editing, setEditing] = useState(false)
  const isEditor = ctx?.isEditorCanvas && !!blockId
  const isSelected = isEditor
    && ctx?.activeBlockId === blockId
    && ((ctx?.activeTextFields ?? []).includes(fieldKey) || ctx?.activeTextField === fieldKey)
  const isActive = isSelected
  const allowMultiline = multiline ?? isMultilineCanvasField(fieldKey)

  const displayWhenIdle = value || (isEditor ? (placeholder || 'Click to edit') : '')

  const readValue = useCallback(() => {
    const rawHtml = (ref.current?.innerHTML ?? '').trim()
    const rawText = (ref.current?.innerText ?? '').trim()
    return hasInlineHtml(rawHtml) ? rawHtml : rawText
  }, [])

  const pendingLineBreakRef = useRef(false)
  const pendingClipboardActionRef = useRef<CanvasTextClipboardAction | null>(null)

  const commitValue = useCallback((closeEditing = false) => {
    const next = readValue()
    if (blockId && next !== value) {
      ctx?.onTextFieldCommit?.(blockId, fieldKey, next)
    }
    if (closeEditing) setEditing(false)
  }, [blockId, ctx, fieldKey, readValue, value])

  const commit = useCallback(() => {
    commitValue(true)
  }, [commitValue])

  useEffect(() => {
    const el = ref.current
    if (!el || editing) return
    const rich = hasInlineHtml(displayWhenIdle)
    if (rich) {
      if (el.innerHTML !== displayWhenIdle) el.innerHTML = displayWhenIdle
    } else if (el.textContent !== displayWhenIdle) {
      el.textContent = displayWhenIdle
    }
  }, [displayWhenIdle, editing])

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
      if (pendingClipboardActionRef.current) return
      const sel = window.getSelection()
      if (sel && ref.current.childNodes.length > 0) {
        const range = document.createRange()
        range.selectNodeContents(ref.current)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }, [editing])

  const ensureFieldSelection = useCallback((el: HTMLElement, selectAllIfCollapsed: boolean) => {
    if (hasActiveInlineTextSelection(fieldKey) && restoreSavedInlineSelection()) return
    const sel = window.getSelection()
    if (!sel) return
    if (sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      return
    }
    if (!selectAllIfCollapsed) return
    const range = document.createRange()
    range.selectNodeContents(el)
    sel.removeAllRanges()
    sel.addRange(range)
  }, [fieldKey])

  useEffect(() => {
    if (!editing || !pendingClipboardActionRef.current || !ref.current) return
    const action = pendingClipboardActionRef.current
    pendingClipboardActionRef.current = null
    const el = ref.current

    const run = async () => {
      el.focus()
      if (action === 'paste') {
        try {
          const raw = await navigator.clipboard.readText()
          const plain = normalizeClipboardPlainText(raw)
          if (!plain) return
          ensureFieldSelection(el, false)
          insertPlainTextInElement(el, plain)
          commitValue(false)
        } catch {
          // Clipboard permission denied — user can paste with Ctrl+V while focused
        }
        return
      }

      ensureFieldSelection(el, true)
      if (action === 'copy') {
        document.execCommand('copy')
        return
      }
      if (action === 'cut') {
        document.execCommand('cut')
        commitValue(false)
      }
    }

    requestAnimationFrame(() => { void run() })
  }, [editing, commitValue, ensureFieldSelection])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onInlineCommit = () => {
      const next = readValue()
      if (blockId && next !== value) {
        ctx?.onTextFieldCommit?.(blockId, fieldKey, next)
      }
    }
    el.addEventListener('builder-inline-text-commit', onInlineCommit)
    return () => el.removeEventListener('builder-inline-text-commit', onInlineCommit)
  }, [blockId, ctx, fieldKey, readValue, value])

  const activate = useCallback((additive = false, clientX?: number, clientY?: number) => {
    if (!isEditor || !blockId) return
    ctx?.onTextFieldActivate?.(blockId, fieldKey, { additive, clientX, clientY })
  }, [isEditor, blockId, ctx, fieldKey])

  const insertLineBreak = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) {
      const br = document.createElement('br')
      el.appendChild(br)
      const range = document.createRange()
      range.setStartAfter(br)
      range.collapse(true)
      sel?.removeAllRanges()
      sel?.addRange(range)
      return
    }
    const range = sel.getRangeAt(0)
    range.deleteContents()
    const br = document.createElement('br')
    range.insertNode(br)
    range.setStartAfter(br)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || !isEditor) return
    const onClipboard = (e: Event) => {
      const action = (e as CustomEvent<{ action: CanvasTextClipboardAction }>).detail?.action
      if (!action) return
      pendingClipboardActionRef.current = action
      activate()
      setEditing(true)
    }
    el.addEventListener('builder-canvas-clipboard', onClipboard)
    return () => el.removeEventListener('builder-canvas-clipboard', onClipboard)
  }, [isEditor, activate])

  useEffect(() => {
    const el = ref.current
    if (!el || !isEditor) return
    const onRequestLineBreak = () => {
      pendingLineBreakRef.current = true
      activate()
      if (editing) {
        pendingLineBreakRef.current = false
        requestAnimationFrame(() => insertLineBreak())
      } else {
        setEditing(true)
      }
    }
    el.addEventListener('builder-insert-line-break', onRequestLineBreak)
    return () => el.removeEventListener('builder-insert-line-break', onRequestLineBreak)
  }, [isEditor, editing, activate, insertLineBreak])

  useEffect(() => {
    if (!editing || !pendingLineBreakRef.current || !ref.current) return
    pendingLineBreakRef.current = false
    requestAnimationFrame(() => insertLineBreak())
  }, [editing, insertLineBreak])

  const isPrimaryPasteTarget = isEditor
    && ctx?.activeBlockId === blockId
    && ctx?.activeTextField === fieldKey

  const handlePaste = useCallback((e: ReactClipboardEvent) => {
    if (!editing || !ref.current) return
    e.preventDefault()
    e.stopPropagation()
    const plain = readPlainTextFromClipboardEvent(e)
    if (!plain) return
    insertPlainTextInElement(ref.current, plain)
  }, [editing])

  useEffect(() => {
    if (!isEditor || editing || !isPrimaryPasteTarget) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v')) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]') && t !== ref.current) return
      e.preventDefault()
      e.stopPropagation()
      setEditing(true)
      void navigator.clipboard.readText().then(raw => {
        const plain = normalizeClipboardPlainText(raw)
        if (!plain || !ref.current) return
        requestAnimationFrame(() => {
          if (!ref.current) return
          insertPlainTextInElement(ref.current, plain, { replaceAll: true })
        })
      }).catch(() => {
        // Clipboard permission denied — editing mode allows manual paste via handlePaste
      })
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isEditor, editing, isPrimaryPasteTarget])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      const el = ref.current
      if (el) {
        const rich = hasInlineHtml(value)
        if (rich) el.innerHTML = value
        else el.textContent = value || (placeholder || '')
      }
      setEditing(false)
      return
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      ref.current?.blur()
      return
    }
    if (allowMultiline && e.key === 'Enter') {
      if (isInlineEditTag(ref.current?.tagName)) {
        e.preventDefault()
        insertLineBreak()
      }
      return
    }
    if (!allowMultiline && e.key === 'Enter') {
      e.preventDefault()
      ref.current?.blur()
    }
  }

  const Component = Tag as ElementType
  const textStyle = blockProps ? fieldTextStyle(blockProps, fieldKey, style) : style
  const typographyClassName = mergeFieldTypographyClassName(className, blockProps, fieldKey)
  const embeddedStyle: CSSProperties | undefined = embeddedInControl
    ? { ...textStyle, color: 'inherit' }
    : textStyle
  // Keep the position wrapper on preview/live so offsets, sizes, and alignment match the canvas.
  const inPositionWrapper = !skipPositionWrapper && !embeddedInControl

  const fieldEl = (
    <Component
      ref={ref}
      data-text-key={fieldKey}
      data-builder-embedded-control={embeddedInControl ? 'true' : undefined}
      data-builder-inline-edit-target={editing ? 'true' : undefined}
      data-builder-field-selected={isSelected && !inPositionWrapper ? 'true' : undefined}
      data-builder-text-active={isSelected && !embeddedInControl ? 'true' : undefined}
      data-builder-multiline={allowMultiline ? 'true' : undefined}
      contentEditable={isEditor && editing}
      suppressContentEditableWarning
      spellCheck={editing}
      className={cn(
        typographyClassName,
        isEditor && !embeddedInControl && 'builder-canvas-text-field',
        isEditor && inPositionWrapper && 'builder-canvas-text-field-in-layout',
        allowMultiline && 'builder-canvas-text-field-multiline',
        isEditor && !embeddedInControl && !editing && !inPositionWrapper && 'cursor-text rounded hover:outline hover:outline-1 hover:outline-primary/40 hover:outline-offset-2',
        editing && !embeddedInControl && 'outline outline-2 outline-primary/50 outline-offset-2 rounded bg-white/40 selection:bg-blue-500/25 selection:text-inherit',
        editing && embeddedInControl && 'rounded selection:bg-blue-500/25 selection:text-inherit',
        isSelected && !editing && !embeddedInControl && !inPositionWrapper && 'ring-2 ring-primary/40 ring-offset-1',
      )}
      style={{
        ...embeddedStyle,
        minWidth: editing ? 40 : undefined,
      }}
      onMouseDown={(e: React.MouseEvent) => {
        if (isEditor) e.stopPropagation()
      }}
      onMouseUp={() => rememberInlineTextSelection(ref.current, fieldKey)}
      onKeyUp={() => rememberInlineTextSelection(ref.current, fieldKey)}
      onSelect={() => rememberInlineTextSelection(ref.current, fieldKey)}
      onClick={(e: ReactMouseEvent) => {
        if (!isEditor) return
        e.stopPropagation()
        if (isMultiSelectModifier(e)) {
          activate(true, e.clientX, e.clientY)
          return
        }
        if (embeddedInControl) {
          if (!isSelected) {
            activate(false, e.clientX, e.clientY)
            return
          }
          if (!editing) setEditing(true)
          return
        }
        activate(false, e.clientX, e.clientY)
        if (!editing) setEditing(true)
      }}
      onBlur={(e: ReactFocusEvent<HTMLElement>) => {
        if (isBuilderTypographyToolbarElement(e.relatedTarget)) return
        if (editing) commit()
      }}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
    />
  )

  if (skipPositionWrapper) return fieldEl

  return (
    <BuilderPositionableField
      fieldKey={fieldKey}
      blockId={blockId}
      blockProps={blockProps}
    >
      {fieldEl}
    </BuilderPositionableField>
  )
}
