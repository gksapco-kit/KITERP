/**
 * PhoneInput — flag + country-code picker with smart number handling.
 * Self-contained: no external phone library required.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search, CheckCircle2, X } from 'lucide-react'
import { COUNTRIES, POPULAR_COUNTRIES, type CountryEntry } from '@/data/countries'
import { cn, focusRingClassName } from '@/lib/utils'

// ── Order: popular first ───────────────────────────────────────────────────
const popularSet = new Set(POPULAR_COUNTRIES)
const orderedCountries: CountryEntry[] = [
  ...POPULAR_COUNTRIES.map(iso => COUNTRIES.find(c => c.iso === iso)!).filter(Boolean),
  ...COUNTRIES.filter(c => !popularSet.has(c.iso)),
]

// Per-country max digit counts (local number, excluding dial code)
const COUNTRY_DIGIT_LIMITS: Record<string, number> = {
  IN: 10, US: 10, CA: 10, GB: 10, AU: 9,
  AE: 9, SG: 8, MY: 9, PK: 10, BD: 10, LK: 9,
  NP: 9, ZA: 9, NG: 10, KE: 9, GH: 9,
  JP: 10, CN: 11, DE: 11, FR: 9, SA: 9,
  QA: 8, KW: 8, OM: 8, BH: 8, ID: 11,
}

function getMaxDigits(country: CountryEntry): number {
  return COUNTRY_DIGIT_LIMITS[country.iso] ?? 15
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '')
}

function matchCountryFromE164(
  e164: string,
): { country: CountryEntry; number: string } | null {
  const sorted = [...orderedCountries].sort((a, b) => b.dialCode.length - a.dialCode.length)
  for (const c of sorted) {
    if (e164.startsWith(c.dialCode)) {
      return { country: c, number: digitsOnly(e164.slice(c.dialCode.length)) }
    }
  }
  return null
}

function parseFullPhone(
  fullPhone: string,
  defaultCountry: CountryEntry,
): { country: CountryEntry; number: string } {
  if (!fullPhone) return { country: defaultCountry, number: '' }

  const trimmed = fullPhone.trim()

  if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
    const e164 = trimmed.startsWith('00') ? `+${trimmed.slice(2)}` : trimmed
    const matched = matchCountryFromE164(e164)
    if (matched) return matched
    return { country: defaultCountry, number: digitsOnly(e164.slice(1)) }
  }

  const digits = digitsOnly(trimmed)
  if (!digits) return { country: defaultCountry, number: '' }

  if (digits.length <= getMaxDigits(defaultCountry)) {
    return { country: defaultCountry, number: digits }
  }

  const matched = matchCountryFromE164(`+${digits}`)
  if (matched) return matched

  return {
    country: defaultCountry,
    number: digits.slice(-getMaxDigits(defaultCountry)),
  }
}

// ── Country dropdown ───────────────────────────────────────────────────────

function CountryDropdown({
  selected, onSelect, onClose,
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
        c.iso.toLowerCase().includes(search.toLowerCase()))
    : orderedCountries

  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl w-72 overflow-hidden max-h-[90vh] overflow-y-auto">
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50">
        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search country or code…"
          className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')}>
            <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-60 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-5">No results</p>
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
                    'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-blue-50 transition-colors text-sm',
                    isSelected && 'bg-blue-50',
                  )}
                >
                  <span className="w-7 shrink-0 text-center text-[11px] font-semibold leading-none text-gray-700">
                    {c.iso}
                  </span>
                  <span className="flex-1 truncate text-gray-800">{c.name}</span>
                  <span className="shrink-0 text-xs text-gray-400">{c.dialCode}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                </button>
                {isLastPopular && <div className="border-t border-gray-100 my-0.5" />}
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
  /** Full E.164 string e.g. "+919876543210". Pass "" for empty. */
  value: string
  /** Called with full E.164 string or "" when cleared. */
  onChange: (fullPhone: string) => void
  placeholder?: string
  error?: string
  className?: string
  /** When false, error still styles the field but no message is rendered (parent may show it). */
  showErrorMessage?: boolean
  /** Hide “valid / over limit” helper lines under the field (useful on compact forms). */
  showStatusHints?: boolean
  /** Defaults to IN. */
  defaultCountryIso?: string
  /** `sm` = h-9 (compact forms); default `md` = h-11. */
  size?: 'sm' | 'md'
  disabled?: boolean
  id?: string
  name?: string
  autoComplete?: string
}

