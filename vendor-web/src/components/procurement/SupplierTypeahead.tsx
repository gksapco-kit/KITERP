import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Input } from '@/components/ui/input'
import { Search, X, Loader2, User } from 'lucide-react'
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

// ──────────────────────────────────────────────────────────────────────────

export function SupplierTypeahead(props: Props) {
  const { mode, enabled = true, placeholder = 'Type to search suppliers…' } = props

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Debounce the search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // Reset active index when suggestions change
  useEffect(() => { setActiveIndex(-1) }, [debouncedQuery])

  const canSearch = debouncedQuery.length >= 2

  // Ids to exclude from the dropdown (already selected)
  const selectedIds =
    mode === 'multi'
      ? props.selectedSuppliers.map(s => s.id)
      : props.selectedSupplier
        ? [props.selectedSupplier.id]
        : []

  const { data, isFetching } = useQuery({
    queryKey: ['supplier-typeahead', debouncedQuery],
    queryFn: () => vendorApi.listSuppliers({ search: debouncedQuery, size: 8, is_active: true }),
    enabled: enabled && canSearch,
    placeholderData: prev => prev,
    staleTime: 10_000,
  })

  const suggestions = ((data?.items ?? []) as Supplier[]).filter(
    s => !selectedIds.includes(s.id),
  )

  function pick(supplier: Supplier) {
    if (mode === 'multi') {
      props.onChange([...props.selectedSuppliers, supplier])
    } else {
      props.onChange(supplier)
    }
    setQuery('')
    setDebouncedQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function remove(id: string) {
    if (mode === 'multi') {
      props.onChange(props.selectedSuppliers.filter(s => s.id !== id))
    } else {
      props.onChange(null)
    }
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    },
    [open, suggestions, activeIndex],
  )

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const showDropdown = open && query.trim().length > 0

  return (
    <div className="space-y-2">
      {/* Chips for selected suppliers */}
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

      {/* Selected chip for single-select */}
      {mode === 'single' && props.selectedSupplier && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="text-sm font-medium text-blue-800 flex-1">{props.selectedSupplier.name}</span>
          {props.selectedSupplier.email && (
            <span className="text-xs text-blue-500">{props.selectedSupplier.email}</span>
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

      {/* Search input — hide in single mode once a supplier is chosen */}
      {(mode === 'multi' || !props.selectedSupplier) && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            {isFetching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
            )}
            <Input
              ref={inputRef}
              value={query}
              placeholder={placeholder}
              onChange={e => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => query.trim().length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={handleKeyDown}
              className="h-9 pl-8 pr-8 text-sm"
              role="combobox"
              aria-expanded={showDropdown}
              aria-autocomplete="list"
            />
          </div>

          {/* Suggestion dropdown */}
          {showDropdown && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg overflow-hidden">
              <div ref={listRef} className="max-h-52 overflow-y-auto">
                {!canSearch && (
                  <p className="px-3 py-2.5 text-xs text-gray-400">Keep typing — at least 2 characters.</p>
                )}
                {canSearch && isFetching && suggestions.length === 0 && (
                  <p className="px-3 py-2.5 text-xs text-gray-400">Searching…</p>
                )}
                {canSearch && !isFetching && suggestions.length === 0 && (
                  <p className="px-3 py-2.5 text-xs text-gray-500">
                    No suppliers match <strong>"{debouncedQuery}"</strong>
                  </p>
                )}
                {suggestions.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => pick(s)}
                    className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                      idx === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{s.name}</p>
                      {(s.email || s.phone || s.gstin) && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {s.email || s.phone || s.gstin}
                        </p>
                      )}
                    </div>
                    {s.company_name && s.company_name !== s.name && (
                      <span className="text-xs text-gray-400 truncate max-w-[120px] shrink-0">
                        {s.company_name}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary count for multi */}
      {mode === 'multi' && props.selectedSuppliers.length > 0 && (
        <p className="text-xs text-blue-600">
          {props.selectedSuppliers.length} supplier{props.selectedSuppliers.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )
}
