/**
 * SmartLoginInput — auto-detects whether the user is entering an email or
 * a phone number and renders the appropriate input (PhoneInput or a plain
 * email input). Includes an explicit toggle link to switch modes.
 */
import { useState, useMemo } from 'react'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Phone } from 'lucide-react'
import { cn, focusRingClassName } from '@/lib/utils'
import { inferLoginUiPhoneMode } from '@/lib/loginIdentifier'

export interface SmartLoginInputProps {
  value: string
  onChange: (v: string) => void
  error?: string
  defaultCountryIso?: string
  className?: string
  inputClassName?: string
  /** Same row as toggle, above the field (e.g. “Email or Phone”). */
  fieldLabel?: string
  inputId?: string
  name?: string
  autoComplete?: string
}

export function SmartLoginInput({
  value,
  onChange,
  error,
  defaultCountryIso = 'IN',
  className = '',
  inputClassName = 'h-11 rounded-xl',
  fieldLabel,
  inputId = 'login',
  name = 'login',
  autoComplete = 'username',
}: SmartLoginInputProps) {
  const [modeOverride, setModeOverride] = useState<'phone' | 'email' | null>(null)

  const isPhone = useMemo(() => {
    if (modeOverride === 'phone') return true
    if (modeOverride === 'email') return false
    return inferLoginUiPhoneMode(value)
  }, [value, modeOverride])

  const handleToggle = () => {
    setModeOverride(isPhone ? 'email' : 'phone')
    onChange('')
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className={cn('flex items-center gap-2', fieldLabel ? 'justify-between' : 'justify-end')}>
        {fieldLabel ? (
          <Label htmlFor={inputId} className="shrink-0 text-sm font-medium text-gray-700">
            {fieldLabel}
          </Label>
        ) : null}
        <button
          type="button"
          className={cn(
            'inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[color:var(--color-secondary)] hover:underline rounded-md',
            focusRingClassName,
          )}
          onClick={handleToggle}
        >
          {isPhone ? (
            <><Mail className="w-3 h-3" /> Use email instead</>
          ) : (
            <><Phone className="w-3 h-3" /> Use phone instead</>
          )}
        </button>
      </div>
      {isPhone ? (
        <PhoneInput
          id={inputId}
          name={name}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          error={error}
          defaultCountryIso={defaultCountryIso}
          className={inputClassName}
          showErrorMessage={false}
        />
      ) : (
        <>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              id={inputId}
              name={name}
              type="text"
              autoComplete={autoComplete}
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder="you@example.com or +919876543210"
              className={cn(
                'pl-9 border-gray-300',
                inputClassName,
                error && 'border-red-400 focus-visible:ring-red-200',
              )}
            />
          </div>
        </>
      )}
      <p className={cn('text-xs leading-snug min-h-[1.125rem]', error ? 'text-red-600' : 'text-transparent')}>
        {error || '\u00a0'}
      </p>
    </div>
  )
}
