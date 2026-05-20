/**
 * PhoneInput — reusable phone number field with country-code picker.
 *
 * Features:
 * - Flag + dial-code dropdown (searchable, popular countries first)
 * - Digits-only enforcement with smart paste handling
 * - Per-country max-digit validation (10 for IN, flexible elsewhere)
 * - Exposes full E.164-style string via `onChange` e.g. "+919876543210"
 * - Accepts existing full-phone strings and splits them on mount
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search, CheckCircle2, X } from 'lucide-react'
import { COUNTRIES, POPULAR_COUNTRIES, type CountryEntry } from '@/data/countries'
import { cn } from '@/lib/utils'
import {
  getCachedInferredPhoneCountryIso,
  inferPhoneCountryIsoFromLocation,
} from '@/lib/inferPhoneCountryIso'

// ── Country order (popular first) ─────────────────────────────────────────

const popularSet = new Set(POPULAR_COUNTRIES)
const orderedCountries: CountryEntry[] = [
  ...POPULAR_COUNTRIES.map(iso => COUNTRIES.find(c => c.iso === iso)!).filter(Boolean),
  ...COUNTRIES.filter(c => !popularSet.has(c.iso)),
]

// Per-country digit limits (local number only, excluding dial code)
const COUNTRY_DIGIT_LIMITS: Record<string, number> = {
  IN: 10, US: 10, CA: 10, GB: 10, AU: 9,
  AE: 9, SG: 8, MY: 9, PK: 10, BD: 10, LK: 9,
  NP: 9, ZA: 9, NG: 10, KE: 9, GH: 9,
}

function getMaxDigits(country: CountryEntry): number {
  return COUNTRY_DIGIT_LIMITS[country.iso] ?? 15
}

/** Strip everything except digits from a pasted/typed string */
function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * Given a full phone string (e.g. "+919876543210"), return the matching
 * country and the local number (without dial code).
 */
function parseFullPhone(
  fullPhone: string,
  defaultCountry: CountryEntry,
): { country: CountryEntry; number: string } {
  if (!fullPhone) return { country: defaultCountry, number: '' }
  const stripped = fullPhone.startsWith('+') ? fullPhone : `+${fullPhone}`
  // Try longer dial codes first to avoid "+1" eating "+1268" etc.
  const sorted = [...orderedCountries].sort(
    (a, b) => b.dialCode.length - a.dialCode.length,
  )
  for (const c of sorted) {
    if (stripped.startsWith(c.dialCode)) {
      return { country: c, number: digitsOnly(stripped.slice(c.dialCode.length)) }
    }
  }
  return { country: defaultCountry, number: digitsOnly(stripped) }
}

// ── CountryDropdown ────────────────────────────────────────────────────────

