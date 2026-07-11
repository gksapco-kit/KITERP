import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type InlineEditCellBaseProps = {
  disabled?: boolean
  readOnly?: boolean
  readOnlyMessage?: string
  saving?: boolean
  className?: string
  title?: string
  /** Ellipsize long text. Set false for badges/chips that must stay fully visible. */
  truncateContent?: boolean
  children: ReactNode
}

type InlineEditTextProps = InlineEditCellBaseProps & {
  type?: 'text' | 'number'
  value: string | number
  onSave: (value: string | number) => void | Promise<void>
  parse?: (raw: string) => string | number
  validate?: (value: string | number) => string | null
  inputClassName?: string
  min?: number
  step?: string
}

type InlineEditSelectProps = InlineEditCellBaseProps & {
  type: 'select'
  value: string
  options: { value: string; label: string }[]
  onSave: (value: string) => void | Promise<void>
  display?: ReactNode
}

export type InlineEditCellProps = InlineEditTextProps | InlineEditSelectProps

function isSelectProps(props: InlineEditCellProps): props is InlineEditSelectProps {
  return props.type === 'select'
}

export function InlineEditCell(props: InlineEditCellProps) {
  const { disabled, readOnly, readOnlyMessage, saving, className, title, truncateContent = true } = props
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)
  const skipBlurSave = useRef(false)

  const startEditing = useCallback(() => {
    if (disabled || readOnly || saving) {
      if (readOnly) toast.info(readOnlyMessage ?? 'This value is calculated automatically')
      return
    }
    if (isSelectProps(props)) {
      setDraft(props.value)
    } else {
      setDraft(String(props.value ?? ''))
    }
    setError(null)
    setEditing(true)
  }, [disabled, readOnly, readOnlyMessage, saving, props])

  useEffect(() => {
    if (!editing) return
    const el = inputRef.current
    if (!el) return
    el.focus()
    if (el instanceof HTMLInputElement) {
      el.select()
    }
  }, [editing])

  const cancel = useCallback(() => {
    setEditing(false)
    setError(null)
  }, [])

  const commit = useCallback(async () => {
    if (isSelectProps(props)) {
      if (draft === props.value) {
        setEditing(false)
        return
      }
      try {
        await props.onSave(draft)
        setEditing(false)
        setError(null)
      } catch {
        setError('Could not save')
      }
      return
    }

    const parsed = props.parse ? props.parse(draft) : (
      props.type === 'number' ? (draft === '' ? 0 : Number(draft)) : draft.trim()
    )

    if (props.validate) {
      const validationError = props.validate(parsed)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    const unchanged = String(parsed) === String(props.value)
    if (unchanged) {
      setEditing(false)
      return
    }

    try {
      await props.onSave(parsed)
      setEditing(false)
      setError(null)
    } catch {
      setError('Could not save')
    }
  }, [draft, props])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  const onBlur = () => {
    if (skipBlurSave.current) {
      skipBlurSave.current = false
      return
    }
    void commit()
  }

  if (editing) {
    if (isSelectProps(props)) {
      return (
        <div data-stop-row-click className={cn('relative min-w-0', className)} title={title}>
          <select
            ref={inputRef as RefObject<HTMLSelectElement>}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              skipBlurSave.current = true
              void (async () => {
                try {
                  await props.onSave(e.target.value)
                  setEditing(false)
                  setError(null)
                } catch {
                  setError('Could not save')
                }
              })()
            }}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            className="h-8 w-full min-w-[5.5rem] rounded-md border border-blue-300 bg-white px-2 text-xs font-medium text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {props.options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {error && <p className="mt-0.5 text-[10px] text-red-600">{error}</p>}
        </div>
      )
    }

    return (
      <div data-stop-row-click className={cn('relative min-w-0', className)} title={title}>
        <Input
          ref={inputRef as RefObject<HTMLInputElement>}
          type={props.type === 'number' ? 'number' : 'text'}
          value={draft}
          min={props.min}
          step={props.step}
          onChange={(e) => { setDraft(e.target.value); setError(null) }}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          className={cn('h-8 text-sm', props.inputClassName)}
          disabled={saving}
        />
        {error && <p className="mt-0.5 text-[10px] text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div
      data-stop-row-click
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
      title={readOnly ? (readOnlyMessage ?? 'Calculated automatically') : (title ? `${title} — double-click to edit` : 'Double-click to edit')}
      onDoubleClick={(e) => {
        e.stopPropagation()
        startEditing()
      }}
      onKeyDown={(e) => {
        if (disabled || saving) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          startEditing()
        }
      }}
      className={cn(
        'relative w-full min-w-0 rounded-md px-1.5 py-1 text-left transition-colors',
        !disabled && !saving && 'cursor-default select-none',
        className,
      )}
    >
      <span className="flex items-center gap-1 min-w-0">
        <span className={cn('min-w-0 flex-1', truncateContent ? 'truncate' : 'whitespace-nowrap')}>
          {props.children}
        </span>
        {saving && <Loader2 className="w-3 h-3 shrink-0 animate-spin text-blue-500" />}
      </span>
    </div>
  )
}
