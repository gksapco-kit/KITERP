import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'

const POPUP_WIDTH = 400
const MAX_RESULTS = 8

export type CopyDocumentSuggestion = {
  number: string
  title?: string | null
  hint?: string | null
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-amber-100 px-0 text-inherit dark:bg-amber-900/50">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

function suggestionMatches(s: CopyDocumentSuggestion, query: string) {
  const hay = [s.number, s.title, s.hint].filter(Boolean).join(' ').toLowerCase()
  return hay.includes(query)
}

export function CopyFromDocumentField({
  placeholder,
  onCopy,
  loading,
  copiedFrom,
  disabled,
  triggerClassName,
  suggestions = [],
  suggestionsLoading,
}: {
  placeholder: string
  onCopy: (number: string) => Promise<void> | void
  loading?: boolean
  copiedFrom?: string | null
  disabled?: boolean
  triggerClassName?: string
  suggestions?: CopyDocumentSuggestion[]
  suggestionsLoading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const query = number.trim().toLowerCase()
  const filtered = useMemo(() => {
    const matched = query
      ? suggestions.filter(s => suggestionMatches(s, query))
      : suggestions
    return matched.slice(0, MAX_RESULTS)
  }, [suggestions, query])

  const searchable = suggestions.length > 0 || !!suggestionsLoading
  const active = filtered[activeIndex] ?? null

  const updatePosition = () => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const left = Math.min(
      Math.max(8, rect.right - POPUP_WIDTH),
      window.innerWidth - POPUP_WIDTH - 8,
    )
    const below = rect.bottom + 8
    const estimatedHeight = popRef.current?.offsetHeight ?? 220
    const top = below + estimatedHeight > window.innerHeight - 8
      ? Math.max(8, rect.top - estimatedHeight - 8)
      : below
    setPos({ top, left })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, filtered.length, number])

  useEscapeToClose(() => setOpen(false), open)

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (popRef.current?.contains(target) || btnRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(filtered.length ? 0 : -1)
  }, [query, filtered.length])

  const handleCopy = async (value = number.trim()) => {
    if (!value || loading || disabled) return
    try {
      await onCopy(value)
      setOpen(false)
      setNumber('')
    } catch {
      // Parent toasts the error; keep the popup open so the number can be corrected.
    }
  }

  const commitActiveOrTyped = () => {
    if (active) void handleCopy(active.number)
    else void handleCopy()
  }

  return (
    <>
      <Button
        ref={btnRef}
        type="button"
        variant="outline"
        size="sm"
        className={
          triggerClassName
          ?? 'h-8 rounded-full border-gray-300 px-4 text-xs font-medium text-gray-600'
        }
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (disabled) return
          setOpen(v => !v)
        }}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
        Copy
      </Button>
      {open && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label="Copy from document"
          className="fixed z-[120] rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900"
          style={{
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            width: POPUP_WIDTH,
            visibility: pos ? 'visible' : 'hidden',
          }}
        >
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Copy from document
          </p>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                ref={inputRef}
                type="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={number}
                onChange={e => setNumber(e.target.value)}
                placeholder={placeholder}
                disabled={disabled || loading}
                className="h-8 w-full rounded-md border-gray-200 pl-8 text-sm"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={searchable}
                aria-controls={listId}
                aria-activedescendant={active ? `${listId}-${activeIndex}` : undefined}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    if (!filtered.length) return
                    setActiveIndex(i => (i + 1) % filtered.length)
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    if (!filtered.length) return
                    setActiveIndex(i => (i <= 0 ? filtered.length - 1 : i - 1))
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    commitActiveOrTyped()
                  }
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 px-3"
              disabled={disabled || loading || !(active || number.trim())}
              onClick={() => commitActiveOrTyped()}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Copy'}
            </Button>
          </div>

          {searchable && (
            <div
              id={listId}
              role="listbox"
              aria-label="Matching documents"
              className="mt-2 max-h-56 overflow-y-auto rounded-md border border-gray-100 dark:border-gray-800"
            >
              {suggestionsLoading && !filtered.length ? (
                <div className="flex items-center gap-2 px-3 py-2.5 text-[11px] text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading documents…
                </div>
              ) : filtered.length ? (
                filtered.map((s, i) => {
                  const isActive = i === activeIndex
                  return (
                    <button
                      key={s.number}
                      id={`${listId}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-950/40'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/80'
                      }`}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => void handleCopy(s.number)}
                    >
                      <span className="text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        <Highlight text={s.number} query={number} />
                      </span>
                      {(s.title || s.hint) && (
                        <span className="w-full truncate text-[11px] text-gray-500">
                          {s.title ? <Highlight text={s.title} query={number} /> : null}
                          {s.title && s.hint ? ' · ' : null}
                          {s.hint || null}
                        </span>
                      )}
                    </button>
                  )
                })
              ) : (
                <p className="px-3 py-2.5 text-[11px] text-gray-500">
                  No matching documents. You can still copy by exact number.
                </p>
              )}
            </div>
          )}

          {copiedFrom ? (
            <p className="mt-1.5 text-[11px] text-green-700 dark:text-green-400">
              Copied from {copiedFrom}. A new document number is assigned when you save.
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-gray-500">
              {searchable
                ? 'Search an existing document, or type its number, to copy header and lines into this draft.'
                : 'Enter an existing document number to copy its header and lines into this draft.'}
            </p>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
