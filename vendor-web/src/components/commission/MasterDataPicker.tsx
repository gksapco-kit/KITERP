/**
 * Generic debounced-search picker used by StaffPicker, SupplierPicker, CustomerPicker.
 * Renders a search box, a dropdown list, and a selected-chip with clear button.
 */
import { useState, useEffect, useRef } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { cn, searchFieldInnerInputClassName, searchFieldShellClassName } from '@/lib/utils'

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
  /** Single-line chip / search field sized to match form inputs (h-10). */
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const doSearch = (q: string) => {
    if (timer.current) clearTimeout(timer.current)
    if (!q.trim()) { setOptions([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await onSearch(q)
        setOptions(results)
        setOpen(true)
      } catch {
        setOptions([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    doSearch(e.target.value)
  }

  const pick = (opt: PickerOption) => {
    onSelect(opt)
    setQuery('')
    setOptions([])
    setOpen(false)
  }

  const clear = () => {
    onSelect(null)
    setQuery('')
    setOptions([])
  }

  if (selected) {
    const detailParts = [selected.phone, selected.email].filter(Boolean) as string[]
    return (
      <div
        className={cn(
          'flex min-w-0 items-center gap-2 border border-blue-300 bg-blue-50',
          compact ? 'h-10 rounded-md px-2.5' : 'h-10 rounded-lg px-3',
        )}
      >
        <div
          className={cn(
            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-200 text-[10px] font-medium text-blue-700',
          )}
        >
          {selected.initials || selected.label.charAt(0).toUpperCase()}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-sm">
          <span className="truncate font-medium text-gray-900">{selected.label}</span>
          {detailParts.map((part) => (
            <span key={part} className="flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
              <span className="flex-shrink-0 text-gray-300">·</span>
              <span className="truncate">{part}</span>
            </span>
          ))}
        </div>
        {!disabled && (
          <button type="button" onClick={clear} className="flex-shrink-0 text-gray-400 hover:text-red-500">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      <div
        data-kiterp-search-field
        className={cn(searchFieldShellClassName, compact ? 'h-10 px-3 py-0' : 'px-3 py-2')}
      >
        <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <input
          data-kiterp-no-field-focus
          value={query}
          onChange={handleQueryChange}
          onFocus={() => query && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(searchFieldInnerInputClassName, 'text-sm')}
        />
        {loading && <ChevronDown className="h-4 w-4 animate-pulse text-gray-400" />}
      </div>
      {open && options.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          {options.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => pick(opt)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-blue-50"
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                {opt.initials || opt.label.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-900">{opt.label}</div>
                {opt.sub && <div className="truncate text-xs text-gray-500">{opt.sub}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && !loading && options.length === 0 && query.trim() && (
        <div className="absolute z-50 mt-1 max-h-[90vh] w-full overflow-y-auto rounded-lg border border-border bg-popover px-4 py-3 text-sm text-gray-500 text-popover-foreground shadow-lg">
          No results found
        </div>
      )}
    </div>
  )
}
