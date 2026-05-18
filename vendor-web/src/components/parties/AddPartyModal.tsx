/**
 * AddPartyModal -- Unified Master Data creation modal.
 *
 * Features:
 * - Party Type selector: Customer | Vendor | Employee | Partner | Contractor
 * - Groups / Segments: multi-select tag chip input (pre-defined + user-created,
 *   persisted to localStorage so groups accumulate across sessions)
 * - Smart Lookup: auto-detects GSTIN / PAN / CIN / Phone / Email patterns
 *   AND searches existing master data (customers + suppliers) with debounced
 *   autocomplete — shows matching records with which field was matched,
 *   warns on duplicate, pre-fills form on click
 * - Merged Name field: single unified input with guide placeholder
 * - Searchable country-code picker for phone (primary + alternate)
 * - Searchable country picker for address
 * - Profile picture upload
 * - Portal access / password for all party types
 * - Additional fields: website, alternate phone, credit limit, payment terms
 * - 409 duplicate error banner
 */
import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { vendorApi } from '@/api/vendor'
import { useCreateCustomer, useCreateSupplier, useUpdateCustomer, useUpdateSupplier } from '@/hooks/useVendor'
import type { PartyType, Customer, Supplier } from '@/types'
import {
  X, Loader2, ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
  Search, Building2, Phone, Mail, MapPin, IndianRupee, Lock, User,
  Camera, Eye, EyeOff, Globe, PhoneCall, CreditCard, Clock, AlertTriangle,
  Users, ChevronRight, Tag, Plus, Ban, PauseCircle, Landmark,
} from 'lucide-react'
import { COUNTRIES, POPULAR_COUNTRIES, type CountryEntry } from '@/data/countries'
import { PhoneInput } from '@/components/ui/PhoneInput'

// ── Regex constants ───────────────────────────────────────────────────────────

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_RE   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
const CIN_RE   = /^[UL][0-9]{5}[A-Z]{2}[0-9]{4}(PLC|PVT|LLP|OPC|NPL|OTH)[0-9]{6}$/

const GST_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
  '97': 'Other Territory',
}

const PAYMENT_TERMS_DEFAULT = [
  'Immediate', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90',
  'COD', '50% Advance', '100% Advance',
]

const LS_CUSTOM_TERMS_KEY = 'ap_custom_payment_terms'
const loadCustomTerms = (): string[] => {
  try { return JSON.parse(localStorage.getItem(LS_CUSTOM_TERMS_KEY) ?? '[]') } catch { return [] }
}
const persistCustomTerms = (terms: string[]) =>
  localStorage.setItem(LS_CUSTOM_TERMS_KEY, JSON.stringify(terms))

// ── Country-specific tax / registration ID field definitions ─────────────────

interface TaxFieldDef {
  key: 'gstin' | 'pan' | 'cin' | 'taxId'
  label: string
  placeholder: string
  maxLength?: number
  mono?: boolean
}

const COUNTRY_TAX_FIELDS: Record<string, TaxFieldDef[]> = {
  IN: [
    { key: 'gstin', label: 'GSTIN',         placeholder: '22AAAAA0000A1Z5', maxLength: 15, mono: true },
    { key: 'pan',   label: 'PAN',            placeholder: 'ABCDE1234F',      maxLength: 10, mono: true },
    { key: 'cin',   label: 'CIN / LLPIN',    placeholder: 'U12345AB…',        mono: true },
  ],
  US: [
    { key: 'taxId', label: 'EIN',            placeholder: '12-3456789',       maxLength: 10 },
    { key: 'pan',   label: 'ITIN',           placeholder: '9XX-70-XXXX',      maxLength: 11 },
  ],
  GB: [
    { key: 'cin',   label: 'Company No.',    placeholder: '12345678',         maxLength: 8  },
    { key: 'taxId', label: 'VAT Number',     placeholder: 'GB 123 4567 89'                  },
  ],
  AU: [
    { key: 'taxId', label: 'ABN',            placeholder: '51 824 753 556',   maxLength: 14 },
    { key: 'cin',   label: 'ACN',            placeholder: '123 456 789',      maxLength: 11 },
  ],
  CA: [
    { key: 'taxId', label: 'Business No.',   placeholder: '123456789',        maxLength: 9  },
    { key: 'cin',   label: 'GST/HST No.',    placeholder: '123456789RT0001'                 },
  ],
  SG: [
    { key: 'taxId', label: 'UEN',            placeholder: '201234567K',       maxLength: 10, mono: true },
  ],
  AE: [
    { key: 'taxId', label: 'TRN',            placeholder: '100000000000000',  maxLength: 15, mono: true },
  ],
  NZ: [
    { key: 'taxId', label: 'NZBN',           placeholder: '9429000000000',    maxLength: 13 },
    { key: 'cin',   label: 'IRD No.',        placeholder: '123-456-789'                     },
  ],
  ZA: [
    { key: 'taxId', label: 'Tax No.',        placeholder: '1234567890',       maxLength: 10 },
    { key: 'cin',   label: 'Reg. No.',       placeholder: 'YYYY/XXXXXX/YY'                  },
  ],
  MY: [
    { key: 'taxId', label: 'SST No.',        placeholder: 'W00-0000-00000000', maxLength: 17, mono: true },
    { key: 'cin',   label: 'Reg. No. (SSM)', placeholder: '202201000001'                     },
  ],
}

/** Fall-through for countries not in the table above */
const DEFAULT_TAX_FIELDS: TaxFieldDef[] = [
  { key: 'taxId', label: 'Tax ID / VAT No.', placeholder: 'Tax or VAT number'              },
  { key: 'cin',   label: 'Reg. Number',       placeholder: 'Company registration number'    },
]

// ── Party Status ──────────────────────────────────────────────────────────────

type PartyStatusType = 'active' | 'on_hold' | 'blocked' | 'inactive'

const PARTY_STATUS_OPTS: { value: PartyStatusType; label: string; activeClass: string; icon: React.ReactNode }[] = [
  { value: 'active',   label: 'Active',   activeClass: 'bg-green-600 border-green-600 text-white',   icon: <CheckCircle2 className="w-3 h-3" /> },
  { value: 'on_hold',  label: 'On Hold',  activeClass: 'bg-amber-500 border-amber-500 text-white',   icon: <PauseCircle className="w-3 h-3" />  },
  { value: 'blocked',  label: 'Blocked',  activeClass: 'bg-red-600 border-red-600 text-white',       icon: <Ban className="w-3 h-3" />          },
  { value: 'inactive', label: 'Inactive', activeClass: 'bg-gray-400 border-gray-400 text-white',     icon: <X className="w-3 h-3" />            },
]

function addDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const PARTY_TYPES: { value: PartyType; label: string }[] = [
  { value: 'customer',   label: 'Customer'   },
  { value: 'supplier',   label: 'Vendor'     },
  { value: 'employee',   label: 'Employee'   },
  { value: 'partner',    label: 'Partner'    },
  { value: 'contractor', label: 'Contractor' },
]

// ── Address types ─────────────────────────────────────────────────────────────

type AddrType = 'address' | 'billing' | 'shipping' | 'home' | 'work' | 'gst' | 'branch' | 'warehouse' | 'other'

const ADDR_TYPE_OPTS: { value: AddrType; label: string }[] = [
  { value: 'address',   label: 'Address'          },   // generic default
  { value: 'billing',   label: 'Billing'          },
  { value: 'shipping',  label: 'Shipping'         },
  { value: 'home',      label: 'Home'             },
  { value: 'work',      label: 'Work / Office'    },
  { value: 'gst',       label: 'GST / Reg. Office'},
  { value: 'branch',    label: 'Branch'           },
  { value: 'warehouse', label: 'Warehouse'        },
  { value: 'other',     label: 'Other…'           },   // reveals a name input
]

interface AddressEntry {
  id: string
  type: AddrType
  customName?: string   // filled when type === 'other'
  street: string
  city: string
  state: string
  pincode: string
  country: CountryEntry
}

// ── Custom extra fields ───────────────────────────────────────────────────────

type CustomFieldType = 'text' | 'number' | 'phone' | 'email' | 'date' | 'url' | 'location' | 'relation'

const CUSTOM_FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text',     label: 'Text'        },
  { value: 'number',   label: 'Number'      },
  { value: 'phone',    label: 'Phone'       },
  { value: 'email',    label: 'Email'       },
  { value: 'date',     label: 'Date'        },
  { value: 'url',      label: 'Link / URL'  },
  { value: 'location', label: 'Location'    },
  { value: 'relation', label: 'Party Link'  },
]

interface CustomFieldEntry {
  id: string
  label: string
  type: CustomFieldType
  value: string
}

// ── API error parsing ─────────────────────────────────────────────────────────

/** Maps backend field names → local errors-state keys */
const API_FIELD_MAP: Record<string, string> = {
  full_name:        'name',
  name:             'name',
  email:            'email',
  phone:            'phone',
  gstin:            'gstin',
  pan_number:       'pan',
  pan:              'pan',
  opening_balance:  'openingBalance',
  contact_name:     'contactPerson',
  password:         'password',
  notes:            'notes',
}

/** Fields that live inside the "More Details" collapsible section */
const MORE_DETAILS_FIELDS = new Set(['gstin', 'pan', 'website', 'openingBalance', 'contactPerson', 'notes'])

type PydanticItem = { loc?: unknown[]; msg?: string; type?: string }

function humaniseMsg(msg = '', type = ''): string {
  const MAP: Record<string, string> = {
    missing:                        'This field is required',
    string_too_short:               'Value is too short',
    string_too_long:                'Value is too long',
    'value_error.missing':          'This field is required',
    'value_error.email':            'Enter a valid email address',
    'type_error.none.not_allowed':  'This field is required',
    'value_error.any_str.min_length': 'Too short — enter at least 2 characters',
  }
  if (MAP[type]) return MAP[type]
  return msg
    .replace(/^value is not a valid /, 'Invalid ')
    .replace(/^\w/, c => c.toUpperCase())
}

