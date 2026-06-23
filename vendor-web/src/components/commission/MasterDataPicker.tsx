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
}

export function MasterDataPicker({ placeholder = 'Search…', selected, onSearch, onSelect, disabled }: Props) {
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
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg">
        <div className="w-7 h-7 rounded-full bg-blue-200 flex items-center justify-center text-xs font-medium text-blue-700 flex-shrink-0">
          {selected.initials || selected.label.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{selected.label}</div>
          {selected.sub && <div className="text-xs text-gray-500 truncate">{selected.sub}</div>}
        </div>
        {!disabled && (
          <button type="button" onClick={clear} className="text-gray-400 hover:text-red-500 flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      <div
        data-kiterp-search-field
        className={cn(searchFieldShellClassName, 'px-3 py-2')}
      >
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          data-kiterp-no-field-focus
          value={query}
          onChange={handleQueryChange}
          onFocus={() => query && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(searchFieldInnerInputClassName, 'text-sm')}
        />
        {loading && <ChevronDown className="h-4 w-4 text-gray-400 animate-pulse" />}
      </div>
      {open && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover text-popover-foreground border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => pick(opt)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 text-left"
            >
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                {opt.initials || opt.label.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{opt.label}</div>
                {opt.sub && <div className="text-xs text-gray-500 truncate">{opt.sub}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && !loading && options.length === 0 && query.trim() && (
        <div className="absolute z-50 mt-1 w-full bg-popover text-popover-foreground border border-border rounded-lg shadow-lg px-4 py-3 text-sm text-gray-500 max-h-[90vh] overflow-y-auto">
          No results found
        </div>
      )}
    </div>
  )
}
