/**
 * SmartLoginInput — auto-detects whether the user is entering an email or
 * a phone number and renders the appropriate input (PhoneInput or a plain
 * email input). Includes an explicit toggle link to switch modes.
 */
import { useState, useMemo, useEffect } from 'react'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Input } from '@/components/ui/input'
import { Mail, Phone } from 'lucide-react'
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
   * Stable `id` / `name` on the active field so password managers and browser
   * "save password" work with the form (use `name="login"` for the first field).
   */
  inputId?: string
  name?: string
  autoComplete?: string
  className?: string
}

export function SmartLoginInput({
  value,
  onChange,
  error,
  defaultCountryIso = 'IN',
  inferCountryFromLocation = true,
  autoFocus = false,
  inputId = 'login',
  name = 'login',
  autoComplete = 'username',
  className,
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

  const handleToggle = () => {
    setModeOverride(isPhone ? 'email' : 'phone')
    onChange('')
  }

  return (
    <div className={className ? `space-y-1 ${className}` : 'space-y-1'}>
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
              className={`pl-9 ${error ? 'border-red-400' : ''}`}
              autoFocus={autoFocus}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </>
      )}
      <button
        type="button"
        className="text-xs text-violet-600 hover:underline flex items-center gap-1 mt-0.5"
        onClick={handleToggle}
      >
        {isPhone ? (
          <><Mail className="w-3 h-3" /> Use email instead</>
        ) : (
          <><Phone className="w-3 h-3" /> Use phone instead</>
        )}
      </button>
    </div>
  )
}