function parseDbMsg(detail: string): string {
  if (/unique.*constraint|duplicate.*key|already exists/i.test(detail))
    return 'A record with this information already exists — check for duplicates.'
  if (/not.null.*violat|null value.*not.null/i.test(detail)) {
    const col = detail.match(/column "?(\w+)"?/i)?.[1]
    return col
      ? `The "${col.replace(/_/g, ' ')}" field is required and cannot be empty.`
      : 'A required field is missing.'
  }
  if (/undefined.*column|column.*does not exist/i.test(detail)) {
    const col = detail.match(/column "?(\w+)"?/i)?.[1]
    return col
      ? `Server issue — field "${col}" is not recognised. Please contact support.`
      : 'Server configuration error. Please contact support.'
  }
  if (/foreign.*key.*violat/i.test(detail))
    return 'This record references data that no longer exists.'
  // Strip noisy SQLAlchemy/asyncpg wrapping and truncate
  const clean = detail.replace(/\(sqlalchemy[^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  return clean.length > 180 ? clean.slice(0, 180) + '…' : clean
}

interface ParsedError {
  fieldErrors: Record<string, string>
  generalError: string | null
  isDuplicate: boolean
}

function parseApiError(err: unknown): ParsedError {
  const ae = err as { response?: { status?: number; data?: { detail?: unknown } } }
  const status = ae?.response?.status
  const detail = ae?.response?.data?.detail

  // 422 — Pydantic / FastAPI validation array
  if (status === 422 && Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {}
    const unmapped: string[] = []
    for (const e of detail as PydanticItem[]) {
      const loc = Array.isArray(e.loc) ? e.loc : []
      const raw = String(loc[loc.length - 1] ?? '')
      const key = API_FIELD_MAP[raw]
      const msg = humaniseMsg(e.msg, e.type)
      if (key) {
        fieldErrors[key] = msg
      } else if (raw) {
        unmapped.push(`${raw.replace(/_/g, ' ')}: ${msg}`)
      }
    }
    return {
      fieldErrors,
      generalError: unmapped.length
        ? `Additional errors: ${unmapped.join(' · ')}`
        : null,
      isDuplicate: false,
    }
  }

  // 409 — Duplicate / conflict
  if (status === 409) {
    return {
      fieldErrors: {},
      generalError: typeof detail === 'string' ? detail : 'A record with this information already exists.',
      isDuplicate: true,
    }
  }

  // DB / server error string
  const msg = typeof detail === 'string'
    ? parseDbMsg(detail)
    : 'Save failed — please check all fields and try again.'
  return { fieldErrors: {}, generalError: msg, isDuplicate: false }
}

// ── Avatar localStorage persistence ──────────────────────────────────────────
function avatarKey(id: string) { return `md_avatar_${id}` }
function loadAvatar(id: string): string | null {
  try { return localStorage.getItem(avatarKey(id)) } catch { return null }
}
function saveAvatar(id: string, dataUrl: string) {
  try {
    // Resize to 128×128 to keep storage small
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 128; canvas.height = 128
      canvas.getContext('2d')!.drawImage(img, 0, 0, 128, 128)
      const small = canvas.toDataURL('image/jpeg', 0.8)
      localStorage.setItem(avatarKey(id), small)
    }
    img.src = dataUrl
  } catch { /* ignore */ }
}

// ── Custom Party Types ────────────────────────────────────────────────────────

const LS_CUSTOM_PARTY_TYPES_KEY = 'md_custom_party_types'

function loadCustomPartyTypes(): string[] {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_PARTY_TYPES_KEY)
    if (raw) {
      const parsed: string[] = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* ignore */ }
  return []
}

function persistCustomPartyTypes(types: string[]) {
  try { localStorage.setItem(LS_CUSTOM_PARTY_TYPES_KEY, JSON.stringify(types)) } catch { /* ignore */ }
}

// ── Groups / Segments ─────────────────────────────────────────────────────────

const SYSTEM_GROUPS = [
  'VIP', 'Regular', 'New', 'Premium', 'Preferred',
  'Wholesale', 'Retail', 'Export', 'Domestic', 'Import',
  'Credit Account', 'Cash Account', 'On-Hold', 'Blacklisted',
]

const LS_GROUPS_KEY     = 'md_party_groups'
const LS_SEL_GROUPS_KEY = 'md_party_sel_groups'

/** Colors cycle based on group string length for deterministic hues */
const GROUP_PALETTE = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-primary/12 text-primary border-primary/30',
  'bg-green-100 text-green-700 border-green-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-yellow-100 text-yellow-700 border-yellow-200',
  'bg-red-100 text-red-700 border-red-200',
  'bg-primary/15 text-primary border-primary/30',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
]
function groupColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % GROUP_PALETTE.length
  return GROUP_PALETTE[h]
}

function loadSavedGroups(): string[] {
  try {
    const raw = localStorage.getItem(LS_GROUPS_KEY)
    const saved: string[] = raw ? JSON.parse(raw) : []
    const merged = [...SYSTEM_GROUPS]
    saved.forEach(g => { if (!merged.includes(g)) merged.push(g) })
    return merged
  } catch {
    return [...SYSTEM_GROUPS]
  }
}

