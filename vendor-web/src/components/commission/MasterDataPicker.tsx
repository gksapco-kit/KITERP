/**
 * Generic searchable combobox used by StaffPicker, SupplierPicker, CustomerPicker.
 * Browse-on-open dropdown with typeahead filter; portal menu so it works inside modals.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'

export interface PickerOption {
  id: string
  label: string        // primary label (name)
  sub?: string         // display-only secondary label (phone • email combined)
  phone?: string       // raw phone from master record
  email?: string       // raw email from master record
  initials?: string
  meta?: unknown       // raw master record for callers that need extra fields
}

interface Props {
  placeholder?: string
  selected: PickerOption | null
  onSearch: (q: string) => Promise<PickerOption[]>
  onSelect: (opt: PickerOption | null) => void
  disabled?: boolean
  /** Compact field height (h-8) to match dense form inputs. */
  compact?: boolean
}

export function MasterDataPicker({
  placeholder = 'Search…',
  selected,
  onSearch,
  onSelect,
  disabled,
  compact = false,
}: Props) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<PickerOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchGen = useRef(0)

  useEscapeToClose(() => setOpen(false), open)

  const runSearch = useCallback(async (q: string) => {
    const gen = ++searchGen.current
    setLoading(true)
    try {
      const results = await onSearch(q)
      if (gen !== searchGen.current) return
      setOptions(results)
    } catch {
      if (gen !== searchGen.current) return
      setOptions([])
    } finally {
      if (gen === searchGen.current) setLoading(false)
    }
  }, [onSearch])

  const openMenu = useCallback(() => {
    if (disabled) return
    setOpen(true)
    setQuery('')
    void runSearch('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [disabled, runSearch])

  const closeMenu = useCallback(() => {
    setOpen(false)
    setQuery('')
    setOptions([])
  }, [])

  const updateMenuPos = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 4
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8
    const spaceAbove = rect.top - gap - 8
    const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove
    const maxHeight = Math.max(140, Math.min(240, preferBelow ? spaceBelow : spaceAbove))
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
  }, [open, options.length, loading, updateMenuPos])

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
      closeMenu()
    }
    document.addEventListener('mousedown', handlePointerDown, true)
    return () => document.removeEventListener('mousedown', handlePointerDown, true)
  }, [open, closeMenu])

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void runSearch(q) }, q.trim() ? 250 : 0)
  }

  const pick = (opt: PickerOption) => {
    onSelect(opt)
    closeMenu()
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(null)
    setQuery('')
    setOptions([])
    setOpen(false)
  }

  const detailParts = selected
    ? ([selected.phone, selected.email].filter(Boolean) as string[])
    : []

  const fieldH = compact ? 'h-8' : 'h-10'
  const avatarSz = compact ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]'

  const menu =
    open && menuPos && typeof document !== 'undefined'
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
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                data-kiterp-no-field-focus
                value={query}
                onChange={handleQueryChange}
                placeholder={placeholder}
                disabled={disabled}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : query ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setQuery(''); void runSearch('') }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: Math.max(80, menuPos.maxHeight - 40) }}>
              {loading && options.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">Searching…</div>
              ) : options.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {query.trim() ? 'No results found' : 'No records available'}
                </div>
              ) : (
                options.map((opt) => {
                  const isActive = selected?.id === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(opt)}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-blue-50',
                        isActive && 'bg-blue-50',
                      )}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        {opt.initials || opt.label.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{opt.label}</div>
                        {opt.sub && <div className="truncate text-xs text-muted-foreground">{opt.sub}</div>}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <div
        ref={triggerRef}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => { if (!open) openMenu() }}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault()
            if (!open) openMenu()
          }
        }}
        className={cn(
          'flex min-w-0 cursor-pointer items-center gap-2 border px-2.5 transition-colors',
          fieldH,
          compact ? 'rounded-md' : 'rounded-lg',
          open
            ? 'border-ring ring-2 ring-ring/30 bg-background'
            : selected
              ? 'border-blue-300 bg-blue-50'
              : 'border-input bg-background hover:border-ring/60',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {selected ? (
          <>
            <div
              className={cn(
                'flex shrink-0 items-center justify-center rounded-full bg-blue-200 font-medium text-blue-700',
                avatarSz,
              )}
            >
              {selected.initials || selected.label.charAt(0).toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-sm">
              <span className="truncate font-medium text-foreground">{selected.label}</span>
              {detailParts.map((part) => (
                <span key={part} className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="shrink-0 text-muted-foreground/40">·</span>
                  <span className="truncate">{part}</span>
                </span>
              ))}
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={clear}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        ) : (
          <>
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{placeholder}</span>
          </>
        )}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </div>
      {menu}
    </div>
  )
}
