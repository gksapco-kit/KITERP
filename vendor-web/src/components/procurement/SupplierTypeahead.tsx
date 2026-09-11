import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, useId } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Input } from '@/components/ui/input'
import { Search, X, Loader2, User } from 'lucide-react'
import { rankSupplierMatch, sortSuppliersByQuery, supplierSearchHint } from '@/lib/supplierUtils'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import type { Supplier } from '@/types'

// ─── Multi-select mode ─────────────────────────────────────────────────────

interface MultiProps {
  mode: 'multi'
  selectedSuppliers: Supplier[]
  onChange: (suppliers: Supplier[]) => void
  enabled?: boolean
  placeholder?: string
}

// ─── Single-select mode ────────────────────────────────────────────────────

interface SingleProps {
  mode: 'single'
  selectedSupplier: Supplier | null
  onChange: (supplier: Supplier | null) => void
  enabled?: boolean
  placeholder?: string
}

type Props = MultiProps | SingleProps

const TYPEAHEAD_INPUT_PROPS = {
  type: 'search' as const,
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'none',
  spellCheck: false,
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-form-type': 'other',
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

export function SupplierTypeahead(props: Props) {
  const { mode, enabled = true, placeholder = 'Search name, email, GSTIN or phone…' } = props

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 150)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => { setActiveIndex(-1) }, [debouncedQuery])

  const selectedIds =
    mode === 'multi'
      ? props.selectedSuppliers.map(s => s.id)
      : props.selectedSupplier
        ? [props.selectedSupplier.id]
        : []

  const { data, isFetching } = useQuery({
    queryKey: ['supplier-typeahead', debouncedQuery],
    queryFn: () => vendorApi.listSuppliers({
      search: debouncedQuery || undefined,
      size: 20,
      is_active: true,
    }),
    enabled: enabled && open,
    placeholderData: prev => prev,
    staleTime: 10_000,
  })

  const suggestions = useMemo(() => {
    const items = ((data?.items ?? []) as Supplier[]).filter(s => !selectedIds.includes(s.id))
    const q = query.trim()
    const ranked = sortSuppliersByQuery(
      q ? items.filter(s => rankSupplierMatch(s, q) < 100) : items,
      q,
    )
    return ranked.slice(0, 20)
  }, [data?.items, query, selectedIds])

  const pick = useCallback((supplier: Supplier) => {
    if (props.mode === 'multi') {
      props.onChange([...props.selectedSuppliers, supplier])
    } else {
      props.onChange(supplier)
    }
    setQuery('')
    setDebouncedQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }, [props])

  function remove(id: string) {
    if (mode === 'multi') {
      props.onChange(props.selectedSuppliers.filter(s => s.id !== id))
    } else {
      props.onChange(null)
    }
  }

  const closeMenu = useCallback(() => setOpen(false), [])
  useEscapeToClose(closeMenu, open)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (!open || suggestions.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault()
        pick(suggestions[activeIndex])
      }
    },
    [open, suggestions, activeIndex, pick],
  )

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const updateMenuPos = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 4
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8
    const spaceAbove = rect.top - gap - 8
    const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove
    const maxHeight = Math.max(140, Math.min(280, preferBelow ? spaceBelow : spaceAbove))
    setMenuPos({
      top: preferBelow ? rect.bottom + gap : Math.max(8, rect.top - gap - maxHeight),
      left: rect.left,
      width: rect.width,
      maxHeight,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPos()
  }, [open, suggestions.length, isFetching, updateMenuPos])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => updateMenuPos()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, updateMenuPos])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (wrapRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown, true)
    return () => document.removeEventListener('mousedown', handlePointerDown, true)
  }, [open])

  const showInput = mode === 'multi' || !props.selectedSupplier
  const q = query.trim()

  const menu =
    open && showInput && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[220] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
            onMouseDown={e => e.preventDefault()}
          >
            <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: menuPos.maxHeight }}>
              {isFetching && suggestions.length === 0 && (
                <p className="px-3 py-2.5 text-xs text-muted-foreground">Searching…</p>
              )}
              {!isFetching && suggestions.length === 0 && (
                <p className="px-3 py-2.5 text-xs text-muted-foreground">
                  {q ? <>No suppliers match <strong>"{q}"</strong></> : 'No active suppliers yet'}
                </p>
              )}
              {suggestions.map((s, idx) => {
                const hint = supplierSearchHint(s)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pick(s)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-start gap-3 transition-colors ${
                      idx === activeIndex ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-muted/60'
                    }`}
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        <Highlight text={s.name} query={q} />
                      </p>
                      {hint && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          <Highlight text={hint} query={q} />
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className="space-y-2">
      {mode === 'multi' && props.selectedSuppliers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {props.selectedSuppliers.map(s => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 pl-2.5 pr-1 py-0.5 text-xs font-medium"
            >
              {s.name}
              <button
                type="button"
                aria-label={`Remove ${s.name}`}
                onClick={() => remove(s.id)}
                className="rounded-full p-0.5 hover:bg-blue-100 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {mode === 'single' && props.selectedSupplier && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="text-sm font-medium text-blue-800 flex-1 truncate">{props.selectedSupplier.name}</span>
          {(props.selectedSupplier.gstin || props.selectedSupplier.email) && (
            <span className="text-xs text-blue-500 truncate max-w-[40%]">
              {props.selectedSupplier.gstin || props.selectedSupplier.email}
            </span>
          )}
          <button
            type="button"
            aria-label="Clear supplier"
            onClick={() => remove(props.selectedSupplier!.id)}
            className="rounded-full p-0.5 hover:bg-blue-100 transition-colors ml-1"
          >
            <X className="w-3.5 h-3.5 text-blue-500" />
          </button>
        </div>
      )}

      {showInput && (
        <div ref={wrapRef} className="relative min-w-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            {isFetching && open && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
            )}
            <Input
              ref={inputRef}
              name={`kiterp-supplier-lookup-${inputId}`}
              id={inputId}
              value={query}
              placeholder={placeholder}
              onChange={e => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              className="h-9 pl-8 pr-8 text-sm [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
              role="combobox"
              aria-expanded={open}
              aria-autocomplete="list"
              {...TYPEAHEAD_INPUT_PROPS}
            />
          </div>
          {menu}
        </div>
      )}

      {mode === 'multi' && props.selectedSuppliers.length > 0 && (
        <p className="text-xs text-blue-600">
          {props.selectedSuppliers.length} supplier{props.selectedSuppliers.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )
}
