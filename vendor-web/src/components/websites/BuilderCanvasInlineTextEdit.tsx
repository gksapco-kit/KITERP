import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronLeft, ChevronRight, Move, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import {
  computeEditCardPosition,
  findBlockFieldAnchor,
  indexOfSectionTextField,
  type SectionTextField,
} from '@/lib/builderCanvasTextEdit'

export interface InlineTextEditSession {
  blockId: string
  fields: SectionTextField[]
  initialFieldKey: string
  clickX: number
  clickY: number
}

const CARD_WIDTH = 340
const EDIT_CARD_POS_KEY = 'asureit:builder-inline-text-edit-position'

function clampEditCardPosition(
  top: number,
  left: number,
  cardWidth: number,
  cardHeight: number,
): { top: number; left: number } {
  const margin = 12
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    top: Math.max(margin, Math.min(top, vh - cardHeight - margin)),
    left: Math.max(margin, Math.min(left, vw - cardWidth - margin)),
  }
}

function readSavedEditCardPosition(): { top: number; left: number } | null {
  try {
    const raw = sessionStorage.getItem(EDIT_CARD_POS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { top?: number; left?: number }
    if (typeof p.top !== 'number' || typeof p.left !== 'number') return null
    return clampEditCardPosition(p.top, p.left, CARD_WIDTH, 200)
  } catch {
    return null
  }
}

function saveEditCardPosition(top: number, left: number, cardHeight: number) {
  try {
    sessionStorage.setItem(
      EDIT_CARD_POS_KEY,
      JSON.stringify(clampEditCardPosition(top, left, CARD_WIDTH, cardHeight)),
    )
  } catch {
    /* ignore quota errors */
  }
}

/** Stable floating edit card with prev/next navigation across section text fields. */
export function BuilderCanvasInlineTextEdit({
  session,
  onSaveField,
  onClose,
}: {
  session: InlineTextEditSession | null
  onSaveField: (fieldKey: string, value: string) => void
  onClose: () => void
}) {
  const [fieldIndex, setFieldIndex] = useState(0)
  const [draft, setDraft] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const closedRef = useRef(false)
  const pendingRef = useRef<Record<string, string>>({})

  const fields = session?.fields ?? []
  const currentField = fields[fieldIndex] ?? null
  const fieldCount = fields.length
  const canGoPrev = fieldIndex > 0
  const canGoNext = fieldIndex < fieldCount - 1

  const computeInitialPosition = useCallback((s: InlineTextEditSession, field: SectionTextField) => {
    const blockRoot = document.querySelector(
      `[data-block-id="${CSS.escape(s.blockId)}"]`,
    ) as HTMLElement | null
    const anchor = blockRoot
      ? findBlockFieldAnchor(blockRoot, field.fieldKey, field.value)
      : null
    const rect = anchor?.getBoundingClientRect() ?? null
    const cardH = cardRef.current?.offsetHeight ?? (field.multiline ? 200 : 168)
    return computeEditCardPosition(rect, { x: s.clickX, y: s.clickY }, CARD_WIDTH, cardH)
  }, [])

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    if (!cardRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const rect = cardRef.current.getBoundingClientRect()
    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startTop = rect.top
    const startLeft = rect.left
    document.body.style.cursor = 'grabbing'

    const onMove = (mv: MouseEvent) => {
      const cardH = cardRef.current?.offsetHeight ?? 200
      setPos(clampEditCardPosition(
        startTop + (mv.clientY - startMouseY),
        startLeft + (mv.clientX - startMouseX),
        CARD_WIDTH,
        cardH,
      ))
    }
    const onUp = () => {
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!cardRef.current) return
      const r = cardRef.current.getBoundingClientRect()
      saveEditCardPosition(r.top, r.left, r.height)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const persistDraft = useCallback(() => {
    const field = fields[fieldIndex]
    if (!field) return
    pendingRef.current[field.fieldKey] = draft
    onSaveField(field.fieldKey, draft)
  }, [fields, fieldIndex, draft, onSaveField])

  const closeWithoutSave = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    onClose()
  }, [onClose])

  useEscapeToClose(closeWithoutSave, !!session)

  const saveAndClose = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    persistDraft()
    onClose()
  }, [persistDraft, onClose])

  const goToIndex = useCallback((nextIndex: number) => {
    if (nextIndex === fieldIndex || nextIndex < 0 || nextIndex >= fields.length) return
    const field = fields[fieldIndex]
    if (field) {
      pendingRef.current[field.fieldKey] = draft
      onSaveField(field.fieldKey, draft)
    }
    const nextField = fields[nextIndex]
    const nextValue = pendingRef.current[nextField.fieldKey] ?? nextField.value
    setFieldIndex(nextIndex)
    setDraft(nextValue)
  }, [fieldIndex, fields, draft, onSaveField])

  const goPrev = useCallback(() => goToIndex(fieldIndex - 1), [fieldIndex, goToIndex])
  const goNext = useCallback(() => goToIndex(fieldIndex + 1), [fieldIndex, goToIndex])

  const sessionKey = session
    ? `${session.blockId}:${session.initialFieldKey}:${session.fields.map(f => f.fieldKey).join(',')}`
    : null

  useLayoutEffect(() => {
    if (!session) {
      setPos(null)
      setDraft('')
      setFieldIndex(0)
      pendingRef.current = {}
      closedRef.current = false
      return
    }
    const idx = indexOfSectionTextField(session.fields, session.initialFieldKey)
    setFieldIndex(idx)
    const initial = session.fields[idx]
    setDraft(initial?.value ?? '')
    pendingRef.current = {}
    closedRef.current = false

    const saved = readSavedEditCardPosition()
    if (saved) {
      setPos(saved)
      return
    }
    if (initial) {
      setPos(computeInitialPosition(session, initial))
      const id = requestAnimationFrame(() => {
        if (initial) setPos(computeInitialPosition(session, initial))
      })
      return () => cancelAnimationFrame(id)
    }
  }, [sessionKey, computeInitialPosition])

  useEffect(() => {
    if (!session) return
    const t = window.setTimeout(() => {
      const node = inputRef.current
      if (!node) return
      node.focus()
      if ('select' in node) node.select()
    }, 30)
    return () => clearTimeout(t)
  }, [session, fieldIndex, currentField?.fieldKey])

  useEffect(() => {
    if (!session) return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowRight' && fieldIndex < fields.length - 1) {
        e.preventDefault()
        goNext()
      }
      if (e.altKey && e.key === 'ArrowLeft' && fieldIndex > 0) {
        e.preventDefault()
        goPrev()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [session, fields.length, fieldIndex, goNext, goPrev])

  if (!session || !pos || !currentField) return null

  const inputClass = cn(
    'w-full rounded-lg border border-gray-200 bg-white px-3 py-2',
    'text-sm text-gray-900 placeholder:text-gray-400',
    'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50',
  )

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100001] bg-black/10 pointer-events-auto"
        onMouseDown={e => {
          e.preventDefault()
          e.stopPropagation()
          saveAndClose()
        }}
        aria-hidden
      />

      <div
        ref={cardRef}
        data-builder-inline-editor
        role="dialog"
        aria-label={`Edit ${currentField.label}`}
        className="fixed z-[100002] rounded-xl border border-gray-200 bg-white shadow-2xl pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
        style={{ top: pos.top, left: pos.left, width: CARD_WIDTH }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleHeaderMouseDown}
          title="Drag to move"
        >
          <div className="flex items-start gap-2 min-w-0">
            <Move className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Edit text</p>
              <p className="text-sm font-medium text-gray-800 truncate">{currentField.label}</p>
              {fieldCount > 1 && (
                <p className="text-[10px] text-gray-400 tabular-nums">
                  Field {fieldIndex + 1} of {fieldCount} in this section
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onMouseDown={e => e.stopPropagation()}
            onClick={closeWithoutSave}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-2">
          {fieldCount > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!canGoPrev}
                onMouseDown={e => e.preventDefault()}
                onClick={e => { e.stopPropagation(); goPrev() }}
                className={cn(
                  'inline-flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                  canGoPrev
                    ? 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-primary/30'
                    : 'border-gray-100 text-gray-300 cursor-not-allowed',
                )}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                type="button"
                disabled={!canGoNext}
                onMouseDown={e => e.preventDefault()}
                onClick={e => { e.stopPropagation(); goNext() }}
                className={cn(
                  'inline-flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                  canGoNext
                    ? 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-primary/30'
                    : 'border-gray-100 text-gray-300 cursor-not-allowed',
                )}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {currentField.multiline ? (
            <textarea
              key={currentField.fieldKey}
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              rows={4}
              className={cn(inputClass, 'min-h-[96px] resize-y leading-relaxed')}
              placeholder={`Enter ${currentField.label.toLowerCase()}…`}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  saveAndClose()
                }
              }}
            />
          ) : (
            <input
              key={currentField.fieldKey}
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={draft}
              className={inputClass}
              placeholder={`Enter ${currentField.label.toLowerCase()}…`}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (canGoNext) goNext()
                  else saveAndClose()
                }
              }}
            />
          )}

          <p className="text-[11px] text-gray-400 leading-snug">
            {fieldCount > 1 && 'Previous / Next move between fields · Alt+← / Alt+→ · '}
            {currentField.multiline
              ? 'Ctrl+Enter to save · Esc to cancel'
              : canGoNext
                ? 'Enter → next field · Esc to cancel'
                : 'Enter to save · Esc to cancel'}
          </p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeWithoutSave}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveAndClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:opacity-90"
            >
              <Check className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