export function PhoneInput({
  value = '',
  onChange,
  placeholder,
  error,
  className,
  showErrorMessage = true,
  showStatusHints = true,
  defaultCountryIso = 'IN',
  size = 'md',
  disabled = false,
  id,
  name = 'username',
  autoComplete = 'username',
}: PhoneInputProps) {
  const fieldH = size === 'sm' ? 'h-9' : 'h-11'
  const isSm = size === 'sm'
  const defaultCountry =
    COUNTRIES.find(c => c.iso === defaultCountryIso) ??
    COUNTRIES.find(c => c.iso === 'IN')!

  const parsed = parseFullPhone(value, defaultCountry)
  const [country, setCountry] = useState<CountryEntry>(parsed.country)
  const [localNumber, setLocalNumber] = useState(parsed.number)
  const [dropOpen, setDropOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Sync when parent resets the value
  useEffect(() => {
    const p = parseFullPhone(value, defaultCountry)
    setCountry(p.country)
    setLocalNumber(p.number)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropOpen])

  const emit = useCallback(
    (c: CountryEntry, num: string) => onChange(num ? `${c.dialCode}${num}` : ''),
    [onChange],
  )

  const resolve = useCallback((raw: string, c: CountryEntry): string => {
    const digits = digitsOnly(raw)
    const max = getMaxDigits(c)
    return digits.length <= max ? digits : digits.slice(-max)
  }, [])

  const handleCountryChange = (c: CountryEntry) => {
    setCountry(c)
    const clamped = localNumber.slice(0, getMaxDigits(c))
    setLocalNumber(clamped)
    emit(c, clamped)
  }

  const handleInput = (raw: string) => {
    const capped = digitsOnly(raw).slice(0, getMaxDigits(country))
    setLocalNumber(capped)
    emit(country, capped)
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData
      .getData('text')
      .trim()
      .replace(/^tel:/i, '')
      .replace(/^phone=/i, '')
    const p = parseFullPhone(pasted, country)
    const num = resolve(p.number, p.country)
    setCountry(p.country)
    setLocalNumber(num)
    emit(p.country, num)
  }

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
    <div className={cn(showStatusHints || showErrorMessage ? 'space-y-1' : undefined, className)}>
      <div
        ref={wrapRef}
        className={cn(
          'phone-input-shell relative flex items-stretch overflow-hidden rounded-xl border bg-white transition-[border-color,box-shadow]',
          fieldH,
          dropOpen
            ? 'border-[var(--kiterp-primary,#64c3a0)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--kiterp-primary,#64c3a0)_18%,transparent)]'
            : error
              ? 'border-red-400'
              : isOverLimit
                ? 'border-amber-400'
                : isFull
                  ? 'border-[var(--kiterp-primary-deeper,#3d9a7a)]'
                  : 'border-gray-200 hover:border-gray-300',
          disabled && 'opacity-50',
        )}
      >
        {/* Country trigger — ISO + dial (flags render as letters on Windows). */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setDropOpen(v => !v)}
          aria-label={`Country code ${country.dialCode}`}
          title={`${country.name} (${country.iso})`}
          className={cn(
            'phone-input-country inline-flex shrink-0 items-center justify-center self-stretch border-0 border-r border-gray-100 py-0 leading-none transition-colors',
            'bg-[color-mix(in_srgb,var(--kiterp-mint-bg,#eef9f4)_75%,#f8fafc)] hover:bg-[color-mix(in_srgb,var(--kiterp-mint-soft,#d4f0e8)_50%,#f3f4f6)]',
            'box-border',
            isSm ? 'gap-0.5 px-2' : 'gap-1 px-2.5',
            focusRingClassName,
            disabled && 'cursor-not-allowed',
          )}
        >
          <span className={cn('whitespace-nowrap text-xs leading-none text-gray-700', isSm && 'text-[11px]')}>
            <span className="font-semibold tracking-wide">{country.iso}</span>
            {' '}
            <span className="font-medium text-[var(--kiterp-primary-deeper,#3d9a7a)]">{country.dialCode}</span>
          </span>
          <ChevronDown
            className={cn(
              'shrink-0 text-gray-400 transition-transform',
              isSm ? 'h-3 w-3' : 'h-3.5 w-3.5',
              dropOpen && 'rotate-180',
            )}
            aria-hidden
          />
        </button>

        {/* Number input */}
        <div className="relative flex min-w-0 flex-1">
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
              'phone-input-number h-full w-full self-stretch border-0 bg-transparent text-sm outline-none box-border',
              isSm ? 'px-2.5 pr-10' : 'px-3 pr-11',
              'focus:ring-0 focus:ring-offset-0',
              disabled && 'cursor-not-allowed',
            )}
          />
          {/* Digit counter */}
          {localNumber.length > 0 && maxDigits <= 12 && (
            <span className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 font-mono pointer-events-none select-none',
              isSm ? 'text-[10px]' : 'text-xs right-2.5',
              isOverLimit || localNumber.length >= maxDigits - 1
                ? 'text-amber-500'
                : isFull
                  ? 'text-[var(--kiterp-primary-deeper,#3d9a7a)]'
                  : 'text-gray-300',
            )}>
              {localNumber.length}/{maxDigits}
            </span>
          )}
        </div>

        {/* Dropdown */}
        {dropOpen && (
          <CountryDropdown
            selected={country}
            onSelect={handleCountryChange}
            onClose={() => setDropOpen(false)}
          />
        )}
      </div>

      {/* Error / hint */}
      {showErrorMessage && error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : showStatusHints && isOverLimit ? (
        <p className="text-xs text-amber-600">
          Will save last {maxDigits} digits:{' '}
          <span className="font-mono font-semibold">{localNumber.slice(-maxDigits)}</span>
        </p>
      ) : showStatusHints && isFull ? (
        <p className="text-xs text-green-600">✓ Valid {maxDigits}-digit number</p>
      ) : null}
    </div>
  )
}
