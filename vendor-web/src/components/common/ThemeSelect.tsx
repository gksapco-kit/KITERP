import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'

export type ThemeSelectOption = {
  value: string
  label: string
  hint?: string
  /** Renders options under a labeled section in the menu */
  group?: string
}

/** Semantic tokens — light, dark, and all KIT templates. */
export const themeSelectUi = {
  trigger:
    'form-select inline-flex h-10 w-full min-w-[8rem] items-center justify-between gap-2 px-2.5 text-sm text-left text-foreground transition-colors hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
  menu: 'absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 duration-100',
  item: 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
  itemActive: 'bg-primary/10 text-foreground dark:bg-primary/20',
  itemLabel: 'min-w-0 flex-1 truncate font-medium text-foreground',
  itemHint: 'block truncate text-xs text-muted-foreground',
  check: 'ml-auto h-4 w-4 shrink-0 text-primary',
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
  'aria-label'?: string
}

/** Split legacy `className` — field chrome on trigger, layout on wrapper. */
function splitSelectClassName(className?: string) {
  const wrapper: string[] = []
  const trigger: string[] = []
  for (const token of (className ?? '').split(/\s+/).filter(Boolean)) {
    const onWrapper =
      /^(relative|w-full|min-w-|max-w-|flex-1|flex-shrink|shrink|grow|basis-|mt-|mb-|ml-|mr-|mx-|my-|self-)/.test(
        token,
      )
    if (onWrapper) wrapper.push(token)
    else trigger.push(token)
  }
  return { wrapper: cn(wrapper), trigger: cn(trigger) }
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
  'aria-label': ariaLabel,
}: ThemeSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((o) => o.value === value)
  const displayLabel = selected?.label ?? placeholder

  const menuSections = useMemo(() => {
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
  }, [options])

  const renderOption = (opt: ThemeSelectOption) => {
    const isSelected = value === opt.value
    return (
      <button
        key={opt.value || `opt-${opt.label}`}
        type="button"
        role="option"
        aria-selected={isSelected}
        onClick={() => {
          onChange(opt.value)
          setOpen(false)
        }}
        className={cn(themeSelectUi.item, isSelected && themeSelectUi.itemActive)}
      >
        <div className="min-w-0 flex-1">
          <span className={themeSelectUi.itemLabel}>{opt.label}</span>
          {opt.hint ? <span className={themeSelectUi.itemHint}>{opt.hint}</span> : null}
        </div>
        {isSelected ? <Check className={themeSelectUi.check} aria-hidden /> : null}
      </button>
    )
  }

  useEscapeToClose(() => setOpen(false), open)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const { wrapper: splitWrapper, trigger: splitTrigger } = splitSelectClassName(className)

  return (
    <div ref={rootRef} className={cn('relative w-full min-w-0', splitWrapper, wrapperClassName)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(themeSelectUi.trigger, splitTrigger, triggerClassName)}
      >
        <span className={cn('min-w-0 flex-1 truncate leading-none', !selected && 'text-muted-foreground')}>{displayLabel}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 self-center text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div id={listId} role="listbox" aria-label={ariaLabel} className={themeSelectUi.menu}>
          {menuSections.ungrouped.map(renderOption)}
          {menuSections.groups.map(([group, items]) => (
            <div key={group} role="group" aria-label={group}>
              <div className={themeSelectUi.groupLabel}>{group}</div>
              {items.map(renderOption)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
