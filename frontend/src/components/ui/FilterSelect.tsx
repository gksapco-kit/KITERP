import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FilterSelectOption = {
  value: string
  label: string
}

type FilterSelectProps = {
  label: string
  value: string
  options: FilterSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

/** Portaled custom select — avoids Chrome clipping native select popups. */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Select…',
  className,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)
  const display = selected?.label || placeholder

  useEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const el = btnRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const width = Math.max(rect.width, 220)
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp = spaceBelow < 240 && rect.top > spaceBelow
      setMenuStyle({
        position: 'fixed',
        left: Math.min(rect.left, window.innerWidth - width - 8),
        width,
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
        maxHeight: Math.min(280, openUp ? rect.top - 12 : spaceBelow - 12),
        zIndex: 9999,
      })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={cn('w-full min-w-[12rem] sm:w-[14rem]', className)}>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (!disabled) setOpen((v) => !v)
        }}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-900',
          'hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30',
          disabled && 'cursor-not-allowed opacity-60 hover:border-gray-200',
          open && !disabled && 'border-primary/40 ring-2 ring-primary/20',
        )}
      >
        <span className="min-w-0 truncate">{display}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && !disabled
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              role="listbox"
              style={menuStyle}
              className="overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
            >
              {options.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No options</div>
              ) : (
                options.map((opt) => {
                  const active = opt.value === value
                  return (
                    <button
                      key={opt.value || '__empty'}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50',
                        active && 'bg-primary/5 font-medium text-primary',
                      )}
                      onClick={() => {
                        onChange(opt.value)
                        setOpen(false)
                      }}
                    >
                      <span className="min-w-0 truncate">{opt.label}</span>
                      {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                    </button>
                  )
                })
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
