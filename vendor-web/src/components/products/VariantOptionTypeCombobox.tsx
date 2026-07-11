import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import {
  CUSTOM_OPTION_TYPE_VALUE,
  filterVariantOptionTypes,
  findCatalogMatchByLabel,
} from '@/lib/variantOptionTypes'

interface Props {
  excludeLabels: string[]
  onPickCatalog: (typeValue: string) => void
  onPickCustom: (displayName: string) => void
  disabled?: boolean
  placeholder?: string
}

export function VariantOptionTypeCombobox({
  excludeLabels,
  onPickCatalog,
  onPickCustom,
  disabled,
  placeholder = 'Search option type (Color, Size, Storage…)',
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(
    () => filterVariantOptionTypes(query, excludeLabels),
    [query, excludeLabels],
  )

  const trimmed = query.trim()
  const exactCatalog = useMemo(
    () => (trimmed ? findCatalogMatchByLabel(trimmed, excludeLabels) : undefined),
    [trimmed, excludeLabels],
  )

  const showCustomCreate = trimmed.length > 0
    && !exactCatalog
    && !excludeLabels.some(l => l.toLowerCase() === trimmed.toLowerCase())

  type Row =
    | { kind: 'custom-pick'; label: string }
    | { kind: 'custom-create'; label: string }
    | { kind: 'catalog'; value: string; label: string; group?: string; hint?: string }

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    if (!trimmed) {
      out.push({ kind: 'custom-pick', label: 'Custom…' })
    }
    if (showCustomCreate) {
      out.push({ kind: 'custom-create', label: trimmed })
    }
    for (const opt of filtered) {
      if (opt.value === CUSTOM_OPTION_TYPE_VALUE) {
        if (trimmed) out.push({ kind: 'custom-pick', label: 'Custom…' })
        continue
      }
      out.push({
        kind: 'catalog',
        value: opt.value,
        label: opt.label,
        group: opt.group,
        hint: opt.hint,
      })
    }
    return out
  }, [filtered, trimmed, showCustomCreate])

  useEscapeToClose(() => setOpen(false), open)

  useEffect(() => {
    setActiveIndex(0)
  }, [query, rows.length])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const pickRow = (row: Row) => {
    if (row.kind === 'catalog') {
      onPickCatalog(row.value)
      setQuery('')
      setOpen(false)
      return
    }
    if (row.kind === 'custom-create') {
      onPickCustom(row.label)
      setQuery('')
      setOpen(false)
      return
    }
    // custom-pick: use typed text if present, otherwise keep typing in the field
    if (trimmed) {
      onPickCustom(trimmed)
      setQuery('')
    }
    setOpen(false)
  }

  const submitQuery = () => {
    if (rows.length === 0) {
      if (trimmed) onPickCustom(trimmed)
      setQuery('')
      setOpen(false)
      return
    }
    pickRow(rows[Math.min(activeIndex, rows.length - 1)])
  }

  const groupedCatalog = useMemo(() => {
    const groups = new Map<string, Row[]>()
    for (const row of rows) {
      if (row.kind !== 'catalog') continue
      const g = row.group ?? 'Other'
      const list = groups.get(g) ?? []
      list.push(row)
      groups.set(g, list)
    }
    return groups
  }, [rows])

  void groupedCatalog

  const renderRow = (row: Row, index: number) => {
    const isActive = index === activeIndex
    if (row.kind === 'custom-pick') {
      return (
        <button
          key="custom-pick"
          type="button"
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => pickRow(row)}
          className={cn(
            'flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors',
            isActive ? 'bg-primary/10' : 'hover:bg-muted/60',
          )}
        >
          <span className="font-medium">Custom…</span>
          <span className="text-xs text-muted-foreground">Enter your own option type name</span>
        </button>
      )
    }
    if (row.kind === 'custom-create') {
      return (
        <button
          key="custom-create"
          type="button"
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => pickRow(row)}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
            isActive ? 'bg-primary/10' : 'hover:bg-muted/60',
          )}
        >
          <span className="font-medium">Create &quot;{row.label}&quot; as custom option</span>
        </button>
      )
    }
    return (
      <button
        key={row.value}
        type="button"
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => pickRow(row)}
        className={cn(
          'flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors',
          isActive ? 'bg-primary/10' : 'hover:bg-muted/60',
        )}
      >
        <span className="font-medium">{row.label}</span>
        {row.hint && <span className="text-xs text-muted-foreground">{row.hint}</span>}
      </button>
    )
  }

  // Flat index for keyboard nav — rebuild order matching render
  const flatRows = rows

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            'h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActiveIndex(i => Math.min(i + 1, flatRows.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIndex(i => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              submitQuery()
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
      </div>

      {open && !disabled && flatRows.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full min-w-[280px] overflow-y-auto rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg">
          {flatRows.map((row, idx) => {
            if (row.kind === 'catalog') {
              const prev = flatRows[idx - 1]
              const showGroup = row.group && (idx === 0 || (prev?.kind === 'catalog' && prev.group !== row.group) || prev?.kind !== 'catalog')
              return (
                <div key={row.value}>
                  {showGroup && (
                    <div className="sticky top-0 bg-popover/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                      {row.group}
                    </div>
                  )}
                  {renderRow(row, idx)}
                </div>
              )
            }
            return renderRow(row, idx)
          })}
        </div>
      )}

      {open && !disabled && trimmed && flatRows.length === 0 && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] rounded-lg border border-border bg-popover p-3 text-sm text-muted-foreground shadow-lg">
          No matches — press Enter to create &quot;{trimmed}&quot; as a custom option.
        </div>
      )}
    </div>
  )
}
