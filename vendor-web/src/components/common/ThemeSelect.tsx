import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn, searchFieldInnerInputClassName, formFieldFocusClassName } from '@/lib/utils'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'

export type ThemeSelectOption = {
  value: string
  label: string
  hint?: string
  /** Renders options under a labeled section in the menu */
  group?: string
  /** Optional inline style (e.g. font-family preview in the picker). */
  style?: CSSProperties
}

/** Attribute on portaled ThemeSelect menus — Dialog must ignore outside-click for these. */
export const THEME_SELECT_MENU_ATTR = 'data-theme-select-menu'

/** Long lists (e.g. UOM) get a search field automatically unless overridden. */
const SEARCHABLE_AUTO_THRESHOLD = 12

/** Semantic tokens — light, dark, and all KIT templates. */
export const themeSelectUi = {
  trigger:
    `form-select inline-flex h-10 w-full min-w-0 items-center justify-between gap-2 px-2.5 text-sm text-left text-foreground leading-snug transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50 ${formFieldFocusClassName}`,
  menu: 'z-[9999] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 flex flex-col',
  menuList: 'min-h-0 flex-1 overflow-auto py-1',
  searchRow: 'flex shrink-0 items-center gap-2 border-b border-border px-2.5 py-2',
  item: 'group flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:outline-none',
  itemActive: '',
  itemHighlighted: 'bg-primary text-primary-foreground',
  itemLabel: 'min-w-0 flex-1 font-medium whitespace-normal break-words leading-snug',
  itemHint: 'block truncate text-xs leading-snug text-muted-foreground group-hover:text-primary-foreground/80 group-focus-visible:text-primary-foreground/80 group-[.bg-primary]:text-primary-foreground/80',
  check: 'ml-auto h-4 w-4 shrink-0 text-primary group-hover:text-primary-foreground group-focus-visible:text-primary-foreground group-[.bg-primary]:text-primary-foreground',
  groupLabel:
    'px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sticky top-0 bg-popover/95 backdrop-blur-sm',
} as const

export type ThemeSelectProps = {
  value: string
  onChange: (value: string) => void
  options: ThemeSelectOption[]
  placeholder?: string
  disabled?: boolean
  id?: string
  /** Field appearance (height, border overrides). Layout width → `wrapperClassName`. */
  className?: string
  /** Root wrapper layout (max-width, margin). */
  wrapperClassName?: string
  /** Extra classes on the trigger button (e.g. status tint) */
  triggerClassName?: string
  /** Stacking order for the portaled menu (default above modals). */
  menuZIndex?: number
  /** Minimum menu width in px. Omit to auto-size from options (compact for short labels). */
  menuMinWidth?: number
  /** Menu open direction. `auto` flips when space is tight; `top` / `bottom` force a side. */
  menuPlacement?: 'auto' | 'top' | 'bottom'
  /**
   * Show a search field in the menu. Defaults to true when there are many options
   * (UOM, country lists, etc.) so users can type to find a value.
   */
  searchable?: boolean
  /** Placeholder for the in-menu search field. */
  searchPlaceholder?: string
  /** Optional style for the closed trigger label (e.g. font preview). */
  triggerLabelStyle?: CSSProperties
  /** Notified when the menu opens or closes. */
  onOpenChange?: (open: boolean) => void
  /**
   * When false, option hints still appear in the menu but not on the closed trigger
   * (keeps field height aligned with single-line inputs/selects).
   */
  showSelectedHint?: boolean
  'aria-label'?: string
}

/** Split legacy `className` — field chrome on trigger, layout on wrapper. */
function splitSelectClassName(className?: string) {
  const wrapper: string[] = []
  const trigger: string[] = []
  for (const token of (className ?? '').split(/\s+/).filter(Boolean)) {
    // Width/layout utilities must hit the wrapper — trigger-only `w-*` leaves
    // the default `w-full` wrapper and forces each select onto its own row.
    const onWrapper =
      /^(relative|w-|min-w-|max-w-|flex-1|flex-shrink|shrink|grow|basis-|mt-|mb-|ml-|mr-|mx-|my-|self-)/.test(
        token,
      )
    if (onWrapper) wrapper.push(token)
    else trigger.push(token)
  }
  return { wrapper: cn(wrapper), trigger: cn(trigger) }
}

