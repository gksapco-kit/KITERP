import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Pencil, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { COMPANY_TYPES, COMPANY_TYPE_GROUPS } from '@/data/companyTypes'
import { SIGNUP_BRAND, SIGNUP_BRAND_HOVER } from '@/components/auth/signupTheme'

export type CompanyTypeDropdownProps = {
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  label?: string
  /** signup = green brand styling on /register; default = app primary */
  tone?: 'signup' | 'default'
  className?: string
  id?: string
}

function filterTypes(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) {
    return {
      groups: COMPANY_TYPE_GROUPS,
      items: COMPANY_TYPES,
    }
  }
  const items = COMPANY_TYPES.filter(
    (t) =>
      t.label.toLowerCase().includes(q) ||
      t.value.toLowerCase().includes(q) ||
      t.group.toLowerCase().includes(q),
  )
  const groups = COMPANY_TYPE_GROUPS.filter((g) => items.some((t) => t.group === g))
  return { groups, items }
}

type PanelPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
  openUp: boolean
}

function computePanelPosition(trigger: HTMLElement): PanelPosition {
  const rect = trigger.getBoundingClientRect()
  const gap = 4
  const spaceBelow = window.innerHeight - rect.bottom - gap
  const spaceAbove = rect.top - gap
  const openUp = spaceBelow < 220 && spaceAbove > spaceBelow
  const maxHeight = Math.min(320, Math.max(160, openUp ? spaceAbove : spaceBelow))
  return {
    top: openUp ? rect.top - gap : rect.bottom + gap,
    left: rect.left,
    width: rect.width,
    maxHeight,
    openUp,
  }
}

