import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  id?: string
  className?: string
}

/** Free-text field with suggestion dropdown — pick a known value or type a custom one. */
export function RentalSuggestionCombobox({
  value,
  onChange,
  suggestions,
  placeholder = 'Type or select…',
  id,
  className,
}: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputWrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useLayoutEffect(() => {
    if (!open || !inputWrapRef.current) {
      setMenuRect(null)
      return
    }
    const update = () => {
      const r = inputWrapRef.current!.getBoundingClientRect()
      setMenuRect({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t)) return
      const menu = document.getElementById(listId)
      if (menu?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, listId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return suggestions
    return suggestions.filter((s) => s.toLowerCase().includes(q))
  }, [suggestions, query])

  const exactMatch = useMemo(
    () => suggestions.some((s) => s.toLowerCase() === query.trim().toLowerCase()),
    [suggestions, query],
  )
  const canCreate = query.trim().length > 0 && !exactMatch

  const commit = (next: string) => {
    const trimmed = next.trim()
    onChange(trimmed)
    setQuery(trimmed)
    setOpen(false)
  }

  const menu = open && menuRect
    ? createPortal(
      <div
        id={listId}
        role="listbox"
        style={{ position: 'fixed', top: menuRect.top, left: menuRect.left, width: menuRect.width }}
        className="z-[9999] max-h-56 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
      >
        {canCreate && (
          <button
            type="button"
            role="option"
            className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm hover:bg-primary hover:text-primary-foreground"
            onMouseDown={(e) => {
              e.preventDefault()
              commit(query)
            }}
          >
            <span className="min-w-0 flex-1">
              Use <span className="font-semibold">“{query.trim()}”</span>
            </span>
          </button>
        )}
        {filtered.length === 0 && !canCreate ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No matches — type a custom value.</p>
        ) : (
          filtered.map((s) => {
            const selected = s === value
            return (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary hover:text-primary-foreground',
                  selected && 'bg-primary/10 font-medium',
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  commit(s)
                }}
              >
                <span className="min-w-0 flex-1 truncate">{s}</span>
                {selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            )
          })
        )}
      </div>,
      document.body,
    )
    : null

  return (
    <div ref={rootRef} className="relative">
      <div ref={inputWrapRef} className="relative">
        <Input
          id={id}
          value={query}
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onBlur={() => {
            if (query.trim() !== value) onChange(query.trim())
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit(query)
            } else if (e.key === 'Escape') {
              setQuery(value)
              setOpen(false)
            }
          }}
          className={cn('pr-9', className)}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault()
            setOpen((v) => !v)
          }}
          aria-label="Toggle suggestions"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      {menu}
    </div>
  )
}