/** Load the last-selected groups from localStorage; default to ['Regular'] on first use */
function loadSelectedGroups(): string[] {
  try {
    const raw = localStorage.getItem(LS_SEL_GROUPS_KEY)
    if (raw) {
      const parsed: string[] = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return ['Regular']   // sensible default on first open
}

function saveSelectedGroups(selected: string[]) {
  try {
    localStorage.setItem(LS_SEL_GROUPS_KEY, JSON.stringify(selected))
  } catch { /* ignore */ }
}

function saveUserGroup(name: string) {
  try {
    const raw = localStorage.getItem(LS_GROUPS_KEY)
    const saved: string[] = raw ? JSON.parse(raw) : []
    if (!saved.includes(name) && !SYSTEM_GROUPS.includes(name)) {
      localStorage.setItem(LS_GROUPS_KEY, JSON.stringify([...saved, name]))
    }
  } catch { /* ignore */ }
}

// ── GroupTagInput component ────────────────────────────────────────────────────

interface GroupTagInputProps {
  selected: string[]
  onChange: (groups: string[]) => void
}

function GroupTagInput({ selected, onChange }: GroupTagInputProps) {
  const [allGroups, setAllGroups] = useState<string[]>(loadSavedGroups)
  const [inputVal, setInputVal] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (g: string) => {
    onChange(selected.includes(g) ? selected.filter(x => x !== g) : [...selected, g])
  }

  const addNew = (raw: string) => {
    const name = raw.trim()
    if (!name || name.length < 1) return
    const normalised = name.charAt(0).toUpperCase() + name.slice(1)
    if (!allGroups.includes(normalised)) {
      setAllGroups(prev => [...prev, normalised])
      saveUserGroup(normalised)
    }
    if (!selected.includes(normalised)) onChange([...selected, normalised])
    setInputVal('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addNew(inputVal)
    } else if (e.key === 'Backspace' && !inputVal && selected.length > 0) {
      onChange(selected.slice(0, -1))
    }
  }

  const filtered = inputVal.trim()
    ? allGroups.filter(g => g.toLowerCase().includes(inputVal.toLowerCase()) && !selected.includes(g))
    : allGroups.filter(g => !selected.includes(g))

  return (
    <div ref={ref}>
      <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
        <Tag className="w-3 h-3" /> Groups / Segments
        <span className="text-gray-400 font-normal normal-case tracking-normal">(optional)</span>
      </Label>

      {/* Input box — chips live inline with the input */}
      <div className="relative">
        <div
          className="flex flex-wrap items-center gap-1.5 border rounded-lg px-2 py-1.5 min-h-[38px] cursor-text focus-within:ring-2 focus-within:ring-primary focus-within:border-primary/60 bg-white"
          onClick={() => { setOpen(true); inputRef.current?.focus() }}
        >
          {/* Selected chips — inline before the text input */}
          {selected.map(g => (
            <span
              key={g}
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${groupColor(g)}`}
            >
              {g}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); toggle(g) }}
                className="hover:opacity-70 transition-opacity"
                aria-label={`Remove ${g}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}

          {/* + Create button */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setOpen(true); inputRef.current?.focus() }}
            className="shrink-0 flex items-center gap-0.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/30 rounded-full px-2 py-0.5 hover:bg-primary/15 hover:border-primary/40 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add
          </button>

          <input
            ref={inputRef}
            value={inputVal}
            onChange={e => { setInputVal(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selected.length === 0 ? 'Select or type a group…' : 'More…'}
            className="flex-1 text-sm outline-none bg-transparent min-w-[80px]"
          />
          {inputVal.trim() && (
            <button
              type="button"
              onClick={() => addNew(inputVal)}
              className="shrink-0 text-xs text-primary font-semibold hover:text-primary/80 flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
            {filtered.length === 0 && !inputVal.trim() ? (
              <p className="text-xs text-gray-400 text-center py-3">All groups already selected</p>
            ) : filtered.length === 0 && inputVal.trim() ? (
              <button
                type="button"
                onClick={() => addNew(inputVal)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-primary/10"
              >
                <Plus className="w-3.5 h-3.5" />
                Create group &ldquo;<strong>{inputVal.trim()}</strong>&rdquo;
              </button>
            ) : (
              <>
                {!inputVal && (
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-3 pt-2 pb-1">
                    Available groups
                  </p>
                )}
                {filtered.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => { toggle(g); setInputVal(''); inputRef.current?.focus() }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left"
                  >
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${groupColor(g)}`}>{g}</span>
                  </button>
                ))}
                {inputVal.trim() && !allGroups.some(g => g.toLowerCase() === inputVal.toLowerCase()) && (
                  <button
                    type="button"
                    onClick={() => addNew(inputVal)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-primary/10 border-t"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create &ldquo;<strong>{inputVal.trim()}</strong>&rdquo;
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <p className="text-[10px] text-gray-400 mt-1">
        Press Enter or comma to create a new group. Groups persist for future records.
      </p>
    </div>
  )
}

// ── Smart-Lookup types & helpers ──────────────────────────────────────────────

type LookupType = 'gstin' | 'pan' | 'cin' | 'phone' | 'email' | 'unknown'

function detectLookupType(val: string): LookupType {
  const v = val.trim().toUpperCase()
  if (!v) return 'unknown'
  if (v.includes('@')) return 'email'
  const digits = v.replace(/\D/g, '')
  if (digits.length >= 8 && /^[0-9]+$/.test(v.replace(/[+\-\s]/g, ''))) return 'phone'
  if (v.length === 15 && GSTIN_RE.test(v)) return 'gstin'
  if (v.length === 15) return 'gstin'
  if (v.length === 10 && PAN_RE.test(v)) return 'pan'
  if (v.length >= 18 && CIN_RE.test(v)) return 'cin'
  return 'unknown'
}

const LOOKUP_BADGE: Record<LookupType, { label: string; color: string }> = {
  gstin:   { label: 'GSTIN', color: 'bg-blue-100 text-blue-700'     },
  pan:     { label: 'PAN',   color: 'bg-primary/12 text-primary' },
  cin:     { label: 'CIN',   color: 'bg-teal-100 text-teal-700'     },
  phone:   { label: 'Phone', color: 'bg-green-100 text-green-700'   },
  email:   { label: 'Email', color: 'bg-orange-100 text-orange-700' },
  unknown: { label: '',      color: ''                               },
}

type SuggestionItem =
  | { kind: 'customer'; data: Customer }
  | { kind: 'supplier'; data: Supplier }

/** Determine which fields of a record contain the search query */
function matchedFields(item: SuggestionItem, query: string): string[] {
  if (!query.trim()) return []
  const q = query.toLowerCase().trim()
  const qDigits = q.replace(/\D/g, '')

  const data = item.data
  const isC = item.kind === 'customer'

  const nameVal   = (isC ? (data as Customer).full_name    : (data as Supplier).name)?.toLowerCase() ?? ''
  const emailVal  = (data.email ?? '').toLowerCase()
  const phoneVal  = (data.phone ?? '').toLowerCase()
  const gstinVal  = (data.gstin ?? '').toLowerCase()
  const companyVal = (isC ? (data as Customer).company_name : undefined)?.toLowerCase() ?? ''
  const panVal    = (data.pan_number ?? '').toLowerCase()

  const fields: string[] = []
  if (nameVal.includes(q))   fields.push('Name')
  if (companyVal && companyVal.includes(q) && !nameVal.includes(q)) fields.push('Company')
  if (emailVal.includes(q))  fields.push('Email')
  if (phoneVal.includes(q) || (qDigits.length >= 5 && phoneVal.replace(/\D/g,'').includes(qDigits))) fields.push('Phone')
  if (gstinVal.includes(q))  fields.push('GSTIN')
  if (panVal.includes(q))    fields.push('PAN')
  return fields.length ? fields : ['Name']
}

// ── Country picker helpers ────────────────────────────────────────────────────

const popularSet = new Set(POPULAR_COUNTRIES)
const orderedCountries: CountryEntry[] = [
  ...POPULAR_COUNTRIES.map(iso => COUNTRIES.find(c => c.iso === iso)!).filter(Boolean),
  ...COUNTRIES.filter(c => !popularSet.has(c.iso)),
]

interface CountryPickerProps {
  value: string
  onChange: (entry: CountryEntry) => void
  mode: 'dialCode' | 'name'
  className?: string
}

function CountryPicker({ value, onChange, mode, className = '' }: CountryPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = search.trim()
    ? orderedCountries.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search) ||
        c.iso.toLowerCase().includes(search.toLowerCase())
      )
    : orderedCountries

  const currentEntry = mode === 'dialCode'
    ? orderedCountries.find(c => c.dialCode === value) ?? orderedCountries[0]
    : orderedCountries.find(c => c.name === value) ?? orderedCountries[0]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) { setSearch(''); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [open])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 hover:bg-gray-100 transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <span className="text-base leading-none">{currentEntry?.flag}</span>
        {mode === 'dialCode' && <span className="font-medium text-gray-700">{currentEntry?.dialCode}</span>}
        {mode === 'name' && <span className="font-medium text-gray-700 max-w-[90px] truncate">{currentEntry?.name}</span>}
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search country…"
              className="w-full text-sm px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No countries found</p>
            ) : filtered.map((c, i) => {
              const isSelected = mode === 'dialCode' ? c.dialCode === value : c.name === value
              const isLastPopular = !search && i === POPULAR_COUNTRIES.length - 1
              return (
                <div key={c.iso}>
                  <button
                    type="button"
                    onClick={() => { onChange(c); setOpen(false) }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-primary/10 transition-colors text-left ${
                      isSelected ? 'bg-primary/10 font-medium text-primary' : 'text-gray-700'
                    }`}
                  >
                    <span className="text-base">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    {mode === 'dialCode' && <span className="text-xs text-gray-400 font-mono">{c.dialCode}</span>}
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary/70 shrink-0" />}
                  </button>
                  {isLastPopular && <div className="border-t mx-2 my-0.5" />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Relation picker — mini party search for custom "Party Link" fields ────────

function RelationPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState(value)
  const [results, setResults] = useState<{ id: string; label: string; sub: string }[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const search = (raw: string) => {
    setQ(raw)
    clearTimeout(timer.current)
    if (!raw.trim()) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      const [cs, ss] = await Promise.allSettled([
        vendorApi.listCustomers({ search: raw, limit: 4 }),
        vendorApi.listSuppliers({ search: raw, limit: 4 }),
      ])
      const hits: { id: string; label: string; sub: string }[] = []
      if (cs.status === 'fulfilled') {
        const items = (cs.value as { items?: unknown[] })?.items ?? (Array.isArray(cs.value) ? cs.value : [])
        ;(items as Record<string, unknown>[]).forEach(c =>
          hits.push({ id: String(c.id), label: String(c.full_name ?? c.name ?? ''), sub: 'Customer' }))
      }
      if (ss.status === 'fulfilled') {
        const items = (ss.value as { items?: unknown[] })?.items ?? (Array.isArray(ss.value) ? ss.value : [])
        ;(items as Record<string, unknown>[]).forEach(s =>
          hits.push({ id: String(s.id), label: String(s.name ?? ''), sub: 'Vendor/Party' }))
      }
      setResults(hits)
      setOpen(hits.length > 0)
    }, 300)
  }

  const pick = (item: { id: string; label: string }) => {
    const v = `${item.label} (${item.id})`
    setQ(v); onChange(v); setOpen(false)
  }

  return (
    <div className="relative">
      <Input
        value={q} onChange={e => search(e.target.value)}
        placeholder="Search for a customer, vendor, partner…" className="text-sm"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {results.map(r => (
            <button key={r.id} type="button" onClick={() => pick(r)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary/10 text-left">
              <Users className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              <span className="flex-1 text-sm font-medium text-gray-800 truncate">{r.label}</span>
              <span className="text-[10px] text-gray-400 shrink-0">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface AddPartyModalProps {
  onClose: () => void
  defaultType?: PartyType
  onCreated?: (party: Record<string, unknown>) => void
  /** When provided the modal opens in edit mode, pre-filling all fields from the existing record. */
  editRecord?: { raw: Customer | Supplier; kind: 'customer' | 'supplier' }
}

export function AddPartyModal({ onClose, defaultType, onCreated, editRecord }: AddPartyModalProps) {
  const isEditMode = !!editRecord
  const stored = localStorage.getItem('lastPartyType')
  const [partyType, setPartyType] = useState<string>(() => {
    if (editRecord) {
      if (editRecord.kind === 'customer') return 'customer'
      const s = editRecord.raw as Supplier
      try {
        const metaLine = (s.notes || '').split('\n').find(l => l.startsWith('__meta__:'))
        if (metaLine) { const m = JSON.parse(metaLine.slice(9)); if (m.custom_type_label) return m.custom_type_label }
      } catch { /* ignore */ }
      return s.party_type as string || 'supplier'
    }
    return defaultType ?? stored ?? 'customer'
  })

  // Custom party types
  const [customPartyTypes, setCustomPartyTypes] = useState<string[]>(loadCustomPartyTypes)
  const [showCustomTypeInput, setShowCustomTypeInput] = useState(false)
  const [customTypeInput, setCustomTypeInput] = useState('')

  // Profile picture
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profilePreview, setProfilePreview] = useState<string | null>(() => {
    if (!editRecord) return null
    const id = (editRecord.raw as { id?: string }).id
    return id ? loadAvatar(id) : null
  })
  const [profileFile, setProfileFile] = useState<File | null>(null)

  // Groups / Segments — seeded from last session, persisted on every change
  const [groups, setGroups] = useState<string[]>(loadSelectedGroups)

  const handleGroupsChange = useCallback((next: string[]) => {
    setGroups(next)
    saveSelectedGroups(next)
  }, [])

  // Status & Access Controls
  const [partyStatus, setPartyStatus] = useState<PartyStatusType>('active')
  const [holdUntil, setHoldUntil]   = useState('')
  const [paymentBlocked, setPaymentBlocked] = useState(false)

  // Smart Lookup
  const [lookup, setLookup] = useState('')
  const [lookupType, setLookupType] = useState<LookupType>('unknown')
  const [gstStatus, setGstStatus] = useState<'idle' | 'valid' | 'invalid' | 'fetched'>('idle')
  const [fetching, setFetching] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const lookupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lookupContainerRef = useRef<HTMLDivElement>(null)

  const updateDropdownRect = useCallback(() => {
    if (lookupContainerRef.current) {
      const r = lookupContainerRef.current.getBoundingClientRect()
      setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }, [])

  // Primary fields — seeded from editRecord on mount so avatar/initials render immediately
  const [name, setName] = useState<string>(() => {
    if (!editRecord) return ''
    return editRecord.kind === 'customer'
      ? (editRecord.raw as Customer).full_name || ''
      : (editRecord.raw as Supplier).name || ''
  })
  const [phone, setPhone] = useState<string>(() =>
    editRecord ? ((editRecord.raw as unknown as Record<string, string>).phone ?? '') : ''
  )
  const [email, setEmail] = useState<string>(() =>
    editRecord ? ((editRecord.raw as unknown as Record<string, string>).email ?? '') : ''
  )

  // More Details
  const [expanded, setExpanded] = useState(false)
  // Party / business country — controls which tax ID fields appear
  const [partyCountry, setPartyCountry] = useState<CountryEntry>(COUNTRIES.find(c => c.iso === 'IN')!)

  // India-specific tax IDs
  const [gstin, setGstin] = useState('')
  const [pan, setPan] = useState('')
  const [cin, setCin] = useState('')
  // Generic tax ID for non-India countries (mapped to gstin API field on submit)
  const [taxId, setTaxId] = useState('')

  // Derived: which tax fields to show based on partyCountry
  const activeTaxFields = COUNTRY_TAX_FIELDS[partyCountry.iso] ?? DEFAULT_TAX_FIELDS

  // Unified getter/setter so the dynamic rendering loop can drive any field
  const getTaxVal = (key: TaxFieldDef['key']): string => {
    if (key === 'gstin') return gstin
    if (key === 'pan')   return pan
    if (key === 'cin')   return cin
    return taxId
  }
  const setTaxVal = (key: TaxFieldDef['key'], v: string) => {
    if (key === 'gstin') setGstin(v)
    else if (key === 'pan') setPan(v)
    else if (key === 'cin') setCin(v)
    else setTaxId(v)
  }

  const _defaultCountry = COUNTRIES.find(c => c.iso === 'IN')!
  const makeBlankAddr = (type: AddrType = 'address'): AddressEntry => ({
    id: `addr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type, customName: '', street: '', city: '', state: '', pincode: '', country: _defaultCountry,
  })
  const [addresses, setAddresses] = useState<AddressEntry[]>([makeBlankAddr('address')])
  const [customFields, setCustomFields] = useState<CustomFieldEntry[]>([])

  const [website, setWebsite] = useState('')
  const [altPhone, setAltPhone] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [customTerms, setCustomTerms] = useState<string[]>(loadCustomTerms)
  const [termsInput, setTermsInput] = useState('')
  const [showTermsInput, setShowTermsInput] = useState(false)

  const allTerms = [...PAYMENT_TERMS_DEFAULT, ...customTerms]

  const addCustomTerm = () => {
    const t = termsInput.trim()
    if (!t || allTerms.some(x => x.toLowerCase() === t.toLowerCase())) {
      setShowTermsInput(false); setTermsInput(''); return
    }
    const updated = [...customTerms, t]
    setCustomTerms(updated); persistCustomTerms(updated)
    setPaymentTerms(t); setShowTermsInput(false); setTermsInput('')
  }

  const removeCustomTerm = (t: string) => {
    const updated = customTerms.filter(x => x !== t)
    setCustomTerms(updated); persistCustomTerms(updated)
    if (paymentTerms === t) setPaymentTerms('')
  }
  const [openingBalance, setOpeningBalance] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [notes, setNotes] = useState('')
  // Bank details
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [accountType, setAccountType] = useState('savings')
  const [ifscCode, setIfscCode] = useState('')
  const [enablePortal, setEnablePortal] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<'error' | 'warning' | 'info'>('error')

  const createCustomer = useCreateCustomer()
  const createSupplier = useCreateSupplier()
  const updateCustomer = useUpdateCustomer()
  const updateSupplier = useUpdateSupplier()
  const isLoading = createCustomer.isPending || createSupplier.isPending ||
                    updateCustomer.isPending || updateSupplier.isPending

  // Pre-fill all form fields when opening in edit mode
  useEffect(() => {
    if (!editRecord) return
    const { raw, kind } = editRecord

    const parseAddrCountry = (name?: string) =>
      (name && COUNTRIES.find(c => c.name === name)) || COUNTRIES.find(c => c.iso === 'IN')!
    const cleanNotes = (n?: string) =>
      (n || '').split('\n').filter(l => !l.startsWith('__meta__:') && !l.startsWith('=== ')).join('\n').trim()

    if (kind === 'customer') {
      const c = raw as Customer
      setName(c.full_name || '')
      setEmail(c.email || '')
      setPhone(c.phone || '')
      setGstin(c.gstin || '')
      setPan(c.pan_number || '')
      setOpeningBalance(c.opening_balance?.toString() || '')
      setPartyType('customer')
      const ba = c.billing_address as Record<string, string> | undefined
      if (ba?.street || ba?.city) {
        setAddresses([{
          id: 'addr-edit-0', type: 'billing', customName: '',
          street: ba.street || '', city: ba.city || '', state: ba.state || '',
          pincode: ba.pincode || ba.postal_code || '',
          country: parseAddrCountry(ba.country),
        }])
      }
      setNotes(cleanNotes((c as unknown as Record<string, string>).notes))
      setBankName(c.bank_name || '')
      setAccountNumber(c.account_number || '')
      setAccountHolderName(c.account_holder_name || '')
      setAccountType(c.account_type || 'savings')
      setIfscCode(c.ifsc_code || '')
    } else {
      const s = raw as Supplier
      const metaLine = (s.notes || '').split('\n').find(l => l.startsWith('__meta__:'))
      let customLabel: string | undefined
      try { if (metaLine) customLabel = JSON.parse(metaLine.slice(9)).custom_type_label } catch { /* ignore */ }

      setName(s.name || '')
      setEmail(s.email || '')
      setContactPerson(s.contact_name || '')
      setPhone(s.phone || '')
      setGstin(s.gstin || '')
      setPan(s.pan_number || '')
      setOpeningBalance(s.opening_balance?.toString() || '')
      setPartyType(customLabel ?? (s.party_type as string) ?? 'supplier')
      const addr = s.address
      if (addr?.street || addr?.city) {
        setAddresses([{
          id: 'addr-edit-0', type: 'address', customName: '',
          street: addr.street || '', city: addr.city || '', state: addr.state || '',
          pincode: addr.postal_code || '',
          country: parseAddrCountry(addr.country),
        }])
      }
      setNotes(cleanNotes(s.notes))
      setBankName(s.bank_name || '')
      setAccountNumber(s.account_number || '')
      setAccountHolderName(s.account_holder_name || '')
      setAccountType(s.account_type || 'savings')
      setIfscCode(s.ifsc_code || '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRecord])

  // Close suggestion dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (lookupContainerRef.current && !lookupContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Recalculate portal dropdown position when it opens or window resizes/scrolls
  useEffect(() => {
    if (showSuggestions) {
      updateDropdownRect()
      window.addEventListener('resize', updateDropdownRect)
      window.addEventListener('scroll', updateDropdownRect, true)
      return () => {
        window.removeEventListener('resize', updateDropdownRect)
        window.removeEventListener('scroll', updateDropdownRect, true)
      }
    }
  }, [showSuggestions, updateDropdownRect])

  // Profile picture
  const handleProfilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProfileFile(file)
    const reader = new FileReader()
    reader.onload = ev => setProfilePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // Party type
  const handlePartyType = (t: string) => {
    setPartyType(t)
    localStorage.setItem('lastPartyType', t)
    setDuplicateError(null)
    setErrors({})
  }

  const addCustomPartyType = () => {
    const name = customTypeInput.trim()
    if (!name) return
    const normalised = name.charAt(0).toUpperCase() + name.slice(1)
    const builtInLabels = PARTY_TYPES.map(p => p.label.toLowerCase())
    if (
      builtInLabels.includes(normalised.toLowerCase()) ||
      customPartyTypes.some(t => t.toLowerCase() === normalised.toLowerCase())
    ) {
      handlePartyType(PARTY_TYPES.find(p => p.label.toLowerCase() === normalised.toLowerCase())?.value ?? normalised)
      setShowCustomTypeInput(false)
      setCustomTypeInput('')
      return
    }
    const next = [...customPartyTypes, normalised]
    setCustomPartyTypes(next)
    persistCustomPartyTypes(next)
    handlePartyType(normalised)
    setShowCustomTypeInput(false)
    setCustomTypeInput('')
  }

  const removeCustomPartyType = (label: string) => {
    const next = customPartyTypes.filter(t => t !== label)
    setCustomPartyTypes(next)
    persistCustomPartyTypes(next)
    if (partyType === label) handlePartyType('supplier')
  }

  // Debounced master data search
  const runMasterSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    setSuggestionsLoading(true)
    try {
      const [cRes, sRes] = await Promise.allSettled([
        vendorApi.listCustomers({ search: query, size: 5 }),
        vendorApi.listSuppliers({ search: query, size: 5 }),
      ])
      const customers: SuggestionItem[] = cRes.status === 'fulfilled'
        ? (cRes.value.items ?? []).map((d: Customer) => ({ kind: 'customer' as const, data: d }))
        : []
      const suppliers: SuggestionItem[] = sRes.status === 'fulfilled'
        ? (sRes.value.items ?? []).map((d: Supplier) => ({ kind: 'supplier' as const, data: d }))
        : []
      const merged = [...customers, ...suppliers].slice(0, 8)
      setSuggestions(merged)
      setShowSuggestions(merged.length > 0)
    } catch { /* silently ignore */ } finally {
      setSuggestionsLoading(false)
    }
  }, [])

  // Lookup handler
  const handleLookupChange = (raw: string) => {
    const v = raw.toUpperCase().replace(/\s/g, '')
    setLookup(raw)
    setGstStatus('idle')
    setDuplicateError(null)
    const detected = detectLookupType(v)
    setLookupType(detected)

    if (detected === 'phone')       setPhone(raw.replace(/\D/g, '').slice(0, 15))
    else if (detected === 'email')  setEmail(raw.toLowerCase())
    else if (detected === 'pan')    { setPan(v); setExpanded(true) }
    else if (detected === 'cin')    { setCin(v); setExpanded(true) }
    else if (detected === 'gstin')  {
      setGstin(v)
      if (v.length === 15) {
        if (GSTIN_RE.test(v)) {
          setPan(v.slice(2, 12))
          // Auto-fill state on first address from GSTIN prefix if not already set
          setAddresses(prev => {
            const gstState = GST_STATES[v.slice(0, 2)] || ''
            if (!gstState || !prev.length || prev[0].state) return prev
            return [{ ...prev[0], state: gstState }, ...prev.slice(1)]
          })
          setGstStatus('valid')
        } else setGstStatus('invalid')
      }
    }

    if (lookupDebounceRef.current) clearTimeout(lookupDebounceRef.current)
    lookupDebounceRef.current = setTimeout(() => runMasterSearch(raw), 300)
  }

  // Pre-fill from suggestion
  const applySuggestion = (item: SuggestionItem) => {
    setShowSuggestions(false)
    setLookup('')
    setSuggestions([])
    if (item.kind === 'customer') {
      const c = item.data
      setName(c.full_name || '')
      setEmail(c.email || '')
      if (c.phone) setPhone(c.phone.replace(/^\+\d{1,3}/, ''))
      if (c.gstin)      { setGstin(c.gstin); setExpanded(true) }
      if (c.pan_number) { setPan(c.pan_number); setExpanded(true) }
    } else {
      const s = item.data
      setName(s.name || '')
      setEmail(s.email || '')
      if (s.phone) setPhone(s.phone.replace(/^\+\d{1,3}/, ''))
      if (s.gstin)       { setGstin(s.gstin); setExpanded(true) }
      if (s.pan_number)  { setPan(s.pan_number); setExpanded(true) }
      if (s.contact_name) setContactPerson(s.contact_name)
    }
    setDuplicateError(
      `This record already exists in Master Data (${item.kind}). Review and update if needed, or cancel to avoid a duplicate.`
    )
  }

  const fetchGstDetails = useCallback(async () => {
    if (!gstin || gstin.length !== 15 || !GSTIN_RE.test(gstin)) return
    setFetching(true)
    try {
      const data = await vendorApi.gstLookup(gstin)
      if (data.api_fetched) {
        const addr = data.address as { street?: string; city?: string; state?: string; pincode?: string } | null
        const tradeName = (data.trade_name as string) || (data.legal_name as string) || ''
        if (tradeName && !name) setName(tradeName)
        if (addr) {
          setAddresses(prev => {
            const first = prev[0] ?? makeBlankAddr('gst')
            return [{ ...first,
              type:    'gst',
              street:  addr.street  ?? first.street,
              city:    addr.city    ?? first.city,
              state:   addr.state   ?? first.state,
              pincode: addr.pincode ?? first.pincode,
            }, ...prev.slice(1)]
          })
        }
        setGstStatus('fetched')
        setExpanded(true)
      } else setGstStatus('valid')
    } catch { setGstStatus('valid') } finally { setFetching(false) }
  }, [gstin, name])

  // ── Address helpers ──────────────────────────────────────────────────────────
  const updateAddr = (id: string, patch: Partial<AddressEntry>) =>
    setAddresses(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))

  const addAddr = () =>
    setAddresses(prev => [...prev, makeBlankAddr('shipping')])

  const removeAddr = (id: string) =>
    setAddresses(prev => prev.length > 1 ? prev.filter(a => a.id !== id) : prev)

  // ── Custom field helpers ──────────────────────────────────────────────────────
  const addCustomField = () =>
    setCustomFields(prev => [...prev, {
      id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: '', type: 'text', value: '',
    }])

  const updateCustomField = (id: string, patch: Partial<CustomFieldEntry>) =>
    setCustomFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))

  const removeCustomField = (id: string) =>
    setCustomFields(prev => prev.filter(f => f.id !== id))

  /** Clear one field's error when the user edits it */
  const clearFieldErr = (field: string) =>
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim() || name.trim().length < 2) errs.name = 'Name is required (min 2 chars)'
    if (partyType === 'customer') {
      if (!email.trim() && !phone.trim()) errs.phone = 'Either email or phone is required'
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email'
      if (phone && phone.length < 5) errs.phone = 'Enter a valid phone number'
    }
    if (enablePortal && password && password.length < 6) errs.password = 'Password must be at least 6 chars'
    // India-specific format validation
    if (partyCountry.iso === 'IN') {
      if (gstin && !GSTIN_RE.test(gstin)) errs.gstin = 'Invalid GSTIN format'
      if (pan   && !PAN_RE.test(pan))     errs.pan   = 'Invalid PAN format'
    }
    if (website && !/^https?:\/\/.+/.test(website)) errs.website = 'URL must start with http:// or https://'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDuplicateError(null)
    setErrorKind('error')

    if (!validate()) {
      // Show a banner and scroll to it so the user sees validation errors
      // even if scrolled to the bottom of the form
      setDuplicateError('Please fix the highlighted fields before saving.')
      setTimeout(() => {
        document.getElementById('add-party-error-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }

    const primaryAddr = addresses[0]
    const billingAddress = (primaryAddr?.street || primaryAddr?.city || primaryAddr?.state || primaryAddr?.pincode)
      ? { street: primaryAddr.street, city: primaryAddr.city, state: primaryAddr.state,
          pincode: primaryAddr.pincode, country: primaryAddr.country.name }
      : undefined
    const fullPhone    = phone    || undefined
    const fullAltPhone = altPhone || undefined

    // Map tax fields: India uses gstin/pan; other countries map their primary tax ID to the gstin API field
    const apiGstin    = partyCountry.iso === 'IN' ? gstin    : taxId   // re-used field in backend
    const apiPan      = partyCountry.iso === 'IN' ? pan      : undefined
    const apiCin      = partyCountry.iso === 'IN' ? cin      : undefined

    // Serialise extra addresses + custom fields into notes (until backend has dedicated columns)
    const extraParts: string[] = []
    const extraAddrs = addresses.slice(1).filter(a => a.street || a.city || a.pincode)
    if (extraAddrs.length > 0) {
      extraParts.push('=== Additional Addresses ===')
      extraAddrs.forEach(a => {
        const label = a.type === 'other' && a.customName
          ? a.customName
          : (ADDR_TYPE_OPTS.find(o => o.value === a.type)?.label ?? a.type)
        const line = [a.street, a.city, a.state, a.pincode, a.country.name].filter(Boolean).join(', ')
        extraParts.push(`${label}: ${line}`)
      })
    }
    const filledCustom = customFields.filter(f => f.label.trim() && f.value.trim())
    if (filledCustom.length > 0) {
      extraParts.push('=== Custom Fields ===')
      filledCustom.forEach(f => extraParts.push(`${f.label}: ${f.value}`))
    }
    // Embed custom party-type label in metadata so MasterDataReport can display it correctly
    const BUILT_IN_TYPES = ['customer', 'supplier', 'employee', 'partner', 'contractor']
    const isCustomPartyType = !BUILT_IN_TYPES.includes(partyType)
    if (isCustomPartyType) {
      extraParts.push(`__meta__:${JSON.stringify({ custom_type_label: partyType })}`)
    }
    const finalNotes = [notes, ...extraParts].filter(Boolean).join('\n')

    // ── Helper: persist avatar to localStorage after save ────────────────────
    const persistAvatarIfNeeded = (recordId: string) => {
      if (profilePreview && (profileFile || (isEditMode && profilePreview !== loadAvatar(recordId)))) {
        saveAvatar(recordId, profilePreview)
      }
    }

    // ── Edit mode: call update instead of create ─────────────────────────────
    if (isEditMode && editRecord) {
      const id = (editRecord.raw as { id: string }).id
      try {
        const bankPayload = {
          bank_name: bankName || undefined,
          account_number: accountNumber || undefined,
          account_holder_name: accountHolderName || undefined,
          account_type: accountType || undefined,
          ifsc_code: ifscCode || undefined,
        }
        if (editRecord.kind === 'customer') {
          const payload: Record<string, unknown> = {
            full_name: name.trim(), email: email || undefined, phone: fullPhone,
            gstin: apiGstin || undefined, pan_number: apiPan || undefined,
            opening_balance: openingBalance ? parseFloat(openingBalance) : 0,
            billing_address: billingAddress, notes: notes || undefined,
            ...bankPayload,
          }
          const updated = await updateCustomer.mutateAsync({ id, data: payload })
          persistAvatarIfNeeded(id)
          onCreated?.(updated as unknown as Record<string, unknown>)
        } else {
          const VALID_PARTY_TYPES: PartyType[] = ['supplier', 'employee', 'partner', 'contractor']
          const apiPartyType: PartyType = VALID_PARTY_TYPES.includes(partyType as PartyType) ? (partyType as PartyType) : 'supplier'
          const addr = billingAddress ? { street: billingAddress.street, city: billingAddress.city,
            state: billingAddress.state, postal_code: billingAddress.pincode, country: billingAddress.country } : undefined
          const payload: Record<string, unknown> = {
            name: name.trim(), party_type: apiPartyType,
            contact_name: contactPerson || undefined, email: email || undefined, phone: fullPhone,
            gstin: apiGstin || undefined, pan_number: apiPan || undefined,
            opening_balance: openingBalance ? parseFloat(openingBalance) : 0,
            address: addr, notes: finalNotes || undefined,
            ...bankPayload,
          }
          const updated = await updateSupplier.mutateAsync({ id, data: payload })
          persistAvatarIfNeeded(id)
          onCreated?.(updated as unknown as Record<string, unknown>)
        }
        onClose()
      } catch (err: unknown) {
        console.error('[AddPartyModal] Update failed:', err)
        setDuplicateError('Could not save changes — please check the fields and try again.')
      }
      return
    }

    try {
      if (partyType === 'customer') {
        // Only send fields the Customer table actually has
        const created = await createCustomer.mutateAsync({
          full_name:            name.trim(),
          email:                email.trim() || undefined,
          phone:                fullPhone,
          password:             (enablePortal && password) ? password : undefined,
          company_name:         name.trim(),
          gstin:                apiGstin || undefined,
          pan_number:           apiPan   || undefined,
          billing_address:      billingAddress,
          opening_balance:      openingBalance ? parseFloat(openingBalance) : 0,
          bank_name:            bankName || undefined,
          account_number:       accountNumber || undefined,
          account_holder_name:  accountHolderName || undefined,
          account_type:         accountType || undefined,
          ifsc_code:            ifscCode || undefined,
        } as Parameters<typeof createCustomer.mutateAsync>[0])
        const createdId = (created as unknown as { id?: string }).id
        if (createdId) persistAvatarIfNeeded(createdId)
        onCreated?.(created as unknown as Record<string, unknown>)
        onClose()
      } else {
        // Only send fields the Supplier table actually has
        const address = (primaryAddr?.street || primaryAddr?.city || primaryAddr?.state || primaryAddr?.pincode)
          ? { street: primaryAddr.street, city: primaryAddr.city, state: primaryAddr.state,
              postal_code: primaryAddr.pincode, country: primaryAddr.country.name }
          : undefined
        // Map custom party types to 'supplier' — backend only accepts the built-in enum values
        const VALID_PARTY_TYPES: PartyType[] = ['supplier', 'employee', 'partner', 'contractor']
        const apiPartyType: PartyType = VALID_PARTY_TYPES.includes(partyType as PartyType)
          ? (partyType as PartyType)
          : 'supplier'

        const created = await createSupplier.mutateAsync({
          name:                 name.trim(),
          party_type:           apiPartyType,
          contact_name:         contactPerson || undefined,
          email:                email || undefined,
          phone:                fullPhone,
          notes:                finalNotes || undefined,
          gstin:                apiGstin || undefined,
          pan_number:           apiPan   || undefined,
          address,
          opening_balance:      openingBalance ? parseFloat(openingBalance) : 0,
          bank_name:            bankName || undefined,
          account_number:       accountNumber || undefined,
          account_holder_name:  accountHolderName || undefined,
          account_type:         accountType || undefined,
          ifsc_code:            ifscCode || undefined,
        })
        const createdSupplierId = (created as unknown as { id?: string }).id
        if (createdSupplierId) persistAvatarIfNeeded(createdSupplierId)
        onCreated?.(created as unknown as Record<string, unknown>)
        onClose()
      }
    } catch (err: unknown) {
      // Always log the raw error for browser DevTools debugging
      console.error('[AddPartyModal] Save failed:', err)

      const { fieldErrors, generalError, isDuplicate } = parseApiError(err)

      // Apply field-level highlights — also auto-expand More Details if needed
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(prev => ({ ...prev, ...fieldErrors }))
        if (Object.keys(fieldErrors).some(f => MORE_DETAILS_FIELDS.has(f))) {
          setExpanded(true)
        }
      }

      // Build banner message — always show SOMETHING
      const fieldCount = Object.keys(fieldErrors).length
      if (isDuplicate) {
        setErrorKind('warning')
        setDuplicateError(generalError ?? 'A record with this information already exists.')
      } else if (fieldCount > 0) {
        setErrorKind('error')
        const extra = generalError ? ` ${generalError}` : ''
        setDuplicateError(
          (fieldCount === 1
            ? 'One field needs correction — see highlighted field below.'
            : `${fieldCount} fields need correction — see highlighted fields below.`) + extra
        )
      } else {
        // Covers generalError present OR unknown errors (never stay silent)
        setErrorKind('error')
        setDuplicateError(generalError ?? 'Save failed — please check all fields and try again.')
      }

      // Scroll banner into view so the user always sees the error
      setTimeout(() => {
        document.getElementById('add-party-error-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    }

    // Avatar is persisted to localStorage within each branch above via persistAvatarIfNeeded
  }

  const submitLabel = isEditMode
    ? 'Save Changes'
    : (({ customer: 'Add Customer', supplier: 'Add Vendor', employee: 'Add Employee',
           partner: 'Add Partner', contractor: 'Add Contractor',
         } as Record<string, string>)[partyType] ?? `Add ${partyType.charAt(0).toUpperCase()}${partyType.slice(1)}`)

  const showContactPerson = partyType !== 'customer'
  const badge = LOOKUP_BADGE[lookupType]
  const showFetchBtn = partyCountry.iso === 'IN' && lookupType === 'gstin' && gstStatus !== 'invalid' && lookup.length === 15

  const suggestionBadge = (item: SuggestionItem) => {
    if (item.kind === 'customer') return 'Customer'
    const pt = (item.data as Supplier).party_type
    return pt ? pt.charAt(0).toUpperCase() + pt.slice(1) : 'Vendor'
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[720px] max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditMode ? `Edit — ${name || 'Record'}` : 'Master Data'}
              </h2>
              <p className="text-xs text-gray-400">
                {isEditMode ? 'Update master data record' : 'Add new party record'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="cancel" size="sm" onClick={onClose} className="h-8 text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-party-form"
              size="sm"
              disabled={isLoading}
              className="h-8 text-xs bg-primary hover:bg-primary/90"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              {submitLabel}
            </Button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors ml-1">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form id="add-party-form" onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Error / warning banner */}
          {duplicateError && (() => {
            const isWarn = errorKind === 'warning'
            const hasFieldErrs = Object.keys(errors).length > 0
            return (
              <div id="add-party-error-banner" className={`flex items-start gap-3 border rounded-xl px-4 py-3 ${
                isWarn ? 'bg-amber-50 border-amber-300' : 'bg-red-50 border-red-300'
              }`}>
                <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${isWarn ? 'text-amber-500' : 'text-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isWarn ? 'text-amber-800' : 'text-red-800'}`}>
                    {isWarn ? 'Duplicate Record' : hasFieldErrs ? 'Validation Failed' : 'Could Not Save'}
                  </p>
                  <p className={`text-xs mt-0.5 leading-relaxed ${isWarn ? 'text-amber-700' : 'text-red-700'}`}>
                    {duplicateError}
                  </p>
                  {hasFieldErrs && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(errors).map(([field, msg]) => (
                        <span key={field} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                          <span className="capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="font-normal opacity-75">— {msg}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setDuplicateError(null); setErrors({}) }}
                  className="shrink-0 p-0.5 rounded hover:bg-black/5"
                >
                  <X className={`w-3.5 h-3.5 ${isWarn ? 'text-amber-400' : 'text-red-400'}`} />
                </button>
              </div>
            )
          })()}

          {/* TOP ROW: Profile picture + Smart Lookup + Party Country */}
          <div className="flex items-start gap-3">

            {/* Profile picture — compact, top-left */}
            <div className="relative shrink-0">
              {/* Avatar — display only, not a click target */}
              <div className="w-[58px] h-[58px] rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 border-2 border-primary/30 flex items-center justify-center overflow-hidden select-none">
                {profilePreview
                  ? <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                  : name.trim()
                    ? <span className="text-xl font-bold text-primary leading-none">{name.trim()[0].toUpperCase()}</span>
                    : <User className="w-6 h-6 text-primary/60" />}
              </div>
              {/* Camera badge — only this triggers file picker */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload profile picture"
                className="absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow hover:bg-primary/90 transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePick} />
              {profilePreview && (
                <button
                  type="button"
                  onClick={() => { setProfilePreview(null); setProfileFile(null) }}
                  title="Remove photo"
                  className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>

            {/* Smart Lookup */}
            <div ref={lookupContainerRef} className="relative flex-1 min-w-0">
              <Label className="flex items-center gap-1.5 mb-1">
                <Search className="w-3.5 h-3.5" />
                Smart Lookup
                <span className="text-gray-400 font-normal text-xs">
                  {partyCountry.iso === 'IN'
                    ? '(Name, Phone, Email, GSTIN, PAN…)'
                    : `(Name, Phone, Email, ${activeTaxFields.map(f => f.label).join(', ')}…)`}
                </span>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    value={lookup}
                    onChange={e => handleLookupChange(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder={partyCountry.iso === 'IN'
                      ? 'Search records or enter GSTIN, PAN, CIN, phone, email…'
                      : `Search records or enter ${activeTaxFields.map(f => f.label).join(', ')}, phone, email…`}
                    className={`pr-28 text-sm ${
                      gstStatus === 'invalid' ? 'border-red-400' :
                      gstStatus === 'fetched' ? 'border-green-400' : ''
                    }`}
                    autoComplete="off"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {suggestionsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                    {!suggestionsLoading && gstStatus === 'fetched' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    {!suggestionsLoading && gstStatus === 'invalid' && <AlertCircle className="w-4 h-4 text-red-500" />}
                    {badge.label && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                    )}
                  </div>
                </div>
                {showFetchBtn && (
                  <Button type="button" variant="outline" size="sm" onClick={fetchGstDetails} disabled={fetching} className="whitespace-nowrap">
                    {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    Fetch Details
                  </Button>
                )}
              </div>

              {/* Inline status hints (no results / loading) */}
              {suggestionsLoading && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Searching master data…
                </p>
              )}
              {!suggestionsLoading && lookup.trim().length >= 2 && !showSuggestions && suggestions.length === 0 && lookupType === 'unknown' && (
                <p className="text-xs text-gray-400 mt-1">No matching records found</p>
              )}

              {partyCountry.iso === 'IN' && gstStatus === 'fetched' && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Details fetched from GST portal
                </p>
              )}
              {partyCountry.iso === 'IN' && gstStatus === 'invalid' && (
                <p className="text-xs text-red-500 mt-1">Invalid GSTIN format</p>
              )}
              {partyCountry.iso === 'IN' && lookupType === 'gstin' && lookup.length > 0 && lookup.length < 15 && (
                <p className="text-xs text-gray-400 mt-1">{lookup.length}/15 characters</p>
              )}
            </div>

            {/* Party / business country — drives which tax ID fields appear */}
            <div className="shrink-0 w-44">
              <Label className="flex items-center gap-1 text-xs mb-1">
                <Globe className="w-3 h-3 text-gray-500" /> Country
              </Label>
              <CountryPicker
                value={partyCountry.name}
                onChange={c => { setPartyCountry(c); setGstin(''); setPan(''); setCin(''); setTaxId('') }}
                mode="name"
                className="w-full"
              />
              {partyCountry.iso !== 'IN' && (
                <p className="text-[10px] text-gray-400 mt-1 leading-tight">
                  Tax fields adapt to {partyCountry.name}
                </p>
              )}
            </div>
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ap-phone" className="text-xs font-medium text-gray-600">Phone</Label>
              <PhoneInput
                value={phone}
                onChange={(v) => { setPhone(v); setDuplicateError(null); clearFieldErr('phone') }}
                error={errors.phone}
                defaultCountryIso="IN"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ap-email" className="text-xs font-medium text-gray-600">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  id="ap-email" type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setDuplicateError(null); clearFieldErr('email') }}
                  placeholder="contact@example.com"
                  className={`pl-9 ${errors.email ? 'border-red-400' : ''}`}
                />
              </div>
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>
          </div>

          {/* Merged Name field */}
          <div className="space-y-1">
            <Label htmlFor="ap-name" className="text-xs font-medium text-gray-600">
              Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                id="ap-name"
                value={name}
                onChange={e => { setName(e.target.value); setDuplicateError(null); clearFieldErr('name') }}
                placeholder="Name / Company / Trade Name / Organisation…"
                className={`pl-9 ${errors.name ? 'border-red-400' : ''}`}
              />
            </div>
            <p className="text-[11px] text-gray-400">
              Enter the individual's full name, company name, or trade name
            </p>
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Party Type */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 block">Party Type</Label>
            <div className="flex flex-wrap gap-2 items-center">

              {/* Built-in types */}
              {PARTY_TYPES.map(({ value, label }) => (
                <button
                  key={value} type="button" onClick={() => handlePartyType(value)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    partyType === value
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-primary/60 hover:text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}

              {/* User-created custom types */}
              {customPartyTypes.map(ct => (
                <span
                  key={ct}
                  className={`inline-flex items-center rounded-full border text-sm font-medium transition-all ${
                    partyType === ct
                      ? 'bg-primary border-primary text-white shadow-sm'
                      : 'bg-white border-primary/40 text-primary hover:border-primary'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handlePartyType(ct)}
                    className="pl-3.5 pr-1.5 py-1.5 leading-none"
                  >
                    {ct}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCustomPartyType(ct)}
                    title={`Remove ${ct}`}
                    className={`pr-2 py-1.5 opacity-60 hover:opacity-100 transition-opacity`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {/* + Custom type — button or inline input */}
              {!showCustomTypeInput ? (
                <button
                  type="button"
                  onClick={() => setShowCustomTypeInput(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-primary/40 text-primary/70 hover:border-primary hover:bg-primary/10 transition-all"
                >
                  <Plus className="w-3 h-3" /> Custom
                </button>
              ) : (
                <div className="flex items-center gap-1 bg-primary/10 border border-primary/40 rounded-full px-2 py-1">
                  <input
                    autoFocus
                    value={customTypeInput}
                    onChange={e => setCustomTypeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); addCustomPartyType() }
                      if (e.key === 'Escape') { setShowCustomTypeInput(false); setCustomTypeInput('') }
                    }}
                    placeholder="Type name…"
                    className="text-sm bg-transparent outline-none text-gray-800 w-28 min-w-0"
                  />
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={addCustomPartyType}
                    className="text-xs font-semibold bg-primary text-white px-2.5 py-0.5 rounded-full hover:bg-primary/90 transition-colors whitespace-nowrap"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setShowCustomTypeInput(false); setCustomTypeInput('') }}
                    className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Groups / Segments */}
          <GroupTagInput selected={groups} onChange={handleGroupsChange} />

          {/* Status & Access Controls */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 block">
              Status
            </Label>
            <div className="flex flex-wrap gap-2">
              {PARTY_STATUS_OPTS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPartyStatus(opt.value)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    partyStatus === opt.value
                      ? opt.activeClass
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {opt.icon}{opt.label}
                </button>
              ))}
            </div>

            {/* Hold Until — shown only when On Hold */}
            {partyStatus === 'on_hold' && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-xs text-amber-700 whitespace-nowrap">Hold Until</span>
                <div className="flex gap-1.5 flex-1">
                  <button
                    type="button"
                    onClick={() => setHoldUntil(addDays(7))}
                    className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                  >
                    +7d
                  </button>
                  <button
                    type="button"
                    onClick={() => setHoldUntil(addDays(14))}
                    className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                  >
                    +14d
                  </button>
                  <button
                    type="button"
                    onClick={() => setHoldUntil(addDays(30))}
                    className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                  >
                    +30d
                  </button>
                  <input
                    type="date"
                    value={holdUntil}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setHoldUntil(e.target.value)}
                    className="flex-1 text-xs border border-amber-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>
            )}

            {/* Payment Blocked toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={paymentBlocked}
              onClick={() => setPaymentBlocked(v => !v)}
              className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 border transition-colors ${
                paymentBlocked
                  ? 'bg-red-50 border-red-300'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                <Ban className={`w-3.5 h-3.5 ${paymentBlocked ? 'text-red-600' : 'text-gray-400'}`} />
                Payment Blocked
                <span className="text-gray-400 font-normal">(prevents payment processing)</span>
              </span>
              <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${paymentBlocked ? 'bg-red-500' : 'bg-gray-300'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${paymentBlocked ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
              </span>
            </button>
          </div>

          {/* More Details — collapsible */}
          <div className="border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
            >
              <span>{expanded ? 'Fewer details' : 'More details'}</span>
              {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>

            {expanded && (
              <div className="p-4 space-y-4">

                {/* Tax / Registration IDs — shown based on partyCountry */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span
                      className="inline-flex items-center justify-center rounded px-1 py-0.5 text-[10px] font-bold bg-primary/10 text-primary border border-primary/20"
                    >{partyCountry.iso}</span>
                    Tax &amp; Registration IDs
                  </p>
                  <div className={`grid gap-3 ${activeTaxFields.length === 1 ? 'grid-cols-1' : activeTaxFields.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {activeTaxFields.map(field => (
                      <div key={field.key}>
                        <Label className="text-xs">{field.label}</Label>
                        <Input
                          value={getTaxVal(field.key)}
                          onChange={e => {
                            const v = e.target.value.toUpperCase().slice(0, field.maxLength ?? 50)
                            setTaxVal(field.key, v)
                            if (errors[field.key]) clearFieldErr(field.key)
                          }}
                          placeholder={field.placeholder}
                          maxLength={field.maxLength}
                          className={`mt-1 text-xs ${field.mono ? 'font-mono' : ''} ${errors[field.key] ? 'border-red-400' : ''}`}
                        />
                        {errors[field.key] && (
                          <p className="text-[10px] text-red-500 mt-0.5">{errors[field.key]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Website */}
                <div>
                  <Label className="flex items-center gap-1 text-xs"><Globe className="w-3 h-3" /> Website</Label>
                  <Input value={website} onChange={e => { setWebsite(e.target.value); clearFieldErr('website') }}
                    placeholder="https://example.com"
                    className={`mt-1 text-sm ${errors.website ? 'border-red-400' : ''}`} />
                  {errors.website && <p className="text-[10px] text-red-500 mt-0.5">{errors.website}</p>}
                </div>

                {/* Alternate Phone */}
                <div>
                  <Label className="flex items-center gap-1 text-xs"><PhoneCall className="w-3 h-3" /> Alternate Phone</Label>
                  <div className="mt-1">
                    <PhoneInput value={altPhone} onChange={setAltPhone} defaultCountryIso="IN" />
                  </div>
                </div>

                {/* Addresses — multi-entry with type selector */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1 text-xs"><MapPin className="w-3 h-3" /> Addresses</Label>
                    <button
                      type="button" onClick={addAddr}
                      className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 border border-primary/30 rounded-full px-2.5 py-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add Address
                    </button>
                  </div>

                  {addresses.map((addr, idx) => (
                    <div key={addr.id} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50/50">
                      {/* Row 1: address type dropdown + optional custom name + remove */}
                      <div className="flex items-center gap-2">
                        <select
                          value={addr.type}
                          onChange={e => updateAddr(addr.id, { type: e.target.value as AddrType, customName: '' })}
                          className="shrink-0 text-xs font-medium border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary text-gray-700"
                        >
                          {ADDR_TYPE_OPTS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>

                        {/* Custom name input — shown only when "Other…" is selected */}
                        {addr.type === 'other' && (
                          <Input
                            value={addr.customName ?? ''}
                            onChange={e => updateAddr(addr.id, { customName: e.target.value })}
                            placeholder="Name this address…"
                            className="flex-1 text-xs h-[30px] py-0"
                            autoFocus
                          />
                        )}

                        {addr.type !== 'other' && <span className="flex-1" />}

                        {addresses.length > 1 && (
                          <button
                            type="button" onClick={() => removeAddr(addr.id)}
                            className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Remove this address"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {idx === 0 && addresses.length === 1 && addr.type !== 'other' && (
                          <span className="text-[10px] text-gray-400 italic shrink-0">primary</span>
                        )}
                      </div>

                      {/* Row 2: street */}
                      <Input
                        value={addr.street}
                        onChange={e => updateAddr(addr.id, { street: e.target.value })}
                        placeholder="Street address / flat / landmark"
                        className="text-sm"
                      />

                      {/* Row 3: city + state */}
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={addr.city} onChange={e => updateAddr(addr.id, { city: e.target.value })}
                          placeholder="City" className="text-sm" />
                        <Input value={addr.state} onChange={e => updateAddr(addr.id, { state: e.target.value })}
                          placeholder="State / Province" className="text-sm" />
                      </div>

                      {/* Row 4: pincode + country */}
                      <div className="flex gap-2">
                        <Input
                          value={addr.pincode}
                          onChange={e => updateAddr(addr.id, { pincode: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                          placeholder="PIN / ZIP" className="text-sm w-28 shrink-0" maxLength={10}
                        />
                        <div className="flex-1">
                          <CountryPicker
                            value={addr.country.name}
                            onChange={c => updateAddr(addr.id, { country: c })}
                            mode="name" className="w-full"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Credit Limit + Payment Terms */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="flex items-center gap-1 text-xs"><CreditCard className="w-3 h-3" /> Credit Limit</Label>
                    <Input type="number" step="0.01" value={creditLimit}
                      onChange={e => setCreditLimit(e.target.value)} placeholder="0.00" className="mt-1 text-sm" />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1 text-xs"><Clock className="w-3 h-3" /> Payment Terms</Label>

                    {showTermsInput ? (
                      /* ── Custom term input ── */
                      <div className="mt-1 flex gap-1.5">
                        <Input
                          autoFocus value={termsInput}
                          onChange={e => setTermsInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); addCustomTerm() }
                            if (e.key === 'Escape') { setShowTermsInput(false); setTermsInput('') }
                          }}
                          placeholder="e.g. Net 120, 30 Days EOM…"
                          className="flex-1 text-sm h-9"
                        />
                        <Button type="button" size="sm" onMouseDown={e => e.preventDefault()} onClick={addCustomTerm}
                          className="h-9 px-3 bg-primary hover:bg-primary/90 text-white shrink-0">Add</Button>
                        <Button type="button" size="sm" variant="ghost" onMouseDown={e => e.preventDefault()}
                          onClick={() => { setShowTermsInput(false); setTermsInput('') }}
                          className="h-9 px-2 shrink-0 text-gray-400 hover:text-gray-700">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      /* ── Dropdown + Custom button ── */
                      <div className="mt-1 flex gap-1.5">
                        <select
                          value={paymentTerms}
                          onChange={e => setPaymentTerms(e.target.value)}
                          className="flex-1 text-sm border rounded-lg px-3 h-9 focus:outline-none focus:ring-2 focus:ring-primary bg-white text-gray-700"
                        >
                          <option value="">Select terms…</option>
                          <optgroup label="Standard">
                            {PAYMENT_TERMS_DEFAULT.map(t => <option key={t} value={t}>{t}</option>)}
                          </optgroup>
                          {customTerms.length > 0 && (
                            <optgroup label="Custom">
                              {customTerms.map(t => <option key={t} value={t}>{t}</option>)}
                            </optgroup>
                          )}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowTermsInput(true)}
                          className="shrink-0 flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 border border-primary/30 rounded-lg px-2.5 h-9 transition-colors whitespace-nowrap"
                        >
                          <Plus className="w-3 h-3" /> Custom
                        </button>
                      </div>
                    )}

                    {/* Selected term badge */}
                    {paymentTerms && !showTermsInput && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-xs font-semibold rounded-md px-2.5 py-1">
                          <CheckCircle2 className="w-3 h-3 text-primary/60" />
                          {paymentTerms}
                          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setPaymentTerms('')}
                            className="ml-0.5 text-primary/40 hover:text-primary transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      </div>
                    )}

                    {/* Saved custom terms */}
                    {customTerms.length > 0 && !showTermsInput && (
                      <div className="mt-1.5">
                        <p className="text-[10px] text-gray-400 font-medium mb-1">Saved custom terms</p>
                        <div className="flex flex-wrap gap-1">
                          {customTerms.map(t => (
                            <span key={t} className="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-600 border border-gray-200 rounded-md px-2 py-0.5">
                              {t}
                              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => removeCustomTerm(t)}
                                className="text-gray-400 hover:text-red-500 transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Opening Balance + Contact Person */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="flex items-center gap-1 text-xs"><IndianRupee className="w-3 h-3" /> Opening Balance</Label>
                    <Input type="number" step="0.01" value={openingBalance}
                      onChange={e => { setOpeningBalance(e.target.value); clearFieldErr('openingBalance') }} placeholder="0.00"
                      className={`mt-1 text-sm ${errors.openingBalance ? 'border-red-400' : ''}`} />
                    {errors.openingBalance
                      ? <p className="text-[10px] text-red-500 mt-0.5">{errors.openingBalance}</p>
                      : <p className="text-[10px] text-gray-400 mt-0.5">
                          {partyType === 'customer' ? '+ve = receivable, -ve = advance/credit' : '+ve = payable, -ve = advance paid'}
                        </p>
                    }
                  </div>
                  {showContactPerson && (
                    <div>
                      <Label className="text-xs">Contact Person</Label>
                      <Input value={contactPerson} onChange={e => { setContactPerson(e.target.value); clearFieldErr('contactPerson') }}
                        placeholder="Contact name"
                        className={`mt-1 text-sm ${errors.contactPerson ? 'border-red-400' : ''}`} />
                      {errors.contactPerson && <p className="text-[10px] text-red-500 mt-0.5">{errors.contactPerson}</p>}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <Label className="text-xs">Notes</Label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Internal notes…" rows={2}
                    className="mt-1 w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>

                {/* Bank Details */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center gap-2">
                    <Landmark className="w-3.5 h-3.5 text-primary/70" />
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Bank Details</span>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Bank Name</Label>
                      <Input value={bankName} onChange={e => setBankName(e.target.value)}
                        placeholder="e.g. State Bank of India" className="mt-1 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Account Type</Label>
                      <select value={accountType} onChange={e => setAccountType(e.target.value)}
                        className="mt-1 w-full text-sm border rounded-lg px-3 h-9 focus:outline-none focus:ring-2 focus:ring-primary bg-white text-gray-700">
                        <option value="savings">Savings</option>
                        <option value="current">Current</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Account Holder Name</Label>
                      <Input value={accountHolderName} onChange={e => setAccountHolderName(e.target.value)}
                        placeholder="As per bank records" className="mt-1 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Account Number</Label>
                      <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="Account number" className="mt-1 text-sm font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs">IFSC Code</Label>
                      <Input value={ifscCode} onChange={e => setIfscCode(e.target.value.toUpperCase())}
                        placeholder="SBIN0001234" maxLength={11} className="mt-1 text-sm font-mono uppercase" />
                    </div>
                  </div>
                </div>

                {/* ── Custom / Extra Fields ─────────────────────────────────── */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Tag className="w-3 h-3" /> Custom Fields
                      <span className="text-gray-400 font-normal">(text, number, date, links, relations…)</span>
                    </Label>
                    <button
                      type="button" onClick={addCustomField}
                      className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary bg-accent hover:bg-primary/15 border border-primary/30 rounded-full px-2.5 py-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add Field
                    </button>
                  </div>

                  {customFields.length === 0 && (
                    <button
                      type="button" onClick={addCustomField}
                      className="w-full flex items-center justify-center gap-2 text-xs text-gray-400 border border-dashed border-gray-300 rounded-xl py-3 hover:border-primary/60 hover:text-primary/80 hover:bg-accent/80 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add a custom field — character, number, date, location, party link, or more
                    </button>
                  )}

                  {customFields.map(cf => (
                    <div key={cf.id} className="flex items-start gap-2 border border-gray-200 rounded-xl p-2.5 bg-gray-50/50">
                      {/* Field type badge */}
                      <div className="shrink-0 pt-0.5">
                        <select
                          value={cf.type}
                          onChange={e => updateCustomField(cf.id, { type: e.target.value as CustomFieldType, value: '' })}
                          className="text-[10px] font-semibold border rounded-lg px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-ring text-primary border-primary/30 w-[90px]"
                        >
                          {CUSTOM_FIELD_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Label + value */}
                      <div className="flex-1 space-y-1.5">
                        <Input
                          value={cf.label}
                          onChange={e => updateCustomField(cf.id, { label: e.target.value })}
                          placeholder="Field name / label"
                          className="text-xs h-7 py-0"
                        />
                        {cf.type === 'text' && (
                          <Input value={cf.value} onChange={e => updateCustomField(cf.id, { value: e.target.value })}
                            placeholder="Value" className="text-sm" />
                        )}
                        {cf.type === 'number' && (
                          <Input type="number" value={cf.value} onChange={e => updateCustomField(cf.id, { value: e.target.value })}
                            placeholder="0" className="text-sm" />
                        )}
                        {cf.type === 'phone' && (
                          <PhoneInput value={cf.value} onChange={(v) => updateCustomField(cf.id, { value: v })} defaultCountryIso="IN" />
                        )}
                        {cf.type === 'email' && (
                          <Input type="email" value={cf.value} onChange={e => updateCustomField(cf.id, { value: e.target.value })}
                            placeholder="email@example.com" className="text-sm" />
                        )}
                        {cf.type === 'date' && (
                          <Input type="date" value={cf.value} onChange={e => updateCustomField(cf.id, { value: e.target.value })}
                            className="text-sm" />
                        )}
                        {cf.type === 'url' && (
                          <Input type="url" value={cf.value} onChange={e => updateCustomField(cf.id, { value: e.target.value })}
                            placeholder="https://example.com" className="text-sm" />
                        )}
                        {cf.type === 'location' && (
                          <Input value={cf.value} onChange={e => updateCustomField(cf.id, { value: e.target.value })}
                            placeholder="Address, landmark, or lat,lng coordinates" className="text-sm" />
                        )}
                        {cf.type === 'relation' && (
                          <RelationPicker
                            value={cf.value}
                            onChange={v => updateCustomField(cf.id, { value: v })}
                          />
                        )}
                      </div>

                      {/* Remove */}
                      <button
                        type="button" onClick={() => removeCustomField(cf.id)}
                        className="shrink-0 mt-0.5 p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Remove field"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Portal Access */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50">
                    <Label className="flex items-center gap-1.5 text-xs cursor-pointer mb-0">
                      <Lock className="w-3 h-3" /> Portal Access
                      <span className="text-gray-400 font-normal">(enable login for this party)</span>
                    </Label>
                    <button
                      type="button" role="switch" aria-checked={enablePortal}
                      onClick={() => setEnablePortal(v => !v)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enablePortal ? 'bg-primary' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        enablePortal ? 'translate-x-[18px]' : 'translate-x-[2px]'
                      }`} />
                    </button>
                  </div>
                  {enablePortal && (
                    <div className="p-3 space-y-2">
                      <div className="relative">
                        <Input type={showPassword ? 'text' : 'password'} value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="Set portal password (leave blank for auto)"
                          className={`pr-10 text-sm ${errors.password ? 'border-red-400' : ''}`} />
                        <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-[10px] text-red-500">{errors.password}</p>}
                      <p className="text-[10px] text-gray-400">
                        If left blank, default password is the phone number or <code>Welcome@123</code>
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>

    {/* ── Suggestions dropdown — portalled to <body> to escape modal overflow clipping ── */}
    {showSuggestions && suggestions.length > 0 && dropdownRect && createPortal(
      <div
        style={{ position: 'fixed', top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, zIndex: 9999 }}
        className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-100">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <p className="text-[11px] font-semibold text-amber-700">
            {suggestions.length} existing record{suggestions.length !== 1 ? 's' : ''} found — click to pre-fill
          </p>
          <button type="button" className="ml-auto p-0.5 hover:bg-amber-100 rounded" onClick={() => setShowSuggestions(false)}>
            <X className="w-3 h-3 text-amber-400 hover:text-amber-600" />
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {suggestions.map((item, i) => {
            const isC = item.kind === 'customer'
            const label = isC ? (item.data as Customer).full_name : (item.data as Supplier).name
            const email2 = item.data.email
            const phone2 = item.data.phone
            const sub = [email2, phone2].filter(Boolean).join(' · ')
            const matched = matchedFields(item, lookup)
            const bdg = suggestionBadge(item)
            const initial = label?.[0]?.toUpperCase() || '?'
            return (
              <button
                key={i} type="button"
                onClick={() => applySuggestion(item)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/10 transition-colors text-left border-b last:border-b-0"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${isC ? 'bg-primary/15 text-primary' : 'bg-blue-100 text-blue-600'}`}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {sub && <p className="text-xs text-gray-400 truncate max-w-[200px]">{sub}</p>}
                    {matched.length > 0 && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded">
                        via {matched.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isC ? 'bg-primary/15 text-primary' : 'bg-blue-100 text-blue-700'}`}>{bdg}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                </div>
              </button>
            )
          })}
        </div>
      </div>,
      document.body
    )}
    </>
  )
}