export function CompanyTypeDropdown({
  value,
  onChange,
  error,
  placeholder = 'Select business type…',
  label,
  tone = 'default',
  className,
  id,
}: CompanyTypeDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [customInput, setCustomInput] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const isSignup = tone === 'signup'
  const accent = isSignup ? SIGNUP_BRAND : undefined
  const accentHover = isSignup ? SIGNUP_BRAND_HOVER : undefined

  const updatePanelPos = useCallback(() => {
    if (!triggerRef.current) return
    setPanelPos(computePanelPosition(triggerRef.current))
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
      setShowCustom(false)
      setSearch('')
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!open) {
      setPanelPos(null)
      return
    }
    updatePanelPos()
    setSearch('')
    setShowCustom(false)
    requestAnimationFrame(() => searchRef.current?.focus())

    const onReposition = () => updatePanelPos()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, updatePanelPos])

  const { groups, items } = useMemo(() => filterTypes(search), [search])

  const preset = COMPANY_TYPES.find((t) => t.value === value)
  const Icon = preset?.icon

  const select = (v: string) => {
    onChange(v)
    setShowCustom(false)
    setOpen(false)
    setSearch('')
  }

  const addCustom = () => {
    const v = customInput.trim()
    if (!v) return
    onChange(v)
    setShowCustom(false)
    setOpen(false)
    setSearch('')
  }

  const openPanel = () => {
    setShowCustom(false)
    setOpen((wasOpen) => {
      const next = !wasOpen
      if (next && triggerRef.current) {
        setPanelPos(computePanelPosition(triggerRef.current))
      } else if (!next) {
        setPanelPos(null)
      }
      return next
    })
  }

  const dropdownPanel = open && panelPos ? (
    <div
      ref={panelRef}
      className="fixed z-[200] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
      style={{
        top: panelPos.top,
        left: panelPos.left,
        width: panelPos.width,
        maxHeight: panelPos.maxHeight,
        transform: panelPos.openUp ? 'translateY(-100%)' : undefined,
      }}
      role="listbox"
      aria-label="Business types"
    >
      <div className="shrink-0 border-b border-gray-100 bg-white p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setOpen(false)
                setSearch('')
              }
            }}
            placeholder="Search business type…"
            className="h-8 pl-8 pr-8 text-sm"
            aria-label="Search business types"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
              onClick={() => setSearch('')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {groups.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">No types match &ldquo;{search}&rdquo;</p>
        ) : (
          groups.map((group) => {
            const groupItems = items.filter((t) => t.group === group)
            if (groupItems.length === 0) return null
            return (
              <div key={group}>
                <p className="sticky top-0 bg-gray-50 px-4 pb-0.5 pt-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                  {group}
                </p>
                {groupItems.map(({ value: v, label, icon: ItemIcon }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => select(v)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-1.5 text-left transition-colors',
                      value === v && !isSignup && 'bg-accent',
                    )}
                    style={value === v && isSignup ? { backgroundColor: `${accent}15` } : undefined}
                    onMouseEnter={(e) => {
                      if (value !== v && isSignup) e.currentTarget.style.backgroundColor = `${accent}0d`
                    }}
                    onMouseLeave={(e) => {
                      if (value !== v) e.currentTarget.style.backgroundColor = ''
                    }}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
                        value === v ? (isSignup ? 'bg-[#64C3A0]' : 'bg-primary') : 'bg-gray-100',
                      )}
                    >
                      <ItemIcon className={cn('h-3 w-3', value === v ? 'text-white' : 'text-gray-500')} />
                    </span>
                    <span
                      className={cn('flex-1 text-sm', value === v ? 'font-semibold' : 'text-gray-700')}
                      style={value === v && isSignup ? { color: accentHover } : undefined}
                    >
                      {label}
                    </span>
                    {value === v && (
                      <Check
                        className={cn('h-3 w-3 shrink-0', !isSignup && 'text-primary')}
                        style={isSignup ? { color: accent } : undefined}
                      />
                    )}
                  </button>
                ))}
              </div>
            )
          })
        )}
      </div>

      <div className="shrink-0 border-t border-gray-100">
        {!showCustom ? (
          <button
            type="button"
            onClick={() => {
              setShowCustom(true)
              setCustomInput('')
            }}
            className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-gray-50"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-100">
              <Plus className="h-3.5 w-3.5 text-gray-500" />
            </span>
            <span className="text-sm font-medium text-gray-500">+ Add custom type…</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2">
            <Input
              autoFocus
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustom()
                }
              }}
              placeholder="e.g. Co-working, Lab, Studio…"
              className="h-8 flex-1 text-sm"
            />
            <Button type="button" size="sm" className="h-8 shrink-0 px-3" onClick={addCustom}>
              Add
            </Button>
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {label ? (
        <Label htmlFor={id} className="mb-1 block text-xs font-medium sm:text-sm">
          {label}
        </Label>
      ) : null}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={openPanel}
        className={cn(
          'flex h-9 min-h-9 w-full items-center gap-2 rounded-lg border bg-white px-3 text-sm text-left transition-all',
          open && !isSignup && 'border-primary ring-2 ring-primary/25',
          !open && !error && 'border-gray-200 hover:border-gray-300',
          error && 'border-red-400',
          !isSignup && 'rounded-md',
        )}
        style={
          open && isSignup
            ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}40` }
            : undefined
        }
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {Icon ? (
          <>
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded',
                !isSignup && 'rounded-md bg-primary/10',
              )}
              style={isSignup ? { backgroundColor: `${accent}22` } : undefined}
            >
              <Icon className={cn('h-3 w-3', !isSignup && 'text-primary')} style={isSignup ? { color: accent } : undefined} />
            </span>
            <span className="flex-1 truncate font-medium text-gray-800">{preset!.label}</span>
          </>
        ) : value ? (
          <>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-100">
              <Pencil className="h-3 w-3 text-gray-500" />
            </span>
            <span className="flex-1 truncate font-medium text-gray-800">
              {value} <span className="text-xs font-normal text-gray-400">(custom)</span>
            </span>
          </>
        ) : (
          <span className="flex-1 truncate text-sm text-gray-400 sm:text-base">{placeholder}</span>
        )}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {dropdownPanel && typeof document !== 'undefined' ? createPortal(dropdownPanel, document.body) : null}

      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
    </div>
  )
}
