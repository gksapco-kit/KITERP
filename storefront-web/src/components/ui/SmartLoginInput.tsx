/**
 * SmartLoginInput — auto-detects whether the user is entering an email or
 * a phone number and renders the appropriate input (PhoneInput or a plain
 * email input). Includes an explicit toggle link to switch modes.
 */
import { useState, useMemo } from 'react'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Input } from '@/components/ui/input'
import { Mail, Phone } from 'lucide-react'
import { inferLoginUiPhoneMode } from '@/lib/loginIdentifier'

export interface SmartLoginInputProps {
  value: string
  onChange: (v: string) => void
  error?: string
  defaultCountryIso?: string
  className?: string
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
    <div className={`space-y-1 ${className}`}>
      {isPhone ? (
        <PhoneInput
          id={inputId}
          name={name}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          error={error}
          defaultCountryIso={defaultCountryIso}
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
              className={`pl-9 h-11 ${error ? 'border-red-400' : ''}`}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </>
      )}
      <button
        type="button"
        className="text-xs text-amber-600 hover:underline flex items-center gap-1 mt-0.5"
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