function CountryDropdown({
  selected,
  onSelect,
  onClose,
}: {
  selected: CountryEntry
  onSelect: (c: CountryEntry) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const filtered = search
    ? orderedCountries.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search) ||
        c.iso.toLowerCase().includes(search.toLowerCase()),
      )
    : orderedCountries

  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl w-64 overflow-hidden">
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search country or code…"
          className="flex-1 text-sm outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="p-0.5">
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-56 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No results</p>
        ) : (
          filtered.map((c, i) => {
            const isSelected = c.iso === selected.iso
            const isLastPopular = !search && i === POPULAR_COUNTRIES.length - 1
            return (
              <div key={c.iso}>
                <button
                  type="button"
                  onClick={() => { onSelect(c); onClose() }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent transition-colors text-sm text-foreground',
                    isSelected && 'bg-accent',
                  )}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">{c.dialCode}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary/80 shrink-0" />}
                </button>
                {isLastPopular && <div className="border-t border-border my-0.5" />}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── PhoneInput ─────────────────────────────────────────────────────────────

export interface PhoneInputProps {
  /** Full phone string e.g. "+919876543210". Pass "" for empty. */
  value?: string
  /** Called with full phone e.g. "+919876543210", or "" when cleared. */
  onChange: (fullPhone: string) => void
  placeholder?: string
  error?: string
  className?: string
  /** ISO code for the default country. Defaults to "IN". */
  defaultCountryIso?: string
  /**
   * When true, sets the country from IP + browser locale (cached per tab) while the
   * field is still empty. Does not override pasted / typed +country numbers.
   */
  inferCountryFromLocation?: boolean
  disabled?: boolean
  id?: string
  label?: string
  /** e.g. "login" so password managers pair this with password */
  name?: string
  autoComplete?: string
  /** Taller row + larger text (e.g. registration). Default keeps compact density. */
  comfortable?: boolean
  /** With `comfortable`, match SmartLoginInput dense (~20% smaller) layout. */
  dense?: boolean
  /** Softer valid-state styling (no loud green border / in-field counter). */
  subtleFeedback?: boolean
}

export function PhoneInput({
  value = '',
  onChange,
  placeholder,
  error,
  className,
  defaultCountryIso = 'IN',
  inferCountryFromLocation = false,
  disabled = false,
  id,
  label,
  name = 'username',
  autoComplete = 'username',
  comfortable = false,
  dense = false,
  subtleFeedback = false,
}: PhoneInputProps) {
  const defaultCountry =
    COUNTRIES.find(c => c.iso === defaultCountryIso) ??
    COUNTRIES.find(c => c.iso === 'IN')!

  const [country, setCountry] = useState<CountryEntry>(() => {
    const parsed = parseFullPhone(value, defaultCountry)
    if (value) return parsed.country
    if (inferCountryFromLocation) {
      const cached = getCachedInferredPhoneCountryIso()
      if (cached) {
        const c = COUNTRIES.find(x => x.iso === cached)
        if (c) return c
      }
    }
    return parsed.country
  })
  const [localNumber, setLocalNumber] = useState(() => parseFullPhone(value, defaultCountry).number)
  const [dropOpen, setDropOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef(value)
  useEffect(() => { valueRef.current = value }, [value])

  // Sync incoming value changes (e.g. form reset, pasted E.164)
  useEffect(() => {
    if (value) {
      const p = parseFullPhone(value, defaultCountry)
      setCountry(p.country)
      setLocalNumber(p.number)
    } else {
      // Empty: keep inferred / user-selected country; only clear digits
      setLocalNumber('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // IP / locale — fill country while field is empty
  useEffect(() => {
    if (!inferCountryFromLocation || value) return
    let cancelled = false
    void inferPhoneCountryIsoFromLocation().then((iso) => {
      if (cancelled || valueRef.current) return
      if (!iso) return
      const c = COUNTRIES.find((x) => x.iso === iso)
      if (c) setCountry(c)
    })
    return () => {
      cancelled = true
    }
  }, [inferCountryFromLocation, value])

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropOpen])

  const emit = useCallback(
    (c: CountryEntry, num: string) => {
      onChange(num ? `${c.dialCode}${num}` : '')
    },
    [onChange],
  )

  const handleCountryChange = (c: CountryEntry) => {
    setCountry(c)
    // Re-clamp number to new country's limit
    const max = getMaxDigits(c)
    const clamped = localNumber.slice(0, max)
    setLocalNumber(clamped)
    emit(c, clamped)
  }

  /**
   * Resolve the correct local number from raw input.
   * When digits exceed the country limit, take the LAST N digits
   * (local number is always at the tail of a full phone string).
   */
  const resolve = useCallback(
    (raw: string, c: CountryEntry): string => {
      const digits = digitsOnly(raw)
      const max = getMaxDigits(c)
      if (digits.length <= max) return digits
      return digits.slice(-max)
    },
    [],
  )

  /** Fired on every keystroke — allows free typing, resolves on the fly */
  const handleInput = (raw: string) => {
    const digits = digitsOnly(raw)
    const max = getMaxDigits(country)
    // While user types we cap at max so they can't keep going past the limit
    const capped = digits.slice(0, max)
    setLocalNumber(capped)
    emit(country, capped)
  }

  /**
   * Paste handler — allows ANY length paste (26+ digits).
   * Displays the raw pasted digits briefly, then resolves and trims on blur.
   * Immediately emits the trimmed value to the parent (used for saving).
   */
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').trim()

    // Case 1: starts with + or 00 → full international number, auto-detect country
    if (pasted.startsWith('+') || pasted.startsWith('00')) {
      const normalized = pasted.startsWith('00') ? `+${pasted.slice(2)}` : pasted
      const p = parseFullPhone(normalized, country)
      setCountry(p.country)
      const num = resolve(p.number, p.country)
      setLocalNumber(num)
      emit(p.country, num)
      return
    }

    // Case 2: plain digits (with spaces, dashes, brackets, etc.)
    // Show the full pasted digits so user can see what they pasted,
    // but emit the trimmed value immediately for save consistency.
    const digits = digitsOnly(pasted)
    setLocalNumber(digits)           // show full in the field
    const trimmed = resolve(digits, country)
    emit(country, trimmed)           // save-ready trimmed value
  }

  /** On blur, auto-trim the visible field to match what's being saved */
  const handleBlur = () => {
    const trimmed = resolve(localNumber, country)
    if (trimmed !== localNumber) {
      setLocalNumber(trimmed)
      emit(country, trimmed)
    }
  }

  const maxDigits = getMaxDigits(country)
  const isOverLimit = localNumber.length > maxDigits
  const isFull = localNumber.length === maxDigits && maxDigits <= 12

  return (
    <div className={cn('w-full space-y-1', className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div ref={wrapRef} className="relative flex w-full items-stretch gap-0">
        {/* Country picker trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setDropOpen(v => !v)}
          className={cn(
            'flex items-center gap-1.5 rounded-l-md border border-r-0 bg-muted hover:bg-muted/80 text-foreground transition-colors shrink-0',
            comfortable
              ? (
                  dense
                    ? 'min-h-[calc(2.75rem*0.95*0.76)] gap-1.5 px-2.5 text-xs'
                    : 'min-h-[calc(2.75rem*0.95)] gap-2 px-3 text-[0.95rem]'
                )
              : 'px-2.5 py-2 text-sm',
            dropOpen ? 'border-primary ring-1 ring-ring z-10' : 'border-input',
            error && 'border-destructive',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <span className={cn('leading-none', comfortable ? (dense ? 'text-sm' : 'text-base') : 'text-base')}>{country.flag}</span>
          <span
            className={cn(
              'font-mono text-foreground',
              comfortable ? (dense ? 'text-xs' : 'text-sm') : 'text-xs',
            )}
          >
            {country.dialCode}
          </span>
          <ChevronDown
            className={cn(
              'text-muted-foreground transition-transform',
              comfortable ? (dense ? 'w-3.5 h-3.5' : 'w-4 h-4') : 'w-3 h-3',
              dropOpen && 'rotate-180',
            )}
          />
        </button>

        {/* Number input */}
        <div className="relative flex-1">
          <input
            id={id}
            name={name}
            autoComplete={autoComplete}
            type="tel"
            inputMode="numeric"
            disabled={disabled}
            value={localNumber}
            onChange={e => handleInput(e.target.value)}
            onPaste={handlePaste}
            onBlur={handleBlur}
            placeholder={placeholder ?? (country.iso === 'IN' ? '98765 43210' : 'Phone number')}
            className={cn(
              'w-full h-full rounded-r-md border outline-none transition-all bg-background text-foreground placeholder:text-muted-foreground',
              comfortable
                ? (
                    dense
                      ? 'min-h-[calc(2.75rem*0.95*0.76)] px-2.5 py-1 text-xs'
                      : 'min-h-[calc(2.75rem*0.95)] px-3 py-2 text-[0.95rem]'
                  )
                : 'px-3 py-2 text-sm',
              'focus:ring-2 focus:ring-ring focus:border-primary',
              error ? 'border-destructive bg-destructive/10' : 'border-input',
              isOverLimit && 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/15',
              isFull && !error && !subtleFeedback && 'border-green-600 bg-green-500/10 dark:border-green-500 dark:bg-green-500/15',
              isFull && !error && subtleFeedback && 'border-input',
              disabled && 'opacity-50 cursor-not-allowed bg-muted',
            )}
          />
          {/* Counter: shows overflow in amber, normal progress in gray */}
          {localNumber.length > 0 && maxDigits <= 12 && !subtleFeedback && (
            <span className={cn(
              'absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono tabular-nums pointer-events-none',
              isOverLimit
                ? 'text-amber-500'
                : localNumber.length >= maxDigits - 2
                  ? 'text-amber-500'
                  : 'text-muted-foreground/60',
            )}>
              {localNumber.length}/{maxDigits}
            </span>
          )}
        </div>

        {/* Country dropdown */}
        {dropOpen && (
          <CountryDropdown
            selected={country}
            onSelect={handleCountryChange}
            onClose={() => setDropOpen(false)}
          />
        )}
      </div>

      {/* Error / hint */}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : isOverLimit ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Will save last {maxDigits} digits: <span className="font-mono font-semibold">{localNumber.slice(-maxDigits)}</span>
        </p>
      ) : isFull ? (
        subtleFeedback ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary/80 shrink-0" aria-hidden />
            Valid {maxDigits}-digit number
          </p>
        ) : (
          <p className="text-[11px] text-green-700 dark:text-green-400">✓ {maxDigits}-digit number entered</p>
        )
      ) : null}
    </div>
  )
}
