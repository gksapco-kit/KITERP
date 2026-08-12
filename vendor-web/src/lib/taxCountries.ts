/**
 * Platform-level tax country configuration (display-layer).
 * Drives Tax & Compliance labels, identifiers, and standard rate slabs.
 */

export interface TaxIdentifierField {
  key: string
  label: string
  max_length: number
  regex?: string
  uppercase?: boolean
  required_when_registered?: boolean
  placeholder?: string
  help?: string
}

export interface TaxIdentifierSchema {
  registration: TaxIdentifierField[]
  entity: TaxIdentifierField[]
}

export interface TaxRateOption {
  rate: number
  label: string
  is_default?: boolean
}

export interface TaxCountryConfig {
  code: string
  name: string
  tax_label: string
  split_mode: 'intra_inter' | 'single'
  identifier_schema: TaxIdentifierSchema
  standard_rates: TaxRateOption[]
}

export const TAX_COUNTRIES: TaxCountryConfig[] = [
  {
    code: 'IN',
    name: 'India',
    tax_label: 'GST',
    split_mode: 'intra_inter',
    identifier_schema: {
      registration: [
        {
          key: 'gstin',
          label: 'GSTIN',
          max_length: 15,
          regex: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
          uppercase: true,
          required_when_registered: true,
          placeholder: '22AAAAA0000A1Z5',
          help: '15-character GST Identification Number',
        },
      ],
      entity: [
        {
          key: 'pan_number',
          label: 'PAN Number',
          max_length: 10,
          regex: '^[A-Z]{5}[0-9]{4}[A-Z]$',
          uppercase: true,
          required_when_registered: false,
          placeholder: 'AAAAA0000A',
          help: 'Permanent Account Number (linked to all GSTINs of this legal entity)',
        },
      ],
    },
    standard_rates: [
      { rate: 0, label: 'Nil / Exempt' },
      { rate: 0.25, label: 'Rough precious stones' },
      { rate: 3, label: 'Gold / silver / diamonds' },
      { rate: 5, label: 'Essentials' },
      { rate: 12, label: 'Processed goods' },
      { rate: 18, label: 'Standard rate (most services)', is_default: true },
      { rate: 28, label: 'Luxury / automobiles' },
    ],
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    tax_label: 'VAT',
    split_mode: 'single',
    identifier_schema: {
      registration: [
        {
          key: 'gstin',
          label: 'TRN (Tax Registration Number)',
          max_length: 15,
          regex: '^[0-9]{15}$',
          uppercase: false,
          required_when_registered: true,
          placeholder: '100000000000003',
          help: '15-digit Tax Registration Number issued by the Federal Tax Authority',
        },
      ],
      entity: [],
    },
    standard_rates: [
      { rate: 0, label: 'Zero-rated' },
      { rate: 5, label: 'Standard rate', is_default: true },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    tax_label: 'VAT',
    split_mode: 'single',
    identifier_schema: {
      registration: [
        {
          key: 'gstin',
          label: 'VAT Number',
          max_length: 14,
          regex: '^(GB)?([0-9]{9}([0-9]{3})?|[A-Z]{2}[0-9]{3})$',
          uppercase: true,
          required_when_registered: true,
          placeholder: 'GB123456789',
          help: '9 or 12-digit VAT number issued by HMRC',
        },
      ],
      entity: [],
    },
    standard_rates: [
      { rate: 0, label: 'Zero-rated' },
      { rate: 5, label: 'Reduced rate' },
      { rate: 20, label: 'Standard rate', is_default: true },
    ],
  },
  {
    code: 'US',
    name: 'United States',
    tax_label: 'Sales Tax',
    split_mode: 'single',
    identifier_schema: {
      registration: [
        {
          key: 'gstin',
          label: 'EIN (Employer Identification Number)',
          max_length: 10,
          regex: '^[0-9]{2}-[0-9]{7}$',
          uppercase: false,
          required_when_registered: false,
          placeholder: '12-3456789',
          help: 'Federal EIN — optional for sales tax purposes',
        },
      ],
      entity: [],
    },
    standard_rates: [
      { rate: 0, label: 'Exempt' },
      { rate: 6, label: 'Typical state average' },
      { rate: 7, label: 'Common combined' },
      { rate: 8, label: 'Higher combined' },
      { rate: 8.875, label: 'NY example combined', is_default: true },
      { rate: 10, label: 'High local combined' },
    ],
  },
  {
    code: 'SG',
    name: 'Singapore',
    tax_label: 'GST',
    split_mode: 'single',
    identifier_schema: {
      registration: [
        {
          key: 'gstin',
          label: 'GST Registration No.',
          max_length: 10,
          regex: '^[0-9]{9}[A-Z]$|^T[0-9]{2}[A-Z]{2}[0-9]{4}[A-Z]$|^M[0-9]{8}[A-Z]$',
          uppercase: true,
          required_when_registered: true,
          placeholder: 'M90373465X',
          help: 'IRAS GST registration number',
        },
      ],
      entity: [],
    },
    standard_rates: [
      { rate: 0, label: 'Zero-rated exports' },
      { rate: 9, label: 'Standard rate', is_default: true },
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    tax_label: 'GST',
    split_mode: 'single',
    identifier_schema: {
      registration: [
        {
          key: 'gstin',
          label: 'ABN (Australian Business Number)',
          max_length: 14,
          regex: '^[0-9]{2}\\s?[0-9]{3}\\s?[0-9]{3}\\s?[0-9]{3}$',
          uppercase: false,
          required_when_registered: true,
          placeholder: '51 824 753 556',
          help: '11-digit Australian Business Number',
        },
      ],
      entity: [],
    },
    standard_rates: [
      { rate: 0, label: 'GST-free' },
      { rate: 10, label: 'Standard rate', is_default: true },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    tax_label: 'GST/HST',
    split_mode: 'single',
    identifier_schema: {
      registration: [
        {
          key: 'gstin',
          label: 'Business Number (BN)',
          max_length: 15,
          regex: '^[0-9]{9}(RT[0-9]{4})?$',
          uppercase: true,
          required_when_registered: true,
          placeholder: '123456789RT0001',
          help: 'CRA Business Number — 9-digit BN or BN with RT account suffix',
        },
      ],
      entity: [],
    },
    standard_rates: [
      { rate: 0, label: 'Zero-rated' },
      { rate: 5, label: 'GST' },
      { rate: 12, label: 'HST (BC example)' },
      { rate: 13, label: 'HST (Ontario)', is_default: true },
      { rate: 14, label: 'HST (PEI)' },
      { rate: 15, label: 'HST (NS / NL / NB)' },
    ],
  },
]

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  india: 'IN',
  'united arab emirates': 'AE',
  uae: 'AE',
  'united kingdom': 'GB',
  uk: 'GB',
  'united states': 'US',
  usa: 'US',
  singapore: 'SG',
  australia: 'AU',
  canada: 'CA',
}

export function getTaxCountry(code: string | null | undefined): TaxCountryConfig {
  return TAX_COUNTRIES.find((c) => c.code === code) ?? TAX_COUNTRIES[0]
}

export function registrationLabel(country: TaxCountryConfig): string {
  return `${country.tax_label} Registered`
}

export function defaultRateForCountry(country: TaxCountryConfig): number {
  return country.standard_rates.find((r) => r.is_default)?.rate ?? country.standard_rates[0]?.rate ?? 0
}

/** Round to 2 decimal places for stable rate identity. */
export function normalizeTaxRate(rate: number): number {
  return Math.round(rate * 100) / 100
}

export function ratesApproximatelyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001
}

export type CustomTaxRate = {
  rate: number
  label: string
}

/** Parse `settings.custom_tax_rates` (numbers, strings, or `{ rate, label }` objects). */
export function parseCustomTaxRates(raw: unknown): CustomTaxRate[] {
  if (!Array.isArray(raw)) return []
  const out: CustomTaxRate[] = []
  for (const item of raw) {
    let n = NaN
    let label = ''
    if (typeof item === 'number') n = item
    else if (typeof item === 'string') n = Number(item)
    else if (item && typeof item === 'object') {
      const obj = item as { rate?: unknown; label?: unknown; description?: unknown }
      n = Number(obj.rate)
      const rawLabel = obj.label ?? obj.description
      label = typeof rawLabel === 'string' ? rawLabel.trim() : ''
    }
    if (!Number.isFinite(n) || n < 0 || n > 100) continue
    const normalized = normalizeTaxRate(n)
    const existing = out.find((x) => ratesApproximatelyEqual(x.rate, normalized))
    if (existing) {
      if (!existing.label && label) existing.label = label
      continue
    }
    out.push({ rate: normalized, label })
  }
  return out.sort((a, b) => a.rate - b.rate)
}

/** Rate percentages only (for comparisons / known-rate checks). */
export function customTaxRateValues(rates: CustomTaxRate[]): number[] {
  return rates.map((r) => r.rate)
}

export function isStandardTaxRate(country: TaxCountryConfig, rate: number): boolean {
  return country.standard_rates.some((r) => ratesApproximatelyEqual(r.rate, rate))
}

export function mergeCustomTaxRate(
  custom: CustomTaxRate[],
  rate: number,
  label = '',
): CustomTaxRate[] {
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return custom
  const normalized = normalizeTaxRate(rate)
  const trimmed = label.trim()
  const existing = custom.find((x) => ratesApproximatelyEqual(x.rate, normalized))
  if (existing) {
    if (trimmed && !existing.label) {
      return custom.map((x) =>
        ratesApproximatelyEqual(x.rate, normalized) ? { ...x, label: trimmed } : x,
      )
    }
    return custom
  }
  return [...custom, { rate: normalized, label: trimmed }].sort((a, b) => a.rate - b.rate)
}

/** Build select options: country presets + vendor/store additional rates. */
export function buildTaxRateSelectOptions(
  country: TaxCountryConfig,
  customRates: CustomTaxRate[],
  customOptionValue = '__custom__',
): { value: string; label: string }[] {
  const presets = country.standard_rates.map((r) => ({
    value: String(r.rate),
    label: `${r.rate}% — ${r.label}`,
  }))
  const extras = customRates
    .filter((entry) => !isStandardTaxRate(country, entry.rate))
    .map((entry) => ({
      value: String(entry.rate),
      label: entry.label
        ? `${entry.rate}% — ${entry.label}`
        : `${entry.rate}% — Additional`,
    }))
  return [...presets, ...extras, { value: customOptionValue, label: 'Custom rate…' }]
}

/** Resolve vendor tax country from settings, else infer from vendor.country. */
export function resolveVendorTaxCountryCode(
  settings: Record<string, unknown> | null | undefined,
  countryName?: string | null,
): string {
  const fromSettings = settings?.tax_country_code
  if (typeof fromSettings === 'string' && fromSettings.trim()) {
    return fromSettings.trim().toUpperCase()
  }
  if (countryName) {
    const mapped = COUNTRY_NAME_TO_CODE[countryName.trim().toLowerCase()]
    if (mapped) return mapped
  }
  return 'IN'
}
