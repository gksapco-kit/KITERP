import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn, formFieldFocusClassName } from '@/lib/utils'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'

export type ThemeSelectOption = {
  value: string
  label: string
}

/** Attribute on portaled menus — modals should ignore outside-click for these. */
export const THEME_SELECT_MENU_ATTR = 'data-theme-select-menu'

export const themeSelectUi = {
  trigger: cn(
    'flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50',
    formFieldFocusClassName,
  ),
  menu: 'z-[9999] max-h-60 overflow-auto rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg',
  item: 'group flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:outline-none',
  itemLabel: 'min-w-0 flex-1 truncate',
  check: 'ml-auto h-4 w-4 shrink-0 text-primary group-hover:text-primary-foreground group-focus-visible:text-primary-foreground',
} as const

export type ThemeSelectProps = {
  value: string
  onChange: (value: string) => void
  options: ThemeSelectOption[]
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  wrapperClassName?: string
  triggerClassName?: string
  menuZIndex?: number
  'aria-label'?: string
}

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
  menuZIndex = 9999,
  'aria-label': ariaLabel,
}: ThemeSelectProps) {
  const [open, setOpen] = useState(false)
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
  const listId = useId()
  const selected = options.find((o) => o.value === value)
  const displayLabel = selected?.label ?? placeholder

  const autoMenuMinWidth = useMemo(() => {
    const longest = options.reduce((max, o) => Math.max(max, (o.label || '').length), 0)
    return longest <= 4 ? 0 : 220
  }, [options])

  useEscapeToClose(() => setOpen(false), open)

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
      const estimatedMenuH = Math.min(240, Math.max(120, options.length * 40 + 8))
      const openUp = spaceBelow < estimatedMenuH && spaceAbove > spaceBelow
      const maxHeight = Math.min(240, Math.max(120, openUp ? spaceAbove : spaceBelow))
      const minWidth = Math.max(rect.width, autoMenuMinWidth)
      const maxAllowedWidth = Math.max(rect.width, window.innerWidth - edge * 2)
      const width = Math.min(Math.max(rect.width, minWidth), maxAllowedWidth)
      let left = rect.left
      if (left + width > window.innerWidth - edge) {
        left = Math.max(edge, window.innerWidth - width - edge)
      }
      left = Math.max(edge, Math.min(left, window.innerWidth - width - edge))
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
  }, [open, options.length, autoMenuMinWidth])

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

  useEffect(() => {
    if (!open) setMenuRect(null)
  }, [open])

  const { wrapper: splitWrapper, trigger: splitTrigger } = splitSelectClassName(className)

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
        className={cn(themeSelectUi.trigger, splitTrigger, triggerClassName)}
      >
        <span className={cn('min-w-0 flex-1 truncate leading-none', !selected && 'text-muted-foreground')}>
          {displayLabel}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
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
          }}
          className={themeSelectUi.menu}
        >
          {options.map((opt) => {
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
                className={themeSelectUi.item}
              >
                <span className={themeSelectUi.itemLabel}>{opt.label}</span>
                {isSelected ? <Check className={themeSelectUi.check} aria-hidden /> : null}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