/** Collapse punctuation / accents so "litre", "liter", "kg" compare cleanly. */
function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    // litre↔liter, metre↔meter, tonne↔tonne already covered loosely via fuzzy
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** British/US spelling variants used a lot in UOM labels. */
function spellingVariants(s: string): string[] {
  const out = new Set<string>([s])
  const swap = (from: RegExp, to: string) => {
    if (from.test(s)) out.add(s.replace(from, to))
  }
  swap(/re\b/g, 'er') // litre → liter
  swap(/er\b/g, 're') // liter → litre
  swap(/our\b/g, 'or') // colour → color (rare in UOM)
  swap(/or\b/g, 'our')
  swap(/yse\b/g, 'yze')
  swap(/yze\b/g, 'yse')
  return [...out]
}

function isSubsequence(query: string, text: string): boolean {
  if (!query) return true
  let i = 0
  for (let t = 0; t < text.length && i < query.length; t++) {
    if (text[t] === query[i]) i++
  }
  return i === query.length
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  if (Math.abs(a.length - b.length) > 3) return 99
  const prev = new Array(b.length + 1)
  const cur = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    let rowMin = cur[0]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (cur[j] < rowMin) rowMin = cur[j]
    }
    if (rowMin > 3) return 99
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]
  }
  return prev[b.length]
}

function fuzzyDistanceThreshold(queryLen: number): number {
  if (queryLen <= 2) return 0 // single/double letters stay exact / prefix only
  if (queryLen <= 4) return 1
  if (queryLen <= 7) return 2
  return 3
}

/**
 * Lower = better.
 * Exact prefix → contains → subsequence (kilo→kilogram via chars) → fuzzy typo match.
 */
function optionMatchRank(opt: ThemeSelectOption, query: string): number {
  const raw = query.trim().toLowerCase()
  if (!raw) return 0
  const q = normalizeSearchText(raw)
  if (!q) return 0

  const label = normalizeSearchText(opt.label)
  const value = normalizeSearchText(opt.value)
  const hint = normalizeSearchText(opt.hint || '')
  const group = normalizeSearchText(opt.group || '')
  const haystacks = [label, value, hint].filter(Boolean)
  const words = haystacks.flatMap((h) => h.split(/\s+/).filter(Boolean))
  const qVariants = spellingVariants(q)

  for (const qv of qVariants) {
    if (label.startsWith(qv) || label.split(/\s+/).some((w) => w.startsWith(qv))) return 0
    if (value.startsWith(qv)) return 1
    if (words.some((w) => w.startsWith(qv))) return 2
    if (hint.startsWith(qv)) return 3
  }
  for (const qv of qVariants) {
    if (haystacks.some((h) => h.includes(qv)) || words.some((w) => w.includes(qv))) return 4
    if (group.includes(qv)) return 5
  }

  // Approximate: typed chars appear in order ("kgr" → kilogram, "pch" → pouch)
  if (q.length >= 2 && haystacks.some((h) => isSubsequence(q.replace(/\s+/g, ''), h.replace(/\s+/g, '')))) {
    return 6
  }

  // Approximate: small typos against whole label or individual words ("kilgram", "pouch"←"poch")
  const maxDist = fuzzyDistanceThreshold(q.length)
  if (maxDist > 0) {
    for (const qv of qVariants) {
      for (const target of [...words, label, value]) {
        if (!target) continue
        // Only compare similarly sized strings so "kg" doesn't fuzzy-match everything.
        if (Math.abs(target.length - qv.length) > maxDist + 1) continue
        if (levenshtein(qv, target) <= maxDist) return 7
      }
      // Also allow query ≈ a prefix of a longer word (e.g. "kilgram" vs "kilogram")
      for (const w of words) {
        if (w.length < qv.length) continue
        const prefix = w.slice(0, Math.min(w.length, qv.length + maxDist))
        if (Math.abs(prefix.length - qv.length) > maxDist) continue
        if (levenshtein(qv, prefix) <= maxDist) return 8
      }
    }
  }

  return 99
}

