/**
 * SmartLoginInput — auto-detects whether the user is entering an email or
 * a phone number and renders the appropriate input (PhoneInput or a plain
 * email input). Includes an explicit toggle link to switch modes.
 */
import { useState, useMemo, useEffect, type MouseEvent } from 'react'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { prefetchInferredPhoneCountry } from '@/lib/inferPhoneCountryIso'
import { inferLoginUiPhoneMode } from '@/lib/loginIdentifier'

export interface SmartLoginInputProps {
  value: string
  onChange: (v: string) => void
  error?: string
  defaultCountryIso?: string
  /** When true (default), country code is inferred from IP + locale while the field is empty. */
  inferCountryFromLocation?: boolean
  autoFocus?: boolean
  /**
   * When set, rendered on the same row as the phone/email toggle, above the field
   * (e.g. “Email or Phone” left, “Use phone instead” right).
   */
  fieldLabel?: string
  /**
   * Stable `id` / `name` on the active field so password managers and browser
   * "save password" work with the form (use `name="login"` for the first field).
   */
  inputId?: string
  name?: string
  autoComplete?: string
  className?: string
  /** Taller fields + clearer label row (e.g. vendor login). */
  comfortable?: boolean
  /** With `comfortable`, shrink field heights and type ~20% (vendor login card). */
  dense?: boolean
  /** Replaces default `text-primary` on the email/phone toggle (e.g. vendor login link color). */
  hyperlinkClassName?: string
}

export function SmartLoginInput({
  value,
  onChange,
  error,
  defaultCountryIso = 'IN',
  inferCountryFromLocation = true,
  autoFocus = false,
  fieldLabel,
  inputId = 'login',
  name = 'login',
  autoComplete = 'username',
  className,
  comfortable = false,
  dense = false,
  hyperlinkClassName,
}: SmartLoginInputProps) {
  const [modeOverride, setModeOverride] = useState<'phone' | 'email' | null>(null)

  // Warm country cache on load so the picker is correct as soon as the user switches to phone
  useEffect(() => {
    if (inferCountryFromLocation) prefetchInferredPhoneCountry()
  }, [inferCountryFromLocation])

  const isPhone = useMemo(() => {
    if (modeOverride === 'phone') return true
    if (modeOverride === 'email') return false
    return inferLoginUiPhoneMode(value)
  }, [value, modeOverride])

  const handleToggle = (e: MouseEvent<HTMLButtonElement>) => {
    setModeOverride(isPhone ? 'email' : 'phone')
    onChange('')
    // Drop focus chrome so the toggle does not keep a bordered/underlined look after click.
    e.currentTarget.blur()
  }

  return (
    <div
      className={cn(
        'w-full',
        fieldLabel ? (comfortable ? (dense ? 'space-y-1' : 'space-y-2') : 'space-y-1.5') : 'space-y-1',
        className,
      )}
    >
      <div
        className={cn(
          'flex gap-2 border-0',
          comfortable && dense ? 'min-h-[1.6625rem]' : 'min-h-8',
          fieldLabel ? 'items-center justify-between' : 'justify-end',
        )}
      >
        {fieldLabel ? (
          <Label
            htmlFor={inputId}
            autoHelp={false}
            className={cn(
              'shrink-0 text-foreground',
              comfortable
                ? (dense ? 'text-xs font-medium' : 'text-[0.95rem] font-semibold')
                : 'text-sm font-medium',
            )}
          >
            {fieldLabel}
          </Label>
        ) : null}
        <button
          type="button"
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-lg border-0 bg-transparent shadow-none',
            'no-underline hover:no-underline focus:no-underline focus-visible:no-underline',
            'transition-colors focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
            'focus-visible:bg-primary/10',
            hyperlinkClassName ?? 'text-primary hover:bg-primary/10',
            comfortable
              ? (dense ? 'min-h-[1.6625rem] px-1.5 py-0 text-xs font-medium' : 'min-h-8 px-2 py-1 text-[0.95rem] font-semibold')
              : 'text-xs',
          )}
          onClick={handleToggle}
        >
          {isPhone ? (
            <>
              <Mail className={comfortable ? (dense ? 'h-3.5 w-3.5' : 'h-4 w-4') : 'h-3 w-3'} />
              Use email instead
            </>
          ) : (
            <>
              <Phone className={comfortable ? (dense ? 'h-3.5 w-3.5' : 'h-4 w-4') : 'h-3 w-3'} />
              Use phone instead
            </>
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
          inferCountryFromLocation={inferCountryFromLocation}
          comfortable={comfortable}
          dense={dense}
        />
      ) : (
        <>
          <div className="relative w-full">
            <Mail
              className={cn(
                'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground',
                comfortable ? (dense ? 'left-2.5 h-3.5 w-3.5' : 'left-3 h-4 w-4') : 'left-3 h-4 w-4',
              )}
            />
            <Input
              id={inputId}
              name={name}
              type="text"
              autoComplete={autoComplete}
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder="you@example.com or +919876543210"
              className={cn(
                comfortable
                  ? (
                      dense
                        ? 'h-[calc(2.75rem*0.95*0.76)] min-h-[calc(2.75rem*0.95*0.76)] w-full pl-9 text-xs rounded-md'
                        : 'h-[calc(2.75rem*0.95)] min-h-[calc(2.75rem*0.95)] w-full pl-10 text-[0.95rem] rounded-md'
                    )
                  : 'pl-9 rounded-md',
                error && 'border-destructive',
              )}
              autoFocus={autoFocus}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </>
      )}
    </div>
  )
}