function optionMatchesQuery(opt: ThemeSelectOption, query: string): boolean {
  return optionMatchRank(opt, query) < 99
}

function rankAndFilterOptions(options: ThemeSelectOption[], query: string): ThemeSelectOption[] {
  const q = query.trim()
  if (!q) return options
  return options
    .filter((o) => optionMatchesQuery(o, q))
    .sort((a, b) => {
      const rankDiff = optionMatchRank(a, q) - optionMatchRank(b, q)
      if (rankDiff !== 0) return rankDiff
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    })
}

function buildMenuSections(options: ThemeSelectOption[]) {
  const ungrouped: ThemeSelectOption[] = []
  const groups = new Map<string, ThemeSelectOption[]>()
  for (const opt of options) {
    if (opt.group) {
      const list = groups.get(opt.group) ?? []
      list.push(opt)
      groups.set(opt.group, list)
    } else {
      ungrouped.push(opt)
    }
  }
  return { ungrouped, groups: [...groups.entries()] }
}

export function ThemeSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  id,
  className,
  wrapperClassName,
  triggerClassName,
  menuZIndex = 9999,
  menuMinWidth,
  menuPlacement = 'auto',
  searchable,
  searchPlaceholder = 'Type a letter…',
  triggerLabelStyle,
  onOpenChange,
  showSelectedHint = true,
  'aria-label': ariaLabel,
}: ThemeSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [menuRect, setMenuRect] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
    minWidth: number
    maxHeight: number
    openUp: boolean
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const typeaheadRef = useRef({ buffer: '', timer: 0 as ReturnType<typeof setTimeout> | 0 })
  /** Skip the next search onChange — browser may re-insert the key that opened/seeded the filter. */
  const suppressSearchInputRef = useRef(false)
  const listId = useId()
  const selected = options.find((o) => o.value === value)
  const displayLabel = selected?.label ?? placeholder
  const isSearchable = searchable ?? options.length >= SEARCHABLE_AUTO_THRESHOLD
  const hasQuery = query.trim().length > 0

  const autoMenuMinWidth = useMemo(() => {
    if (menuMinWidth != null) return menuMinWidth
    const longest = options.reduce((max, o) => Math.max(max, (o.label || '').length, (o.hint || '').length), 0)
    // Short numeric options (e.g. page size) stay compact but wide enough for
    // the label + checkmark on one line. Form fields keep room for labels.
    return longest <= 4 ? 88 : 280
  }, [menuMinWidth, options])

  // While typing, flatten + rank so "P" puts Pack/Pair/Pouch at the top (not buried in groups).
  const filteredOptions = useMemo(() => {
    if (!isSearchable || !hasQuery) return options
    return rankAndFilterOptions(options, query)
  }, [options, query, isSearchable, hasQuery])

  const menuSections = useMemo(() => {
    if (hasQuery) {
      // Flat ranked list — groups would hide letter matches below other sections.
      return { ungrouped: filteredOptions, groups: [] as [string, ThemeSelectOption[]][] }
    }
    return buildMenuSections(filteredOptions)
  }, [filteredOptions, hasQuery])

  const flatFiltered = useMemo(() => {
    if (hasQuery) return filteredOptions
    const items: ThemeSelectOption[] = [...menuSections.ungrouped]
    for (const [, groupItems] of menuSections.groups) items.push(...groupItems)
    return items
  }, [menuSections, filteredOptions, hasQuery])

  const selectOption = (opt: ThemeSelectOption) => {
    onChange(opt.value)
    setOpen(false)
    setQuery('')
    setHighlightIndex(-1)
    triggerRef.current?.focus()
  }

  const renderOption = (opt: ThemeSelectOption, flatIndex: number) => {
    const isSelected = value === opt.value
    const isHighlighted = flatIndex === highlightIndex
    return (
      <button
        key={opt.value || `opt-${opt.label}`}
        type="button"
        role="option"
        aria-selected={isSelected}
        data-theme-select-option={flatIndex}
        onMouseEnter={() => setHighlightIndex(flatIndex)}
        // Select on mousedown (with preventDefault) so the choice sticks inside
        // portaled modals: searchable menus focus an input, and a blur/close race
        // can swallow the subsequent click before onChange runs.
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          selectOption(opt)
        }}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        className={cn(
          themeSelectUi.item,
          isSelected && themeSelectUi.itemActive,
          isHighlighted && themeSelectUi.itemHighlighted,
        )}
      >
        <div className="min-w-0 flex-1">
          <span
            className={cn(themeSelectUi.itemLabel, (opt.label || '').length <= 4 && 'whitespace-nowrap break-normal')}
            style={opt.style}
          >
            {opt.label}
          </span>
          {opt.hint ? <span className={themeSelectUi.itemHint}>{opt.hint}</span> : null}
        </div>
        {isSelected ? <Check className={themeSelectUi.check} aria-hidden /> : null}
      </button>
    )
  }

  useEscapeToClose(() => setOpen(false), open)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setHighlightIndex(-1)
      setMenuRect(null)
      onOpenChange?.(false)
    } else {
      onOpenChange?.(true)
    }
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open || !isSearchable) return
    const focusSearch = () => searchRef.current?.focus({ preventScroll: true })
    const raf = requestAnimationFrame(focusSearch)
    const t = window.setTimeout(focusSearch, 0)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t)
    }
  }, [open, isSearchable])

  useEffect(() => {
    if (!open) return
    if (hasQuery) {
      // Always put the best letter-match under the caret at the top.
      setHighlightIndex(flatFiltered.length ? 0 : -1)
      listRef.current?.scrollTo({ top: 0 })
      return
    }
    const buf = typeaheadRef.current.buffer
    if (buf && !isSearchable) {
      const matchIdx = flatFiltered.findIndex(
        (o) => o.label.toLowerCase().startsWith(buf) || o.value.toLowerCase().startsWith(buf),
      )
      if (matchIdx >= 0) {
        setHighlightIndex(matchIdx)
        return
      }
    }
    const selectedIdx = flatFiltered.findIndex((o) => o.value === value)
    setHighlightIndex(selectedIdx >= 0 ? selectedIdx : flatFiltered.length ? 0 : -1)
  }, [open, query]) // eslint-disable-line react-hooks/exhaustive-deps -- reset highlight when filter changes

  useEffect(() => {
    if (!open || highlightIndex < 0) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-theme-select-option="${highlightIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, highlightIndex])

  useEffect(() => {
    if (!open) return
    const updateMenuRect = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const gap = 4
      const edge = 8
      const spaceBelow = window.innerHeight - rect.bottom - gap
      const spaceAbove = rect.top - gap
      // Prefer opening down; flip up when the footer/viewport would clip the menu.
      const estimatedMenuH = Math.min(280, Math.max(140, options.length * 40 + (isSearchable ? 48 : 8)))
      const openUp =
        menuPlacement === 'top'
          ? true
          : menuPlacement === 'bottom'
            ? false
            : spaceBelow < estimatedMenuH && spaceAbove > spaceBelow
      const maxHeight = Math.min(280, Math.max(140, openUp ? spaceAbove : spaceBelow))
      const minWidth = Math.max(rect.width, autoMenuMinWidth)
      const maxAllowedWidth = Math.max(rect.width, window.innerWidth - edge * 2)
      const width = Math.min(Math.max(rect.width, minWidth), maxAllowedWidth)
      let left = rect.left
      if (left + width > window.innerWidth - edge) {
        left = Math.max(edge, window.innerWidth - width - edge)
      }
      left = Math.max(edge, Math.min(left, window.innerWidth - width - edge))
      // Use `bottom` when opening up so CSS zoom animations can't wipe `translateY(-100%)`.
      setMenuRect({
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
        left,
        width: rect.width,
        minWidth: width,
        maxHeight,
        openUp,
      })
    }
    updateMenuRect()
    window.addEventListener('scroll', updateMenuRect, true)
    window.addEventListener('resize', updateMenuRect)
    return () => {
      window.removeEventListener('scroll', updateMenuRect, true)
      window.removeEventListener('resize', updateMenuRect)
    }
  }, [open, options.length, autoMenuMinWidth, menuPlacement, isSearchable])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Route letter keys into search even if focus left the input (e.g. after clicking an option row).
  useEffect(() => {
    if (!open || !isSearchable) return
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const inSearch =
        target === searchRef.current ||
        document.activeElement === searchRef.current
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (inSearch) return // handled by input onKeyDown
        e.preventDefault()
        setHighlightIndex((prev) => {
          if (!flatFiltered.length) return -1
          if (prev < 0) return e.key === 'ArrowDown' ? 0 : flatFiltered.length - 1
          const next = e.key === 'ArrowDown' ? prev + 1 : prev - 1
          return (next + flatFiltered.length) % flatFiltered.length
        })
        return
      }
      if (e.key === 'Enter') {
        if (inSearch) return
        if (highlightIndex >= 0 && flatFiltered[highlightIndex]) {
          e.preventDefault()
          selectOption(flatFiltered[highlightIndex])
        }
        return
      }
      if (e.key === 'Backspace' && !inSearch) {
        e.preventDefault()
        setQuery((q) => q.slice(0, -1))
        searchRef.current?.focus({ preventScroll: true })
        return
      }
      if (e.key.length !== 1 || e.key === ' ') return
      // Printable character — always filter from the top by letter.
      // Skip when search already has focus (native input handles the key). Also skip when the
      // closed-field type-to-open path already seeded query for this same keystroke.
      if (!inSearch && e.target !== triggerRef.current) {
        e.preventDefault()
        suppressSearchInputRef.current = true
        setQuery((q) => q + e.key)
        searchRef.current?.focus({ preventScroll: true })
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            suppressSearchInputRef.current = false
          })
        })
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, isSearchable, flatFiltered, highlightIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Type-ahead when the menu is open and there is no search field (short lists).
  useEffect(() => {
    if (!open || isSearchable) return
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightIndex((prev) => {
          if (!flatFiltered.length) return -1
          if (prev < 0) return e.key === 'ArrowDown' ? 0 : flatFiltered.length - 1
          const next = e.key === 'ArrowDown' ? prev + 1 : prev - 1
          return (next + flatFiltered.length) % flatFiltered.length
        })
        return
      }
      if (e.key === 'Enter' && highlightIndex >= 0 && flatFiltered[highlightIndex]) {
        e.preventDefault()
        selectOption(flatFiltered[highlightIndex])
        return
      }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      const next = `${typeaheadRef.current.buffer}${e.key}`.toLowerCase()
      typeaheadRef.current.buffer = next
      window.clearTimeout(typeaheadRef.current.timer)
      typeaheadRef.current.timer = setTimeout(() => {
        typeaheadRef.current.buffer = ''
      }, 700)
      const matchIdx = flatFiltered.findIndex(
        (o) => o.label.toLowerCase().startsWith(next) || o.value.toLowerCase().startsWith(next),
      )
      if (matchIdx >= 0) setHighlightIndex(matchIdx)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(typeaheadRef.current.timer)
    }
  }, [open, isSearchable, flatFiltered, highlightIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const moveHighlight = (delta: number) => {
    if (!flatFiltered.length) return
    setHighlightIndex((prev) => {
      if (prev < 0) return delta > 0 ? 0 : flatFiltered.length - 1
      return (prev + delta + flatFiltered.length) % flatFiltered.length
    })
  }

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveHighlight(1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveHighlight(-1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIndex >= 0 && flatFiltered[highlightIndex]) {
        selectOption(flatFiltered[highlightIndex])
      } else if (flatFiltered.length === 1) {
        selectOption(flatFiltered[0])
      }
      return
    }
    if (e.key === 'Home') {
      e.preventDefault()
      if (flatFiltered.length) setHighlightIndex(0)
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      if (flatFiltered.length) setHighlightIndex(flatFiltered.length - 1)
    }
  }

  /** Type while the closed field is focused — opens the menu and starts filtering. */
  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || open) return
    if (e.ctrlKey || e.metaKey || e.altKey) return

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setQuery('')
      setOpen(true)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setQuery('')
      setOpen(true)
      return
    }
    if (e.key.length !== 1) return
    // Ignore keys that aren't useful for search (symbols still allowed; skip control-ish)
    if (e.key === 'Tab') return

    e.preventDefault()
    if (isSearchable) {
      // Seed the filter once; suppress the search input's onChange so focusing the field
      // doesn't re-insert this same keystroke (would show "ll" for one "l").
      suppressSearchInputRef.current = true
      setQuery(e.key)
      setOpen(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          suppressSearchInputRef.current = false
        })
      })
      return
    }
    typeaheadRef.current.buffer = e.key.toLowerCase()
    window.clearTimeout(typeaheadRef.current.timer)
    typeaheadRef.current.timer = setTimeout(() => {
      typeaheadRef.current.buffer = ''
    }, 700)
    setOpen(true)
  }

  const { wrapper: splitWrapper, trigger: splitTrigger } = splitSelectClassName(className)
  const showHintOnTrigger = Boolean(showSelectedHint && selected?.hint)

  let flatCursor = 0
  const nextFlatIndex = () => flatCursor++

  return (
    <div ref={rootRef} className={cn('relative w-full min-w-0', splitWrapper, wrapperClassName)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          themeSelectUi.trigger,
          showHintOnTrigger && 'h-auto min-h-10 py-1.5 items-start',
          splitTrigger,
          triggerClassName,
        )}
      >
        {showHintOnTrigger ? (
          <span className="min-w-0 flex-1 overflow-hidden">
            <span className="block truncate leading-snug" style={triggerLabelStyle}>{displayLabel}</span>
            <span className="block truncate text-[11px] leading-tight text-muted-foreground">{selected!.hint}</span>
          </span>
        ) : (
          <span
            className={cn('min-w-0 flex-1 truncate leading-snug', !selected && 'text-muted-foreground')}
            style={triggerLabelStyle}
          >
            {displayLabel}
          </span>
        )}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            showHintOnTrigger ? 'self-start mt-1' : 'self-center',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && menuRect && createPortal(
        <div
          ref={menuRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          {...{ [THEME_SELECT_MENU_ATTR]: '' }}
          style={{
            position: 'fixed',
            top: menuRect.top,
            bottom: menuRect.bottom,
            left: menuRect.left,
            width: menuRect.width,
            minWidth: menuRect.minWidth,
            maxHeight: menuRect.maxHeight,
            zIndex: menuZIndex,
            // Radix modals set `pointer-events: none` on body; this menu is a body
            // portal and would inherit it, making options unclickable inside a Sheet.
            pointerEvents: 'auto',
          }}
          className={cn(themeSelectUi.menu, menuRect.openUp && 'origin-bottom')}
        >
          {isSearchable ? (
            <div
              className={themeSelectUi.searchRow}
              onMouseDown={(e) => {
                // Keep menu focus behavior for chrome/buttons, but allow the input to take caret.
                if ((e.target as HTMLElement).tagName === 'INPUT') return
                e.preventDefault()
              }}
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => {
                  if (suppressSearchInputRef.current) return
                  setQuery(e.target.value)
                }}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-kiterp-no-field-focus
                className={cn(
                  searchFieldInnerInputClassName,
                  'min-w-0 flex-1 text-sm text-foreground placeholder:text-muted-foreground',
                )}
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery('')
                    searchRef.current?.focus()
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ) : null}

          <div ref={listRef} className={themeSelectUi.menuList}>
            {flatFiltered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">No results</p>
            ) : (
              <>
                {menuSections.ungrouped.map((opt) => renderOption(opt, nextFlatIndex()))}
                {menuSections.groups.map(([group, items]) => (
                  <div key={group} role="group" aria-label={group}>
                    <div className={themeSelectUi.groupLabel}>{group}</div>
                    {items.map((opt) => renderOption(opt, nextFlatIndex()))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
